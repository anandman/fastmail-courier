# Fastmail Courier Development Guide

## Project Overview
Fastmail Courier is an MCP (Model Context Protocol) server designed to expose Fastmail account resources (email, calendar, tasks, etc.) to AI models. It connects to Fastmail using the JMAP API for email operations and CalDAV for calendar/tasks.

## Technology Stack
- **Runtime**: Node.js (TypeScript)
- **Protocol**: Model Context Protocol (MCP) using `@modelcontextprotocol/sdk`
- **APIs**: JMAP (email), CalDAV (calendar & tasks)

## Directory Structure
- [src/index.ts](file:///Users/anand/Library/CloudStorage/Dropbox/src/vibe/fastmail-courier/src/index.ts): Main entry point. Starts the server (stdio or HTTP transport).
- [src/tools/](file:///Users/anand/Library/CloudStorage/Dropbox/src/vibe/fastmail-courier/src/tools/): Implements individual tool groups (accounts, mailboxes, read, search, send, organize, calendar).
- [src/auth/](file:///Users/anand/Library/CloudStorage/Dropbox/src/vibe/fastmail-courier/src/auth/): OIDC and Proxy-based authentication systems.

## Development Workflow
1. Install dependencies: `npm install`
2. Build the project: `npm run build`
3. Run tests (if applicable): `npm run test`

## Project Status & Key Design Decisions
- CalDAV tasks and events are supported.
- OAuth (OIDC) is supported for remote deployments.
- JMAP Contacts support is currently missing (a major functional gap compared to the official Fastmail MCP server).
