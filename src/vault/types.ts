import type { ExtendedMultiAccountConfig } from '../account-manager.js';

export interface VaultStore {
    getUserConfig(userId: string): Promise<ExtendedMultiAccountConfig | null>;
    setUserConfig(userId: string, config: ExtendedMultiAccountConfig): Promise<void>;
    listUsers?(): Promise<string[]>;
}
