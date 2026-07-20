import type { VaultStore } from './types.js';
import { FileVaultStore } from './file-vault.js';

export function createVaultStore(): VaultStore {
    const backend = (process.env.FASTMAIL_VAULT_BACKEND ?? 'file').toLowerCase();
    if (backend === 'file') {
        return new FileVaultStore();
    }

    throw new Error(`Unsupported vault backend: ${backend}`);
}
