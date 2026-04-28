/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Banner
 * @example
 *   const b = new Banner('#root', { variant: 'warning' });
 *   b.message = 'Session expires in 5 minutes.';
 *   b.action  = 'Renew';
 *   b.on('action', () => renewSession());
 */
import { Control } from '../core/Control.ts';
export interface BannerOptions { variant?: 'default'|'info'|'success'|'warning'|'danger'; dismissible?: boolean; icon?: string; class?: string; }
export class Banner extends Control<BannerOptions> {
  private _message = '';
  private _action  = '';
  constructor(container: string | HTMLElement | null = null, opts: BannerOptions = {}) {
    super(container, 'div', { variant: 'default', dismissible: true, ...opts });
    this.el.className = `ar-banner ar-banner--${opts.variant??'default'}${opts.class?' '+opts.class:''}`;
    this.el.setAttribute('role', 'alert');
  }
  set message(v: string) { this._message = v; this._build(); }
  set action(v: string)  { this._action  = v; this._build(); }
  dismiss()              { this.el.style.display = 'none'; this._emit('dismiss', {}); }
  protected _build() {
    this.el.innerHTML = '';
    const icon = this._get('icon', '') as string; if (icon) this._el('span', 'ar-banner__icon', this.el).textContent = icon;
    this._el('span', 'ar-banner__msg', this.el).textContent = this._message;
    if (this._action) { const btn = this._el('button', 'ar-banner__action', this.el) as HTMLButtonElement; btn.textContent = this._action; btn.addEventListener('click', () => this._emit('action', {})); }
    if (this._get('dismissible', true)) { const x = this._el('button', 'ar-banner__close', this.el) as HTMLButtonElement; x.textContent = '✕'; x.addEventListener('click', () => this.dismiss()); }
  }
}
export const BannerCSS = `.ar-banner{align-items:center;display:flex;gap:10px;padding:10px 16px;font-size:.83rem}.ar-banner--default{background:var(--ar-bg3);border-bottom:1px solid var(--ar-border)}.ar-banner--info{background:rgba(77,208,225,.12);border-bottom:1px solid var(--ar-info)}.ar-banner--success{background:rgba(76,175,80,.12);border-bottom:1px solid var(--ar-success)}.ar-banner--warning{background:rgba(255,152,0,.12);border-bottom:1px solid var(--ar-warning)}.ar-banner--danger{background:rgba(244,67,54,.12);border-bottom:1px solid var(--ar-danger)}.ar-banner__msg{flex:1}.ar-banner__action{background:none;border:none;color:var(--ar-primary);cursor:pointer;font:inherit;font-size:.78rem;font-weight:600;text-decoration:underline}.ar-banner__close{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.85rem;margin-left:auto}.ar-banner__icon{flex-shrink:0}`;
