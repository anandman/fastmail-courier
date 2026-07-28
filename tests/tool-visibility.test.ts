import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';

import { AccountManager, type ExtendedMultiAccountConfig } from '../src/account-manager.js';
import { createMcpServer } from '../src/mcp-server.js';
import { runWithRequestContext } from '../src/request-context.js';
import { TOOL_GROUPS } from '../src/tools/groups.js';

const config: ExtendedMultiAccountConfig = {
    accounts: [
        {
            name: 'personal@example.com',
            displayName: 'Personal',
            token: 'personal-token',
            sessionUrl: 'https://api.fastmail.com/jmap/session',
        },
    ],
    defaultAccount: 'personal@example.com',
};

const open: Array<() => Promise<void>> = [];

afterEach(async () => {
    await Promise.all(open.splice(0).map((close) => close()));
});

/**
 * Runs one MCP exchange against a server whose user has the given groups off.
 * InMemoryTransport delivers messages synchronously, so the request context
 * established here reaches the server's handlers.
 */
async function withServer<T>(
    disabledToolGroups: string[],
    exchange: (client: Client) => Promise<T>
): Promise<T> {
    const accountManager = new AccountManager({
        initialConfig: { ...config, disabledToolGroups: disabledToolGroups as never },
        allowEnv: false,
        allowConfigFile: false,
    });

    const server = createMcpServer();
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    open.push(async () => {
        await client.close();
        await server.close();
    });

    return runWithRequestContext({ accountManager }, async () => {
        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
        return exchange(client);
    });
}

const TASK_TOOLS = TOOL_GROUPS.find((group) => group.id === 'tasks')!.tools;

describe('per-user tool visibility over MCP', () => {
    it('lists every tool when no group is disabled', async () => {
        const names = await withServer([], async (client) => {
            const { tools } = await client.listTools();
            return tools.map((tool) => tool.name);
        });

        for (const name of TASK_TOOLS) {
            expect(names).toContain(name);
        }
    });

    it('omits a disabled group from tools/list', async () => {
        const names = await withServer(['tasks'], async (client) => {
            const { tools } = await client.listTools();
            return tools.map((tool) => tool.name);
        });

        for (const name of TASK_TOOLS) {
            expect(names).not.toContain(name);
        }
        expect(names).toContain('search_emails');
        expect(names).toContain('list_accounts');
        expect(names).toContain('list_events');
    });

    it('refuses a call to a hidden tool even from a client with a stale list', async () => {
        // Clients cache tools/list. Hiding without enforcing would let a client
        // that connected before the change keep calling the tool indefinitely.
        const error = await withServer(['tasks'], async (client) => {
            return client.callTool({ name: 'list_tasks', arguments: {} }).catch((cause) => cause);
        });

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/turned off/i);
    });

    it('still allows calls to tools in groups that remain enabled', async () => {
        const result = await withServer(['tasks'], async (client) => {
            return client.callTool({ name: 'list_accounts', arguments: {} });
        });

        expect(result.isError).toBeFalsy();
    });
});
