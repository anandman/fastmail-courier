/**
 * Email search tools for MCP server
 */

import { z } from 'zod';
import { getAccountManager } from '../account-manager.js';
import { getClient } from 'jmap-courier';
import type { EmailFilter, EmailSummary } from 'jmap-courier';

// Tool schemas
export const searchEmailsSchema = z.object({
    mailbox: z.string().optional().describe('Mailbox name or ID to search in (e.g., "Inbox", "Sent")'),
    query: z.string().optional().describe('Full-text search query'),
    from: z.string().optional().describe('Filter by sender email or name'),
    to: z.string().optional().describe('Filter by recipient email or name'),
    subject: z.string().optional().describe('Filter by subject text'),
    after: z.string().optional().describe('Only emails after this date (ISO 8601 format, e.g., "2024-01-01")'),
    before: z.string().optional().describe('Only emails before this date (ISO 8601 format)'),
    hasAttachment: z.boolean().optional().describe('Filter by attachment presence'),
    isUnread: z.boolean().optional().describe('Filter by unread status'),
    limit: z.number().optional().default(20).describe('Maximum number of results (default 20, max 100)'),
});

// Tool handlers
export async function searchEmails(
    params: z.infer<typeof searchEmailsSchema>
): Promise<{
    emails: EmailSummary[];
    total: number;
    account: string | null;
}> {
    const manager = getAccountManager();
    const account = manager.getCurrentAccount();

    if (!account) {
        throw new Error('No account configured. Set FASTMAIL_API_TOKEN or configure accounts.');
    }

    const client = getClient(account);

    // Build filter
    const filter: EmailFilter = {};

    // Handle mailbox filter
    if (params.mailbox) {
        const mailbox = await client.resolveMailbox(params.mailbox);
        if (mailbox) {
            filter.inMailbox = mailbox.id;
        } else {
            throw new Error(`Mailbox not found: ${params.mailbox}`);
        }
    }

    if (params.query) {
        filter.text = params.query;
    }
    if (params.from) {
        filter.from = params.from;
    }
    if (params.to) {
        filter.to = params.to;
    }
    if (params.subject) {
        filter.subject = params.subject;
    }
    if (params.after) {
        filter.after = new Date(params.after).toISOString();
    }
    if (params.before) {
        filter.before = new Date(params.before).toISOString();
    }
    if (params.hasAttachment !== undefined) {
        filter.hasAttachment = params.hasAttachment;
    }
    if (params.isUnread === true) {
        filter.notKeyword = '$seen';
    } else if (params.isUnread === false) {
        filter.hasKeyword = '$seen';
    }

    const limit = Math.min(params.limit || 20, 100);

    // Query for email IDs
    const emailIds = await client.queryEmails(
        Object.keys(filter).length > 0 ? filter : undefined,
        [{ property: 'receivedAt', isAscending: false }],
        limit
    );

    // Fetch email details
    const emails = await client.getEmails(emailIds);

    // Convert to summary format
    const summaries: EmailSummary[] = emails.map(email => ({
        id: email.id,
        threadId: email.threadId,
        subject: email.subject,
        from: email.from,
        to: email.to,
        receivedAt: email.receivedAt,
        preview: email.preview,
        hasAttachment: email.hasAttachment,
        isRead: email.keywords?.['$seen'] === true,
        isFlagged: email.keywords?.['$flagged'] === true,
    }));

    return {
        emails: summaries,
        total: summaries.length,
        account: manager.getCurrentAccountName(),
    };
}
