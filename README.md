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

For calendar/tasks, you'll also need an app password. See [Getting Started](docs/getting-started.md).

## Tools

| Category | Tools |
|----------|-------|
| **Accounts** | `list_accounts`, `switch_account`, `get_current_account` |
| **Email** | `list_mailboxes`, `search_emails`, `get_email`, `send_email`, `forward_email` |
| **Organize** | `move_emails`, `delete_emails`, `mark_emails`, `tag_emails` |
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
