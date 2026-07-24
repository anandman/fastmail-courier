#!/usr/bin/env node
/**
 * Fastmail MCP Server
 * 
 * An MCP server that provides email tools for Fastmail via JMAP protocol.
 * Works with Claude CLI, Gemini CLI, and other MCP-compatible clients.
 */

import { createHash, randomBytes } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mcpAuthMetadataRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import express from 'express';

import { createOidcVerifier, loadOidcProviderConfig, loadOidcUiConfig, parseAllowedUsers, verifyIdToken } from './auth/oidc.js';
import { createProxyAuthMiddleware } from './auth/proxy.js';
import { signSession, verifySession } from './auth/session.js';
import { AccountManager } from './account-manager.js';
import { handleStatelessMcpRequest } from './http-transport.js';
import { createMcpServer } from './mcp-server.js';
import { createVaultStore } from './vault/index.js';
import { runWithRequestContext } from './request-context.js';
import { createUserAccountManager } from './user-accounts.js';
import { renderLoginPage, renderNoVaultPage, renderUiPage } from './ui.js';

// Main function
function parsePort(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function normalizePath(value: string | undefined): string {
    const path = value?.trim() || '/mcp';
    return path.startsWith('/') ? path : `/${path}`;
}

function parseAllowedHosts(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const allowedHosts = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    return allowedHosts.length > 0 ? allowedHosts : undefined;
}

function parseAuthMode(): 'oidc' | 'proxy' | 'none' {
    const explicit = process.env.MCP_AUTH_MODE?.toLowerCase();
    if (explicit === 'oidc' || explicit === 'proxy' || explicit === 'none') {
        return explicit;
    }
    if (process.env.MCP_AUTH_PROXY_EMAIL_HEADER || process.env.MCP_AUTH_PROXY_SUB_HEADER) {
        return 'proxy';
    }
    if (process.env.MCP_OIDC_ISSUER_URL) {
        return 'oidc';
    }
    return 'none';
}

function parseCookies(headerValue: string | undefined): Record<string, string> {
    if (!headerValue) return {};
    return headerValue.split(';').reduce<Record<string, string>>((acc, pair) => {
        const [rawKey, ...rest] = pair.trim().split('=');
        if (!rawKey) return acc;
        acc[rawKey] = decodeURIComponent(rest.join('='));
        return acc;
    }, {});
}

function setCookie(
    res: express.Response,
    name: string,
    value: string,
    options: { httpOnly?: boolean; secure?: boolean; maxAge?: number; path?: string; sameSite?: 'lax' | 'strict' | 'none' }
) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAge !== undefined) {
        parts.push(`Max-Age=${options.maxAge}`);
    }
    parts.push(`Path=${options.path ?? '/'}`);
    if (options.httpOnly) {
        parts.push('HttpOnly');
    }
    if (options.secure) {
        parts.push('Secure');
    }
    if (options.sameSite) {
        parts.push(`SameSite=${options.sameSite}`);
    }
    const cookieValue = parts.join('; ');
    const existing = res.getHeader('Set-Cookie');
    if (!existing) {
        res.setHeader('Set-Cookie', cookieValue);
        return;
    }
    if (Array.isArray(existing)) {
        res.setHeader('Set-Cookie', [...existing, cookieValue]);
        return;
    }
    res.setHeader('Set-Cookie', [existing.toString(), cookieValue]);
}

async function startStdioServer() {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

async function startHttpServer() {
    const host = process.env.MCP_HTTP_HOST ?? '127.0.0.1';
    const port = parsePort(process.env.MCP_HTTP_PORT, 3333);
    const path = normalizePath(process.env.MCP_HTTP_PATH);
    const allowedHosts = parseAllowedHosts(process.env.MCP_HTTP_ALLOWED_HOSTS);
    const authMode = parseAuthMode();
    const publicUrlValue = process.env.MCP_PUBLIC_URL ?? `http://${host}:${port}`;
    const publicUrl = new URL(publicUrlValue.endsWith('/') ? publicUrlValue.slice(0, -1) : publicUrlValue);
    const resourceServerUrl = new URL(path, publicUrl);

    const vault = authMode === 'none' ? null : createVaultStore();

    const app = createMcpExpressApp({ host, allowedHosts });

    app.use(express.urlencoded({ extended: false }));

    let oidcProviderConfig: Awaited<ReturnType<typeof loadOidcProviderConfig>> | null = null;
    let oidcUiConfig: ReturnType<typeof loadOidcUiConfig> | null = null;
    let oidcVerifier: Awaited<ReturnType<typeof createOidcVerifier>> | null = null;

    if (authMode === 'oidc') {
        oidcProviderConfig = await loadOidcProviderConfig();
        oidcUiConfig = loadOidcUiConfig();
        oidcVerifier = await createOidcVerifier(oidcProviderConfig);

        app.use(
            mcpAuthMetadataRouter({
                oauthMetadata: oidcProviderConfig.metadata,
                resourceServerUrl,
                serviceDocumentationUrl: new URL('docs/architecture.md', publicUrl),
            })
        );
    }

    if (authMode === 'proxy') {
        const allowlist = parseAllowedUsers(process.env.MCP_ALLOWED_USERS);
        app.use(
            createProxyAuthMiddleware({
                emailHeader: (process.env.MCP_AUTH_PROXY_EMAIL_HEADER ?? 'x-auth-email').toLowerCase(),
                subjectHeader: (process.env.MCP_AUTH_PROXY_SUB_HEADER ?? 'x-auth-user').toLowerCase(),
                allowlist,
                userIdClaim: process.env.MCP_USER_ID_CLAIM ?? 'email',
            })
        );
    }

    const mcpAuthMiddleware =
        authMode === 'oidc' && oidcVerifier
            ? requireBearerAuth({
                  verifier: oidcVerifier,
                  requiredScopes: oidcProviderConfig?.requiredScopes ?? [],
                  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
              })
            : null;

    app.get('/auth/login', async (req, res) => {
        if (authMode !== 'oidc' || !oidcProviderConfig || !oidcUiConfig) {
            res.status(404).send('OIDC not configured');
            return;
        }

        const state = randomBytes(16).toString('hex');
        const codeVerifier = randomBytes(32).toString('hex');
        const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

        const authorizeUrl = new URL(oidcProviderConfig.metadata.authorization_endpoint);
        authorizeUrl.searchParams.set('client_id', oidcUiConfig.clientId);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('redirect_uri', oidcUiConfig.redirectUri);
        authorizeUrl.searchParams.set('scope', oidcUiConfig.scopes.join(' '));
        authorizeUrl.searchParams.set('state', state);
        authorizeUrl.searchParams.set('code_challenge', codeChallenge);
        authorizeUrl.searchParams.set('code_challenge_method', 'S256');

        setCookie(res, 'fm_oidc_state', JSON.stringify({ state, codeVerifier }), {
            httpOnly: true,
            secure: publicUrl.protocol === 'https:',
            maxAge: 300,
            sameSite: 'lax',
        });

        res.redirect(authorizeUrl.toString());
    });

    app.get('/auth/callback', async (req, res) => {
        if (authMode !== 'oidc' || !oidcProviderConfig || !oidcUiConfig) {
            res.status(404).send('OIDC not configured');
            return;
        }

        const cookies = parseCookies(req.headers.cookie);
        const statePayload = cookies.fm_oidc_state ? safeJsonParse(cookies.fm_oidc_state) : null;
        const state = typeof statePayload?.state === 'string' ? statePayload.state : null;
        const codeVerifier = typeof statePayload?.codeVerifier === 'string' ? statePayload.codeVerifier : null;

        if (!state || !codeVerifier || req.query.state !== state || typeof req.query.code !== 'string') {
            res.status(400).send('Invalid OAuth state');
            return;
        }

        const tokenResponse = await fetch(oidcProviderConfig.metadata.token_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: req.query.code,
                redirect_uri: oidcUiConfig.redirectUri,
                client_id: oidcUiConfig.clientId,
                ...(oidcUiConfig.clientSecret ? { client_secret: oidcUiConfig.clientSecret } : {}),
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenResponse.ok) {
            res.status(400).send('Token exchange failed');
            return;
        }

        const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
        const idToken = typeof tokenData.id_token === 'string' ? tokenData.id_token : null;
        if (!idToken) {
            res.status(400).send('Missing id_token');
            return;
        }

        const idClaims = await verifyIdToken(idToken, oidcProviderConfig, oidcUiConfig.clientId);
        const authInfo = { extra: idClaims };
        const userIdClaim = process.env.MCP_USER_ID_CLAIM ?? 'email';
        const userId = resolveUserIdFromAuth(authInfo, userIdClaim);

        if (!userId) {
            res.status(403).send('User claim missing');
            return;
        }

        if (oidcProviderConfig.allowedUsers && !oidcProviderConfig.allowedUsers.has(userId.toLowerCase())) {
            res.status(403).send('User not allowed');
            return;
        }

        const ttlSeconds = Number.parseInt(process.env.MCP_UI_SESSION_TTL ?? '604800', 10);
        const sessionSecret = process.env.MCP_UI_SESSION_SECRET ?? process.env.FASTMAIL_VAULT_KEY ?? '';
        if (!sessionSecret) {
            res.status(500).send('MCP_UI_SESSION_SECRET is required');
            return;
        }

        const sessionToken = signSession(
            {
                sub: userId,
                email: typeof authInfo.extra?.email === 'string' ? authInfo.extra.email : undefined,
                exp: Math.floor(Date.now() / 1000) + ttlSeconds,
            },
            sessionSecret
        );

        setCookie(res, 'fm_session', sessionToken, {
            httpOnly: true,
            secure: publicUrl.protocol === 'https:',
            maxAge: ttlSeconds,
            sameSite: 'lax',
        });

        setCookie(res, 'fm_oidc_state', '', { maxAge: 0, path: '/' });

        res.redirect('/ui');
    });

    app.post('/auth/logout', (req, res) => {
        setCookie(res, 'fm_session', '', { maxAge: 0, path: '/' });
        res.redirect('/ui');
    });

    app.get('/ui', async (req, res) => {
        const uiUser = resolveUiUser(req, authMode);
        if (!uiUser) {
            res.status(200).send(renderLoginPage(authMode));
            return;
        }

        if (!vault) {
            res.status(200).send(renderNoVaultPage());
            return;
        }

        const manager = await createUserAccountManager(uiUser.userId, vault);
        const accounts = manager.getAccounts();
        const defaultAccount = manager.getCurrentAccountName();
        res.status(200).send(renderUiPage(uiUser, accounts, defaultAccount));
    });

    app.post('/ui/account', async (req, res) => {
        const uiUser = resolveUiUser(req, authMode);
        if (!uiUser) {
            res.status(401).send('Unauthorized');
            return;
        }

        const email = String(req.body.email ?? '').trim();
        const token = String(req.body.token ?? '').trim();
        const displayName = String(req.body.displayName ?? '').trim();
        const caldavPassword = String(req.body.caldavPassword ?? '').trim();
        const caldavUsername = String(req.body.caldavUsername ?? '').trim();
        const setDefault = req.body.setDefault === 'on';

        if (!email) {
            res.status(400).send('Email is required');
            return;
        }

        if (!vault) {
            res.status(500).send('Vault storage is not configured');
            return;
        }

        const manager = await createUserAccountManager(uiUser.userId, vault);
        const existing = manager.getAccounts().find((account) => account.name === email);
        const resolvedToken = token || existing?.token;

        if (!resolvedToken) {
            res.status(400).send('API token is required for new accounts');
            return;
        }

        await vault.updateUserConfig(uiUser.userId, (latestConfig) => {
            const latestManager = new AccountManager({
                initialConfig: latestConfig ?? { accounts: [], defaultAccount: '' },
                allowEnv: false,
                allowConfigFile: false,
            });
            const latestExisting = latestManager
                .getAccounts()
                .find((account) => account.name === email);
            const latestToken = token || latestExisting?.token || resolvedToken;

            latestManager.addAccount({
                name: email,
                token: latestToken,
                displayName: displayName || latestExisting?.displayName,
                sessionUrl:
                    latestExisting?.sessionUrl ?? 'https://api.fastmail.com/jmap/session',
                caldav: caldavPassword || latestExisting?.caldav?.password
                    ? {
                          password: caldavPassword || latestExisting?.caldav?.password || '',
                          username:
                              caldavUsername || latestExisting?.caldav?.username || email,
                          serverUrl:
                              latestExisting?.caldav?.serverUrl ??
                              'https://caldav.fastmail.com',
                      }
                    : undefined,
            });
            if (setDefault) {
                latestManager.setDefaultAccount(email);
            }
            return latestManager.exportConfig();
        });

        res.redirect('/ui');
    });

    app.all(path, ...(mcpAuthMiddleware ? [mcpAuthMiddleware] : []), async (req, res) => {
        try {
            const authInfo = req.auth;
            const userIdClaim = process.env.MCP_USER_ID_CLAIM ?? 'email';
            const userId = authInfo ? resolveUserIdFromAuth(authInfo, userIdClaim) : null;
            if (!userId && authMode !== 'none') {
                res.status(401).json({
                    jsonrpc: '2.0',
                    error: { code: -32000, message: 'Unauthorized' },
                    id: null,
                });
                return;
            }

            const accountManager = userId && vault ? await createUserAccountManager(userId, vault) : undefined;
            await runWithRequestContext({ accountManager, authInfo, userId: userId ?? undefined }, async () => {
                await handleStatelessMcpRequest(req, res);
            });
        } catch (error) {
            if (res.headersSent) {
                res.end();
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message,
                },
                id: null,
            });
        }
    });

    app.listen(port, host, () => {
        console.log(`Fastmail Courier listening on http://${host}:${port}${path}`);
    });
}

async function main() {
    const transportMode = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();

    if (transportMode === 'stdio') {
        await startStdioServer();
        return;
    }

    if (transportMode === 'http' || transportMode === 'streamable-http' || transportMode === 'streamable_http') {
        await startHttpServer();
        return;
    }

    throw new Error(`Unsupported transport mode: ${transportMode}`);
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});

function safeJsonParse(value: string): Record<string, unknown> | null {
    try {
        return JSON.parse(value) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function resolveUserIdFromAuth(authInfo: { extra?: Record<string, unknown> }, claim: string): string | null {
    const claimValue = authInfo.extra?.[claim];
    if (typeof claimValue === 'string') return claimValue;
    if (claim === 'email' && typeof authInfo.extra?.email === 'string') return authInfo.extra.email;
    if (claim === 'sub' && typeof authInfo.extra?.sub === 'string') return authInfo.extra.sub;
    if (typeof authInfo.extra?.userId === 'string') return authInfo.extra.userId;
    return null;
}

function resolveUiUser(req: express.Request, authMode: 'oidc' | 'proxy' | 'none') {
    if (authMode === 'proxy') {
        const authInfo = req.auth;
        const userIdClaim = process.env.MCP_USER_ID_CLAIM ?? 'email';
        const userId = authInfo ? resolveUserIdFromAuth(authInfo, userIdClaim) : null;
        return userId ? { userId } : null;
    }

    if (authMode === 'oidc') {
        const sessionSecret = process.env.MCP_UI_SESSION_SECRET ?? process.env.FASTMAIL_VAULT_KEY ?? '';
        if (!sessionSecret) {
            return null;
        }
        const cookies = parseCookies(req.headers.cookie);
        const sessionToken = cookies.fm_session;
        if (!sessionToken) return null;
        const session = verifySession(sessionToken, sessionSecret);
        if (!session) return null;
        return { userId: session.sub, email: session.email };
    }

    return { userId: 'local' };
}
