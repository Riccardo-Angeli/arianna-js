/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Skeleton
 * @example
 *   const sk = new Skeleton('#root', { variant: 'card', lines: 3 });
 *   // Destroy when data is ready
 *   sk.destroy();
 */
import { Control } from '../core/Control.ts';
export interface SkeletonOptions { variant?: 'text'|'rect'|'circle'|'card'; lines?: number; avatar?: boolean; width?: string; height?: string; class?: string; }
export class Skeleton extends Control<SkeletonOptions> {
  constructor(container: string | HTMLElement | null = null, opts: SkeletonOptions = {}) {
    super(container, 'div', { variant: 'text', lines: 3, ...opts });
    this.el.className = `ar-skeleton${opts.class?' '+opts.class:''}`;
  }
  protected _build() {
    this.el.innerHTML = '';
    const v = this._get('variant', 'text') as string;
    const w = this._get('width', '') as string; const h = this._get('height', '') as string;
    if (v === 'circle') { const c = this._el('div', 'ar-skeleton__circle', this.el); if (w) { c.style.width = w; c.style.height = h||w; } return; }
    if (v === 'rect')   { const r = this._el('div', 'ar-skeleton__rect', this.el); if (w) r.style.width = w; if (h) r.style.height = h; return; }
    if (v === 'card')   { this._el('div','ar-skeleton__rect',this.el).style.height='160px'; for(let i=0;i<3;i++) this._el('div','ar-skeleton__line',this.el); return; }
    if (this._get('avatar', false)) {
      const row = this._el('div', 'ar-skeleton__row', this.el);
      this._el('div', 'ar-skeleton__circle', row);
      const lines = this._el('div', 'ar-skeleton__lines', row);
      for(let i=0;i<2;i++) { const l = this._el('div','ar-skeleton__line',lines); if(i===1) l.style.width='60%'; }
      return;
    }
    const n = this._get('lines', 3) as number;
    for (let i = 0; i < n; i++) { const l = this._el('div', 'ar-skeleton__line', this.el); if (i === n-1) l.style.width = '60%'; }
  }
}
export const SkeletonCSS = `.ar-skeleton{display:flex;flex-direction:column;gap:8px}.ar-skeleton__row{display:flex;align-items:center;gap:12px}.ar-skeleton__lines{flex:1;display:flex;flex-direction:column;gap:6px}.ar-skeleton__line,.ar-skeleton__rect,.ar-skeleton__circle{animation:ar-shimmer 1.5s infinite ease-in-out;background:linear-gradient(90deg,var(--ar-bg3) 25%,var(--ar-bg4) 50%,var(--ar-bg3) 75%);background-size:200% 100%;border-radius:var(--ar-radius)}.ar-skeleton__line{height:12px;width:100%}.ar-skeleton__rect{height:80px;width:100%}.ar-skeleton__circle{border-radius:50%;flex-shrink:0;height:40px;width:40px}@keyframes ar-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
