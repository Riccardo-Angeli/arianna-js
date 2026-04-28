/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
export interface DrawerOptions { side?: 'left'|'right'|'top'|'bottom'; width?: number; height?: number; closeOnBackdrop?: boolean; class?: string; }
export class Drawer extends Control<DrawerOptions> {
  private _content: string|HTMLElement = '';
  private _panel!: HTMLElement;
  constructor(opts: DrawerOptions = {}) {
    super(null, 'div', { side: 'left', width: 280, closeOnBackdrop: true, ...opts });
    document.body.appendChild(this.el);
    this.el.className = `ar-drawer ar-drawer--${opts.side??'left'}${opts.class?' '+opts.class:''}`;
    this.el.style.display = 'none';
    const backdrop = this._el('div', 'ar-drawer__backdrop', this.el);
    this._panel = this._el('div', 'ar-drawer__panel', this.el);
    const side = opts.side ?? 'left';
    if (side === 'left' || side === 'right') this._panel.style.width  = (opts.width  ?? 280) + 'px';
    else                                      this._panel.style.height = (opts.height ?? 240) + 'px';
    backdrop.addEventListener('click', () => { if (this._get('closeOnBackdrop', true)) this.close(); });
  }
  set content(v: string|HTMLElement) { this._content = v; this._build(); }
  open()  { this.el.style.display = ''; setTimeout(() => this.el.classList.add('ar-drawer--open'), 10); this._emit('open', {}); }
  close() { this.el.classList.remove('ar-drawer--open'); setTimeout(() => { this.el.style.display = 'none'; this._emit('close', {}); }, 250); }
  protected _build() {
    this._panel.innerHTML = '';
    if (typeof this._content === 'string') this._panel.innerHTML = this._content;
    else if (this._content) this._panel.appendChild(this._content);
  }
}
export const DrawerCSS = `.ar-drawer{position:fixed;inset:0;z-index:900}.ar-drawer__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5);opacity:0;transition:opacity .25s}.ar-drawer--open .ar-drawer__backdrop{opacity:1}.ar-drawer__panel{position:absolute;background:var(--ar-bg2);border:1px solid var(--ar-border);box-shadow:var(--ar-shadow-lg);overflow-y:auto;transition:transform .25s ease}.ar-drawer--left .ar-drawer__panel{left:0;top:0;bottom:0;transform:translateX(-100%)}.ar-drawer--right .ar-drawer__panel{right:0;top:0;bottom:0;transform:translateX(100%)}.ar-drawer--top .ar-drawer__panel{top:0;left:0;right:0;transform:translateY(-100%)}.ar-drawer--bottom .ar-drawer__panel{bottom:0;left:0;right:0;transform:translateY(100%)}.ar-drawer--open .ar-drawer__panel{transform:none}`;
