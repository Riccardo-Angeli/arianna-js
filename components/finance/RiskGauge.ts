/**
 * @module    components/finance/RiskGauge
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Semi-circular risk gauge — pure SVG.
 */

import { _fmt } from './_helpers.ts';

export class RiskGauge {
    #el: HTMLElement; #size: number;

    constructor(container: string | HTMLElement, opts: { size?: number } = {}) {
        this.#el   = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
        this.#size = opts.size ?? 200;
    }

    render(value: number, min = 0, max = 100, label = 'Risk'): this {
        const s = this.#size, cx = s / 2, cy = s * 0.6, R = s * 0.4;
        const t = (value - min) / (max - min);
        const endA  = Math.PI + t * Math.PI;
        const color = t < 0.33 ? '#26a69a' : t < 0.66 ? '#f4c842' : '#ef5350';
        const aX = (a: number) => cx + R * Math.cos(a);
        const aY = (a: number) => cy + R * Math.sin(a);

        const bgPath = `M${aX(Math.PI)},${aY(Math.PI)} A${R},${R} 0 0,1 ${aX(0)},${aY(0)}`;
        const fgPath = `M${aX(Math.PI)},${aY(Math.PI)} A${R},${R} 0 ${t > 0.5 ? 1 : 0},1 ${aX(endA)},${aY(endA)}`;
        const sw = R * 0.3;

        this.#el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s * 0.7}" style="background:#131722;border-radius:4px">
<path d="${bgPath}" fill="none" stroke="#2a2e39" stroke-width="${sw}"/>
<path d="${fgPath}" fill="none" stroke="${color}" stroke-width="${sw}"/>
<line x1="${cx}" y1="${cy}" x2="${aX(endA) * 0.85 + cx * 0.15}" y2="${aY(endA) * 0.85 + cy * 0.15}" stroke="#fff" stroke-width="2"/>
<circle cx="${cx}" cy="${cy}" r="4" fill="#fff"/>
<text x="${cx}" y="${cy - 10}" fill="${color}" font-size="16" font-weight="bold" text-anchor="middle">${_fmt(value)}</text>
<text x="${cx}" y="${cy + 5}" fill="#787b86" font-size="11" text-anchor="middle">${label}</text>
</svg>`;
        return this;
    }
}
