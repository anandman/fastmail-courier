import { describe, expect, it } from 'vitest';

import { AccountManager, type ExtendedMultiAccountConfig } from '../src/account-manager.js';
import {
    ALWAYS_AVAILABLE_TOOLS,
    TOOL_GROUPS,
    TOOL_GROUP_IDS,
    groupForTool,
    isToolVisible,
    parseDisabledGroups,
} from '../src/tools/groups.js';
import { tools } from '../src/tools/index.js';
import { renderUiPage } from '../src/ui.js';

function managerWith(config: Partial<ExtendedMultiAccountConfig>): AccountManager {
    return new AccountManager({
        initialConfig: { accounts: [], defaultAccount: '', ...config },
        allowEnv: false,
        allowConfigFile: false,
    });
}

describe('tool group definitions', () => {
    it('assigns every registered tool to exactly one group or the always-available set', () => {
        // A tool missing from both would be silently unhideable, and a tool in
        // two groups would reappear when only one of them is turned off.
        const grouped = TOOL_GROUPS.flatMap((group) => group.tools);
        const always = new Set(ALWAYS_AVAILABLE_TOOLS);

        expect(new Set(grouped).size).toBe(grouped.length);

        for (const tool of tools) {
            const inGroup = grouped.includes(tool.name);
            const isAlways = always.has(tool.name);
            expect(
                inGroup !== isAlways,
                `${tool.name} must be in exactly one group or always available`
            ).toBe(true);
        }
    });

    it('references no tool that does not exist', () => {
        const registered = new Set(tools.map((tool) => tool.name));
        for (const name of [...TOOL_GROUPS.flatMap((g) => g.tools), ...ALWAYS_AVAILABLE_TOOLS]) {
            expect(registered.has(name), `${name} is listed in a group but not registered`).toBe(true);
        }
    });
});

describe('visibility', () => {
    it('shows everything when nothing is disabled', () => {
        for (const tool of tools) {
            expect(isToolVisible(tool.name, [])).toBe(true);
        }
    });

    it('hides only the disabled group', () => {
        expect(isToolVisible('list_tasks', ['tasks'])).toBe(false);
        expect(isToolVisible('create_task', ['tasks'])).toBe(false);
        expect(isToolVisible('search_emails', ['tasks'])).toBe(true);
        expect(isToolVisible('list_events', ['tasks'])).toBe(true);
    });

    it('keeps account tools available even when every group is off', () => {
        // Without these a client cannot select an account, which is the whole
        // reason Courier exists.
        for (const name of ALWAYS_AVAILABLE_TOOLS) {
            expect(isToolVisible(name, [...TOOL_GROUP_IDS])).toBe(true);
            expect(groupForTool(name)).toBeNull();
        }
    });
});

describe('stored preferences', () => {
    it('treats an absent preference as everything enabled', () => {
        expect(managerWith({}).getDisabledToolGroups()).toEqual([]);
    });

    it('round-trips through exportConfig', () => {
        const manager = managerWith({});
        manager.setDisabledToolGroups(['tasks']);

        const exported = manager.exportConfig();
        expect(exported.disabledToolGroups).toEqual(['tasks']);
        expect(managerWith(exported).getDisabledToolGroups()).toEqual(['tasks']);
    });

    it('omits the key entirely when nothing is disabled', () => {
        // Keeps an untouched config byte-identical to what earlier versions wrote.
        expect('disabledToolGroups' in managerWith({}).exportConfig()).toBe(false);
    });

    it('drops unknown group ids instead of failing to load', () => {
        // A group removed in a later version must not make a saved config unloadable.
        expect(parseDisabledGroups(['tasks', 'nonsense'])).toEqual(['tasks']);
        expect(parseDisabledGroups('tasks')).toEqual([]);
        expect(parseDisabledGroups(undefined)).toEqual([]);
    });

    it('de-duplicates repeated ids', () => {
        expect(parseDisabledGroups(['tasks', 'tasks'])).toEqual(['tasks']);
    });
});

describe('settings UI', () => {
    const user = { userId: 'someone@example.com', email: 'someone@example.com' };

    it('checks the groups that are enabled and unchecks the disabled ones', () => {
        const html = renderUiPage(user, [], null, null, ['tasks']);

        expect(html).toContain('value="tasks" type="checkbox" ');
        expect(html).not.toMatch(/value="tasks" type="checkbox" checked/);
        expect(html).toMatch(/value="email" type="checkbox" checked/);
    });

    it('reports how many tools are currently offered', () => {
        const total = ALWAYS_AVAILABLE_TOOLS.length + TOOL_GROUPS.flatMap((g) => g.tools).length;
        const taskCount = TOOL_GROUPS.find((g) => g.id === 'tasks')!.tools.length;

        expect(renderUiPage(user, [], null, null, [])).toContain(`${total} of ${total} tools`);
        expect(renderUiPage(user, [], null, null, ['tasks'])).toContain(
            `${total - taskCount} of ${total} tools`
        );
    });
});
