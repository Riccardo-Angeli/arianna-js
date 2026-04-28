/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Avatar
 * @example
 *   const av = new Avatar('#root', { size: 40 });
 *   av.src  = '/user.jpg';    // image
 *   av.name = 'Riccardo Angeli'; // initials fallback → RA
 *   av.status = 'online';
 */
import { Control } from '../core/Control.ts';
export interface AvatarOptions { size?: number; shape?: 'circle'|'square'|'rounded'; status?: 'online'|'offline'|'busy'|'away'; class?: string; }
export class Avatar extends Control<AvatarOptions> {
  private _src  = '';
  private _name = '';
  private _icon = '';
  constructor(container: string | HTMLElement | null = null, opts: AvatarOptions = {}) {
    super(container, 'div', { size: 36, shape: 'circle', ...opts });
    const s = opts.size ?? 36;
    this.el.className = `ar-avatar ar-avatar--${opts.shape??'circle'}${opts.class?' '+opts.class:''}`;
    this.el.style.cssText += `;width:${s}px;height:${s}px;font-size:${Math.round(s*.38)}px`;
  }
  set src(v: string)    { this._src  = v; this._build(); }
  set name(v: string)   { this._name = v; this._build(); }
  set icon(v: string)   { this._icon = v; this._build(); }
  set status(v: string) { this._set('status' as never, v as never); this._build(); }
  private _initials(name: string) { return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
  protected _build() {
    this.el.innerHTML = '';
    if (this._src) { const img = document.createElement('img'); img.src = this._src; img.alt = this._name; img.className = 'ar-avatar__img'; this.el.appendChild(img); }
    else if (this._name) this._el('span', 'ar-avatar__initials', this.el).textContent = this._initials(this._name);
    else if (this._icon) this._el('span', 'ar-avatar__icon',     this.el).textContent = this._icon;
    const s = this._get('status', '') as string; if (s) this._el('span', `ar-avatar__status ar-avatar__status--${s}`, this.el);
  }
}
export const AvatarCSS = `.ar-avatar{align-items:center;background:var(--ar-bg4);display:inline-flex;flex-shrink:0;font-weight:600;justify-content:center;overflow:hidden;position:relative}.ar-avatar--circle{border-radius:50%}.ar-avatar--square{border-radius:0}.ar-avatar--rounded{border-radius:var(--ar-radius)}.ar-avatar__img{height:100%;object-fit:cover;width:100%}.ar-avatar__status{border:2px solid var(--ar-bg);border-radius:50%;bottom:1px;height:10px;position:absolute;right:1px;width:10px}.ar-avatar__status--online{background:var(--ar-success)}.ar-avatar__status--offline{background:var(--ar-dim)}.ar-avatar__status--busy{background:var(--ar-danger)}.ar-avatar__status--away{background:var(--ar-warning)}`;
