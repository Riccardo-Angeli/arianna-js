/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module BarChart
 * @example
 *   const chart = new BarChart('#root', { label: 'Monthly Sales' });
 *   chart.data = [{ label: 'Jan', value: 120 }, { label: 'Feb', value: 95 }];
 *   chart.on('click', ({ bar }) => console.log(bar));
 */
import { Control } from '../core/Control.ts';
export interface BarDataPoint { label: string; value: number; color?: string; }
export interface BarChartOptions { label?: string; height?: number; color?: string; showValues?: boolean; class?: string; }
export class BarChart extends Control<BarChartOptions> {
  private _data: BarDataPoint[] = [];
  constructor(container: string | HTMLElement | null = null, opts: BarChartOptions = {}) {
    super(container, 'div', { height: 220, color: 'var(--ar-primary)', showValues: true, ...opts });
    this.el.className = `ar-chart ar-barchart${opts.class?' '+opts.class:''}`;
  }
  set data(v: BarDataPoint[]) { this._data = v; this._set('data' as never, v as never); }
  get data()                  { return this._data; }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string; if (lbl) this._el('div', 'ar-chart__title', this.el).textContent = lbl;
    if (!this._data.length) { this._el('div', 'ar-chart__empty', this.el).textContent = 'No data'; return; }
    const h     = this._get('height', 220) as number;
    const color = this._get('color', 'var(--ar-primary)') as string;
    const sv    = this._get('showValues', true) as boolean;
    const max   = Math.max(...this._data.map(d => d.value));
    const W     = this._data.length * 60;
    const padB  = 24; const padT = 20;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${h}`); svg.style.width = '100%'; svg.style.height = h+'px'; svg.style.overflow = 'visible';
    this._data.forEach((d, i) => {
      const barH = max ? (d.value / max) * (h - padT - padB) : 0;
      const x = i * 60 + 8; const bW = 44; const y = h - padB - barH;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y)); rect.setAttribute('width', String(bW)); rect.setAttribute('height', String(barH));
      rect.setAttribute('fill', d.color ?? color); rect.setAttribute('rx', '3'); rect.style.cursor = 'pointer';
      rect.addEventListener('click', () => this._emit('click', { bar: d }));
      svg.appendChild(rect);
      const tLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tLbl.setAttribute('x', String(x + bW/2)); tLbl.setAttribute('y', String(h - 6)); tLbl.setAttribute('text-anchor', 'middle'); tLbl.setAttribute('fill', 'var(--ar-muted)'); tLbl.setAttribute('font-size', '10');
      tLbl.textContent = d.label; svg.appendChild(tLbl);
      if (sv && barH > 12) {
        const tVal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tVal.setAttribute('x', String(x + bW/2)); tVal.setAttribute('y', String(y - 4)); tVal.setAttribute('text-anchor', 'middle'); tVal.setAttribute('fill', 'var(--ar-text)'); tVal.setAttribute('font-size', '10');
        tVal.textContent = String(d.value); svg.appendChild(tVal);
      }
    });
    this.el.appendChild(svg);
  }
}
export const BarChartCSS = `.ar-chart{display:flex;flex-direction:column;gap:6px}.ar-chart__title{color:var(--ar-muted);font-size:.78rem;font-weight:500}.ar-chart__empty{color:var(--ar-dim);font-size:.8rem;padding:20px;text-align:center}`;
