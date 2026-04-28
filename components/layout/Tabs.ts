/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
export interface TabItem { id: string; label: string; content: string|HTMLElement; icon?: string; disabled?: boolean; badge?: string|number; }
export interface TabsOptions { variant?: 'line'|'pill'|'contained'; class?: string; }
export class Tabs extends Control<TabsOptions> {
  private _items: TabItem[] = [];
  private _active = '';
  constructor(container: string | HTMLElement | null = null, opts: TabsOptions = {}) {
    super(container, 'div', { variant: 'line', ...opts });
    this.el.className = `ar-tabs ar-tabs--${opts.variant??'line'}${opts.class?' '+opts.class:''}`;
  }
  set items(v: TabItem[]) { this._items = v; if (!this._active && v.length) this._active = v[0].id; this._set('items' as never, v as never); }
  set active(id: string)  { this._active = id; this._build(); }
  get active()            { return this._active; }
  protected _build() {
    this.el.innerHTML = '';
    const nav  = this._el('div', 'ar-tabs__nav',  this.el);
    const body = this._el('div', 'ar-tabs__body', this.el);
    this._items.forEach(item => {
      const btn = this._el('button', `ar-tabs__tab${item.id===this._active?' ar-tabs__tab--active':''}${item.disabled?' ar-tabs__tab--disabled':''}`, nav) as HTMLButtonElement;
      btn.disabled = !!item.disabled;
      if (item.icon) { const ic = this._el('span', 'ar-tabs__icon', btn); ic.textContent = item.icon; }
      const l = this._el('span', '', btn); l.textContent = item.label;
      if (item.badge !== undefined) { const b = this._el('span', 'ar-tabs__badge', btn); b.textContent = String(item.badge); }
      btn.addEventListener('click', () => { if (!item.disabled) { this._active = item.id; this._emit('change', { id: item.id }); this._build(); } });
      if (item.id === this._active) {
        const pane = this._el('div', 'ar-tabs__pane', body);
        if (typeof item.content === 'string') pane.innerHTML = item.content; else pane.appendChild(item.content);
      }
    });
  }
}
export const TabsCSS = `.ar-tabs{display:flex;flex-direction:column}.ar-tabs__nav{display:flex;border-bottom:1px solid var(--ar-border);overflow-x:auto}.ar-tabs__tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--ar-muted);cursor:pointer;display:flex;align-items:center;gap:6px;font:inherit;font-size:.82rem;margin-bottom:-1px;padding:8px 16px;transition:color var(--ar-transition),border-color var(--ar-transition);white-space:nowrap;flex-shrink:0}.ar-tabs__tab:hover:not(:disabled){color:var(--ar-text)}.ar-tabs__tab--active{border-bottom-color:var(--ar-primary);color:var(--ar-primary)}.ar-tabs__tab--disabled{opacity:.4;cursor:not-allowed}.ar-tabs--pill .ar-tabs__nav{border-bottom:none;gap:4px;padding:4px}.ar-tabs--pill .ar-tabs__tab{border:1px solid transparent;border-bottom-width:1px;border-radius:var(--ar-radius);margin-bottom:0}.ar-tabs--pill .ar-tabs__tab--active{background:var(--ar-primary);border-color:var(--ar-primary);color:var(--ar-primary-text)}.ar-tabs__badge{background:var(--ar-warning);border-radius:8px;color:#000;font-size:.65rem;min-width:16px;padding:1px 4px;text-align:center}.ar-tabs__body{flex:1;padding:12px 0}.ar-tabs__pane{animation:ar-fadein .18s ease}@keyframes ar-fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`;
