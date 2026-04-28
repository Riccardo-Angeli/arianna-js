/**
 * @module    components/finance/PortfolioDonut
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Asset allocation donut chart — pure SVG.
 */

import { _fmt } from './helpers.ts';

export class PortfolioDonut {
    #el: HTMLElement; #size: number;

    constructor(container: string | HTMLElement, opts: { size?: number } = {}) {
        this.#el   = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
        this.#size = opts.size ?? 300;
    }

    render(segments: { label: string; value: number; color?: string }[]): this {
        const COLORS = ['#e40c88', '#26a69a', '#7b9ef9', '#f4c842', '#ef5350', '#ff9800', '#ce93d8', '#80cbc4'];
        const total = segments.reduce((a, s) => a + s.value, 0);
        const cx = this.#size / 2, cy = this.#size / 2, R = cx * 0.7, r = cx * 0.4;
        let angle = -Math.PI / 2, arcs = '', legend = '';

        segments.forEach((seg, i) => {
            const slice = seg.value / total * 2 * Math.PI;
            const x1 = cx + R * Math.cos(angle),   y1 = cy + R * Math.sin(angle);
            const x2 = cx + R * Math.cos(angle + slice), y2 = cy + R * Math.sin(angle + slice);
            const ix1 = cx + r * Math.cos(angle),  iy1 = cy + r * Math.sin(angle);
            const ix2 = cx + r * Math.cos(angle + slice), iy2 = cy + r * Math.sin(angle + slice);
            const large = slice > Math.PI ? 1 : 0;
            const color = seg.color ?? COLORS[i % COLORS.length];
            arcs += `<path d="M${ix1},${iy1} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${r},${r} 0 ${large},0 ${ix1},${iy1}" fill="${color}"/>`;
            const midA = angle + slice / 2;
            const lx = cx + R * 1.1 * Math.cos(midA), ly = cy + R * 1.1 * Math.sin(midA);
            legend += `<text x="${lx}" y="${ly}" fill="#fff" font-size="11" text-anchor="middle">${_fmt(seg.value / total * 100)}%</text>`;
            legend += `<text x="${lx}" y="${ly + 14}" fill="#787b86" font-size="10" text-anchor="middle">${seg.label}</text>`;
            angle += slice;
        });

        this.#el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.#size}" height="${this.#size}" style="background:#131722;border-radius:4px">${arcs}${legend}</svg>`;
        return this;
    }
}
