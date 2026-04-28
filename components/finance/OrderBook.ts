/**
 * @module    components/finance/OrderBook
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Bid/ask ladder table — pure HTML.
 */

import { _fmt, _fmtK } from './_helpers.ts';

export class OrderBook {
    #el: HTMLElement;

    constructor(container: string | HTMLElement) {
        this.#el = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
    }

    render(bids: [number, number][], asks: [number, number][], depth = 10): this {
        const row = (price: number, size: number, side: 'bid' | 'ask') =>
            `<tr><td style="color:${side === 'bid' ? '#26a69a' : '#ef5350'};padding:2px 8px">${_fmt(price)}</td><td style="color:#fff;padding:2px 8px;text-align:right">${_fmtK(size)}</td></tr>`;

        const askRows  = asks.slice(0, depth).reverse().map(([p, s]) => row(p, s, 'ask')).join('');
        const bidRows  = bids.slice(0, depth).map(([p, s]) => row(p, s, 'bid')).join('');
        const midPrice = ((asks[0]?.[0] ?? 0) + (bids[0]?.[0] ?? 0)) / 2;
        const spread   = (asks[0]?.[0] ?? 0) - (bids[0]?.[0] ?? 0);

        this.#el.innerHTML = `<div style="background:#131722;border-radius:4px;padding:8px;font-family:monospace;font-size:12px">
<table style="width:100%;border-collapse:collapse">
<thead><tr><th style="color:#787b86;text-align:left;padding:2px 8px">Price</th><th style="color:#787b86;text-align:right;padding:2px 8px">Size</th></tr></thead>
<tbody>${askRows}</tbody>
</table>
<div style="color:#f4c842;padding:4px 8px;border-top:1px solid #2a2e39;border-bottom:1px solid #2a2e39">Mid: ${_fmt(midPrice)} | Spread: ${_fmt(spread)}</div>
<table style="width:100%;border-collapse:collapse">
<tbody>${bidRows}</tbody>
</table></div>`;
        return this;
    }
}
