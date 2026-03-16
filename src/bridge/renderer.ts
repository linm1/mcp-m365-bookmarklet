/**
 * Tool Card Renderer.
 *
 * Converts JSONL content (a complete function call sequence) into a styled
 * interactive card element showing the function name, parameters, and
 * providing Run / Insert buttons.
 *
 * Simplified version of render_prescript/src/renderer/functionBlock.ts.
 * No React, no XML support, no ElementPool — plain DOM only.
 */

import { extractJSONObjects, isCompleteFunctionCall } from './extractor';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RenderCardOptions {
  readonly isLoading?: boolean;
  readonly onRun?: (name: string, args: Record<string, unknown>, callId: string) => void;
  readonly onInsert?: (text: string, callId: string) => void;
}

interface ParsedFunctionCall {
  readonly name: string;
  readonly callId: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a tool card DOM element from a JSONL string.
 * Returns null for incomplete / malformed input.
 */
export function renderFunctionCard(
  jsonl: string,
  options?: RenderCardOptions,
): HTMLElement | null {
  const parsed = parseFunctionCall(jsonl);
  if (!parsed) return null;

  return buildCard(parsed, options ?? {});
}

/**
 * Display a tool result (or error) inside a previously rendered card.
 */
export function updateCardResult(
  card: HTMLElement,
  result: unknown,
  error?: string,
): void {
  const resultsPanel = ensureResultsPanel(card);

  if (error) {
    resultsPanel.innerHTML = '';
    const errEl = document.createElement('div');
    errEl.className = 'function-result-error';
    errEl.textContent = error;
    resultsPanel.appendChild(errEl);
    return;
  }

  const text = extractResultText(result);
  resultsPanel.innerHTML = '';

  const pre = document.createElement('pre');
  pre.className = 'function-result-text';
  pre.textContent = text;
  resultsPanel.appendChild(pre);

  // Add Insert button
  const insertBtn = document.createElement('button');
  insertBtn.className = 'insert-result-button';
  insertBtn.setAttribute('data-action', 'insert');
  insertBtn.textContent = 'Insert';
  insertBtn.addEventListener('click', () => {
    const onInsert = (card as any).__onInsert as ((t: string, callId: string) => void) | undefined;
    onInsert?.(text, card.dataset.callId ?? '');
  });
  resultsPanel.appendChild(insertBtn);

  updateCardLoading(card, false);
}

/**
 * Toggle the loading state indicator on a card.
 */
export function updateCardLoading(card: HTMLElement, loading: boolean): void {
  if (loading) {
    card.classList.add('function-loading');
  } else {
    card.classList.remove('function-loading');
  }
}

// ── Private ───────────────────────────────────────────────────────────────────

function parseFunctionCall(jsonl: string): ParsedFunctionCall | null {
  const objects = extractJSONObjects(jsonl);
  if (objects.length === 0 || !isCompleteFunctionCall(objects)) return null;

  let name = '';
  let callId = '';
  let description = '';
  const parameters: Record<string, unknown> = {};

  for (const obj of objects) {
    switch (obj.type) {
      case 'function_call_start':
        name = String(obj.parsed.name ?? '');
        callId = String(obj.parsed.call_id ?? '');
        break;
      case 'description':
        description = String(obj.parsed.text ?? obj.parsed.content ?? '');
        break;
      case 'parameter': {
        const paramName = String(obj.parsed.key ?? obj.parsed.name ?? '');
        const paramValue = obj.parsed.value ?? '';
        if (paramName) parameters[paramName] = paramValue;
        break;
      }
    }
  }

  if (!name) return null;

  return { name, callId, description, parameters };
}

function buildCard(parsed: ParsedFunctionCall, options: RenderCardOptions): HTMLElement {
  const card = document.createElement('div');
  card.className = 'function-block';
  card.dataset.callId = parsed.callId ?? '';

  if (options.isLoading) {
    card.classList.add('function-loading');
  }

  if (options.onInsert) {
    (card as any).__onInsert = options.onInsert;
  }

  // Header
  const header = buildHeader(parsed, options.isLoading ?? false);
  card.appendChild(header);

  // Body (description + parameters)
  const body = buildBody(parsed);
  card.appendChild(body);

  // Footer (Run button)
  const footer = buildFooter(parsed, card, options);
  card.appendChild(footer);

  return card;
}

function buildHeader(parsed: ParsedFunctionCall, isLoading: boolean): HTMLElement {
  const header = document.createElement('div');
  header.className = 'function-name';

  const left = document.createElement('div');
  left.className = 'function-name-left';

  if (isLoading) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    left.appendChild(spinner);
  }

  const nameText = document.createElement('span');
  nameText.className = 'function-name-text';
  nameText.textContent = parsed.name;
  left.appendChild(nameText);

  header.appendChild(left);

  if (parsed.callId) {
    const callIdEl = document.createElement('span');
    callIdEl.className = 'call-id';
    callIdEl.textContent = parsed.callId;
    header.appendChild(callIdEl);
  }

  return header;
}

function buildBody(parsed: ParsedFunctionCall): HTMLElement {
  const body = document.createElement('div');
  body.className = 'expandable-content';

  if (parsed.description) {
    const descEl = document.createElement('p');
    descEl.className = 'function-description';
    descEl.textContent = parsed.description;
    body.appendChild(descEl);
  }

  for (const [paramName, paramValue] of Object.entries(parsed.parameters)) {
    const nameEl = document.createElement('div');
    nameEl.className = 'param-name';
    nameEl.textContent = paramName;

    const valueEl = document.createElement('div');
    valueEl.className = 'param-value';
    valueEl.textContent =
      typeof paramValue === 'object' ? JSON.stringify(paramValue) : String(paramValue);

    body.appendChild(nameEl);
    body.appendChild(valueEl);
  }

  return body;
}

function buildFooter(
  parsed: ParsedFunctionCall,
  card: HTMLElement,
  options: RenderCardOptions,
): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'function-buttons';

  const runBtn = document.createElement('button');
  runBtn.className = 'execute-button';
  runBtn.setAttribute('data-action', 'run');
  runBtn.textContent = 'Run';

  runBtn.addEventListener('click', () => {
    if (options.onRun) {
      options.onRun(parsed.name, { ...parsed.parameters }, parsed.callId ?? '');
    }
    updateCardLoading(card, true);
  });

  footer.appendChild(runBtn);

  return footer;
}

function ensureResultsPanel(card: HTMLElement): HTMLElement {
  let panel = card.querySelector('.mcp-function-results-panel') as HTMLElement | null;
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'mcp-function-results-panel';
    card.appendChild(panel);
  }
  return panel;
}

function extractResultText(result: unknown): string {
  if (result === null || result === undefined) return '';

  if (typeof result === 'string') return result;

  if (typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.content)) {
      return (r.content as Array<{ type: string; text?: string }>)
        .filter((item) => item.type === 'text')
        .map((item) => item.text ?? '')
        .join('\n');
    }
  }

  return JSON.stringify(result, null, 2);
}
