/**
 * @module    components/finance/Screener
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Filterable instrument table — pure HTML.
 */

import { _fmt, _fmtK } from './_helpers.ts';

export interface ScreenerRow { symbol: string; price: number; change: number; volume: number; marketCap?: number; [key: string]: unknown; }

export class Screener {
    #el: HTMLElement;

    constructor(container: string | HTMLElement) {
        this.#el = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
    }

    render(rows: ScreenerRow[], columns?: (keyof ScreenerRow)[]): this {
        const cols = columns ?? ['symbol', 'price', 'change', 'volume'];

        const header = cols.map(c =>
            `<th style="padding:6px 12px;border-bottom:1px solid #2a2e39;color:#787b86;font-weight:500">${String(c).toUpperCase()}</th>`
        ).join('');

        const body = rows.map(row => {
            const cells = cols.map(c => {
                let val   = row[c] as unknown;
                let style = 'padding:6px 12px;';
                if (c === 'change') {
                    const n = Number(val);
                    style  += `color:${n >= 0 ? '#26a69a' : '#ef5350'}`;
                    val     = `${n >= 0 ? '+' : ''}${_fmt(n)}%`;
                } else if (c === 'symbol') {
                    style  += 'color:#fff;font-weight:600';
                } else if (typeof val === 'number') {
                    val = _fmtK(val as number);
                }
                return `<td style="${style}">${String(val)}</td>`;
            }).join('');
            return `<tr style="border-bottom:1px solid #1e222d">${cells}</tr>`;
        }).join('');

        this.#el.innerHTML = `<div style="background:#131722;border-radius:4px;overflow:auto;font-family:sans-serif;font-size:13px">
<table style="width:100%;border-collapse:collapse">
<thead><tr>${header}</tr></thead>
<tbody>${body}</tbody>
</table></div>`;
        return this;
    }
}
