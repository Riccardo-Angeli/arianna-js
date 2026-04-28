/**
 * @module    components/finance/LineChart
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Multi-series line chart — pure SVG, zero dependencies.
 */

import { _svg, _fmt } from './_helpers.ts';

export interface LineChartSeries { name: string; data: number[]; color?: string; }

export class LineChart {
    #el: HTMLElement;
    #w: number; #h: number;
    #bg: string; #grid: string; #text: string;

    constructor(container: string | HTMLElement, opts: { width?: number; height?: number; background?: string; gridColor?: string; textColor?: string } = {}) {
        this.#el   = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
        this.#w    = opts.width      ?? 600;
        this.#h    = opts.height     ?? 300;
        this.#bg   = opts.background ?? '#131722';
        this.#grid = opts.gridColor  ?? '#2a2e39';
        this.#text = opts.textColor  ?? '#787b86';
    }

    render(series: LineChartSeries[]): this {
        const COLORS = ['#e40c88', '#26a69a', '#ef5350', '#f4c842', '#7b9ef9', '#ff9800'];
        const pad = { l: 55, r: 20, t: 20, b: 30 };
        const W = this.#w - pad.l - pad.r, H = this.#h - pad.t - pad.b;
        const allData = series.flatMap(s => s.data);
        const minV = Math.min(...allData), maxV = Math.max(...allData);
        const rng = maxV - minV || 1;
        const maxLen = Math.max(...series.map(s => s.data.length));
        const xS = (i: number) => pad.l + i / (maxLen - 1) * W;
        const yS = (v: number) => pad.t + (maxV - v) / rng * H;

        let grid = '', lines = '', legend = '';
        for (let i = 0; i <= 4; i++) {
            const v = minV + i / 4 * rng, y = yS(v);
            grid += _svg('line', { x1: pad.l, y1: y, x2: pad.l + W, y2: y, stroke: this.#grid, 'stroke-width': 1 });
            grid += _svg('text', { x: pad.l - 5, y: y + 4, fill: this.#text, 'font-size': 11, 'text-anchor': 'end' }, _fmt(v));
        }

        series.forEach((s, si) => {
            const color = s.color ?? COLORS[si % COLORS.length];
            const pts = s.data.map((v, i) => `${xS(i)},${yS(v)}`).join(' ');
            lines  += _svg('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 2 });
            legend += `<text x="${pad.l + si * 120}" y="${this.#h - 5}" fill="${color}" font-size="12">${s.name}</text>`;
        });

        this.#el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.#w}" height="${this.#h}" style="background:${this.#bg};border-radius:4px">${grid}${lines}${legend}</svg>`;
        return this;
    }
}
