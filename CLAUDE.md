# CLAUDE.md — mcp-m365-bookmarklet

Guidance for Claude when working in this repo. Read before touching code.

## What this project is

A browser bookmarklet that wires Microsoft 365 Copilot Chat to a local MCP server. Two TypeScript bundles built by esbuild:

- **`src/bridge/`** → `dist/bridge.js` — IIFE injected into the M365 page by the bookmarklet. Watches the DOM for `function_call` JSON, renders cards, and round-trips tool calls through a hidden iframe via `postMessage`.
- **`src/app/`** → `dist/app.js` (loaded by `dist/app.html`) — runs in the hidden iframe served from `https://localhost:3443`. Owns the SSE + JSON-RPC 2.0 connection to the MCP server on `http://localhost:3006`.
- **`src/shared/protocol.ts`** — single source of truth for postMessage shapes, settings, defaults, and the M365 origin pattern.

Data flow: M365 page ⇄ `bridge.js` ⇄ `postMessage` ⇄ `app.js` (iframe) ⇄ SSE/JSON-RPC ⇄ MCP server.

## Operating principles

### 1. Think Before Coding
- Trace the message path end-to-end before changing it: DOM → extractor → renderer → IframeBridge → postMessage → McpClient → SSE. Bugs almost always cross at least two layers.
- Re-read [src/shared/protocol.ts](src/shared/protocol.ts) before changing any message shape; both sides import it.
- Note the two origins in play: M365 page (`m365.cloud.microsoft`) and the iframe (`https://localhost:3443`). `LOCALHOST_ORIGIN` and `M365_ORIGIN_PATTERN` are load-bearing — never widen them to `'*'`.
- For DOM/extractor work, read the M365 quirks section in [README.md](README.md) (parameter `"key"` vs `"name"`, raw Windows backslashes, no code fences). These are real production cases, not edge cases.

### 2. Simplicity First
- This codebase is intentionally small and dependency-light: esbuild + vitest + happy-dom, no framework. Keep it that way — do not add React, a state library, a logger, or a validation lib unless explicitly asked.
- Prefer extending an existing module over creating a new one. The split is by role (bridge / app / shared), not by file count.
- Files use `readonly` interfaces and immutable updates throughout — match that style, don't introduce mutation.
- The protocol uses plain `interface` + discriminated-union `type` on `data.type`. Don't reach for classes or schemas where a tagged union already does the job.

### 3. Surgical Changes
- The bookmarklet is a hot path injected into a third-party page. Avoid global side effects: respect `GUARD_FLAG`, the singleton `IFRAME_ID`, `STYLE_ID`, and the `WeakSet<HTMLElement>` dedupe in `startExtractor`.
- When fixing a bug, change the smallest layer that owns the concern. Examples:
  - JSON parsing quirk → `extractor.ts` only.
  - postMessage routing/timeout → `iframe-bridge.ts` only.
  - SSE/JSON-RPC handshake → `mcp-client.ts` only.
  - DOM insertion into Copilot input → `m365-adapter.ts` only.
- Don't refactor neighbouring code "while you're there." Recent commits (see `git log`) show deliberately narrow fixes — match that cadence.
- `src/bridge/index.ts`, `src/app/app.ts`, and `src/bridge/styles.ts` are excluded from coverage by design (see [vitest.config.ts](vitest.config.ts:17-23)) — they're glue/wiring. New logic belongs in a tested module, not in these files.

### 4. Goal-Driven Execution
- Every change should map to one of: (a) a Copilot-emitted edge case the extractor must accept, (b) a postMessage / SSE protocol correctness fix, (c) a UX fix in the control panel or card renderer, (d) a security boundary (origin checks, file attach), or (e) test coverage.
- If a request doesn't fit one of those, surface that before coding and ask what the actual goal is.
- Done = `npm run build` succeeds **and** `npm test` passes with ≥80% coverage on each metric (enforced by vitest config). Don't claim done before running both.

## Workflow

```bash
npm run dev            # esbuild watch, writes to dist/
npm run build          # one-shot production build (minified)
npm test               # vitest run --coverage (80% threshold, fails build if below)
npm run test:watch     # vitest watch
npm run serve:https    # serve dist/ on https://localhost:3443 (needs localhost+1.pem / .key)
```

The HTTPS cert files (`*.pem`, `*.key`) are gitignored — generate locally with `mkcert` if missing. The MCP server itself is out of scope for this repo; assume it's running on `:3006`.

## Testing notes

- Vitest + `happy-dom`. Each module ships with a `.test.ts` neighbour — keep that 1:1 pairing.
- When changing a module that has a test file, update the test in the same change. Don't add untested branches.
- The coverage gate is global (80% lines/branches/functions/statements). A new module without tests will fail CI even if it works.

## Things to leave alone unless asked

- The `protocolVersion: '2024-11-05'` and `clientInfo` in `mcp-client.ts` — changing these breaks handshake compatibility.
- The origin checks in `iframe-bridge.ts` (`event.origin !== LOCALHOST_ORIGIN`) and the targeted `postMessage(..., LOCALHOST_ORIGIN)` calls.
- The `M365_COPILOT_INSTRUCTIONS` override in `instructions.ts` — Copilot will emit code-fenced JSON if this prompt drifts, and the extractor's inline pattern won't match.
- Bundle format (`iife` with `globalName`) and `target: 'es2020'` in `esbuild.config.mjs` — required for bookmarklet injection.

## MCP Test Agent eval harness

`.github/agents/eval/` contains a repeatable regression suite for verifying the JSONL format that `src/bridge/extractor.ts` detects.

| File | Purpose |
|------|---------|
| `test-cases.jsonl` | 10 prompt/eval pairs covering all 7 desktop-commander tools and integer-param edge cases |
| `score.mjs` | Pure ESM scorer — `scoreResponse(raw, testCase)` returns pass/fail per eval criterion |
| `results-batch1.jsonl` | Baseline run results (10/10 pass) |

### Eval criteria per test case

| Criterion | What is checked |
|-----------|----------------|
| `no_code_fence` | Response contains no ` ``` ` markers |
| `has_start` / `has_end` | `function_call_start` and `function_call_end` both present |
| `call_id_integer` | `call_id` is a JSON number, not a string |
| `tool_exists` | Tool name is one of the 7 known `desktop-commander.*` tools |
| `correct_tool` | Tool name matches the expected tool for that prompt |
| `all_required_params` | All required params appear as `parameter` objects |
| `integers_unquoted` | `offset`, `length`, `timeout_ms` values are JSON numbers |
| `no_mock_results` | Response does not contain `<function_results>` |
| `mode_is_append` | `mode` param equals `"append"` (test 8 only) |
| `timeout_is_10000` | `timeout_ms` equals `10000` integer (test 9 only) |

### Running a new batch

```js
import { scoreResponse } from '.github/agents/eval/score.mjs';
import testCases from '.github/agents/eval/test-cases.jsonl' assert { type: 'json' };
// invoke MCP Test Agent for each testCase.prompt, then:
const result = scoreResponse(agentResponse, testCase);
console.log(result.pass, result.notes);
```

### Key JSONL format rules enforced by the extractor

These rules come from `INLINE_JSON_PATTERN` and `OBJECT_PATTERN` in `src/bridge/extractor.ts`:

1. Each function call must start with `{"type":"function_call_start",...}` and end with `{"type":"function_call_end",...}`.
2. **No code fences** — the inline pattern does not match fenced blocks; fenced blocks use a separate code path.
3. Use **forward slashes** in file paths — raw backslashes break JSON parsing (the extractor has a fallback for M365-emitted backslashes, but agent output should be clean).
4. Integer parameters (`offset`, `length`, `timeout_ms`) must be JSON numbers, not quoted strings — the bridge passes them as-is to the MCP server's JSON-RPC call.
