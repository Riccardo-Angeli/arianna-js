/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module RangeSlider
 * @example
 *   const s = new RangeSlider('#root', { min: 0, max: 100, label: 'Volume' });
 *   s.value = 42;
 *   s.on('change', ({ value }) => setVolume(value));
 */
import { Control } from '../core/Control.ts';
export interface RangeSliderOptions { min?: number; max?: number; step?: number; label?: string; showValue?: boolean; disabled?: boolean; class?: string; }
export class RangeSlider extends Control<RangeSliderOptions> {
  private _value = 0;
  private _input!: HTMLInputElement;
  constructor(container: string | HTMLElement | null = null, opts: RangeSliderOptions = {}) {
    super(container, 'div', { min: 0, max: 100, step: 1, showValue: true, ...opts });
    this.el.className = `ar-slider${opts.class?' '+opts.class:''}`;
  }
  set value(v: number) { this._value = v; if (this._input) this._input.value = String(v); }
  get value()          { return Number(this._input?.value ?? this._value); }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string; if (lbl) this._el('div', 'ar-slider__label', this.el).textContent = lbl;
    const wrap = this._el('div', 'ar-slider__wrap', this.el);
    this._input = document.createElement('input'); this._input.type = 'range'; this._input.className = 'ar-slider__input';
    this._input.min = String(this._get('min', 0)); this._input.max = String(this._get('max', 100)); this._input.step = String(this._get('step', 1));
    this._input.value = String(this._value); this._input.disabled = this._get('disabled', false) as boolean;
    const val = this._get('showValue', true) ? this._el('span', 'ar-slider__value', wrap) : null;
    if (val) val.textContent = String(this._value);
    this._input.addEventListener('input', () => { this._value = Number(this._input.value); if (val) val.textContent = String(this._value); this._emit('input', { value: this._value }); });
    this._input.addEventListener('change', () => this._emit('change', { value: this.value }));
    wrap.insertBefore(this._input, val ?? null);
  }
}
export const RangeSliderCSS = `.ar-slider{display:flex;flex-direction:column;gap:4px}.ar-slider__label{color:var(--ar-muted);font-size:.78rem}.ar-slider__wrap{align-items:center;display:flex;gap:10px}.ar-slider__input{accent-color:var(--ar-primary);flex:1;cursor:pointer}.ar-slider__value{color:var(--ar-primary);font-size:.82rem;font-weight:600;min-width:32px;text-align:right}`;
