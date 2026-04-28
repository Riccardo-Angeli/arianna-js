/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
export interface PaginationOptions { total?: number; pageSize?: number; page?: number; siblings?: number; class?: string; }
export class Pagination extends Control<PaginationOptions> {
  private _page = 1;
  constructor(container: string | HTMLElement | null = null, opts: PaginationOptions = {}) {
    super(container, 'nav', { total: 0, pageSize: 10, page: 1, siblings: 1, ...opts });
    this._page = opts.page ?? 1;
    this.el.className = `ar-pagination${opts.class?' '+opts.class:''}`;
    this.el.setAttribute('aria-label', 'Pagination');
  }
  set total(v: number)    { this._set('total' as never, v as never); }
  set pageSize(v: number) { this._set('pageSize' as never, v as never); }
  set page(v: number)     { this._page = v; this._build(); }
  get page()              { return this._page; }
  get totalPages()        { return Math.ceil((this._get('total', 0) as number) / (this._get('pageSize', 10) as number)); }
  private _go(p: number) {
    const tp = this.totalPages;
    if (p < 1 || p > tp) return;
    this._page = p; this._build();
    this._emit('change', { page: p, totalPages: tp });
  }
  private _btn(label: string, page: number, disabled: boolean, active = false): HTMLButtonElement {
    const b = this._el('button', `ar-pagination__btn${active?' ar-pagination__btn--active':''}`, this.el) as HTMLButtonElement;
    b.textContent = label; b.disabled = disabled;
    b.addEventListener('click', () => this._go(page));
    return b;
  }
  protected _build() {
    this.el.innerHTML = '';
    const tp  = this.totalPages; if (tp <= 1) return;
    const sib = this._get('siblings', 1) as number;
    this._btn('‹', this._page - 1, this._page <= 1);
    const start = Math.max(1, this._page - sib);
    const end   = Math.min(tp, this._page + sib);
    if (start > 1) { this._btn('1', 1, false); if (start > 2) { const d = this._el('span', 'ar-pagination__dots', this.el); d.textContent = '…'; } }
    for (let p = start; p <= end; p++) this._btn(String(p), p, false, p === this._page);
    if (end < tp) { if (end < tp - 1) { const d = this._el('span', 'ar-pagination__dots', this.el); d.textContent = '…'; } this._btn(String(tp), tp, false); }
    this._btn('›', this._page + 1, this._page >= tp);
  }
}
export const PaginationCSS = `.ar-pagination{display:flex;align-items:center;gap:4px}.ar-pagination__btn{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);color:var(--ar-text);cursor:pointer;font:inherit;font-size:.82rem;min-width:32px;padding:4px 8px;transition:border-color var(--ar-transition)}.ar-pagination__btn:hover:not(:disabled){border-color:var(--ar-primary)}.ar-pagination__btn--active{background:var(--ar-primary);border-color:var(--ar-primary);color:var(--ar-primary-text)}.ar-pagination__btn:disabled{opacity:.4;cursor:not-allowed}.ar-pagination__dots{color:var(--ar-muted);padding:0 4px}`;
