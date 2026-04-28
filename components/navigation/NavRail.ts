/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
/**
 * Navigation rail — vertical nav like Flutter NavigationRail.
 * @example
 *   const rail = new NavRail('#root');
 *   rail.items = [{ id:'home', icon:'🏠', label:'Home' }, { id:'settings', icon:'⚙️', label:'Settings' }];
 *   rail.active = 'home';
 *   rail.on('select', ({ id }) => router.go(id));
 */
export interface NavRailItem { id: string; label: string; icon: string; badge?: string|number; }
export interface NavRailOptions { collapsed?: boolean; class?: string; }
export class NavRail extends Control<NavRailOptions> {
  private _items: NavRailItem[] = [];
  private _active = '';
  constructor(container: string | HTMLElement | null = null, opts: NavRailOptions = {}) {
    super(container, 'nav', opts);
    this.el.className = `ar-navrail${opts.collapsed?' ar-navrail--collapsed':''}${opts.class?' '+opts.class:''}`;
  }
  set items(v: NavRailItem[]) { this._items = v; this._set('items' as never, v as never); }
  set active(id: string)      { this._active = id; this._build(); }
  get active()                { return this._active; }
  toggle()                    { const c = !this._get('collapsed', false); this._set('collapsed' as never, c as never); this.el.classList.toggle('ar-navrail--collapsed', c); }
  protected _build() {
    this.el.innerHTML = '';
    const btn = this._el('button', 'ar-navrail__toggle', this.el) as HTMLButtonElement;
    btn.textContent = this._get('collapsed', false) ? '▸' : '◂';
    btn.addEventListener('click', () => this.toggle());
    this._items.forEach(item => {
      const el = this._el('button', `ar-navrail__item${item.id===this._active?' ar-navrail__item--active':''}`, this.el) as HTMLButtonElement;
      const ic = this._el('span', 'ar-navrail__icon', el); ic.textContent = item.icon;
      const lbl = this._el('span', 'ar-navrail__label', el); lbl.textContent = item.label;
      if (item.badge !== undefined) { const b = this._el('span', 'ar-navrail__badge', el); b.textContent = String(item.badge); }
      el.addEventListener('click', () => { this._active = item.id; this._build(); this._emit('select', { id: item.id, item }); });
    });
  }
}
export const NavRailCSS = `.ar-navrail{display:flex;flex-direction:column;gap:2px;padding:8px 6px;width:220px;transition:width var(--ar-transition)}.ar-navrail--collapsed{width:56px}.ar-navrail__toggle{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.75rem;padding:6px;text-align:right}.ar-navrail__item{align-items:center;background:none;border:none;border-radius:var(--ar-radius);color:var(--ar-muted);cursor:pointer;display:flex;gap:10px;font:inherit;font-size:.83rem;padding:9px 10px;text-align:left;transition:background var(--ar-transition),color var(--ar-transition);white-space:nowrap;width:100%;overflow:hidden}.ar-navrail__item:hover{background:var(--ar-bg3);color:var(--ar-text)}.ar-navrail__item--active{background:rgba(126,184,247,.12);color:var(--ar-primary);font-weight:600}.ar-navrail__icon{flex-shrink:0;font-size:1.1rem;width:20px;text-align:center}.ar-navrail__label{flex:1}.ar-navrail--collapsed .ar-navrail__label{display:none}.ar-navrail__badge{background:var(--ar-danger);border-radius:8px;color:#fff;font-size:.65rem;padding:1px 5px}`;
