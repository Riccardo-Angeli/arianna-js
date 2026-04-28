/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Tooltip
 * @example
 *   // Attach to existing element:
 *   Tooltip.attach(myButton, 'Save document');
 *   // Or as wrapper component:
 *   const tt = new Tooltip('#root', { text: 'Help', position: 'top' });
 */
import { Control } from '../core/Control.ts';
export interface TooltipOptions { text?: string; position?: 'top'|'bottom'|'left'|'right'; delay?: number; class?: string; }
export class Tooltip extends Control<TooltipOptions> {
  private _tip!: HTMLElement;
  private _timer = 0;
  constructor(container: string | HTMLElement | null = null, opts: TooltipOptions = {}) {
    super(container, 'div', { position: 'top', delay: 180, ...opts });
    this.el.className = `ar-tooltip-host${opts.class?' '+opts.class:''}`;
    this._tip = this._el('div', `ar-tooltip ar-tooltip--${opts.position??'top'}`, document.body);
    if (opts.text) this._tip.textContent = opts.text;
    this._on(this.el, 'mouseenter', () => { clearTimeout(this._timer); this._timer = window.setTimeout(() => { this._place(); this._tip.classList.add('ar-tooltip--on'); }, this._get('delay', 180) as number); });
    this._on(this.el, 'mouseleave', () => { clearTimeout(this._timer); this._tip.classList.remove('ar-tooltip--on'); });
    this._gc(() => this._tip.remove());
  }
  set text(v: string) { this._tip.textContent = v; }
  get text()          { return this._tip.textContent ?? ''; }
  private _place() {
    const r   = this.el.getBoundingClientRect();
    const pos = this._get('position', 'top') as string;
    const tw  = this._tip.offsetWidth  || 120;
    const th  = this._tip.offsetHeight || 28;
    this._tip.style.left = r.left + r.width/2 - tw/2 + 'px';
    this._tip.style.top  = pos === 'bottom' ? r.bottom + 6 + 'px' : r.top - th - 6 + 'px';
    if (pos === 'left')  { this._tip.style.left = r.left - tw - 6 + 'px'; this._tip.style.top = r.top + r.height/2 - th/2 + 'px'; }
    if (pos === 'right') { this._tip.style.left = r.right + 6 + 'px';     this._tip.style.top = r.top + r.height/2 - th/2 + 'px'; }
  }
  protected _build() { if (this._tip) this._tip.textContent = this._get('text', '') as string; }
  static attach(el: HTMLElement, text: string, opts: Omit<TooltipOptions,'text'> = {}): Tooltip {
    const host = document.createElement('div'); host.style.display = 'contents';
    el.parentElement?.insertBefore(host, el); host.appendChild(el);
    return new Tooltip(host, { text, ...opts });
  }
}
export const TooltipCSS = `.ar-tooltip-host{display:contents}.ar-tooltip{background:var(--ar-bg4);border:1px solid var(--ar-border);border-radius:var(--ar-radius-sm);box-shadow:var(--ar-shadow);color:var(--ar-text);font-size:.74rem;max-width:220px;opacity:0;padding:4px 8px;pointer-events:none;position:fixed;transition:opacity .14s;white-space:pre-wrap;z-index:9000}.ar-tooltip--on{opacity:1}`;
