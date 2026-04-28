/**
 * @module    components/finance/Sparkline
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Mini inline price sparkline — pure SVG.
 */

export class Sparkline {
    #el: HTMLElement;

    constructor(container: string | HTMLElement) {
        this.#el = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
    }

    render(data: number[], opts: { width?: number; height?: number; color?: string } = {}): this {
        const w = opts.width ?? 100, h = opts.height ?? 30;
        const color = opts.color ?? (data[data.length - 1] >= data[0] ? '#26a69a' : '#ef5350');
        const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
        const pts = data.map((v, i) => `${w * i / (data.length - 1)},${h - (v - mn) / rng * h}`).join(' ');
        this.#el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
        return this;
    }
}
