/**
 * App Entry Point (runs inside the hidden iframe at localhost:3006).
 *
 * Listens for postMessage calls from the parent M365 page, routes them to
 * the MCP server, and sends results back via postMessage.
 */

import { McpClient } from './mcp-client';
import { loadSettings } from './settings';
import {
  M365_ORIGIN_PATTERN,
  LOCALHOST_ORIGIN,
  DEFAULT_SERVER_URL,
  type CallToolMessage,
  type ListToolsMessage,
  type ToolResultMessage,
  type ToolsListMessage,
  type ConnectionStatusMessage,
  type ReadyMessage,
  type PageToIframeMessage,
} from '../shared/protocol';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

/** Captured on first valid inbound message; used as postMessage target. */
let parentOrigin: string | null = null;

(function init() {
  const settings = loadSettings();
  const serverUrl = settings.serverUrl ?? DEFAULT_SERVER_URL;

  const client = new McpClient(serverUrl);

  client.onStatusChange = (connected, url) => {
    sendToParent<ConnectionStatusMessage>({
      type: 'mcp:connection-status',
      connected,
      serverUrl: url,
    });
  };

  client.connect();

  window.addEventListener('message', (event: MessageEvent) => {
    // Validate origin — accept M365 origins and localhost (for dev) using exact match
    const origin = event.origin;
    const isM365 = M365_ORIGIN_PATTERN.test(origin);
    const isLocalhost = origin === LOCALHOST_ORIGIN || origin === 'http://localhost:3443';

    if (!isM365 && !isLocalhost) return;

    // Capture the parent origin on first valid message for use in sendToParent
    if (parentOrigin === null) parentOrigin = origin;

    handleMessage(event.data as PageToIframeMessage, client);
  });

  // Signal ready to parent
  sendToParent<ReadyMessage>({ type: 'mcp:ready' });
})();

// ── Message routing ───────────────────────────────────────────────────────────

async function handleMessage(msg: PageToIframeMessage, client: McpClient): Promise<void> {
  if (!msg || typeof msg.type !== 'string') return;

  switch (msg.type) {
    case 'mcp:call-tool':
      await handleCallTool(msg as CallToolMessage, client);
      break;

    case 'mcp:list-tools':
      await handleListTools(msg as ListToolsMessage, client);
      break;
  }
}

async function handleCallTool(msg: CallToolMessage, client: McpClient): Promise<void> {
  try {
    const result = await client.callTool(msg.name, msg.args);
    sendToParent<ToolResultMessage>({
      type: 'mcp:tool-result',
      requestId: msg.requestId,
      result,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    sendToParent<ToolResultMessage>({
      type: 'mcp:tool-result',
      requestId: msg.requestId,
      error,
    });
  }
}

async function handleListTools(msg: ListToolsMessage, client: McpClient): Promise<void> {
  try {
    const tools = await client.listTools();
    sendToParent<ToolsListMessage>({
      type: 'mcp:tools-list',
      requestId: msg.requestId,
      tools,
    });
  } catch {
    sendToParent<ToolsListMessage>({
      type: 'mcp:tools-list',
      requestId: msg.requestId,
      tools: [],
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sendToParent<T>(message: T): void {
  if (window.parent && window.parent !== window && parentOrigin !== null) {
    window.parent.postMessage(message, parentOrigin);
  }
}
