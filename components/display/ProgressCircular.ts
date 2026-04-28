/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module ProgressCircular
 * @example
 *   const pc = new ProgressCircular('#root', { size: 60 });
 *   pc.value = 72;
 */
import { Control } from '../core/Control.ts';
export interface ProgressCircularOptions { size?: number; strokeWidth?: number; showValue?: boolean; variant?: 'default'|'success'|'warning'|'danger'; class?: string; }
export class ProgressCircular extends Control<ProgressCircularOptions> {
  private _value         = 0;
  private _indeterminate = false;
  constructor(container: string | HTMLElement | null = null, opts: ProgressCircularOptions = {}) {
    super(container, 'div', { size: 48, strokeWidth: 4, showValue: false, variant: 'default', ...opts });
    this.el.className = `ar-progress-circ${opts.class?' '+opts.class:''}`;
  }
  set value(v: number)          { this._value = Math.max(0, Math.min(100, v)); this._indeterminate = false; this._build(); }
  get value()                   { return this._value; }
  set indeterminate(v: boolean) { this._indeterminate = v; this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    const size = this._get('size', 48) as number;
    const sw   = this._get('strokeWidth', 4) as number;
    const r    = (size - sw) / 2;
    const circ = 2 * Math.PI * r;
    const dash  = this._indeterminate ? circ * 0.75 : circ * this._value / 100;
    const variantColors: Record<string,string> = { default: 'var(--ar-primary)', success: 'var(--ar-success)', warning: 'var(--ar-warning)', danger: 'var(--ar-danger)' };
    const color = variantColors[this._get('variant', 'default') as string] ?? 'var(--ar-primary)';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.style.width = size+'px'; svg.style.height = size+'px';
    if (this._indeterminate) svg.classList.add('ar-progress-circ__spin');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', String(size/2)); bg.setAttribute('cy', String(size/2)); bg.setAttribute('r', String(r));
    bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'var(--ar-bg4)'); bg.setAttribute('stroke-width', String(sw));
    svg.appendChild(bg);
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arc.setAttribute('cx', String(size/2)); arc.setAttribute('cy', String(size/2)); arc.setAttribute('r', String(r));
    arc.setAttribute('fill', 'none'); arc.setAttribute('stroke', color); arc.setAttribute('stroke-width', String(sw));
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', `${dash} ${circ - dash}`);
    arc.setAttribute('stroke-dashoffset', String(circ * 0.25));
    arc.style.transition = 'stroke-dasharray .3s ease';
    svg.appendChild(arc);
    this.el.appendChild(svg);
    if (this._get('showValue', false) && !this._indeterminate) {
      const lbl = this._el('div', 'ar-progress-circ__label', this.el);
      lbl.textContent = this._value+'%'; lbl.style.fontSize = Math.round(size*0.22)+'px';
    }
  }
}
export const ProgressCircularCSS = `.ar-progress-circ{display:inline-flex;flex-direction:column;align-items:center;gap:4px;position:relative}.ar-progress-circ__label{color:var(--ar-text);font-weight:600;font-variant-numeric:tabular-nums}.ar-progress-circ__spin{animation:ar-circ-spin 1s linear infinite}@keyframes ar-circ-spin{to{transform:rotate(360deg)}}`;
