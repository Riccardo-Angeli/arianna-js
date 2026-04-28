/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module List
 * @example
 *   const list = new List('#root', { selectable: true });
 *   list.items = [
 *     { id: '1', label: 'Item A', icon: '📄', meta: '2 KB' },
 *     { id: '2', label: 'Item B', icon: '📁', badge: 'New' },
 *   ];
 *   list.on('select', ({ item }) => console.log(item));
 */
import { Control } from '../core/Control.ts';
export interface ListItem { id: string; label: string; subtitle?: string; icon?: string; badge?: string|number; meta?: string; disabled?: boolean; }
export interface ListOptions { selectable?: boolean; multiselect?: boolean; dense?: boolean; divided?: boolean; class?: string; }
export class List extends Control<ListOptions> {
  private _items    : ListItem[] = [];
  private _selected = new Set<string>();
  constructor(container: string | HTMLElement | null = null, opts: ListOptions = {}) {
    super(container, 'ul', opts);
    this.el.className = `ar-list${opts.dense?' ar-list--dense':''}${opts.divided?' ar-list--divided':''}${opts.class?' '+opts.class:''}`;
    this.el.setAttribute('role', opts.selectable ? 'listbox' : 'list');
  }
  set items(v: ListItem[])    { this._items = v; this._set('items' as never, v as never); }
  get selected(): Set<string> { return this._selected; }
  clearSelection()            { this._selected.clear(); this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    this._items.forEach(item => {
      const isOn = this._selected.has(item.id);
      const li = this._el('li', `ar-list__item${isOn?' ar-list__item--selected':''}${item.disabled?' ar-list__item--disabled':''}`, this.el);
      li.setAttribute('role', this._get('selectable', false) ? 'option' : 'listitem');
      if (item.icon) this._el('span', 'ar-list__icon', li).textContent = item.icon;
      const body = this._el('div', 'ar-list__body', li);
      this._el('div', 'ar-list__label', body).textContent = item.label;
      if (item.subtitle) this._el('div', 'ar-list__subtitle', body).textContent = item.subtitle;
      if (item.badge !== undefined) this._el('span', 'ar-list__badge', li).textContent = String(item.badge);
      if (item.meta) this._el('span', 'ar-list__meta', li).textContent = item.meta;
      if (this._get('selectable', false) && !item.disabled) {
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
          if (!this._get('multiselect', false)) this._selected.clear();
          if (isOn) this._selected.delete(item.id); else this._selected.add(item.id);
          this._build(); this._emit('select', { item, selected: [...this._selected] });
        });
      }
    });
  }
}
export const ListCSS = `.ar-list{list-style:none;margin:0;padding:0}.ar-list--divided .ar-list__item:not(:last-child){border-bottom:1px solid var(--ar-border)}.ar-list__item{align-items:center;display:flex;gap:10px;padding:10px 12px;transition:background var(--ar-transition)}.ar-list--dense .ar-list__item{padding:6px 12px}.ar-list__item:hover:not(.ar-list__item--disabled){background:var(--ar-bg3)}.ar-list__item--selected{background:rgba(126,184,247,.1)}.ar-list__item--disabled{opacity:.45}.ar-list__icon{flex-shrink:0;font-size:1rem}.ar-list__body{flex:1;min-width:0}.ar-list__label{font-size:.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ar-list__subtitle{color:var(--ar-muted);font-size:.74rem;margin-top:1px}.ar-list__badge{background:var(--ar-primary);border-radius:10px;color:var(--ar-primary-text);font-size:.66rem;font-weight:600;padding:1px 6px}.ar-list__meta{color:var(--ar-muted);font-size:.74rem;white-space:nowrap}`;
