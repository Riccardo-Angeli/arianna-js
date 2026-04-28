/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Badge
 * @example
 *   const b = new Badge('#root', { variant: 'success' });
 *   b.label = 'Active';
 */
import { Control } from '../core/Control.ts';
export interface BadgeOptions { variant?: 'default'|'primary'|'success'|'warning'|'danger'|'info'; dot?: boolean; class?: string; }
export class Badge extends Control<BadgeOptions> {
  private _label = '';
  constructor(container: string | HTMLElement | null = null, opts: BadgeOptions = {}) {
    super(container, 'span', opts);
    this.el.className = `ar-badge ar-badge--${opts.variant??'default'}${opts.dot?' ar-badge--dot':''}${opts.class?' '+opts.class:''}`;
  }
  set label(v: string) { this._label = v; this._build(); }
  get label()          { return this._label; }
  protected _build() { if (!this._get('dot', false)) this.el.textContent = this._label; }
}
export const BadgeCSS = `.ar-badge{border-radius:10px;display:inline-flex;align-items:center;font-size:.72rem;font-weight:600;padding:2px 8px;white-space:nowrap}.ar-badge--default{background:var(--ar-bg4);color:var(--ar-text)}.ar-badge--primary{background:var(--ar-primary);color:var(--ar-primary-text)}.ar-badge--success{background:var(--ar-success);color:#fff}.ar-badge--warning{background:var(--ar-warning);color:#000}.ar-badge--danger{background:var(--ar-danger);color:#fff}.ar-badge--info{background:var(--ar-info);color:#000}.ar-badge--dot{border-radius:50%;height:8px;min-width:8px;padding:0;width:8px}`;
