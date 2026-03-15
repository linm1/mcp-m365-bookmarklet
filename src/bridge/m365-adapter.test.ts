import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  insertText,
  submitForm,
  attachFile,
  findElement,
  SELECTORS,
} from './m365-adapter';

// ── DOM Setup Helpers ─────────────────────────────────────────────────────────

function createEditor(): HTMLDivElement {
  const editor = document.createElement('div');
  editor.id = 'm365-chat-editor-target-element';
  editor.contentEditable = 'true';
  editor.setAttribute('aria-label', 'Send a message to Copilot');
  document.body.appendChild(editor);
  return editor;
}

function createSubmitButton(disabled = false): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'fai-SendButton';
  btn.type = 'submit';
  if (disabled) btn.disabled = true;
  // Give it non-zero dimensions
  Object.defineProperty(btn, 'getBoundingClientRect', {
    value: () => ({ width: 40, height: 40, top: 0, left: 0, right: 40, bottom: 40 }),
    configurable: true,
  });
  document.body.appendChild(btn);
  return btn;
}

function createFileInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'upload-file-button';
  document.body.appendChild(input);
  return input;
}

function clearBody() {
  document.body.innerHTML = '';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SELECTORS', () => {
  it('exports a CHAT_INPUT selector string', () => {
    expect(typeof SELECTORS.CHAT_INPUT).toBe('string');
    expect(SELECTORS.CHAT_INPUT.length).toBeGreaterThan(0);
  });

  it('exports a SUBMIT_BUTTON selector string', () => {
    expect(typeof SELECTORS.SUBMIT_BUTTON).toBe('string');
  });

  it('exports a FILE_INPUT selector string', () => {
    expect(typeof SELECTORS.FILE_INPUT).toBe('string');
  });
});

describe('insertText()', () => {
  beforeEach(() => {
    clearBody();
  });

  it('inserts text into contenteditable element found by CHAT_INPUT selector', () => {
    createEditor();

    // execCommand is not implemented in happy-dom, mock it
    const execCommandMock = vi.fn(() => true);
    document.execCommand = execCommandMock;

    const result = insertText('Hello MCP');

    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('insertText', false, expect.stringContaining('Hello MCP'));
  });

  it('returns false when no editor element is found', () => {
    // No editor in DOM
    const result = insertText('Hello');

    expect(result).toBe(false);
  });

  it('prepends newline when editor has existing content', () => {
    const editor = createEditor();
    editor.textContent = 'existing text';

    const execCommandMock = vi.fn(() => true);
    document.execCommand = execCommandMock;

    insertText('new text');

    const insertedText = execCommandMock.mock.calls[0][2] as string;
    expect(insertedText).toMatch(/^\n/);
    expect(insertedText).toContain('new text');
  });

  it('does not prepend newline when editor is empty', () => {
    createEditor();

    const execCommandMock = vi.fn(() => true);
    document.execCommand = execCommandMock;

    insertText('first text');

    const insertedText = execCommandMock.mock.calls[0][2] as string;
    expect(insertedText).toBe('first text');
  });

  it('dispatches InputEvent after insertion', () => {
    const editor = createEditor();
    document.execCommand = vi.fn(() => true);

    const dispatchSpy = vi.spyOn(editor, 'dispatchEvent');

    insertText('test');

    const inputEvents = dispatchSpy.mock.calls.filter(
      ([e]) => e instanceof InputEvent || (e as Event).type === 'input',
    );
    expect(inputEvents.length).toBeGreaterThan(0);
  });

  it('accepts a custom target element', () => {
    const customEditor = document.createElement('div');
    customEditor.contentEditable = 'true';
    document.body.appendChild(customEditor);

    const execCommandMock = vi.fn(() => true);
    document.execCommand = execCommandMock;

    const result = insertText('custom target', { targetElement: customEditor });

    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalled();
  });

  it('returns false and does not throw on execCommand exception', () => {
    createEditor();
    document.execCommand = vi.fn(() => { throw new Error('execCommand not allowed'); });

    expect(() => insertText('text')).not.toThrow();
    expect(insertText('text')).toBe(false);
  });
});

describe('submitForm()', () => {
  beforeEach(() => {
    clearBody();
  });

  it('clicks submit button when found', () => {
    const btn = createSubmitButton();
    const clickSpy = vi.spyOn(btn, 'click');

    const result = submitForm();

    expect(result).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('returns false when submit button is disabled', () => {
    createSubmitButton(true);

    const result = submitForm();

    expect(result).toBe(false);
  });

  it('returns false when submit button is not visible (zero dimensions)', () => {
    const btn = document.createElement('button');
    btn.className = 'fai-SendButton';
    Object.defineProperty(btn, 'getBoundingClientRect', {
      value: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    });
    document.body.appendChild(btn);

    const result = submitForm();

    expect(result).toBe(false);
  });

  it('falls back to Enter key on editor when no submit button found', () => {
    const editor = createEditor();
    const dispatchSpy = vi.spyOn(editor, 'dispatchEvent');

    const result = submitForm();

    expect(result).toBe(true);
    const keydownCalls = dispatchSpy.mock.calls.filter(
      ([e]) => (e as KeyboardEvent).key === 'Enter',
    );
    expect(keydownCalls.length).toBeGreaterThan(0);
  });

  it('returns false when no submit button and no editor', () => {
    const result = submitForm();

    expect(result).toBe(false);
  });
});

describe('attachFile()', () => {
  beforeEach(() => {
    clearBody();
  });

  it('injects file into #upload-file-button and dispatches change event', () => {
    const fileInput = createFileInput();
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });

    const dispatchSpy = vi.spyOn(fileInput, 'dispatchEvent');

    const result = attachFile(file);

    expect(result).toBe(true);
    const changeEvents = dispatchSpy.mock.calls.filter(
      ([e]) => (e as Event).type === 'change',
    );
    expect(changeEvents.length).toBeGreaterThan(0);
  });

  it('returns false for empty file', () => {
    createFileInput();
    const emptyFile = new File([], 'empty.txt');

    const result = attachFile(emptyFile);

    expect(result).toBe(false);
  });

  it('accepts a custom input element', () => {
    const customInput = document.createElement('input');
    customInput.type = 'file';
    document.body.appendChild(customInput);

    const file = new File(['data'], 'custom.txt', { type: 'text/plain' });
    const dispatchSpy = vi.spyOn(customInput, 'dispatchEvent');

    const result = attachFile(file, { inputElement: customInput });

    expect(result).toBe(true);
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('returns false when no file input found and no drag zone', () => {
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });

    const result = attachFile(file);

    expect(result).toBe(false);
  });
});

describe('findElement()', () => {
  beforeEach(() => {
    clearBody();
  });

  it('returns element immediately when it exists', async () => {
    const div = document.createElement('div');
    div.className = 'find-test';
    document.body.appendChild(div);

    const found = await findElement('.find-test', { maxAttempts: 1, intervalMs: 10 });

    expect(found).toBe(div);
  });

  it('returns null when element never appears within max attempts', async () => {
    const found = await findElement('.non-existent-element', { maxAttempts: 2, intervalMs: 5 });

    expect(found).toBeNull();
  });

  it('finds element that appears after a delay', async () => {
    let div: HTMLDivElement | null = null;

    // Append element after 30ms
    setTimeout(() => {
      div = document.createElement('div');
      div.className = 'delayed-element';
      document.body.appendChild(div);
    }, 30);

    const found = await findElement('.delayed-element', { maxAttempts: 10, intervalMs: 20 });

    expect(found).not.toBeNull();
  });
});
