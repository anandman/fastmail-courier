import type { ExtendedMultiAccountConfig } from '../account-manager.js';

export interface VaultStore {
    getUserConfig(userId: string): Promise<ExtendedMultiAccountConfig | null>;
    setUserConfig(userId: string, config: ExtendedMultiAccountConfig): Promise<void>;
    updateUserConfig(
        userId: string,
        update: (
            current: ExtendedMultiAccountConfig | null
        ) => ExtendedMultiAccountConfig | Promise<ExtendedMultiAccountConfig>
    ): Promise<ExtendedMultiAccountConfig>;
    listUsers?(): Promise<string[]>;
}
