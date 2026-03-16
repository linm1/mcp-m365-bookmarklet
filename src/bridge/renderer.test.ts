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

// M365 Copilot Chat emits "key" instead of "name" for parameter objects
const JSONL_M365_KEY_FORMAT = [
  '{"type":"function_call_start","call_id":"ghi789","name":"desktop-commander.write_file"}',
  '{"type":"parameter","key":"path","value":"C:\\\\Users\\\\test\\\\file.txt"}',
  '{"type":"parameter","key":"content","value":"hello world"}',
  '{"type":"parameter","key":"mode","value":"rewrite"}',
  '{"type":"function_call_end","call_id":"ghi789"}',
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

  it('preserves number type for numeric parameters', () => {
    const onRun = vi.fn();
    const jsonl = [
      '{"type":"function_call_start","call_id":"n1","name":"read_process_output"}',
      '{"type":"parameter","key":"pid","value":1234}',
      '{"type":"parameter","key":"timeout_ms","value":5000}',
      '{"type":"function_call_end","call_id":"n1"}',
    ].join('\n');

    const card = renderFunctionCard(jsonl, { onRun });
    card!.querySelector<HTMLButtonElement>('[data-action="run"]')!.click();

    expect(onRun).toHaveBeenCalledWith(
      'read_process_output',
      expect.objectContaining({ pid: 1234, timeout_ms: 5000 }),
      'n1',
    );
    const [, args] = onRun.mock.calls[0];
    expect(typeof args.pid).toBe('number');
    expect(typeof args.timeout_ms).toBe('number');
  });

  it('preserves boolean type for boolean parameters', () => {
    const onRun = vi.fn();
    const jsonl = [
      '{"type":"function_call_start","call_id":"b1","name":"start_search"}',
      '{"type":"parameter","key":"searchType","value":"files"}',
      '{"type":"parameter","key":"pattern","value":"*.ts"}',
      '{"type":"parameter","key":"literalSearch","value":false}',
      '{"type":"parameter","key":"ignoreCase","value":true}',
      '{"type":"function_call_end","call_id":"b1"}',
    ].join('\n');

    const card = renderFunctionCard(jsonl, { onRun });
    card!.querySelector<HTMLButtonElement>('[data-action="run"]')!.click();

    const [, args] = onRun.mock.calls[0];
    expect(args.literalSearch).toBe(false);
    expect(args.ignoreCase).toBe(true);
    expect(typeof args.literalSearch).toBe('boolean');
    expect(typeof args.ignoreCase).toBe('boolean');
  });

  it('preserves array type for array parameters', () => {
    const onRun = vi.fn();
    const jsonl = [
      '{"type":"function_call_start","call_id":"a1","name":"read_multiple_files"}',
      '{"type":"parameter","key":"paths","value":["file1.txt","file2.txt"]}',
      '{"type":"function_call_end","call_id":"a1"}',
    ].join('\n');

    const card = renderFunctionCard(jsonl, { onRun });
    card!.querySelector<HTMLButtonElement>('[data-action="run"]')!.click();

    const [, args] = onRun.mock.calls[0];
    expect(args.paths).toEqual(['file1.txt', 'file2.txt']);
    expect(Array.isArray(args.paths)).toBe(true);
  });

  it('extracts path parameter with unescaped Windows backslashes (M365 output)', () => {
    // M365 Copilot emits raw (invalid JSON) backslashes: "C:\Users\..."
    const jsonlWithWindowsPath = [
      '{"type":"function_call_start","call_id":"win1","name":"desktop-commander.write_file"}',
      '{"type":"parameter","key":"path","value":"C:\\Users\\Linm1\\Downloads\\test.txt"}',
      '{"type":"parameter","key":"content","value":"hello world"}',
      '{"type":"parameter","key":"mode","value":"rewrite"}',
      '{"type":"function_call_end","call_id":"win1"}',
    ].join('\n');

    const onRun = vi.fn();
    const card = renderFunctionCard(jsonlWithWindowsPath, { onRun });

    expect(card).not.toBeNull();

    const button = card!.querySelector('[data-action="run"]') as HTMLButtonElement;
    button.click();

    expect(onRun).toHaveBeenCalledWith(
      'desktop-commander.write_file',
      expect.objectContaining({
        path: 'C:\\Users\\Linm1\\Downloads\\test.txt',
        content: 'hello world',
      }),
      'win1',
    );
  });

  it('parses parameters using "key" field (M365 Copilot format)', () => {
    const onRun = vi.fn();
    const card = renderFunctionCard(JSONL_M365_KEY_FORMAT, { onRun });

    expect(card).not.toBeNull();

    const button = card!.querySelector('button.execute-button, [data-action="run"]') as HTMLButtonElement;
    button.click();

    expect(onRun).toHaveBeenCalledWith(
      'desktop-commander.write_file',
      expect.objectContaining({
        path: 'C:\\Users\\test\\file.txt',
        content: 'hello world',
        mode: 'rewrite',
      }),
      'ghi789',
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
