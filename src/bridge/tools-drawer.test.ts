/**
 * Tests for ToolsDrawer — written FIRST per TDD (RED phase).
 * All tests should fail with "cannot find module" before implementation exists.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tool } from '../shared/protocol';

// Mock tool-state so tests are isolated from localStorage implementation
vi.mock('./tool-state', () => ({
  loadToolEnabledState: () => ({}),
  saveToolEnabledState: vi.fn(),
  isToolEnabled: (_n: string, _s: Record<string, boolean>) => true,
  setToolEnabled: (n: string, v: boolean, s: Record<string, boolean>) => ({ ...s, [n]: v }),
}));

import { ToolsDrawer } from './tools-drawer';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTool(name: string, serverName?: string, description?: string): Tool {
  return { name, description, inputSchema: { type: 'object' } } as Tool & { serverName?: string };
}

function makeToolWithServer(name: string, serverName: string, description?: string): Tool & { serverName: string } {
  return { name, description: description ?? '', serverName, inputSchema: { type: 'object' } } as unknown as Tool & { serverName: string };
}

const TOOL_MAIL = makeToolWithServer('send-mail', 'Exchange', 'Sends an email');
const TOOL_CALENDAR = makeToolWithServer('create-event', 'Exchange', 'Creates a calendar event');
const TOOL_FILES = makeToolWithServer('upload-file', 'SharePoint', 'Uploads a file');

function makeContainer(): HTMLElement {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHeader(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.panel-drawer-header');
}

function getBody(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.panel-drawer-body');
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  vi.clearAllMocks();
});

// ── mount() ───────────────────────────────────────────────────────────────────

describe('mount()', () => {
  it('appends .panel-drawer-header to the container', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();

    drawer.mount(container);

    expect(getHeader(container)).not.toBeNull();
  });

  it('appends .panel-drawer-body to the container', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();

    drawer.mount(container);

    expect(getBody(container)).not.toBeNull();
  });

  it('drawer body does NOT have "open" class by default (closed state)', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();

    drawer.mount(container);

    expect(getBody(container)?.classList.contains('open')).toBe(false);
  });

  it('header contains a "Tools" label span', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();

    drawer.mount(container);

    const header = getHeader(container)!;
    expect(header.textContent).toContain('Tools');
  });

  it('header contains a badge span with class panel-drawer-badge', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();

    drawer.mount(container);

    expect(container.querySelector('.panel-drawer-badge')).not.toBeNull();
  });
});

// ── toggle open/close ─────────────────────────────────────────────────────────

describe('header click — open/close toggle', () => {
  it('clicking header adds "open" class to body', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    getHeader(container)!.click();

    expect(getBody(container)?.classList.contains('open')).toBe(true);
  });

  it('clicking header a second time removes "open" class from body', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    getHeader(container)!.click();
    getHeader(container)!.click();

    expect(getBody(container)?.classList.contains('open')).toBe(false);
  });
});

// ── update() with no tools ────────────────────────────────────────────────────

describe('update([]) — empty tool list', () => {
  it('renders no .panel-tool-row elements', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([]);

    expect(container.querySelectorAll('.panel-tool-row')).toHaveLength(0);
  });

  it('renders no .panel-server-row elements', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([]);

    expect(container.querySelectorAll('.panel-server-row')).toHaveLength(0);
  });
});

// ── update() with tools ───────────────────────────────────────────────────────

describe('update(tools) — rendering', () => {
  it('renders one .panel-server-row per unique serverName', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([TOOL_MAIL, TOOL_CALENDAR, TOOL_FILES]);

    // Exchange + SharePoint = 2 unique server names
    expect(container.querySelectorAll('.panel-server-row')).toHaveLength(2);
  });

  it('renders one .panel-tool-row per tool', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([TOOL_MAIL, TOOL_CALENDAR, TOOL_FILES]);

    expect(container.querySelectorAll('.panel-tool-row')).toHaveLength(3);
  });

  it('sets data-tool-name attribute on each .panel-tool-row', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([TOOL_MAIL]);

    const row = container.querySelector('.panel-tool-row') as HTMLElement;
    expect(row.dataset.toolName).toBe('send-mail');
  });

  it('renders tool name inside .panel-tool-name span', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([TOOL_MAIL]);

    const nameEl = container.querySelector('.panel-tool-name');
    expect(nameEl?.textContent).toBe('send-mail');
  });

  it('renders tool description inside .panel-tool-desc span', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([TOOL_MAIL]);

    const descEl = container.querySelector('.panel-tool-desc');
    expect(descEl?.textContent).toBe('Sends an email');
  });

  it('renders empty description when tool has no description', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    const tool = makeToolWithServer('bare-tool', 'TestServer');
    drawer.update([tool]);

    const descEl = container.querySelector('.panel-tool-desc');
    expect(descEl?.textContent).toBe('');
  });

  it('falls back to "MCP Server" as server name when tool has no serverName', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    const tool = makeTool('bare-tool');
    drawer.update([tool]);

    const serverRow = container.querySelector('.panel-server-row');
    expect(serverRow?.textContent).toContain('MCP Server');
  });

  it('re-renders on second update() call', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([TOOL_MAIL]);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR]);

    expect(container.querySelectorAll('.panel-tool-row')).toHaveLength(2);
  });

  it('each tool row contains a toggle checkbox', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([TOOL_MAIL]);

    const row = container.querySelector('.panel-tool-row')!;
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
  });

  it('badge shows N/N format after update', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    drawer.update([TOOL_MAIL, TOOL_CALENDAR]);

    const badge = container.querySelector('.panel-drawer-badge');
    expect(badge?.textContent).toMatch(/\d+\/\d+/);
  });
});

// ── filter ────────────────────────────────────────────────────────────────────

describe('filter input', () => {
  it('shows all tools when filter is empty', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR, TOOL_FILES]);

    // Drawer must be opened so rows are visible in the scroll area
    getHeader(container)!.click();

    const filterInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    filterInput.value = '';
    filterInput.dispatchEvent(new Event('input'));

    const visible = Array.from(container.querySelectorAll('.panel-tool-row')).filter(
      (el) => (el as HTMLElement).style.display !== 'none',
    );
    expect(visible).toHaveLength(3);
  });

  it('filters to only tools whose name contains the filter string (case-insensitive)', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR, TOOL_FILES]);

    getHeader(container)!.click();

    const filterInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    filterInput.value = 'mail';
    filterInput.dispatchEvent(new Event('input'));

    const visible = Array.from(container.querySelectorAll('.panel-tool-row')).filter(
      (el) => (el as HTMLElement).style.display !== 'none',
    );
    expect(visible).toHaveLength(1);
    expect((visible[0] as HTMLElement).dataset.toolName).toBe('send-mail');
  });

  it('filter is case-insensitive', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR]);

    getHeader(container)!.click();

    const filterInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    filterInput.value = 'MAIL';
    filterInput.dispatchEvent(new Event('input'));

    const visible = Array.from(container.querySelectorAll('.panel-tool-row')).filter(
      (el) => (el as HTMLElement).style.display !== 'none',
    );
    expect(visible).toHaveLength(1);
  });

  it('hides all tool rows when filter matches nothing', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR]);

    getHeader(container)!.click();

    const filterInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    filterInput.value = 'zzznomatch';
    filterInput.dispatchEvent(new Event('input'));

    const visible = Array.from(container.querySelectorAll('.panel-tool-row')).filter(
      (el) => (el as HTMLElement).style.display !== 'none',
    );
    expect(visible).toHaveLength(0);
  });
});

// ── per-tool toggle ───────────────────────────────────────────────────────────

describe('per-tool toggle', () => {
  it('fires onToolToggle with (toolName, true) when checkbox is checked', () => {
    const onToolToggle = vi.fn();
    const drawer = new ToolsDrawer({ onToolToggle });
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL]);

    const row = container.querySelector('[data-tool-name="send-mail"]')!;
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(onToolToggle).toHaveBeenCalledWith('send-mail', true);
  });

  it('fires onToolToggle with (toolName, false) when checkbox is unchecked', () => {
    const onToolToggle = vi.fn();
    const drawer = new ToolsDrawer({ onToolToggle });
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL]);

    const row = container.querySelector('[data-tool-name="send-mail"]')!;
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(onToolToggle).toHaveBeenCalledWith('send-mail', false);
  });

  it('fires onEnabledCountChange after a per-tool toggle', () => {
    const onEnabledCountChange = vi.fn();
    const drawer = new ToolsDrawer({ onEnabledCountChange });
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR]);

    const row = container.querySelector('[data-tool-name="send-mail"]')!;
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    expect(onEnabledCountChange).toHaveBeenCalled();
  });

  it('fires onEnabledCountChange with correct count (all enabled by mock)', () => {
    const onEnabledCountChange = vi.fn();
    const drawer = new ToolsDrawer({ onEnabledCountChange });
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR]);

    const row = container.querySelector('[data-tool-name="send-mail"]')!;
    const checkbox = row.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    // With the mock returning true for isToolEnabled, both tools are enabled
    expect(onEnabledCountChange).toHaveBeenCalledWith(2);
  });
});

// ── server-level toggle ───────────────────────────────────────────────────────

describe('server toggle', () => {
  it('server toggle checkbox exists for each server row', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_FILES]);

    const serverRows = container.querySelectorAll('.panel-server-row');
    for (const row of Array.from(serverRows)) {
      const checkbox = row.querySelector('input[type="checkbox"]');
      expect(checkbox).not.toBeNull();
    }
  });

  it('toggling server checkbox fires onToolToggle for each tool in that server', () => {
    const onToolToggle = vi.fn();
    const drawer = new ToolsDrawer({ onToolToggle });
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR, TOOL_FILES]);

    // TOOL_MAIL and TOOL_CALENDAR both belong to "Exchange"
    // Find the server row for "Exchange" and get its checkbox
    const serverRows = Array.from(container.querySelectorAll('.panel-server-row'));
    const exchangeRow = serverRows.find((r) => r.textContent?.includes('Exchange'))!;
    const serverCheckbox = exchangeRow.querySelector('input[type="checkbox"]') as HTMLInputElement;

    serverCheckbox.checked = false;
    serverCheckbox.dispatchEvent(new Event('change'));

    // Should fire for both Exchange tools
    expect(onToolToggle).toHaveBeenCalledWith('send-mail', false);
    expect(onToolToggle).toHaveBeenCalledWith('create-event', false);
    expect(onToolToggle).toHaveBeenCalledTimes(2);
  });

  it('toggling server checkbox fires onEnabledCountChange', () => {
    const onEnabledCountChange = vi.fn();
    const drawer = new ToolsDrawer({ onEnabledCountChange });
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR]);

    const serverRow = container.querySelector('.panel-server-row')!;
    const serverCheckbox = serverRow.querySelector('input[type="checkbox"]') as HTMLInputElement;

    serverCheckbox.checked = false;
    serverCheckbox.dispatchEvent(new Event('change'));

    expect(onEnabledCountChange).toHaveBeenCalled();
  });
});

// ── getEnabledTools() ─────────────────────────────────────────────────────────

describe('getEnabledTools()', () => {
  it('returns all tools when none are explicitly disabled (default-on by mock)', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL, TOOL_CALENDAR, TOOL_FILES]);

    const enabled = drawer.getEnabledTools();

    expect(enabled).toHaveLength(3);
  });

  it('returns empty array before update() is called', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    const enabled = drawer.getEnabledTools();

    expect(enabled).toHaveLength(0);
  });

  it('returns readonly array (does not throw on access)', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.update([TOOL_MAIL]);

    const enabled = drawer.getEnabledTools();

    expect(Array.isArray(enabled)).toBe(true);
  });
});

// ── destroy() ─────────────────────────────────────────────────────────────────

describe('destroy()', () => {
  it('removes .panel-drawer-header from the container', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.destroy();

    expect(getHeader(container)).toBeNull();
  });

  it('removes .panel-drawer-body from the container', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.destroy();

    expect(getBody(container)).toBeNull();
  });

  it('is safe to call destroy() when never mounted', () => {
    const drawer = new ToolsDrawer();

    expect(() => drawer.destroy()).not.toThrow();
  });

  it('is safe to call destroy() twice', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);
    drawer.destroy();

    expect(() => drawer.destroy()).not.toThrow();
  });
});

// ── edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('update() before mount() does not throw', () => {
    const drawer = new ToolsDrawer();

    expect(() => drawer.update([TOOL_MAIL])).not.toThrow();
  });

  it('handles tools with identical names gracefully (renders both)', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    const dup1 = makeToolWithServer('duplicate', 'Server');
    const dup2 = makeToolWithServer('duplicate', 'Server');
    drawer.update([dup1, dup2]);

    expect(container.querySelectorAll('.panel-tool-row')).toHaveLength(2);
  });

  it('handles tools with special characters in name', () => {
    const drawer = new ToolsDrawer();
    const container = makeContainer();
    drawer.mount(container);

    const tool = makeToolWithServer('tool/with:special<chars>', 'Server');
    drawer.update([tool]);

    const row = container.querySelector('.panel-tool-row') as HTMLElement;
    expect(row.dataset.toolName).toBe('tool/with:special<chars>');
  });

  it('constructor accepts empty callbacks object', () => {
    expect(() => new ToolsDrawer({})).not.toThrow();
  });

  it('constructor works with no arguments', () => {
    expect(() => new ToolsDrawer()).not.toThrow();
  });
});
