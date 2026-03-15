/**
 * Floating Control Panel.
 *
 * Renders a draggable panel in the bottom-right corner of the M365 page
 * with connection status, auto-insert/submit toggles, tool count badge,
 * and a Reconnect button.
 */

const PANEL_ID = 'mcp-bookmarklet-panel';
const POSITION_KEY = 'mcp_panel_position';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PanelState {
  readonly connected: boolean;
  readonly toolCount: number;
  readonly autoInsert: boolean;
  readonly autoSubmit: boolean;
  readonly autoRun: boolean;
}

export interface PanelCallbacks {
  readonly onAutoInsertChange?: (enabled: boolean) => void;
  readonly onAutoSubmitChange?: (enabled: boolean) => void;
  readonly onAutoRunChange?: (enabled: boolean) => void;
  readonly onReconnect?: () => void;
  readonly onInjectInstructions?: () => void;
}

interface PanelPosition {
  readonly right: number;
  readonly bottom: number;
}

// ── ControlPanel ──────────────────────────────────────────────────────────────

export class ControlPanel {
  private panel: HTMLElement | null = null;
  private statusDot: HTMLElement | null = null;
  private toolCountEl: HTMLElement | null = null;
  private autoInsertToggle: HTMLInputElement | null = null;
  private autoSubmitToggle: HTMLInputElement | null = null;
  private autoRunToggle: HTMLInputElement | null = null;
  private state: PanelState;
  private readonly callbacks: PanelCallbacks;

  constructor(initialState: PanelState, callbacks: PanelCallbacks = {}) {
    this.state = initialState;
    this.callbacks = callbacks;
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
    this.panel?.remove();
    this.panel = null;
    this.statusDot = null;
    this.toolCountEl = null;
    this.autoInsertToggle = null;
    this.autoSubmitToggle = null;
    this.autoRunToggle = null;
  }

  /** Update the displayed state without rebuilding the panel. */
  update(newState: Partial<PanelState>): void {
    this.state = { ...this.state, ...newState };

    if (this.statusDot) {
      this.statusDot.className =
        'mcp-status-dot ' + (this.state.connected ? 'connected' : 'disconnected');
    }

    if (this.toolCountEl) {
      this.toolCountEl.textContent = `${this.state.toolCount} tool${this.state.toolCount !== 1 ? 's' : ''} available`;
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
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';

    this.statusDot = document.createElement('span');
    this.statusDot.className =
      'mcp-status-dot ' + (this.state.connected ? 'connected' : 'disconnected');

    const title = document.createElement('span');
    title.textContent = 'MCP Bookmarklet';

    header.appendChild(this.statusDot);
    header.appendChild(title);
    panel.appendChild(header);

    // Auto-insert toggle
    panel.appendChild(
      this.buildToggleRow('Auto Insert', this.state.autoInsert, (checked) => {
        this.autoInsertToggle = checked ? (this.autoInsertToggle ?? null) : null;
        this.callbacks.onAutoInsertChange?.(checked);
      }, (input) => { this.autoInsertToggle = input; }),
    );

    // Auto-submit toggle
    panel.appendChild(
      this.buildToggleRow('Auto Submit', this.state.autoSubmit, (checked) => {
        this.callbacks.onAutoSubmitChange?.(checked);
      }, (input) => { this.autoSubmitToggle = input; }),
    );

    // Auto-run toggle
    panel.appendChild(
      this.buildToggleRow('Auto Run', this.state.autoRun, (checked) => {
        this.callbacks.onAutoRunChange?.(checked);
      }, (input) => { this.autoRunToggle = input; }),
    );

    // Inject Instructions button
    const injectBtn = document.createElement('button');
    injectBtn.className = 'panel-inject';
    injectBtn.textContent = '📋 Inject Instructions';
    injectBtn.addEventListener('click', () => this.callbacks.onInjectInstructions?.());
    panel.appendChild(injectBtn);

    // Tool count
    this.toolCountEl = document.createElement('div');
    this.toolCountEl.className = 'panel-tool-count';
    this.toolCountEl.textContent =
      `${this.state.toolCount} tool${this.state.toolCount !== 1 ? 's' : ''} available`;
    panel.appendChild(this.toolCountEl);

    // Reconnect button
    const reconnectBtn = document.createElement('button');
    reconnectBtn.className = 'panel-reconnect';
    reconnectBtn.textContent = 'Reconnect';
    reconnectBtn.addEventListener('click', () => this.callbacks.onReconnect?.());
    panel.appendChild(reconnectBtn);

    return panel;
  }

  private buildToggleRow(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    onInputCreated?: (input: HTMLInputElement) => void,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'panel-row';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const toggle = document.createElement('label');
    toggle.className = 'panel-toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    onInputCreated?.(input);

    const track = document.createElement('span');
    track.className = 'panel-toggle-track';

    toggle.appendChild(input);
    toggle.appendChild(track);

    row.appendChild(labelEl);
    row.appendChild(toggle);

    return row;
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
