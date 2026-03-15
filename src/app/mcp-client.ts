/**
 * MCP Client — SSE transport following standard MCP SSE protocol.
 *
 * Protocol flow:
 *   1. GET /sse  → server sends endpoint event with sessionId URL
 *   2. POST /message?sessionId=XXX with initialize JSON-RPC request
 *   3. All responses arrive via SSE 'message' events (POST body is always empty)
 *   4. After initialize succeeds, tools/list and tools/call can be called
 */

import type { Tool } from '../shared/protocol';

// ── Types ─────────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly method: string;
  readonly params: Record<string, unknown>;
}

interface JsonRpcSuccess {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result: unknown;
}

interface JsonRpcError {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly error: {
    readonly code: number;
    readonly message: string;
  };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

interface PendingRpc {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

// ── McpClient ─────────────────────────────────────────────────────────────────

export class McpClient {
  private readonly serverUrl: string;
  private eventSource: EventSource | null = null;
  private nextId = 1;

  private messageUrl: string | null = null;
  private pendingRpc = new Map<number, PendingRpc>();
  private initialized = false;
  private initQueue: Array<() => void> = [];

  /** Called whenever the connection status changes. */
  onStatusChange?: (connected: boolean, serverUrl: string) => void;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  /**
   * Establish an SSE connection to the MCP server.
   * Automatically performs the initialize handshake once the endpoint is received.
   * Safe to call multiple times — will not create duplicate connections.
   */
  connect(): void {
    if (this.eventSource !== null) return;

    const es = new EventSource(`${this.serverUrl}/sse`);

    es.addEventListener('endpoint', (e: MessageEvent) => {
      this.messageUrl = new URL(e.data, this.serverUrl).href;
      this.sendInitialize();
    });

    es.addEventListener('message', (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string) as JsonRpcResponse;
      const pending = this.pendingRpc.get(msg.id);
      if (!pending) return;
      this.pendingRpc.delete(msg.id);
      if ('error' in msg && msg.error) {
        pending.reject(new Error(msg.error.message));
      } else {
        pending.resolve((msg as JsonRpcSuccess).result);
      }
    });

    es.addEventListener('error', () => {
      this.onStatusChange?.(false, this.serverUrl);
    });

    this.eventSource = es;
  }

  /** Close the SSE connection and reset all state. */
  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.messageUrl = null;
    this.initialized = false;
    this.initQueue = [];
    for (const [, pending] of this.pendingRpc) {
      pending.reject(new Error('Disconnected'));
    }
    this.pendingRpc.clear();
  }

  /**
   * Retrieve the list of available tools from the MCP server.
   * Queues the request if the initialize handshake has not yet completed.
   */
  async listTools(): Promise<Tool[]> {
    const result = await this.sendRequest('tools/list', {});
    const data = result as { tools?: Tool[] };
    return data.tools ?? [];
  }

  /**
   * Invoke a named tool with the provided arguments.
   * Queues the request if the initialize handshake has not yet completed.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /** Send the initialize JSON-RPC request and handle the response. */
  private sendInitialize(): void {
    const id = this.nextId++;
    this.postToServer({
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mcp-bookmarklet', version: '1.0.0' },
      },
    });
    this.pendingRpc.set(id, {
      resolve: () => {
        this.initialized = true;
        this.onStatusChange?.(true, this.serverUrl);
        this.initQueue.splice(0).forEach(fn => fn());
      },
      reject: () => {
        this.onStatusChange?.(false, this.serverUrl);
      },
    });
  }

  /**
   * Send a JSON-RPC request and wait for the SSE response.
   * If not yet initialized, queues the request until initialize completes.
   */
  private sendRequest(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.initialized) {
      return new Promise<unknown>((resolve, reject) => {
        this.initQueue.push(() => {
          this.sendRequest(method, params).then(resolve, reject);
        });
      });
    }

    const id = this.nextId++;
    this.postToServer({ jsonrpc: '2.0', id, method, params });
    return new Promise<unknown>((resolve, reject) => {
      this.pendingRpc.set(id, { resolve, reject });
    });
  }

  /**
   * Fire-and-forget POST to the message endpoint.
   * Responses always arrive via SSE, never in the POST response body.
   */
  private postToServer(body: JsonRpcRequest): void {
    if (!this.messageUrl) return;
    fetch(this.messageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {
      // Network errors for individual POSTs are reported via SSE error events
    });
  }
}
