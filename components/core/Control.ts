/**
 * @module    AriannAControl
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Abstract base for all AriannA controls.
 * API is intentionally React-like: set props → auto-renders.
 *
 * @example
 *   class MyCtrl extends Control {
 *     set label(v: string) { this._set('label', v); }
 *     get label()          { return this._get<string>('label', ''); }
 *     protected _build()   { this.el.textContent = this.label; }
 *   }
 *   const c = new MyCtrl('#root');
 *   c.label = 'Hello';           // auto-renders
 *   c.on('click', handler);
 *   c.destroy();
 */

export type CtrlListener<T = unknown> = (detail: T, ev?: Event) => void;

export interface CtrlOptions {
  class?     : string;
  disabled?  : boolean;
  theme?     : 'light' | 'dark' | 'auto';
  tabIndex?  : number;
}

export abstract class Control<O extends CtrlOptions = CtrlOptions> {
  /** Root DOM element. */
  readonly el: HTMLElement;

  private _props   : Partial<O>                           = {};
  private _bus     = new Map<string, Set<CtrlListener>>();
  private _cleanup : Array<() => void>                    = [];
  private _dirty   = false;
  private _raf     = 0;

  constructor(
    container : string | HTMLElement | null,
    tag       : string,
    defaults  : Partial<O> = {},
  ) {
    this.el = document.createElement(tag);
    this._props = { ...defaults };

    if (defaults.class)    this.el.className = defaults.class;
    if (defaults.theme)    this.el.dataset.theme = defaults.theme;
    if (defaults.tabIndex !== undefined) this.el.tabIndex = defaults.tabIndex!;

    const parent = typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;
    if (parent) parent.appendChild(this.el);

    // First render after microtask so subclass constructor completes first
    Promise.resolve().then(() => this._flush());
  }

  // ── Props (React-like) ────────────────────────────────────────────────────

  protected _set<K extends keyof O>(key: K, value: O[K]): void {
    this._props[key] = value;
    this._schedule();
  }

  protected _get<T>(key: keyof O, fallback: T): T {
    return (this._props[key] as T) ?? fallback;
  }

  // ── Scheduling ────────────────────────────────────────────────────────────

  private _schedule(): void {
    if (this._dirty) return;
    this._dirty = true;
    this._raf = requestAnimationFrame(() => this._flush());
  }

  private _flush(): void {
    this._dirty = false;
    if (!this._destroyed) { this._build(); this._mounted = true; }
  }

  private _destroyed = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Force an immediate re-render. */
  refresh(): this { this._build(); return this; }

  /** Remove from DOM and clean up. Safe to call multiple times. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    this._cleanup.forEach(fn => fn());
    this._cleanup.length = 0;
    this.el.parentElement?.removeChild(this.el);
  }

  // ── Events ────────────────────────────────────────────────────────────────

  on<T = unknown>(type: string, cb: CtrlListener<T>): this {
    if (!this._bus.has(type)) this._bus.set(type, new Set());
    this._bus.get(type)!.add(cb as CtrlListener);
    return this;
  }

  off<T = unknown>(type: string, cb: CtrlListener<T>): this {
    this._bus.get(type)?.delete(cb as CtrlListener);
    return this;
  }

  protected _emit<T = unknown>(type: string, detail: T, ev?: Event): void {
    this._bus.get(type)?.forEach(cb => cb(detail, ev));
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────

  /** Create an element, optionally set class and append to parent. */
  protected _el(tag: string, cls?: string, parent?: HTMLElement): HTMLElement {
    const e = document.createElement(tag);
    if (cls)    e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  /** Add a DOM listener that auto-removes on destroy(). */
  protected _on(
    target : EventTarget,
    type   : string,
    cb     : (e: never) => void,
    opts?  : AddEventListenerOptions,
  ): void {
    target.addEventListener(type, cb as unknown as EventListener, opts);
    this._cleanup.push(() =>
      target.removeEventListener(type, cb as unknown as EventListener, opts)
    );
  }

  /** Register a cleanup callback. */
  protected _gc(fn: () => void): void { this._cleanup.push(fn); }


  // ── State proxy ───────────────────────────────────────────────────────────

  /** Reactive state proxy — read/write props as plain object. */
  protected get _state(): { State: Partial<O>; Set: <K extends keyof O>(k: K, v: O[K]) => void } {
    return {
      State : this._props,
      Set   : <K extends keyof O>(k: K, v: O[K]) => this._set(k, v),
    };
  }

  // ── Lifecycle flags ───────────────────────────────────────────────────────

  /** True after first _build() completes. */
  protected _mounted = false;

  // ── Fire (alias emit) ─────────────────────────────────────────────────────

  /** Alias of _emit — for Golem API compatibility. */
  protected _fire<T = unknown>(type: string, detail: T, ev?: Event): void {
    this._emit(type, detail, ev);
  }

  // ── Listen helper ─────────────────────────────────────────────────────────

  /** Add a typed DOM listener with auto-cleanup. */
  protected _listen(
    target : EventTarget,
    type   : string,
    cb     : (e: never) => void,
    opts?  : AddEventListenerOptions,
  ): void {
    target.addEventListener(type, cb as unknown as EventListener, opts);
    this._cleanup.push(() =>
      target.removeEventListener(type, cb as unknown as EventListener, opts)
    );
  }

  // ── onDestroy ─────────────────────────────────────────────────────────────

  /** Register cleanup — alias of _gc. */
  protected _onDestroy(fn: () => void): void { this._gc(fn); }

  // ── Public get<T> ─────────────────────────────────────────────────────────

  /** Read a prop by string key (public). */
  get<T>(key: keyof O, fallback?: T): T {
    return (this._props[key] as T) ?? fallback as T;
  }

  /** Abstract: build or rebuild the control's inner DOM. */
  protected abstract _build(): void;
}
/** @deprecated */ export { Control as AriannAControl };
/** @deprecated */ export type { CtrlOptions as ControlOptions };
