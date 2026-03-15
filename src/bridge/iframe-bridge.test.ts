import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IframeBridge } from './iframe-bridge';

// ── Helpers ───────────────────────────────────────────────────────────────────

const IFRAME_ORIGIN = 'http://localhost:3007';

function flushPromises() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IframeBridge', () => {
  let bridge: IframeBridge;

  beforeEach(() => {
    document.body.innerHTML = '';
    bridge = new IframeBridge('http://localhost:3007/app.html');
  });

  afterEach(() => {
    bridge.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── init ───────────────────────────────────────────────────────────────────

  describe('init()', () => {
    it('creates a hidden iframe appended to document.body', () => {
      bridge.init();

      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.src).toContain('app.html');
    });

    it('sets iframe to hidden / display:none', () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      expect(iframe.style.display).toBe('none');
    });

    it('does not create duplicate iframes on second init() call', () => {
      bridge.init();
      bridge.init();

      const iframes = document.querySelectorAll('iframe');
      expect(iframes).toHaveLength(1);
    });
  });

  // ── destroy ────────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    it('removes the iframe from DOM', () => {
      bridge.init();
      bridge.destroy();

      const iframe = document.querySelector('iframe');
      expect(iframe).toBeNull();
    });

    it('is safe to call when not initialized', () => {
      expect(() => bridge.destroy()).not.toThrow();
    });
  });

  // ── callTool ───────────────────────────────────────────────────────────────

  describe('callTool()', () => {
    it('sends mcp:call-tool postMessage to iframe contentWindow', async () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        configurable: true,
      });

      // Trigger ready so callTool can proceed
      bridge['onIframeReady']();

      const callPromise = bridge.callTool('read_file', { path: '/tmp/test.txt' });

      await flushPromises();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mcp:call-tool',
          name: 'read_file',
          args: { path: '/tmp/test.txt' },
          requestId: expect.any(String),
        }),
        IFRAME_ORIGIN,
      );

      // Simulate response
      const requestId = postMessageSpy.mock.calls[0][0].requestId;
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tool-result', requestId, result: { content: [{ type: 'text', text: 'ok' }] } },
          origin: IFRAME_ORIGIN,
        }),
      );

      const result = await callPromise;
      expect(result).toMatchObject({ content: [{ type: 'text', text: 'ok' }] });
    });

    it('rejects with error when iframe returns mcp:tool-result with error field', async () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        configurable: true,
      });

      bridge['onIframeReady']();

      const callPromise = bridge.callTool('bad_tool', {});

      await flushPromises();

      const requestId = postMessageSpy.mock.calls[0][0].requestId;
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tool-result', requestId, error: 'Tool not found' },
          origin: IFRAME_ORIGIN,
        }),
      );

      await expect(callPromise).rejects.toThrow('Tool not found');
    });

    it('rejects with timeout after TIMEOUT_MS with no response', async () => {
      vi.useFakeTimers();

      bridge = new IframeBridge('http://localhost:3007/app.html', { timeoutMs: 100 });
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: vi.fn() },
        configurable: true,
      });

      bridge['onIframeReady']();

      const callPromise = bridge.callTool('slow_tool', {});

      vi.advanceTimersByTime(200);

      await expect(callPromise).rejects.toThrow(/timeout/i);
    });

    it('correlates responses by requestId (multiple concurrent requests)', async () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        configurable: true,
      });

      bridge['onIframeReady']();

      const promise1 = bridge.callTool('tool_a', {});
      const promise2 = bridge.callTool('tool_b', {});

      await flushPromises();

      const id1 = postMessageSpy.mock.calls[0][0].requestId;
      const id2 = postMessageSpy.mock.calls[1][0].requestId;
      expect(id1).not.toBe(id2);

      // Respond in reverse order
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tool-result', requestId: id2, result: { answer: 'b' } },
          origin: IFRAME_ORIGIN,
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tool-result', requestId: id1, result: { answer: 'a' } },
          origin: IFRAME_ORIGIN,
        }),
      );

      const [r1, r2] = await Promise.all([promise1, promise2]);
      expect((r1 as any).answer).toBe('a');
      expect((r2 as any).answer).toBe('b');
    });

    it('ignores messages from untrusted origins', async () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        configurable: true,
      });

      bridge['onIframeReady']();

      const callPromise = bridge.callTool('tool', {});

      await flushPromises();

      const requestId = postMessageSpy.mock.calls[0][0].requestId;

      // Message from untrusted origin — must be ignored
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tool-result', requestId, result: 'injected' },
          origin: 'https://evil.example.com',
        }),
      );

      // Resolve legitimately
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tool-result', requestId, result: 'legitimate' },
          origin: IFRAME_ORIGIN,
        }),
      );

      const result = await callPromise;
      expect(result).toBe('legitimate');
    });
  });

  // ── listTools ──────────────────────────────────────────────────────────────

  describe('listTools()', () => {
    it('sends mcp:list-tools postMessage and resolves with tools array', async () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        configurable: true,
      });

      bridge['onIframeReady']();

      const listPromise = bridge.listTools();

      await flushPromises();

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mcp:list-tools' }),
        IFRAME_ORIGIN,
      );

      const requestId = postMessageSpy.mock.calls[0][0].requestId;
      const tools = [{ name: 'read_file' }];

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tools-list', requestId, tools },
          origin: IFRAME_ORIGIN,
        }),
      );

      const result = await listPromise;
      expect(result).toEqual(tools);
    });
  });

  // ── connection status ──────────────────────────────────────────────────────

  describe('connection status', () => {
    it('stores connection status from mcp:connection-status messages', async () => {
      bridge.init();

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:connection-status', connected: true, serverUrl: 'http://localhost:3006' },
          origin: IFRAME_ORIGIN,
        }),
      );

      await flushPromises();

      expect(bridge.getConnectionStatus()).toEqual({
        connected: true,
        serverUrl: 'http://localhost:3006',
      });
    });

    it('defaults to disconnected before any status message', () => {
      bridge.init();

      expect(bridge.getConnectionStatus().connected).toBe(false);
    });

    // BUG 3: onConnectionStatus callback must fire when status changes
    it('calls onConnectionStatus callback when connected', async () => {
      bridge.init();

      const statusCallback = vi.fn();
      bridge.onConnectionStatus = statusCallback;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:connection-status', connected: true, serverUrl: 'http://localhost:3006' },
          origin: IFRAME_ORIGIN,
        }),
      );

      await flushPromises();

      expect(statusCallback).toHaveBeenCalledWith(true, 'http://localhost:3006');
    });

    it('calls onConnectionStatus callback when disconnected', async () => {
      bridge.init();

      const statusCallback = vi.fn();
      bridge.onConnectionStatus = statusCallback;

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:connection-status', connected: false, serverUrl: 'http://localhost:3006' },
          origin: IFRAME_ORIGIN,
        }),
      );

      await flushPromises();

      expect(statusCallback).toHaveBeenCalledWith(false, 'http://localhost:3006');
    });
  });

  // ── ready queue (race condition fix) ───────────────────────────────────────

  describe('ready queue (race condition)', () => {
    // BUG 1: requests made before mcp:ready should be queued and sent after ready
    it('queues listTools call made before mcp:ready and sends after ready', async () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        configurable: true,
      });

      // Call before ready — must NOT send immediately
      const listPromise = bridge.listTools();
      await flushPromises();
      expect(postMessageSpy).not.toHaveBeenCalled();

      // Signal ready — should flush the queued message
      bridge['onIframeReady']();
      await flushPromises();
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mcp:list-tools' }),
        IFRAME_ORIGIN,
      );

      // Respond to complete the promise
      const requestId = postMessageSpy.mock.calls[0][0].requestId;
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tools-list', requestId, tools: [{ name: 'test_tool' }] },
          origin: IFRAME_ORIGIN,
        }),
      );

      const result = await listPromise;
      expect(result).toEqual([{ name: 'test_tool' }]);
    });

    it('queues callTool call made before mcp:ready and sends after ready', async () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        configurable: true,
      });

      // Call before ready — must NOT send immediately
      const callPromise = bridge.callTool('my_tool', { x: 1 });
      await flushPromises();
      expect(postMessageSpy).not.toHaveBeenCalled();

      // Signal ready — flushes queue
      bridge['onIframeReady']();
      await flushPromises();
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mcp:call-tool', name: 'my_tool' }),
        IFRAME_ORIGIN,
      );

      const requestId = postMessageSpy.mock.calls[0][0].requestId;
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'mcp:tool-result', requestId, result: { ok: true } },
          origin: IFRAME_ORIGIN,
        }),
      );

      const result = await callPromise;
      expect(result).toMatchObject({ ok: true });
    });

    it('sends immediately when already ready', async () => {
      bridge.init();

      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const postMessageSpy = vi.fn();
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: postMessageSpy },
        configurable: true,
      });

      bridge['onIframeReady']();

      bridge.listTools();
      await flushPromises();

      // Should have sent without waiting
      expect(postMessageSpy).toHaveBeenCalled();
    });
  });
});
