/**
 * @module    Chip (display)
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Display chip — read-only label chip with optional avatar, icon, delete button.
 * For selectable/filter chips, use inputs/Chip.ts.
 *
 * @example
 *   const chip = new Chip('#root', { variant: 'primary' });
 *   chip.label  = 'AriannA';
 *   chip.avatar = 'RA';
 *   chip.on('delete', ({ label }) => removeTag(label));
 */
import { Control } from '../core/Control.ts';

export interface DisplayChipOptions {
  variant?    : 'default'|'primary'|'success'|'warning'|'danger'|'info';
  deletable?  : boolean;
  size?       : 'sm'|'md'|'lg';
  class?      : string;
}

export class Chip extends Control<DisplayChipOptions> {
  private _label  = '';
  private _icon   = '';
  private _avatar = '';

  constructor(container: string | HTMLElement | null = null, opts: DisplayChipOptions = {}) {
    super(container, 'div', { variant: 'default', size: 'md', deletable: false, ...opts });
    this.el.className = `ar-dchip ar-dchip--${opts.variant??'default'} ar-dchip--${opts.size??'md'}${opts.class?' '+opts.class:''}`;
  }

  set label(v: string)  { this._label  = v; this._build(); }
  set icon(v: string)   { this._icon   = v; this._build(); }
  set avatar(v: string) { this._avatar = v; this._build(); }
  get label()           { return this._label; }

  protected _build() {
    this.el.innerHTML = '';
    if (this._avatar) {
      const av = this._el('span', 'ar-dchip__avatar', this.el);
      av.textContent = this._avatar.slice(0, 2).toUpperCase();
    } else if (this._icon) {
      this._el('span', 'ar-dchip__icon', this.el).textContent = this._icon;
    }
    this._el('span', 'ar-dchip__label', this.el).textContent = this._label;
    if (this._get('deletable', false)) {
      const x = this._el('button', 'ar-dchip__delete', this.el) as HTMLButtonElement;
      x.textContent = '✕'; x.setAttribute('aria-label', 'Remove');
      x.addEventListener('click', e => { e.stopPropagation(); this._emit('delete', { label: this._label }, e as Event); });
    }
  }
}

export const ChipCSS = `
.ar-dchip{align-items:center;border-radius:16px;display:inline-flex;gap:5px;font-weight:500;white-space:nowrap}
.ar-dchip--default{background:var(--ar-bg4);border:1px solid var(--ar-border);color:var(--ar-text)}
.ar-dchip--primary{background:rgba(126,184,247,.15);border:1px solid var(--ar-primary);color:var(--ar-primary)}
.ar-dchip--success{background:rgba(76,175,80,.15);border:1px solid var(--ar-success);color:var(--ar-success)}
.ar-dchip--warning{background:rgba(255,152,0,.15);border:1px solid var(--ar-warning);color:var(--ar-warning)}
.ar-dchip--danger{background:rgba(244,67,54,.15);border:1px solid var(--ar-danger);color:var(--ar-danger)}
.ar-dchip--info{background:rgba(77,208,225,.15);border:1px solid var(--ar-info);color:var(--ar-info)}
.ar-dchip--sm{font-size:.72rem;padding:2px 8px}
.ar-dchip--md{font-size:.78rem;padding:3px 10px}
.ar-dchip--lg{font-size:.85rem;padding:5px 14px}
.ar-dchip__avatar{align-items:center;background:currentColor;border-radius:50%;color:var(--ar-bg);display:flex;flex-shrink:0;font-size:.65rem;font-weight:700;height:18px;justify-content:center;width:18px}
.ar-dchip__icon{flex-shrink:0}
.ar-dchip__delete{background:none;border:none;color:currentColor;cursor:pointer;font-size:.7rem;line-height:1;opacity:.7;padding:0}
.ar-dchip__delete:hover{opacity:1}
`;
