/**
 * Tests for app.ts bootstrap and message routing.
 *
 * Key regression: mcp:ready must be sent to the parent even before any
 * inbound message has set parentOrigin (bootstrap case). Previously the
 * security hardening caused sendToParent to silently drop the mcp:ready
 * signal because parentOrigin was still null.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAppSetup(overrides?: { parentOrigin?: string }) {
  // Fake parent window that records postMessage calls
  const parentPostMessage = vi.fn();
  const parentWindow = { postMessage: parentPostMessage } as unknown as Window;

  // Stub window.parent
  Object.defineProperty(window, 'parent', {
    get: () => parentWindow,
    configurable: true,
  });

  // Fake EventSource (MCP client calls connect() which opens SSE)
  const esMock = {
    addEventListener: vi.fn(),
    close: vi.fn(),
    readyState: 1,
  };
  // EventSource must be a constructor (called with `new`)
  const EsMockCtor = vi.fn().mockImplementation(function () { return esMock; });
  global.EventSource = EsMockCtor as unknown as typeof EventSource;
  global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));

  // Record message listeners added to window so tests can fire inbound messages
  const messageListeners: Array<(e: MessageEvent) => void> = [];
  const origAddEventListener = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, ...rest) => {
    if (type === 'message') {
      messageListeners.push(handler as (e: MessageEvent) => void);
    }
    return origAddEventListener(type, handler as EventListenerOrEventListenerObject, ...rest);
  });

  function fireInbound(data: unknown, origin = overrides?.parentOrigin ?? 'https://localhost:3443') {
    const evt = new MessageEvent('message', { data, origin });
    for (const listener of messageListeners) listener(evt);
  }

  return { parentPostMessage, esMock, fireInbound };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('app.ts bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RED→GREEN: sends mcp:ready to parent immediately on load (before any inbound message sets parentOrigin)', async () => {
    const { parentPostMessage } = makeAppSetup();

    // Dynamically import to re-run module-level IIFE
    await import('./app');

    // mcp:ready must have been posted — even though no inbound message has arrived yet
    const calls = parentPostMessage.mock.calls as Array<[unknown, string]>;
    const readyCall = calls.find(([msg]) => (msg as { type?: string })?.type === 'mcp:ready');
    expect(readyCall).toBeDefined();
  });

  it('uses captured parentOrigin for subsequent messages after first inbound', async () => {
    const parentOrigin = 'https://localhost:3443';
    const { parentPostMessage, fireInbound } = makeAppSetup({ parentOrigin });

    await import('./app');

    // Fire a valid inbound message to capture parentOrigin
    fireInbound({ type: 'mcp:list-tools', requestId: 'r1' }, parentOrigin);

    // Any subsequent outbound call should target the captured origin, not '*'
    // The mcp:ready call (bootstrap) is allowed to use '*'
    const calls = parentPostMessage.mock.calls as Array<[unknown, string]>;
    const nonReady = calls.filter(([msg]) => (msg as { type?: string })?.type !== 'mcp:ready');
    for (const [, target] of nonReady) {
      expect(target).toBe(parentOrigin);
    }
  });

  it('ignores inbound messages from disallowed origins', async () => {
    const { parentPostMessage, fireInbound } = makeAppSetup();

    await import('./app');
    parentPostMessage.mockClear();

    // Should be silently ignored
    fireInbound({ type: 'mcp:list-tools', requestId: 'r2' }, 'https://evil.example.com');

    // No new messages sent in response
    expect(parentPostMessage).not.toHaveBeenCalled();
  });

  it('calls client.disconnect() when mcp:disconnect message is received', async () => {
    const { esMock, fireInbound } = makeAppSetup();

    await import('./app');

    // Fire a valid inbound message first to capture parentOrigin
    fireInbound({ type: 'mcp:list-tools', requestId: 'r-prime' });

    // Now fire the disconnect signal
    fireInbound({ type: 'mcp:disconnect' });

    expect(esMock.close).toHaveBeenCalledTimes(1);
  });
});
