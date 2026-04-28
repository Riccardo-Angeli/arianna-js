/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Icon
 * @example
 *   const icon = new Icon('#root', { size: 24 });
 *   icon.src = '🚀';              // emoji
 *   icon.src = '<svg>...</svg>';  // inline SVG
 */
import { Control } from '../core/Control.ts';
export interface IconOptions { size?: number; color?: string; class?: string; }
export class Icon extends Control<IconOptions> {
  private _src = '';
  constructor(container: string | HTMLElement | null = null, opts: IconOptions = {}) {
    super(container, 'span', opts);
    this.el.className = `ar-icon${opts.class?' '+opts.class:''}`;
    this.el.setAttribute('aria-hidden', 'true');
    if (opts.size)  { this.el.style.fontSize = opts.size+'px'; this.el.style.width = opts.size+'px'; this.el.style.height = opts.size+'px'; }
    if (opts.color) this.el.style.color = opts.color;
  }
  set src(v: string) { this._src = v; this._build(); }
  get src()          { return this._src; }
  protected _build() {
    if (this._src.trimStart().startsWith('<')) this.el.innerHTML = this._src;
    else this.el.textContent = this._src;
  }
}
export const IconCSS = `.ar-icon{align-items:center;display:inline-flex;flex-shrink:0;justify-content:center;line-height:1}.ar-icon svg{height:1em;width:1em}`;
