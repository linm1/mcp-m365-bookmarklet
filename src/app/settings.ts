/**
 * Settings persistence — read/write user preferences via localStorage.
 * All values are validated on load; invalid stored values fall back to defaults.
 */

import type { AppSettings } from '../shared/protocol';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mcp_bookmarklet_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  autoInsert: false,
  autoSubmit: false,
  autoRun: false,
  serverUrl: 'http://localhost:3006',
} as const;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load settings from localStorage, merging with defaults.
 * Returns defaults for any missing or invalid field.
 */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SETTINGS;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;

    return mergeWithDefaults(parsed as Record<string, unknown>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Persist settings to localStorage.
 * The full settings object is stored (not a partial patch).
 */
export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ── Private helpers ───────────────────────────────────────────────────────────

function mergeWithDefaults(stored: Record<string, unknown>): AppSettings {
  return {
    autoInsert: readBoolean(stored.autoInsert, DEFAULT_SETTINGS.autoInsert),
    autoSubmit: readBoolean(stored.autoSubmit, DEFAULT_SETTINGS.autoSubmit),
    autoRun: readBoolean(stored.autoRun, DEFAULT_SETTINGS.autoRun),
    serverUrl: readString(stored.serverUrl, DEFAULT_SETTINGS.serverUrl),
  };
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
