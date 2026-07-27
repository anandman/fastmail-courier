import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

/**
 * Describes the upstream identity provider. Courier delegates human
 * authentication here and nothing else — it issues its own MCP tokens, so no
 * value returned by this provider is ever handed to an MCP client.
 */
export interface OidcProviderConfig {
    issuerUrl: URL;
    metadata: OAuthMetadata;
    jwksUri?: string;
    requiredScopes: string[];
    allowedUsers?: Set<string>;
    userIdClaim: string;
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
    const userIdClaim = process.env.MCP_USER_ID_CLAIM ?? 'email';
    const allowedUsers = parseAllowedUsers(process.env.MCP_ALLOWED_USERS);
    const jwksUri = typeof metadata.jwks_uri === 'string' ? metadata.jwks_uri : undefined;

    return {
        issuerUrl,
        metadata,
        jwksUri,
        requiredScopes,
        allowedUsers,
        userIdClaim,
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
