/**
 * @module    components/finance/HeatmapChart
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Correlation / sector heatmap — pure SVG.
 */

import { _svg, _fmt } from './_helpers.ts';

export class HeatmapChart {
    #el: HTMLElement; #w: number; #h: number;

    constructor(container: string | HTMLElement, opts: { width?: number; height?: number } = {}) {
        this.#el = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
        this.#w = opts.width ?? 600; this.#h = opts.height ?? 400;
    }

    render(labels: string[], matrix: number[][]): this {
        const n = labels.length;
        const pad = 60, cellW = (this.#w - pad) / n, cellH = (this.#h - pad) / n;
        let cells = '', axes = '';

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const v = matrix[i][j];
                const t = (v + 1) / 2;
                const r = Math.round(t < 0.5 ? 0 : (t - 0.5) * 2 * 239);
                const g = Math.round(t < 0.5 ? (0.5 - t) * 2 * 82 : (t - 0.5) * 2 * 68);
                const b = Math.round(t < 0.5 ? (0.5 - t) * 2 * 129 : 0);
                const x = pad + j * cellW, y = pad + i * cellH;
                cells += _svg('rect', { x, y, width: cellW, height: cellH, fill: `rgb(${r},${g},${b})` });
                cells += _svg('text', { x: x + cellW / 2, y: y + cellH / 2 + 5, fill: '#fff', 'font-size': 10, 'text-anchor': 'middle' }, _fmt(v));
            }
            axes += _svg('text', { x: pad + i * cellW + cellW / 2, y: pad - 5, fill: '#787b86', 'font-size': 11, 'text-anchor': 'middle' }, labels[i]);
            axes += _svg('text', { x: pad - 5, y: pad + i * cellH + cellH / 2 + 4, fill: '#787b86', 'font-size': 11, 'text-anchor': 'end' }, labels[i]);
        }

        this.#el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.#w}" height="${this.#h}" style="background:#131722;border-radius:4px">${axes}${cells}</svg>`;
        return this;
    }
}
