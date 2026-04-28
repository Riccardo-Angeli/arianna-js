/**
 * @module    Sidebar
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Sidebar — resizable, collapsible, accordion navigation panel.
 * Dedicated with love to Arianna. ♡
 *
 * orientation: 'left' | 'right'  — controls which edge the border and
 *   resize handle sit on, and which direction collapse animates toward.
 *
 * @example
 *   import { Sidebar, SidebarCSS } from './arianna-wip-controls/Sidebar.ts';
 *
 *   const style = document.createElement('style');
 *   style.textContent = SidebarCSS;
 *   document.head.appendChild(style);
 *
 *   const sidebar = new Sidebar('#shell', {
 *     orientation   : 'left',   // 'left' | 'right'
 *     width         : 260,
 *     minWidth      : 160,
 *     maxWidth      : 480,
 *     resizable     : true,
 *     collapsible   : true,
 *     collapsed     : false,
 *     collapsedWidth: 48,
 *     searchable    : true,
 *     showToggle    : true,
 *     persist       : true,
 *     storageKey    : 'arianna-wip-sidebar-w',
 *   });
 *
 *   sidebar.sections = [
 *     {
 *       id: 'start', label: 'Getting Started', open: true,
 *       items: [
 *         { id: 'welcome',  label: 'Welcome',       icon: '✦' },
 *         { id: 'install',  label: 'Installation',  icon: '⬇' },
 *         { id: 'arch',     label: 'Architecture',  icon: '🏗' },
 *       ],
 *     },
 *     {
 *       id: 'core', label: 'Core Modules',
 *       items: [
 *         { id: 'real',    label: 'Real',    icon: '🌐' },
 *         { id: 'virtual', label: 'Virtual', icon: '🧩' },
 *         { id: 'state',   label: 'State',   icon: '⚡', badge: 'new' },
 *       ],
 *     },
 *   ];
 *
 *   sidebar.active = 'welcome';
 *
 *   sidebar.on('select',   ({ item, section }) => router.navigate(item.id));
 *   sidebar.on('resize',   ({ width })         => layout.adjustMain(width));
 *   sidebar.on('collapse', ({ collapsed })      => layout.setCompact(collapsed));
 *
 * @example
 *   // Programmatic API
 *   sidebar.collapse();
 *   sidebar.expand();
 *   sidebar.toggle();
 *   sidebar.setWidth(300);
 *   sidebar.openSection('core');
 *   sidebar.closeSection('start');
 *   sidebar.toggleSection('core');
 *   sidebar.search('real');
 */

import Observable from '../../core/Observable.ts';
import State      from '../../core/State.ts';
import { type CtrlOptions } from '../core/Control.ts';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SidebarItem {
  id        : string;
  label     : string;
  icon?     : string;
  badge?    : string | number;
  disabled? : boolean;
  class?    : string;
  data?     : unknown;
}

export interface SidebarSection {
  id     : string;
  label  : string;
  items  : SidebarItem[];
  open?  : boolean;
  icon?  : string;
}

export interface SidebarOptions extends CtrlOptions {
  ariaLabel? : string;
  class?     : string;
  /**
   * Which side of the layout the sidebar sits on.
   *   'left'  → border-right, handle on the right edge, collapses left
   *   'right' → border-left,  handle on the left edge,  collapses right
   * @default 'left'
   */
  orientation?   : 'left' | 'right';
  /** Initial width in px. @default 260 */
  width?         : number;
  /** Minimum drag width in px. @default 160 */
  minWidth?      : number;
  /** Maximum drag width in px. @default 480 */
  maxWidth?      : number;
  /** Enable drag-to-resize handle. @default true */
  resizable?     : boolean;
  /** Enable collapse to icon-only mode. @default true */
  collapsible?   : boolean;
  /** Start in collapsed state. @default false */
  collapsed?     : boolean;
  /** Icon-only width when collapsed. @default 48 */
  collapsedWidth?: number;
  /** Show search filter bar. @default true */
  searchable?    : boolean;
  /** Show collapse toggle button. @default true */
  showToggle?    : boolean;
  /** Persist width across page loads via localStorage. @default true */
  persist?       : boolean;
  /** localStorage key for persisted width. @default 'arianna-wip-sidebar-w' */
  storageKey?    : string;
  /** Optional header content (HTML string or Element). */
  header?        : string | HTMLElement;
  /** Optional footer content (HTML string or Element). */
  footer?        : string | HTMLElement;
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULTS: Required<Omit<SidebarOptions,
  'class' | 'style' | 'disabled' | 'ariaLabel' | 'tabIndex' | 'theme' | 'header' | 'footer'
>> = {
  orientation   : 'left',
  width         : 260,
  minWidth      : 160,
  maxWidth      : 480,
  resizable     : true,
  collapsible   : true,
  collapsed     : false,
  collapsedWidth: 48,
  searchable    : true,
  showToggle    : true,
  persist       : true,
  storageKey    : 'arianna-wip-sidebar-w',
};

// ── Sidebar ────────────────────────────────────────────────────────────────────

export class Sidebar {

  /** Root element — attach to your layout. */
  readonly el    : HTMLElement;

  private _obs   : Observable;
  private _opts  : Required<Omit<SidebarOptions, 'class'|'style'|'disabled'|'ariaLabel'|'tabIndex'|'theme'|'header'|'footer'>>;
  private _raw   : SidebarOptions;

  private _sections  : SidebarSection[] = [];
  private _active    = '';
  private _collapsed : boolean;
  private _width     : number;
  private _query     = '';
  private _openSecs  = new Set<string>();

  // DOM refs
  private _list!      : HTMLElement;
  private _handle!    : HTMLElement;
  private _search!    : HTMLInputElement;
  private _toggleBtn! : HTMLElement;
  private _listeners  : Array<{ el: EventTarget; type: string; fn: EventListener; opts?: AddEventListenerOptions }> = [];

  constructor(
    container : string | HTMLElement | null = null,
    opts      : SidebarOptions = {},
  ) {
    this._raw  = opts;
    this._opts = { ...DEFAULTS, ...opts } as typeof this._opts;
    this._collapsed = this._opts.collapsed;
    this._width     = this._opts.width;

    // Restore persisted width
    if (this._opts.persist) {
      const saved = localStorage.getItem(this._opts.storageKey);
      if (saved) {
        const w = parseInt(saved, 10);
        if (w >= this._opts.minWidth && w <= this._opts.maxWidth) this._width = w;
      }
    }

    // Create root element
    this.el = document.createElement('nav');
    this._obs = new Observable(this.el);

    const orient = this._opts.orientation;
    this.el.setAttribute('role', 'navigation');
    this.el.setAttribute('aria-label', opts.ariaLabel ?? 'Site navigation');

    const cls = ['ar-sidebar', `ar-sidebar--${orient}`, this._collapsed ? 'ar-sidebar--collapsed' : '', opts.class ?? ''];
    this.el.className = cls.filter(Boolean).join(' ');

    this._applyWidth();
    this._build();

    // Attach to container
    if (container) {
      const parent = typeof container === 'string'
        ? document.querySelector(container)
        : container;
      if (parent) parent.appendChild(this.el);
    }
  }

  // ── Data setters ──────────────────────────────────────────────────────────

  set sections(v: SidebarSection[]) {
    this._sections = v;
    this._openSecs = new Set(v.filter(s => s.open !== false).map(s => s.id));
    this._renderList();
  }
  get sections(): SidebarSection[] { return this._sections; }

  set active(id: string) {
    this._active = id;
    this._refreshActive();
  }
  get active(): string { return this._active; }

  // ── Collapse API ──────────────────────────────────────────────────────────

  collapse(): this {
    this._collapsed = true;
    this.el.classList.add('ar-sidebar--collapsed');
    this._applyWidth();
    if (this._toggleBtn) this._toggleBtn.textContent = this._toggleIcon();
    this._emit('collapse', { collapsed: true });
    return this;
  }

  expand(): this {
    this._collapsed = false;
    this.el.classList.remove('ar-sidebar--collapsed');
    this._applyWidth();
    if (this._toggleBtn) this._toggleBtn.textContent = this._toggleIcon();
    this._emit('collapse', { collapsed: false });
    return this;
  }

  toggle(): this {
    return this._collapsed ? this.expand() : this.collapse();
  }

  // ── Width API ─────────────────────────────────────────────────────────────

  setWidth(w: number): this {
    this._width = Math.max(this._opts.minWidth, Math.min(this._opts.maxWidth, w));
    if (!this._collapsed) this.el.style.width = this._width + 'px';
    this._persist();
    this._emit('resize', { width: this._width });
    return this;
  }

  // ── Section API ───────────────────────────────────────────────────────────

  openSection(id: string): this   { this._openSecs.add(id);    this._renderList(); return this; }
  closeSection(id: string): this  { this._openSecs.delete(id); this._renderList(); return this; }
  toggleSection(id: string): this {
    this._openSecs.has(id) ? this.closeSection(id) : this.openSection(id);
    return this;
  }

  // ── Search ────────────────────────────────────────────────────────────────

  search(q: string): this {
    this._query = q.toLowerCase().trim();
    if (this._search) this._search.value = q;
    this._renderList();
    return this;
  }

  // ── Event API ─────────────────────────────────────────────────────────────

  on<T = unknown>(type: string, cb: (detail: T) => void): this {
    this._obs.on(type, cb as never);
    return this;
  }

  off<T = unknown>(type: string, cb: (detail: T) => void): this {
    this._obs.off(type, cb as never);
    return this;
  }

  // ── Destroy ───────────────────────────────────────────────────────────────

  destroy(): void {
    this._listeners.forEach(({ el, type, fn, opts }) =>
      el.removeEventListener(type, fn, opts));
    this._listeners = [];
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  // ── Private: build ────────────────────────────────────────────────────────

  private _build(): void {
    this.el.innerHTML = '';
    const o = this._opts;
    const orient = o.orientation;

    // Header
    if (this._raw.header) {
      const hdr = this._mk('div', 'ar-sidebar__header');
      if (typeof this._raw.header === 'string') hdr.innerHTML = this._raw.header;
      else hdr.appendChild(this._raw.header);
      this.el.appendChild(hdr);
    }

    // Collapse toggle
    if (o.showToggle && o.collapsible) {
      this._toggleBtn = this._mk('button', 'ar-sidebar__toggle');
      this._toggleBtn.setAttribute('aria-label', 'Toggle sidebar');
      this._toggleBtn.textContent = this._toggleIcon();
      this._bind(this._toggleBtn, 'click', () => this.toggle());
      this.el.appendChild(this._toggleBtn);
    }

    // Search bar
    if (o.searchable) {
      const wrap = this._mk('div', 'ar-sidebar__search-wrap');
      this._search = document.createElement('input');
      this._search.type        = 'text';
      this._search.className   = 'ar-sidebar__search';
      this._search.placeholder = 'Search…';
      this._search.setAttribute('aria-label', 'Filter navigation');
      this._bind(this._search as unknown as HTMLElement, 'input', () => {
        this._query = this._search.value.toLowerCase().trim();
        this._renderList();
      });
      wrap.appendChild(this._search);
      this.el.appendChild(wrap);
    }

    // Nav list container
    this._list = this._mk('div', 'ar-sidebar__list');
    this.el.setAttribute('role', 'navigation');
    this.el.appendChild(this._list);
    this._renderList();

    // Footer
    if (this._raw.footer) {
      const ftr = this._mk('div', 'ar-sidebar__footer');
      if (typeof this._raw.footer === 'string') ftr.innerHTML = this._raw.footer;
      else ftr.appendChild(this._raw.footer);
      this.el.appendChild(ftr);
    }

    // Resize handle — position depends on orientation
    if (o.resizable) {
      const handleCls = orient === 'right'
        ? 'ar-sidebar__handle ar-sidebar__handle--right'
        : 'ar-sidebar__handle ar-sidebar__handle--left';
      this._handle = this._mk('div', handleCls);
      this._handle.setAttribute('role', 'separator');
      this._handle.setAttribute('aria-label', 'Drag to resize sidebar');
      this.el.appendChild(this._handle);
      this._setupResize();
    }

    // Keyboard: Escape collapses
    this._bind(this.el, 'keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape' && o.collapsible) this.collapse();
    });
  }

  // ── Private: render sections ──────────────────────────────────────────────

  private _renderList(): void {
    if (!this._list) return;
    this._list.innerHTML = '';
    const q = this._query;
    const collapsed = this._collapsed;

    for (const sec of this._sections) {
      const matchedItems = q
        ? sec.items.filter(i =>
            i.label.toLowerCase().includes(q) ||
            String(i.badge ?? '').toLowerCase().includes(q))
        : sec.items;

      if (q && matchedItems.length === 0) continue;

      const isOpen = this._openSecs.has(sec.id) || !!q;

      // Section wrapper
      const secEl = this._mk('div', 'ar-sidebar__section');

      // Section heading button
      const hd = this._mk('button', `ar-sidebar__section-hd${isOpen ? ' ar-sidebar__section-hd--open' : ''}`);
      hd.setAttribute('aria-expanded', String(isOpen));
      hd.setAttribute('aria-controls', `sec-items-${sec.id}`);

      if (!collapsed) {
        if (sec.icon) {
          const ic = this._mk('span', 'ar-sidebar__sec-icon');
          ic.textContent = sec.icon;
          hd.appendChild(ic);
        }
        const lbl = this._mk('span', 'ar-sidebar__sec-label');
        lbl.textContent = sec.label;
        hd.appendChild(lbl);
        const arr = this._mk('span', 'ar-sidebar__sec-arrow');
        arr.setAttribute('aria-hidden', 'true');
        arr.textContent = isOpen ? '▾' : '▸';
        hd.appendChild(arr);
      }

      hd.addEventListener('click', () => this.toggleSection(sec.id));
      secEl.appendChild(hd);

      // Items wrapper
      const itemsEl = this._mk('div', 'ar-sidebar__items');
      itemsEl.id = `sec-items-${sec.id}`;
      if (!isOpen && !q) (itemsEl as HTMLElement).style.display = 'none';

      for (const item of matchedItems) {
        const isActive = this._active === item.id;
        const btn = this._mk('button', [
          'ar-sidebar__item',
          isActive       ? 'ar-sidebar__item--active'   : '',
          item.disabled  ? 'ar-sidebar__item--disabled' : '',
          item.class     ?? '',
        ].filter(Boolean).join(' ')) as HTMLButtonElement;

        btn.disabled = !!item.disabled;
        btn.setAttribute('aria-current', isActive ? 'page' : 'false');
        btn.dataset['id'] = item.id;
        if (collapsed && item.label) btn.title = item.label;

        if (item.icon) {
          const ic = this._mk('span', 'ar-sidebar__item-icon');
          ic.setAttribute('aria-hidden', 'true');
          ic.textContent = item.icon;
          btn.appendChild(ic);
        }

        if (!collapsed) {
          const lbl = this._mk('span', 'ar-sidebar__item-label');
          lbl.textContent = item.label;
          btn.appendChild(lbl);
          if (item.badge !== undefined) {
            const b = this._mk('span', 'ar-sidebar__item-badge');
            b.textContent = String(item.badge);
            btn.appendChild(b);
          }
        }

        btn.addEventListener('click', () => {
          if (item.disabled) return;
          this._active = item.id;
          this._refreshActive();
          this._emit('select', { item, section: sec });
        });

        itemsEl.appendChild(btn);
      }

      secEl.appendChild(itemsEl);
      this._list.appendChild(secEl);
    }
  }

  private _refreshActive(): void {
    this._list?.querySelectorAll<HTMLButtonElement>('.ar-sidebar__item').forEach(btn => {
      const active = btn.dataset['id'] === this._active;
      btn.classList.toggle('ar-sidebar__item--active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  // ── Private: resize ───────────────────────────────────────────────────────

  private _setupResize(): void {
    const o = this._opts;
    let dragging = false, startX = 0, startW = 0;

    const move = (clientX: number) => {
      if (!dragging || this._collapsed) return;
      const delta = o.orientation === 'left' ? clientX - startX : startX - clientX;
      this._width = Math.max(o.minWidth, Math.min(o.maxWidth, startW + delta));
      this.el.style.width = this._width + 'px';
      this._emit('resize', { width: this._width });
    };

    const end = () => {
      if (!dragging) return;
      dragging = false;
      this._handle.classList.remove('ar-sidebar__handle--dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      this._persist();
    };

    this._bind(this._handle, 'mousedown', (e: Event) => {
      if (this._collapsed) return;
      dragging = true; startX = (e as MouseEvent).clientX; startW = this._width;
      this._handle.classList.add('ar-sidebar__handle--dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    this._bind(document as unknown as HTMLElement, 'mousemove', (e: Event) => move((e as MouseEvent).clientX));
    this._bind(document as unknown as HTMLElement, 'mouseup', () => end());

    this._bind(this._handle, 'touchstart', (e: Event) => {
      if (this._collapsed) return;
      dragging = true; startX = (e as TouchEvent).touches[0].clientX; startW = this._width;
      e.preventDefault();
    }, { passive: false });
    this._bind(document as unknown as HTMLElement, 'touchmove', (e: Event) => move((e as TouchEvent).touches[0].clientX));
    this._bind(document as unknown as HTMLElement, 'touchend', () => end());
  }

  // ── Private: helpers ──────────────────────────────────────────────────────

  private _applyWidth(): void {
    const w = this._collapsed ? this._opts.collapsedWidth : this._width;
    this.el.style.width = w + 'px';
  }

  private _persist(): void {
    if (this._opts.persist)
      localStorage.setItem(this._opts.storageKey, String(this._width));
  }

  private _toggleIcon(): string {
    const o = this._opts.orientation;
    if (o === 'left')  return this._collapsed ? '▸' : '◂';
    if (o === 'right') return this._collapsed ? '◂' : '▸';
    return '≡';
  }

  private _emit<T>(type: string, detail: T): void {
    this._obs.fire({ Type: type, ...detail } as never);
  }

  private _mk(tag: string, cls?: string): HTMLElement {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  private _bind(
    target: EventTarget,
    type  : string,
    fn    : EventListener,
    opts? : AddEventListenerOptions,
  ): void {
    target.addEventListener(type, fn, opts);
    this._listeners.push({ el: target, type, fn, opts });
  }
}

// ── CSS ────────────────────────────────────────────────────────────────────────

export const SidebarCSS = `
/* ── Root ──────────────────────────────────────────────────────────────────── */
.ar-sidebar {
  background    : var(--ar-bg2,    #f7f7f5);
  border-style  : solid;
  border-color  : var(--ar-border, #dbd8d0);
  border-width  : 0;
  box-sizing    : border-box;
  display       : flex;
  flex-direction: column;
  flex-shrink   : 0;
  height        : 100%;
  min-width     : 0;
  overflow      : hidden;
  position      : relative;
  transition    : width .18s ease;
}

/* Orientation: which edge gets the border */
.ar-sidebar--left  { border-right-width : 1px; }
.ar-sidebar--right { border-left-width  : 1px; }

/* ── Collapsed state ───────────────────────────────────────────────────────── */
.ar-sidebar--collapsed .ar-sidebar__search-wrap,
.ar-sidebar--collapsed .ar-sidebar__item-label,
.ar-sidebar--collapsed .ar-sidebar__item-badge,
.ar-sidebar--collapsed .ar-sidebar__sec-label,
.ar-sidebar--collapsed .ar-sidebar__sec-arrow { display: none; }
.ar-sidebar--collapsed .ar-sidebar__items     { display: none !important; }
.ar-sidebar--collapsed .ar-sidebar__item      {
  justify-content: center;
  padding        : 8px 4px;
}
.ar-sidebar--collapsed .ar-sidebar__toggle    { text-align: center; }

/* ── Header / Footer ───────────────────────────────────────────────────────── */
.ar-sidebar__header {
  border-bottom : 1px solid var(--ar-border, #dbd8d0);
  flex-shrink   : 0;
  padding       : 12px 14px;
}
.ar-sidebar__footer {
  border-top  : 1px solid var(--ar-border, #dbd8d0);
  flex-shrink : 0;
  margin-top  : auto;
  padding     : 10px 14px;
}

/* ── Toggle button ─────────────────────────────────────────────────────────── */
.ar-sidebar__toggle {
  background  : none;
  border      : none;
  color       : var(--ar-muted, #6e6b62);
  cursor      : pointer;
  font        : inherit;
  font-size   : .68rem;
  padding     : 5px 14px;
  text-align  : right;
  transition  : color .14s;
  width       : 100%;
}
.ar-sidebar--right .ar-sidebar__toggle { text-align: left; }
.ar-sidebar__toggle:hover { color: var(--ar-text, #18160f); }

/* ── Search ────────────────────────────────────────────────────────────────── */
.ar-sidebar__search-wrap { padding: 4px 10px 8px; }
.ar-sidebar__search {
  background    : var(--ar-bg3, #efede9);
  border        : 1px solid var(--ar-border, #dbd8d0);
  border-radius : var(--ar-radius, 5px);
  box-sizing    : border-box;
  color         : var(--ar-text, #18160f);
  font          : inherit;
  font-size     : .79rem;
  outline       : none;
  padding       : 4px 9px;
  transition    : border-color .14s;
  width         : 100%;
}
.ar-sidebar__search:focus { border-color: var(--ar-primary, #1a55a0); }

/* ── Scrollable list ───────────────────────────────────────────────────────── */
.ar-sidebar__list {
  flex       : 1;
  overflow-x : hidden;
  overflow-y : auto;
  padding    : 4px 0 32px;
}
.ar-sidebar__list::-webkit-scrollbar       { width: 3px; }
.ar-sidebar__list::-webkit-scrollbar-thumb {
  background    : var(--ar-border, #dbd8d0);
  border-radius : 2px;
}

/* ── Section heading ───────────────────────────────────────────────────────── */
.ar-sidebar__section { margin-bottom: 2px; }
.ar-sidebar__section-hd {
  align-items   : center;
  background    : none;
  border        : none;
  color         : var(--ar-muted, #6e6b62);
  cursor        : pointer;
  display       : flex;
  font          : inherit;
  font-size     : .65rem;
  font-weight   : 700;
  gap           : 5px;
  letter-spacing: .11em;
  padding       : 8px 14px 4px;
  text-align    : left;
  text-transform: uppercase;
  transition    : color .14s;
  width         : 100%;
}
.ar-sidebar__section-hd:hover { color: var(--ar-text, #18160f); }
.ar-sidebar__sec-label  { flex: 1; }
.ar-sidebar__sec-arrow  { flex-shrink: 0; font-size: .55rem; }
.ar-sidebar__sec-icon   { flex-shrink: 0; }

/* ── Items ─────────────────────────────────────────────────────────────────── */
.ar-sidebar__items { display: flex; flex-direction: column; }

.ar-sidebar__item {
  align-items   : center;
  background    : none;
  border        : none;
  border-left   : 2px solid transparent;
  color         : var(--ar-muted, #6e6b62);
  cursor        : pointer;
  display       : flex;
  font          : inherit;
  font-size     : .81rem;
  gap           : 8px;
  padding       : 5px 14px 5px 22px;
  text-align    : left;
  transition    : background .13s, color .13s, border-color .13s;
  white-space   : nowrap;
  width         : 100%;
}

/* RIGHT orientation: active indicator on the right edge */
.ar-sidebar--right .ar-sidebar__item {
  border-left   : none;
  border-right  : 2px solid transparent;
  padding       : 5px 22px 5px 14px;
}

.ar-sidebar__item:hover:not(:disabled) {
  background : var(--ar-bg3, #efede9);
  color      : var(--ar-text, #18160f);
}
.ar-sidebar__item--active {
  background        : var(--ar-bg3, #efede9);
  border-left-color : var(--ar-primary, #1a55a0);
  color             : var(--ar-text, #18160f);
  font-weight       : 600;
}
.ar-sidebar--right .ar-sidebar__item--active {
  border-left-color  : transparent;
  border-right-color : var(--ar-primary, #1a55a0);
}
.ar-sidebar__item--disabled { cursor: not-allowed; opacity: .45; }

.ar-sidebar__item-icon  {
  flex-shrink : 0;
  font-size   : 1rem;
  text-align  : center;
  width       : 18px;
}
.ar-sidebar__item-label {
  flex         : 1;
  overflow     : hidden;
  text-overflow: ellipsis;
}
.ar-sidebar__item-badge {
  background    : var(--ar-bg4, #e5e2dc);
  border        : 1px solid var(--ar-border, #dbd8d0);
  border-radius : 8px;
  color         : var(--ar-muted, #6e6b62);
  font-size     : .62rem;
  margin-left   : auto;
  padding       : 1px 5px;
}
.ar-sidebar__item--active .ar-sidebar__item-badge {
  background   : var(--ar-primary, #1a55a0);
  border-color : var(--ar-primary, #1a55a0);
  color        : #fff;
}

/* ── Resize handle ─────────────────────────────────────────────────────────── */
.ar-sidebar__handle {
  background : transparent;
  bottom     : 0;
  cursor     : col-resize;
  position   : absolute;
  top        : 0;
  transition : background .14s;
  width      : 6px;
  z-index    : 10;
}
/* LEFT sidebar: handle on the right edge */
.ar-sidebar__handle--left  { right: -3px; }
/* RIGHT sidebar: handle on the left edge */
.ar-sidebar__handle--right { left:  -3px; }

.ar-sidebar__handle:hover,
.ar-sidebar__handle--dragging {
  background : var(--ar-primary, #1a55a0);
  opacity    : .45;
}
.ar-sidebar--collapsed .ar-sidebar__handle { display: none; }
`;
