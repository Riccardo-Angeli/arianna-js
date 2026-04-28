/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module TimePicker
 * Time input HH:MM with optional seconds.
 * @example
 *   const tp = new TimePicker('#root', { label: 'Start time', seconds: false });
 *   tp.value = '14:30';
 *   tp.on('change', ({ value }) => console.log(value));
 */
import { Control } from '../core/Control.ts';
export interface TimePickerOptions { label?: string; seconds?: boolean; min?: string; max?: string; disabled?: boolean; class?: string; }
export class TimePicker extends Control<TimePickerOptions> {
  private _value = '';
  private _input!: HTMLInputElement;
  constructor(container: string | HTMLElement | null = null, opts: TimePickerOptions = {}) {
    super(container, 'div', { seconds: false, ...opts });
    this.el.className = `ar-timepicker${opts.class?' '+opts.class:''}`;
  }
  set value(v: string) { this._value = v; if (this._input) this._input.value = v; }
  get value()          { return this._input?.value ?? this._value; }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string; if (lbl) this._el('div', 'ar-timepicker__label', this.el).textContent = lbl;
    const wrap = this._el('div', 'ar-timepicker__wrap', this.el);
    this._el('span', 'ar-timepicker__icon', wrap).textContent = '🕐';
    this._input = document.createElement('input');
    this._input.type = 'time'; this._input.className = 'ar-timepicker__input';
    this._input.value = this._value;
    this._input.disabled = this._get('disabled', false) as boolean;
    if (this._get('seconds', false)) this._input.step = '1';
    const min = this._get('min', '') as string; if (min) this._input.min = min;
    const max = this._get('max', '') as string; if (max) this._input.max = max;
    this._input.addEventListener('change', () => { this._value = this._input.value; this._emit('change', { value: this._value }); });
    wrap.appendChild(this._input);
  }
}
export const TimePickerCSS = `.ar-timepicker{display:flex;flex-direction:column;gap:4px}.ar-timepicker__label{color:var(--ar-muted);font-size:.78rem;font-weight:500}.ar-timepicker__wrap{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);display:flex;gap:8px;padding:5px 10px;transition:border-color var(--ar-transition)}.ar-timepicker__wrap:focus-within{border-color:var(--ar-primary)}.ar-timepicker__icon{flex-shrink:0}.ar-timepicker__input{background:none;border:none;color:var(--ar-text);font:inherit;font-size:.82rem;outline:none}`;
