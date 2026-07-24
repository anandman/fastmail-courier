import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ExtendedMultiAccountConfig } from '../account-manager.js';
import { decryptJson, encryptJson, parseVaultKey, type EncryptedPayload } from './crypto.js';
import type { VaultStore } from './types.js';

interface VaultFileData {
    version: number;
    users: Record<string, EncryptedPayload>;
}

const DEFAULT_VAULT_PATH = join(homedir(), '.config', 'fastmail-courier', 'vault.json');
const mutationQueues = new Map<string, Promise<void>>();

async function enqueueMutation<T>(filePath: string, mutation: () => Promise<T>): Promise<T> {
    const previous = mutationQueues.get(filePath) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(mutation);
    const queueTail = result.then(
        () => undefined,
        () => undefined
    );

    mutationQueues.set(filePath, queueTail);

    try {
        return await result;
    } finally {
        if (mutationQueues.get(filePath) === queueTail) {
            mutationQueues.delete(filePath);
        }
    }
}

function loadVaultKey(): Buffer {
    const keyValue = process.env.FASTMAIL_VAULT_KEY;
    if (!keyValue) {
        throw new Error('FASTMAIL_VAULT_KEY is required for encrypted vault storage');
    }
    const key = parseVaultKey(keyValue);
    if (key.length !== 32) {
        throw new Error('FASTMAIL_VAULT_KEY must be 32 bytes (base64 or hex)');
    }
    return key;
}

export class FileVaultStore implements VaultStore {
    private filePath: string;
    private key: Buffer;

    constructor(filePath?: string) {
        this.filePath = resolve(filePath || process.env.FASTMAIL_VAULT_FILE || DEFAULT_VAULT_PATH);
        this.key = loadVaultKey();
    }

    async getUserConfig(userId: string): Promise<ExtendedMultiAccountConfig | null> {
        const data = await this.readData();
        const payload = data.users[userId];
        if (!payload) return null;
        return decryptJson<ExtendedMultiAccountConfig>(payload, this.key);
    }

    async setUserConfig(userId: string, config: ExtendedMultiAccountConfig): Promise<void> {
        await this.updateUserConfig(userId, () => config);
    }

    async updateUserConfig(
        userId: string,
        update: (
            current: ExtendedMultiAccountConfig | null
        ) => ExtendedMultiAccountConfig | Promise<ExtendedMultiAccountConfig>
    ): Promise<ExtendedMultiAccountConfig> {
        return enqueueMutation(this.filePath, async () => {
            const data = await this.readData();
            const payload = data.users[userId];
            const current = payload
                ? decryptJson<ExtendedMultiAccountConfig>(payload, this.key)
                : null;
            const next = await update(current);
            data.users[userId] = encryptJson(next, this.key);
            await this.writeData(data);
            return next;
        });
    }

    async listUsers(): Promise<string[]> {
        const data = await this.readData();
        return Object.keys(data.users);
    }

    private async readData(): Promise<VaultFileData> {
        try {
            const raw = await readFile(this.filePath, 'utf8');
            const data = JSON.parse(raw) as VaultFileData;
            if (!data.users) {
                return { version: 1, users: {} };
            }
            return data;
        } catch (error) {
            if (isNodeError(error) && error.code !== 'ENOENT') {
                throw error;
            }
            return { version: 1, users: {} };
        }
    }

    private async writeData(data: VaultFileData): Promise<void> {
        await mkdir(dirname(this.filePath), { recursive: true });
        const tmpPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;

        try {
            await writeFile(tmpPath, JSON.stringify(data, null, 2), {
                encoding: 'utf8',
                mode: 0o600,
            });
            await rename(tmpPath, this.filePath);
            try {
                await chmod(this.filePath, 0o600);
            } catch {
                // Ignore chmod errors on platforms that don't support it
            }
        } catch (error) {
            await unlink(tmpPath).catch(() => undefined);
            throw error;
        }
    }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}
