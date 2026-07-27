/**
 * The allowlist used to fail open: every check is guarded by
 * `allowedUsers && ...`, so an unset MCP_ALLOWED_USERS skipped them all and
 * admitted anyone the upstream provider authenticated. A config file that
 * silently failed to load would have opened the server with nothing in the
 * logs. These assert it now fails closed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertAccessIsRestricted } from '../src/index.js';
import { parseAllowedUsers } from '../src/auth/oidc.js';

const OPT_OUT = 'MCP_ALLOW_ANY_AUTHENTICATED_USER';
let original: string | undefined;

beforeEach(() => {
    original = process.env[OPT_OUT];
    delete process.env[OPT_OUT];
});

afterEach(() => {
    if (original === undefined) delete process.env[OPT_OUT];
    else process.env[OPT_OUT] = original;
});

describe('assertAccessIsRestricted', () => {
    it.each(['oidc', 'proxy'] as const)('refuses to boot in %s mode with no allowlist', (mode) => {
        expect(() => assertAccessIsRestricted(mode, undefined)).toThrow(/MCP_ALLOWED_USERS is required/);
    });

    it('refuses to boot when the allowlist parses to empty', () => {
        // e.g. MCP_ALLOWED_USERS=" , ,"
        expect(() => assertAccessIsRestricted('oidc', parseAllowedUsers(' , ,'))).toThrow(
            /MCP_ALLOWED_USERS is required/
        );
        expect(() => assertAccessIsRestricted('oidc', new Set())).toThrow(/MCP_ALLOWED_USERS is required/);
    });

    it('boots with a populated allowlist', () => {
        expect(() => assertAccessIsRestricted('oidc', parseAllowedUsers('a@example.com,b@example.com'))).not.toThrow();
    });

    it.each(['true', '1'])('allows an explicit opt-in (%s)', (value) => {
        process.env[OPT_OUT] = value;
        expect(() => assertAccessIsRestricted('oidc', undefined)).not.toThrow();
    });

    it('does not treat an arbitrary value as opt-in', () => {
        process.env[OPT_OUT] = 'no';
        expect(() => assertAccessIsRestricted('oidc', undefined)).toThrow(/MCP_ALLOWED_USERS is required/);
    });
});
