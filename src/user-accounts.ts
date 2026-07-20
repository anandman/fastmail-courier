import { AccountManager, type ExtendedMultiAccountConfig } from './account-manager.js';
import type { VaultStore } from './vault/types.js';

const EMPTY_CONFIG: ExtendedMultiAccountConfig = {
    accounts: [],
    defaultAccount: '',
};

export async function createUserAccountManager(userId: string, vault: VaultStore): Promise<AccountManager> {
    const storedConfig = await vault.getUserConfig(userId);
    const initialConfig = storedConfig ?? EMPTY_CONFIG;

    return new AccountManager({
        initialConfig,
        allowEnv: false,
        allowConfigFile: false,
        onChange: (config) => {
            void vault.setUserConfig(userId, config);
        },
    });
}
