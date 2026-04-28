/**
 * @module    Window
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Window — native-style floating window control for AriannA.
 * Dedicated with love to Arianna. ♡
 *
 * A fully draggable, resizable floating window with platform-authentic
 * title-bar chrome. Integrates with State and Observable — every interaction
 * fires a typed event and can drive reactive UI updates.
 *
 * ── CHROME STYLES ────────────────────────────────────────────────────────────
 *   'macos'   → traffic-light buttons (● ● ●), centred title, no border-radius loss
 *   'windows' → Fluent Design header (#0078D4), right-aligned ─ □ ✕ controls
 *   'linux'   → dark header (#2d2d2d), left-aligned ● ● ● circles
 *   'none'    → bare container, no title bar (you supply your own)
 *
 * ── CONSTRUCTOR ──────────────────────────────────────────────────────────────
 *   new Window({ title, chrome, width, height, x, y, content, resizable, ... })
 *
 * ── INSTANCE API (fluent) ─────────────────────────────────────────────────────
 *   .open()           → show (if previously closed)
 *   .close()          → hide + fire 'Window-Close'
 *   .minimize()       → collapse to title bar + fire 'Window-Minimize'
 *   .maximize()       → fill parent + fire 'Window-Maximize'
 *   .restore()        → return to previous size/position
 *   .focus()          → bring to front (z-index)
 *   .moveTo(x, y)     → set position
 *   .center()         → centre in parent
 *   .resize(w, h)     → set size (respects minWidth/minHeight)
 *   .setTitle(str)    → update title bar text
 *   .setContent(html|Real|VirtualNode) → replace body content
 *   .on(type, cb)     → subscribe to Window events
 *   .off(type, cb)    → unsubscribe
 *   .render()         → return underlying HTMLElement
 *   .append(parent)   → mount into a parent element
 *
 * ── EVENTS ────────────────────────────────────────────────────────────────────
 *   'Window-Open'     → { Type, window }
 *   'Window-Close'    → { Type, window }
 *   'Window-Minimize' → { Type, window }
 *   'Window-Maximize' → { Type, window }
 *   'Window-Restore'  → { Type, window }
 *   'Window-Focus'    → { Type, window }
 *   'Window-Move'     → { Type, window, x, y }
 *   'Window-Resize'   → { Type, window, width, height }
 *
 * @example
 *   // macOS-style window
 *   const win = new Window({
 *     title  : 'My Window',
 *     chrome : 'macos',
 *     width  : 640,
 *     height : 480,
 *     content: '<p>Hello from AriannA Window!</p>',
 *   });
 *   win.append('#app');
 *
 * @example
 *   // Windows-style, reactive content
 *   const state = new State({ count: 0 });
 *   const win = new Window({ title: 'Counter', chrome: 'windows', width: 320, height: 200 });
 *   const btn  = new Real('button').set('textContent', '+ Increment')
 *                 .on('click', () => state.State.count++);
 *   win.setContent(btn.render());
 *   win.append('#desktop');
 *
 * @example
 *   // React to window events
 *   win.on('Window-Move',   e => console.log('moved to', e.x, e.y));
 *   win.on('Window-Resize', e => console.log('resized to', e.width, e.height));
 *   win.on('Window-Close',  () => cleanup());
 *
 * @example
 *   // Programmatic control
 *   win.moveTo(200, 100);
 *   win.resize(800, 600);
 *   win.center();
 *   win.minimize();
 *   win.restore();
 *   win.focus();
 */

import Real               from '../../core/Real.ts';
import { Observable }     from '../../core/Observable.ts';
import type { AriannAEvent } from '../../core/Observable.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Platform chrome style for the Window title bar. */
export type WindowChrome = 'macos' | 'windows' | 'linux' | 'none';

/** Window state machine values. */
export type WindowState = 'normal' | 'minimized' | 'maximized' | 'closed';

/** Event payload for all Window events. */
export interface WindowEvent extends AriannAEvent {
  window : Window;
  x?     : number;
  y?     : number;
  width? : number;
  height?: number;
}

/** Constructor options for `new Window(opts)`. */
export interface WindowOptions {
  /** Title bar label. Default: `'Window'`. */
  title?     : string;
  /** Platform chrome style. Default: `'macos'`. */
  chrome?    : WindowChrome;
  /** Initial width in px. Default: `640`. */
  width?     : number;
  /** Initial height in px. Default: `480`. */
  height?    : number;
  /** Initial X position in px. Default: auto-centred. */
  x?         : number;
  /** Initial Y position in px. Default: auto-centred. */
  y?         : number;
  /** Body content — HTML string, Element, Real, or VirtualNode. */
  content?   : string | Element | Real | { render(): Element };
  /** Allow drag-resize from edges and corners. Default: `true`. */
  resizable? : boolean;
  /** Allow drag by title bar. Default: `true`. */
  draggable? : boolean;
  /** Block interaction outside window (modal overlay). Default: `false`. */
  modal?     : boolean;
  /** Minimum width in px. Default: `200`. */
  minWidth?  : number;
  /** Minimum height in px. Default: `120`. */
  minHeight? : number;
  /** Show window immediately on creation. Default: `true`. */
  visible?   : boolean;
}

// ── Chrome builders ───────────────────────────────────────────────────────────

/** Title-bar height per chrome style (px). */
const CHROME_HEIGHT: Record<WindowChrome, number> = {
  macos  : 38,
  windows: 30,
  linux  : 28,
  none   : 0,
};

/** CSS for each chrome. */
const CHROME_CSS: Record<WindowChrome, string> = {
  macos  : 'background:#e0e0e0;border-radius:8px 8px 0 0;',
  windows: 'background:#0078D4;border-radius:4px 4px 0 0;',
  linux  : 'background:#2d2d2d;border-radius:4px 4px 0 0;',
  none   : 'display:none;',
};

/** Border-radius for the outer window per chrome style. */
const CHROME_RADIUS: Record<WindowChrome, string> = {
  macos  : '8px',
  windows: '4px',
  linux  : '4px',
  none   : '4px',
};

/**
 * Build the inner HTML for the title bar.
 * @internal
 */
function buildTitleBar(chrome: WindowChrome, title: string, id: string): string {
  const css  = CHROME_CSS[chrome];
  const base = `class="arianna-win-tb" data-win="${id}" style="${css}display:flex;align-items:center;width:100%;box-sizing:border-box;user-select:none;cursor:move;"`;

  switch (chrome) {
    case 'macos':
      return `<div ${base} style="${css}display:flex;align-items:center;padding:0 12px;height:38px;gap:6px;cursor:move;">
        <button class="arianna-win-btn arianna-win-close" data-action="close" data-win="${id}"
          style="width:12px;height:12px;border-radius:50%;background:#ff5f57;border:none;cursor:pointer;flex-shrink:0;padding:0;"></button>
        <button class="arianna-win-btn arianna-win-minimize" data-action="minimize" data-win="${id}"
          style="width:12px;height:12px;border-radius:50%;background:#febc2e;border:none;cursor:pointer;flex-shrink:0;padding:0;"></button>
        <button class="arianna-win-btn arianna-win-maximize" data-action="maximize" data-win="${id}"
          style="width:12px;height:12px;border-radius:50%;background:#28c840;border:none;cursor:pointer;flex-shrink:0;padding:0;"></button>
        <span class="arianna-win-title" data-win="${id}"
          style="flex:1;text-align:center;font-size:13px;font-weight:500;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
      </div>`;

    case 'windows':
      return `<div ${base} style="${css}display:flex;align-items:center;padding:0 0 0 10px;height:30px;cursor:move;">
        <span class="arianna-win-title" data-win="${id}"
          style="flex:1;font-size:12px;font-weight:500;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
        <button class="arianna-win-btn arianna-win-minimize" data-action="minimize" data-win="${id}"
          style="background:none;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;padding:0 12px;height:30px;">─</button>
        <button class="arianna-win-btn arianna-win-maximize" data-action="maximize" data-win="${id}"
          style="background:none;border:none;color:#fff;cursor:pointer;font-size:12px;line-height:1;padding:0 12px;height:30px;">□</button>
        <button class="arianna-win-btn arianna-win-close" data-action="close" data-win="${id}"
          style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;line-height:1;padding:0 12px;height:30px;">✕</button>
      </div>`;

    case 'linux':
      return `<div ${base} style="${css}display:flex;align-items:center;padding:0 10px;height:28px;gap:6px;cursor:move;">
        <button class="arianna-win-btn arianna-win-close" data-action="close" data-win="${id}"
          style="width:10px;height:10px;border-radius:50%;background:#ff5f57;border:none;cursor:pointer;flex-shrink:0;padding:0;"></button>
        <button class="arianna-win-btn arianna-win-minimize" data-action="minimize" data-win="${id}"
          style="width:10px;height:10px;border-radius:50%;background:#febc2e;border:none;cursor:pointer;flex-shrink:0;padding:0;"></button>
        <button class="arianna-win-btn arianna-win-maximize" data-action="maximize" data-win="${id}"
          style="width:10px;height:10px;border-radius:50%;background:#28c840;border:none;cursor:pointer;flex-shrink:0;padding:0;"></button>
        <span class="arianna-win-title" data-win="${id}"
          style="flex:1;text-align:center;font-size:12px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
      </div>`;

    default:
      return '';
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

let _winCounter = 0;

/** All Window instances ever created. */
const _instances: Window[] = [];

export class Window {

  // ── Static ──────────────────────────────────────────────────────────────────

  /** All Window instances. */
  static get Instances(): Window[] { return _instances; }

  /**
   * Find a Window instance by its DOM id.
   *
   * @example
   *   Window.GetById('arianna-wip-win-3')  // → Window | undefined
   */
  static GetById(id: string): Window | undefined {
    return _instances.find(w => w.#id === id);
  }

  /**
   * Close all open Window instances.
   *
   * @example
   *   Window.CloseAll();
   */
  static CloseAll(): void {
    _instances.forEach(w => { if (w.#state !== 'closed') w.close(); });
  }

  // ── Private fields ───────────────────────────────────────────────────────────

  readonly #id     : string;
  readonly #obs    : Observable;
  readonly #opts   : Required<WindowOptions>;

  #el       : HTMLElement;
  #tb       : HTMLElement;
  #body     : HTMLElement;
  #overlay  : HTMLElement | null = null;
  #state    : WindowState = 'normal';

  // Saved dimensions for restore after maximize
  #savedX      : number;
  #savedY      : number;
  #savedW      : number;
  #savedH      : number;

  // ── Constructor ──────────────────────────────────────────────────────────────

  /**
   * Create a Window.
   *
   * @param opts - Window configuration options.
   *
   * @example
   *   const win = new Window({
   *     title  : 'AriannA Window',
   *     chrome : 'macos',
   *     width  : 640,
   *     height : 480,
   *   });
   *   win.append('#desktop');
   */
  constructor(opts: WindowOptions = {}) {
    this.#id  = `arianna-win-${++_winCounter}`;
    this.#obs = new Observable();
    this.#opts = {
      title    : opts.title     ?? 'Window',
      chrome   : opts.chrome    ?? 'macos',
      width    : opts.width     ?? 640,
      height   : opts.height    ?? 480,
      x        : opts.x         ?? -1,      // -1 = auto-centre on append
      y        : opts.y         ?? -1,
      content  : opts.content   ?? '',
      resizable: opts.resizable ?? true,
      draggable: opts.draggable ?? true,
      modal    : opts.modal     ?? false,
      minWidth : opts.minWidth  ?? 200,
      minHeight: opts.minHeight ?? 120,
      visible  : opts.visible   ?? true,
    };

    this.#savedX = this.#opts.x;
    this.#savedY = this.#opts.y;
    this.#savedW = this.#opts.width;
    this.#savedH = this.#opts.height;

    // ── Build DOM ──────────────────────────────────────────────────────────────
    const chromeH = CHROME_HEIGHT[this.#opts.chrome];
    const radius  = CHROME_RADIUS[this.#opts.chrome];

    this.#el = document.createElement('div');
    this.#el.id = this.#id;
    this.#el.className = 'arianna-wip-window';
    this.#el.style.cssText = [
      `position:absolute`,
      `width:${this.#opts.width}px`,
      `height:${this.#opts.height}px`,
      `border-radius:${radius}`,
      `overflow:hidden`,
      `box-shadow:0 8px 32px rgba(0,0,0,.22)`,
      `border:1px solid rgba(0,0,0,.15)`,
      `user-select:none`,
      `display:${this.#opts.visible ? 'flex' : 'none'}`,
      `flex-direction:column`,
      `z-index:${1000 + _winCounter}`,
    ].join(';');

    // Title bar
    const tbWrap = document.createElement('div');
    tbWrap.innerHTML = buildTitleBar(this.#opts.chrome, this.#opts.title, this.#id);
    this.#tb = tbWrap.firstElementChild as HTMLElement;
    this.#el.appendChild(this.#tb);

    // Body
    this.#body = document.createElement('div');
    this.#body.className = 'arianna-wip-window-body';
    this.#body.style.cssText = `flex:1;overflow:auto;background:var(--bg2,#fff);`;
    this.#setContent(this.#opts.content);
    this.#el.appendChild(this.#body);

    // ── Wire interactions ──────────────────────────────────────────────────────
    this.#wireButtons();
    if (this.#opts.draggable) this.#wireDrag();
    if (this.#opts.resizable) this.#wireResize();
    if (this.#opts.modal)     this.#buildOverlay();

    _instances.push(this);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Unique DOM id of this window element. */
  get id(): string { return this.#id; }

  /** Current window state: `'normal' | 'minimized' | 'maximized' | 'closed'`. */
  get state(): WindowState { return this.#state; }

  /** Current width in px. */
  get width(): number  { return this.#el.offsetWidth; }

  /** Current height in px. */
  get height(): number { return this.#el.offsetHeight; }

  /** Current X position in px relative to parent. */
  get x(): number { return this.#el.offsetLeft; }

  /** Current Y position in px relative to parent. */
  get y(): number { return this.#el.offsetTop; }

  /**
   * Return the underlying window `HTMLElement`.
   *
   * @example
   *   document.body.appendChild(win.render());
   */
  render(): HTMLElement { return this.#el; }

  /** Implicit coercion to `HTMLElement`. */
  valueOf(): HTMLElement { return this.#el; }

  /**
   * Mount this window into a parent element.
   * Auto-centres if `x` / `y` were not specified.
   * Fluent — returns `this`.
   *
   * @example
   *   win.append('#desktop');
   *   win.append(containerReal);
   */
  append(parent: string | Element | Real | { render(): Element }): this {
    let par: Element | null = null;
    if (typeof parent === 'string')              par = document.querySelector(parent);
    else if (parent instanceof Element)          par = parent;
    else if (parent instanceof Real)             par = parent.render();
    else if (typeof (parent as { render(): Element }).render === 'function') par = (parent as { render(): Element }).render();

    if (!par) return this;
    par.appendChild(this.#el);

    // Auto-centre if position not specified
    if (this.#opts.x === -1 || this.#opts.y === -1) this.center();
    else { this.#el.style.left = `${this.#opts.x}px`; this.#el.style.top = `${this.#opts.y}px`; }

    if (this.#overlay) par.appendChild(this.#overlay);
    this.#fire('Window-Open');
    return this;
  }

  /**
   * Show the window (if previously closed or hidden).
   * Fluent — returns `this`.
   *
   * @example
   *   win.open();
   */
  open(): this {
    if (this.#state === 'closed') {
      this.#el.style.display = 'flex';
      this.#state = 'normal';
      this.#fire('Window-Open');
    }
    return this;
  }

  /**
   * Close and hide the window. Fires `'Window-Close'`.
   * Fluent — returns `this`.
   *
   * @example
   *   win.close();
   */
  close(): this {
    this.#el.style.display = 'none';
    if (this.#overlay) this.#overlay.style.display = 'none';
    this.#state = 'closed';
    this.#fire('Window-Close');
    return this;
  }

  /**
   * Minimize the window (collapse to title-bar height).
   * Fires `'Window-Minimize'`. Fluent.
   *
   * @example
   *   win.minimize();
   */
  minimize(): this {
    if (this.#state === 'minimized') return this;
    const chromeH = CHROME_HEIGHT[this.#opts.chrome];
    this.#body.style.display = 'none';
    this.#el.style.height    = `${chromeH}px`;
    this.#el.style.resize    = 'none';
    this.#state = 'minimized';
    this.#fire('Window-Minimize');
    return this;
  }

  /**
   * Maximize the window (fill the parent container).
   * Fires `'Window-Maximize'`. Fluent.
   *
   * @example
   *   win.maximize();
   */
  maximize(): this {
    if (this.#state === 'maximized') return this;
    // Save current dimensions
    this.#savedX = this.#el.offsetLeft;
    this.#savedY = this.#el.offsetTop;
    this.#savedW = this.#el.offsetWidth;
    this.#savedH = this.#el.offsetHeight;

    this.#el.style.left   = '0';
    this.#el.style.top    = '0';
    this.#el.style.width  = '100%';
    this.#el.style.height = '100%';
    this.#body.style.display = '';
    this.#state = 'maximized';
    this.#fire('Window-Maximize');
    return this;
  }

  /**
   * Restore the window to its previous size and position.
   * Fires `'Window-Restore'`. Fluent.
   *
   * @example
   *   win.restore();
   */
  restore(): this {
    this.#el.style.left   = `${this.#savedX}px`;
    this.#el.style.top    = `${this.#savedY}px`;
    this.#el.style.width  = `${this.#savedW}px`;
    this.#el.style.height = `${this.#savedH}px`;
    this.#body.style.display = '';
    this.#state = 'normal';
    this.#fire('Window-Restore');
    return this;
  }

  /**
   * Bring this window to the front (raise z-index).
   * Fluent — returns `this`.
   *
   * @example
   *   win.focus();
   */
  focus(): this {
    const maxZ = Math.max(..._instances.map(w => parseInt(w.#el.style.zIndex || '0', 10)));
    this.#el.style.zIndex = String(maxZ + 1);
    this.#fire('Window-Focus');
    return this;
  }

  /**
   * Move the window to an absolute position within its parent.
   * Fluent — returns `this`.
   *
   * @param x - Left offset in px.
   * @param y - Top offset in px.
   *
   * @example
   *   win.moveTo(200, 150);
   */
  moveTo(x: number, y: number): this {
    this.#el.style.left = `${x}px`;
    this.#el.style.top  = `${y}px`;
    this.#fire('Window-Move', { x, y });
    return this;
  }

  /**
   * Centre the window within its parent element.
   * Fluent — returns `this`.
   *
   * @example
   *   win.center();
   */
  center(): this {
    const parent = this.#el.parentElement;
    if (!parent) return this;
    const px = (parent.clientWidth  - this.#el.offsetWidth)  / 2;
    const py = (parent.clientHeight - this.#el.offsetHeight) / 2;
    return this.moveTo(Math.max(0, px), Math.max(0, py));
  }

  /**
   * Resize the window. Respects `minWidth` and `minHeight`.
   * Fluent — returns `this`.
   *
   * @param width  - New width in px.
   * @param height - New height in px.
   *
   * @example
   *   win.resize(800, 600);
   */
  resize(width: number, height: number): this {
    const w = Math.max(this.#opts.minWidth,  width);
    const h = Math.max(this.#opts.minHeight, height);
    this.#el.style.width  = `${w}px`;
    this.#el.style.height = `${h}px`;
    this.#fire('Window-Resize', { width: w, height: h });
    return this;
  }

  /**
   * Update the title bar label.
   * Fluent — returns `this`.
   *
   * @example
   *   win.setTitle('New Window Title');
   */
  setTitle(title: string): this {
    this.#el.querySelectorAll(`.arianna-win-title[data-win="${this.#id}"]`).forEach(el => {
      el.textContent = title;
    });
    return this;
  }

  /**
   * Replace the window body content.
   * Accepts an HTML string, a native `Element`, a `Real` node, or any `{render()}` object.
   * Fluent — returns `this`.
   *
   * @example
   *   win.setContent('<p>New content</p>');
   *   win.setContent(myRealNode);
   *   win.setContent(document.createElement('canvas'));
   */
  setContent(content: string | Element | Real | { render(): Element }): this {
    this.#setContent(content);
    return this;
  }

  /**
   * Register a listener for Window events.
   * Fluent — returns `this`.
   *
   * @example
   *   win.on('Window-Close',  () => cleanup());
   *   win.on('Window-Move',   e  => console.log(e.x, e.y));
   *   win.on('Window-Resize', e  => console.log(e.width, e.height));
   */
  on(type: string, cb: (e: WindowEvent) => void): this {
    this.#obs.on(type, cb as (e: AriannAEvent) => void);
    return this;
  }

  /**
   * Remove a Window event listener.
   * Fluent — returns `this`.
   *
   * @example
   *   win.off('Window-Close', handler);
   */
  off(type: string, cb: (e: WindowEvent) => void): this {
    this.#obs.off(type, cb as (e: AriannAEvent) => void);
    return this;
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  #fire(type: string, extra: Partial<WindowEvent> = {}): void {
    this.#obs.fire({ Type: type, window: this, ...extra } as AriannAEvent);
  }

  #setContent(content: string | Element | Real | { render(): Element } | ''): void {
    this.#body.innerHTML = '';
    if (!content) return;
    if (typeof content === 'string') {
      this.#body.innerHTML = content;
    } else if (content instanceof Element) {
      this.#body.appendChild(content);
    } else if (content instanceof Real) {
      this.#body.appendChild(content.render());
    } else if (typeof (content as { render(): Element }).render === 'function') {
      this.#body.appendChild((content as { render(): Element }).render());
    }
  }

  #wireButtons(): void {
    this.#el.addEventListener('click', (e: Event) => {
      const btn = (e.target as Element).closest('[data-action]') as HTMLElement | null;
      if (!btn || btn.dataset.win !== this.#id) return;
      e.stopPropagation();
      switch (btn.dataset.action) {
        case 'close':    this.close();    break;
        case 'minimize': this.#state === 'minimized' ? this.restore() : this.minimize(); break;
        case 'maximize': this.#state === 'maximized' ? this.restore() : this.maximize(); break;
      }
    });
  }

  #wireDrag(): void {
    let dragging = false, ox = 0, oy = 0;

    this.#tb.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as Element).closest('[data-action]')) return;
      if (this.#state === 'maximized') return;
      dragging = true;
      ox = e.clientX - this.#el.offsetLeft;
      oy = e.clientY - this.#el.offsetTop;
      this.focus();
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!dragging) return;
      const parent = this.#el.parentElement;
      const maxX = parent ? parent.clientWidth  - this.#el.offsetWidth  : window.innerWidth;
      const maxY = parent ? parent.clientHeight - this.#el.offsetHeight : window.innerHeight;
      const nx = Math.max(0, Math.min(maxX, e.clientX - ox));
      const ny = Math.max(0, Math.min(maxY, e.clientY - oy));
      this.#el.style.left = `${nx}px`;
      this.#el.style.top  = `${ny}px`;
      this.#fire('Window-Move', { x: nx, y: ny });
    });

    document.addEventListener('mouseup', () => { dragging = false; });
  }

  #wireResize(): void {
    // 8-directional resize via a resize handle at bottom-right
    const handle = document.createElement('div');
    handle.style.cssText = `position:absolute;bottom:0;right:0;width:12px;height:12px;cursor:se-resize;z-index:10;`;
    this.#el.style.position = 'absolute';
    this.#el.appendChild(handle);

    let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      startW = this.#el.offsetWidth; startH = this.#el.offsetHeight;
      e.preventDefault(); e.stopPropagation();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!resizing) return;
      const w = Math.max(this.#opts.minWidth,  startW + (e.clientX - startX));
      const h = Math.max(this.#opts.minHeight, startH + (e.clientY - startY));
      this.#el.style.width  = `${w}px`;
      this.#el.style.height = `${h}px`;
      this.#fire('Window-Resize', { width: w, height: h });
    });

    document.addEventListener('mouseup', () => { resizing = false; });
  }

  #buildOverlay(): void {
    this.#overlay = document.createElement('div');
    this.#overlay.style.cssText = `position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:${999 + _winCounter};`;
    this.#overlay.addEventListener('click', e => e.stopPropagation());
  }
}

// ── Window registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
  Object.defineProperty(window, 'Window', {
    enumerable: true, configurable: false, writable: false, value: Window,
  });

export default Window;
