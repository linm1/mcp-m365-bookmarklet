/**
 * CSS strings for tool cards and the control panel.
 * Injected once into document.head as a <style> element.
 */

export const CARD_STYLES = `
/* ── Function Block Card ─────────────────────────────────────────────────── */
.function-block {
  margin: 16px 0;
  padding: 0;
  border-radius: 10px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #ffffff;
  color: #202124;
  box-shadow: 0 3px 12px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.06);
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

.function-block.function-loading {
  border-left: 3px solid rgba(26,115,232,0.5);
}

.function-name {
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  color: #1a73e8;
  background-color: rgba(26,115,232,0.05);
  border-bottom: 1px solid rgba(26,115,232,0.15);
  cursor: pointer;
}

.function-name-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.function-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-id {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.7;
  background: rgba(26,115,232,0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  flex-shrink: 0;
}

.expandable-content {
  padding: 12px 14px;
}

.function-description {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: #5f6368;
}

.param-name {
  font-weight: 500;
  font-size: 13px;
  color: #202124;
  margin-top: 10px;
  margin-bottom: 4px;
}

.param-value {
  background: #f5f7f9;
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 6px;
  padding: 8px 10px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  color: #202124;
}

.function-buttons {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.01);
}

.execute-button,
.insert-result-button {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  background: #1a73e8;
  color: white;
  transition: background 0.15s ease;
}

.execute-button:hover,
.insert-result-button:hover {
  background: #1967d2;
}

.execute-button:active,
.insert-result-button:active {
  transform: translateY(1px);
}

.mcp-function-results-panel {
  margin: 0;
  padding: 12px 14px;
  border-top: 1px solid rgba(0,0,0,0.06);
  background: #f8f9fa;
}

.function-result-text {
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #202124;
  max-height: 300px;
  overflow-y: auto;
}

.function-result-error {
  color: #ea4335;
  font-size: 13px;
  padding: 4px 0;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(26,115,232,0.3);
  border-top: 2px solid #1a73e8;
  border-radius: 50%;
  animation: mcp-spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes mcp-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ── Dark mode ───────────────────────────────────────────────────────────── */
@media (prefers-color-scheme: dark) {
  .function-block {
    background: #1e1e1e;
    color: #e8eaed;
    border-color: rgba(255,255,255,0.06);
    box-shadow: 0 3px 12px rgba(0,0,0,0.3);
  }
  .function-name {
    color: #8ab4f8;
    background: rgba(138,180,248,0.05);
    border-bottom-color: rgba(138,180,248,0.15);
  }
  .call-id {
    background: rgba(138,180,248,0.1);
    color: #9aa0a6;
  }
  .param-name { color: #e8eaed; }
  .param-value {
    background: #282828;
    border-color: rgba(255,255,255,0.06);
    color: #e8eaed;
  }
  .function-buttons { border-top-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
  .execute-button, .insert-result-button { background: #8ab4f8; color: #202124; }
  .execute-button:hover, .insert-result-button:hover { background: #7ba9f0; }
  .mcp-function-results-panel { background: #1e1e1e; border-top-color: rgba(255,255,255,0.06); }
  .function-result-text { color: #e8eaed; }
  .function-result-error { color: #f28b82; }
  .spinner { border-color: rgba(138,180,248,0.3); border-top-color: #8ab4f8; }
}
`;

export const CONTROL_PANEL_STYLES = `
/* ── MCP Control Panel ───────────────────────────────────────────────────── */
#mcp-bookmarklet-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  padding: 12px 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  color: #202124;
  width: 220px;
  box-sizing: border-box;
  user-select: none;
  cursor: move;
}

#mcp-bookmarklet-panel .panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 10px;
  font-size: 14px;
}


.panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 6px 0;
}

.panel-toggle {
  position: relative;
  width: 34px;
  height: 18px;
  flex-shrink: 0;
}

.panel-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.panel-toggle-track {
  position: absolute;
  inset: 0;
  background: #ccc;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.panel-toggle input:checked + .panel-toggle-track { background: #1a73e8; }

.panel-toggle-track::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  top: 2px;
  left: 2px;
  transition: left 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.panel-toggle input:checked + .panel-toggle-track::after { left: 18px; }

.panel-tool-count {
  font-size: 12px;
  color: #5f6368;
  margin-top: 6px;
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  #mcp-bookmarklet-panel {
    background: #2d2d2d;
    border-color: rgba(255,255,255,0.12);
    color: #e8eaed;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  .panel-tool-count { color: #9aa0a6; }
}

/* ── FA status icon ─────────────────────────────────────────────────── */
.mcp-status-dot { font-size: 14px; flex-shrink: 0; }
.mcp-status-dot.connected    { color: #f59e0b; }
.mcp-status-dot.disconnected { color: #7c3aed; }

/* ── Close button ───────────────────────────────────────────────────── */
.panel-close-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: #5f6368;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  transition: color 0.15s;
}
.panel-close-btn:hover { color: #ea4335; }

/* ── Automation row ─────────────────────────────────────────────────── */
.panel-automation-row { display: flex; flex-direction: column; gap: 4px; margin: 6px 0; }
.panel-automation-item { display: flex; align-items: center; gap: 6px; font-size: 12px; width: 100%; }
.panel-automation-item .panel-toggle { margin-left: auto; }
.panel-automation-icon { font-size: 11px; color: #5f6368; width: 14px; text-align: center; }

/* ── Tools drawer ───────────────────────────────────────────────────── */
.panel-drawer-header {
  display: flex; align-items: center; gap: 6px;
  margin: 6px 0; cursor: pointer; font-size: 13px; padding: 4px 0;
  user-select: none;
}
.panel-drawer-header:hover { opacity: 0.8; }
.panel-drawer-header > i { font-size: 12px; color: #1a73e8; }
.panel-drawer-badge {
  font-size: 11px; background: rgba(26,115,232,0.1); color: #1a73e8;
  border-radius: 4px; padding: 1px 5px; margin-left: 2px;
}
.panel-drawer-chevron { margin-left: auto; font-size: 11px; color: #5f6368; }
.panel-drawer-body { display: none; }
.panel-drawer-body.open { display: block; }
.panel-drawer-scroll { max-height: 260px; overflow-y: auto; }
.panel-drawer-search {
  display: flex; align-items: center; gap: 6px; margin: 4px 0;
  padding: 4px 6px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px;
}
.panel-drawer-search input {
  border: none; outline: none; background: transparent;
  font-size: 12px; color: inherit; width: 100%;
}
.panel-server-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 0 4px; margin-top: 8px; font-size: 12px; font-weight: 700;
  color: #1a73e8; border-bottom: 1px solid rgba(26,115,232,0.25);
}
.panel-server-name { display: flex; align-items: center; gap: 5px; flex: 1; }
.panel-tool-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 3px 0 3px 16px; gap: 6px;
}
.panel-tool-info { display: flex; flex: 1; min-width: 0; align-items: center; }
.panel-tool-name { font-size: 12px; color: #202124; }

/* ── Half-size toggles inside the drawer ───────────────────────────── */
.panel-drawer-body .panel-toggle { width: 18px; height: 10px; }
.panel-drawer-body .panel-toggle-track { border-radius: 5px; }
.panel-drawer-body .panel-toggle-track::after { width: 8px; height: 8px; top: 1px; left: 1px; }
.panel-drawer-body .panel-toggle input:checked + .panel-toggle-track::after { left: 9px; }

/* ── Inject button ──────────────────────────────────────────────────── */
.panel-inject {
  margin-top: 8px; width: 100%; padding: 6px;
  border: none; border-radius: 4px;
  background: #1a73e8; color: white; font-size: 12px; cursor: pointer;
  transition: background 0.15s;
}
.panel-inject:hover { background: #1967d2; }

/* ── Dark mode additions ────────────────────────────────────────────── */
@media (prefers-color-scheme: dark) {
  .mcp-status-dot.connected    { color: #fbbf24; }
  .mcp-status-dot.disconnected { color: #a78bfa; }
  .panel-automation-icon { color: #9aa0a6; }
  .panel-drawer-header > i { color: #8ab4f8; }
  .panel-drawer-badge { background: rgba(138,180,248,0.1); color: #8ab4f8; }
  .panel-drawer-search { border-color: rgba(255,255,255,0.1); }
  .panel-server-row { color: #8ab4f8; border-bottom-color: rgba(255,255,255,0.06); }
  .panel-tool-name { color: #e8eaed; }
  .panel-inject { background: #8ab4f8; color: #202124; }
  .panel-inject:hover { background: #7ba9f0; }
  .panel-close-btn { color: #9aa0a6; }
  .panel-close-btn:hover { color: #f28b82; }
}
`;
