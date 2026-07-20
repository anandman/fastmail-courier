import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ExtendedMultiAccountConfig } from '../account-manager.js';
import { decryptJson, encryptJson, parseVaultKey, type EncryptedPayload } from './crypto.js';
import type { VaultStore } from './types.js';

interface VaultFileData {
    version: number;
    users: Record<string, EncryptedPayload>;
}

const DEFAULT_VAULT_PATH = join(homedir(), '.config', 'fastmail-courier', 'vault.json');

function ensureDir(path: string) {
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
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
        this.filePath = filePath || process.env.FASTMAIL_VAULT_FILE || DEFAULT_VAULT_PATH;
        this.key = loadVaultKey();
    }

    async getUserConfig(userId: string): Promise<ExtendedMultiAccountConfig | null> {
        const data = this.readData();
        const payload = data.users[userId];
        if (!payload) return null;
        return decryptJson<ExtendedMultiAccountConfig>(payload, this.key);
    }

    async setUserConfig(userId: string, config: ExtendedMultiAccountConfig): Promise<void> {
        const data = this.readData();
        data.users[userId] = encryptJson(config, this.key);
        this.writeData(data);
    }

    async listUsers(): Promise<string[]> {
        const data = this.readData();
        return Object.keys(data.users);
    }

    private readData(): VaultFileData {
        if (!existsSync(this.filePath)) {
            return { version: 1, users: {} };
        }
        const raw = readFileSync(this.filePath, 'utf8');
        try {
            const data = JSON.parse(raw) as VaultFileData;
            if (!data.users) {
                return { version: 1, users: {} };
            }
            return data;
        } catch {
            return { version: 1, users: {} };
        }
    }

    private writeData(data: VaultFileData): void {
        ensureDir(this.filePath);
        const tmpPath = `${this.filePath}.tmp`;
        writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf8' });
        renameSync(tmpPath, this.filePath);
        try {
            chmodSync(this.filePath, 0o600);
        } catch {
            // Ignore chmod errors on platforms that don't support it
        }
    }
}
