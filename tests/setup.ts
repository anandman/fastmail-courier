/**
 * Test setup - loads environment variables from .env.test
 */

import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// .env.test holds live Fastmail tokens, so it lives outside the source tree —
// the repo is inside a synced Dropbox folder and .gitignore does not stop that.
const DEFAULT_TEST_ENV_PATH = join(homedir(), '.local', 'state', 'email-courier', '.env.test');

const envPath = [process.env.COURIER_TEST_ENV_FILE, DEFAULT_TEST_ENV_PATH].find(
    (candidate): candidate is string => !!candidate && existsSync(candidate)
);

if (envPath) {
    config({ path: envPath });
} else {
    console.warn(
        `\n⚠️  No .env.test file found. Copy .env.test.example to ${DEFAULT_TEST_ENV_PATH} and configure your test accounts.\n`
    );
}

// Export test config for convenience
export const testConfig = {
    account1: process.env.TEST_ACCOUNT_1,
    token1: process.env.TEST_TOKEN_1,
    account2: process.env.TEST_ACCOUNT_2,
    token2: process.env.TEST_TOKEN_2,
    recipient: process.env.TEST_RECIPIENT,

    // CalDAV configuration
    caldavUsername: process.env.TEST_CALDAV_USERNAME,
    caldavPassword: process.env.TEST_CALDAV_PASSWORD,

    get isConfigured(): boolean {
        return !!(this.account1 && this.token1 && this.recipient);
    },

    get isMultiAccountConfigured(): boolean {
        return !!(this.isConfigured && this.account2 && this.token2);
    },

    get isCalDAVConfigured(): boolean {
        return !!(this.caldavUsername && this.caldavPassword);
    },
};
