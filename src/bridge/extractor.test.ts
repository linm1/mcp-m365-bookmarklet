import { describe, it, expect } from 'vitest';
import {
  extractJSONObjects,
  isCompleteFunctionCall,
  findFunctionCallMatches,
  type ExtractedObject,
  type FunctionCallMatch,
} from './extractor';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPLETE_JSONL = [
  '{"type":"function_call_start","call_id":"abc123","name":"read_file"}',
  '{"type":"parameter","name":"path","value":"/tmp/test.txt"}',
  '{"type":"function_call_end","call_id":"abc123"}',
].join('\n');

const PARTIAL_JSONL_START_ONLY = [
  '{"type":"function_call_start","call_id":"xyz","name":"list_tools"}',
  '{"type":"parameter","name":"query","value":"*"}',
].join('\n');

const PARTIAL_JSONL_END_ONLY = [
  '{"type":"parameter","name":"path","value":"/tmp"}',
  '{"type":"function_call_end","call_id":"xyz"}',
].join('\n');

const CODE_FENCED = `\`\`\`json\n${COMPLETE_JSONL}\n\`\`\``;

const INLINE_COMPLETE = COMPLETE_JSONL;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('extractJSONObjects()', () => {
  it('extracts all valid JSON objects from JSONL content', () => {
    const result = extractJSONObjects(COMPLETE_JSONL);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('function_call_start');
    expect(result[1].type).toBe('parameter');
    expect(result[2].type).toBe('function_call_end');
  });

  it('returns empty array for empty string', () => {
    expect(extractJSONObjects('')).toEqual([]);
  });

  it('returns empty array for plain text without JSON', () => {
    expect(extractJSONObjects('hello world')).toEqual([]);
  });

  it('skips malformed JSON objects gracefully', () => {
    const mixed = '{"type":"function_call_start","call_id":"a","name":"foo"}\n{BROKEN JSON}\n{"type":"function_call_end","call_id":"a"}';

    const result = extractJSONObjects(mixed);

    // Should extract the valid ones and skip the broken one
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('function_call_start');
    expect(result[1].type).toBe('function_call_end');
  });

  it('extracts raw and parsed form together', () => {
    const result = extractJSONObjects(COMPLETE_JSONL);

    expect(result[0]).toMatchObject({
      raw: expect.stringContaining('function_call_start'),
      parsed: expect.objectContaining({ type: 'function_call_start' }),
      type: 'function_call_start',
    });
  });

  it('handles JSON with nested string values', () => {
    const withNested = '{"type":"parameter","name":"content","value":"line1\\nline2"}';

    const result = extractJSONObjects(withNested);

    expect(result).toHaveLength(1);
    expect(result[0].parsed.value).toBe('line1\nline2');
  });

  it('handles multiple function calls in same content', () => {
    const twoCallsContent = COMPLETE_JSONL + '\n' + [
      '{"type":"function_call_start","call_id":"def456","name":"write_file"}',
      '{"type":"parameter","name":"path","value":"/out.txt"}',
      '{"type":"function_call_end","call_id":"def456"}',
    ].join('\n');

    const result = extractJSONObjects(twoCallsContent);

    expect(result).toHaveLength(6);
  });

  it('ignores non-function-call JSON objects', () => {
    const content = '{"foo":"bar"}\n{"type":"function_call_start","call_id":"a","name":"t"}\n{"baz":1}';

    const result = extractJSONObjects(content);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('function_call_start');
  });
});

describe('isCompleteFunctionCall()', () => {
  it('returns true when objects have both start and end', () => {
    const objects: ExtractedObject[] = [
      { raw: '', parsed: {}, type: 'function_call_start' },
      { raw: '', parsed: {}, type: 'function_call_end' },
    ];

    expect(isCompleteFunctionCall(objects)).toBe(true);
  });

  it('returns false when only start is present', () => {
    const objects: ExtractedObject[] = [
      { raw: '', parsed: {}, type: 'function_call_start' },
      { raw: '', parsed: {}, type: 'parameter' },
    ];

    expect(isCompleteFunctionCall(objects)).toBe(false);
  });

  it('returns false when only end is present', () => {
    const objects: ExtractedObject[] = [
      { raw: '', parsed: {}, type: 'parameter' },
      { raw: '', parsed: {}, type: 'function_call_end' },
    ];

    expect(isCompleteFunctionCall(objects)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isCompleteFunctionCall([])).toBe(false);
  });

  it('returns true with parameters between start and end', () => {
    const objects = extractJSONObjects(COMPLETE_JSONL);

    expect(isCompleteFunctionCall(objects)).toBe(true);
  });
});

describe('findFunctionCallMatches()', () => {
  it('finds complete code-fenced JSON function call', () => {
    const result = findFunctionCallMatches(CODE_FENCED);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('code-fenced');
  });

  it('finds complete inline JSON function call without fences', () => {
    const result = findFunctionCallMatches(INLINE_COMPLETE);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('inline');
  });

  it('prefers code-fenced over inline when both present', () => {
    const result = findFunctionCallMatches(CODE_FENCED);

    // Should find code-fenced and not inline duplicate
    expect(result.every((m) => m.type === 'code-fenced')).toBe(true);
  });

  it('returns empty array for partial function call (start only)', () => {
    const result = findFunctionCallMatches(PARTIAL_JSONL_START_ONLY);

    expect(result).toHaveLength(0);
  });

  it('returns empty array for partial function call (end only)', () => {
    const result = findFunctionCallMatches(PARTIAL_JSONL_END_ONLY);

    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(findFunctionCallMatches('')).toHaveLength(0);
  });

  it('returns empty array for plain text', () => {
    expect(findFunctionCallMatches('Hello world')).toHaveLength(0);
  });

  it('includes start/end indices for each match', () => {
    const result = findFunctionCallMatches(INLINE_COMPLETE);

    expect(result[0]).toMatchObject({
      start: expect.any(Number),
      end: expect.any(Number),
      jsonContent: expect.any(String),
    });
    expect(result[0].start).toBeLessThan(result[0].end);
  });

  it('handles M365-specific format without code fences', () => {
    // M365 Copilot emits JSON directly without markdown fences
    const m365Format = [
      '{"type":"function_call_start","call_id":"m365-001","name":"analyze_file"}',
      '{"type":"description","content":"Analyzing the requested file"}',
      '{"type":"parameter","name":"file_path","value":"C:\\\\Users\\\\test\\\\data.csv"}',
      '{"type":"function_call_end","call_id":"m365-001"}',
    ].join('\n');

    const result = findFunctionCallMatches(m365Format);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('inline');
  });

  it('handles multiple complete calls in same text', () => {
    const twoCallsText = INLINE_COMPLETE + '\n\n' + [
      '{"type":"function_call_start","call_id":"second","name":"tool2"}',
      '{"type":"function_call_end","call_id":"second"}',
    ].join('\n');

    const result = findFunctionCallMatches(twoCallsText);

    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('match jsonContent contains the raw JSON lines', () => {
    const result = findFunctionCallMatches(INLINE_COMPLETE);

    expect(result[0].jsonContent).toContain('function_call_start');
    expect(result[0].jsonContent).toContain('function_call_end');
  });
});
