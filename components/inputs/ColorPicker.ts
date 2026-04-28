/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module ColorPicker
 * Native color input with hex display.
 * @example
 *   const cp = new ColorPicker('#root', { label: 'Accent color' });
 *   cp.value = '#7eb8f7';
 *   cp.on('change', ({ value }) => applyColor(value));
 */
import { Control } from '../core/Control.ts';
export interface ColorPickerOptions { label?: string; presets?: string[]; disabled?: boolean; class?: string; }
export class ColorPicker extends Control<ColorPickerOptions> {
  private _value = '#000000';
  private _input!: HTMLInputElement;
  constructor(container: string | HTMLElement | null = null, opts: ColorPickerOptions = {}) {
    super(container, 'div', opts);
    this.el.className = `ar-colorpicker${opts.class?' '+opts.class:''}`;
  }
  set value(v: string) { this._value = v; if (this._input) this._input.value = v; this._updatePreview(); }
  get value()          { return this._input?.value ?? this._value; }
  private _updatePreview() { const sw = this.el.querySelector<HTMLElement>('.ar-colorpicker__swatch'); if (sw) sw.style.background = this.value; const hex = this.el.querySelector<HTMLElement>('.ar-colorpicker__hex'); if (hex) hex.textContent = this.value.toUpperCase(); }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string; if (lbl) this._el('div', 'ar-colorpicker__label', this.el).textContent = lbl;
    const row = this._el('div', 'ar-colorpicker__row', this.el);
    const swatch = this._el('div', 'ar-colorpicker__swatch', row); swatch.style.background = this._value;
    this._input = document.createElement('input'); this._input.type = 'color'; this._input.className = 'ar-colorpicker__input';
    this._input.value = this._value; this._input.disabled = this._get('disabled', false) as boolean;
    this._input.addEventListener('input', () => { this._value = this._input.value; this._updatePreview(); this._emit('input', { value: this._value }); });
    this._input.addEventListener('change', () => this._emit('change', { value: this._input.value }));
    swatch.appendChild(this._input);
    this._el('span', 'ar-colorpicker__hex', row).textContent = this._value.toUpperCase();
    const presets = this._get('presets', []) as string[];
    if (presets.length) {
      const wrap = this._el('div', 'ar-colorpicker__presets', this.el);
      presets.forEach(c => { const p = this._el('button', 'ar-colorpicker__preset', wrap) as HTMLButtonElement; p.style.background = c; p.title = c; p.addEventListener('click', () => { this._value = c; if (this._input) this._input.value = c; this._updatePreview(); this._emit('change', { value: c }); }); });
    }
  }
}
export const ColorPickerCSS = `.ar-colorpicker{display:flex;flex-direction:column;gap:6px}.ar-colorpicker__label{color:var(--ar-muted);font-size:.78rem;font-weight:500}.ar-colorpicker__row{align-items:center;display:flex;gap:10px}.ar-colorpicker__swatch{border:2px solid var(--ar-border);border-radius:var(--ar-radius);cursor:pointer;height:32px;overflow:hidden;position:relative;width:44px}.ar-colorpicker__input{cursor:pointer;height:150%;left:-25%;opacity:0;position:absolute;top:-25%;width:150%}.ar-colorpicker__hex{font-size:.82rem;font-variant-numeric:tabular-nums;color:var(--ar-muted)}.ar-colorpicker__presets{display:flex;flex-wrap:wrap;gap:4px}.ar-colorpicker__preset{border:2px solid transparent;border-radius:50%;cursor:pointer;height:20px;width:20px;transition:border-color var(--ar-transition)}.ar-colorpicker__preset:hover{border-color:var(--ar-text)}`;
