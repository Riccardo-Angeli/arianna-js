/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module ProgressBar
 * @example
 *   const pb = new ProgressBar('#root', { label: 'Upload' });
 *   pb.value = 65;
 *   pb.indeterminate = true;
 */
import { Control } from '../core/Control.ts';
export interface ProgressBarOptions { label?: string; showValue?: boolean; variant?: 'default'|'success'|'warning'|'danger'; height?: number; class?: string; }
export class ProgressBar extends Control<ProgressBarOptions> {
  private _value         = 0;
  private _indeterminate = false;
  private _bar!: HTMLElement;
  constructor(container: string | HTMLElement | null = null, opts: ProgressBarOptions = {}) {
    super(container, 'div', { variant: 'default', height: 6, showValue: false, ...opts });
    this.el.className = `ar-progress${opts.class?' '+opts.class:''}`;
  }
  set value(v: number) {
    this._value = Math.max(0, Math.min(100, v)); this._indeterminate = false;
    if (this._bar) { this._bar.style.width = this._value+'%'; this._bar.classList.remove('ar-progress__bar--indeterminate'); }
    const lv = this.el.querySelector<HTMLElement>('.ar-progress__value'); if (lv) lv.textContent = this._value+'%';
  }
  get value()                   { return this._value; }
  set indeterminate(v: boolean) { this._indeterminate = v; this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string; const sv = this._get('showValue', false) as boolean;
    if (lbl || sv) { const row = this._el('div', 'ar-progress__header', this.el); if (lbl) this._el('span', 'ar-progress__label', row).textContent = lbl; if (sv) this._el('span', 'ar-progress__value', row).textContent = this._value+'%'; }
    const track = this._el('div', 'ar-progress__track', this.el); track.style.height = this._get('height', 6)+'px';
    this._bar = this._el('div', `ar-progress__bar ar-progress__bar--${this._get('variant','default') as string}${this._indeterminate?' ar-progress__bar--indeterminate':''}`, track);
    this._bar.style.width = this._indeterminate ? '40%' : this._value+'%';
    this._bar.setAttribute('role', 'progressbar'); this._bar.setAttribute('aria-valuenow', String(this._value));
  }
}
export const ProgressBarCSS = `.ar-progress{display:flex;flex-direction:column;gap:4px}.ar-progress__header{display:flex;justify-content:space-between;font-size:.78rem}.ar-progress__label{color:var(--ar-muted)}.ar-progress__value{font-weight:500}.ar-progress__track{background:var(--ar-bg4);border-radius:99px;overflow:hidden;width:100%}.ar-progress__bar{border-radius:99px;height:100%;transition:width .3s ease}.ar-progress__bar--default{background:var(--ar-primary)}.ar-progress__bar--success{background:var(--ar-success)}.ar-progress__bar--warning{background:var(--ar-warning)}.ar-progress__bar--danger{background:var(--ar-danger)}.ar-progress__bar--indeterminate{animation:ar-progress-slide 1.4s infinite ease-in-out;width:40%!important}@keyframes ar-progress-slide{0%{transform:translateX(-150%)}100%{transform:translateX(400%)}}`;
