/**
 * postMessage protocol type definitions.
 * Defines all messages exchanged between the M365 page (bridge.js) and the iframe (app.js).
 */

// ── Tool definitions ──────────────────────────────────────────────────────────

export interface ToolParameter {
  readonly name: string;
  readonly description?: string;
  readonly type?: string;
  readonly required?: boolean;
}

export interface Tool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: {
    readonly type: string;
    readonly properties?: Record<string, unknown>;
    readonly required?: readonly string[];
  };
}

// ── Page → Iframe messages ────────────────────────────────────────────────────

export interface CallToolMessage {
  readonly type: 'mcp:call-tool';
  readonly requestId: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export interface ListToolsMessage {
  readonly type: 'mcp:list-tools';
  readonly requestId: string;
}

export interface GetSettingsMessage {
  readonly type: 'mcp:get-settings';
  readonly requestId: string;
}

// ── Iframe → Page messages ────────────────────────────────────────────────────

export interface ToolResultMessage {
  readonly type: 'mcp:tool-result';
  readonly requestId: string;
  readonly result?: unknown;
  readonly error?: string;
}

export interface ToolsListMessage {
  readonly type: 'mcp:tools-list';
  readonly requestId: string;
  readonly tools: readonly Tool[];
}

export interface ConnectionStatusMessage {
  readonly type: 'mcp:connection-status';
  readonly connected: boolean;
  readonly serverUrl: string;
}

export interface ReadyMessage {
  readonly type: 'mcp:ready';
}

export interface SettingsMessage {
  readonly type: 'mcp:settings';
  readonly requestId: string;
  readonly settings: AppSettings;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface AppSettings {
  readonly autoInsert: boolean;
  readonly autoSubmit: boolean;
  readonly autoRun: boolean;
  readonly serverUrl: string;
}

// ── Union types ───────────────────────────────────────────────────────────────

export type PageToIframeMessage =
  | CallToolMessage
  | ListToolsMessage
  | GetSettingsMessage;

export type IframeToPageMessage =
  | ToolResultMessage
  | ToolsListMessage
  | ConnectionStatusMessage
  | ReadyMessage
  | SettingsMessage;

export type AnyMessage = PageToIframeMessage | IframeToPageMessage;

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_SERVER_URL = 'http://localhost:3006';
export const DEFAULT_STATIC_URL = 'https://localhost:3443';
export const TOOL_CALL_TIMEOUT_MS = 30_000;
export const M365_ORIGIN_PATTERN = /^https:\/\/m365\.cloud\.microsoft(\.mcas\.ms)?$/;
export const LOCALHOST_ORIGIN = 'https://localhost:3443';
