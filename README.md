# Fastmail Courier

An MCP (Model Context Protocol) server that enables Claude CLI, Gemini CLI, and other MCP-compatible AI assistants to interact with Fastmail email via the JMAP protocol.

## Features

- **Multi-account support** — Switch between multiple Fastmail accounts
- **Search emails** — Filter by mailbox, date, sender, subject, and more
- **Read emails** — Get full email content including body and attachments
- **Send & forward** — Compose new emails or forward existing ones
- **Bulk operations** — Move, delete, mark, and tag multiple emails at once

## Installation

```bash
# Clone both repositories (jmap-courier is a dependency)
git clone <your-repo-url>/jmap-courier
git clone <your-repo-url>/fastmail-courier

# Build jmap-courier first
cd jmap-courier
npm install
npm run build

# Then build fastmail-courier
cd ../fastmail-courier
npm install
npm run build
```

> **Note:** This project depends on `jmap-courier`, a provider-agnostic JMAP client library. The dependency is configured as a local file reference (`file:../jmap-courier`).

## Configuration

### Single Account (Environment Variable)

```bash
export FASTMAIL_API_TOKEN="fmu1-your-api-token-here"
```

Get your API token from: **Fastmail Settings → Privacy & Security → Integrations → API tokens**

### Multiple Accounts (Config File)

Create `~/.config/fastmail-courier/accounts.json`:

```json
{
  "accounts": [
    { "name": "work@example.com", "token": "fmu1-your-work-token" },
    { "name": "personal@example.com", "token": "fmu1-your-personal-token" }
  ],
  "defaultAccount": "work@example.com"
}
```

**Important:** Secure your config file:
```bash
chmod 600 ~/.config/fastmail-courier/accounts.json
```

## Usage with AI CLIs

### Claude Desktop App

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

### Claude CLI

Add to your Claude CLI config (`~/.config/claude/mcp.json` or similar):

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

## Available Tools

| Tool | Description |
|------|-------------|
| `list_accounts` | List configured accounts |
| `switch_account` | Switch active account |
| `get_current_account` | Show current account |
| `list_mailboxes` | List all folders |
| `search_emails` | Search with filters |
| `get_email` | Read full email content |
| `send_email` | Send new email |
| `forward_email` | Forward an email |
| `move_emails` | Move emails to folder |
| `delete_emails` | Move emails to trash |
| `mark_emails` | Mark read/unread/flagged |
| `tag_emails` | Add/remove keywords |

## Example Prompts

```
"List my mailboxes"
"Search for unread emails from the last week"
"Show me the email with ID abc123"
"Forward that email to colleague@example.com with a note 'Please review'"
"Mark the last 5 emails as read"
"Add the tag 'important' to emails about the project"
```

## Security

This MCP server uses **stdio transport**, which means:

- ✅ No network exposure — communicates only via stdin/stdout
- ✅ Local process only — only the CLI that spawned it can connect
- ✅ File permissions protect tokens — your config file uses your user permissions

The server will warn you if your config file has overly permissive permissions.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Build with watch mode
npm run dev

# Run tests (requires .env.test configuration)
npm run test
```

## Testing

Copy the example test config and fill in your credentials:

```bash
cp .env.test.example .env.test
# Edit .env.test with your test account details
npm run test
```

## Credits

Copyright © 2026 Anand Mandapati

Created with AI using [Antigravity](https://github.com/google-deepmind/antigravity) and Claude Opus.

## License

MIT - see [LICENSE](LICENSE) for details.
