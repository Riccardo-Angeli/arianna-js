/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Button
 * @example
 *   const btn = new Button('#root', { variant: 'primary' });
 *   btn.label   = 'Save';
 *   btn.loading = true;
 *   btn.on('click', () => save());
 */
import { Control } from '../core/Control.ts';
export interface ButtonOptions { variant?: 'default'|'primary'|'danger'|'ghost'|'link'; size?: 'sm'|'md'|'lg'; icon?: string; iconRight?: string; disabled?: boolean; class?: string; }
export class Button extends Control<ButtonOptions> {
  private _label   = '';
  private _loading = false;
  constructor(container: string | HTMLElement | null = null, opts: ButtonOptions = {}) {
    super(container, 'button', { variant: 'default', size: 'md', ...opts });
    (this.el as HTMLButtonElement).type = 'button';
    this.el.className = `ar-btn ar-btn--${opts.variant??'default'} ar-btn--${opts.size??'md'}${opts.class?' '+opts.class:''}`;
    this.el.addEventListener('click', e => { if (!(this.el as HTMLButtonElement).disabled && !this._loading) this._emit('click', {}, e as Event); });
  }
  set label(v: string)     { this._label = v; this._build(); }
  get label()              { return this._label; }
  set loading(v: boolean)  { this._loading = v; (this.el as HTMLButtonElement).disabled = v; this._build(); }
  set disabled(v: boolean) { (this.el as HTMLButtonElement).disabled = v; }
  get disabled()           { return (this.el as HTMLButtonElement).disabled; }
  protected _build() {
    this.el.innerHTML = '';
    if (this._loading) { this._el('span', 'ar-btn__spinner', this.el).textContent = '⟳'; }
    else { const icon = this._get('icon', '') as string; if (icon) this._el('span', 'ar-btn__icon', this.el).textContent = icon; }
    if (this._label) this._el('span', '', this.el).textContent = this._label;
    if (!this._loading) { const ir = this._get('iconRight', '') as string; if (ir) this._el('span', 'ar-btn__icon', this.el).textContent = ir; }
  }
}
export const ButtonCSS = `.ar-btn{align-items:center;border-radius:var(--ar-radius);cursor:pointer;display:inline-flex;font:inherit;gap:6px;justify-content:center;transition:all var(--ar-transition);user-select:none;white-space:nowrap}.ar-btn--default{background:var(--ar-bg3);border:1px solid var(--ar-border);color:var(--ar-text)}.ar-btn--default:hover:not(:disabled){background:var(--ar-bg4);border-color:var(--ar-border2)}.ar-btn--primary{background:var(--ar-primary);border:1px solid var(--ar-primary);color:var(--ar-primary-text)}.ar-btn--primary:hover:not(:disabled){filter:brightness(1.1)}.ar-btn--danger{background:var(--ar-danger);border:1px solid var(--ar-danger);color:#fff}.ar-btn--danger:hover:not(:disabled){filter:brightness(1.1)}.ar-btn--ghost{background:transparent;border:1px solid transparent;color:var(--ar-text)}.ar-btn--ghost:hover:not(:disabled){background:var(--ar-bg3)}.ar-btn--link{background:transparent;border:none;color:var(--ar-primary);padding-left:0;padding-right:0}.ar-btn--sm{font-size:.75rem;padding:3px 10px}.ar-btn--md{font-size:.82rem;padding:5px 14px}.ar-btn--lg{font-size:.9rem;padding:8px 20px}.ar-btn:disabled{cursor:not-allowed;opacity:.45}.ar-btn__spinner{animation:ar-spin .7s linear infinite;display:inline-block}@keyframes ar-spin{to{transform:rotate(360deg)}}`;
