/**
 * JSON Function Call Extractor.
 *
 * Detects JSONL sequences of function call objects in text and provides
 * utilities for wrapping them in <pre class="json-function-call"> elements.
 *
 * Ported from chrome-extension/public/json_function_call_extractor.js —
 * converted to ES module exports and typed strictly.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FunctionCallObjectType =
  | 'function_call_start'
  | 'function_call_end'
  | 'description'
  | 'parameter';

export interface ExtractedObject {
  readonly raw: string;
  readonly parsed: Record<string, unknown>;
  readonly type: FunctionCallObjectType;
}

export interface FunctionCallMatch {
  readonly start: number;
  readonly end: number;
  readonly jsonContent: string;
  readonly type: 'code-fenced' | 'inline';
}

// ── Regex patterns ────────────────────────────────────────────────────────────

/**
 * Matches code-fenced JSON blocks: ```json\n...\n```
 * Content group captures the JSON objects between the fences.
 */
const JSON_FUNCTION_PATTERN =
  /```json\s*\n((?:\{"type":\s*"(?:function_call_start|description|parameter|function_call_end)"[^}]*\}\s*\n?)+)/gi;

/**
 * Matches inline JSONL sequences (no code fences).
 * Captures from function_call_start through any trailing objects.
 */
const INLINE_JSON_PATTERN =
  /(\{"type":\s*"function_call_start"[^}]*\}(?:\s*\n?\s*\{"type":\s*"(?:description|parameter|function_call_end)"[^}]*\})*)/gi;

/**
 * Matches individual JSON objects of the function-call types.
 */
const OBJECT_PATTERN =
  /\{(?:[^{}"]|"(?:\\.|[^"\\])*")*?"type"\s*:\s*"(function_call_start|function_call_end|description|parameter)"(?:[^{}"]|"(?:\\.|[^"\\])*")*?\}/g;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract all function-call JSON objects from a text string.
 * Malformed JSON is skipped silently.
 */
export function extractJSONObjects(content: string): ExtractedObject[] {
  const results: ExtractedObject[] = [];

  OBJECT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = OBJECT_PATTERN.exec(content)) !== null) {
    const raw = match[0];
    const typeValue = match[1] as FunctionCallObjectType;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      results.push({ raw, parsed, type: typeValue });
    } catch {
      // Skip malformed JSON objects
    }
  }

  return results;
}

/**
 * Returns true when the extracted objects form a complete function call
 * (i.e., both function_call_start and function_call_end are present).
 */
export function isCompleteFunctionCall(objects: readonly ExtractedObject[]): boolean {
  let hasStart = false;
  let hasEnd = false;

  for (const obj of objects) {
    if (obj.type === 'function_call_start') hasStart = true;
    if (obj.type === 'function_call_end') hasEnd = true;
    if (hasStart && hasEnd) return true;
  }

  return hasStart && hasEnd;
}

/**
 * Find all complete function-call sequences in text.
 * Returns an array of match descriptors with position info.
 *
 * Preference: code-fenced blocks are matched first; only if none are found
 * does the function fall back to the inline (no-fence) pattern.
 */
export function findFunctionCallMatches(text: string): FunctionCallMatch[] {
  const matches: FunctionCallMatch[] = [];

  // First pass: code-fenced blocks
  JSON_FUNCTION_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = JSON_FUNCTION_PATTERN.exec(text)) !== null) {
    const jsonContent = m[1];
    const objects = extractJSONObjects(jsonContent);

    if (objects.length > 0 && isCompleteFunctionCall(objects)) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        jsonContent,
        type: 'code-fenced',
      });
    }
  }

  if (matches.length > 0) return matches;

  // Second pass: inline (no code fence)
  INLINE_JSON_PATTERN.lastIndex = 0;

  while ((m = INLINE_JSON_PATTERN.exec(text)) !== null) {
    const jsonContent = m[1];
    const objects = extractJSONObjects(jsonContent);

    if (objects.length > 0 && isCompleteFunctionCall(objects)) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        jsonContent,
        type: 'inline',
      });
    }
  }

  return matches;
}

/**
 * Create a <pre class="json-function-call"> element wrapping the given JSON content.
 * Uses textContent (not innerHTML) to avoid Trusted Types issues.
 */
export function createPreElement(jsonContent: string): HTMLPreElement {
  const pre = document.createElement('pre');
  pre.className = 'json-function-call';
  pre.setAttribute('data-extracted', 'true');
  pre.textContent = '```\n' + jsonContent.trim() + '\n```';
  return pre;
}

/**
 * Process a text node, replacing any complete JSON function-call sequences
 * with <pre class="json-function-call"> elements inserted before the node.
 * Removes the original text node if any replacements were made.
 *
 * Returns true if the DOM was modified.
 */
export function processTextNode(node: Text): boolean {
  const text = node.textContent ?? '';
  if (!text.trim()) return false;
  if (!text.includes('"type"') || !text.includes('function_call')) return false;

  const parent = node.parentNode;
  if (!parent) return false;

  const replacements = findFunctionCallMatches(text);
  if (replacements.length === 0) return false;

  // Process replacements in forward order
  const sorted = [...replacements].sort((a, b) => a.start - b.start);
  let offset = 0;

  for (const replacement of sorted) {
    const beforeText = text.substring(offset, replacement.start);

    if (beforeText) {
      parent.insertBefore(document.createTextNode(beforeText), node);
    }

    parent.insertBefore(createPreElement(replacement.jsonContent), node);
    offset = replacement.end;
  }

  const remainingText = text.substring(offset);
  if (remainingText) {
    parent.insertBefore(document.createTextNode(remainingText), node);
  }

  parent.removeChild(node);
  return true;
}
