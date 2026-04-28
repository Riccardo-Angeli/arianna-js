/**
 * @module    Card
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Content card with optional header, body, footer, media.
 *
 * @example
 *   const card = new Card('#root', { elevation: 2 });
 *   card.title   = 'Card Title';
 *   card.content = '<p>Body text</p>';
 *   card.footer  = '<button>Action</button>';
 */
import { Control } from '../core/Control.ts';

export interface CardOptions { elevation?: 0|1|2|3; variant?: 'outlined'|'filled'|'ghost'; class?: string; }

export class Card extends Control<CardOptions> {
  private _title    = '';
  private _subtitle = '';
  private _media: string|HTMLElement = '';
  private _content: string|HTMLElement = '';
  private _footer: string|HTMLElement  = '';

  constructor(container: string | HTMLElement | null = null, opts: CardOptions = {}) {
    super(container, 'div', { elevation: 1, variant: 'outlined', ...opts });
    this.el.className = `ar-card ar-card--${opts.variant??'outlined'} ar-card--e${opts.elevation??1}${opts.class?' '+opts.class:''}`;
  }

  set title(v: string)               { this._title = v;    this._set('title' as never, v as never); }
  set subtitle(v: string)            { this._subtitle = v; this._set('subtitle' as never, v as never); }
  set media(v: string|HTMLElement)   { this._media = v;    this._set('media' as never, v as never); }
  set content(v: string|HTMLElement) { this._content = v;  this._set('content' as never, v as never); }
  set footer(v: string|HTMLElement)  { this._footer = v;   this._set('footer' as never, v as never); }

  protected _build() {
    this.el.innerHTML = '';
    if (this._media) {
      const m = this._el('div', 'ar-card__media', this.el);
      if (typeof this._media === 'string') m.innerHTML = this._media; else m.appendChild(this._media);
    }
    if (this._title || this._subtitle) {
      const h = this._el('div', 'ar-card__header', this.el);
      if (this._title)    { const t = this._el('div', 'ar-card__title',    h); t.textContent = this._title; }
      if (this._subtitle) { const s = this._el('div', 'ar-card__subtitle', h); s.textContent = this._subtitle; }
    }
    if (this._content) {
      const b = this._el('div', 'ar-card__body', this.el);
      if (typeof this._content === 'string') b.innerHTML = this._content; else b.appendChild(this._content);
    }
    if (this._footer) {
      const f = this._el('div', 'ar-card__footer', this.el);
      if (typeof this._footer === 'string') f.innerHTML = this._footer; else f.appendChild(this._footer);
    }
  }
}

export const CardCSS = `
.ar-card{background:var(--ar-bg2);border-radius:var(--ar-radius-lg);overflow:hidden;display:flex;flex-direction:column}
.ar-card--outlined{border:1px solid var(--ar-border)}
.ar-card--filled{background:var(--ar-bg3)}
.ar-card--ghost{background:transparent}
.ar-card--e0{}
.ar-card--e1{box-shadow:0 1px 4px rgba(0,0,0,.2)}
.ar-card--e2{box-shadow:0 4px 16px rgba(0,0,0,.3)}
.ar-card--e3{box-shadow:0 8px 32px rgba(0,0,0,.4)}
.ar-card__media img{width:100%;display:block}
.ar-card__header{padding:14px 16px 4px}
.ar-card__title{font-weight:600;font-size:.95rem}
.ar-card__subtitle{color:var(--ar-muted);font-size:.78rem;margin-top:2px}
.ar-card__body{padding:12px 16px;flex:1}
.ar-card__footer{padding:10px 16px;border-top:1px solid var(--ar-border);display:flex;gap:8px;align-items:center}
`;
