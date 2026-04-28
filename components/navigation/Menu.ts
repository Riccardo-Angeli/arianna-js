/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
export interface MenuItem { id: string; label: string; icon?: string; shortcut?: string; disabled?: boolean; danger?: boolean; separator?: boolean; }
export class Menu extends Control {
  private _items: MenuItem[] = [];
  constructor() {
    super(null, 'div');
    document.body.appendChild(this.el);
    this.el.className = 'ar-menu';
    this.el.style.display = 'none';
    this._on(document as unknown as HTMLElement, 'click', () => this.close());
    this._on(document as unknown as HTMLElement, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') this.close(); });
  }
  set items(v: MenuItem[]) { this._items = v; this._set('items' as never, v as never); }
  openAt(x: number, y: number) {
    this._build(); this.el.style.display = '';
    const w = this.el.offsetWidth || 180; const h = this.el.offsetHeight || 200;
    this.el.style.left = (x + w > window.innerWidth  ? window.innerWidth  - w - 8 : x) + 'px';
    this.el.style.top  = (y + h > window.innerHeight ? window.innerHeight - h - 8 : y) + 'px';
    this._emit('open', {});
  }
  openBelow(anchor: HTMLElement) { const r = anchor.getBoundingClientRect(); this.openAt(r.left, r.bottom + 4); }
  close() { this.el.style.display = 'none'; this._emit('close', {}); }
  protected _build() {
    this.el.innerHTML = '';
    this._items.forEach(item => {
      if (item.separator) { this._el('div', 'ar-menu__sep', this.el); return; }
      const row = this._el('button', `ar-menu__item${item.disabled?' ar-menu__item--disabled':''}${item.danger?' ar-menu__item--danger':''}`, this.el) as HTMLButtonElement;
      row.disabled = !!item.disabled;
      if (item.icon) { const ic = this._el('span', 'ar-menu__icon', row); ic.textContent = item.icon; }
      const lbl = this._el('span', 'ar-menu__label', row); lbl.textContent = item.label;
      if (item.shortcut) { const sc = this._el('span', 'ar-menu__shortcut', row); sc.textContent = item.shortcut; }
      row.addEventListener('click', e => { e.stopPropagation(); if (!item.disabled) { this._emit('select', { id: item.id, item }); this.close(); } });
    });
  }
}
export const MenuCSS = `.ar-menu{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius-lg);box-shadow:var(--ar-shadow-lg);display:flex;flex-direction:column;min-width:180px;overflow:hidden;padding:4px 0;position:fixed;z-index:2000}.ar-menu__item{align-items:center;background:none;border:none;color:var(--ar-text);cursor:pointer;display:flex;font:inherit;font-size:.82rem;gap:8px;padding:7px 14px;text-align:left;width:100%;transition:background var(--ar-transition)}.ar-menu__item:hover:not(:disabled){background:var(--ar-bg4)}.ar-menu__item--danger{color:var(--ar-danger)}.ar-menu__item--disabled{opacity:.4;cursor:not-allowed}.ar-menu__label{flex:1}.ar-menu__shortcut{color:var(--ar-muted);font-size:.72rem}.ar-menu__icon{width:16px;text-align:center;flex-shrink:0}.ar-menu__sep{background:var(--ar-border);height:1px;margin:4px 0}`;
