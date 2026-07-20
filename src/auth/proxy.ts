import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { RequestHandler } from 'express';

export interface ProxyAuthConfig {
    emailHeader: string;
    subjectHeader: string;
    allowlist?: Set<string>;
    userIdClaim: string;
}

export function createProxyAuthMiddleware(config: ProxyAuthConfig): RequestHandler {
    return (req, res, next) => {
        const email = getHeaderValue(req.headers[config.emailHeader]);
        const subject = getHeaderValue(req.headers[config.subjectHeader]);
        const userId = resolveUserId(email, subject, config.userIdClaim);

        if (!userId) {
            res.status(401).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Missing auth proxy headers' },
                id: null,
            });
            return;
        }

        if (config.allowlist && !config.allowlist.has(userId.toLowerCase())) {
            res.status(403).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'User not allowed' },
                id: null,
            });
            return;
        }

        const authInfo: AuthInfo = {
            token: 'proxy',
            clientId: 'proxy',
            scopes: ['*'],
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            extra: {
                email,
                sub: subject,
                userId,
            },
        };

        req.auth = authInfo;
        next();
    };
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value[0];
    return value;
}

function resolveUserId(email: string | undefined, subject: string | undefined, claim: string): string | undefined {
    if (claim === 'email') return email;
    if (claim === 'sub') return subject;
    return email ?? subject;
}
