import { createServer, type Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { handleStatelessMcpRequest } from '../src/http-transport.js';

describe('Streamable HTTP transport', () => {
    let httpServer: HttpServer | undefined;
    const clients: Client[] = [];

    afterEach(async () => {
        await Promise.all(clients.splice(0).map((client) => client.close()));

        if (httpServer?.listening) {
            await new Promise<void>((resolve, reject) => {
                httpServer?.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
        }
        httpServer = undefined;
    });

    it('serves simultaneous independent MCP clients', async () => {
        const app = express();
        app.use(express.json());
        app.all('/mcp', handleStatelessMcpRequest);

        httpServer = createServer(app);
        await new Promise<void>((resolve, reject) => {
            httpServer?.once('error', reject);
            httpServer?.listen(0, '127.0.0.1', resolve);
        });

        const address = httpServer.address() as AddressInfo;
        const endpoint = new URL(`http://127.0.0.1:${address.port}/mcp`);

        const createClient = (name: string) => {
            const client = new Client({ name, version: '1.0.0' });
            clients.push(client);
            return client;
        };

        const firstClient = createClient('concurrent-client-one');
        const secondClient = createClient('concurrent-client-two');

        await Promise.all([
            firstClient.connect(new StreamableHTTPClientTransport(endpoint)),
            secondClient.connect(new StreamableHTTPClientTransport(endpoint)),
        ]);

        const [firstResult, secondResult] = await Promise.all([
            firstClient.listTools(),
            secondClient.listTools(),
        ]);

        expect(firstResult.tools.length).toBeGreaterThan(0);
        expect(secondResult.tools.map((tool) => tool.name)).toEqual(
            firstResult.tools.map((tool) => tool.name)
        );
    });
});
