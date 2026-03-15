/**
 * IframeBridge — postMessage protocol bridge between the M365 page and the
 * localhost iframe that handles MCP communication.
 *
 * The bridge creates a hidden <iframe> pointed at the local app.html,
 * then routes callTool / listTools calls via postMessage and correlates
 * responses by requestId.
 */

import type {
  Tool,
  CallToolMessage,
  ListToolsMessage,
  ToolResultMessage,
  ToolsListMessage,
  ConnectionStatusMessage,
} from '../shared/protocol';
import { LOCALHOST_ORIGIN } from '../shared/protocol';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface ConnectionStatus {
  readonly connected: boolean;
  readonly serverUrl: string;
}

export interface IframeBridgeOptions {
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const IFRAME_ID = 'mcp-bookmarklet-iframe';

// ── IframeBridge ──────────────────────────────────────────────────────────────

export class IframeBridge {
  private readonly appUrl: string;
  private readonly timeoutMs: number;
  private iframe: HTMLIFrameElement | null = null;
  private isReady = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private readyQueue: Array<{ requestId: string; message: unknown }> = [];
  private connectionStatus: ConnectionStatus = { connected: false, serverUrl: '' };
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private requestCounter = 0;

  /** Called whenever the MCP server connection status changes. */
  onConnectionStatus?: (connected: boolean, serverUrl: string) => void;

  constructor(appUrl: string, options?: IframeBridgeOptions) {
    this.appUrl = appUrl;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Create and attach the hidden iframe, then start listening for messages.
   * Safe to call multiple times — will not create duplicates.
   */
  init(): void {
    if (this.iframe !== null) return;

    const existing = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
    if (existing) {
      this.iframe = existing;
      this.attachMessageListener();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.id = IFRAME_ID;
    iframe.src = this.appUrl;
    iframe.style.display = 'none';
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-1';

    document.body.appendChild(iframe);
    this.iframe = iframe;
    this.attachMessageListener();
  }

  /**
   * Remove the iframe and clean up all listeners and pending requests.
   */
  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('IframeBridge destroyed'));
    }
    this.pendingRequests.clear();

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    this.isReady = false;
  }

  /**
   * Invoke a named MCP tool via the iframe bridge.
   * Returns a Promise that resolves with the tool result or rejects on error/timeout.
   */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const requestId = this.nextRequestId();

    const message: CallToolMessage = {
      type: 'mcp:call-tool',
      requestId,
      name,
      args,
    };

    return this.sendAndWait(requestId, message);
  }

  /**
   * Request the list of available tools from the MCP server via the iframe.
   */
  listTools(): Promise<Tool[]> {
    const requestId = this.nextRequestId();

    const message: ListToolsMessage = {
      type: 'mcp:list-tools',
      requestId,
    };

    return this.sendAndWait(requestId, message) as Promise<Tool[]>;
  }

  /** Return the last received connection status. */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  // ── Internal (called by tests or iframe load event) ───────────────────────

  /** Mark the iframe as ready and flush any queued messages. */
  onIframeReady(): void {
    this.isReady = true;
    const queued = this.readyQueue.splice(0);
    const iframeWindow = this.iframe?.contentWindow;
    if (iframeWindow) {
      for (const item of queued) {
        iframeWindow.postMessage(item.message, LOCALHOST_ORIGIN);
      }
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private attachMessageListener(): void {
    if (this.messageHandler) return;

    this.messageHandler = (event: MessageEvent) => this.handleMessage(event);
    window.addEventListener('message', this.messageHandler);
  }

  private handleMessage(event: MessageEvent): void {
    // Only accept messages from our iframe origin
    if (event.origin !== LOCALHOST_ORIGIN) return;

    const data = event.data as Record<string, unknown>;
    if (!data || typeof data.type !== 'string') return;

    switch (data.type) {
      case 'mcp:ready':
        this.onIframeReady();
        break;

      case 'mcp:tool-result':
        this.handleToolResult(data as unknown as ToolResultMessage);
        break;

      case 'mcp:tools-list':
        this.handleToolsList(data as unknown as ToolsListMessage);
        break;

      case 'mcp:connection-status':
        this.handleConnectionStatus(data as unknown as ConnectionStatusMessage);
        break;
    }
  }

  private handleToolResult(msg: ToolResultMessage): void {
    const pending = this.pendingRequests.get(msg.requestId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(msg.requestId);

    if (msg.error) {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve(msg.result);
    }
  }

  private handleToolsList(msg: ToolsListMessage): void {
    const pending = this.pendingRequests.get(msg.requestId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(msg.requestId);
    pending.resolve(msg.tools);
  }

  private handleConnectionStatus(msg: ConnectionStatusMessage): void {
    this.connectionStatus = {
      connected: msg.connected,
      serverUrl: msg.serverUrl,
    };
    this.onConnectionStatus?.(msg.connected, msg.serverUrl);
  }

  private sendAndWait(requestId: string, message: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`MCP request timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      if (!this.isReady) {
        // Queue the message — will be flushed when mcp:ready is received
        this.readyQueue.push({ requestId, message });
        return;
      }

      const iframeWindow = this.iframe?.contentWindow;
      if (iframeWindow) {
        iframeWindow.postMessage(message, LOCALHOST_ORIGIN);
      }
    });
  }

  private nextRequestId(): string {
    this.requestCounter++;
    return `req-${Date.now()}-${this.requestCounter}`;
  }
}
