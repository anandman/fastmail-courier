#!/usr/bin/env node
/**
 * Fastmail MCP Server
 * 
 * An MCP server that provides email tools for Fastmail via JMAP protocol.
 * Works with Claude CLI, Gemini CLI, and other MCP-compatible clients.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { tools } from './tools/index.js';
import { getAccountManager } from './account-manager.js';

// Create server instance
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

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: zodToJsonSchema(tool.inputSchema),
        })),
    };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = tools.find((t) => t.name === name);
    if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
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

// Main function
async function main() {


    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
