import { createRemoteJWKSet, jwtVerify } from 'jose';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

export interface OidcProviderConfig {
    issuerUrl: URL;
    metadata: OAuthMetadata;
    jwksUri?: string;
    audience?: string;
    requiredScopes: string[];
    allowedUsers?: Set<string>;
    userIdClaim: string;
    introspection?: {
        url: URL;
        clientId: string;
        clientSecret: string;
    };
}

export interface OidcUiConfig {
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    scopes: string[];
}

function parseScopes(value: string | undefined, fallback: string[]): string[] {
    if (!value) return fallback;
    return value.split(/[,\s]+/).map((scope) => scope.trim()).filter(Boolean);
}

export async function loadOidcProviderConfig(): Promise<OidcProviderConfig> {
    const issuerValue = process.env.MCP_OIDC_ISSUER_URL;
    if (!issuerValue) {
        throw new Error('MCP_OIDC_ISSUER_URL is required for OIDC auth');
    }

    const issuerUrl = new URL(issuerValue);
    const metadata = await discoverOidcMetadata(issuerUrl);
    const requiredScopes = parseScopes(process.env.MCP_OIDC_REQUIRED_SCOPES, []);
    const audience = process.env.MCP_OIDC_AUDIENCE;
    const userIdClaim = process.env.MCP_USER_ID_CLAIM ?? 'email';
    const allowedUsers = parseAllowedUsers(process.env.MCP_ALLOWED_USERS);

    let introspection: OidcProviderConfig['introspection'];
    const introspectionUrl = process.env.MCP_OIDC_INTROSPECTION_URL;
    if (introspectionUrl) {
        const clientId = process.env.MCP_OIDC_CLIENT_ID;
        const clientSecret = process.env.MCP_OIDC_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            throw new Error('MCP_OIDC_CLIENT_ID and MCP_OIDC_CLIENT_SECRET are required for introspection');
        }
        introspection = {
            url: new URL(introspectionUrl),
            clientId,
            clientSecret,
        };
    }

    const jwksUri = typeof metadata.jwks_uri === 'string' ? metadata.jwks_uri : undefined;

    return {
        issuerUrl,
        metadata,
        jwksUri,
        audience,
        requiredScopes,
        allowedUsers,
        userIdClaim,
        introspection,
    };
}

export function loadOidcUiConfig(): OidcUiConfig {
    const clientId = process.env.MCP_OIDC_CLIENT_ID;
    const clientSecret = process.env.MCP_OIDC_CLIENT_SECRET;
    if (!clientId) {
        throw new Error('MCP_OIDC_CLIENT_ID is required for UI login');
    }
    const publicUrl = process.env.MCP_PUBLIC_URL;
    if (!publicUrl) {
        throw new Error('MCP_PUBLIC_URL is required for UI login');
    }
    const redirectUri = process.env.MCP_OIDC_REDIRECT_URI ?? `${publicUrl.replace(/\/$/, '')}/auth/callback`;
    const scopes = parseScopes(process.env.MCP_OIDC_SCOPES, ['openid', 'email', 'profile']);

    return {
        clientId,
        clientSecret,
        redirectUri,
        scopes,
    };
}

export function parseAllowedUsers(value: string | undefined): Set<string> | undefined {
    if (!value) return undefined;
    const entries = value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    return entries.length > 0 ? new Set(entries) : undefined;
}

export async function createOidcVerifier(config: OidcProviderConfig) {
    const jwks = config.jwksUri ? createRemoteJWKSet(new URL(config.jwksUri)) : undefined;

    async function verifyJwtToken(token: string): Promise<AuthInfo> {
        if (!jwks) {
            throw new Error('OIDC JWKS URI is missing');
        }
        const { payload } = await jwtVerify(token, jwks, {
            issuer: config.issuerUrl.href,
            audience: config.audience,
        });

        const scopes = parseScopeClaim(payload);
        const expiresAt = typeof payload.exp === 'number' ? payload.exp : undefined;
        const clientId = resolveClientId(payload);
        const authInfo: AuthInfo = {
            token,
            clientId,
            scopes,
            expiresAt,
            extra: payload as Record<string, unknown>,
        };

        enforceAllowlist(authInfo, config);

        return authInfo;
    }

    async function verifyIntrospectionToken(token: string): Promise<AuthInfo> {
        if (!config.introspection) {
            throw new Error('OIDC introspection is not configured');
        }
        const response = await fetch(config.introspection.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                token,
                client_id: config.introspection.clientId,
                client_secret: config.introspection.clientSecret,
            }),
        });
        if (!response.ok) {
            throw new Error(`OIDC introspection failed (${response.status})`);
        }
        const data = (await response.json()) as Record<string, unknown>;
        if (!data.active) {
            throw new Error('Token inactive');
        }

        const scopes = typeof data.scope === 'string' ? data.scope.split(' ') : [];
        const expiresAt = typeof data.exp === 'number' ? data.exp : undefined;
        const clientId = typeof data.client_id === 'string' ? data.client_id : 'oidc';
        const authInfo: AuthInfo = {
            token,
            clientId,
            scopes,
            expiresAt,
            extra: data,
        };

        enforceAllowlist(authInfo, config);

        return authInfo;
    }

    return {
        verifyAccessToken: async (token: string) => {
            const looksLikeJwt = token.split('.').length === 3;
            if (looksLikeJwt) {
                try {
                    return await verifyJwtToken(token);
                } catch (error) {
                    if (config.introspection) {
                        return verifyIntrospectionToken(token);
                    }
                    throw error;
                }
            }
            if (config.introspection) {
                return verifyIntrospectionToken(token);
            }
            throw new Error('Opaque tokens require MCP_OIDC_INTROSPECTION_URL');
        },
    };
}

export async function verifyIdToken(token: string, config: OidcProviderConfig, clientId: string): Promise<Record<string, unknown>> {
    if (!config.jwksUri) {
        throw new Error('OIDC JWKS URI is missing');
    }
    const jwks = createRemoteJWKSet(new URL(config.jwksUri));
    const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuerUrl.href,
        audience: clientId,
    });
    return payload as Record<string, unknown>;
}

function resolveClientId(payload: Record<string, unknown>): string {
    const aud = payload.aud;
    if (typeof payload.azp === 'string') {
        return payload.azp;
    }
    if (typeof aud === 'string') {
        return aud;
    }
    if (Array.isArray(aud) && aud.length > 0 && typeof aud[0] === 'string') {
        return aud[0];
    }
    return 'oidc';
}

function parseScopeClaim(payload: Record<string, unknown>): string[] {
    const scope = payload.scope ?? payload.scp;
    if (typeof scope === 'string') {
        return scope.split(' ').filter(Boolean);
    }
    if (Array.isArray(scope)) {
        return scope.filter((entry): entry is string => typeof entry === 'string');
    }
    return [];
}

function enforceAllowlist(authInfo: AuthInfo, config: OidcProviderConfig) {
    if (!config.allowedUsers || config.allowedUsers.size === 0) {
        return;
    }
    const claimValue = authInfo.extra?.[config.userIdClaim];
    if (typeof claimValue !== 'string') {
        throw new InvalidTokenError(`Missing claim "${config.userIdClaim}" for allowlist check`);
    }
    if (!config.allowedUsers.has(claimValue.toLowerCase())) {
        throw new InvalidTokenError('User not allowed');
    }
}

async function discoverOidcMetadata(issuerUrl: URL): Promise<OAuthMetadata> {
    const openIdConfigUrl = new URL('.well-known/openid-configuration', issuerUrl);
    const openIdResponse = await fetch(openIdConfigUrl);
    if (openIdResponse.ok) {
        const data = (await openIdResponse.json()) as OAuthMetadata;
        return data;
    }

    const oauthConfigUrl = new URL('.well-known/oauth-authorization-server', issuerUrl);
    const oauthResponse = await fetch(oauthConfigUrl);
    if (!oauthResponse.ok) {
        throw new Error('Failed to discover OIDC metadata');
    }
    return (await oauthResponse.json()) as OAuthMetadata;
}
