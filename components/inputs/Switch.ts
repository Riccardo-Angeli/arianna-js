/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Switch
 * @example
 *   const sw = new Switch('#root', { label: 'Dark mode' });
 *   sw.checked = true;
 *   sw.on('change', ({ checked }) => applyTheme(checked));
 */
import { Control } from '../core/Control.ts';
export interface SwitchOptions { label?: string; labelPosition?: 'left'|'right'; disabled?: boolean; class?: string; }
export class Switch extends Control<SwitchOptions> {
  private _checked = false;
  private _input!: HTMLInputElement;
  constructor(container: string | HTMLElement | null = null, opts: SwitchOptions = {}) {
    super(container, 'label', opts);
    this.el.className = `ar-switch${opts.labelPosition==='left'?' ar-switch--label-left':''}${opts.class?' '+opts.class:''}`;
  }
  set checked(v: boolean)  { this._checked = v; if (this._input) this._input.checked = v; }
  get checked()            { return this._input?.checked ?? this._checked; }
  set disabled(v: boolean) { if (this._input) this._input.disabled = v; }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string;
    const pos = this._get('labelPosition', 'right') as string;
    if (lbl && pos === 'left') this._el('span', 'ar-switch__label', this.el).textContent = lbl;
    this._input = document.createElement('input');
    this._input.type = 'checkbox'; this._input.className = 'ar-switch__input';
    this._input.checked  = this._checked;
    this._input.disabled = this._get('disabled', false) as boolean;
    this._input.addEventListener('change', () => { this._checked = this._input.checked; this._emit('change', { checked: this._checked }); });
    this.el.appendChild(this._input);
    this._el('span', 'ar-switch__track', this.el);
    if (lbl && pos !== 'left') this._el('span', 'ar-switch__label', this.el).textContent = lbl;
  }
}
export const SwitchCSS = `.ar-switch{align-items:center;cursor:pointer;display:inline-flex;gap:8px;user-select:none}.ar-switch--label-left{flex-direction:row-reverse}.ar-switch__input{height:0;opacity:0;position:absolute;width:0}.ar-switch__track{background:var(--ar-bg4);border-radius:12px;flex-shrink:0;height:22px;position:relative;transition:background var(--ar-transition);width:40px}.ar-switch__track::after{background:#fff;border-radius:50%;content:'';height:16px;left:3px;position:absolute;top:3px;transition:transform var(--ar-transition);width:16px}.ar-switch__input:checked+.ar-switch__track{background:var(--ar-primary)}.ar-switch__input:checked+.ar-switch__track::after{transform:translateX(18px)}.ar-switch__label{font-size:.82rem}`;
