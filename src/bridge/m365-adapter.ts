/**
 * M365 Copilot DOM Adapter.
 *
 * Provides insertText, submitForm, attachFile, and findElement utilities
 * for interacting with the Microsoft 365 Copilot Chat Lexical editor.
 *
 * Extracted from pages/content/src/plugins/adapters/m365copilot.adapter.ts.
 * No base class, no plugin system — just exported functions.
 */

// ── Selectors ─────────────────────────────────────────────────────────────────

export const SELECTORS = {
  /** Lexical contenteditable editor */
  CHAT_INPUT: [
    '#m365-chat-editor-target-element',
    '[aria-label="Send a message to Copilot"][contenteditable="true"]',
    '[aria-label="傳送訊息給 Copilot"][contenteditable="true"]',
    '.fai-EditorInput__input[contenteditable="true"]',
  ].join(', '),

  /** Send / submit button (only visible when editor has text) */
  SUBMIT_BUTTON: [
    '.fai-SendButton',
    '.fai-ChatInput__send',
    'button[type="submit"][aria-label="Send"]',
    'button[type="submit"][aria-label="傳送"]',
  ].join(', '),

  /** Always-present hidden file input */
  FILE_INPUT: '#upload-file-button',

  /** Whole chat input wrapper (used as drag-drop fallback zone) */
  CHAT_INPUT_WRAPPER: '.fai-ChatInput, #m365-chat-input-shared-wrapper',
} as const;

// ── Options types ─────────────────────────────────────────────────────────────

export interface InsertTextOptions {
  readonly targetElement?: HTMLElement;
}

export interface AttachFileOptions {
  readonly inputElement?: HTMLInputElement;
}

export interface FindElementOptions {
  readonly maxAttempts?: number;
  readonly intervalMs?: number;
}

// ── insertText ────────────────────────────────────────────────────────────────

/**
 * Insert text into the M365 Copilot Lexical editor.
 * Uses document.execCommand('insertText') which is confirmed working on this editor.
 *
 * Returns true on success, false when the editor could not be found or insertion failed.
 */
export function insertText(text: string, options?: InsertTextOptions): boolean {
  const editor = resolveEditor(options?.targetElement);
  if (!editor) return false;

  try {
    editor.focus();

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const existingText = editor.textContent ?? '';
    const insertContent = existingText.trim() ? '\n' + text : text;

    const success = document.execCommand('insertText', false, insertContent);

    editor.dispatchEvent(
      new InputEvent('input', {
        inputType: 'insertText',
        data: insertContent,
        bubbles: true,
        cancelable: true,
      }),
    );

    return success;
  } catch {
    return false;
  }
}

// ── submitForm ────────────────────────────────────────────────────────────────

/**
 * Submit the M365 Copilot chat form.
 * Prefers clicking the send button; falls back to Enter key on the editor.
 *
 * Returns true on success, false when both strategies fail.
 */
export function submitForm(): boolean {
  const submitButton = resolveSubmitButton();

  if (submitButton) {
    if (submitButton.disabled) return false;

    const rect = submitButton.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    try {
      submitButton.click();
      return true;
    } catch {
      return false;
    }
  }

  // Fallback: dispatch Enter key on the editor
  const editor = document.querySelector(SELECTORS.CHAT_INPUT) as HTMLElement | null;
  if (editor) {
    editor.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
    );
    editor.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }),
    );
    return true;
  }

  return false;
}

// ── attachFile ────────────────────────────────────────────────────────────────

/**
 * Attach a file to the M365 Copilot chat input.
 *
 * Primary strategy: inject directly into the always-present hidden file input
 * (#upload-file-button) via DataTransfer and fire 'change'.
 *
 * Fallback: drag-drop simulation onto the chat input wrapper.
 *
 * Returns false for empty/null file or when all strategies fail.
 */
export function attachFile(file: File, options?: AttachFileOptions): boolean {
  if (!file || file.size === 0) return false;

  const fileInput = options?.inputElement
    ?? (document.querySelector(SELECTORS.FILE_INPUT) as HTMLInputElement | null);

  if (fileInput) {
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    } catch {
      // Fall through to drag-drop
    }
  }

  // Fallback: drag-drop simulation
  const dropZone = resolveDropZone();
  if (dropZone) {
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
      dropZone.dispatchEvent(new DragEvent('dragover',  { bubbles: true, dataTransfer: dt }));
      dropZone.dispatchEvent(new DragEvent('drop',      { bubbles: true, dataTransfer: dt }));
      return true;
    } catch {
      // Fall through
    }
  }

  return false;
}

// ── findElement ───────────────────────────────────────────────────────────────

/**
 * Retry-based element finder for SPA-delayed elements.
 * Polls every intervalMs until the element appears or maxAttempts is reached.
 */
export function findElement(
  selector: string,
  options?: FindElementOptions,
): Promise<HTMLElement | null> {
  const maxAttempts = options?.maxAttempts ?? 20;
  const intervalMs = options?.intervalMs ?? 500;

  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) return resolve(el);
      if (attempts >= maxAttempts) return resolve(null);
      setTimeout(check, intervalMs);
    };

    check();
  });
}

// ── Private helpers ───────────────────────────────────────────────────────────

function resolveEditor(override?: HTMLElement): HTMLElement | null {
  if (override) return override;

  for (const selector of SELECTORS.CHAT_INPUT.split(', ')) {
    const el = document.querySelector(selector.trim()) as HTMLElement | null;
    if (el) return el;
  }

  return null;
}

function resolveSubmitButton(): HTMLButtonElement | null {
  for (const selector of SELECTORS.SUBMIT_BUTTON.split(', ')) {
    const el = document.querySelector(selector.trim()) as HTMLButtonElement | null;
    if (el) return el;
  }

  return null;
}

function resolveDropZone(): HTMLElement | null {
  for (const selector of SELECTORS.CHAT_INPUT_WRAPPER.split(', ')) {
    const el = document.querySelector(selector.trim()) as HTMLElement | null;
    if (el) return el;
  }

  return null;
}
