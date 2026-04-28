/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module PieChart
 * @example
 *   const chart = new PieChart('#root', { donut: true });
 *   chart.data = [
 *     { label: 'EU', value: 42 },
 *     { label: 'US', value: 35 },
 *     { label: 'APAC', value: 23 },
 *   ];
 *   chart.on('click', ({ slice }) => console.log(slice));
 */
import { Control } from '../core/Control.ts';
export interface PieDataPoint { label: string; value: number; color?: string; }
export interface PieChartOptions { label?: string; size?: number; donut?: boolean; legend?: boolean; class?: string; }
const PIE_COLORS = ['#7eb8f7','#4caf50','#ff9800','#f44336','#4dd0e1','#b39ddb','#ff7043','#a5d6a7'];
export class PieChart extends Control<PieChartOptions> {
  private _data: PieDataPoint[] = [];
  constructor(container: string | HTMLElement | null = null, opts: PieChartOptions = {}) {
    super(container, 'div', { size: 180, donut: true, legend: true, ...opts });
    this.el.className = `ar-chart ar-piechart${opts.class?' '+opts.class:''}`;
  }
  set data(v: PieDataPoint[]) { this._data = v; this._set('data' as never, v as never); }
  get data()                  { return this._data; }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string; if (lbl) this._el('div', 'ar-chart__title', this.el).textContent = lbl;
    if (!this._data.length) { this._el('div', 'ar-chart__empty', this.el).textContent = 'No data'; return; }
    const size  = this._get('size', 180) as number;
    const R     = size / 2;
    const r     = this._get('donut', true) ? R * 0.55 : 0;
    const total = this._data.reduce((s, d) => s + d.value, 0);
    const svg   = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.style.width = size+'px'; svg.style.height = size+'px';
    let angle = -Math.PI / 2;
    this._data.forEach((d, i) => {
      const slice = (d.value / total) * Math.PI * 2;
      const x1 = R + R * Math.cos(angle); const y1 = R + R * Math.sin(angle);
      const x2 = R + R * Math.cos(angle + slice); const y2 = R + R * Math.sin(angle + slice);
      const ix1 = R + r * Math.cos(angle); const iy1 = R + r * Math.sin(angle);
      const ix2 = R + r * Math.cos(angle + slice); const iy2 = R + r * Math.sin(angle + slice);
      const large = slice > Math.PI ? 1 : 0;
      const color = d.color ?? PIE_COLORS[i % PIE_COLORS.length];
      const path  = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', r > 0
        ? `M ${ix1} ${iy1} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`
        : `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`);
      path.setAttribute('fill', color); path.style.cursor = 'pointer'; path.style.transition = 'opacity .15s';
      path.addEventListener('mouseenter', () => path.style.opacity = '0.8');
      path.addEventListener('mouseleave', () => path.style.opacity = '1');
      path.addEventListener('click', () => this._emit('click', { slice: d }));
      svg.appendChild(path); angle += slice;
    });
    const wrap = this._el('div', 'ar-piechart__wrap', this.el); wrap.appendChild(svg);
    if (this._get('legend', true)) {
      const leg = this._el('div', 'ar-piechart__legend', this.el);
      this._data.forEach((d, i) => {
        const row = this._el('div', 'ar-piechart__legend-row', leg);
        const dot = this._el('span', 'ar-piechart__legend-dot', row); dot.style.background = d.color ?? PIE_COLORS[i % PIE_COLORS.length];
        this._el('span', 'ar-piechart__legend-label', row).textContent = d.label;
        this._el('span', 'ar-piechart__legend-value', row).textContent = Math.round(d.value / total * 100)+'%';
      });
    }
  }
}
export const PieChartCSS = `.ar-piechart__wrap{display:flex;justify-content:center}.ar-piechart__legend{display:flex;flex-direction:column;gap:5px;margin-top:10px}.ar-piechart__legend-row{align-items:center;display:flex;gap:6px;font-size:.78rem}.ar-piechart__legend-dot{border-radius:50%;flex-shrink:0;height:10px;width:10px}.ar-piechart__legend-label{flex:1}.ar-piechart__legend-value{color:var(--ar-muted)}`;
