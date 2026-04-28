/**
 * @module    components/finance/DepthChart
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Order book depth chart (cumulative bid/ask area) — pure SVG.
 */

export class DepthChart {
    #el: HTMLElement; #w: number; #h: number;

    constructor(container: string | HTMLElement, opts: { width?: number; height?: number } = {}) {
        this.#el = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
        this.#w = opts.width ?? 600; this.#h = opts.height ?? 300;
    }

    render(bids: [number, number][], asks: [number, number][]): this {
        const pad = { l: 60, r: 20, t: 20, b: 30 };
        const W = this.#w - pad.l - pad.r, H = this.#h - pad.t - pad.b;

        const cumulate = (levels: [number, number][]) =>
            levels.reduce((acc, [p, q]) => {
                const prev = acc[acc.length - 1] ?? [p, 0];
                acc.push([p, prev[1] + q] as [number, number]);
                return acc;
            }, [] as [number, number][]);

        const cumBids = cumulate(bids);
        const cumAsks = cumulate(asks);

        const allPrices = [...bids.map(b => b[0]), ...asks.map(a => a[0])];
        const allSizes  = [...cumBids.map(b => b[1]), ...cumAsks.map(a => a[1])];
        const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
        const maxS = Math.max(...allSizes) || 1;
        const xS = (p: number) => pad.l + (p - minP) / (maxP - minP) * W;
        const yS = (s: number) => pad.t + (1 - s / maxS) * H;

        const bidPts = cumBids.map(([p, s]) => `${xS(p)},${yS(s)}`).join(' ');
        const askPts = cumAsks.map(([p, s]) => `${xS(p)},${yS(s)}`).join(' ');
        const floor  = pad.t + H;

        this.#el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.#w}" height="${this.#h}" style="background:#131722;border-radius:4px">
<polyline points="${bidPts} ${xS(bids[0][0])},${floor}" fill="#26a69a33" stroke="#26a69a" stroke-width="2"/>
<polyline points="${askPts} ${xS(asks[asks.length - 1][0])},${floor}" fill="#ef535033" stroke="#ef5350" stroke-width="2"/>
</svg>`;
        return this;
    }
}
