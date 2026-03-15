import { describe, it, expect, beforeEach } from 'vitest';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './settings';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearStorage() {
  localStorage.clear();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('settings', () => {
  beforeEach(() => {
    clearStorage();
  });

  // ── loadSettings ───────────────────────────────────────────────────────────

  describe('loadSettings()', () => {
    it('returns defaults when localStorage is empty', () => {
      const settings = loadSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('returns saved autoInsert value when true', () => {
      localStorage.setItem('mcp_bookmarklet_settings', JSON.stringify({ autoInsert: true }));

      const settings = loadSettings();

      expect(settings.autoInsert).toBe(true);
    });

    it('returns saved autoSubmit value when true', () => {
      localStorage.setItem('mcp_bookmarklet_settings', JSON.stringify({ autoSubmit: true }));

      const settings = loadSettings();

      expect(settings.autoSubmit).toBe(true);
    });

    it('returns saved serverUrl', () => {
      localStorage.setItem(
        'mcp_bookmarklet_settings',
        JSON.stringify({ serverUrl: 'http://localhost:9999' }),
      );

      const settings = loadSettings();

      expect(settings.serverUrl).toBe('http://localhost:9999');
    });

    it('merges stored values with defaults (partial storage)', () => {
      localStorage.setItem('mcp_bookmarklet_settings', JSON.stringify({ autoInsert: true }));

      const settings = loadSettings();

      expect(settings.autoInsert).toBe(true);
      expect(settings.autoSubmit).toBe(DEFAULT_SETTINGS.autoSubmit);
      expect(settings.serverUrl).toBe(DEFAULT_SETTINGS.serverUrl);
    });

    it('returns defaults when stored JSON is malformed', () => {
      localStorage.setItem('mcp_bookmarklet_settings', 'not-valid-json{{{');

      const settings = loadSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('returns defaults when autoInsert is a non-boolean string', () => {
      localStorage.setItem('mcp_bookmarklet_settings', JSON.stringify({ autoInsert: 'yes' }));

      const settings = loadSettings();

      expect(settings.autoInsert).toBe(DEFAULT_SETTINGS.autoInsert);
    });

    it('returns defaults when autoSubmit is null', () => {
      localStorage.setItem('mcp_bookmarklet_settings', JSON.stringify({ autoSubmit: null }));

      const settings = loadSettings();

      expect(settings.autoSubmit).toBe(DEFAULT_SETTINGS.autoSubmit);
    });

    it('returns defaults when serverUrl is not a string', () => {
      localStorage.setItem('mcp_bookmarklet_settings', JSON.stringify({ serverUrl: 42 }));

      const settings = loadSettings();

      expect(settings.serverUrl).toBe(DEFAULT_SETTINGS.serverUrl);
    });
  });

  // ── saveSettings ───────────────────────────────────────────────────────────

  describe('saveSettings()', () => {
    it('persists settings to localStorage', () => {
      saveSettings({ autoInsert: true, autoSubmit: false, serverUrl: 'http://localhost:3006' });

      const raw = localStorage.getItem('mcp_bookmarklet_settings');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.autoInsert).toBe(true);
    });

    it('can round-trip through save and load', () => {
      const original = { autoInsert: true, autoSubmit: true, serverUrl: 'http://localhost:8080' };

      saveSettings(original);
      const loaded = loadSettings();

      expect(loaded).toEqual(original);
    });

    it('overwrites previously stored settings', () => {
      saveSettings({ autoInsert: true, autoSubmit: false, serverUrl: 'http://localhost:3006' });
      saveSettings({ autoInsert: false, autoSubmit: true, serverUrl: 'http://localhost:4000' });

      const settings = loadSettings();

      expect(settings.autoInsert).toBe(false);
      expect(settings.autoSubmit).toBe(true);
      expect(settings.serverUrl).toBe('http://localhost:4000');
    });
  });
});
