# Configuration

Detailed configuration options for Fastmail Courier.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FASTMAIL_API_TOKEN` | Yes | JMAP API token (starts with `fmu1-`) |
| `FASTMAIL_EMAIL` | Yes* | Your Fastmail email address |
| `FASTMAIL_CALDAV_PASSWORD` | No | App password for calendar/tasks |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` for Streamable HTTP hosting |
| `MCP_HTTP_HOST` | No | Host to bind for HTTP transport (default `127.0.0.1`) |
| `MCP_HTTP_PORT` | No | Port for HTTP transport (default `3333`) |
| `MCP_HTTP_PATH` | No | Path for MCP endpoint (default `/mcp`) |
| `MCP_HTTP_ALLOWED_HOSTS` | No | Comma-separated hostnames allowed in Host header (optional) |
| `MCP_HTTP_STATEFUL` | No | `true` (default) for session tracking, `false` for stateless |
| `MCP_PUBLIC_URL` | No | Public base URL used for OAuth metadata and UI redirects |
| `MCP_AUTH_MODE` | No | `oidc`, `proxy`, or `none` (auto-detected if unset) |
| `MCP_ALLOWED_USERS` | No | Comma-separated allowlist of emails or user IDs |
| `MCP_USER_ID_CLAIM` | No | Claim to identify users (`email` default, `sub` optional) |
| `MCP_OIDC_ISSUER_URL` | No | OIDC issuer URL (required for OIDC auth) |
| `MCP_OIDC_CLIENT_ID` | No | OIDC client ID (required for UI login) |
| `MCP_OIDC_CLIENT_SECRET` | No | OIDC client secret (required for UI login or introspection) |
| `MCP_OIDC_SCOPES` | No | Scopes for UI login (default `openid email profile`) |
| `MCP_OIDC_REQUIRED_SCOPES` | No | Scopes required for MCP requests (optional) |
| `MCP_OIDC_AUDIENCE` | No | Audience to validate in access tokens (optional) |
| `MCP_OIDC_INTROSPECTION_URL` | No | Introspection endpoint for opaque access tokens (optional) |
| `MCP_OIDC_REDIRECT_URI` | No | Override OIDC redirect URI (defaults to `${MCP_PUBLIC_URL}/auth/callback`) |
| `MCP_UI_SESSION_SECRET` | No | HMAC secret for UI sessions (defaults to `FASTMAIL_VAULT_KEY`) |
| `MCP_UI_SESSION_TTL` | No | UI session TTL in seconds (default 604800) |
| `MCP_AUTH_PROXY_EMAIL_HEADER` | No | Header name for proxy-auth email (default `x-auth-email`) |
| `MCP_AUTH_PROXY_SUB_HEADER` | No | Header name for proxy-auth subject (default `x-auth-user`) |
| `FASTMAIL_VAULT_BACKEND` | No | Vault backend (`file` default) |
| `FASTMAIL_VAULT_FILE` | No | Vault file path (default `~/.config/fastmail-courier/vault.json`) |
| `FASTMAIL_VAULT_KEY` | No | 32-byte vault key (base64 or hex) for encrypted storage |

*Required if using environment variables; inferred from token discovery if using config file.

## Config File

Location: `~/.config/fastmail-courier/accounts.json`

### Single Account

```json
{
  "accounts": [
    {
      "name": "you@fastmail.com",
      "displayName": "Personal",
      "token": "fmu1-your-api-token",
      "caldav": {
        "password": "your-app-password"
      }
    }
  ],
  "defaultAccount": "you@fastmail.com"
}
```

### Multi-Account

```json
{
  "accounts": [
    {
      "name": "personal@fastmail.com",
      "displayName": "Personal",
      "token": "fmu1-personal-token",
      "caldav": {
        "password": "personal-app-password"
      }
    },
    {
      "name": "work@company.com", 
      "displayName": "Work",
      "token": "fmu1-work-token",
      "caldav": {
        "password": "work-app-password"
      }
    }
  ],
  "defaultAccount": "personal@fastmail.com"
}
```

Switch accounts at runtime using either display name or email:
```
"Switch to Work"
"Switch to work@company.com"
```

### Full Account Schema

```json
{
  "name": "email@fastmail.com",
  "displayName": "Personal",
  "token": "fmu1-...",
  "caldav": {
    "password": "app-password",
    "username": "optional-override@example.com",
    "serverUrl": "https://caldav.fastmail.com"
  }
}
```

## CalDAV Configuration

CalDAV is used for calendar events and tasks. It requires an **app password**, not an API token.

### Why App Passwords?

- JMAP uses Bearer tokens (modern, scoped)
- CalDAV uses HTTP Basic Auth (legacy protocol)
- Fastmail generates app passwords specifically for this

### CalDAV-Only Setup

If you only need calendar features:

```bash
export FASTMAIL_EMAIL="you@fastmail.com"
export FASTMAIL_CALDAV_PASSWORD="your-app-password"
```

Note: You'll still need the JMAP token for email features.

## Precedence

1. Environment variables (highest priority)
2. Config file (`accounts.json`)
3. JMAP auto-discovery

## Remote Hosting (Streamable HTTP)

To run Fastmail Courier as a remote HTTP server (while keeping local `stdio` as the default), set:

```bash
export MCP_TRANSPORT="http"
export MCP_HTTP_HOST="0.0.0.0"
export MCP_HTTP_PORT="3333"
export MCP_HTTP_PATH="/mcp"
```

For safer host validation when binding to `0.0.0.0`, set allowed hosts:

```bash
export MCP_HTTP_ALLOWED_HOSTS="mydomain.com,localhost"
```

## Authentication (Remote)

### Option A: OIDC (Recommended)

Use any OIDC provider (Auth0, Google, Okta, Azure AD, etc.). This mode supports multi-user access with an allowlist.

```bash
export MCP_AUTH_MODE="oidc"
export MCP_PUBLIC_URL="https://courier.example.com"
export MCP_OIDC_ISSUER_URL="https://your-issuer.example.com"
export MCP_OIDC_CLIENT_ID="your-client-id"
export MCP_OIDC_CLIENT_SECRET="your-client-secret"
export MCP_ALLOWED_USERS="you@example.com,wife@example.com"
```

Note: If your provider issues opaque access tokens, set `MCP_OIDC_INTROSPECTION_URL` and provide client credentials so the server can validate tokens.
`MCP_PUBLIC_URL` should be the externally reachable HTTPS URL for your server.

### Option B: Auth Proxy (Advanced)

Use an external auth proxy (Cloudflare Access, oauth2-proxy, nginx auth_request). The proxy must inject headers for the authenticated user.

```bash
export MCP_AUTH_MODE="proxy"
export MCP_AUTH_PROXY_EMAIL_HEADER="x-auth-email"
export MCP_ALLOWED_USERS="you@example.com,wife@example.com"
```

## Encrypted Vault

Remote mode stores Fastmail credentials per user in an encrypted vault.

```bash
export FASTMAIL_VAULT_KEY="base64-or-hex-32-byte-key"
export FASTMAIL_VAULT_FILE="/data/fastmail-courier/vault.json"
```

The key must be 32 bytes (base64 or 64 hex chars). Store it securely (env var or secret manager).

## Security Best Practices

- Never commit tokens to git
- Use `chmod 600` on config files
- Prefer environment variables in CI/CD
- Rotate app passwords periodically
