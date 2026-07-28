import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getAccountManager } from './account-manager.js';
import { tools } from './tools/index.js';
import { isToolVisible } from './tools/groups.js';

export function createMcpServer(): Server {
    const server = new Server(
        {
            name: 'fastmail-courier',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const disabled = getAccountManager().getDisabledToolGroups();
        return {
            tools: tools
                .filter((tool) => isToolVisible(tool.name, disabled))
                .map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: zodToJsonSchema(tool.inputSchema),
                })),
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        const tool = tools.find((candidate) => candidate.name === name);
        if (!tool) {
            throw new Error(`Unknown tool: ${name}`);
        }

        // Hiding a tool from tools/list is not enough on its own: clients cache
        // that list, and a client holding a stale copy would keep calling a tool
        // the user has since turned off. Enforce the preference here too, where
        // the call actually happens.
        if (!isToolVisible(name, getAccountManager().getDisabledToolGroups())) {
            throw new Error(`Tool "${name}" is turned off for this account. Enable it in Courier's settings to use it.`);
        }

        try {
            const result = await tool.handler(args || {});
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: message }, null, 2),
                    },
                ],
                isError: true,
            };
        }
    });

    return server;
}
