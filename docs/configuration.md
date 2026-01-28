# Configuration

Detailed configuration options for Fastmail Courier.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FASTMAIL_API_TOKEN` | Yes | JMAP API token (starts with `fmu1-`) |
| `FASTMAIL_EMAIL` | Yes* | Your Fastmail email address |
| `FASTMAIL_CALDAV_PASSWORD` | No | App password for calendar/tasks |

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

## Security Best Practices

- Never commit tokens to git
- Use `chmod 600` on config files
- Prefer environment variables in CI/CD
- Rotate app passwords periodically
