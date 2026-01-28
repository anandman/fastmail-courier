# Tools Reference

Complete reference for all 22 MCP tools provided by Fastmail Courier.

## Account Management

### list_accounts
List all configured Fastmail accounts.

**Parameters:** None

**Returns:** Array of accounts with current active indicator.

---

### switch_account
Switch to a different configured account.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `account` | string | Yes | Account name (email) to switch to |

---

### get_current_account
Get the currently active account.

**Parameters:** None

---

## Email - Browse

### list_mailboxes
List all mailboxes/folders (Inbox, Sent, Drafts, etc.).

**Parameters:** None

**Returns:** Array of mailboxes with id, name, role, counts.

---

### search_emails
Search emails with filters.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mailbox` | string | No | Mailbox name to search in |
| `from` | string | No | Filter by sender |
| `to` | string | No | Filter by recipient |
| `subject` | string | No | Filter by subject |
| `body` | string | No | Full-text search in body |
| `after` | string | No | Emails after date (ISO 8601) |
| `before` | string | No | Emails before date (ISO 8601) |
| `isUnread` | boolean | No | Filter by read status |
| `isFlagged` | boolean | No | Filter by flagged status |
| `limit` | number | No | Max results (default: 20) |

---

### get_email
Get full email content by ID.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `emailId` | string | Yes | Email ID to retrieve |

**Returns:** Full email with headers, body, attachments.

---

## Email - Send

### send_email
Compose and send an email.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `to` | string[] | Yes | Recipient addresses |
| `subject` | string | Yes | Email subject |
| `body` | string | Yes | Email body (text) |
| `cc` | string[] | No | CC recipients |
| `bcc` | string[] | No | BCC recipients |

---

### forward_email
Forward an email with optional comment.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `emailId` | string | Yes | Email to forward |
| `to` | string[] | Yes | Forward recipients |
| `comment` | string | No | Comment to add |

---

## Email - Organize

### move_emails
Move emails to a mailbox.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `emailIds` | string[] | Yes | Emails to move |
| `mailbox` | string | Yes | Destination mailbox |

---

### delete_emails
Delete emails (move to trash).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `emailIds` | string[] | Yes | Emails to delete |

---

### mark_emails
Mark emails as read/unread or flagged/unflagged.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `emailIds` | string[] | Yes | Emails to mark |
| `isRead` | boolean | No | Mark as read/unread |
| `isFlagged` | boolean | No | Mark as flagged/unflagged |

---

### tag_emails
Add or remove keywords/labels.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `emailIds` | string[] | Yes | Emails to tag |
| `addKeywords` | string[] | No | Keywords to add |
| `removeKeywords` | string[] | No | Keywords to remove |

---

## Calendar

### list_calendars
List all calendars.

**Parameters:** None

**Returns:** Calendars with URL, name, color, task/event support.

---

## Tasks (VTODO)

### list_tasks
List tasks with filters.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `calendarUrl` | string | No | Filter to calendar |
| `status` | string[] | No | Filter by status (`needs-action`, `in-process`, `completed`, `cancelled`) |
| `dueBefore` | string | No | Due before date |
| `dueAfter` | string | No | Due after date |
| `includeCompleted` | boolean | No | Include completed (default: false) |

---

### get_task
Get task details.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `taskUrl` | string | Yes | Task URL |

---

### create_task
Create a new task.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `summary` | string | Yes | Task title |
| `calendarUrl` | string | No | Calendar to create in |
| `description` | string | No | Details |
| `due` | string | No | Due date (ISO 8601) |
| `priority` | number | No | Priority 1-9 |
| `categories` | string[] | No | Tags |

---

### update_task
Update an existing task.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `taskUrl` | string | Yes | Task URL |
| `summary` | string | No | New title |
| `description` | string | No | New description |
| `due` | string | No | New due date |
| `status` | string | No | New status |
| `priority` | number | No | New priority |

---

### complete_task
Mark a task complete.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `taskUrl` | string | Yes | Task URL |

---

### delete_task
Delete a task.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `taskUrl` | string | Yes | Task URL |

---

## Calendar Events (VEVENT)

### list_events
List calendar events.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `calendarUrl` | string | No | Filter to calendar |
| `startAfter` | string | No | Events starting after (ISO 8601) |
| `startBefore` | string | No | Events starting before |
| `limit` | number | No | Max results |

---

### get_event
Get event details.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `eventUrl` | string | Yes | Event URL |

---

### create_event
Create a calendar event.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `summary` | string | Yes | Event title |
| `start` | string | Yes | Start time (ISO 8601) |
| `calendarUrl` | string | No | Calendar to create in |
| `end` | string | No | End time |
| `location` | string | No | Location |
| `description` | string | No | Details |
| `status` | string | No | `tentative`, `confirmed`, `cancelled` |
| `recurrenceRule` | string | No | RRULE (e.g., `FREQ=WEEKLY;BYDAY=MO`) |

---

### update_event
Update an event.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `eventUrl` | string | Yes | Event URL |
| `summary` | string | No | New title |
| `start` | string | No | New start time |
| `end` | string | No | New end time |
| `location` | string | No | New location |
| `status` | string | No | New status |

---

### delete_event
Delete an event.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `eventUrl` | string | Yes | Event URL |
