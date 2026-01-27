/**
 * Email organization tools for MCP server
 * Supports bulk operations on multiple emails
 */

import { z } from 'zod';
import { getAccountManager } from '../account-manager.js';
import { getClient } from 'jmap-courier';

// Tool schemas
export const moveEmailsSchema = z.object({
    emailIds: z.array(z.string()).describe('IDs of emails to move'),
    mailbox: z.string().describe('Target mailbox name or ID'),
});

export const deleteEmailsSchema = z.object({
    emailIds: z.array(z.string()).describe('IDs of emails to delete (move to trash)'),
});

export const markEmailsSchema = z.object({
    emailIds: z.array(z.string()).describe('IDs of emails to mark'),
    isRead: z.boolean().optional().describe('Set read status (true = read, false = unread)'),
    isFlagged: z.boolean().optional().describe('Set flagged/starred status'),
});

export const tagEmailsSchema = z.object({
    emailIds: z.array(z.string()).describe('IDs of emails to tag'),
    addKeywords: z.array(z.string()).optional().describe('Keywords/tags to add'),
    removeKeywords: z.array(z.string()).optional().describe('Keywords/tags to remove'),
});

// Tool handlers
export async function moveEmails(
    params: z.infer<typeof moveEmailsSchema>
): Promise<{
    success: boolean;
    count: number;
    message: string;
    account: string | null;
}> {
    const manager = getAccountManager();
    const account = manager.getCurrentAccount();

    if (!account) {
        throw new Error('No account configured. Set FASTMAIL_API_TOKEN or configure accounts.');
    }

    if (params.emailIds.length === 0) {
        return {
            success: true,
            count: 0,
            message: 'No emails to move',
            account: manager.getCurrentAccountName(),
        };
    }

    const client = getClient(account);

    // Resolve mailbox
    const mailbox = await client.resolveMailbox(params.mailbox);
    if (!mailbox) {
        throw new Error(`Mailbox not found: ${params.mailbox}`);
    }

    await client.moveEmails(params.emailIds, mailbox.id);

    return {
        success: true,
        count: params.emailIds.length,
        message: `Moved ${params.emailIds.length} email(s) to "${mailbox.name}"`,
        account: manager.getCurrentAccountName(),
    };
}

export async function deleteEmails(
    params: z.infer<typeof deleteEmailsSchema>
): Promise<{
    success: boolean;
    count: number;
    message: string;
    account: string | null;
}> {
    const manager = getAccountManager();
    const account = manager.getCurrentAccount();

    if (!account) {
        throw new Error('No account configured. Set FASTMAIL_API_TOKEN or configure accounts.');
    }

    if (params.emailIds.length === 0) {
        return {
            success: true,
            count: 0,
            message: 'No emails to delete',
            account: manager.getCurrentAccountName(),
        };
    }

    const client = getClient(account);
    await client.deleteEmails(params.emailIds);

    return {
        success: true,
        count: params.emailIds.length,
        message: `Moved ${params.emailIds.length} email(s) to trash`,
        account: manager.getCurrentAccountName(),
    };
}

export async function markEmails(
    params: z.infer<typeof markEmailsSchema>
): Promise<{
    success: boolean;
    count: number;
    message: string;
    account: string | null;
}> {
    const manager = getAccountManager();
    const account = manager.getCurrentAccount();

    if (!account) {
        throw new Error('No account configured. Set FASTMAIL_API_TOKEN or configure accounts.');
    }

    if (params.emailIds.length === 0) {
        return {
            success: true,
            count: 0,
            message: 'No emails to mark',
            account: manager.getCurrentAccountName(),
        };
    }

    if (params.isRead === undefined && params.isFlagged === undefined) {
        return {
            success: true,
            count: 0,
            message: 'No marking action specified',
            account: manager.getCurrentAccountName(),
        };
    }

    const client = getClient(account);
    const actions: string[] = [];

    if (params.isRead !== undefined) {
        await client.markEmailsRead(params.emailIds, params.isRead);
        actions.push(params.isRead ? 'read' : 'unread');
    }

    if (params.isFlagged !== undefined) {
        await client.markEmailsFlagged(params.emailIds, params.isFlagged);
        actions.push(params.isFlagged ? 'flagged' : 'unflagged');
    }

    return {
        success: true,
        count: params.emailIds.length,
        message: `Marked ${params.emailIds.length} email(s) as ${actions.join(' and ')}`,
        account: manager.getCurrentAccountName(),
    };
}

export async function tagEmails(
    params: z.infer<typeof tagEmailsSchema>
): Promise<{
    success: boolean;
    count: number;
    message: string;
    account: string | null;
}> {
    const manager = getAccountManager();
    const account = manager.getCurrentAccount();

    if (!account) {
        throw new Error('No account configured. Set FASTMAIL_API_TOKEN or configure accounts.');
    }

    if (params.emailIds.length === 0) {
        return {
            success: true,
            count: 0,
            message: 'No emails to tag',
            account: manager.getCurrentAccountName(),
        };
    }

    if ((!params.addKeywords || params.addKeywords.length === 0) &&
        (!params.removeKeywords || params.removeKeywords.length === 0)) {
        return {
            success: true,
            count: 0,
            message: 'No keywords to add or remove',
            account: manager.getCurrentAccountName(),
        };
    }

    const client = getClient(account);
    await client.setEmailKeywords(
        params.emailIds,
        params.addKeywords,
        params.removeKeywords
    );

    const actions: string[] = [];
    if (params.addKeywords && params.addKeywords.length > 0) {
        actions.push(`added: ${params.addKeywords.join(', ')}`);
    }
    if (params.removeKeywords && params.removeKeywords.length > 0) {
        actions.push(`removed: ${params.removeKeywords.join(', ')}`);
    }

    return {
        success: true,
        count: params.emailIds.length,
        message: `Updated keywords on ${params.emailIds.length} email(s) (${actions.join('; ')})`,
        account: manager.getCurrentAccountName(),
    };
}
