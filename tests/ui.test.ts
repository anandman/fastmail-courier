import { describe, expect, it } from 'vitest';

import { renderLoginPage, renderNoVaultPage, renderUiPage } from '../src/ui.js';

describe('setup UI', () => {
    it('renders a styled OIDC login page', () => {
        const html = renderLoginPage('oidc');

        expect(html).toContain('Fastmail Courier');
        expect(html).toContain('Continue securely');
        expect(html).toContain('href="/auth/login"');
        expect(html).toContain('Content-Security-Policy');
    });

    it('renders credential inputs as password fields without existing secrets', () => {
        const html = renderUiPage(
            { userId: 'google-oauth2|123', email: 'person@example.com' },
            [{ name: 'mail@example.com', displayName: 'Personal', caldav: { password: 'do-not-render' } }],
            'mail@example.com'
        );

        expect(html).toContain('type="password"');
        expect(html).toContain('person@example.com');
        expect(html).not.toContain('google-oauth2|123');
        expect(html).not.toContain('do-not-render');
        expect(html).toContain('Mail + calendar');
        expect(html).toContain('Default');
    });

    it('escapes account and identity values before rendering', () => {
        const html = renderUiPage(
            { userId: 'subject', email: '<script>alert("email")</script>' },
            [{ name: 'mail@example.com', displayName: '<img src=x onerror=alert(1)>' }],
            null
        );

        expect(html).not.toContain('<script>alert');
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('renders actionable configuration states', () => {
        expect(renderLoginPage('proxy')).toContain('Authentication required');
        expect(renderLoginPage('none')).toContain('Setup unavailable');
        expect(renderNoVaultPage()).toContain('Encrypted storage unavailable');
        expect(renderNoVaultPage()).toContain('FASTMAIL_VAULT_KEY');
    });
});
