import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AccountManager, type ExtendedMultiAccountConfig } from '../src/account-manager.js';
import { createMcpServer } from '../src/mcp-server.js';
import { runWithRequestContext } from '../src/request-context.js';
import {
    recordToolListServed,
    resetToolListWatch,
    shouldNotifyToolListChanged,
} from '../src/tool-list-watch.js';

const baseConfig: ExtendedMultiAccountConfig = {
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

beforeEach(() => resetToolListWatch());

describe('staleness detection', () => {
    it('says nothing when the settings have never been changed', () => {
        // The absent-timestamp case is not a gap: if nothing has ever changed,
        // every cached tool list already matches reality.
        recordToolListServed('c1', 1000);
        expect(shouldNotifyToolListChanged('c1', undefined)).toBe(false);
    });

    it('notifies a client whose list predates the change', () => {
        recordToolListServed('c1', 1000);
        expect(shouldNotifyToolListChanged('c1', 2000)).toBe(true);
    });

    it('stays quiet when the client already has the newer list', () => {
        recordToolListServed('c1', 3000);
        expect(shouldNotifyToolListChanged('c1', 2000)).toBe(false);
    });

    it('treats an unknown client as up to date', () => {
        // We cannot tell -- it may predate a restart that cleared the map.
        // Guessing "stale" would notify every client after every restart.
        expect(shouldNotifyToolListChanged('never-seen', 2000)).toBe(false);
    });

    it('ignores a request with no client identity', () => {
        expect(shouldNotifyToolListChanged(undefined, 2000)).toBe(false);
    });
});

describe('settings timestamp', () => {
    const managerWith = (config: Partial<ExtendedMultiAccountConfig>) =>
        new AccountManager({
            initialConfig: { ...baseConfig, ...config },
            allowEnv: false,
            allowConfigFile: false,
        });

    it('is absent until the selection actually changes', () => {
        expect(managerWith({}).getToolSettingsUpdatedAt()).toBeUndefined();
    });

    it('is stamped when the selection changes', () => {
        const manager = managerWith({});
        manager.setDisabledToolGroups(['tasks']);

        expect(manager.getToolSettingsUpdatedAt()).toBeTypeOf('number');
        expect(manager.exportConfig().toolSettingsUpdatedAt).toBe(manager.getToolSettingsUpdatedAt());
    });

    it('is not restamped when the form is saved unchanged', () => {
        // Otherwise every connected client refetches its tool list for nothing.
        const manager = managerWith({ disabledToolGroups: ['tasks'], toolSettingsUpdatedAt: 1000 });
        manager.setDisabledToolGroups(['tasks']);

        expect(manager.getToolSettingsUpdatedAt()).toBe(1000);
    });

    it('restamps when a group is turned back on', () => {
        const manager = managerWith({ disabledToolGroups: ['tasks'], toolSettingsUpdatedAt: 1000 });
        manager.setDisabledToolGroups([]);

        expect(manager.getToolSettingsUpdatedAt()).toBeGreaterThan(1000);
    });
});

describe('delivery over MCP', () => {
    const open: Array<() => Promise<void>> = [];

    afterEach(async () => {
        await Promise.all(open.splice(0).map((close) => close()));
    });

    async function connect(config: Partial<ExtendedMultiAccountConfig>) {
        const accountManager = new AccountManager({
            initialConfig: { ...baseConfig, ...config },
            allowEnv: false,
            allowConfigFile: false,
        });
        const server = createMcpServer();
        const client = new Client({ name: 'test', version: '1.0.0' });
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

        const notifications: string[] = [];
        client.setNotificationHandler(ToolListChangedNotificationSchema, (n) => {
            notifications.push(n.method);
        });

        open.push(async () => {
            await client.close();
            await server.close();
        });

        const run = <T>(fn: () => Promise<T>) =>
            runWithRequestContext({ accountManager, authInfo: { clientId: 'c1' } as never }, fn);

        await run(async () => {
            await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
        });

        return { client, notifications, run };
    }

    it('advertises listChanged so clients will honour the notification', async () => {
        const { client } = await connect({});
        expect(client.getServerCapabilities()?.tools?.listChanged).toBe(true);
    });

    it('tells a client its tool list is stale on the next call', async () => {
        const { client, notifications, run } = await connect({
            toolSettingsUpdatedAt: Date.now() + 60_000,
        });

        // Serve a list first: only a client we have served can be known stale.
        await run(() => client.listTools());
        await run(() => client.callTool({ name: 'list_accounts', arguments: {} }));

        expect(notifications).toContain('notifications/tools/list_changed');
    });

    it('does not notify a client that has never been served a list', async () => {
        const { client, notifications, run } = await connect({
            toolSettingsUpdatedAt: Date.now() + 60_000,
        });

        await run(() => client.callTool({ name: 'list_accounts', arguments: {} }));

        expect(notifications).toEqual([]);
    });

    it('notifies only once for a single change', async () => {
        const { client, notifications, run } = await connect({
            toolSettingsUpdatedAt: Date.now() + 60_000,
        });

        await run(() => client.listTools());
        await run(() => client.callTool({ name: 'list_accounts', arguments: {} }));
        await run(() => client.callTool({ name: 'list_accounts', arguments: {} }));

        expect(notifications).toHaveLength(1);
    });

    it('notifies even when the call is refused for being hidden', async () => {
        // This is the case that matters most: the client is demonstrably acting
        // on a stale list, so it needs to refetch more than ever.
        const { client, notifications, run } = await connect({
            disabledToolGroups: ['tasks'],
            toolSettingsUpdatedAt: Date.now() + 60_000,
        });

        await run(() => client.listTools());
        await run(() =>
            client.callTool({ name: 'list_tasks', arguments: {} }).catch(() => undefined)
        );

        expect(notifications).toContain('notifications/tools/list_changed');
    });
});
