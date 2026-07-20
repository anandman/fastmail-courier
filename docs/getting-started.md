# Getting Started

This guide walks through setting up Fastmail Courier for use with AI assistants.

## Prerequisites

- Node.js 18+
- A Fastmail account
- An AI CLI that supports MCP (Claude Desktop, Claude CLI, Gemini CLI)

## Installation

```bash
git clone https://github.com/yourusername/fastmail-courier.git
cd fastmail-courier
npm install
npm run build
```

## Authentication

### JMAP API Token (for Email)

1. Log in to [Fastmail](https://www.fastmail.com)
2. Go to **Settings → Privacy & Security → Integrations**
3. Under **API tokens**, click **New API token**
4. Name it (e.g., "Fastmail Courier") and select scopes:
   - `Email` - Read/write email
   - `Contacts` - (optional, for future CardDAV)
5. Copy the token (starts with `fmu1-`)

### CalDAV App Password (for Calendar/Tasks)

> **Note:** CalDAV uses a different auth mechanism than JMAP.

1. In Fastmail **Settings → Privacy & Security → Integrations**
2. Scroll to **App passwords** → **New App Password**
3. Name it (e.g., "Fastmail Courier CalDAV")
4. Copy the generated password

## Configuration

### Option A: Environment Variables (Simple)

```bash
export FASTMAIL_API_TOKEN="fmu1-your-token-here"
export FASTMAIL_EMAIL="you@fastmail.com"
export FASTMAIL_CALDAV_PASSWORD="your-app-password"  # Optional, for calendar
```

### Option B: Config File (Multi-Account)

Create `~/.config/fastmail-courier/accounts.json`:

```json
{
  "accounts": [
    {
      "name": "you@fastmail.com",
      "token": "fmu1-your-token-here",
      "caldav": {
        "password": "your-app-password"
      }
    }
  ],
  "defaultAccount": "you@fastmail.com"
}
```

Secure the file:
```bash
chmod 600 ~/.config/fastmail-courier/accounts.json
```

## Connect to Your AI CLI

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "Fastmail Courier": {
      "command": "node",
      "args": ["/path/to/fastmail-courier/dist/index.js"]
    }
  }
}
```

### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "Fastmail Courier": {
      "command": "node",
      "args": ["/path/to/fastmail-courier/dist/index.js"]
    }
  }
}
```

## Remote Hosting (Optional)

By default, Fastmail Courier runs as a local `stdio` MCP server. To run it remotely over Streamable HTTP:

```bash
export MCP_TRANSPORT="http"
export MCP_HTTP_HOST="0.0.0.0"
export MCP_HTTP_PORT="3333"
export MCP_HTTP_PATH="/mcp"
node dist/index.js
```

If you bind to `0.0.0.0`, consider setting `MCP_HTTP_ALLOWED_HOSTS` to restrict Host headers.

### Multi-User Remote Hosting (OIDC + Vault)

For remote access with multiple users, enable OIDC auth and the encrypted vault:

```bash
export MCP_AUTH_MODE="oidc"
export MCP_PUBLIC_URL="https://courier.example.com"
export MCP_OIDC_ISSUER_URL="https://your-issuer.example.com"
export MCP_OIDC_CLIENT_ID="your-client-id"
export MCP_OIDC_CLIENT_SECRET="your-client-secret"
export FASTMAIL_VAULT_KEY="base64-or-hex-32-byte-key"
```

Open `https://courier.example.com/ui` to configure your Fastmail credentials.

## Verify It Works

In your AI CLI, try:

```
"List my mailboxes"
"Search for unread emails from the last week"
"What tasks do I have?"
```

## Next Steps

- [Configuration Guide](configuration.md) - Multi-account, advanced options
- [Tools Reference](tools.md) - All 22 available tools
- [Examples](examples.md) - Common prompts and workflows
