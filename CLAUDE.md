# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A browser bookmarklet that integrates MCP (Model Context Protocol) tool calling into Microsoft 365 Copilot Chat. When Copilot generates function call JSON, the bookmarklet detects it, executes it against a local MCP server, and inserts the result back into the chat.

## Commands

```bash
npm run build          # Compile bundles to dist/ (minified)
npm run dev            # Watch mode with inline sourcemaps
npm test               # Run tests + coverage (80% threshold enforced)
npm run test:watch     # Watch mode for tests
npm run test:coverage  # Generate coverage reports
npm run serve          # HTTP server on port 3007
npm run serve:https    # HTTPS server on port 3443 (required for M365)
```

Run a single test file:
```bash
npx vitest run src/bridge/extractor.test.ts
```

## Architecture

Two-bundle architecture communicating via postMessage:

```
M365 Copilot Chat Page
  └── dist/bridge.js  (IIFE bookmarklet, injected into page)
        │ postMessage (typed protocol from src/shared/protocol.ts)
        ▼
      dist/app.js  (IIFE, runs in hidden iframe at https://localhost:3443)
        │ SSE + JSON-RPC 2.0
        ▼
      MCP Server (http://localhost:3006)
```

**Build outputs**: `dist/bridge.js` (bookmarklet), `dist/app.js` (iframe), `dist/app.html` (iframe container).

### Key Source Files

| File | Role |
|------|------|
| `src/shared/protocol.ts` | Shared readonly message types and constants (`DEFAULT_SERVER_URL`, `LOCALHOST_ORIGIN`, `M365_ORIGIN_PATTERN`) |
| `src/bridge/index.ts` | Bootstrap: guard flag, hostname validation, settings load, MutationObserver start |
| `src/bridge/extractor.ts` | Regex detection of function-call JSON in Copilot responses; handles M365 quirks (backslash escaping, `"key"` vs `"name"` field) |
| `src/bridge/iframe-bridge.ts` | Creates hidden iframe, queues messages until `mcp:ready`, correlates responses by `requestId`, 30s timeout |
| `src/bridge/renderer.ts` | Renders interactive Run/Insert cards; manages loading/error states |
| `src/bridge/control-panel.ts` | Floating draggable UI: connection status, tool count, automation toggles, reconnect/inject-instructions |
| `src/bridge/m365-adapter.ts` | DOM operations: `insertText()`, `submitForm()`, `attachFile()` |
| `src/bridge/instructions.ts` | Generates `mcp-instructions.md` from live MCP tool list |
| `src/app/mcp-client.ts` | SSE transport: GET `/sse` → POST `/message?sessionId=X`; pending RPC map for response correlation |
| `src/app/settings.ts` | localStorage wrapper for automation settings |

### M365-Specific Quirks (in `extractor.ts`)

- Accepts `"key"` field (M365 output) in addition to standard `"name"` for function parameters
- Auto-doubles backslashes in string values before JSON parsing (Windows paths)
- Two-pass matching: prefers code-fenced blocks, falls back to inline JSONL

### postMessage Protocol

All messages are typed in `src/shared/protocol.ts`:
- **Page → Iframe**: `CallToolMessage`, `ListToolsMessage`, `GetSettingsMessage`, `DisconnectMessage`
- **Iframe → Page**: `ToolResultMessage`, `ToolsListMessage`, `ConnectionStatusMessage`, `ReadyMessage`

### Local Dev Setup

```bash
# Generate HTTPS certificates (required for M365 compatibility)
mkcert localhost 127.0.0.1
# Produces: localhost+1.pem, localhost+1-key.pem

# Then run:
npm run serve:https   # serves dist/ on https://localhost:3443
```

Start MCP server separately on `http://localhost:3006`.

## Testing

- **Framework**: Vitest with happy-dom environment
- **Coverage threshold**: 80% branches/functions/lines/statements
- Bootstrap files excluded from coverage: `src/bridge/index.ts`, `src/app/app.ts`, `src/bridge/styles.ts`
- Tests live alongside source files as `*.test.ts`
