/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Rating
 * @example
 *   const r = new Rating('#root', { max: 5 });
 *   r.value = 3;
 *   r.on('change', ({ value }) => console.log(value));
 */
import { Control } from '../core/Control.ts';
export interface RatingOptions { max?: number; readonly?: boolean; icon?: string; emptyIcon?: string; class?: string; }
export class Rating extends Control<RatingOptions> {
  private _value = 0;
  private _hover = 0;
  constructor(container: string | HTMLElement | null = null, opts: RatingOptions = {}) {
    super(container, 'div', { max: 5, icon: '★', emptyIcon: '☆', ...opts });
    this.el.className = `ar-rating${opts.class?' '+opts.class:''}`;
    this.el.setAttribute('role', 'slider');
  }
  set value(v: number) { this._value = v; this._build(); }
  get value()          { return this._value; }
  protected _build() {
    this.el.innerHTML = '';
    const max   = this._get('max', 5) as number;
    const ro    = this._get('readonly', false) as boolean;
    const icon  = this._get('icon', '★') as string;
    const empty = this._get('emptyIcon', '☆') as string;
    for (let i = 1; i <= max; i++) {
      const filled = i <= (this._hover || this._value);
      const star = this._el('span', `ar-rating__star${filled?' ar-rating__star--filled':''}`, this.el);
      star.textContent = filled ? icon : empty;
      if (!ro) {
        star.addEventListener('click',      () => { this._value = i; this._emit('change', { value: i }); this._build(); });
        star.addEventListener('mouseenter', () => { this._hover = i; this._build(); });
        star.addEventListener('mouseleave', () => { this._hover = 0; this._build(); });
      }
    }
  }
}
export const RatingCSS = `.ar-rating{display:inline-flex;gap:2px}.ar-rating__star{color:var(--ar-dim);cursor:pointer;font-size:1.3rem;transition:color var(--ar-transition),transform var(--ar-transition)}.ar-rating__star--filled{color:var(--ar-warning)}.ar-rating__star:hover{transform:scale(1.15)}`;
