/**
 * Bridge Entry Point.
 *
 * Orchestrates all bridge modules when the bookmarklet is activated on the M365 page.
 * Injected by: javascript:void(document.head.appendChild(Object.assign(
 *   document.createElement('script'),{src:'http://localhost:3007/bridge.js'}
 * )))
 */

import { CARD_STYLES, CONTROL_PANEL_STYLES } from './styles';
import { FA_INLINE_CSS } from './fa-inline';
import { IframeBridge } from './iframe-bridge';
import { ControlPanel } from './control-panel';
import { renderFunctionCard, updateCardResult, updateCardLoading } from './renderer';
import { insertText, submitForm, attachFile } from './m365-adapter';
import { findFunctionCallMatches } from './extractor';
import { buildInstructions } from './instructions';
import { loadSettings, saveSettings } from '../app/settings';
import { DEFAULT_STATIC_URL } from '../shared/protocol';

// ── Constants ─────────────────────────────────────────────────────────────────

const GUARD_FLAG = '__MCP_BOOKMARKLET_ACTIVE';
const STYLE_ID = 'mcp-bookmarklet-styles';
const FA_LINK_ID = 'mcp-fa-styles';
const VALID_HOSTNAMES = ['m365.cloud.microsoft'];

// ── Bootstrap ─────────────────────────────────────────────────────────────────

(function bootstrap() {
  // Guard against double-injection
  if ((window as any)[GUARD_FLAG]) {
    console.info('[MCP Bookmarklet] Already active, skipping re-injection');
    return;
  }
  (window as any)[GUARD_FLAG] = true;

  // Hostname check
  const hostname = window.location.hostname;
  const isValidHost =
    VALID_HOSTNAMES.some((h) => hostname === h || hostname.endsWith('.' + h)) ||
    hostname.includes('m365.cloud.microsoft');

  if (!isValidHost) {
    console.warn(`[MCP Bookmarklet] Unsupported hostname: ${hostname}. Expected M365 Copilot Chat.`);
    // Do not return — allow activation for local testing
  }

  // Load persisted settings
  const settings = loadSettings();

  // Inject styles
  injectStyles();
  injectFontAwesome();

  // Initialize iframe bridge
  // app.html is served from the static server (port 3007), not the MCP proxy (port 3006)
  const bridge = new IframeBridge(
    `${DEFAULT_STATIC_URL}/app.html`,
  );
  bridge.init();

  // Create control panel
  const panel = new ControlPanel(
    {
      connected: false,
      toolCount: 0,
      autoInsert: settings.autoInsert,
      autoSubmit: settings.autoSubmit,
      autoRun: settings.autoRun,
      tools: [],
    },
    {
      onAutoInsertChange: (enabled) => {
        saveSettings({ ...loadSettings(), autoInsert: enabled });
      },
      onAutoSubmitChange: (enabled) => {
        saveSettings({ ...loadSettings(), autoSubmit: enabled });
      },
      onAutoRunChange: (enabled) => {
        saveSettings({ ...loadSettings(), autoRun: enabled });
      },
      onReconnect: () => {
        panel.update({ connected: false });
        bridge.destroy();
        bridge.init();
        bridge
          .listTools()
          .then((tools) => panel.update({ tools, toolCount: tools.length }))
          .catch(() => panel.update({ connected: false }));
      },
      onInjectInstructions: (enabledTools) => {
        const text = buildInstructions([...enabledTools]);
        attachFile(new File([text], 'mcp-instructions.md', { type: 'text/markdown' }));
      },
    },
  );
  panel.mount();

  // Wire connection status to panel (fixes red dot not updating)
  bridge.onConnectionStatus = (connected) => {
    panel.update({ connected });
  };

  // Fetch tool list once connected
  bridge
    .listTools()
    .then((tools) => {
      panel.update({ tools, toolCount: tools.length });
    })
    .catch(() => {
      console.warn('[MCP Bookmarklet] Could not list tools — server may be offline');
    });

  // Start JSON extractor (MutationObserver)
  startExtractor(bridge);

  console.log('[MCP Bookmarklet] Activated on', hostname);
  const panelEl = document.getElementById('mcp-bookmarklet-panel');
  if (panelEl) {
    const r = panelEl.getBoundingClientRect();
    console.info(`[MCP Bookmarklet] Panel at bottom-right (${Math.round(r.left)},${Math.round(r.top)})px. If hidden, run: sessionStorage.removeItem('mcp_panel_position'); location.reload()`);
  }
})();

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CARD_STYLES + CONTROL_PANEL_STYLES;
  document.head.appendChild(style);
}

function injectFontAwesome(): void {
  if (document.getElementById(FA_LINK_ID)) return;
  const style = document.createElement('style');
  style.id = FA_LINK_ID;
  style.textContent = FA_INLINE_CSS;
  document.head.appendChild(style);
}

// ── Result formatting ─────────────────────────────────────────────────────────

function buildFunctionResult(callId: string, result: unknown): string {
  return `<function_result call_id="${callId}">\n${extractResultText(result)}\n</function_result>`;
}

// ── Extractor + Renderer ──────────────────────────────────────────────────────

function startExtractor(bridge: IframeBridge): void {
  const processed = new WeakSet<HTMLElement>();

  function processElement(el: HTMLElement): void {
    if (processed.has(el)) return;

    const text = el.textContent ?? '';
    if (!text.includes('"type"') || !text.includes('function_call')) return;

    const matches = findFunctionCallMatches(text);
    if (matches.length === 0) return;

    processed.add(el);

    for (const match of matches) {
      const card = renderFunctionCard(match.jsonContent, {
        onRun: async (name, args, callId) => {
          if (!card) return;
          const s = loadSettings();
          updateCardLoading(card, true);
          try {
            const result = await bridge.callTool(name, args);
            updateCardResult(card, result);

            if (s.autoInsert) {
              insertText(buildFunctionResult(callId, result));
              if (s.autoSubmit) {
                setTimeout(() => submitForm(), 100);
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateCardResult(card, null, msg);
          }
        },
        onInsert: (text, callId) => {
          const s = loadSettings();
          insertText(buildFunctionResult(callId, text));
          if (s.autoSubmit) {
            setTimeout(() => submitForm(), 100);
          }
        },
      });

      if (card) {
        el.parentNode?.insertBefore(card, el.nextSibling);

        // Auto-run if enabled
        if (loadSettings().autoRun) {
          setTimeout(() => {
            const runBtn = card.querySelector('.execute-button') as HTMLButtonElement | null;
            runBtn?.click();
          }, 200);
        }
      }
    }
  }

  // Initial scan
  const containers = document.querySelectorAll(
    'message-content, [data-testid="markdown-reply"]',
  );
  containers.forEach((el) => processElement(el as HTMLElement));

  // MutationObserver
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.type === 'childList' || m.type === 'characterData') {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      requestAnimationFrame(() => {
        const els = document.querySelectorAll(
          'message-content, [data-testid="markdown-reply"]',
        );
        els.forEach((el) => processElement(el as HTMLElement));
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener('beforeunload', () => observer.disconnect());
}

function extractResultText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.content)) {
      return (r.content as Array<{ type: string; text?: string }>)
        .filter((item) => item.type === 'text')
        .map((item) => item.text ?? '')
        .join('\n');
    }
  }
  return JSON.stringify(result, null, 2);
}
