import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpClient } from './mcp-client';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a fully wired test environment:
 * - fetchMock: global fetch stub (fire-and-forget POST returns 200 empty body)
 * - esMock: fake EventSource with addEventListener/close
 * - fireEndpoint: trigger the 'endpoint' SSE event (starts initialize handshake)
 * - fireMessage: deliver a successful JSON-RPC response via 'message' SSE event
 * - fireRpcError: deliver an error JSON-RPC response via 'message' SSE event
 * - fireError: trigger the 'error' SSE event
 */
function makeMcpSetup() {
  const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
  global.fetch = fetchMock;

  let endpointHandler: ((e: MessageEvent) => void) | null = null;
  let messageHandler: ((e: MessageEvent) => void) | null = null;
  let errorHandler: ((e: Event) => void) | null = null;
  let openHandler: ((e: Event) => void) | null = null;

  const esMock = {
    addEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
      if (event === 'endpoint') endpointHandler = handler as (e: MessageEvent) => void;
      if (event === 'message') messageHandler = handler as (e: MessageEvent) => void;
      if (event === 'error') errorHandler = handler as (e: Event) => void;
      if (event === 'open') openHandler = handler as (e: Event) => void;
    }),
    close: vi.fn(),
    readyState: 1,
  };

  global.EventSource = vi.fn().mockImplementation(function () { return esMock; }) as unknown as typeof EventSource;

  return {
    fetchMock,
    esMock,
    fireEndpoint: (sid = 'test-session') =>
      endpointHandler?.({ data: `/message?sessionId=${sid}` } as MessageEvent),
    fireMessage: (id: number, result: unknown) =>
      messageHandler?.({ data: JSON.stringify({ jsonrpc: '2.0', id, result }) } as MessageEvent),
    fireRpcError: (id: number, message: string) =>
      messageHandler?.({
        data: JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }),
      } as MessageEvent),
    fireError: () => errorHandler?.({} as Event),
    fireOpen: () => openHandler?.({} as Event),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('McpClient', () => {
  let client: McpClient;

  beforeEach(() => {
    client = new McpClient('http://localhost:3006');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── connect() ──────────────────────────────────────────────────────────────

  describe('connect()', () => {
    it('establishes EventSource at /sse', () => {
      const { esMock } = makeMcpSetup();
      void esMock; // referenced via global.EventSource

      client.connect();

      expect(global.EventSource).toHaveBeenCalledWith('http://localhost:3006/sse');
    });

    it('does not create duplicate EventSource on second call', () => {
      makeMcpSetup();

      client.connect();
      client.connect();

      expect(global.EventSource).toHaveBeenCalledTimes(1);
    });

    it('sends initialize after endpoint event received', () => {
      const { fetchMock, fireEndpoint } = makeMcpSetup();

      client.connect();
      fireEndpoint('abc-123');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://localhost:3006/message?sessionId=abc-123');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string) as Record<string, unknown>;
      expect(body.method).toBe('initialize');
      expect(body.jsonrpc).toBe('2.0');
    });

    it('fires onStatusChange(true) after initialize response arrives via SSE', () => {
      const { fireEndpoint, fireMessage, fetchMock } = makeMcpSetup();
      const onStatus = vi.fn();
      client.onStatusChange = onStatus;

      client.connect();
      fireEndpoint();

      // Capture the id used in the initialize POST
      const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as {
        id: number;
      };
      fireMessage(body.id, { protocolVersion: '2024-11-05', capabilities: {} });

      expect(onStatus).toHaveBeenCalledWith(true, 'http://localhost:3006');
    });

    it('fires onStatusChange(false) on EventSource error', () => {
      const { fireError } = makeMcpSetup();
      const onStatus = vi.fn();
      client.onStatusChange = onStatus;

      client.connect();
      fireError();

      expect(onStatus).toHaveBeenCalledWith(false, 'http://localhost:3006');
    });

    it('messageUrl includes sessionId from endpoint event', () => {
      const { fetchMock, fireEndpoint } = makeMcpSetup();

      client.connect();
      fireEndpoint('my-session-id');

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('sessionId=my-session-id');
    });
  });

  // ── listTools() ────────────────────────────────────────────────────────────

  describe('listTools()', () => {
    it('returns tools after initialize completes', async () => {
      const { fetchMock, fireEndpoint, fireMessage } = makeMcpSetup();
      const tools = [{ name: 'read_file', description: 'Read a file' }];

      client.connect();
      fireEndpoint();

      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, { protocolVersion: '2024-11-05' });

      // Now call listTools — should POST tools/list
      const promise = client.listTools();

      const listId = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(listId.id, { tools });

      const result = await promise;
      expect(result).toEqual(tools);
    });

    it('queues listTools if called before endpoint received, sends after initialize', async () => {
      const { fetchMock, fireEndpoint, fireMessage } = makeMcpSetup();
      const tools = [{ name: 'write_file', description: 'Write a file' }];

      client.connect();

      // Call listTools BEFORE endpoint/initialize
      const promise = client.listTools();

      // No POST for listTools yet — only will happen after init
      expect(fetchMock).not.toHaveBeenCalled();

      // Now fire endpoint → triggers initialize POST
      fireEndpoint();
      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, {});

      // After init succeeds, queued listTools POST should fire
      await Promise.resolve(); // flush microtask queue

      const listId = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(listId.id, { tools });

      expect(await promise).toEqual(tools);
    });

    it('returns empty array when result has no tools field', async () => {
      const { fetchMock, fireEndpoint, fireMessage } = makeMcpSetup();

      client.connect();
      fireEndpoint();
      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, {});

      const promise = client.listTools();
      const listId = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(listId.id, {});

      expect(await promise).toEqual([]);
    });

    it('rejects when SSE delivers error response', async () => {
      const { fetchMock, fireEndpoint, fireMessage, fireRpcError } = makeMcpSetup();

      client.connect();
      fireEndpoint();
      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, {});

      const promise = client.listTools();
      const listId = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      ) as { id: number };
      fireRpcError(listId.id, 'Method not found');

      await expect(promise).rejects.toThrow('Method not found');
    });
  });

  // ── callTool() ─────────────────────────────────────────────────────────────

  describe('callTool()', () => {
    it('sends tools/call with correct name and arguments', async () => {
      const { fetchMock, fireEndpoint, fireMessage } = makeMcpSetup();

      client.connect();
      fireEndpoint();
      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, {});

      const promise = client.callTool('read_file', { path: '/tmp/test.txt' });
      const callId = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      ) as { id: number; method: string; params: Record<string, unknown> };

      expect(callId.method).toBe('tools/call');
      expect(callId.params).toMatchObject({ name: 'read_file', arguments: { path: '/tmp/test.txt' } });

      fireMessage(callId.id, { content: [{ type: 'text', text: 'hello' }] });
      await promise;
    });

    it('returns tool result from SSE response', async () => {
      const { fetchMock, fireEndpoint, fireMessage } = makeMcpSetup();
      const content = [{ type: 'text', text: 'file contents here' }];

      client.connect();
      fireEndpoint();
      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, {});

      const promise = client.callTool('read_file', { path: '/tmp/test.txt' });
      const callId = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(callId.id, { content });

      expect(await promise).toEqual({ content });
    });

    it('uses unique ids for concurrent requests', async () => {
      const { fetchMock, fireEndpoint, fireMessage } = makeMcpSetup();

      client.connect();
      fireEndpoint();
      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, {});

      // Launch two concurrent tool calls
      const p1 = client.callTool('tool_a', {});
      const p2 = client.callTool('tool_b', {});

      const body1 = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      ) as { id: number };
      const body2 = JSON.parse(
        (fetchMock.mock.calls[2][1] as RequestInit).body as string,
      ) as { id: number };

      expect(body1.id).not.toBe(body2.id);

      fireMessage(body1.id, { content: [] });
      fireMessage(body2.id, { content: [] });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
    });

    it('rejects when SSE delivers error response', async () => {
      const { fetchMock, fireEndpoint, fireMessage, fireRpcError } = makeMcpSetup();

      client.connect();
      fireEndpoint();
      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, {});

      const promise = client.callTool('bad_tool', {});
      const callId = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      ) as { id: number };
      fireRpcError(callId.id, 'Tool execution failed');

      await expect(promise).rejects.toThrow('Tool execution failed');
    });
  });

  // ── disconnect() ───────────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('closes EventSource', () => {
      const { esMock } = makeMcpSetup();

      client.connect();
      client.disconnect();

      expect(esMock.close).toHaveBeenCalledTimes(1);
    });

    it('rejects pending promises with Disconnected error', async () => {
      const { fetchMock, fireEndpoint, fireMessage } = makeMcpSetup();

      client.connect();
      fireEndpoint();
      const initId = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as { id: number };
      fireMessage(initId.id, {});

      // Start a tool call but do NOT fire the SSE message — so it stays pending
      const promise = client.callTool('hanging_tool', {});

      client.disconnect();

      await expect(promise).rejects.toThrow('Disconnected');
    });

    it('resets messageUrl and initialized state — subsequent connect re-initializes', () => {
      const { fetchMock, fireEndpoint } = makeMcpSetup();

      client.connect();
      fireEndpoint('session-1');
      client.disconnect();

      // After disconnect, messageUrl should be cleared; re-connecting needs new endpoint
      client.connect();
      fireEndpoint('session-2');

      // Second connect triggers a new initialize POST with the new sessionId
      const secondPostUrl = fetchMock.mock.calls[1][0] as string;
      expect(secondPostUrl).toContain('session-2');
    });

    it('is safe to call when not connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });
});
