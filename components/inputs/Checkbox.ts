/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Checkbox
 * @example
 *   const cb = new Checkbox('#root', { label: 'Accept terms' });
 *   cb.checked = false;
 *   cb.on('change', ({ checked }) => validate());
 */
import { Control } from '../core/Control.ts';
export interface CheckboxOptions { label?: string; disabled?: boolean; class?: string; }
export class Checkbox extends Control<CheckboxOptions> {
  private _checked       = false;
  private _indeterminate = false;
  private _input!: HTMLInputElement;
  constructor(container: string | HTMLElement | null = null, opts: CheckboxOptions = {}) {
    super(container, 'label', opts);
    this.el.className = `ar-checkbox${opts.class?' '+opts.class:''}`;
  }
  set checked(v: boolean)       { this._checked = v; if (this._input) this._input.checked = v; }
  get checked()                 { return this._input?.checked ?? this._checked; }
  set indeterminate(v: boolean) { this._indeterminate = v; if (this._input) this._input.indeterminate = v; }
  set disabled(v: boolean)      { if (this._input) this._input.disabled = v; }
  protected _build() {
    this.el.innerHTML = '';
    this._input = document.createElement('input');
    this._input.type = 'checkbox'; this._input.className = 'ar-checkbox__input';
    this._input.checked = this._checked; this._input.disabled = this._get('disabled', false) as boolean;
    this._input.indeterminate = this._indeterminate;
    this._input.addEventListener('change', () => { this._checked = this._input.checked; this._emit('change', { checked: this._checked }); });
    this.el.appendChild(this._input);
    this._el('span', 'ar-checkbox__box', this.el);
    const lbl = this._get('label', '') as string; if (lbl) this._el('span', 'ar-checkbox__label', this.el).textContent = lbl;
  }
}
export const CheckboxCSS = `.ar-checkbox{align-items:center;cursor:pointer;display:inline-flex;gap:8px;user-select:none}.ar-checkbox__input{height:0;opacity:0;position:absolute;width:0}.ar-checkbox__box{align-items:center;background:var(--ar-bg3);border:1.5px solid var(--ar-border);border-radius:3px;display:flex;flex-shrink:0;height:16px;justify-content:center;transition:all var(--ar-transition);width:16px}.ar-checkbox__input:checked+.ar-checkbox__box,.ar-checkbox__input:indeterminate+.ar-checkbox__box{background:var(--ar-primary);border-color:var(--ar-primary)}.ar-checkbox__input:checked+.ar-checkbox__box::after{color:#000;content:'✓';font-size:.7rem;font-weight:700}.ar-checkbox__input:indeterminate+.ar-checkbox__box::after{background:#000;content:'';height:2px;width:8px}.ar-checkbox__label{font-size:.82rem}`;
