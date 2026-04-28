/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
export interface PanelOptions { collapsible?: boolean; collapsed?: boolean; class?: string; }
export class Panel extends Control<PanelOptions> {
  private _title    = '';
  private _content: string|HTMLElement = '';
  private _toolbar: string|HTMLElement = '';
  private _collapsed = false;
  constructor(container: string | HTMLElement | null = null, opts: PanelOptions = {}) {
    super(container, 'div', opts);
    this._collapsed = opts.collapsed ?? false;
    this.el.className = `ar-panel${opts.class?' '+opts.class:''}`;
  }
  set title(v: string)               { this._title   = v; this._build(); }
  set content(v: string|HTMLElement) { this._content = v; this._build(); }
  set toolbar(v: string|HTMLElement) { this._toolbar = v; this._build(); }
  set collapsible(v: boolean)        { this._set('collapsible' as never, v as never); }
  get collapsed()                    { return this._collapsed; }
  toggle() { this._collapsed = !this._collapsed; this._emit('toggle', { collapsed: this._collapsed }); this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    if (this._title || this._toolbar) {
      const h = this._el('div', 'ar-panel__header', this.el);
      if (this._title) { const t = this._el('span', 'ar-panel__title', h); t.textContent = this._title; }
      if (this._toolbar) { const tb = this._el('div', 'ar-panel__toolbar', h); if (typeof this._toolbar === 'string') tb.innerHTML = this._toolbar; else tb.appendChild(this._toolbar); }
      if (this._get('collapsible', false)) {
        const btn = this._el('button', 'ar-panel__toggle', h) as HTMLButtonElement;
        btn.textContent = this._collapsed ? '▸' : '▾';
        btn.addEventListener('click', () => this.toggle());
      }
    }
    if (!this._collapsed) {
      const b = this._el('div', 'ar-panel__body', this.el);
      if (typeof this._content === 'string') b.innerHTML = this._content;
      else if (this._content) b.appendChild(this._content);
    }
  }
}
export const PanelCSS = `.ar-panel{background:var(--ar-bg2);border:1px solid var(--ar-border);border-radius:var(--ar-radius);overflow:hidden}.ar-panel__header{align-items:center;background:var(--ar-bg3);border-bottom:1px solid var(--ar-border);display:flex;gap:8px;padding:8px 14px}.ar-panel__title{flex:1;font-size:.85rem;font-weight:600}.ar-panel__toolbar{display:flex;gap:6px;align-items:center}.ar-panel__toggle{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.75rem;padding:2px}.ar-panel__body{padding:14px}`;
