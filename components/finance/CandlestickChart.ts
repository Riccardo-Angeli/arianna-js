/**
 * @module    components/finance/CandlestickChart
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * OHLCV candlestick/bar chart — pure SVG, zero dependencies.
 */

import type { Bar } from '../../additionals/Finance.ts';
import { _svg, _fmt } from './helpers.ts';

export interface CandlestickChartOptions {
    width?      : number;
    height?     : number;
    bullColor?  : string;
    bearColor?  : string;
    background? : string;
    gridColor?  : string;
    textColor?  : string;
    showVolume? : boolean;
    maxBars?    : number;
}

export class CandlestickChart {
    #opts: Required<CandlestickChartOptions>;
    #el  : HTMLElement;

    constructor(container: string | HTMLElement, opts: CandlestickChartOptions = {}) {
        this.#opts = {
            width: 800, height: 500, bullColor: '#26a69a', bearColor: '#ef5350',
            background: '#131722', gridColor: '#2a2e39', textColor: '#787b86',
            showVolume: true, maxBars: 100, ...opts,
        };
        this.#el = typeof container === 'string'
            ? document.querySelector(container) as HTMLElement ?? document.body
            : container;
    }

    render(bars: Bar[]): this {
        const { width, height, bullColor, bearColor, background, gridColor, textColor, showVolume, maxBars } = this.#opts;
        const data   = bars.slice(-maxBars);
        const chartH = showVolume ? height * 0.75 : height;
        const volH   = height - chartH;
        const pad    = { l: 60, r: 20, t: 20, b: showVolume ? 0 : 30 };
        const W      = width - pad.l - pad.r;
        const H      = chartH - pad.t - (showVolume ? 0 : pad.b);
        const bw     = Math.max(1, W / data.length - 1);
        const prices = data.flatMap(b => [b.high, b.low]);
        const minP   = Math.min(...prices), maxP = Math.max(...prices);
        const rng    = maxP - minP || 1;
        const pY     = (p: number) => pad.t + (maxP - p) / rng * H;
        const bX     = (i: number) => pad.l + i * (W / data.length) + bw / 4;

        let gridLines = '';
        for (let i = 0; i <= 5; i++) {
            const p = minP + i / 5 * rng, y = pY(p);
            gridLines += _svg('line', { x1: pad.l, y1: y, x2: pad.l + W, y2: y, stroke: gridColor, 'stroke-width': 1 });
            gridLines += _svg('text', { x: pad.l - 5, y: y + 4, fill: textColor, 'font-size': 11, 'text-anchor': 'end' }, _fmt(p));
        }

        let candles = '';
        for (let i = 0; i < data.length; i++) {
            const b = data[i];
            const color = b.close >= b.open ? bullColor : bearColor;
            const x = bX(i), cy1 = pY(b.high), cy2 = pY(b.low);
            const by1 = pY(Math.max(b.open, b.close)), by2 = pY(Math.min(b.open, b.close));
            candles += _svg('line', { x1: x + bw / 2, y1: cy1, x2: x + bw / 2, y2: cy2, stroke: color, 'stroke-width': 1 });
            candles += _svg('rect', { x, y: by1, width: Math.max(1, bw), height: Math.max(1, by2 - by1), fill: color });
        }

        let volBars = '';
        if (showVolume && volH > 0) {
            const maxVol = Math.max(...data.map(b => b.volume));
            for (let i = 0; i < data.length; i++) {
                const b = data[i], color = b.close >= b.open ? bullColor : bearColor;
                const vh = (b.volume / maxVol) * (volH - 10);
                volBars += _svg('rect', { x: bX(i), y: chartH + (volH - 10 - vh), width: Math.max(1, bw), height: Math.max(1, vh), fill: color, opacity: 0.6 });
            }
        }

        this.#el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:${background};border-radius:4px">
${gridLines}${candles}${volBars}
</svg>`;
        return this;
    }
}
