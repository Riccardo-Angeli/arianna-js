/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module TextField
 * @example
 *   const tf = new TextField('#root', { label: 'Email', type: 'email' });
 *   tf.value = 'me@example.com';
 *   tf.error = 'Invalid email';
 *   tf.on('change', ({ value }) => console.log(value));
 */
import { Control } from '../core/Control.ts';
export interface TextFieldOptions { label?: string; placeholder?: string; type?: string; hint?: string; prefix?: string; suffix?: string; maxlength?: number; readonly?: boolean; disabled?: boolean; class?: string; }
export class TextField extends Control<TextFieldOptions> {
  private _value = '';
  private _error = '';
  private _input!: HTMLInputElement;
  constructor(container: string | HTMLElement | null = null, opts: TextFieldOptions = {}) {
    super(container, 'div', { type: 'text', ...opts });
    this.el.className = `ar-textfield${opts.class?' '+opts.class:''}`;
  }
  set value(v: string)    { this._value = v; if (this._input) this._input.value = v; }
  get value()             { return this._input?.value ?? this._value; }
  set error(v: string)    { this._error = v; this.el.classList.toggle('ar-textfield--error', !!v); const e = this.el.querySelector<HTMLElement>('.ar-textfield__error'); if (e) e.textContent = v; else this._build(); }
  set disabled(v: boolean){ if (this._input) this._input.disabled = v; }
  focus()                 { this._input?.focus(); }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string;
    if (lbl) this._el('label', 'ar-textfield__label', this.el).textContent = lbl;
    const wrap = this._el('div', 'ar-textfield__wrap', this.el);
    const pfx = this._get('prefix', '') as string; if (pfx) this._el('span', 'ar-textfield__prefix', wrap).textContent = pfx;
    this._input = document.createElement('input');
    this._input.className   = 'ar-textfield__input';
    this._input.type        = this._get('type', 'text') as string;
    this._input.placeholder = this._get('placeholder', '') as string;
    this._input.value       = this._value;
    this._input.readOnly    = this._get('readonly', false) as boolean;
    this._input.disabled    = this._get('disabled', false) as boolean;
    const ml = this._get('maxlength', 0) as number; if (ml) this._input.maxLength = ml;
    this._input.addEventListener('input',  () => { this._value = this._input.value; this._emit('input',  { value: this._value }); });
    this._input.addEventListener('change', () => this._emit('change', { value: this._input.value }));
    wrap.appendChild(this._input);
    const sfx = this._get('suffix', '') as string; if (sfx) this._el('span', 'ar-textfield__suffix', wrap).textContent = sfx;
    const hint = this._get('hint', '') as string; if (hint) this._el('div', 'ar-textfield__hint', this.el).textContent = hint;
    if (this._error) this._el('div', 'ar-textfield__error', this.el).textContent = this._error;
  }
}
export const TextFieldCSS = `.ar-textfield{display:flex;flex-direction:column;gap:4px}.ar-textfield__label{color:var(--ar-muted);font-size:.78rem;font-weight:500}.ar-textfield__wrap{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);display:flex;transition:border-color var(--ar-transition)}.ar-textfield__wrap:focus-within{border-color:var(--ar-primary)}.ar-textfield--error .ar-textfield__wrap{border-color:var(--ar-danger)}.ar-textfield__input{background:none;border:none;color:var(--ar-text);flex:1;font:inherit;font-size:.82rem;outline:none;padding:6px 10px}.ar-textfield__prefix,.ar-textfield__suffix{color:var(--ar-muted);font-size:.82rem;padding:0 8px;flex-shrink:0}.ar-textfield__hint{color:var(--ar-muted);font-size:.74rem}.ar-textfield__error{color:var(--ar-danger);font-size:.74rem}`;
