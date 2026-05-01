# mcp-m365-bookmarklet

A browser bookmarklet that brings [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) tool calling directly into Microsoft 365 Copilot Chat. When Copilot generates a function call, the bookmarklet detects it, executes it against your local MCP server, and inserts the result back into the chat — all without leaving the browser.

---

## How It Works

```
M365 Copilot Chat page
  └── bridge.js  (bookmarklet, injected into page)
        │  postMessage (JSON-RPC style)
        ▼
      app.js  (hidden iframe, served from localhost:3443 over HTTPS)
        │  SSE + JSON-RPC 2.0
        ▼
      MCP Server  (localhost:3006)
```

1. **Bookmarklet activation** — clicking the bookmarklet injects `bridge.js` into the M365 page.
2. **DOM monitoring** — a `MutationObserver` watches for Copilot responses that contain `function_call` JSON blocks.
3. **Interactive cards** — each detected call renders a card with **Run**, **Insert**, and result display areas.
4. **Tool execution** — the bridge relays the call to the hidden iframe via `postMessage`; the iframe forwards it to your MCP server over SSE.
5. **Result insertion** — the result is formatted as `<function_result>` XML and inserted into the Copilot input box, optionally auto-submitted.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js | v18 or later |
| MCP server | Running on `http://localhost:3006` (SSE transport) |
| Browser | Chromium-based or Firefox (bookmarklets supported) |
| M365 access | Microsoft 365 Copilot Chat at `m365.cloud.microsoft` |

---

## Getting Started

### 1. Install & Build

```bash
git clone <repo-url>
cd mcp-m365-bookmarklet
npm install
npm run build
```

The compiled bundles are written to `dist/`.

### 2. Serve the dist folder over HTTPS

M365 Copilot Chat runs on HTTPS, so the static server must also use HTTPS (mixed-content is blocked).

Generate a local dev certificate (one-time):

```bash
# Using mkcert (recommended)
mkcert localhost 127.0.0.1
# Or using the included cert files if already generated
```

Then start the HTTPS server:

```bash
npm run serve:https
# Serves dist/ on https://localhost:3443
```

Keep this running whenever you use the bookmarklet.

**Alternative: Python-only serving (no mkcert / no Node http-server required)**

If you have Python 3 and OpenSSL but not `mkcert`, generate a self-signed cert once:

```bash
bash scripts/gen_cert.sh
```

Then serve each session with:

```bash
python scripts/serve_https.py
# or: npm run serve:py
```

This serves the same `dist/` folder on the same `https://localhost:3443`, so the bookmarklet URL and all hardcoded constants stay unchanged. The existing `mkcert` / `npm run serve:https` path is still fully supported — both approaches share the same cert filenames (`localhost+1.pem` / `localhost+1-key.pem`).

Note: `serve_https.py` binds to `0.0.0.0` by default (all interfaces); on a shared or untrusted network pass `--host 127.0.0.1` to restrict it to localhost only.

### 3. Create the bookmarklet

Create a new browser bookmark with the following URL:

```javascript
javascript:void(document.head.appendChild(Object.assign(document.createElement('script'),{src:'https://localhost:3443/bridge.js?t='+Date.now()})))
```

The `?t=`+`Date.now()` query string is a cache-buster — it forces the browser to refetch `bridge.js` on every click instead of serving a stale copy. Useful during development when you're rebuilding the bundle. The MCP server itself is unaffected; only the static asset is reloaded.

### 4. Activate

1. Start your MCP server on `localhost:3006`.
2. Visit `https://localhost:3443/` once in your browser and accept the self-signed certificate warning.
3. Navigate to [M365 Copilot Chat](https://m365.cloud.microsoft).
4. Click the bookmarklet — a small control panel appears in the **bottom-right corner** showing connection status and available tools. The panel is draggable and saves its position to `localStorage`. If you can't find it, run this in DevTools console to reset its position: `localStorage.removeItem('mcp_panel_position'); location.reload();`

---

## Usage

Once the bookmarklet is active:

- **Green dot** in the control panel = connected to your MCP server.
- **Tool count** shows how many tools were discovered via `tools/list`.
- When Copilot responds with a `function_call` block, a card appears inline with:
  - **Run** — executes the tool and displays the result.
  - **Insert** — inserts the formatted result into the Copilot input box.
- Click **Inject Instructions** to attach an auto-generated `mcp-instructions.md` file describing all available tools to your next Copilot message.

### Automation toggles

| Toggle | Behavior |
|---|---|
| **Auto-insert** | Automatically inserts the tool result after execution |
| **Auto-submit** | Automatically submits the chat form after insertion |
| **Auto-run** | Automatically clicks Run on every detected function call |

Settings are persisted in `localStorage` across sessions.

---

## Configuration

Default ports are defined in [src/shared/protocol.ts](src/shared/protocol.ts):

| Constant | Default | Purpose |
|---|---|---|
| `DEFAULT_SERVER_URL` | `http://localhost:3006` | MCP server (SSE endpoint) |
| `DEFAULT_STATIC_URL` | `https://localhost:3443` | Static file server (bridge + app, HTTPS required) |

To use different ports, update the constants and rebuild.

---

## M365 Copilot Compatibility

M365 Copilot Chat has several quirks in how it emits function call JSON. The following issues have been handled:

### Parameter field name: `"key"` instead of `"name"`

M365 Copilot emits parameter objects using `"key"` for the parameter name field:

```json
{"type": "parameter", "key": "path", "value": "/tmp/file.txt"}
```

The extractor accepts both `"key"` (M365) and `"name"` (other LLMs).

### Unescaped backslashes in Windows paths

M365 Copilot outputs Windows paths with raw backslashes, which is invalid JSON:

```
{"type": "parameter", "key": "path", "value": "C:\Users\..."}
```

The extractor automatically recovers these by doubling backslashes before parsing.

### Non-string parameter types

M365 Copilot correctly emits typed parameter values (numbers, booleans, arrays). The renderer preserves these types — they are forwarded to the MCP server without stringification:

| M365 output | Sent to MCP server |
|---|---|
| `"value": 42` | `42` (number) |
| `"value": true` | `true` (boolean) |
| `"value": ["a","b"]` | `["a","b"]` (array) |
| `"value": {"k":"v"}` | `{"k":"v"}` (object) |

This ensures tools with `number` or `boolean` parameters (e.g. `read_file` with `offset`/`length`, `start_search` with `literalSearch`) work correctly without Zod validation errors.

### No code fences

M365 does not render code fences — all function call JSON must be emitted as plain text. The injected instructions enforce this via `M365_COPILOT_INSTRUCTIONS` override in `src/bridge/instructions.ts`.

---

## Development

```bash
# Watch mode — rebuilds on file changes
npm run dev

# Run tests (enforces 80% coverage)
npm test

# Watch mode for tests
npm run test:watch
```

---

## Project Structure

```
src/
├── bridge/           # Bookmarklet bundle (injected into M365 page)
│   ├── index.ts      # Entry point & bootstrap
│   ├── iframe-bridge.ts   # postMessage protocol
│   ├── control-panel.ts   # Status UI + toggles
│   ├── m365-adapter.ts    # DOM operations (insert text, submit form)
│   ├── extractor.ts       # JSON function-call detection
│   ├── renderer.ts        # UI card rendering
│   └── instructions.ts    # MCP instructions generator
├── app/              # Hidden iframe bundle
│   ├── app.ts        # Entry point
│   ├── mcp-client.ts # SSE-based MCP client (JSON-RPC 2.0)
│   └── settings.ts   # localStorage settings
└── shared/
    └── protocol.ts   # Shared types & constants
```

---

## License

No license file is currently included in this repository.
