/**
 * Mailbox tools for MCP server
 */

import { z } from 'zod';
import { getAccountManager } from '../account-manager.js';
import { getClient } from 'jmap-courier';
import type { Mailbox } from 'jmap-courier';

// Tool schemas
export const listMailboxesSchema = z.object({});

// Tool handlers
export async function listMailboxes(): Promise<{
    mailboxes: Array<{
        id: string;
        name: string;
        role: string | null;
        unreadCount: number;
        totalCount: number;
        path: string;
    }>;
    account: string | null;
}> {
    const manager = getAccountManager();
    const account = manager.getCurrentAccount();

    if (!account) {
        throw new Error('No account configured. Set FASTMAIL_API_TOKEN or configure accounts.');
    }

    const client = getClient(account);
    const mailboxes = await client.getMailboxes();

    // Build mailbox paths (for nested mailboxes)
    const mailboxMap = new Map<string, Mailbox>();
    for (const mb of mailboxes) {
        mailboxMap.set(mb.id, mb);
    }

    function getPath(mb: Mailbox): string {
        if (!mb.parentId) {
            return mb.name;
        }
        const parent = mailboxMap.get(mb.parentId);
        if (!parent) {
            return mb.name;
        }
        return `${getPath(parent)}/${mb.name}`;
    }

    // Sort by role importance, then by name
    const roleOrder: Record<string, number> = {
        'inbox': 0,
        'drafts': 1,
        'sent': 2,
        'archive': 3,
        'trash': 4,
        'junk': 5,
    };

    const sortedMailboxes = [...mailboxes].sort((a, b) => {
        const aOrder = a.role ? (roleOrder[a.role] ?? 10) : 10;
        const bOrder = b.role ? (roleOrder[b.role] ?? 10) : 10;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
    });

    return {
        mailboxes: sortedMailboxes.map(mb => ({
            id: mb.id,
            name: mb.name,
            role: mb.role,
            unreadCount: mb.unreadEmails,
            totalCount: mb.totalEmails,
            path: getPath(mb),
        })),
        account: manager.getCurrentAccountName(),
    };
}
