/**
 * @module    components/finance/PnLChart
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Profit & loss bar chart — pure SVG.
 */

import { _svg, _fmtK } from './_helpers.ts';

export class PnLChart {
    #el: HTMLElement; #w: number; #h: number;

    constructor(container: string | HTMLElement, opts: { width?: number; height?: number } = {}) {
        this.#el = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
        this.#w = opts.width ?? 500; this.#h = opts.height ?? 250;
    }

    render(data: { label: string; pnl: number }[]): this {
        const pad = { l: 70, r: 20, t: 20, b: 40 };
        const W = this.#w - pad.l - pad.r, H = this.#h - pad.t - pad.b;
        const maxAbs = Math.max(...data.map(d => Math.abs(d.pnl))) || 1;
        const bw = W / data.length - 2;
        const yZ = pad.t + H / 2;
        const yS = (v: number) => v >= 0 ? yZ - v / maxAbs * (H / 2) : yZ;
        const bH = (v: number) => Math.abs(v) / maxAbs * (H / 2);

        let bars = '', labels = '';
        data.forEach((d, i) => {
            const x = pad.l + i * (W / data.length);
            const color = d.pnl >= 0 ? '#26a69a' : '#ef5350';
            bars   += _svg('rect', { x, y: yS(d.pnl), width: Math.max(1, bw), height: Math.max(1, bH(d.pnl)), fill: color });
            labels += _svg('text', { x: x + bw / 2, y: pad.t + H + 15, fill: '#787b86', 'font-size': 10, 'text-anchor': 'middle' }, d.label);
        });

        let axes = _svg('line', { x1: pad.l, y1: yZ, x2: pad.l + W, y2: yZ, stroke: '#2a2e39', 'stroke-width': 1 });
        for (let i = -2; i <= 2; i++) {
            const v = i / 2 * maxAbs, y = yZ - i / 2 * H / 2;
            axes += _svg('text', { x: pad.l - 5, y: y + 4, fill: '#787b86', 'font-size': 10, 'text-anchor': 'end' }, _fmtK(v));
        }

        this.#el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.#w}" height="${this.#h}" style="background:#131722;border-radius:4px">${axes}${bars}${labels}</svg>`;
        return this;
    }
}
