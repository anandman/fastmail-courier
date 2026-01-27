/**
 * Account management tools for MCP server
 */

import { z } from 'zod';
import { getAccountManager } from '../account-manager.js';

// Tool schemas
export const listAccountsSchema = z.object({});

export const switchAccountSchema = z.object({
    accountName: z.string().describe('Name of the account to switch to (usually an email address)'),
});

export const getCurrentAccountSchema = z.object({});

// Tool handlers
export async function listAccounts(): Promise<{
    accounts: string[];
    currentAccount: string | null;
    configFilePath: string;
}> {
    const manager = getAccountManager();

    return {
        accounts: manager.getAccountNames(),
        currentAccount: manager.getCurrentAccountName(),
        configFilePath: manager.getConfigFilePath(),
    };
}

export async function switchAccount(params: z.infer<typeof switchAccountSchema>): Promise<{
    success: boolean;
    previousAccount: string | null;
    currentAccount: string | null;
    message: string;
}> {
    const manager = getAccountManager();
    const previousAccount = manager.getCurrentAccountName();

    const success = manager.switchAccount(params.accountName);

    if (success) {
        return {
            success: true,
            previousAccount,
            currentAccount: params.accountName,
            message: `Switched from "${previousAccount}" to "${params.accountName}"`,
        };
    } else {
        const available = manager.getAccountNames();
        return {
            success: false,
            previousAccount,
            currentAccount: previousAccount,
            message: `Account "${params.accountName}" not found. Available accounts: ${available.join(', ') || 'none configured'}`,
        };
    }
}

export async function getCurrentAccount(): Promise<{
    accountName: string | null;
    hasAccounts: boolean;
    message: string;
}> {
    const manager = getAccountManager();
    const current = manager.getCurrentAccountName();
    const hasAccounts = manager.hasAccounts();

    if (!hasAccounts) {
        return {
            accountName: null,
            hasAccounts: false,
            message: `No accounts configured. Set FASTMAIL_API_TOKEN environment variable or create ${manager.getConfigFilePath()}`,
        };
    }

    return {
        accountName: current,
        hasAccounts: true,
        message: `Current account: ${current}`,
    };
}
