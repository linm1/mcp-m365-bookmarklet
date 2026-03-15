import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderFunctionCard, updateCardResult, updateCardLoading } from './renderer';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPLETE_JSONL = [
  '{"type":"function_call_start","call_id":"abc123","name":"read_file"}',
  '{"type":"description","content":"Read file contents"}',
  '{"type":"parameter","name":"path","value":"/tmp/test.txt"}',
  '{"type":"function_call_end","call_id":"abc123"}',
].join('\n');

const JSONL_MULTI_PARAMS = [
  '{"type":"function_call_start","call_id":"def456","name":"write_file"}',
  '{"type":"parameter","name":"path","value":"/out.txt"}',
  '{"type":"parameter","name":"content","value":"hello world"}',
  '{"type":"function_call_end","call_id":"def456"}',
].join('\n');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('renderFunctionCard()', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns an HTMLElement', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);

    expect(card).toBeInstanceOf(HTMLElement);
  });

  it('displays the function name in the card header', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);

    expect(card.textContent).toContain('read_file');
  });

  it('displays the call_id', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);

    expect(card.textContent).toContain('abc123');
  });

  it('renders a Run button', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);
    const button = card.querySelector('button.execute-button, [data-action="run"]');

    expect(button).not.toBeNull();
  });

  it('renders parameters with names and values', () => {
    const card = renderFunctionCard(JSONL_MULTI_PARAMS);

    expect(card.textContent).toContain('path');
    expect(card.textContent).toContain('/out.txt');
    expect(card.textContent).toContain('content');
    expect(card.textContent).toContain('hello world');
  });

  it('renders description when present', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);

    expect(card.textContent).toContain('Read file contents');
  });

  it('calls onRun callback when Run button is clicked', () => {
    const onRun = vi.fn();
    const card = renderFunctionCard(COMPLETE_JSONL, { onRun });

    const button = card.querySelector('button.execute-button, [data-action="run"]') as HTMLButtonElement;
    button.click();

    expect(onRun).toHaveBeenCalledWith(
      'read_file',
      expect.objectContaining({ path: '/tmp/test.txt' }),
      'abc123',
    );
  });

  it('passes all parameters to onRun callback', () => {
    const onRun = vi.fn();
    const card = renderFunctionCard(JSONL_MULTI_PARAMS, { onRun });

    const button = card.querySelector('button.execute-button, [data-action="run"]') as HTMLButtonElement;
    button.click();

    expect(onRun).toHaveBeenCalledWith(
      'write_file',
      expect.objectContaining({ path: '/out.txt', content: 'hello world' }),
      'def456',
    );
  });

  it('returns null for malformed/incomplete JSONL', () => {
    const partial = '{"type":"function_call_start","call_id":"x","name":"foo"}';
    const card = renderFunctionCard(partial);

    expect(card).toBeNull();
  });

  it('shows loading state indicator when isLoading is true', () => {
    const card = renderFunctionCard(COMPLETE_JSONL, { isLoading: true });

    const spinner = card?.querySelector('.spinner, [data-loading="true"], .function-loading');
    expect(spinner).not.toBeNull();
  });
});

describe('updateCardResult()', () => {
  it('displays result text inside the card', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);
    document.body.appendChild(card!);

    updateCardResult(card!, { content: [{ type: 'text', text: 'file contents here' }] });

    expect(card!.textContent).toContain('file contents here');
  });

  it('shows error message when result is an error object', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);
    document.body.appendChild(card!);

    updateCardResult(card!, null, 'Tool execution failed');

    expect(card!.textContent).toContain('Tool execution failed');
  });

  it('renders Insert button after result is shown', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);
    document.body.appendChild(card!);

    updateCardResult(card!, { content: [{ type: 'text', text: 'result' }] });

    const insertBtn = card!.querySelector('[data-action="insert"], .insert-result-button');
    expect(insertBtn).not.toBeNull();
  });

  it('calls onInsert callback with extracted text when Insert is clicked', () => {
    const onInsert = vi.fn();
    const card = renderFunctionCard(COMPLETE_JSONL, { onInsert });
    document.body.appendChild(card!);

    updateCardResult(card!, { content: [{ type: 'text', text: 'inserted text' }] });

    const insertBtn = card!.querySelector('[data-action="insert"], .insert-result-button') as HTMLButtonElement;
    insertBtn?.click();

    expect(onInsert).toHaveBeenCalledWith('inserted text', 'abc123');
  });
});

describe('updateCardLoading()', () => {
  it('adds loading class to card', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);

    updateCardLoading(card!, true);

    expect(card!.classList.contains('function-loading')).toBe(true);
  });

  it('removes loading class from card', () => {
    const card = renderFunctionCard(COMPLETE_JSONL);
    card!.classList.add('function-loading');

    updateCardLoading(card!, false);

    expect(card!.classList.contains('function-loading')).toBe(false);
  });
});
