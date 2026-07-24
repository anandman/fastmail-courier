import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    AccountManager,
    type ExtendedMultiAccountConfig,
} from '../src/account-manager.js';
import { FileVaultStore } from '../src/vault/file-vault.js';

const VAULT_KEY = Buffer.alloc(32, 7).toString('base64');

function createConfig(userNumber: number): ExtendedMultiAccountConfig {
    const accountName = `user-${userNumber}@example.com`;
    return {
        accounts: [
            {
                name: accountName,
                token: `token-${userNumber}`,
                sessionUrl: 'https://api.fastmail.com/jmap/session',
            },
        ],
        defaultAccount: accountName,
    };
}

describe('concurrent client state', () => {
    const temporaryDirectories: string[] = [];
    const originalVaultKey = process.env.FASTMAIL_VAULT_KEY;

    afterEach(async () => {
        if (originalVaultKey === undefined) {
            delete process.env.FASTMAIL_VAULT_KEY;
        } else {
            process.env.FASTMAIL_VAULT_KEY = originalVaultKey;
        }

        await Promise.all(
            temporaryDirectories.splice(0).map((directory) =>
                rm(directory, { recursive: true, force: true })
            )
        );
    });

    it('preserves every update from simultaneous vault instances', async () => {
        process.env.FASTMAIL_VAULT_KEY = VAULT_KEY;
        const directory = await mkdtemp(join(tmpdir(), 'fastmail-vault-concurrency-'));
        temporaryDirectories.push(directory);
        const vaultPath = join(directory, 'vault.json');
        const userCount = 20;

        await Promise.all(
            Array.from({ length: userCount }, (_, index) => {
                const vault = new FileVaultStore(vaultPath);
                return vault.setUserConfig(`user-${index}`, createConfig(index));
            })
        );

        const vault = new FileVaultStore(vaultPath);
        await expect(vault.listUsers()).resolves.toHaveLength(userCount);

        const configs = await Promise.all(
            Array.from({ length: userCount }, (_, index) =>
                vault.getUserConfig(`user-${index}`)
            )
        );

        expect(configs.map((config) => config?.defaultAccount)).toEqual(
            Array.from({ length: userCount }, (_, index) => `user-${index}@example.com`)
        );
    });

    it('merges simultaneous updates to one user inside the vault transaction', async () => {
        process.env.FASTMAIL_VAULT_KEY = VAULT_KEY;
        const directory = await mkdtemp(join(tmpdir(), 'fastmail-vault-user-concurrency-'));
        temporaryDirectories.push(directory);
        const vaultPath = join(directory, 'vault.json');
        const accountCount = 20;

        await Promise.all(
            Array.from({ length: accountCount }, (_, index) => {
                const vault = new FileVaultStore(vaultPath);
                return vault.updateUserConfig('shared-user', (current) => {
                    const account = createConfig(index).accounts[0];
                    return {
                        accounts: [...(current?.accounts ?? []), account],
                        defaultAccount: current?.defaultAccount || account.name,
                    };
                });
            })
        );

        const vault = new FileVaultStore(vaultPath);
        const saved = await vault.getUserConfig('shared-user');
        expect(saved?.accounts).toHaveLength(accountCount);
        expect(new Set(saved?.accounts.map((account) => account.name))).toHaveProperty(
            'size',
            accountCount
        );
    });

    it('keeps a switch local until the default is explicitly changed', () => {
        const initialConfig: ExtendedMultiAccountConfig = {
            accounts: [
                {
                    name: 'personal@example.com',
                    displayName: 'Personal',
                    token: 'personal-token',
                    sessionUrl: 'https://api.fastmail.com/jmap/session',
                },
                {
                    name: 'work@example.com',
                    displayName: 'Work',
                    token: 'work-token',
                    sessionUrl: 'https://api.fastmail.com/jmap/session',
                },
            ],
            defaultAccount: 'personal@example.com',
        };
        const persistedConfigs: ExtendedMultiAccountConfig[] = [];
        const firstClient = new AccountManager({
            initialConfig,
            allowEnv: false,
            allowConfigFile: false,
            onChange: (config) => persistedConfigs.push(config),
        });
        const secondClient = new AccountManager({
            initialConfig,
            allowEnv: false,
            allowConfigFile: false,
        });

        expect(firstClient.switchAccount('Work')).toBe(true);
        expect(firstClient.getCurrentAccountName()).toBe('work@example.com');
        expect(firstClient.exportConfig().defaultAccount).toBe('personal@example.com');
        expect(secondClient.getCurrentAccountName()).toBe('personal@example.com');
        expect(persistedConfigs).toHaveLength(0);

        expect(firstClient.setDefaultAccount('Work')).toBe(true);
        expect(firstClient.exportConfig().defaultAccount).toBe('work@example.com');
        expect(persistedConfigs).toHaveLength(1);
        expect(persistedConfigs[0].defaultAccount).toBe('work@example.com');
    });
});
