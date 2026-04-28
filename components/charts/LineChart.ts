/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module LineChart
 * @example
 *   const chart = new LineChart('#root', { label: 'CPU %', area: true });
 *   chart.data = [{ label: '00:00', value: 12 }, { label: '01:00', value: 34 }];
 */
import { Control } from '../core/Control.ts';
export interface LineDataPoint { label: string; value: number; }
export interface LineChartOptions { label?: string; height?: number; color?: string; area?: boolean; showDots?: boolean; smooth?: boolean; class?: string; }
export class LineChart extends Control<LineChartOptions> {
  private _data: LineDataPoint[] = [];
  constructor(container: string | HTMLElement | null = null, opts: LineChartOptions = {}) {
    super(container, 'div', { height: 180, color: 'var(--ar-primary)', area: true, showDots: true, smooth: true, ...opts });
    this.el.className = `ar-chart ar-linechart${opts.class?' '+opts.class:''}`;
  }
  set data(v: LineDataPoint[]) { this._data = v; this._set('data' as never, v as never); }
  get data()                   { return this._data; }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string; if (lbl) this._el('div', 'ar-chart__title', this.el).textContent = lbl;
    if (this._data.length < 2) { this._el('div', 'ar-chart__empty', this.el).textContent = 'No data'; return; }
    const h = this._get('height', 180) as number; const W = 400; const pad = 22;
    const max = Math.max(...this._data.map(d => d.value)) || 1;
    const pts = this._data.map((_, i) => ({
      x: pad + i * (W - 2*pad) / (this._data.length - 1),
      y: pad + (1 - this._data[i].value / max) * (h - 2*pad),
    }));
    const color = this._get('color', 'var(--ar-primary)') as string;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${h}`); svg.style.width = '100%'; svg.style.height = h+'px';
    const smooth = this._get('smooth', true) as boolean;
    const d = smooth
      ? 'M ' + pts.map((p, i) => { if (!i) return `${p.x},${p.y}`; const prev = pts[i-1]; const cx = (prev.x+p.x)/2; return `C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`; }).join(' ')
      : 'M ' + pts.map(p => `${p.x},${p.y}`).join(' L ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    if (this._get('area', true)) {
      const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      area.setAttribute('d', d + ` L ${pts[pts.length-1].x},${h-pad} L ${pts[0].x},${h-pad} Z`);
      area.setAttribute('fill', color); area.setAttribute('fill-opacity', '0.1'); svg.appendChild(area);
    }
    if (this._get('showDots', true)) pts.forEach(p => { const c = document.createElementNS('http://www.w3.org/2000/svg','circle'); c.setAttribute('cx',String(p.x)); c.setAttribute('cy',String(p.y)); c.setAttribute('r','3'); c.setAttribute('fill',color); svg.appendChild(c); });
    const step = Math.max(1, Math.ceil(this._data.length / 6));
    this._data.forEach((dp, i) => {
      if (i % step !== 0 && i !== this._data.length-1) return;
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x',String(pts[i].x)); t.setAttribute('y',String(h-4)); t.setAttribute('text-anchor','middle'); t.setAttribute('font-size','9'); t.setAttribute('fill','var(--ar-muted)'); t.textContent = dp.label; svg.appendChild(t);
    });
    this.el.appendChild(svg);
  }
}
export const LineChartCSS = `.ar-linechart{}`;
