# Fastmail Courier

An MCP server that connects AI assistants to your Fastmail email, calendar, and tasks.

## Quick Install

```bash
git clone https://github.com/yourusername/fastmail-courier.git
cd fastmail-courier
npm install
npm run build
```

## Quick Setup

1. **Get API token:** Fastmail → Settings → Privacy & Security → Integrations → API tokens
2. **Set environment:**
   ```bash
   export FASTMAIL_API_TOKEN="fmu1-your-token"
   export FASTMAIL_EMAIL="you@fastmail.com"
   ```
3. **Add to AI CLI** (Claude Desktop, Gemini CLI):
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

Fastmail Courier defaults to local `stdio` transport. To host it remotely over Streamable HTTP:

```bash
export MCP_TRANSPORT="http"
export MCP_HTTP_HOST="0.0.0.0"
export MCP_HTTP_PORT="3333"
export MCP_HTTP_PATH="/mcp"
node dist/index.js
```

For multi-user remote hosting, enable OIDC and the encrypted vault:

```bash
export MCP_AUTH_MODE="oidc"
export MCP_PUBLIC_URL="https://courier.example.com"
export MCP_OIDC_ISSUER_URL="https://your-issuer.example.com"
export MCP_OIDC_CLIENT_ID="your-client-id"
export MCP_OIDC_CLIENT_SECRET="your-client-secret"
export FASTMAIL_VAULT_KEY="base64-or-hex-32-byte-key"
```

Open `/ui` on your server to add Fastmail credentials per user.

See [Configuration](docs/configuration.md) for full auth and vault options.

For calendar/tasks, you'll also need an app password. See [Getting Started](docs/getting-started.md).

## Tools

| Category | Tools |
|----------|-------|
| **Accounts** | `list_accounts`, `switch_account`, `get_current_account` |
| **Email** | `list_mailboxes`, `get_mailbox_details`, `create_mailbox`, `rename_mailbox`, `delete_mailbox`, `move_mailbox`, `set_mailbox_role`, `search_emails`, `get_email`, `send_email`, `forward_email` |
| **Organize** | `move_emails`, `delete_emails`, `mark_emails`, `tag_emails` |
| **Contacts** | `list_address_books`, `search_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact` |
| **Calendar** | `list_calendars`, `list_events`, `get_event`, `create_event`, `update_event`, `delete_event` |
| **Tasks** | `list_tasks`, `get_task`, `create_task`, `update_task`, `complete_task`, `delete_task` |

## Documentation

- [Getting Started](docs/getting-started.md) - Full setup guide
- [Configuration](docs/configuration.md) - Multi-account, CalDAV options
- [Tools Reference](docs/tools.md) - All 22 tools with parameters
- [Examples](docs/examples.md) - Common prompts
- [Architecture](docs/architecture.md) - Design & future plans

## Security

- Store tokens securely (environment variables or `chmod 600` config)
- Never commit credentials to git
- Use app passwords for CalDAV (not your main password)

## License

MIT - see [LICENSE](LICENSE) for details.
