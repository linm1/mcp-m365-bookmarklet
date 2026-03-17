/**
 * Tests for tool-state.ts — pure localStorage-backed per-tool enabled state.
 * Written FIRST per TDD: all tests should fail before implementation exists.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadToolEnabledState,
  saveToolEnabledState,
  isToolEnabled,
  setToolEnabled,
} from './tool-state';

const STORAGE_KEY = 'mcp_tool_enabled_state';

beforeEach(() => {
  localStorage.clear();
});

// ── isToolEnabled ─────────────────────────────────────────────────────────────

describe('isToolEnabled', () => {
  it('returns true for an unknown tool name (default-on behaviour)', () => {
    expect(isToolEnabled('unknownTool', {})).toBe(true);
  });

  it('returns false when state explicitly disables the tool', () => {
    expect(isToolEnabled('toolA', { toolA: false })).toBe(false);
  });

  it('returns true when state explicitly enables the tool', () => {
    expect(isToolEnabled('toolA', { toolA: true })).toBe(true);
  });

  it('returns true when other tools are in state but the queried one is not', () => {
    expect(isToolEnabled('toolB', { toolA: false })).toBe(true);
  });
});

// ── setToolEnabled ────────────────────────────────────────────────────────────

describe('setToolEnabled', () => {
  it('returns a new record with the tool set to false', () => {
    const result = setToolEnabled('x', false, {});
    expect(result).toEqual({ x: false });
  });

  it('returns a new record with the tool set to true', () => {
    const result = setToolEnabled('x', true, {});
    expect(result).toEqual({ x: true });
  });

  it('does NOT mutate the input record (immutability)', () => {
    const original: Record<string, boolean> = { a: true };
    const frozen = Object.freeze({ ...original });
    // setToolEnabled must not throw even if we pass a frozen object,
    // because it must never write to the input.
    const result = setToolEnabled('b', false, frozen);
    expect(result).toEqual({ a: true, b: false });
    // original is untouched
    expect(original).toEqual({ a: true });
    expect(Object.keys(original)).toHaveLength(1);
  });

  it('overwrites an existing key without affecting others', () => {
    const state = { toolA: true, toolB: false };
    const result = setToolEnabled('toolA', false, state);
    expect(result).toEqual({ toolA: false, toolB: false });
    // original unchanged
    expect(state.toolA).toBe(true);
  });
});

// ── saveToolEnabledState / loadToolEnabledState round-trip ────────────────────

describe('saveToolEnabledState + loadToolEnabledState', () => {
  it('round-trips a non-empty state record', () => {
    const state = { a: false, b: true };
    saveToolEnabledState(state);
    expect(loadToolEnabledState()).toEqual(state);
  });

  it('round-trips an empty record', () => {
    saveToolEnabledState({});
    expect(loadToolEnabledState()).toEqual({});
  });
});

// ── loadToolEnabledState ──────────────────────────────────────────────────────

describe('loadToolEnabledState', () => {
  it('returns {} when localStorage has no entry for the key', () => {
    expect(loadToolEnabledState()).toEqual({});
  });

  it('returns {} when the stored value is malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json {{}}');
    expect(loadToolEnabledState()).toEqual({});
  });

  it('returns {} when the stored value is an empty string', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(loadToolEnabledState()).toEqual({});
  });

  it('returns {} when the stored value is a JSON non-object (e.g. array)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadToolEnabledState()).toEqual({});
  });
});
