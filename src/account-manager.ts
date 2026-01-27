/**
 * Multi-account configuration management for Fastmail Courier MCP server
 * 
 * Account configuration can be loaded from:
 * - Environment variables (FASTMAIL_API_TOKEN)
 * - Config file (~/.config/fastmail-courier/accounts.json)
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AccountConfig, MultiAccountConfig } from 'jmap-courier';

const FASTMAIL_SESSION_URL = 'https://api.fastmail.com/jmap/session';
const CONFIG_DIR = join(homedir(), '.config', 'fastmail-courier');
const CONFIG_FILE = join(CONFIG_DIR, 'accounts.json');

/**
 * Configuration manager for multi-account support
 */
export class AccountManager {
    private accounts: Map<string, AccountConfig> = new Map();
    private currentAccountName: string | null = null;

    constructor() {
        this.loadConfiguration();
    }

    /**
     * Load configuration from environment variable or config file
     */
    private loadConfiguration(): void {
        // Priority 1: Environment variables (single account)
        const envToken = process.env.FASTMAIL_API_TOKEN;
        const envEmail = process.env.FASTMAIL_EMAIL;

        if (envToken) {
            const name = envEmail || 'default';
            this.accounts.set(name, {
                name,
                token: envToken,
                sessionUrl: FASTMAIL_SESSION_URL,
            });
            this.currentAccountName = name;
        }

        // Priority 2: Config file (multi-account)
        if (existsSync(CONFIG_FILE)) {
            // Security check: warn if config file is world-readable
            this.checkConfigPermissions();

            try {
                const configData = readFileSync(CONFIG_FILE, 'utf-8');
                const config: MultiAccountConfig = JSON.parse(configData);

                for (const account of config.accounts) {
                    // Default to Fastmail session URL if not specified
                    const accountConfig: AccountConfig = {
                        ...account,
                        sessionUrl: account.sessionUrl || FASTMAIL_SESSION_URL,
                    };
                    this.accounts.set(account.name, accountConfig);
                }

                // Set default account if not already set from env
                if (!this.currentAccountName && config.defaultAccount) {
                    this.currentAccountName = config.defaultAccount;
                } else if (!this.currentAccountName && config.accounts.length > 0) {
                    this.currentAccountName = config.accounts[0].name;
                }
            } catch (error) {
                console.error(`Failed to load config from ${CONFIG_FILE}:`, error);
            }
        }
    }

    /**
     * Check config file permissions and warn if too permissive
     */
    private checkConfigPermissions(): void {
        try {
            const stats = statSync(CONFIG_FILE);
            const mode = stats.mode;
            // Check if group or others have read permission (on Unix-like systems)
            if ((mode & 0o044) !== 0) {
                console.warn(
                    `WARNING: ${CONFIG_FILE} may be readable by other users. ` +
                    `Consider running: chmod 600 "${CONFIG_FILE}"`
                );
            }
        } catch {
            // Ignore permission check errors (e.g., on Windows)
        }
    }

    /**
     * Get all configured accounts
     */
    getAccounts(): AccountConfig[] {
        return Array.from(this.accounts.values());
    }

    /**
     * Get account names
     */
    getAccountNames(): string[] {
        return Array.from(this.accounts.keys());
    }

    /**
     * Get current active account
     */
    getCurrentAccount(): AccountConfig | null {
        if (!this.currentAccountName) {
            return null;
        }
        return this.accounts.get(this.currentAccountName) || null;
    }

    /**
     * Get current account name
     */
    getCurrentAccountName(): string | null {
        return this.currentAccountName;
    }

    /**
     * Switch to a different account
     */
    switchAccount(accountName: string): boolean {
        if (!this.accounts.has(accountName)) {
            return false;
        }
        this.currentAccountName = accountName;
        return true;
    }

    /**
     * Add or update an account at runtime
     */
    addAccount(config: AccountConfig): void {
        if (!config.sessionUrl) {
            throw new Error('sessionUrl is required in AccountConfig');
        }
        this.accounts.set(config.name, config);

        // If this is the first account, make it current
        if (!this.currentAccountName) {
            this.currentAccountName = config.name;
        }
    }

    /**
     * Check if any accounts are configured
     */
    hasAccounts(): boolean {
        return this.accounts.size > 0;
    }

    /**
     * Get the config file path for documentation purposes
     */
    getConfigFilePath(): string {
        return CONFIG_FILE;
    }

    /**
     * Get the config directory path
     */
    getConfigDirPath(): string {
        return CONFIG_DIR;
    }
}

// Singleton instance
let accountManager: AccountManager | null = null;

export function getAccountManager(): AccountManager {
    if (!accountManager) {
        accountManager = new AccountManager();
    }
    return accountManager;
}

export function resetAccountManager(): void {
    accountManager = null;
}
