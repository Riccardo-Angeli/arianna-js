/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Divider
 * @example
 *   const LICENSES = new Divider('#root', { label: 'OR' });
 *   // Vertical:
 *   const dv = new Divider('#root', { orientation: 'vertical' });
 */
import { Control } from '../core/Control.ts';
export interface DividerOptions { label?: string; orientation?: 'horizontal'|'vertical'; variant?: 'solid'|'dashed'|'dotted'; class?: string; }
export class Divider extends Control<DividerOptions> {
  constructor(container: string | HTMLElement | null = null, opts: DividerOptions = {}) {
    super(container, 'div', { orientation: 'horizontal', variant: 'solid', ...opts });
    this.el.className = `ar-divider ar-divider--${opts.orientation??'horizontal'} ar-divider--${opts.variant??'solid'}${opts.class?' '+opts.class:''}`;
    this.el.setAttribute('role', 'separator');
  }
  set label(v: string) { this._set('label' as never, v as never); }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string;
    this._el('span', 'ar-divider__line', this.el);
    if (lbl) this._el('span', 'ar-divider__label', this.el).textContent = lbl;
    if (lbl) this._el('span', 'ar-divider__line', this.el);
  }
}
export const DividerCSS = `.ar-divider{display:flex;align-items:center;gap:10px}.ar-divider--horizontal{width:100%}.ar-divider--vertical{align-self:stretch;flex-direction:column;width:auto}.ar-divider__line{border-top:1px solid var(--ar-border);flex:1}.ar-divider--vertical .ar-divider__line{border-top:none;border-left:1px solid var(--ar-border);flex:1}.ar-divider--dashed .ar-divider__line{border-style:dashed}.ar-divider--dotted .ar-divider__line{border-style:dotted}.ar-divider__label{color:var(--ar-muted);font-size:.78rem;white-space:nowrap}`;
