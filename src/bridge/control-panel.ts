/**
 * Floating Control Panel — Concept C: Drawer Overlay.
 *
 * Renders a draggable panel in the bottom-right corner of the M365 page with:
 *   - FA icon status indicator (sun=connected, moon=disconnected)
 *   - Horizontal automation toggle row (Insert / Submit / Run)
 *   - ToolsDrawer sub-component (collapsible tool list)
 *   - Inject Instructions button
 */

import type { Tool } from '../shared/protocol';
import { ToolsDrawer } from './tools-drawer';

const PANEL_ID = 'mcp-bookmarklet-panel';
const POSITION_KEY = 'mcp_panel_position';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PanelState {
  readonly connected: boolean;
  readonly toolCount: number;
  readonly autoInsert: boolean;
  readonly autoSubmit: boolean;
  readonly autoRun: boolean;
  readonly tools: readonly Tool[];
}

export interface PanelCallbacks {
  readonly onAutoInsertChange?: (enabled: boolean) => void;
  readonly onAutoSubmitChange?: (enabled: boolean) => void;
  readonly onAutoRunChange?: (enabled: boolean) => void;
  readonly onInjectInstructions?: (enabledTools: readonly Tool[]) => void;
  readonly onClose?: () => void;
}

interface PanelPosition {
  readonly right: number;
  readonly bottom: number;
}

// ── ControlPanel ──────────────────────────────────────────────────────────────

export class ControlPanel {
  private panel: HTMLElement | null = null;
  private statusIcon: HTMLElement | null = null;
  private toolCountEl: HTMLElement | null = null;
  private autoInsertToggle: HTMLInputElement | null = null;
  private autoSubmitToggle: HTMLInputElement | null = null;
  private autoRunToggle: HTMLInputElement | null = null;
  private injectCountText: Text | null = null;
  private state: PanelState;
  private readonly callbacks: PanelCallbacks;
  private readonly toolsDrawer: ToolsDrawer;

  constructor(initialState: PanelState, callbacks: PanelCallbacks = {}) {
    this.state = initialState;
    this.callbacks = callbacks;
    this.toolsDrawer = new ToolsDrawer({
      onEnabledCountChange: (count) => this.updateInjectCount(count),
    });
  }

  /** Create and append the panel to document.body. */
  mount(): void {
    if (document.getElementById(PANEL_ID)) return;

    this.panel = this.buildPanel();
    document.body.appendChild(this.panel);
    this.restorePosition();
    this.setupDrag();
  }

  /** Remove the panel from DOM. */
  destroy(): void {
    this.toolsDrawer.destroy();
    this.panel?.remove();
    this.panel = null;
    this.statusIcon = null;
    this.toolCountEl = null;
    this.autoInsertToggle = null;
    this.autoSubmitToggle = null;
    this.autoRunToggle = null;
    this.injectCountText = null;
  }

  /** Update the displayed state without rebuilding the panel. */
  update(newState: Partial<PanelState>): void {
    this.state = { ...this.state, ...newState };

    if (this.statusIcon) {
      this.statusIcon.className = this.state.connected
        ? 'fa-solid fa-sun mcp-status-dot connected'
        : 'fa-solid fa-moon mcp-status-dot disconnected';
    }

    if (this.autoInsertToggle) {
      this.autoInsertToggle.checked = this.state.autoInsert;
    }

    if (this.autoSubmitToggle) {
      this.autoSubmitToggle.checked = this.state.autoSubmit;
    }

    if (this.autoRunToggle) {
      this.autoRunToggle.checked = this.state.autoRun;
    }

    if (newState.toolCount !== undefined && this.toolCountEl) {
      this.toolCountEl.textContent = String(this.state.toolCount);
    }

    if (newState.tools !== undefined) {
      this.toolsDrawer.update(newState.tools);
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    panel.appendChild(this.buildHeader());
    panel.appendChild(this.buildAutomationRow());
    this.toolsDrawer.mount(panel);
    panel.appendChild(this.buildInjectButton());

    return panel;
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'panel-header';

    this.statusIcon = document.createElement('i');
    this.statusIcon.className = this.state.connected
      ? 'fa-solid fa-sun mcp-status-dot connected'
      : 'fa-solid fa-moon mcp-status-dot disconnected';

    const title = document.createElement('span');
    title.textContent = 'MCP Bookmarklet';

    this.toolCountEl = document.createElement('span');
    this.toolCountEl.className = 'panel-tool-count';
    this.toolCountEl.textContent = String(this.state.toolCount);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'panel-close-btn';
    closeBtn.setAttribute('aria-label', 'Close panel');
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fa-solid fa-xmark';
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener('click', () => {
      this.callbacks.onClose?.();
      this.destroy();
    });

    header.appendChild(this.statusIcon);
    header.appendChild(title);
    header.appendChild(this.toolCountEl);
    header.appendChild(closeBtn);

    return header;
  }

  private buildAutomationRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'panel-automation-row';

    // index 0 — Auto Insert
    row.appendChild(this.buildAutomationItem(
      'fa-arrow-right-to-bracket',
      'Auto Insert',
      this.state.autoInsert,
      (checked) => this.callbacks.onAutoInsertChange?.(checked),
      (input) => { this.autoInsertToggle = input; },
    ));

    // index 1 — Auto Submit
    row.appendChild(this.buildAutomationItem(
      'fa-paper-plane',
      'Auto Submit',
      this.state.autoSubmit,
      (checked) => this.callbacks.onAutoSubmitChange?.(checked),
      (input) => { this.autoSubmitToggle = input; },
    ));

    // index 2 — Auto Run
    row.appendChild(this.buildAutomationItem(
      'fa-bolt',
      'Auto Run',
      this.state.autoRun,
      (checked) => this.callbacks.onAutoRunChange?.(checked),
      (input) => { this.autoRunToggle = input; },
    ));

    return row;
  }

  private buildAutomationItem(
    iconClass: string,
    labelText: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    onInputCreated: (input: HTMLInputElement) => void,
  ): HTMLElement {
    const item = document.createElement('div');
    item.className = 'panel-automation-item';

    const icon = document.createElement('i');
    icon.className = `fa-solid ${iconClass} panel-automation-icon`;

    const label = document.createElement('span');
    label.textContent = labelText;

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'panel-toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    onInputCreated(input);

    const track = document.createElement('span');
    track.className = 'panel-toggle-track';

    toggleLabel.appendChild(input);
    toggleLabel.appendChild(track);

    item.appendChild(icon);
    item.appendChild(label);
    item.appendChild(toggleLabel);

    return item;
  }

  private buildInjectButton(): HTMLElement {
    const injectBtn = document.createElement('button');
    injectBtn.className = 'panel-inject';

    const injectIcon = document.createElement('i');
    injectIcon.className = 'fa-solid fa-file-lines';
    injectBtn.appendChild(injectIcon);

    // Initial count is 0; drawer fires onEnabledCountChange once tools load
    const initialCount = 0;
    this.injectCountText = document.createTextNode(
      ` Inject Instructions (${initialCount})`,
    );
    injectBtn.appendChild(this.injectCountText);

    injectBtn.addEventListener('click', () => {
      this.callbacks.onInjectInstructions?.(this.toolsDrawer.getEnabledTools());
    });

    return injectBtn;
  }

  private updateInjectCount(count: number): void {
    if (this.injectCountText) {
      this.injectCountText.textContent = ` Inject Instructions (${count})`;
    }
  }

  private setupDrag(): void {
    if (!this.panel) return;

    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;
    let dragging = false;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.panel!.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging || !this.panel) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newRight = Math.max(0, startRight - dx);
      const newBottom = Math.max(0, startBottom - dy);
      this.panel.style.right = `${newRight}px`;
      this.panel.style.bottom = `${newBottom}px`;
    };

    const onMouseUp = () => {
      if (!dragging || !this.panel) return;
      dragging = false;
      const right = parseInt(this.panel.style.right ?? '20', 10);
      const bottom = parseInt(this.panel.style.bottom ?? '20', 10);
      this.savePosition({ right, bottom });
    };

    this.panel.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private savePosition(pos: PanelPosition): void {
    try {
      sessionStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    } catch {
      // sessionStorage may be blocked in some environments
    }
  }

  private restorePosition(): void {
    if (!this.panel) return;
    try {
      const raw = sessionStorage.getItem(POSITION_KEY);
      if (!raw) return;
      const pos = JSON.parse(raw) as PanelPosition;
      if (typeof pos.right === 'number' && typeof pos.bottom === 'number') {
        this.panel.style.right = `${pos.right}px`;
        this.panel.style.bottom = `${pos.bottom}px`;
      }
    } catch {
      // Ignore
    }
  }
}
