# Architecture

This document describes the design of Fastmail Courier for contributors and AI assistants.

## Overview

Fastmail Courier is an MCP server that bridges AI assistants (Claude, Gemini) with Fastmail's email, calendar, and task services.

```
┌─────────────────┐      MCP       ┌───────────────────┐      JMAP      ┌──────────────┐
│  AI Assistant   │◄──────────────►│  Fastmail Courier │◄──────────────►│   Fastmail   │
│ (Claude/Gemini) │                │    (MCP Server)   │◄──────────────►│   Services   │
└─────────────────┘                └───────────────────┘     CalDAV     └──────────────┘
```

## Protocols

### JMAP (Email)

[JMAP](https://jmap.io/) is Fastmail's modern email protocol (they invented it, now RFC 8620).

**Why JMAP:**
- Efficient batch operations
- Stateless, REST-like
- Rich search and filter
- First-class Fastmail support

**Used for:** All email operations (search, read, send, organize).

### CalDAV (Calendar/Tasks)

[CalDAV](https://en.wikipedia.org/wiki/CalDAV) is the standard calendar/task sync protocol (RFC 4791).

**Why CalDAV:**
- Universal calendar standard
- iCalendar format (VEVENT, VTODO)
- Works with all calendar apps

**Used for:** Calendar events (VEVENT) and tasks (VTODO).

### Why Two Protocols?

- Fastmail's JMAP doesn't include calendar/contacts (yet)
- CalDAV is the de facto standard for calendar sync
- No unified Fastmail API exists for all services

## Authentication Model

```
┌───────────────────────────────────────────────────────────────┐
│                    Fastmail Courier                           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  JMAP Client                       CalDAV Client              │
│  ───────────                       ─────────────              │
│  Bearer Token (fmu1-...)           HTTP Basic Auth            │
│  API Token from Settings           App Password from Settings │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Different credentials because:**
- JMAP uses modern OAuth-style tokens (scoped, revocable)
- CalDAV uses legacy HTTP Basic Auth (protocol requirement)

## Code Structure

```
src/
├── index.ts              # MCP server entry point
├── account-manager.ts    # Multi-account credential management
├── caldav/
│   ├── client.ts         # CalDAV operations (tsdav library)
│   └── types.ts          # Calendar/Task/Event types
├── tools/
│   ├── index.ts          # Tool registry
│   ├── accounts.ts       # Account management tools
│   ├── mailboxes.ts      # Mailbox listing
│   ├── search.ts         # Email search
│   ├── read.ts           # Email reading
│   ├── send.ts           # Email sending
│   ├── organize.ts       # Email organization
│   └── calendar.ts       # Calendar/Task/Event tools
└── (jmap-courier)        # Imported JMAP client library
```

## Extension Points

### Adding New Tools

1. Create handler in `src/tools/your-tool.ts`
2. Define Zod schema for parameters
3. Register in `src/tools/index.ts`
4. Document in `docs/tools.md`

### Adding New Protocols

Pattern for new DAV services:

```typescript
// src/carddav/client.ts
export class FastmailCardDAVClient {
  // Similar pattern to CalDAV client
}
```

---

## Future Roadmap

### CardDAV (Contacts)

Contacts management via CardDAV (similar to CalDAV integration):
- List address books
- Search/Create/Update/Delete contacts
- vCard format (VCF)

**Why CardDAV:** Standard protocol, Fastmail supports it.

### Remote Hosting

Currently, Fastmail Courier runs locally. For cloud deployment:

#### Transport Options

| Current | Remote |
|---------|--------|
| stdio transport | Streamable HTTP transport |
| Local process | Cloudflare Workers / Vercel / etc. |

MCP SDK supports both.

#### Authentication Considerations

**Challenge:** Credentials currently live in local env vars / config file.

**Options:**
1. **Encrypted credential storage** - One-time setup, credentials stored encrypted per-user
2. **OAuth 2.0** - If Fastmail expands OAuth support (ideal long-term)
3. **Session-based credentials** - User provides token per session (not ideal for frequent use)

**Recommended:** Encrypted credential storage with user-provided encryption key or linked account. This avoids re-entering credentials each session while keeping secrets secure.

#### Security Requirements

- HTTPS required
- No credential logging
- Rate limiting
- Audit logging (optional)

### JMAP Calendar/Contacts

If Fastmail adds JMAP support for calendar/contacts:
- Could unify authentication
- Simplified architecture
- Better performance

Monitor [JMAP Calendar spec](https://www.ietf.org/archive/id/draft-ietf-jmap-calendars-10.html).

---

## Design Decisions

### Why MCP?

Model Context Protocol provides:
- Standard tool interface for AI assistants
- Works with Claude, Gemini, others
- Extensible and secure

### Why TypeScript?

- MCP SDK is TypeScript-native
- Type safety for complex types (Email, Event)
- Good async/await support

### Why tsdav for CalDAV?

- Well-maintained TypeScript library
- Handles iCalendar parsing
- Works with Fastmail's CalDAV server

### Why Not a Single Client?

JMAP and CalDAV are fundamentally different:
- Different auth mechanisms
- Different data formats
- Different server URLs

Keeping them separate is cleaner.
