/**
 * @module    components/payments/Nexi
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Nexi (formerly XPay) hosted payment gateway integration. Nexi is the
 * dominant Italian acquirer / processor; many Italian banks issue cards
 * routed through Nexi. The standard flow is "Hosted Payment Page": the
 * merchant generates a signed redirect URL server-side and the user is
 * sent to the Nexi-branded checkout page, then back to the merchant's
 * return URL with the transaction outcome.
 *
 * This widget renders the Nexi-branded button + redirects on click. It
 * does NOT compute the MAC signature itself — that requires the merchant's
 * secret key and must happen server-side. The caller passes the fully-
 * formed `redirectUrl` returned by their backend.
 *
 * Note: Nexi also offers a JS SDK for inline iframe checkout; that's a
 * future enhancement (would mirror the Stripe.ts pattern).
 *
 * @example
 *   import { Nexi } from 'ariannajs/components/payments';
 *
 *   // 1. Backend signs payment request → returns { redirectUrl, transactionCode }
 *   const { redirectUrl, transactionCode } = await api.createNexiPayment(amount);
 *
 *   // 2. Mount widget
 *   const nx = new Nexi('#nexi', {
 *       redirectUrl: redirectUrl,
 *       amount     : 99.00,
 *       transactionCode: transactionCode,
 *   });
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NexiOptions extends CtrlOptions
{
    /** Pre-signed Nexi hosted-checkout URL (returned by the merchant backend). */
    redirectUrl : string;
    amount      : number;
    /** ISO 4217. Default 'EUR' (Nexi mainly handles EUR). */
    currency?   : string;
    /** Optional internal transaction code, displayed under the button. */
    transactionCode? : string;
    /** Button label override. */
    buttonLabel?: string;
    /** Open in new tab vs replace current. Default false. */
    openInNewTab? : boolean;
    /** Locale: 'it' | 'en'. Default browser default → 'it' or 'en'. */
    locale?     : 'it' | 'en';
}

// ── Component ────────────────────────────────────────────────────────────────

export class Nexi extends Control<NexiOptions>
{
    constructor(container: string | HTMLElement | null, opts: NexiOptions)
    {
        super(container, 'div', {
            currency    : 'EUR',
            openInNewTab: false,
            locale      : detectItOrEn(),
            ...opts,
        });

        this.el.className = `ar-nexi${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    pay(): this
    {
        const url = this._get<string>('redirectUrl', '');
        if (!url) { this._emit('error', { message: 'redirectUrl not configured' }); return this; }
        this._emit('click', { transactionCode: this._get<string>('transactionCode', '') });
        if (this._get<boolean>('openInNewTab', false)) window.open(url, '_blank', 'noopener');
        else                                            window.location.href = url;
        return this;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        const locale = this._get<'it' | 'en'>('locale', 'it');
        const label  = this._get<string>('buttonLabel', '') || (locale === 'it' ? 'Paga con Nexi' : 'Pay with Nexi');
        const tx     = this._get<string>('transactionCode', '');

        this.el.innerHTML = `
<button class="ar-nexi__btn" data-r="btn" type="button">
  <span class="ar-nexi__logo">${NEXI_LOGO}</span>
  <span>${escapeHtml(label)}</span>
</button>
${tx ? `<div class="ar-nexi__txn">${escapeHtml(locale === 'it' ? 'Codice: ' : 'Code: ')}${escapeHtml(tx)}</div>` : ''}`;

        this.el.querySelector<HTMLButtonElement>('[data-r="btn"]')?.addEventListener('click', () => this.pay());
        this._emit('ready', {});
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-nexi-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-nexi-styles';
        // Nexi brand: dark blue #002756, accent yellow #ffd200
        s.textContent = `
.ar-nexi { display:inline-flex; flex-direction:column; gap:6px; align-items:flex-start; }
.ar-nexi__btn { display:inline-flex; align-items:center; gap:8px; min-width:200px; padding:11px 20px; background:#002756; color:#fff; border:0; border-radius:6px; font:600 15px -apple-system,system-ui,sans-serif; cursor:pointer; transition:background .12s; }
.ar-nexi__btn:hover { background:#001a3d; }
.ar-nexi__logo svg { display:block; height:18px; width:auto; }
.ar-nexi__txn { font:11px ui-monospace,monospace; color:#666; }
`;
        document.head.appendChild(s);
    }
}

const NEXI_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" aria-hidden="true">
<text x="0" y="18" font-family="-apple-system,system-ui,sans-serif" font-size="18" font-weight="700" fill="#ffd200">nexi</text>
</svg>`;

function detectItOrEn(): 'it' | 'en'
{
    if (typeof navigator !== 'undefined' && navigator.language?.startsWith('it')) return 'it';
    return 'en';
}

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}
