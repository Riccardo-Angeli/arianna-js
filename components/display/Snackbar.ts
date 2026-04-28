/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Snackbar
 * @example
 *   // Static shorthand:
 *   Snackbar.show('Saved!', { variant: 'success' });
 *   // Instance:
 *   const sb = new Snackbar({ message: 'Error', variant: 'danger' });
 *   sb.show();
 */
import { Control } from '../core/Control.ts';
export type SnackPos = 'top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right';
export interface SnackbarOptions { message?: string; variant?: 'default'|'success'|'warning'|'danger'|'info'; duration?: number; position?: SnackPos; action?: string; class?: string; }
function getContainer(pos: string): HTMLElement {
  const id = 'ar-snack-' + pos; let el = document.getElementById(id);
  if (!el) { el = document.createElement('div'); el.id = id; el.className = 'ar-snackbar-container ar-snackbar-container--'+pos; document.body.appendChild(el); }
  return el;
}
export class Snackbar extends Control<SnackbarOptions> {
  private _timer = 0;
  constructor(opts: SnackbarOptions = {}) {
    super(getContainer(opts.position ?? 'bottom-center'), 'div', { duration: 4000, variant: 'default', position: 'bottom-center', ...opts });
    this.el.className = `ar-snackbar ar-snackbar--${opts.variant??'default'}${opts.class?' '+opts.class:''}`;
    this.el.style.display = 'none';
  }
  set message(v: string) { this._set('message' as never, v as never); }
  show() {
    this.el.style.display = '';
    setTimeout(() => this.el.classList.add('ar-snackbar--on'), 10);
    const dur = this._get('duration', 4000) as number;
    if (dur > 0) this._timer = window.setTimeout(() => this.hide(), dur);
    this._emit('show', {});
  }
  hide() { clearTimeout(this._timer); this.el.classList.remove('ar-snackbar--on'); setTimeout(() => { this.el.style.display = 'none'; this._emit('hide', {}); }, 280); }
  protected _build() {
    this.el.innerHTML = '';
    const msg = this._el('span', 'ar-snackbar__msg', this.el); msg.textContent = this._get('message', '') as string;
    const action = this._get('action', '') as string;
    if (action) { const btn = this._el('button', 'ar-snackbar__action', this.el) as HTMLButtonElement; btn.textContent = action; btn.addEventListener('click', () => { this._emit('action', {}); this.hide(); }); }
    const x = this._el('button', 'ar-snackbar__close', this.el) as HTMLButtonElement; x.textContent = '✕'; x.addEventListener('click', () => this.hide());
  }
  static show(message: string, opts: Omit<SnackbarOptions,'message'> = {}): Snackbar {
    const sb = new Snackbar({ message, ...opts }); sb.show(); return sb;
  }
}
export const SnackbarCSS = `.ar-snackbar-container{display:flex;flex-direction:column;gap:8px;pointer-events:none;position:fixed;z-index:5000;padding:12px;max-width:400px}.ar-snackbar-container--top-left{top:0;left:0}.ar-snackbar-container--top-center{top:0;left:50%;transform:translateX(-50%)}.ar-snackbar-container--top-right{top:0;right:0}.ar-snackbar-container--bottom-left{bottom:0;left:0}.ar-snackbar-container--bottom-center{bottom:0;left:50%;transform:translateX(-50%)}.ar-snackbar-container--bottom-right{bottom:0;right:0}.ar-snackbar{align-items:center;border-radius:var(--ar-radius);box-shadow:var(--ar-shadow-lg);display:flex;gap:10px;opacity:0;padding:10px 14px;pointer-events:all;transform:translateY(6px);transition:opacity .25s,transform .25s;min-width:220px}.ar-snackbar--on{opacity:1;transform:none}.ar-snackbar--default{background:var(--ar-bg4);border:1px solid var(--ar-border)}.ar-snackbar--success{background:var(--ar-success);color:#fff}.ar-snackbar--warning{background:var(--ar-warning);color:#000}.ar-snackbar--danger{background:var(--ar-danger);color:#fff}.ar-snackbar--info{background:var(--ar-info);color:#000}.ar-snackbar__msg{flex:1;font-size:.82rem}.ar-snackbar__action{background:none;border:none;color:inherit;cursor:pointer;font:inherit;font-size:.78rem;font-weight:600;text-decoration:underline}.ar-snackbar__close{background:none;border:none;color:inherit;cursor:pointer;font-size:.8rem;opacity:.7;padding:0}`;
