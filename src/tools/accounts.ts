/**
 * Account management tools for MCP server
 */

import { z } from 'zod';
import { getAccountManager } from '../account-manager.js';

// Tool schemas
export const listAccountsSchema = z.object({});

export const switchAccountSchema = z.object({
    account: z.string().describe('Account to select in the current client context (display name or email). This does not change the user-wide persisted default.'),
});

export const getCurrentAccountSchema = z.object({});

// Tool handlers
export async function listAccounts(): Promise<{
    accounts: Array<{ email: string; displayName?: string }>;
    currentAccount: string | null;
    currentDisplayName?: string;
    configFilePath: string;
}> {
    const manager = getAccountManager();
    const accounts = manager.getAccounts().map(a => ({
        email: a.name,
        displayName: a.displayName,
    }));
    const current = manager.getCurrentAccount();

    return {
        accounts,
        currentAccount: current?.name || null,
        currentDisplayName: current?.displayName,
        configFilePath: manager.getConfigFilePath(),
    };
}

export async function switchAccount(params: z.infer<typeof switchAccountSchema>): Promise<{
    success: boolean;
    previousAccount: string | null;
    currentAccount: string | null;
    currentDisplayName?: string;
    message: string;
}> {
    const manager = getAccountManager();
    const previousAccount = manager.getCurrentAccountName();

    const success = manager.switchAccount(params.account);

    if (success) {
        const current = manager.getCurrentAccount();
        const displayLabel = current?.displayName || current?.name;
        return {
            success: true,
            previousAccount,
            currentAccount: current?.name || null,
            currentDisplayName: current?.displayName,
            message: `Switched to "${displayLabel}"`,
        };
    } else {
        const available = manager.getAccounts().map(a => a.displayName || a.name);
        return {
            success: false,
            previousAccount,
            currentAccount: previousAccount,
            message: `Account "${params.account}" not found. Available: ${available.join(', ') || 'none configured'}`,
        };
    }
}

export async function getCurrentAccount(): Promise<{
    accountName: string | null;
    displayName?: string;
    hasAccounts: boolean;
    message: string;
}> {
    const manager = getAccountManager();
    const current = manager.getCurrentAccount();
    const hasAccounts = manager.hasAccounts();

    if (!hasAccounts) {
        return {
            accountName: null,
            hasAccounts: false,
            message: `No accounts configured. Set FASTMAIL_API_TOKEN environment variable or create ${manager.getConfigFilePath()}`,
        };
    }

    const displayLabel = current?.displayName ? `${current.displayName} (${current.name})` : current?.name;
    return {
        accountName: current?.name || null,
        displayName: current?.displayName,
        hasAccounts: true,
        message: `Current account: ${displayLabel}`,
    };
}
