/**
 * Middleware that makes OAuth failures legible.
 *
 * The SDK's auth router answers a failed exchange with a status and a JSON
 * error, which is correct but leaves nothing in the log. Both handlers here sit
 * in front of the router because it rejects an unknown client before the
 * provider is ever reached -- there is no hook inside the provider that sees
 * these.
 */

import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type express from 'express';

/**
 * Logs why a token exchange failed.
 *
 * Without this every failure is the same line -- `POST /token -> 400` --
 * whether the client is unknown, the refresh token expired, or PKCE did not
 * verify. A client looping on a dead registration then looks identical to one
 * that never connected, and to a server fault. Observed live: a Mac client
 * retried a doomed refresh every thirty seconds for half an hour, and the log
 * showed only a column of 400s.
 */
export function logTokenFailures(): express.RequestHandler {
    return (req, res, next) => {
        const body = req.body as Record<string, unknown> | undefined;
        const clientId = typeof body?.client_id === 'string' ? body.client_id : 'unnamed';
        const grantType = typeof body?.grant_type === 'string' ? body.grant_type : 'unspecified';

        // The reason appears in the response body and nowhere else, so capture
        // it as it goes past rather than trying to re-derive it.
        let failure: string | undefined;
        const json = res.json.bind(res);
        res.json = (payload: unknown) => {
            const error = (payload as { error?: unknown } | null)?.error;
            if (typeof error === 'string') failure = error;
            return json(payload);
        };

        res.on('finish', () => {
            if (res.statusCode < 400) return;
            console.warn(
                `[auth] token exchange failed for ${clientId}: ${failure ?? 'unspecified'}` +
                    ` (grant=${grantType}, status=${res.statusCode})`
            );
        });

        next();
    };
}

/**
 * Answers /authorize with a readable page when the client is not registered.
 *
 * This is the one OAuth endpoint a person actually looks at, so an unknown
 * client_id means someone clicked "connect" and is now reading whatever we
 * return. Refusing to redirect is required -- honouring an unvalidated
 * redirect_uri would make this an open redirect -- but a bare
 * `{"error":"invalid_client"}` tells them nothing. The cause is nearly always a
 * client still presenting a registration that was revoked or lost, and clients
 * do not re-register on their own.
 *
 * Anything unexpected falls through to the SDK, which produces the same error
 * it always did. This handler only ever improves a response; it never decides
 * one.
 */
export function guardUnknownClient(
    clientsStore: OAuthRegisteredClientsStore,
    renderPage: () => string
): express.RequestHandler {
    return (req, res, next) => {
        const clientId = req.query.client_id;
        if (typeof clientId !== 'string' || !clientId) {
            next();
            return;
        }

        void Promise.resolve(clientsStore.getClient(clientId))
            .then((client) => {
                if (client) {
                    next();
                    return;
                }
                console.warn(`[auth] authorize refused: client ${clientId} is not registered`);
                res.status(400).type('html').send(renderPage());
            })
            .catch(() => next());
    };
}
