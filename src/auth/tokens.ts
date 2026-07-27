import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Courier issues its own MCP access and refresh tokens rather than passing an
 * upstream provider's tokens through. The upstream IdP only authenticates the
 * human; nothing it returns is shaped for this resource server.
 */
export interface TokenServiceConfig {
    issuer: string;
    audience: string;
    secret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
}

export interface TokenSubject {
    userId: string;
    email?: string;
    clientId: string;
    scopes: string[];
}

export interface IssuedTokens {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope?: string;
}

export interface VerifiedToken {
    userId: string;
    email?: string;
    clientId: string;
    scopes: string[];
    expiresAt?: number;
    claims: Record<string, unknown>;
}

const ACCESS_TOKEN_TYPE = 'courier+access';
const REFRESH_TOKEN_TYPE = 'courier+refresh';
const MIN_SECRET_LENGTH = 32;

export class TokenService {
    private readonly key: Uint8Array;

    constructor(private readonly config: TokenServiceConfig) {
        if (!config.secret) {
            throw new Error('A token signing secret is required for MCP OAuth');
        }
        // jose imposes no minimum key length for HS256, so a weak secret would
        // otherwise sign real access tokens without complaint. Refuse anything
        // under 256 bits: `openssl rand -hex 32` produces a suitable value.
        if (config.secret.length < MIN_SECRET_LENGTH) {
            throw new Error(
                `Token signing secret must be at least ${MIN_SECRET_LENGTH} characters (got ${config.secret.length}). Generate one with: openssl rand -hex 32`
            );
        }
        this.key = new TextEncoder().encode(config.secret);
    }

    async issue(subject: TokenSubject): Promise<IssuedTokens> {
        const [access_token, refresh_token] = await Promise.all([
            this.sign(subject, ACCESS_TOKEN_TYPE, this.config.accessTokenTtlSeconds),
            this.sign(subject, REFRESH_TOKEN_TYPE, this.config.refreshTokenTtlSeconds),
        ]);

        return {
            access_token,
            token_type: 'Bearer',
            expires_in: this.config.accessTokenTtlSeconds,
            refresh_token,
            scope: subject.scopes.length > 0 ? subject.scopes.join(' ') : undefined,
        };
    }

    async verifyAccessToken(token: string): Promise<VerifiedToken> {
        return this.verify(token, ACCESS_TOKEN_TYPE);
    }

    async verifyRefreshToken(token: string): Promise<VerifiedToken> {
        return this.verify(token, REFRESH_TOKEN_TYPE);
    }

    private async sign(subject: TokenSubject, type: string, ttlSeconds: number): Promise<string> {
        const now = Math.floor(Date.now() / 1000);
        return new SignJWT({
            token_type: type,
            azp: subject.clientId,
            scope: subject.scopes.join(' '),
            ...(subject.email ? { email: subject.email } : {}),
        })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setIssuer(this.config.issuer)
            .setAudience(this.config.audience)
            .setSubject(subject.userId)
            .setIssuedAt(now)
            .setExpirationTime(now + ttlSeconds)
            .setJti(randomUUID())
            .sign(this.key);
    }

    private async verify(token: string, expectedType: string): Promise<VerifiedToken> {
        const { payload } = await jwtVerify(token, this.key, {
            issuer: this.config.issuer,
            audience: this.config.audience,
            algorithms: ['HS256'],
        });

        // Without this check an access token would be accepted as a refresh
        // token and vice versa, since both are signed with the same key.
        if (payload.token_type !== expectedType) {
            throw new Error('Token is not valid for this operation');
        }

        const userId = typeof payload.sub === 'string' ? payload.sub : undefined;
        const clientId = typeof payload.azp === 'string' ? payload.azp : undefined;
        if (!userId || !clientId) {
            throw new Error('Token is missing required claims');
        }

        return {
            userId,
            email: typeof payload.email === 'string' ? payload.email : undefined,
            clientId,
            scopes: typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : [],
            expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
            claims: payload as Record<string, unknown>,
        };
    }
}
