/**
 * @module    components/payments/Satispay
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Satispay payment integration. Satispay (Italian wallet, 4M+ users) uses
 * a server-driven flow: the merchant creates a payment via the Satispay
 * Business API and receives a `redirect_url`. The user clicks the button,
 * is redirected to the Satispay app (or web flow on desktop), authorises,
 * then comes back to the merchant via `redirect_url`.
 *
 * Like AliPay this widget is a button + redirect — the actual payment
 * creation happens server-side. The Satispay-Business-API requires:
 *   • Activation Code from the Satispay Dashboard
 *   • RSA key pair for request signing (server-only)
 *
 * @example
 *   import { Satispay } from 'ariannajs/components/payments';
 *
 *   // 1. Backend: POST /api/v1/payments → returns { redirect_url, payment_id }
 *   const { redirect_url, payment_id } = await api.createSatispayPayment(amount);
 *
 *   // 2. Mount widget
 *   const sp = new Satispay('#satispay', {
 *       redirectUrl: redirect_url,
 *       amount     : 99.00,
 *   });
 *   sp.on('click', () => analytics.track('satispay_clicked', { payment_id }));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SatispayOptions extends CtrlOptions
{
    /** URL returned by the Satispay /payments API. */
    redirectUrl : string;
    amount      : number;
    /** ISO 4217. Satispay only supports EUR. Default 'EUR'. */
    currency?   : string;
    /** Button label override. */
    buttonLabel?: string;
    /** Optional QR code image URL/data URL for desktop scanning. */
    qrCode?     : string;
    /** Display mode. Default 'button'. */
    mode?       : 'button' | 'qr' | 'both';
    /** Locale: 'it' | 'en'. Default browser default → 'it' or 'en'. */
    locale?     : 'it' | 'en';
}

// ── Component ────────────────────────────────────────────────────────────────

export class Satispay extends Control<SatispayOptions>
{
    constructor(container: string | HTMLElement | null, opts: SatispayOptions)
    {
        super(container, 'div', {
            currency : 'EUR',
            mode     : 'button',
            locale   : detectItOrEn(),
            ...opts,
        });

        this.el.className = `ar-satispay${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    pay(): this
    {
        const url = this._get<string>('redirectUrl', '');
        if (!url) { this._emit('error', { message: 'redirectUrl not configured' }); return this; }
        this._emit('click', {});
        window.location.href = url;
        return this;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        const mode   = this._get<'button' | 'qr' | 'both'>('mode', 'button');
        const locale = this._get<'it' | 'en'>('locale', 'it');
        const label  = this._get<string>('buttonLabel', '') || (locale === 'it' ? 'Paga con Satispay' : 'Pay with Satispay');
        const qr     = this._get<string>('qrCode', '');

        let html = '';
        if (mode === 'button' || mode === 'both')
        {
            html += `
<button class="ar-satispay__btn" data-r="btn" type="button">
  <span class="ar-satispay__logo">${SATISPAY_LOGO}</span>
  <span>${escapeHtml(label)}</span>
</button>`;
        }
        if ((mode === 'qr' || mode === 'both') && qr)
        {
            html += `
<div class="ar-satispay__qr-wrap">
  <img class="ar-satispay__qr" src="${qr}" alt="Satispay QR">
  <div class="ar-satispay__qr-label">${escapeHtml(locale === 'it' ? 'Scansiona con Satispay' : 'Scan with Satispay')}</div>
</div>`;
        }
        this.el.innerHTML = html;
        this.el.querySelector<HTMLButtonElement>('[data-r="btn"]')?.addEventListener('click', () => this.pay());
        this._emit('ready', { mode });
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-satispay-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-satispay-styles';
        // Satispay brand: red #e2336b (close to AriannA fuchsia, intentionally aligned)
        s.textContent = `
.ar-satispay { display:inline-flex; gap:14px; align-items:center; }
.ar-satispay__btn { display:inline-flex; align-items:center; gap:8px; min-width:200px; padding:11px 20px; background:#ff4081; color:#fff; border:0; border-radius:6px; font:600 15px -apple-system,system-ui,sans-serif; cursor:pointer; transition:background .12s; }
.ar-satispay__btn:hover { background:#e91e63; }
.ar-satispay__logo svg { display:block; height:18px; width:auto; }
.ar-satispay__qr-wrap { display:inline-flex; flex-direction:column; align-items:center; gap:8px; padding:14px; background:#fff; border:2px solid #ff4081; border-radius:8px; }
.ar-satispay__qr { width:180px; height:180px; display:block; }
.ar-satispay__qr-label { font:13px sans-serif; color:#ff4081; }
`;
        document.head.appendChild(s);
    }
}

const SATISPAY_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true">
<rect width="32" height="32" rx="8" fill="#fff"/>
<path d="M16 8a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="#ff4081"/>
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
