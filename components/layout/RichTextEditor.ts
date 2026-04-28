/**
 * @module    RichTextEditor
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * RichTextEditor — full rich-text editor for AriannA.
 * Dedicated with love to Arianna. ♡
 *
 * A zero-dependency WYSIWYG editor built on the native `contenteditable` API.
 * Configurable toolbar, Markdown shortcut processing, HTML/text/Markdown output,
 * reactive State integration, and typed events on every change.
 *
 * ── TOOLBAR COMMANDS ─────────────────────────────────────────────────────────
 *   Formatting : 'bold' | 'italic' | 'underline' | 'strikethrough'
 *   Headings   : 'h1' | 'h2' | 'h3'
 *   Blocks     : 'p' | 'blockquote' | 'pre' (code block)
 *   Lists      : 'ul' | 'ol'
 *   Align      : 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
 *   Links      : 'link' | 'unlink'
 *   Media      : 'image' (prompt for URL)
 *   History    : 'undo' | 'redo'
 *   Utility    : 'clear' (clear all content) | '|' (separator)
 *
 * ── MARKDOWN SHORTCUTS ───────────────────────────────────────────────────────
 *   **text**    → <strong>text</strong>
 *   *text*      → <em>text</em>
 *   `text`      → <code>text</code>
 *   # heading   → <h1>
 *   ## heading  → <h2>
 *   ### heading → <h3>
 *
 * ── CONSTRUCTOR ──────────────────────────────────────────────────────────────
 *   new RichTextEditor({ placeholder, toolbar, minHeight, maxHeight, ... })
 *
 * ── INSTANCE API (fluent) ─────────────────────────────────────────────────────
 *   .html            → get/set innerHTML
 *   .text            → get innerText (no tags)
 *   .markdown        → get rough Markdown representation
 *   .isEmpty         → true if editor has no meaningful content
 *   .command(cmd, val?) → execute a toolbar command programmatically
 *   .focus()         → focus the editor
 *   .blur()          → blur the editor
 *   .clear()         → empty the editor
 *   .on(type, cb)    → subscribe to RichText events
 *   .off(type, cb)   → unsubscribe
 *   .render()        → return underlying root HTMLElement
 *   .append(parent)  → mount into parent
 *
 * ── EVENTS ────────────────────────────────────────────────────────────────────
 *   'RichText-Change'  → { Type, html, text, editor }  (fires on every keystroke)
 *   'RichText-Focus'   → { Type, editor }
 *   'RichText-Blur'    → { Type, html, text, editor }
 *   'RichText-Command' → { Type, command, value, editor }
 *
 * ── STATE INTEGRATION ────────────────────────────────────────────────────────
 *   Pair with AriannA State for fully reactive documents:
 *
 *   const state  = new State({ body: '' });
 *   const editor = new RichTextEditor({ placeholder: 'Start writing…' });
 *   editor.on('RichText-Change', e => state.State.body = e.html);
 *   // Programmatic write:
 *   state.on('State-body-Changed', e => { editor.html = e.Property.New as string; });
 *
 * @example
 *   // Basic usage with custom toolbar
 *   const editor = new RichTextEditor({
 *     placeholder: 'Start typing…',
 *     toolbar    : ['bold', 'italic', 'underline', '|', 'h1', 'h2', '|',
 *                   'ul', 'ol', '|', 'link', '|', 'undo', 'redo'],
 *     minHeight  : 200,
 *   });
 *   editor.append('#app');
 *
 * @example
 *   // Read/write content programmatically
 *   editor.html = '<h1>Title</h1><p>Body</p>';
 *   console.log(editor.text);      // → "Title\nBody"
 *   console.log(editor.markdown);  // → "# Title\n\nBody"
 *   console.log(editor.isEmpty);   // → false
 *
 * @example
 *   // Execute commands
 *   editor.command('bold');
 *   editor.command('insertHTML', '<img src="hero.png" alt="Hero">');
 *   editor.focus();
 *   editor.clear();
 *
 * @example
 *   // React to changes
 *   editor.on('RichText-Change',  e => console.log('html:', e.html));
 *   editor.on('RichText-Blur',    e => save(e.html));
 *   editor.on('RichText-Command', e => console.log(e.command));
 */

import { Observable }      from '../../core/Observable.ts';
import type { AriannAEvent } from '../../core/Observable.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

/** All valid toolbar command strings (plus `'|'` separator). */
export type ToolbarCommand =
  | 'bold' | 'italic' | 'underline' | 'strikethrough'
  | 'h1' | 'h2' | 'h3' | 'p' | 'blockquote' | 'pre'
  | 'ul' | 'ol'
  | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'link' | 'unlink' | 'image'
  | 'undo' | 'redo' | 'clear'
  | '|';

/** Event payload for all RichTextEditor events. */
export interface RichTextEvent extends AriannAEvent {
  html?    : string;
  text?    : string;
  command? : string;
  value?   : string;
  editor   : RichTextEditor;
}

/** Constructor options for `new RichTextEditor(opts)`. */
export interface RichTextEditorOptions {
  /** Placeholder text shown when editor is empty. Default: `'Start typing…'`. */
  placeholder? : string;
  /**
   * Toolbar commands. Default: full toolbar.
   *
   * @example
   *   ['bold', 'italic', '|', 'h1', 'h2', '|', 'ul', 'ol', '|', 'undo', 'redo']
   */
  toolbar?     : ToolbarCommand[];
  /** Minimum editor height in px. Default: `150`. */
  minHeight?   : number;
  /** Maximum editor height in px before scroll. Default: `Infinity`. */
  maxHeight?   : number;
  /** Enable browser spell-check. Default: `true`. */
  spellcheck?  : boolean;
  /**
   * Process inline Markdown shortcuts (`**bold**`, `*italic*`, `# heading`).
   * Default: `true`.
   */
  markdown?    : boolean;
  /** Initial HTML content. Default: `''`. */
  value?       : string;
}

// ── Toolbar button map ────────────────────────────────────────────────────────

interface ToolbarDef {
  label   : string;
  title   : string;
  exec    : (ed: RichTextEditor) => void;
  style?  : string;
}

const TOOLBAR_DEFS: Record<string, ToolbarDef> = {
  bold         : { label: 'B',          title: 'Bold (Ctrl+B)',        style: 'font-weight:700;',            exec: () => document.execCommand('bold') },
  italic       : { label: 'I',          title: 'Italic (Ctrl+I)',      style: 'font-style:italic;',          exec: () => document.execCommand('italic') },
  underline    : { label: 'U',          title: 'Underline (Ctrl+U)',   style: 'text-decoration:underline;',  exec: () => document.execCommand('underline') },
  strikethrough: { label: 'S̶',          title: 'Strikethrough',        style: 'text-decoration:line-through;',exec: () => document.execCommand('strikeThrough') },
  h1           : { label: 'H1',         title: 'Heading 1',                                                  exec: () => document.execCommand('formatBlock', false, 'h1') },
  h2           : { label: 'H2',         title: 'Heading 2',                                                  exec: () => document.execCommand('formatBlock', false, 'h2') },
  h3           : { label: 'H3',         title: 'Heading 3',                                                  exec: () => document.execCommand('formatBlock', false, 'h3') },
  p            : { label: 'P',          title: 'Paragraph',                                                  exec: () => document.execCommand('formatBlock', false, 'p') },
  blockquote   : { label: '❝',          title: 'Blockquote',                                                 exec: () => document.execCommand('formatBlock', false, 'blockquote') },
  pre          : { label: '‹›',         title: 'Code block',          style: 'font-family:monospace;',       exec: () => document.execCommand('formatBlock', false, 'pre') },
  ul           : { label: '• List',     title: 'Bullet list',                                                exec: () => document.execCommand('insertUnorderedList') },
  ol           : { label: '1. List',    title: 'Numbered list',                                              exec: () => document.execCommand('insertOrderedList') },
  alignLeft    : { label: '⫤',          title: 'Align left',                                                 exec: () => document.execCommand('justifyLeft') },
  alignCenter  : { label: '≡',          title: 'Align center',                                               exec: () => document.execCommand('justifyCenter') },
  alignRight   : { label: '⫥',          title: 'Align right',                                                exec: () => document.execCommand('justifyRight') },
  alignJustify : { label: '☰',          title: 'Justify',                                                    exec: () => document.execCommand('justifyFull') },
  link         : { label: '🔗',         title: 'Insert link',                                                exec: (ed) => {
    const url = prompt('URL:', 'https://');
    if (url) document.execCommand('createLink', false, url);
  }},
  unlink       : { label: '✂ link',    title: 'Remove link',                                                 exec: () => document.execCommand('unlink') },
  image        : { label: '🖼',         title: 'Insert image',                                                exec: () => {
    const url = prompt('Image URL:', 'https://');
    if (url) document.execCommand('insertHTML', false, `<img src="${url}" alt="" style="max-width:100%">`);
  }},
  undo         : { label: '↩',         title: 'Undo (Ctrl+Z)',                                               exec: () => document.execCommand('undo') },
  redo         : { label: '↪',         title: 'Redo (Ctrl+Y)',                                               exec: () => document.execCommand('redo') },
  clear        : { label: '🗑',         title: 'Clear all content',                                           exec: (ed) => ed.clear() },
};

/** Default toolbar — full feature set. */
const DEFAULT_TOOLBAR: ToolbarCommand[] = [
  'bold', 'italic', 'underline', 'strikethrough', '|',
  'h1', 'h2', 'h3', 'p', '|',
  'ul', 'ol', '|',
  'alignLeft', 'alignCenter', 'alignRight', '|',
  'link', 'unlink', 'image', '|',
  'undo', 'redo', '|',
  'clear',
];

// ── HTML → Markdown converter (minimal) ───────────────────────────────────────

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi,         '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi,         '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi,         '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi,           '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi,         '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi,           '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi,     '`$1`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>(.*?)<\/li>/gi,         '- $1\n')
    .replace(/<[^>]+>/g,                        '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// ── RichTextEditor ─────────────────────────────────────────────────────────────

let _rteCounter = 0;

export class RichTextEditor {

  // ── Private fields ────────────────────────────────────────────────────────────

  readonly #id       : string;
  readonly #obs      : Observable;
  readonly #opts     : Required<RichTextEditorOptions>;

  #root    : HTMLElement;
  #tb      : HTMLElement;
  #body    : HTMLDivElement;

  // ── Constructor ───────────────────────────────────────────────────────────────

  /**
   * Create a RichTextEditor.
   *
   * @param opts - Editor configuration options.
   *
   * @example
   *   const editor = new RichTextEditor({
   *     placeholder: 'Start typing…',
   *     toolbar    : ['bold', 'italic', '|', 'h1', 'h2', '|', 'ul', 'undo', 'redo'],
   *     minHeight  : 200,
   *   });
   *   editor.append('#composer');
   */
  constructor(opts: RichTextEditorOptions = {}) {
    this.#id   = `arianna-rte-${++_rteCounter}`;
    this.#obs  = new Observable();
    this.#opts = {
      placeholder: opts.placeholder ?? 'Start typing…',
      toolbar    : opts.toolbar     ?? DEFAULT_TOOLBAR,
      minHeight  : opts.minHeight   ?? 150,
      maxHeight  : opts.maxHeight   ?? Infinity,
      spellcheck : opts.spellcheck  ?? true,
      markdown   : opts.markdown    ?? true,
      value      : opts.value       ?? '',
    };

    // ── Root container ──────────────────────────────────────────────────────────
    this.#root = document.createElement('div');
    this.#root.id = this.#id;
    this.#root.className = 'arianna-wip-rte';
    this.#root.style.cssText = `display:flex;flex-direction:column;border:1px solid var(--border,#e0e0e0);border-radius:6px;overflow:hidden;`;

    // ── Toolbar ─────────────────────────────────────────────────────────────────
    this.#tb = document.createElement('div');
    this.#tb.className = 'arianna-wip-rte-toolbar';
    this.#tb.style.cssText = `display:flex;flex-wrap:wrap;gap:2px;padding:6px 8px;background:var(--bg3,#f5f5f5);border-bottom:1px solid var(--border,#e0e0e0);`;
    this.#buildToolbar();
    this.#root.appendChild(this.#tb);

    // ── Editable body ───────────────────────────────────────────────────────────
    this.#body = document.createElement('div');
    this.#body.className = 'arianna-wip-rte-body';
    this.#body.contentEditable = 'true';
    this.#body.spellcheck = this.#opts.spellcheck;
    this.#body.style.cssText = [
      `flex:1`,
      `padding:14px 16px`,
      `outline:none`,
      `font-size:.88rem`,
      `line-height:1.75`,
      `background:var(--bg2,#fff)`,
      `color:var(--text,#111)`,
      `min-height:${this.#opts.minHeight}px`,
      this.#opts.maxHeight !== Infinity ? `max-height:${this.#opts.maxHeight}px;overflow-y:auto;` : '',
    ].join(';');

    this.#root.appendChild(this.#body);

    // ── Initial value ───────────────────────────────────────────────────────────
    if (this.#opts.value) this.#body.innerHTML = this.#opts.value;

    // ── Placeholder ─────────────────────────────────────────────────────────────
    this.#wirePlaceholder();

    // ── Events ──────────────────────────────────────────────────────────────────
    this.#wireEvents();
  }

  // ── Public API ─────────────────────────────────────────────────────────────────

  /**
   * Get or set the editor's inner HTML content.
   *
   * @example
   *   editor.html = '<h1>Title</h1><p>Body text here.</p>';
   *   console.log(editor.html);
   */
  get html(): string { return this.#body.innerHTML; }
  set html(value: string) {
    this.#body.innerHTML = value;
    this.#updatePlaceholder();
  }

  /**
   * Get the editor content as plain text (no HTML tags).
   *
   * @example
   *   console.log(editor.text);  // → "Title\nBody text here."
   */
  get text(): string { return this.#body.innerText; }

  /**
   * Get a rough Markdown representation of the editor content.
   *
   * @example
   *   console.log(editor.markdown);  // → "# Title\n\nBody text here."
   */
  get markdown(): string { return htmlToMarkdown(this.#body.innerHTML); }

  /**
   * `true` if the editor has no meaningful content.
   *
   * @example
   *   if (editor.isEmpty) alert('Please write something!');
   */
  get isEmpty(): boolean {
    return !this.#body.textContent?.trim() && !this.#body.querySelector('img, video, iframe');
  }

  /**
   * Return the root container `HTMLElement`.
   *
   * @example
   *   document.body.appendChild(editor.render());
   */
  render(): HTMLElement { return this.#root; }

  /** Implicit coercion to `HTMLElement`. */
  valueOf(): HTMLElement { return this.#root; }

  /**
   * Mount the editor into a parent element.
   * Fluent — returns `this`.
   *
   * @example
   *   editor.append('#composer');
   *   editor.append(containerReal);
   */
  append(parent: string | Element | { render(): Element }): this {
    const par = typeof parent === 'string'
      ? document.querySelector(parent)
      : (parent instanceof Element ? parent : (parent as { render(): Element }).render());
    if (par) par.appendChild(this.#root);
    return this;
  }

  /**
   * Execute a toolbar command programmatically.
   * Optionally pass a value (for `insertHTML`, `createLink`, etc.).
   * Fluent — returns `this`.
   *
   * @param cmd - Toolbar command string.
   * @param val - Optional value for commands like `'insertHTML'`.
   *
   * @example
   *   editor.command('bold');
   *   editor.command('insertHTML', '<hr>');
   *   editor.command('h1');
   */
  command(cmd: ToolbarCommand | string, val?: string): this {
    this.#body.focus();
    const def = TOOLBAR_DEFS[cmd];
    if (def) {
      def.exec(this);
    } else if (val !== undefined) {
      document.execCommand(cmd, false, val);
    } else {
      document.execCommand(cmd);
    }
    this.#fireChange();
    this.#fire('RichText-Command', { command: cmd, value: val });
    return this;
  }

  /**
   * Focus the editor body.
   * Fluent — returns `this`.
   *
   * @example
   *   editor.focus();
   */
  focus(): this { this.#body.focus(); return this; }

  /**
   * Remove focus from the editor body.
   * Fluent — returns `this`.
   *
   * @example
   *   editor.blur();
   */
  blur(): this { this.#body.blur(); return this; }

  /**
   * Clear all editor content.
   * Fluent — returns `this`.
   *
   * @example
   *   editor.clear();
   */
  clear(): this {
    this.#body.innerHTML = '';
    this.#updatePlaceholder();
    this.#fireChange();
    return this;
  }

  /**
   * Register a listener for RichTextEditor events.
   * Fluent — returns `this`.
   *
   * @example
   *   editor.on('RichText-Change',  e => save(e.html));
   *   editor.on('RichText-Blur',    e => validate(e.html));
   *   editor.on('RichText-Command', e => console.log(e.command));
   */
  on(type: string, cb: (e: RichTextEvent) => void): this {
    this.#obs.on(type, cb as (e: AriannAEvent) => void);
    return this;
  }

  /**
   * Remove a RichTextEditor event listener.
   * Fluent — returns `this`.
   *
   * @example
   *   editor.off('RichText-Change', handler);
   */
  off(type: string, cb: (e: RichTextEvent) => void): this {
    this.#obs.off(type, cb as (e: AriannAEvent) => void);
    return this;
  }

  // ── Private helpers ────────────────────────────────────────────────────────────

  #fire(type: string, extra: Partial<RichTextEvent> = {}): void {
    this.#obs.fire({
      Type  : type,
      editor: this,
      ...extra,
    } as unknown as AriannAEvent);
  }

  #fireChange(): void {
    this.#fire('RichText-Change', { html: this.html, text: this.text });
  }

  #buildToolbar(): void {
    this.#opts.toolbar.forEach(cmd => {
      if (cmd === '|') {
        const sep = document.createElement('span');
        sep.style.cssText = `width:1px;background:var(--border,#e0e0e0);height:18px;display:inline-block;margin:0 4px;vertical-align:middle;align-self:center;`;
        this.#tb.appendChild(sep);
        return;
      }
      const def = TOOLBAR_DEFS[cmd];
      if (!def) return;
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.title     = def.title;
      btn.innerHTML = def.label;
      btn.className = 'arianna-wip-rte-btn';
      btn.style.cssText = [
        `background:var(--bg2,#fff)`,
        `border:1px solid var(--border,#e0e0e0)`,
        `border-radius:4px`,
        `cursor:pointer`,
        `font:inherit`,
        `font-size:.75rem`,
        `padding:3px 7px`,
        `color:var(--text,#111)`,
        `line-height:1.4`,
        def.style ?? '',
      ].join(';');

      btn.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();  // prevent editor losing focus
        this.#body.focus();
        def.exec(this);
        this.#fireChange();
        this.#fire('RichText-Command', { command: cmd });
      });

      this.#tb.appendChild(btn);
    });
  }

  #wirePlaceholder(): void {
    const ph = this.#opts.placeholder;
    // Use CSS ::before for placeholder — inject a scoped <style>
    const style = document.createElement('style');
    style.textContent = `
      #${this.#id} .arianna-rte-body:empty::before {
        content   : attr(data-placeholder);
        color     : var(--muted, #aaa);
        pointer-events: none;
        position  : absolute;
      }
      #${this.#id} .arianna-rte-body { position: relative; }
    `;
    this.#root.prepend(style);
    this.#body.dataset.placeholder = ph;
    this.#updatePlaceholder();
  }

  #updatePlaceholder(): void {
    // No extra action needed — CSS ::before handles it
  }

  #wireEvents(): void {
    // Change
    this.#body.addEventListener('input', () => {
      if (this.#opts.markdown) this.#processMarkdown();
      this.#fireChange();
    });

    // Focus
    this.#body.addEventListener('focus', () => {
      this.#fire('RichText-Focus');
    });

    // Blur
    this.#body.addEventListener('blur', () => {
      this.#fire('RichText-Blur', { html: this.html, text: this.text });
    });

    // Keyboard shortcuts
    this.#body.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.ctrlKey || ke.metaKey) {
        switch (ke.key.toLowerCase()) {
          case 'b': ke.preventDefault(); this.command('bold');      break;
          case 'i': ke.preventDefault(); this.command('italic');    break;
          case 'u': ke.preventDefault(); this.command('underline'); break;
          case 'z': if (!ke.shiftKey) { ke.preventDefault(); this.command('undo'); } break;
          case 'y': ke.preventDefault(); this.command('redo');      break;
        }
      }
    });
  }

  /**
   * Process inline Markdown shortcuts on Space or Enter.
   * Called only when `opts.markdown` is `true`.
   * @internal
   */
  #processMarkdown(): void {
    const sel   = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node  = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const text  = node.textContent ?? '';

    // # heading shortcuts (at line start)
    const headMatch = text.match(/^(#{1,3})\s(.+)$/);
    if (headMatch) {
      const level = headMatch[1].length;
      const content = headMatch[2];
      document.execCommand('formatBlock', false, `h${level}`);
      if (node.parentElement) node.parentElement.textContent = content;
      // Place cursor at end
      const range = document.createRange();
      const el = sel.anchorNode?.parentElement;
      if (el) { range.selectNodeContents(el); range.collapse(false); sel.removeAllRanges(); sel.addRange(range); }
    }
  }
}

// ── Global registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
  Object.defineProperty(window, 'RichTextEditor', {
    enumerable: true, configurable: false, writable: false, value: RichTextEditor,
  });

export default RichTextEditor;
