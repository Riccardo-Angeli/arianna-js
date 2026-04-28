/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
/**
 * Application header bar.
 * @example
 *   const header = new Header('#root');
 *   header.title = 'AriannA';
 *   header.logo  = '<img src="/logo.svg" alt="logo">';
 *   header.actions = '<button>Sign in</button>';
 */
export interface HeaderOptions { sticky?: boolean; class?: string; }
export class Header extends Control<HeaderOptions> {
  private _title   = '';
  private _logo: string|HTMLElement = '';
  private _actions: string|HTMLElement = '';
  constructor(container: string | HTMLElement | null = null, opts: HeaderOptions = {}) {
    super(container, 'header', opts);
    this.el.className = `ar-header${opts.sticky?' ar-header--sticky':''}${opts.class?' '+opts.class:''}`;
  }
  set title(v: string)               { this._title   = v; this._build(); }
  set logo(v: string|HTMLElement)    { this._logo    = v; this._build(); }
  set actions(v: string|HTMLElement) { this._actions = v; this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    const inner = this._el('div', 'ar-header__inner', this.el);
    if (this._logo) { const l = this._el('div', 'ar-header__logo', inner); if (typeof this._logo === 'string') l.innerHTML = this._logo; else l.appendChild(this._logo); }
    if (this._title) { const t = this._el('span', 'ar-header__title', inner); t.textContent = this._title; }
    this._el('div', 'ar-header__spacer', inner);
    if (this._actions) { const a = this._el('div', 'ar-header__actions', inner); if (typeof this._actions === 'string') a.innerHTML = this._actions; else a.appendChild(this._actions); }
  }
}
export const HeaderCSS = `.ar-header{background:var(--ar-bg2);border-bottom:1px solid var(--ar-border)}.ar-header--sticky{position:sticky;top:0;z-index:100}.ar-header__inner{align-items:center;display:flex;gap:12px;height:52px;margin:0 auto;max-width:100%;padding:0 16px}.ar-header__logo{display:flex;align-items:center}.ar-header__title{font-size:.95rem;font-weight:700;white-space:nowrap}.ar-header__spacer{flex:1}.ar-header__actions{align-items:center;display:flex;gap:8px}`;
