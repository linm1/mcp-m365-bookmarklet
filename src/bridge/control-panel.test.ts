import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ControlPanel } from './control-panel';

function clearBody() {
  document.body.innerHTML = '';
}

describe('ControlPanel', () => {
  beforeEach(() => {
    clearBody();
    // Clear sessionStorage between tests
    sessionStorage.clear();
  });

  // ── mount ──────────────────────────────────────────────────────────────────

  describe('mount()', () => {
    it('appends the panel element to document.body', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });

      panel.mount();

      expect(document.getElementById('mcp-bookmarklet-panel')).not.toBeNull();
    });

    it('does not create duplicate panels on second mount() call', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });

      panel.mount();
      panel.mount();

      const panels = document.querySelectorAll('#mcp-bookmarklet-panel');
      expect(panels).toHaveLength(1);
    });

    it('shows "MCP Bookmarklet" title text', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      const el = document.getElementById('mcp-bookmarklet-panel');
      expect(el?.textContent).toContain('MCP Bookmarklet');
    });

    it('shows connected status dot with "connected" class when connected=true', () => {
      const panel = new ControlPanel({ connected: true, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      const dot = document.querySelector('.mcp-status-dot');
      expect(dot?.classList.contains('connected')).toBe(true);
    });

    it('shows disconnected status dot with "disconnected" class when connected=false', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      const dot = document.querySelector('.mcp-status-dot');
      expect(dot?.classList.contains('disconnected')).toBe(true);
    });

    it('shows correct tool count text', () => {
      const panel = new ControlPanel({ connected: true, toolCount: 5, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      const el = document.getElementById('mcp-bookmarklet-panel');
      expect(el?.textContent).toContain('5 tools');
    });

    it('shows singular "tool" for count of 1', () => {
      const panel = new ControlPanel({ connected: true, toolCount: 1, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      const el = document.getElementById('mcp-bookmarklet-panel');
      expect(el?.textContent).toContain('1 tool');
      expect(el?.textContent).not.toContain('1 tools');
    });

    it('sets auto-insert checkbox to checked when autoInsert=true', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: true, autoSubmit: false, autoRun: false });
      panel.mount();

      const inputs = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      const autoInsertInput = Array.from(inputs).find((_, i) => i === 0);
      expect(autoInsertInput?.checked).toBe(true);
    });

    it('sets auto-submit checkbox to checked when autoSubmit=true', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: true, autoRun: false });
      panel.mount();

      const inputs = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      const autoSubmitInput = Array.from(inputs).find((_, i) => i === 1);
      expect(autoSubmitInput?.checked).toBe(true);
    });

    it('renders a Reconnect button', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      const btn = document.querySelector('.panel-reconnect') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Reconnect');
    });
  });

  // ── destroy ────────────────────────────────────────────────────────────────

  describe('destroy()', () => {
    it('removes the panel from DOM', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();
      panel.destroy();

      expect(document.getElementById('mcp-bookmarklet-panel')).toBeNull();
    });

    it('is safe to call when panel was never mounted', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });

      expect(() => panel.destroy()).not.toThrow();
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates status dot when connected changes to true', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      panel.update({ connected: true });

      const dot = document.querySelector('.mcp-status-dot');
      expect(dot?.classList.contains('connected')).toBe(true);
    });

    it('updates status dot when connected changes to false', () => {
      const panel = new ControlPanel({ connected: true, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      panel.update({ connected: false });

      const dot = document.querySelector('.mcp-status-dot');
      expect(dot?.classList.contains('disconnected')).toBe(true);
    });

    it('updates tool count text', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      panel.update({ toolCount: 7 });

      const el = document.getElementById('mcp-bookmarklet-panel');
      expect(el?.textContent).toContain('7 tools');
    });

    it('updates auto-insert checkbox', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      panel.update({ autoInsert: true });

      const inputs = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[0].checked).toBe(true);
    });

    it('updates auto-submit checkbox', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });
      panel.mount();

      panel.update({ autoSubmit: true });

      const inputs = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      expect(inputs[1].checked).toBe(true);
    });

    it('is safe to call update() before mount()', () => {
      const panel = new ControlPanel({ connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false });

      expect(() => panel.update({ connected: true })).not.toThrow();
    });
  });

  // ── callbacks ──────────────────────────────────────────────────────────────

  describe('callbacks', () => {
    it('fires onAutoInsertChange when auto-insert toggle is changed', () => {
      const onAutoInsertChange = vi.fn();
      const panel = new ControlPanel(
        { connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false },
        { onAutoInsertChange },
      );
      panel.mount();

      const inputs = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      inputs[0].checked = true;
      inputs[0].dispatchEvent(new Event('change'));

      expect(onAutoInsertChange).toHaveBeenCalledWith(true);
    });

    it('fires onAutoSubmitChange when auto-submit toggle is changed', () => {
      const onAutoSubmitChange = vi.fn();
      const panel = new ControlPanel(
        { connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false },
        { onAutoSubmitChange },
      );
      panel.mount();

      const inputs = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      inputs[1].checked = true;
      inputs[1].dispatchEvent(new Event('change'));

      expect(onAutoSubmitChange).toHaveBeenCalledWith(true);
    });

    it('fires onReconnect when Reconnect button is clicked', () => {
      const onReconnect = vi.fn();
      const panel = new ControlPanel(
        { connected: false, toolCount: 0, autoInsert: false, autoSubmit: false, autoRun: false },
        { onReconnect },
      );
      panel.mount();

      const btn = document.querySelector('.panel-reconnect') as HTMLButtonElement;
      btn.click();

      expect(onReconnect).toHaveBeenCalledTimes(1);
    });
  });
});
