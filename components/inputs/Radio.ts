/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Radio
 * @example
 *   const radio = new Radio('#root', { label: 'Theme' });
 *   radio.options = [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }];
 *   radio.value = 'dark';
 *   radio.on('change', ({ value }) => applyTheme(value));
 */
import { Control } from '../core/Control.ts';
export interface RadioOption { value: string; label: string; disabled?: boolean; }
export interface RadioOptions { label?: string; direction?: 'row'|'column'; class?: string; }
export class Radio extends Control<RadioOptions> {
  private _options : RadioOption[] = [];
  private _value   = '';
  private _name    = 'ar-radio-' + Math.random().toString(36).slice(2, 7);
  constructor(container: string | HTMLElement | null = null, opts: RadioOptions = {}) {
    super(container, 'div', { direction: 'column', ...opts });
    this.el.className = `ar-radio-group${opts.class?' '+opts.class:''}`;
  }
  set options(v: RadioOption[]) { this._options = v; this._set('options' as never, v as never); }
  set value(v: string)          { this._value = v; this._build(); }
  get value()                   { return this._value; }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string;
    if (lbl) this._el('div', 'ar-radio-group__label', this.el).textContent = lbl;
    const wrap = this._el('div', `ar-radio-group__items ar-radio-group__items--${this._get('direction','column') as string}`, this.el);
    this._options.forEach(opt => {
      const label = this._el('label', `ar-radio${opt.disabled?' ar-radio--disabled':''}`, wrap);
      const input = document.createElement('input');
      input.type = 'radio'; input.className = 'ar-radio__input';
      input.name = this._name; input.value = opt.value;
      input.checked = opt.value === this._value; input.disabled = !!opt.disabled;
      input.addEventListener('change', () => { if (input.checked) { this._value = opt.value; this._emit('change', { value: opt.value }); } });
      label.appendChild(input);
      this._el('span', 'ar-radio__circle', label);
      this._el('span', 'ar-radio__label', label).textContent = opt.label;
    });
  }
}
export const RadioCSS = `.ar-radio-group__label{color:var(--ar-muted);font-size:.78rem;font-weight:500;margin-bottom:6px}.ar-radio-group__items{display:flex;gap:8px}.ar-radio-group__items--column{flex-direction:column}.ar-radio{align-items:center;cursor:pointer;display:inline-flex;gap:8px;user-select:none}.ar-radio__input{height:0;opacity:0;position:absolute;width:0}.ar-radio__circle{background:var(--ar-bg3);border:1.5px solid var(--ar-border);border-radius:50%;flex-shrink:0;height:16px;position:relative;transition:all var(--ar-transition);width:16px}.ar-radio__input:checked+.ar-radio__circle{border-color:var(--ar-primary)}.ar-radio__input:checked+.ar-radio__circle::after{background:var(--ar-primary);border-radius:50%;content:'';height:8px;left:3px;position:absolute;top:3px;width:8px}.ar-radio__label{font-size:.82rem}.ar-radio--disabled{opacity:.5;cursor:not-allowed}`;
