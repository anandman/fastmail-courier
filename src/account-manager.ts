/**
 * Multi-account configuration management for Fastmail Courier MCP server
 * 
 * Account configuration can be loaded from:
 * - Environment variables (FASTMAIL_API_TOKEN, FASTMAIL_CALDAV_PASSWORD)
 * - Config file (~/.config/fastmail-courier/accounts.json)
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AccountConfig, MultiAccountConfig } from 'jmap-courier';
import type { CalDAVConfig } from './caldav/types.js';
import { getRequestContext } from './request-context.js';

const FASTMAIL_SESSION_URL = 'https://api.fastmail.com/jmap/session';
const FASTMAIL_CALDAV_URL = 'https://caldav.fastmail.com';
const CONFIG_DIR = join(homedir(), '.config', 'fastmail-courier');
const CONFIG_FILE = join(CONFIG_DIR, 'accounts.json');

/**
 * Extended account configuration with CalDAV support
 */
export interface ExtendedAccountConfig extends AccountConfig {
    /** Friendly display name (e.g., "Personal", "Work") */
    displayName?: string;
    caldav?: {
        /** App password for CalDAV (NOT the API token) */
        password: string;
        /** Username (defaults to account name/email) */
        username?: string;
        /** CalDAV server URL (defaults to Fastmail) */
        serverUrl?: string;
    };
}

/**
 * Extended multi-account configuration
 */
export interface ExtendedMultiAccountConfig {
    accounts: ExtendedAccountConfig[];
    defaultAccount: string;
}

export interface AccountManagerOptions {
    initialConfig?: ExtendedMultiAccountConfig;
    allowEnv?: boolean;
    allowConfigFile?: boolean;
    configFilePath?: string;
    onChange?: (config: ExtendedMultiAccountConfig) => void;
}

/**
 * Configuration manager for multi-account support
 */
export class AccountManager {
    private accounts: Map<string, ExtendedAccountConfig> = new Map();
    private currentAccountName: string | null = null;
    /** CalDAV password from environment variable (shared across accounts) */
    private envCalDAVPassword: string | null = null;
    private onChange?: (config: ExtendedMultiAccountConfig) => void;

    constructor(options: AccountManagerOptions = {}) {
        this.onChange = options.onChange;
        this.loadConfiguration(options);
    }

    /**
     * Load configuration from environment variable or config file
     */
    private loadConfiguration(options: AccountManagerOptions): void {
        const allowEnv = options.allowEnv ?? true;
        const allowConfigFile = options.allowConfigFile ?? true;
        const configFilePath = options.configFilePath ?? CONFIG_FILE;
        const initialConfig = options.initialConfig;

        if (initialConfig) {
            this.applyConfig(initialConfig);
        }

        // Priority 1: Environment variables (single account)
        if (allowEnv) {
            const envToken = process.env.FASTMAIL_API_TOKEN;
            const envEmail = process.env.FASTMAIL_EMAIL;
            const envCalDAVPassword = process.env.FASTMAIL_CALDAV_PASSWORD;
            const envCalDAVUsername = process.env.FASTMAIL_CALDAV_USERNAME;

            // Store env CalDAV password for fallback
            if (envCalDAVPassword) {
                this.envCalDAVPassword = envCalDAVPassword;
            }

            if (envToken) {
                const name = envEmail || 'default';
                const extendedConfig: ExtendedAccountConfig = {
                    name,
                    token: envToken,
                    sessionUrl: FASTMAIL_SESSION_URL,
                };

                // Add CalDAV config if password provided
                if (envCalDAVPassword) {
                    extendedConfig.caldav = {
                        password: envCalDAVPassword,
                        username: envCalDAVUsername || name,
                        serverUrl: FASTMAIL_CALDAV_URL,
                    };
                }

                this.accounts.set(name, extendedConfig);
                this.currentAccountName = name;
            }
        }

        // Priority 2: Config file (multi-account)
        if (allowConfigFile && existsSync(configFilePath)) {
            // Security check: warn if config file is world-readable
            this.checkConfigPermissions(configFilePath);

            try {
                const configData = readFileSync(configFilePath, 'utf-8');
                const config: ExtendedMultiAccountConfig = JSON.parse(configData);

                this.applyConfig(config);
            } catch (error) {
                console.error(`Failed to load config from ${configFilePath}:`, error);
            }
        }
    }

    /**
     * Check config file permissions and warn if too permissive
     */
    private checkConfigPermissions(filePath: string): void {
        try {
            const stats = statSync(filePath);
            const mode = stats.mode;
            // Check if group or others have read permission (on Unix-like systems)
            if ((mode & 0o044) !== 0) {
                console.warn(
                    `WARNING: ${filePath} may be readable by other users. ` +
                    `Consider running: chmod 600 "${filePath}"`
                );
            }
        } catch {
            // Ignore permission check errors (e.g., on Windows)
        }
    }

    private applyConfig(config: ExtendedMultiAccountConfig): void {
        this.accounts.clear();
        for (const account of config.accounts) {
            const accountConfig: ExtendedAccountConfig = {
                ...account,
                sessionUrl: account.sessionUrl || FASTMAIL_SESSION_URL,
            };

            if (accountConfig.caldav) {
                accountConfig.caldav.serverUrl = accountConfig.caldav.serverUrl || FASTMAIL_CALDAV_URL;
                accountConfig.caldav.username = accountConfig.caldav.username || account.name;
            }

            this.accounts.set(account.name, accountConfig);
        }

        if (config.defaultAccount) {
            this.currentAccountName = config.defaultAccount;
        } else if (config.accounts.length > 0) {
            this.currentAccountName = config.accounts[0].name;
        }
    }

    private persist(): void {
        if (!this.onChange) return;
        this.onChange(this.exportConfig());
    }

    /**
     * Get all configured accounts
     */
    getAccounts(): ExtendedAccountConfig[] {
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
    getCurrentAccount(): ExtendedAccountConfig | null {
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
     * Switch to a different account by display name or email
     */
    switchAccount(identifier: string): boolean {
        // First try exact match on account key (email)
        if (this.accounts.has(identifier)) {
            this.currentAccountName = identifier;
            this.persist();
            return true;
        }

        // Try matching by displayName
        for (const [email, account] of this.accounts.entries()) {
            if (account.displayName?.toLowerCase() === identifier.toLowerCase()) {
                this.currentAccountName = email;
                this.persist();
                return true;
            }
        }

        return false;
    }

    /**
     * Add or update an account at runtime
     */
    addAccount(config: ExtendedAccountConfig): void {
        if (!config.sessionUrl) {
            throw new Error('sessionUrl is required in AccountConfig');
        }
        this.accounts.set(config.name, config);

        // If this is the first account, make it current
        if (!this.currentAccountName) {
            this.currentAccountName = config.name;
        }

        this.persist();
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

    exportConfig(): ExtendedMultiAccountConfig {
        return {
            accounts: this.getAccounts(),
            defaultAccount: this.currentAccountName ?? '',
        };
    }

    /**
     * Get CalDAV configuration for the current account
     * Returns null if CalDAV is not configured
     */
    getCalDAVConfig(): CalDAVConfig | null {
        const account = this.getCurrentAccount();
        if (!account) {
            return null;
        }

        // Check if account has CalDAV config
        if (account.caldav?.password) {
            return {
                username: account.caldav.username || account.name,
                password: account.caldav.password,
                serverUrl: account.caldav.serverUrl || FASTMAIL_CALDAV_URL,
            };
        }

        // Fallback to environment variable CalDAV password
        if (this.envCalDAVPassword) {
            return {
                username: account.name,
                password: this.envCalDAVPassword,
                serverUrl: FASTMAIL_CALDAV_URL,
            };
        }

        return null;
    }

    /**
     * Check if CalDAV is configured for the current account
     */
    hasCalDAVConfig(): boolean {
        return this.getCalDAVConfig() !== null;
    }
}

// Singleton instance
let accountManager: AccountManager | null = null;

export function getAccountManager(): AccountManager {
    const requestContext = getRequestContext();
    if (requestContext?.accountManager) {
        return requestContext.accountManager;
    }
    if (!accountManager) {
        accountManager = new AccountManager();
    }
    return accountManager;
}

export function resetAccountManager(): void {
    accountManager = null;
}
