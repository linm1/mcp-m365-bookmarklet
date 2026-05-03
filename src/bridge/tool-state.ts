/**
 * Pure functions for localStorage-backed per-tool enabled state.
 * All functions are immutable — no input objects are ever mutated.
 */

const STORAGE_KEY = 'mcp_tool_enabled_state';

/**
 * Read the persisted tool-enabled map from localStorage.
 * Returns an empty record on any error (missing key, malformed JSON, wrong type).
 */
export function loadToolEnabledState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Persist the tool-enabled map to localStorage.
 */
export function saveToolEnabledState(state: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Return whether a tool is enabled.
 * Tools absent from the state record are considered enabled (default-on).
 */
export function isToolEnabled(name: string, state: Record<string, boolean>): boolean {
  if (!(name in state)) return true;
  return state[name];
}

/**
 * Return a new state record with the given tool's enabled flag set.
 * The input record is never mutated.
 */
export function setToolEnabled(
  name: string,
  enabled: boolean,
  state: Record<string, boolean>,
): Record<string, boolean> {
  return { ...state, [name]: enabled };
}
