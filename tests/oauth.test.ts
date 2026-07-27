/**
 * Covers the bindings Courier is responsible for as an authorization server.
 * The SDK validates request shape; everything asserted here is our own logic,
 * and each failure below would be an auth bypass.
 */

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

import { CourierClientStore } from '../src/auth/client-store.js';
import { CourierOAuthProvider } from '../src/auth/oauth-provider.js';
import { TokenService } from '../src/auth/tokens.js';

const RESOURCE = 'https://courier.example:10000/mcp';
const ISSUER = 'https://courier.example:10000/';

let tempDir: string;
let clientsFile: string;

beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'courier-oauth-'));
    clientsFile = join(tempDir, 'oauth-clients.json');
});

afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
});

function makeTokenService(overrides: Partial<ConstructorParameters<typeof TokenService>[0]> = {}) {
    return new TokenService({
        issuer: ISSUER,
        audience: RESOURCE,
        secret: 'test-secret-value-long-enough-for-hs256',
        accessTokenTtlSeconds: 3600,
        refreshTokenTtlSeconds: 86400,
        ...overrides,
    });
}

function makeProvider(options: {
    store?: CourierClientStore;
    tokenService?: TokenService;
    allowedUsers?: Set<string>;
} = {}) {
    return new CourierOAuthProvider({
        clientsStore: options.store ?? new CourierClientStore({ filePath: clientsFile }),
        tokenService: options.tokenService ?? makeTokenService(),
        upstream: {
            issuerUrl: new URL('https://idp.example/'),
            metadata: {
                issuer: 'https://idp.example/',
                authorization_endpoint: 'https://idp.example/authorize',
                token_endpoint: 'https://idp.example/token',
                response_types_supported: ['code'],
            },
            requiredScopes: [],
            userIdClaim: 'sub',
            allowedUsers: options.allowedUsers,
        },
        upstreamClientId: 'upstream-client',
        upstreamRedirectUri: 'https://courier.example:10000/auth/mcp/callback',
        upstreamScopes: ['openid', 'email'],
        resourceUrl: RESOURCE,
        allowedUsers: options.allowedUsers,
        userIdClaim: 'sub',
    });
}

const client = (id: string) => ({
    client_id: id,
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
});

/** Injects a code the way handleUpstreamCallback would, without a live IdP. */
function seedCode(
    provider: CourierOAuthProvider,
    code: string,
    entry: Partial<{
        clientId: string;
        redirectUri: string;
        codeChallenge: string;
        userId: string;
        scopes: string[];
        expiresAt: number;
    }> = {}
) {
    const codes = (provider as unknown as { codes: Map<string, unknown> }).codes;
    codes.set(code, {
        clientId: entry.clientId ?? 'client-a',
        redirectUri: entry.redirectUri ?? 'https://claude.ai/api/mcp/auth_callback',
        codeChallenge: entry.codeChallenge ?? 'challenge',
        userId: entry.userId ?? 'user-1',
        email: 'user@example.com',
        scopes: entry.scopes ?? ['openid'],
        expiresAt: entry.expiresAt ?? Date.now() + 60_000,
    });
}

describe('CourierClientStore', () => {
    it('keeps new registrations in memory and never writes to disk', async () => {
        const store = new CourierClientStore({ filePath: clientsFile });
        await store.registerClient({ ...client('c1'), redirect_uris: ['https://a.example/cb'] } as never);

        expect(await store.getClient('c1')).toBeDefined();
        expect(existsSync(clientsFile)).toBe(false);
    });

    it('persists a client only once it is promoted', async () => {
        const store = new CourierClientStore({ filePath: clientsFile });
        await store.registerClient(client('c1') as never);
        await store.promoteClient('c1');

        expect(existsSync(clientsFile)).toBe(true);
        const data = JSON.parse(await readFile(clientsFile, 'utf8'));
        expect(Object.keys(data.clients)).toEqual(['c1']);
    });

    it('expires provisional registrations', async () => {
        const store = new CourierClientStore({ filePath: clientsFile, provisionalTtlMs: -1 });
        await store.registerClient(client('c1') as never);

        expect(await store.getClient('c1')).toBeUndefined();
    });

    it('evicts the oldest entry instead of growing without bound', async () => {
        const store = new CourierClientStore({ filePath: clientsFile, maxProvisional: 2 });
        await store.registerClient(client('c1') as never);
        await store.registerClient(client('c2') as never);
        await store.registerClient(client('c3') as never);

        expect(await store.getClient('c1')).toBeUndefined();
        expect(await store.getClient('c3')).toBeDefined();
    });

    it('survives a reload from disk', async () => {
        const first = new CourierClientStore({ filePath: clientsFile });
        await first.registerClient(client('c1') as never);
        await first.promoteClient('c1');

        const second = new CourierClientStore({ filePath: clientsFile });
        expect(await second.getClient('c1')).toBeDefined();
    });
});

describe('authorization code bindings', () => {
    it('rejects a code redeemed by a different client', async () => {
        const provider = makeProvider();
        seedCode(provider, 'code-1', { clientId: 'client-a' });

        await expect(
            provider.exchangeAuthorizationCode(client('client-b') as never, 'code-1')
        ).rejects.toThrow(/not issued to this client/);
    });

    it('rejects a mismatched redirect_uri', async () => {
        const provider = makeProvider();
        seedCode(provider, 'code-1');

        await expect(
            provider.exchangeAuthorizationCode(
                client('client-a') as never,
                'code-1',
                undefined,
                'https://evil.example/cb'
            )
        ).rejects.toThrow(/redirect_uri does not match/);
    });

    it('consumes a code so it cannot be replayed', async () => {
        const provider = makeProvider();
        seedCode(provider, 'code-1');

        await provider.exchangeAuthorizationCode(client('client-a') as never, 'code-1');
        await expect(
            provider.exchangeAuthorizationCode(client('client-a') as never, 'code-1')
        ).rejects.toThrow(/invalid or has expired/);
    });

    it('rejects an expired code', async () => {
        const provider = makeProvider();
        seedCode(provider, 'code-1', { expiresAt: Date.now() - 1 });

        await expect(
            provider.exchangeAuthorizationCode(client('client-a') as never, 'code-1')
        ).rejects.toThrow(/invalid or has expired/);
    });

    it('does not leak another client\'s PKCE challenge', async () => {
        const provider = makeProvider();
        seedCode(provider, 'code-1', { clientId: 'client-a' });

        await expect(
            provider.challengeForAuthorizationCode(client('client-b') as never, 'code-1')
        ).rejects.toThrow(/not issued to this client/);
        await expect(
            provider.challengeForAuthorizationCode(client('client-a') as never, 'code-1')
        ).resolves.toBe('challenge');
    });

    it('rejects a resource that is not this server', async () => {
        const provider = makeProvider();
        seedCode(provider, 'code-1');

        await expect(
            provider.exchangeAuthorizationCode(
                client('client-a') as never,
                'code-1',
                undefined,
                undefined,
                new URL('https://other.example/mcp')
            )
        ).rejects.toThrow(/resource does not match/);
    });

    it('promotes the client on a successful exchange', async () => {
        const store = new CourierClientStore({ filePath: clientsFile });
        await store.registerClient(client('client-a') as never);
        const provider = makeProvider({ store });
        seedCode(provider, 'code-1', { clientId: 'client-a' });

        const tokens = await provider.exchangeAuthorizationCode(client('client-a') as never, 'code-1');

        expect(tokens.access_token).toBeTruthy();
        expect(existsSync(clientsFile)).toBe(true);
    });
});

describe('tokens', () => {
    it('will not accept an access token where a refresh token is required', async () => {
        const tokens = makeTokenService();
        const issued = await tokens.issue({ userId: 'u1', clientId: 'c1', scopes: [] });

        await expect(tokens.verifyRefreshToken(issued.access_token)).rejects.toThrow(/not valid for this operation/);
        await expect(tokens.verifyAccessToken(issued.refresh_token)).rejects.toThrow(/not valid for this operation/);
    });

    it('rejects a token signed with a different secret', async () => {
        const issued = await makeTokenService().issue({ userId: 'u1', clientId: 'c1', scopes: [] });
        const other = makeTokenService({ secret: 'a-completely-different-signing-secret' });

        await expect(other.verifyAccessToken(issued.access_token)).rejects.toThrow();
    });

    it('refuses to start with a weak signing secret', () => {
        expect(() => makeTokenService({ secret: 'too-short' })).toThrow(/at least 32 characters/);
        expect(() => makeTokenService({ secret: 'x'.repeat(32) })).not.toThrow();
    });

    it('rejects a token minted for another audience', async () => {
        const issued = await makeTokenService({ audience: 'https://other.example/mcp' }).issue({
            userId: 'u1',
            clientId: 'c1',
            scopes: [],
        });

        await expect(makeTokenService().verifyAccessToken(issued.access_token)).rejects.toThrow();
    });
});

describe('refresh grant', () => {
    it('rejects a refresh token presented by a different client', async () => {
        const tokenService = makeTokenService();
        const provider = makeProvider({ tokenService });
        const issued = await tokenService.issue({ userId: 'u1', clientId: 'client-a', scopes: ['openid'] });

        await expect(
            provider.exchangeRefreshToken(client('client-b') as never, issued.refresh_token)
        ).rejects.toThrow(/not issued to this client/);
    });

    it('never widens scope on refresh', async () => {
        const tokenService = makeTokenService();
        const provider = makeProvider({ tokenService });
        const issued = await tokenService.issue({ userId: 'u1', clientId: 'client-a', scopes: ['openid'] });

        const refreshed = await provider.exchangeRefreshToken(client('client-a') as never, issued.refresh_token, [
            'openid',
            'admin',
        ]);

        expect(refreshed.scope).toBe('openid');
    });

    it('refuses a user who has since been removed from the allowlist', async () => {
        const tokenService = makeTokenService();
        const issued = await tokenService.issue({ userId: 'u1', clientId: 'client-a', scopes: [] });
        const provider = makeProvider({ tokenService, allowedUsers: new Set(['someone-else']) });

        await expect(
            provider.exchangeRefreshToken(client('client-a') as never, issued.refresh_token)
        ).rejects.toThrow(/no longer permitted/);
    });
});

describe('verifyAccessToken', () => {
    // A 401 is what tells a client to re-authenticate; anything else becomes a
    // 500 and the client retries forever against a server that will never
    // accept its stale token.
    it.each([
        ['a malformed token', 'not-a-jwt'],
        ['a token signed with another key', 'header.payload.badsignature'],
    ])('reports %s as InvalidTokenError so the client gets a 401', async (_label, token) => {
        await expect(makeProvider().verifyAccessToken(token)).rejects.toBeInstanceOf(InvalidTokenError);
    });

    it('reports an allowlist rejection as InvalidTokenError too', async () => {
        const tokenService = makeTokenService();
        const issued = await tokenService.issue({ userId: 'u1', clientId: 'client-a', scopes: [] });

        await expect(
            makeProvider({ tokenService, allowedUsers: new Set(['someone-else']) }).verifyAccessToken(
                issued.access_token
            )
        ).rejects.toBeInstanceOf(InvalidTokenError);
    });

    it('enforces the allowlist', async () => {
        const tokenService = makeTokenService();
        const issued = await tokenService.issue({ userId: 'u1', clientId: 'client-a', scopes: [] });

        await expect(
            makeProvider({ tokenService, allowedUsers: new Set(['someone-else']) }).verifyAccessToken(
                issued.access_token
            )
        ).rejects.toThrow(/not allowed/);
    });

    it('exposes the subject so per-user vaults resolve', async () => {
        const tokenService = makeTokenService();
        const issued = await tokenService.issue({
            userId: 'google-oauth2|123',
            email: 'user@example.com',
            clientId: 'client-a',
            scopes: ['openid'],
        });

        const authInfo = await makeProvider({ tokenService }).verifyAccessToken(issued.access_token);

        expect(authInfo.clientId).toBe('client-a');
        expect(authInfo.extra?.sub).toBe('google-oauth2|123');
        expect(authInfo.extra?.email).toBe('user@example.com');
    });
});
