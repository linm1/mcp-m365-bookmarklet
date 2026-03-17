/**
 * ToolsDrawer — expandable drawer sub-component for the control panel.
 *
 * Renders a collapsible section that lists MCP tools grouped by server,
 * with per-tool and per-server enable/disable toggles and a filter input.
 */

import type { Tool } from '../shared/protocol';
import {
  loadToolEnabledState,
  saveToolEnabledState,
  isToolEnabled,
  setToolEnabled,
} from './tool-state';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolsDrawerCallbacks {
  readonly onToolToggle?: (toolName: string, enabled: boolean) => void;
  readonly onEnabledCountChange?: (count: number) => void;
}

// Tool extended with optional serverName field emitted by the MCP bridge
type ToolWithServer = Tool & { readonly serverName?: string };

// ── ToolsDrawer ───────────────────────────────────────────────────────────────

export class ToolsDrawer {
  private headerEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private scrollEl: HTMLElement | null = null;
  private badgeEl: HTMLElement | null = null;
  private chevronEl: HTMLElement | null = null;
  private filterInput: HTMLInputElement | null = null;

  private tools: readonly ToolWithServer[] = [];
  private toolEnabledState: Record<string, boolean>;
  private filterText = '';
  private isOpen = false;

  private readonly callbacks: ToolsDrawerCallbacks;

  constructor(callbacks: ToolsDrawerCallbacks = {}) {
    this.callbacks = callbacks;
    this.toolEnabledState = loadToolEnabledState();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Appends drawer header + body into the given container element. */
  mount(container: HTMLElement): void {
    this.headerEl = this.buildHeader();
    this.bodyEl = this.buildBody();

    container.appendChild(this.headerEl);
    container.appendChild(this.bodyEl);
  }

  /**
   * Stores the tool list and re-renders the scroll area.
   * Safe to call before mount() — state is stored and applied on next render.
   */
  update(tools: readonly Tool[]): void {
    this.tools = tools as readonly ToolWithServer[];
    this.renderScrollContent();
    this.updateBadge();
  }

  /** Returns the subset of known tools that are currently enabled. */
  getEnabledTools(): readonly Tool[] {
    return this.tools.filter((t) => isToolEnabled(t.name, this.toolEnabledState));
  }

  /** Removes all mounted DOM elements from their parent. */
  destroy(): void {
    this.headerEl?.remove();
    this.bodyEl?.remove();
    this.headerEl = null;
    this.bodyEl = null;
    this.scrollEl = null;
    this.badgeEl = null;
    this.chevronEl = null;
    this.filterInput = null;
  }

  // ── Private — builders ─────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'panel-drawer-header';

    const iconList = document.createElement('i');
    iconList.className = 'fa-solid fa-screwdriver-wrench';

    const label = document.createElement('span');
    label.textContent = 'Tools';

    this.badgeEl = document.createElement('span');
    this.badgeEl.className = 'panel-drawer-badge';
    this.badgeEl.textContent = '0/0';

    this.chevronEl = document.createElement('i');
    this.chevronEl.className = 'fa-solid fa-chevron-down';

    header.appendChild(iconList);
    header.appendChild(label);
    header.appendChild(this.badgeEl);
    header.appendChild(this.chevronEl);

    header.addEventListener('click', () => this.toggleOpen());

    return header;
  }

  private buildBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'panel-drawer-body';

    this.scrollEl = document.createElement('div');
    this.scrollEl.className = 'panel-drawer-scroll';

    // Search bar
    const searchWrap = document.createElement('div');
    searchWrap.className = 'panel-drawer-search';

    const searchIcon = document.createElement('i');
    searchIcon.className = 'fa-solid fa-magnifying-glass';

    this.filterInput = document.createElement('input');
    this.filterInput.type = 'text';
    this.filterInput.placeholder = 'Filter...';
    this.filterInput.addEventListener('input', () => {
      this.filterText = this.filterInput?.value ?? '';
      this.applyFilter();
    });

    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(this.filterInput);

    this.scrollEl.appendChild(searchWrap);
    body.appendChild(this.scrollEl);

    return body;
  }

  // ── Private — rendering ────────────────────────────────────────────────────

  private renderScrollContent(): void {
    if (!this.scrollEl) return;

    // Remove all existing server/tool rows (keep the search bar as first child)
    const searchBar = this.scrollEl.firstChild;
    this.scrollEl.innerHTML = '';
    if (searchBar) {
      this.scrollEl.appendChild(searchBar);
    }

    // Group tools by serverName
    const groups = this.groupByServer(this.tools);

    for (const [serverName, serverTools] of groups) {
      const serverRow = this.buildServerRow(serverName, serverTools);
      this.scrollEl.appendChild(serverRow);

      for (const tool of serverTools) {
        const toolRow = this.buildToolRow(tool);
        this.scrollEl.appendChild(toolRow);
      }
    }

    this.applyFilter();
  }

  private buildServerRow(serverName: string, serverTools: readonly ToolWithServer[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'panel-server-row';

    const left = document.createElement('div');
    left.className = 'panel-server-name';

    const serverIcon = document.createElement('i');
    serverIcon.className = 'fa-solid fa-server';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = serverName;

    left.appendChild(serverIcon);
    left.appendChild(nameSpan);

    const allEnabled = serverTools.every((t) => isToolEnabled(t.name, this.toolEnabledState));

    const toggle = this.buildToggle(allEnabled, (checked) => {
      this.handleServerToggle(serverName, serverTools, checked);
    });

    row.appendChild(left);
    row.appendChild(toggle);

    return row;
  }

  private buildToolRow(tool: ToolWithServer): HTMLElement {
    const row = document.createElement('div');
    row.className = 'panel-tool-row';
    row.dataset.toolName = tool.name;

    const info = document.createElement('div');
    info.className = 'panel-tool-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'panel-tool-name';
    nameSpan.textContent = this.parseToolName(tool.name).short;

    info.appendChild(nameSpan);

    const enabled = isToolEnabled(tool.name, this.toolEnabledState);
    const toggle = this.buildToggle(enabled, (checked) => {
      this.handleToolToggle(tool.name, checked);
    });

    row.appendChild(info);
    row.appendChild(toggle);

    return row;
  }

  private buildToggle(checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const label = document.createElement('label');
    label.className = 'panel-toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));

    const track = document.createElement('span');
    track.className = 'panel-toggle-track';

    label.appendChild(input);
    label.appendChild(track);

    return label;
  }

  // ── Private — event handlers ───────────────────────────────────────────────

  private handleToolToggle(toolName: string, enabled: boolean): void {
    this.toolEnabledState = setToolEnabled(toolName, enabled, this.toolEnabledState);
    saveToolEnabledState(this.toolEnabledState);
    this.callbacks.onToolToggle?.(toolName, enabled);
    this.callbacks.onEnabledCountChange?.(this.getEnabledTools().length);
    this.updateBadge();
  }

  private handleServerToggle(
    _serverName: string,
    serverTools: readonly ToolWithServer[],
    enabled: boolean,
  ): void {
    let state = this.toolEnabledState;
    for (const tool of serverTools) {
      state = setToolEnabled(tool.name, enabled, state);
      this.callbacks.onToolToggle?.(tool.name, enabled);
    }
    this.toolEnabledState = state;
    saveToolEnabledState(this.toolEnabledState);
    this.callbacks.onEnabledCountChange?.(this.getEnabledTools().length);
    this.updateBadge();
  }

  // ── Private — utilities ────────────────────────────────────────────────────

  private toggleOpen(): void {
    this.isOpen = !this.isOpen;
    if (this.bodyEl) {
      if (this.isOpen) {
        this.bodyEl.classList.add('open');
      } else {
        this.bodyEl.classList.remove('open');
      }
    }
    if (this.chevronEl) {
      this.chevronEl.className = this.isOpen
        ? 'fa-solid fa-chevron-up'
        : 'fa-solid fa-chevron-down';
    }
  }

  private applyFilter(): void {
    if (!this.scrollEl) return;
    const filter = this.filterText.toLowerCase();
    const toolRows = this.scrollEl.querySelectorAll('.panel-tool-row');
    for (const row of Array.from(toolRows)) {
      const el = row as HTMLElement;
      const name = el.dataset.toolName ?? '';
      el.style.display = name.toLowerCase().includes(filter) ? '' : 'none';
    }
  }

  private updateBadge(): void {
    if (!this.badgeEl) return;
    const total = this.tools.length;
    const enabled = this.getEnabledTools().length;
    this.badgeEl.textContent = `${enabled}/${total}`;
  }

  private groupByServer(
    tools: readonly ToolWithServer[],
  ): Map<string, readonly ToolWithServer[]> {
    const map = new Map<string, ToolWithServer[]>();
    for (const tool of tools) {
      const key = tool.serverName ?? this.parseToolName(tool.name).server;
      const existing = map.get(key);
      if (existing) {
        map.set(key, [...existing, tool]);
      } else {
        map.set(key, [tool]);
      }
    }
    return map;
  }

  /**
   * Splits a dot-namespaced tool name into server and short-name parts.
   * "desktop-commander.read_file" → { server: "desktop-commander", short: "read_file" }
   * "bare_tool"                   → { server: "MCP Server",        short: "bare_tool" }
   */
  private parseToolName(name: string): { server: string; short: string } {
    const dot = name.indexOf('.');
    if (dot === -1) return { server: 'MCP Server', short: name };
    return { server: name.slice(0, dot), short: name.slice(dot + 1) };
  }
}
