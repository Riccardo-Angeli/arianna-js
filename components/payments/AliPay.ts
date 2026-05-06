/**
 * @module    components/payments/AliPay
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Alipay payment integration. Alipay is server-driven: the merchant creates
 * a payment URL on the backend, redirects the user (or shows a QR code),
 * the user authorises in the Alipay app, and Alipay calls back to the
 * merchant's notify URL.
 *
 * This widget renders the official Alipay button or QR code. It does NOT
 * perform any handshake itself — the caller provides either the redirect URL
 * (for desktop) or the QR code data URL (typically generated server-side).
 *
 *   • `redirectUrl` — desktop / mobile web: clicking the button navigates here.
 *   • `qrCode`      — desktop with QR display: rendered as <img>.
 *
 * @example
 *   import { AliPay } from 'ariannajs/components/payments';
 *
 *   const ap = new AliPay('#alipay', {
 *       mode    : 'redirect',
 *       redirectUrl: 'https://openapi.alipay.com/gateway.do?…',
 *       amount  : 99.00,
 *       currency: 'CNY',
 *   });
 *   ap.on('click', () => analytics.track('alipay_clicked'));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AliPayOptions extends CtrlOptions
{
    /** Display mode. */
    mode        : 'redirect' | 'qr';
    /** For mode='redirect': URL to navigate to on click. */
    redirectUrl?: string;
    /** For mode='qr': QR code image URL or data URL. */
    qrCode?     : string;
    /** Total amount (informational — actual charge is server-side). */
    amount      : number;
    /** ISO 4217 currency code. Default 'CNY'. */
    currency?   : string;
    /** Button label override. */
    buttonLabel?: string;
    /** Open the redirect in a new tab instead of replacing window. Default false. */
    openInNewTab? : boolean;
    /** Locale: 'zh' | 'en'. Default 'en'. */
    locale?     : 'zh' | 'en';
}

// ── Component ────────────────────────────────────────────────────────────────

export class AliPay extends Control<AliPayOptions>
{
    constructor(container: string | HTMLElement | null, opts: AliPayOptions)
    {
        super(container, 'div', {
            currency    : 'CNY',
            openInNewTab: false,
            locale      : 'en',
            ...opts,
        });

        this.el.className = `ar-alipay${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Programmatically invoke the redirect (for mode='redirect' only). */
    pay(): this
    {
        const url = this._get<string>('redirectUrl', '');
        if (!url) { this._emit('error', { message: 'redirectUrl not configured' }); return this; }
        this._emit('click', {});
        if (this._get<boolean>('openInNewTab', false))
            window.open(url, '_blank', 'noopener');
        else
            window.location.href = url;
        return this;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        const mode    = this._get<'redirect' | 'qr'>('mode', 'redirect');
        const locale  = this._get<'zh' | 'en'>('locale', 'en');
        const label   = this._get<string>('buttonLabel', '') || (locale === 'zh' ? '使用支付宝付款' : 'Pay with Alipay');

        if (mode === 'qr')
        {
            const qr = this._get<string>('qrCode', '');
            this.el.innerHTML = `
<div class="ar-alipay__qr-wrap">
  ${qr ? `<img class="ar-alipay__qr" src="${qr}" alt="Alipay QR">` : `<div class="ar-alipay__qr ar-alipay__qr--missing">QR code missing</div>`}
  <div class="ar-alipay__qr-label">
    <span class="ar-alipay__brand">${ALIPAY_LOGO}</span>
    <span>${escapeHtml(locale === 'zh' ? '请使用支付宝扫描二维码' : 'Scan with Alipay')}</span>
  </div>
</div>`;
        }
        else
        {
            this.el.innerHTML = `
<button class="ar-alipay__btn" data-r="btn" type="button">
  <span class="ar-alipay__brand">${ALIPAY_LOGO}</span>
  <span>${escapeHtml(label)}</span>
</button>`;
            this.el.querySelector<HTMLButtonElement>('[data-r="btn"]')?.addEventListener('click', () => this.pay());
        }

        this._emit('ready', { mode });
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-alipay-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-alipay-styles';
        s.textContent = `
.ar-alipay { display:inline-block; }
.ar-alipay__btn { display:inline-flex; align-items:center; gap:8px; min-width:200px; padding:11px 20px; background:#1677ff; color:#fff; border:0; border-radius:6px; font:600 15px -apple-system,system-ui,sans-serif; cursor:pointer; transition:background .12s; }
.ar-alipay__btn:hover { background:#0958d9; }
.ar-alipay__brand { font:700 16px sans-serif; letter-spacing:.02em; }
.ar-alipay__brand svg { display:block; height:18px; }
.ar-alipay__qr-wrap { display:inline-flex; flex-direction:column; align-items:center; gap:10px; padding:16px; background:#fff; border:2px solid #1677ff; border-radius:8px; }
.ar-alipay__qr { width:200px; height:200px; display:block; background:#f3f4f6; }
.ar-alipay__qr--missing { display:flex; align-items:center; justify-content:center; color:#888; font:13px sans-serif; }
.ar-alipay__qr-label { display:flex; align-items:center; gap:8px; font:13px sans-serif; color:#1677ff; }
`;
        document.head.appendChild(s);
    }
}

const ALIPAY_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true">
<rect width="32" height="32" rx="6" fill="#1677ff"/>
<text x="16" y="22" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff">支</text>
</svg>`;

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}
