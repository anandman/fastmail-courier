/**
 * Email send and forward tools for MCP server
 */

import { z } from 'zod';
import { getAccountManager } from '../account-manager.js';
import { getClient } from 'jmap-courier';

// Helper to normalize email addresses to array
function normalizeEmails(input: string | string[] | undefined): string[] {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    // Split by comma or semicolon
    return input.split(/[,;]/).map(e => e.trim()).filter(e => e.length > 0);
}

// Tool schemas
export const sendEmailSchema = z.object({
    to: z.union([z.string(), z.array(z.string())]).describe('Recipient email address(es)'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body (plain text). Keep concise if token usage matters.'),
    cc: z.union([z.string(), z.array(z.string())]).optional().describe('CC recipient(s)'),
    bcc: z.union([z.string(), z.array(z.string())]).optional().describe('BCC recipient(s)'),
    replyTo: z.string().optional().describe('Reply-to address'),
    isHtml: z.boolean().optional().default(false).describe('Whether body is HTML (default false)'),
});

export const forwardEmailSchema = z.object({
    emailId: z.string().describe('ID of the email to forward (use IDs from search_emails)'),
    to: z.union([z.string(), z.array(z.string())]).describe('Recipient email address(es)'),
    comment: z.string().optional().describe('Optional comment to add before forwarded content'),
    cc: z.union([z.string(), z.array(z.string())]).optional().describe('CC recipient(s)'),
    bcc: z.union([z.string(), z.array(z.string())]).optional().describe('BCC recipient(s)'),
});

// Tool handlers
export async function sendEmail(
    params: z.infer<typeof sendEmailSchema>
): Promise<{
    success: boolean;
    emailId: string;
    message: string;
    account: string | null;
}> {
    const manager = getAccountManager();
    const account = manager.getCurrentAccount();

    if (!account) {
        throw new Error('No account configured. Set FASTMAIL_API_TOKEN or configure accounts.');
    }

    const client = getClient(account);

    const toAddresses = normalizeEmails(params.to);
    if (toAddresses.length === 0) {
        throw new Error('At least one recipient is required');
    }

    const result = await client.sendEmail({
        to: toAddresses,
        subject: params.subject,
        textBody: params.isHtml ? '' : params.body,
        htmlBody: params.isHtml ? params.body : undefined,
        cc: normalizeEmails(params.cc),
        bcc: normalizeEmails(params.bcc),
        replyTo: params.replyTo,
    });

    return {
        success: true,
        emailId: result.emailId,
        message: `Email sent successfully to ${toAddresses.join(', ')}`,
        account: manager.getCurrentAccountName(),
    };
}

export async function forwardEmail(
    params: z.infer<typeof forwardEmailSchema>
): Promise<{
    success: boolean;
    emailId: string;
    message: string;
    account: string | null;
}> {
    const manager = getAccountManager();
    const account = manager.getCurrentAccount();

    if (!account) {
        throw new Error('No account configured. Set FASTMAIL_API_TOKEN or configure accounts.');
    }

    const client = getClient(account);

    const toAddresses = normalizeEmails(params.to);
    if (toAddresses.length === 0) {
        throw new Error('At least one recipient is required');
    }

    const result = await client.forwardEmail({
        originalEmailId: params.emailId,
        to: toAddresses,
        comment: params.comment,
        cc: normalizeEmails(params.cc),
        bcc: normalizeEmails(params.bcc),
    });

    return {
        success: true,
        emailId: result.emailId,
        message: `Email forwarded successfully to ${toAddresses.join(', ')}`,
        account: manager.getCurrentAccountName(),
    };
}
