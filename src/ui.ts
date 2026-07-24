type AuthMode = 'oidc' | 'proxy' | 'none';

export interface UiUser {
    userId: string;
    email?: string;
}

export interface UiAccount {
    name: string;
    displayName?: string;
    caldav?: {
        password: string;
    };
}

const styles = `
  :root {
    color-scheme: light;
    --ink: #172033;
    --muted: #667085;
    --line: #e5e9f0;
    --panel: rgba(255, 255, 255, 0.94);
    --canvas: #f4f7fb;
    --brand: #3454d1;
    --brand-dark: #243da8;
    --brand-soft: #e9edff;
    --success: #087f5b;
    --success-soft: #e6f7f0;
    --shadow: 0 20px 55px rgba(35, 52, 87, 0.11);
    font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    min-height: 100vh;
    color: var(--ink);
    background:
      radial-gradient(circle at 12% 5%, rgba(52, 84, 209, 0.13), transparent 28rem),
      radial-gradient(circle at 92% 12%, rgba(99, 182, 255, 0.16), transparent 25rem),
      var(--canvas);
  }

  button, input { font: inherit; }

  a { color: inherit; }

  .shell {
    width: min(1120px, calc(100% - 32px));
    margin: 0 auto;
    padding: 28px 0 56px;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 28px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
    color: white;
    border-radius: 14px;
    background: linear-gradient(145deg, #4968e8, #263da9);
    box-shadow: 0 9px 24px rgba(52, 84, 209, 0.27);
  }

  .brand-mark svg { width: 24px; height: 24px; }

  .brand-copy { min-width: 0; }

  .brand-name {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 750;
    letter-spacing: -0.01em;
  }

  .brand-tagline {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 8px 12px 8px 8px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.78);
  }

  .identity-dot {
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    color: var(--success);
    border-radius: 50%;
    background: var(--success-soft);
  }

  .identity-dot svg { width: 15px; height: 15px; }

  .identity-copy {
    min-width: 0;
    line-height: 1.15;
  }

  .identity-label {
    display: block;
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .identity-value {
    display: block;
    max-width: 260px;
    margin-top: 2px;
    overflow: hidden;
    font-size: 0.82rem;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hero {
    position: relative;
    overflow: hidden;
    padding: 38px 40px;
    border-radius: 24px;
    color: white;
    background: linear-gradient(125deg, #172960 0%, #304ec6 62%, #5686ef 100%);
    box-shadow: var(--shadow);
  }

  .hero::after {
    content: "";
    position: absolute;
    width: 250px;
    height: 250px;
    right: -55px;
    bottom: -130px;
    border: 48px solid rgba(255, 255, 255, 0.09);
    border-radius: 50%;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.73rem;
    font-weight: 750;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .hero h1 {
    position: relative;
    z-index: 1;
    max-width: 690px;
    margin: 0;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 1.04;
    letter-spacing: -0.04em;
  }

  .hero p:last-child {
    position: relative;
    z-index: 1;
    max-width: 640px;
    margin: 16px 0 0;
    color: rgba(255, 255, 255, 0.79);
    font-size: 1rem;
    line-height: 1.65;
  }

  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
    gap: 24px;
    margin-top: 24px;
    align-items: start;
  }

  .card {
    padding: 26px;
    border: 1px solid rgba(218, 224, 235, 0.9);
    border-radius: 20px;
    background: var(--panel);
    box-shadow: 0 12px 35px rgba(45, 61, 94, 0.07);
    backdrop-filter: blur(14px);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 20px;
  }

  .card h2 {
    margin: 0;
    font-size: 1.16rem;
    letter-spacing: -0.02em;
  }

  .card-intro {
    margin: 5px 0 0;
    color: var(--muted);
    font-size: 0.86rem;
    line-height: 1.5;
  }

  .count {
    min-width: 32px;
    padding: 5px 9px;
    color: var(--brand);
    border-radius: 999px;
    background: var(--brand-soft);
    font-size: 0.78rem;
    font-weight: 750;
    text-align: center;
  }

  .account-list {
    display: grid;
    gap: 12px;
  }

  .account {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 15px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: white;
  }

  .account-main { min-width: 0; }

  .account-name {
    display: block;
    overflow: hidden;
    font-size: 0.92rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .account-email {
    display: block;
    margin-top: 3px;
    overflow: hidden;
    color: var(--muted);
    font-size: 0.78rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badges {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px;
  }

  .badge {
    padding: 5px 8px;
    color: #4a5568;
    border-radius: 999px;
    background: #f0f3f8;
    font-size: 0.68rem;
    font-weight: 750;
    white-space: nowrap;
  }

  .badge.default {
    color: var(--success);
    background: var(--success-soft);
  }

  .empty {
    padding: 30px 18px;
    border: 1px dashed #ccd4e1;
    border-radius: 16px;
    text-align: center;
    background: rgba(247, 249, 252, 0.7);
  }

  .empty-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    margin: 0 auto 12px;
    color: var(--brand);
    border-radius: 13px;
    background: var(--brand-soft);
  }

  .empty-icon svg { width: 21px; height: 21px; }

  .empty strong { display: block; font-size: 0.9rem; }

  .empty p {
    margin: 6px auto 0;
    max-width: 300px;
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 17px;
  }

  .field { min-width: 0; }
  .field.full { grid-column: 1 / -1; }

  .field label {
    display: block;
    margin-bottom: 7px;
    font-size: 0.78rem;
    font-weight: 720;
  }

  .field input[type="email"],
  .field input[type="text"],
  .field input[type="password"] {
    width: 100%;
    height: 43px;
    padding: 0 12px;
    color: var(--ink);
    border: 1px solid #cfd6e2;
    border-radius: 10px;
    outline: none;
    background: white;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  .field input:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px rgba(52, 84, 209, 0.12);
  }

  .field input::placeholder { color: #a0a9b8; }

  .hint {
    display: block;
    margin-top: 6px;
    color: var(--muted);
    font-size: 0.7rem;
    line-height: 1.4;
  }

  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    grid-column: 1 / -1;
    padding: 12px 13px;
    border-radius: 11px;
    background: #f7f8fb;
  }

  .checkbox-row input {
    width: 17px;
    height: 17px;
    margin: 1px 0 0;
    accent-color: var(--brand);
  }

  .checkbox-copy label {
    display: block;
    font-size: 0.79rem;
    font-weight: 720;
  }

  .checkbox-copy span {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: 0.7rem;
    line-height: 1.4;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 22px;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 750;
    text-decoration: none;
  }

  .button svg { width: 15px; height: 15px; }

  .button.primary {
    color: white;
    background: var(--brand);
    box-shadow: 0 7px 16px rgba(52, 84, 209, 0.22);
  }

  .button.primary:hover { background: var(--brand-dark); }

  .button.secondary {
    color: #4b5565;
    border: 1px solid var(--line);
    background: white;
  }

  .button.secondary:hover { background: #f7f8fb; }

  .footer-note {
    margin: 22px 0 0;
    color: #7b8493;
    font-size: 0.7rem;
    line-height: 1.5;
    text-align: center;
  }

  .center-card {
    width: min(520px, calc(100% - 32px));
    margin: 10vh auto 0;
    padding: 34px;
    border: 1px solid var(--line);
    border-radius: 22px;
    background: var(--panel);
    box-shadow: var(--shadow);
    text-align: center;
  }

  .center-card .brand-mark { margin: 0 auto 20px; }

  .center-card h1 {
    margin: 0;
    font-size: 1.7rem;
    letter-spacing: -0.035em;
  }

  .center-card p {
    margin: 12px auto 22px;
    color: var(--muted);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .notice {
    padding: 12px 14px;
    color: #7a4d00;
    border: 1px solid #f1d49c;
    border-radius: 11px;
    background: #fff8e8;
    font-size: 0.8rem;
    line-height: 1.5;
    text-align: left;
  }

  @media (max-width: 780px) {
    .shell { width: min(100% - 22px, 620px); padding-top: 18px; }
    .topbar { align-items: flex-start; }
    .identity-label { display: none; }
    .identity-value { max-width: 150px; margin: 0; }
    .hero { padding: 30px 24px; border-radius: 20px; }
    .content-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 520px) {
    .brand-tagline { display: none; }
    .identity-copy { display: none; }
    .identity { padding-right: 8px; }
    .hero { padding: 26px 20px; }
    .card { padding: 21px 18px; }
    .form-grid { grid-template-columns: 1fr; }
    .field.full, .checkbox-row { grid-column: auto; }
    .actions { align-items: stretch; flex-direction: column; }
    .actions .button, .actions form, .actions form button { width: 100%; }
  }
`;

const envelopeIcon = `
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4.5 6.75h15v10.5h-15V6.75Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="m5.25 7.5 6.75 5.25 6.75-5.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const checkIcon = `
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m6.5 12.25 3.25 3.25 7.75-8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return entities[character] ?? character;
    });
}

function documentShell(title: string, body: string): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="theme-color" content="#263da9" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" />
    <title>${escapeHtml(title)}</title>
    <style>${styles}</style>
  </head>
  <body>${body}</body>
</html>`;
}

function brandMark(): string {
    return `<span class="brand-mark">${envelopeIcon}</span>`;
}

function centerPage(title: string, message: string, action = ''): string {
    return documentShell(
        title,
        `<main class="center-card">
          ${brandMark()}
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
          ${action}
        </main>`
    );
}

export function renderLoginPage(authMode: AuthMode): string {
    if (authMode === 'proxy') {
        return documentShell(
            'Fastmail Courier',
            `<main class="center-card">
              ${brandMark()}
              <h1>Authentication required</h1>
              <p>The trusted proxy did not provide the identity headers Courier needs.</p>
              <div class="notice">Check the proxy authentication configuration, then reload this page.</div>
            </main>`
        );
    }

    if (authMode === 'oidc') {
        return centerPage(
            'Fastmail Courier',
            'Connect and manage the Fastmail accounts available to your private MCP service.',
            `<a class="button primary" href="/auth/login">
              ${checkIcon}
              Continue securely
            </a>`
        );
    }

    return documentShell(
        'Fastmail Courier',
        `<main class="center-card">
          ${brandMark()}
          <h1>Setup unavailable</h1>
          <p>Courier is running without an authentication provider.</p>
          <div class="notice">Configure OIDC or trusted-proxy authentication before using the setup UI.</div>
        </main>`
    );
}

export function renderNoVaultPage(): string {
    return documentShell(
        'Fastmail Courier',
        `<main class="center-card">
          ${brandMark()}
          <h1>Encrypted storage unavailable</h1>
          <p>Courier cannot save account credentials until its encrypted vault is configured.</p>
          <div class="notice">Set <strong>FASTMAIL_VAULT_KEY</strong> and restart the service.</div>
        </main>`
    );
}

export function renderUiPage(user: UiUser, accounts: UiAccount[], defaultAccount: string | null): string {
    const accountRows = accounts
        .map((account) => {
            const name = escapeHtml(account.displayName?.trim() || account.name);
            const email = escapeHtml(account.name);
            const isDefault = account.name === defaultAccount;
            const caldavEnabled = Boolean(account.caldav?.password);
            return `<div class="account">
              <div class="account-main">
                <span class="account-name">${name}</span>
                ${name !== email ? `<span class="account-email">${email}</span>` : ''}
              </div>
              <div class="badges">
                ${isDefault ? '<span class="badge default">Default</span>' : ''}
                <span class="badge">${caldavEnabled ? 'Mail + calendar' : 'Mail only'}</span>
              </div>
            </div>`;
        })
        .join('');

    const accountsContent =
        accountRows ||
        `<div class="empty">
          <span class="empty-icon">${envelopeIcon}</span>
          <strong>No accounts connected</strong>
          <p>Add a Fastmail account to make mail, contacts, calendars, and tasks available to your MCP clients.</p>
        </div>`;

    const identity = escapeHtml(user.email?.trim() || 'Authenticated user');

    return documentShell(
        'Fastmail Courier Setup',
        `<main class="shell">
          <header class="topbar">
            <div class="brand">
              ${brandMark()}
              <div class="brand-copy">
                <p class="brand-name">Fastmail Courier</p>
                <p class="brand-tagline">Private MCP account gateway</p>
              </div>
            </div>
            <div class="identity" title="Authenticated with OIDC">
              <span class="identity-dot">${checkIcon}</span>
              <span class="identity-copy">
                <span class="identity-label">Secure session</span>
                <span class="identity-value">${identity}</span>
              </span>
            </div>
          </header>

          <section class="hero">
            <p class="eyebrow">Account setup</p>
            <h1>Your Fastmail, delivered securely.</h1>
            <p>Connect accounts once. Courier encrypts their credentials at rest and keeps each authenticated MCP user isolated.</p>
          </section>

          <div class="content-grid">
            <section class="card" aria-labelledby="accounts-heading">
              <div class="card-header">
                <div>
                  <h2 id="accounts-heading">Connected accounts</h2>
                  <p class="card-intro">Accounts available to your signed-in identity.</p>
                </div>
                <span class="count" aria-label="${accounts.length} connected accounts">${accounts.length}</span>
              </div>
              <div class="account-list">${accountsContent}</div>
            </section>

            <section class="card" aria-labelledby="account-form-heading">
              <div class="card-header">
                <div>
                  <h2 id="account-form-heading">Add or update an account</h2>
                  <p class="card-intro">Use the same email address to update an existing connection.</p>
                </div>
              </div>

              <form method="post" action="/ui/account">
                <div class="form-grid">
                  <div class="field">
                    <label for="email">Fastmail email</label>
                    <input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
                  </div>

                  <div class="field">
                    <label for="displayName">Display name</label>
                    <input id="displayName" name="displayName" type="text" autocomplete="off" placeholder="Personal" />
                  </div>

                  <div class="field full">
                    <label for="token">JMAP API token</label>
                    <input id="token" name="token" type="password" autocomplete="off" spellcheck="false" />
                    <span class="hint">Required for a new account. Leave blank to keep the current token when updating.</span>
                  </div>

                  <div class="field">
                    <label for="caldavPassword">CalDAV app password</label>
                    <input id="caldavPassword" name="caldavPassword" type="password" autocomplete="off" spellcheck="false" />
                    <span class="hint">Optional. Enables calendars and tasks.</span>
                  </div>

                  <div class="field">
                    <label for="caldavUsername">CalDAV username</label>
                    <input id="caldavUsername" name="caldavUsername" type="text" autocomplete="username" placeholder="Defaults to email" />
                  </div>

                  <div class="checkbox-row">
                    <input id="setDefault" name="setDefault" type="checkbox" />
                    <div class="checkbox-copy">
                      <label for="setDefault">Use as the default account</label>
                      <span>New MCP requests will use this account unless a client selects another one.</span>
                    </div>
                  </div>
                </div>

                <div class="actions">
                  <button class="button primary" type="submit">
                    ${checkIcon}
                    Save account
                  </button>
                  <span class="hint">Secrets are encrypted before they are written to disk.</span>
                </div>
              </form>
            </section>
          </div>

          <div class="actions">
            <p class="footer-note">Courier only exposes accounts to the authenticated identity that configured them.</p>
            <form method="post" action="/auth/logout">
              <button class="button secondary" type="submit">Sign out</button>
            </form>
          </div>
        </main>`
    );
}
