/**
 * Tool registry for MCP server
 * Exports all tools with their schemas and handlers
 */

import { z } from 'zod';

// Account tools
import {
    listAccountsSchema,
    switchAccountSchema,
    getCurrentAccountSchema,
    listAccounts,
    switchAccount,
    getCurrentAccount,
} from './accounts.js';

// Mailbox tools
import {
    listMailboxesSchema,
    listMailboxes,
} from './mailboxes.js';

// Search tools
import {
    searchEmailsSchema,
    searchEmails,
} from './search.js';

// Read tools
import {
    getEmailSchema,
    getEmail,
} from './read.js';

// Send tools
import {
    sendEmailSchema,
    forwardEmailSchema,
    sendEmail,
    forwardEmail,
} from './send.js';

// Organize tools
import {
    moveEmailsSchema,
    deleteEmailsSchema,
    markEmailsSchema,
    tagEmailsSchema,
    moveEmails,
    deleteEmails,
    markEmails,
    tagEmails,
} from './organize.js';

// Tool definition type
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodType;
    handler: (params: unknown) => Promise<unknown>;
}

// All tools
export const tools: ToolDefinition[] = [
    // Account Management
    {
        name: 'list_accounts',
        description: 'List all configured Fastmail accounts and show the current active account',
        inputSchema: listAccountsSchema,
        handler: listAccounts,
    },
    {
        name: 'switch_account',
        description: 'Switch to a different Fastmail account',
        inputSchema: switchAccountSchema,
        handler: (params) => switchAccount(switchAccountSchema.parse(params)),
    },
    {
        name: 'get_current_account',
        description: 'Get the currently active Fastmail account',
        inputSchema: getCurrentAccountSchema,
        handler: getCurrentAccount,
    },

    // Mailboxes
    {
        name: 'list_mailboxes',
        description: 'List all mailboxes/folders in the current account (Inbox, Sent, Drafts, etc.)',
        inputSchema: listMailboxesSchema,
        handler: listMailboxes,
    },

    // Search & Read
    {
        name: 'search_emails',
        description: 'Search for emails with various filters (mailbox, sender, date range, keywords, etc.)',
        inputSchema: searchEmailsSchema,
        handler: (params) => searchEmails(searchEmailsSchema.parse(params)),
    },
    {
        name: 'get_email',
        description: 'Get the full content of an email by its ID, including body and attachments',
        inputSchema: getEmailSchema,
        handler: (params) => getEmail(getEmailSchema.parse(params)),
    },

    // Send & Forward
    {
        name: 'send_email',
        description: 'Compose and send a new email',
        inputSchema: sendEmailSchema,
        handler: (params) => sendEmail(sendEmailSchema.parse(params)),
    },
    {
        name: 'forward_email',
        description: 'Forward an existing email to new recipients with an optional comment',
        inputSchema: forwardEmailSchema,
        handler: (params) => forwardEmail(forwardEmailSchema.parse(params)),
    },

    // Bulk Organization
    {
        name: 'move_emails',
        description: 'Move one or more emails to a different mailbox/folder',
        inputSchema: moveEmailsSchema,
        handler: (params) => moveEmails(moveEmailsSchema.parse(params)),
    },
    {
        name: 'delete_emails',
        description: 'Delete one or more emails (moves them to trash)',
        inputSchema: deleteEmailsSchema,
        handler: (params) => deleteEmails(deleteEmailsSchema.parse(params)),
    },
    {
        name: 'mark_emails',
        description: 'Mark one or more emails as read/unread or flagged/unflagged',
        inputSchema: markEmailsSchema,
        handler: (params) => markEmails(markEmailsSchema.parse(params)),
    },
    {
        name: 'tag_emails',
        description: 'Add or remove keywords/labels on one or more emails',
        inputSchema: tagEmailsSchema,
        handler: (params) => tagEmails(tagEmailsSchema.parse(params)),
    },
];

// Export individual tools for testing
export {
    listAccounts,
    switchAccount,
    getCurrentAccount,
    listMailboxes,
    searchEmails,
    getEmail,
    sendEmail,
    forwardEmail,
    moveEmails,
    deleteEmails,
    markEmails,
    tagEmails,
};
