import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type express from 'express';

import { createMcpServer } from './mcp-server.js';

/**
 * Handles one Streamable HTTP request with an isolated stateless MCP connection.
 *
 * SDK transports retain connection-specific callbacks, so a stateless transport
 * must never be reused across requests. A new Server is paired with it because a
 * Server can only be connected to one transport at a time.
 */
export async function handleStatelessMcpRequest(
    req: express.Request,
    res: express.Response
): Promise<void> {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
    });

    let closePromise: Promise<void> | undefined;
    const close = () => {
        closePromise ??= server.close();
        return closePromise;
    };

    res.once('close', () => {
        void close().catch(() => undefined);
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } finally {
        if (res.writableEnded || res.destroyed) {
            await close();
        }
    }
}
