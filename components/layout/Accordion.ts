/**
 * @module    Accordion
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Accordion — collapsible content panel control for AriannA.
 * Dedicated with love to Arianna. ♡
 *
 * A zero-dependency accordion that integrates with AriannA's State and
 * Observable systems. Supports single and multi-open modes, animated
 * expand/collapse, dynamic item management, and full keyboard navigation.
 *
 * ── MODES ─────────────────────────────────────────────────────────────────────
 *   single   → only one panel open at a time (close others on open)
 *   multiple → any number of panels can be open simultaneously
 *
 * ── ICON STYLES ──────────────────────────────────────────────────────────────
 *   'chevron' → › rotates to ↓ when open  (default)
 *   'plus'    → + changes to − when open
 *   'arrow'   → → rotates to ↓ when open
 *   'none'    → no icon
 *
 * ── CONSTRUCTOR ──────────────────────────────────────────────────────────────
 *   new Accordion({ items, multiple, animated, icon, borderless })
 *
 * ── INSTANCE API (fluent) ─────────────────────────────────────────────────────
 *   .open(id)        → open panel by id
 *   .close(id)       → close panel by id
 *   .toggle(id)      → toggle panel by id
 *   .openAll()       → open all panels
 *   .closeAll()      → close all panels
 *   .isOpen(id)      → true | false
 *   .openItems()     → string[] of currently open panel ids
 *   .addItem(item)   → add a new panel at the end (or at index)
 *   .removeItem(id)  → remove a panel by id
 *   .setContent(id, html) → update the body content of a panel
 *   .setTitle(id, html)   → update the header title of a panel
 *   .enable(id)      → enable a disabled panel
 *   .disable(id)     → disable a panel (prevents open/close)
 *   .on(type, cb)    → subscribe to Accordion events
 *   .off(type, cb)   → unsubscribe
 *   .render()        → return underlying HTMLElement
 *   .append(parent)  → mount into parent
 *
 * ── EVENTS ────────────────────────────────────────────────────────────────────
 *   'Accordion-Open'    → { Type, id, item, accordion }
 *   'Accordion-Close'   → { Type, id, item, accordion }
 *   'Accordion-Toggle'  → { Type, id, item, open, accordion }
 *   'Accordion-Add'     → { Type, id, item, accordion }
 *   'Accordion-Remove'  → { Type, id, accordion }
 *
 * ── STATE INTEGRATION ────────────────────────────────────────────────────────
 *   The Accordion fires typed events on every interaction.
 *   Combine with AriannA State for fully reactive panels:
 *
 *   const state = new State({ activePanel: 'intro' });
 *   acc.on('Accordion-Open', e => state.State.activePanel = e.id);
 *   state.on('State-activePanel-Changed', e => acc.open(e.Property.New as string));
 *
 * @example
 *   // Basic usage
 *   const acc = new Accordion({
 *     items: [
 *       { id: 'intro',  title: 'Introduction',   content: '<p>Welcome to AriannA.</p>' },
 *       { id: 'usage',  title: 'Usage',           content: '<p>Zero dependencies.</p>' },
 *       { id: 'api',    title: 'API Reference',   content: '<p>See docs.</p>', open: true },
 *       { id: 'notes',  title: 'Release Notes',   content: '<p>v1.0.0</p>', disabled: true },
 *     ],
 *   });
 *   acc.append('#app');
 *
 * @example
 *   // Multi-open with plus icon
 *   const acc = new Accordion({
 *     items   : myItems,
 *     multiple: true,
 *     icon    : 'plus',
 *     animated: true,
 *   });
 *
 * @example
 *   // Dynamic item management
 *   acc.addItem({ id: 'new', title: 'New Section', content: '<p>Added dynamically.</p>' });
 *   acc.removeItem('intro');
 *   acc.setContent('usage', '<p>Updated content.</p>');
 *
 * @example
 *   // React to user interaction
 *   acc.on('Accordion-Open',  e => console.log(e.id, 'opened'));
 *   acc.on('Accordion-Close', e => console.log(e.id, 'closed'));
 *
 * @example
 *   // Control programmatically
 *   acc.openAll();
 *   acc.closeAll();
 *   acc.toggle('api');
 *   acc.isOpen('intro')   // → true | false
 *   acc.openItems()       // → ['api', 'usage']
 */

import { Observable }      from '../../core/Observable.ts';
import type { AriannAEvent } from '../../core/Observable.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Icon style for accordion panel headers. */
export type AccordionIcon = 'chevron' | 'plus' | 'arrow' | 'none';

/** Event payload for all Accordion events. */
export interface AccordionEvent extends AriannAEvent {
  id        : string;
  item?     : AccordionItem;
  open?     : boolean;
  accordion : Accordion;
}

/** Definition of a single accordion panel. */
export interface AccordionItem {
  /** Unique identifier for this panel. Must be unique within the Accordion. */
  id       : string;
  /** Header title — HTML string or plain text. */
  title    : string;
  /** Body content — HTML string. */
  content  : string;
  /** Whether this panel starts open. Default: `false`. */
  open?    : boolean;
  /** Whether this panel is disabled (cannot be toggled). Default: `false`. */
  disabled?: boolean;
}

/** Constructor options for `new Accordion(opts)`. */
export interface AccordionOptions {
  /** Array of panel definitions. */
  items?     : AccordionItem[];
  /**
   * Open mode.
   * - `false` (default) — single: opening one panel closes the others.
   * - `true` — multiple: panels open independently.
   */
  multiple?  : boolean;
  /** Animate expand/collapse with CSS height transition. Default: `true`. */
  animated?  : boolean;
  /** Icon style for the panel toggle indicator. Default: `'chevron'`. */
  icon?      : AccordionIcon;
  /** Remove panel borders for a flat, borderless appearance. Default: `false`. */
  borderless?: boolean;
}

// ── Icon renderers ────────────────────────────────────────────────────────────

/** Return the icon HTML for a given style and open state. */
function renderIcon(style: AccordionIcon, open: boolean): string {
  switch (style) {
    case 'chevron':
      return `<span class="arianna-acc-icon" style="display:inline-block;transition:transform .25s;transform:rotate(${open ? 90 : 0}deg);color:var(--muted,#888);font-size:.85em;">›</span>`;
    case 'plus':
      return `<span class="arianna-acc-icon" style="display:inline-block;font-size:1.1em;font-weight:400;color:var(--muted,#888);">${open ? '−' : '+'}</span>`;
    case 'arrow':
      return `<span class="arianna-acc-icon" style="display:inline-block;transition:transform .25s;transform:rotate(${open ? 90 : 0}deg);color:var(--muted,#888);">→</span>`;
    case 'none':
    default:
      return '';
  }
}

// ── Accordion ─────────────────────────────────────────────────────────────────

let _accCounter = 0;

export class Accordion {

  // ── Private fields ────────────────────────────────────────────────────────────

  readonly #id       : string;
  readonly #obs      : Observable;
  readonly #opts     : Required<AccordionOptions>;

  #items   : AccordionItem[];
  #open    : Set<string>;
  #el      : HTMLElement;

  // ── Constructor ───────────────────────────────────────────────────────────────

  /**
   * Create an Accordion.
   *
   * @param opts - Accordion configuration options.
   *
   * @example
   *   const acc = new Accordion({
   *     items   : [{ id: 'a', title: 'Section A', content: '<p>Content</p>' }],
   *     multiple: false,
   *     icon    : 'chevron',
   *     animated: true,
   *   });
   *   acc.append('#sidebar');
   */
  constructor(opts: AccordionOptions = {}) {
    this.#id   = `arianna-acc-${++_accCounter}`;
    this.#obs  = new Observable();
    this.#opts = {
      items     : opts.items      ?? [],
      multiple  : opts.multiple   ?? false,
      animated  : opts.animated   ?? true,
      icon      : opts.icon       ?? 'chevron',
      borderless: opts.borderless ?? false,
    };

    this.#items = this.#opts.items.map(i => ({ open: false, disabled: false, ...i }));
    this.#open  = new Set(this.#items.filter(i => i.open && !i.disabled).map(i => i.id));

    // Enforce single mode on initial state
    if (!this.#opts.multiple && this.#open.size > 1) {
      const first = [...this.#open][0];
      this.#open.clear();
      this.#open.add(first);
    }

    this.#el = document.createElement('div');
    this.#el.id = this.#id;
    this.#el.className = 'arianna-wip-accordion';
    this.#el.setAttribute('role', 'tablist');
    this.#el.style.cssText = 'display:flex;flex-direction:column;width:100%;';

    this.#render();
    this.#wireEvents();
  }

  // ── Public API ─────────────────────────────────────────────────────────────────

  /**
   * Return the root accordion `HTMLElement`.
   *
   * @example
   *   document.body.appendChild(acc.render());
   */
  render(): HTMLElement { return this.#el; }

  /** Implicit coercion to `HTMLElement`. */
  valueOf(): HTMLElement { return this.#el; }

  /**
   * Mount the accordion into a parent element.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.append('#sidebar');
   *   acc.append(containerReal);
   */
  append(parent: string | Element | { render(): Element }): this {
    const par = typeof parent === 'string'
      ? document.querySelector(parent)
      : (parent instanceof Element ? parent : (parent as { render(): Element }).render());
    if (par) par.appendChild(this.#el);
    return this;
  }

  /**
   * Open a panel by id. In single mode, closes all other panels first.
   * Fluent — returns `this`.
   *
   * @param id - Panel identifier.
   *
   * @example
   *   acc.open('intro');
   */
  open(id: string): this {
    const item = this.#find(id);
    if (!item || item.disabled || this.#open.has(id)) return this;
    if (!this.#opts.multiple) this.#open.clear();
    this.#open.add(id);
    this.#update(id);
    this.#fire('Accordion-Open', id, item);
    return this;
  }

  /**
   * Close a panel by id.
   * Fluent — returns `this`.
   *
   * @param id - Panel identifier.
   *
   * @example
   *   acc.close('intro');
   */
  close(id: string): this {
    const item = this.#find(id);
    if (!item || item.disabled || !this.#open.has(id)) return this;
    this.#open.delete(id);
    this.#update(id);
    this.#fire('Accordion-Close', id, item);
    return this;
  }

  /**
   * Toggle a panel open/closed by id.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.toggle('api');
   */
  toggle(id: string): this {
    return this.#open.has(id) ? this.close(id) : this.open(id);
  }

  /**
   * Open all panels (switches to multiple mode temporarily if needed).
   * Fluent — returns `this`.
   *
   * @example
   *   acc.openAll();
   */
  openAll(): this {
    this.#items.forEach(item => { if (!item.disabled) this.#open.add(item.id); });
    this.#render();
    return this;
  }

  /**
   * Close all panels.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.closeAll();
   */
  closeAll(): this {
    this.#open.clear();
    this.#render();
    return this;
  }

  /**
   * Check whether a panel is currently open.
   *
   * @example
   *   acc.isOpen('intro')  // → true | false
   */
  isOpen(id: string): boolean { return this.#open.has(id); }

  /**
   * Return all currently open panel ids.
   *
   * @example
   *   acc.openItems()  // → ['api', 'usage']
   */
  openItems(): string[] { return [...this.#open]; }

  /**
   * Add a new panel.
   * Fluent — returns `this`.
   *
   * @param item  - Panel definition.
   * @param index - Insertion index. Default: append at end.
   *
   * @example
   *   acc.addItem({ id: 'new', title: 'New Section', content: '<p>Hi</p>' });
   *   acc.addItem({ id: 'top', title: 'First', content: '<p>Top</p>' }, 0);
   */
  addItem(item: AccordionItem, index?: number): this {
    const full = { open: false, disabled: false, ...item };
    if (index !== undefined && index >= 0 && index < this.#items.length)
      this.#items.splice(index, 0, full);
    else
      this.#items.push(full);
    if (full.open && !full.disabled) {
      if (!this.#opts.multiple) this.#open.clear();
      this.#open.add(full.id);
    }
    this.#render();
    this.#fire('Accordion-Add', item.id, full);
    return this;
  }

  /**
   * Remove a panel by id.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.removeItem('notes');
   */
  removeItem(id: string): this {
    const idx = this.#items.findIndex(i => i.id === id);
    if (idx < 0) return this;
    this.#items.splice(idx, 1);
    this.#open.delete(id);
    this.#render();
    this.#fire('Accordion-Remove', id);
    return this;
  }

  /**
   * Replace the body content of a panel.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.setContent('usage', '<p>Updated content.</p>');
   */
  setContent(id: string, html: string): this {
    const item = this.#find(id);
    if (item) { item.content = html; this.#updateBody(id, html); }
    return this;
  }

  /**
   * Update the header title of a panel.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.setTitle('api', 'API Reference v2');
   */
  setTitle(id: string, html: string): this {
    const item = this.#find(id);
    if (item) { item.title = html; this.#updateTitle(id, html); }
    return this;
  }

  /**
   * Enable a disabled panel (allows it to be toggled again).
   * Fluent — returns `this`.
   *
   * @example
   *   acc.enable('notes');
   */
  enable(id: string): this {
    const item = this.#find(id);
    if (item) { item.disabled = false; this.#renderItem(id); }
    return this;
  }

  /**
   * Disable a panel — it can no longer be opened or closed by the user.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.disable('notes');
   */
  disable(id: string): this {
    const item = this.#find(id);
    if (item) {
      item.disabled = true;
      this.#open.delete(id);
      this.#renderItem(id);
    }
    return this;
  }

  /**
   * Register a listener for Accordion events.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.on('Accordion-Open',  e => console.log(e.id, 'opened'));
   *   acc.on('Accordion-Close', e => console.log(e.id, 'closed'));
   */
  on(type: string, cb: (e: AccordionEvent) => void): this {
    this.#obs.on(type, cb as (e: AriannAEvent) => void);
    return this;
  }

  /**
   * Remove an Accordion event listener.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.off('Accordion-Open', handler);
   */
  off(type: string, cb: (e: AccordionEvent) => void): this {
    this.#obs.off(type, cb as (e: AriannAEvent) => void);
    return this;
  }

  // ── Private helpers ────────────────────────────────────────────────────────────

  #find(id: string): AccordionItem | undefined {
    return this.#items.find(i => i.id === id);
  }

  #fire(type: string, id: string, item?: AccordionItem): void {
    this.#obs.fire({
      Type     : type,
      id,
      item,
      open     : this.#open.has(id),
      accordion: this,
    } as unknown as AriannAEvent);
  }

  #render(): void {
    this.#el.innerHTML = '';
    this.#items.forEach(item => this.#el.appendChild(this.#buildPanel(item)));
  }

  #renderItem(id: string): void {
    const item = this.#find(id);
    if (!item) return;
    const existing = this.#el.querySelector(`[data-acc-id="${id}"]`);
    if (existing) {
      const fresh = this.#buildPanel(item);
      existing.parentElement?.replaceChild(fresh, existing);
    }
  }

  #buildPanel(item: AccordionItem): HTMLElement {
    const isOpen     = this.#open.has(item.id);
    const isDisabled = !!item.disabled;
    const border     = this.#opts.borderless ? 'none' : '1px solid var(--border,#e0e0e0)';
    const animStyle  = this.#opts.animated
      ? `max-height:${isOpen ? '2000px' : '0'};transition:max-height .3s ease;overflow:hidden;`
      : `display:${isOpen ? 'block' : 'none'};`;

    const panel = document.createElement('div');
    panel.className = 'arianna-wip-acc-panel';
    panel.dataset.accId = item.id;
    panel.style.cssText = `border:${border};border-radius:6px;overflow:hidden;margin-bottom:4px;`;

    panel.innerHTML = `
      <button
        class="arianna-acc-header"
        data-acc-id="${item.id}"
        aria-expanded="${isOpen}"
        aria-disabled="${isDisabled}"
        role="tab"
        ${isDisabled ? 'disabled' : ''}
        style="width:100%;background:var(--bg3,#f5f5f5);border:none;cursor:${isDisabled ? 'not-allowed' : 'pointer'};
               display:flex;align-items:center;justify-content:space-between;padding:12px 16px;
               font:inherit;font-size:.84rem;font-weight:600;color:${isDisabled ? 'var(--muted,#aaa)' : 'var(--text,#111)'};
               text-align:left;opacity:${isDisabled ? '.5' : '1'};"
      >
        <span class="arianna-acc-title">${item.title}</span>
        ${renderIcon(this.#opts.icon, isOpen)}
      </button>
      <div
        class="arianna-acc-body"
        data-acc-id="${item.id}"
        role="tabpanel"
        style="${animStyle}background:var(--bg2,#fafafa);"
      >
        <div style="padding:14px 16px;">${item.content}</div>
      </div>
    `;

    return panel;
  }

  #update(id: string): void {
    const isOpen = this.#open.has(id);
    const header  = this.#el.querySelector(`.arianna-acc-header[data-acc-id="${id}"]`) as HTMLElement | null;
    const body    = this.#el.querySelector(`.arianna-acc-body[data-acc-id="${id}"]`)   as HTMLElement | null;
    const icon    = header?.querySelector('.arianna-wip-acc-icon') as HTMLElement | null;

    if (header) header.setAttribute('aria-expanded', String(isOpen));
    if (body) {
      if (this.#opts.animated) {
        body.style.maxHeight = isOpen ? '2000px' : '0';
      } else {
        body.style.display = isOpen ? 'block' : 'none';
      }
    }
    if (icon) {
      switch (this.#opts.icon) {
        case 'chevron': case 'arrow':
          icon.style.transform = `rotate(${isOpen ? 90 : 0}deg)`;
          break;
        case 'plus':
          icon.textContent = isOpen ? '−' : '+';
          break;
      }
    }
  }

  #updateBody(id: string, html: string): void {
    const body = this.#el.querySelector(`.arianna-acc-body[data-acc-id="${id}"] > div`);
    if (body) body.innerHTML = html;
  }

  #updateTitle(id: string, html: string): void {
    const title = this.#el.querySelector(`.arianna-acc-header[data-acc-id="${id}"] .arianna-acc-title`);
    if (title) title.innerHTML = html;
  }

  #wireEvents(): void {
    this.#el.addEventListener('click', (e: Event) => {
      const btn = (e.target as Element).closest('.arianna-wip-acc-header') as HTMLElement | null;
      if (!btn) return;
      const id = btn.dataset.accId;
      if (!id) return;
      const item = this.#find(id);
      if (!item || item.disabled) return;
      this.toggle(id);
      this.#fire('Accordion-Toggle', id, item);
    });

    // Keyboard navigation (↑ ↓ Home End)
    this.#el.addEventListener('keydown', (e: Event) => {
      const ke  = e as KeyboardEvent;
      const btn = (ke.target as Element).closest('.arianna-wip-acc-header') as HTMLElement | null;
      if (!btn) return;
      const headers = Array.from(this.#el.querySelectorAll('.arianna-wip-acc-header:not([disabled])')) as HTMLElement[];
      const idx     = headers.indexOf(btn);
      let next = -1;
      if (ke.key === 'ArrowDown')  next = (idx + 1) % headers.length;
      if (ke.key === 'ArrowUp')    next = (idx - 1 + headers.length) % headers.length;
      if (ke.key === 'Home')       next = 0;
      if (ke.key === 'End')        next = headers.length - 1;
      if (next >= 0) { ke.preventDefault(); headers[next].focus(); }
    });
  }
}

// ── Global registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
  Object.defineProperty(window, 'Accordion', {
    enumerable: true, configurable: false, writable: false, value: Accordion,
  });

export default Accordion;
