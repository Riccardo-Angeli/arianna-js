/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
export interface BreadcrumbItem { label: string; href?: string; icon?: string; }
export interface BreadcrumbOptions { separator?: string; class?: string; }
export class Breadcrumb extends Control<BreadcrumbOptions> {
  private _items: BreadcrumbItem[] = [];
  constructor(container: string | HTMLElement | null = null, opts: BreadcrumbOptions = {}) {
    super(container, 'nav', opts);
    this.el.className = `ar-breadcrumb${opts.class?' '+opts.class:''}`;
    this.el.setAttribute('aria-label', 'Breadcrumb');
  }
  set items(v: BreadcrumbItem[]) { this._items = v; this._set('items' as never, v as never); }
  protected _build() {
    this.el.innerHTML = '';
    const ol  = this._el('ol', 'ar-breadcrumb__list', this.el);
    const sep = this._get('separator', '/') as string;
    this._items.forEach((item, i) => {
      const li     = this._el('li', 'ar-breadcrumb__item', ol);
      const isLast = i === this._items.length - 1;
      if (item.icon) { const ic = this._el('span', 'ar-breadcrumb__icon', li); ic.textContent = item.icon; }
      if (isLast) {
        const s = this._el('span', 'ar-breadcrumb__current', li);
        s.textContent = item.label; s.setAttribute('aria-current', 'page');
      } else {
        const a = document.createElement('a'); a.className = 'ar-breadcrumb__link'; a.textContent = item.label;
        if (item.href) a.href = item.href;
        a.addEventListener('click', e => { e.preventDefault(); this._emit('click', { item }, e as Event); });
        li.appendChild(a);
        const s2 = this._el('span', 'ar-breadcrumb__sep', li);
        s2.textContent = sep; s2.setAttribute('aria-hidden', 'true');
      }
    });
  }
}
export const BreadcrumbCSS = `.ar-breadcrumb__list{display:flex;flex-wrap:wrap;gap:2px;list-style:none;margin:0;padding:0}.ar-breadcrumb__item{align-items:center;display:flex;gap:4px;font-size:.82rem}.ar-breadcrumb__link{color:var(--ar-primary);text-decoration:none}.ar-breadcrumb__link:hover{text-decoration:underline}.ar-breadcrumb__current{color:var(--ar-muted)}.ar-breadcrumb__sep{color:var(--ar-dim);padding:0 2px}`;
