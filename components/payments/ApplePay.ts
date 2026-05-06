/**
 * @module    components/payments/ApplePay
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Apple Pay button + sheet integration. Wraps the W3C `PaymentRequest` API
 * with the Apple Pay-specific payment method `https://apple.com/apple-pay`,
 * which is the cross-browser way Apple recommends since 2024.
 *
 * The button is rendered following Apple's Human Interface Guidelines
 * (rounded, black with white wordmark, "Buy with Apple Pay" text). The
 * widget hides itself if the device cannot pay, unless `forceShow` is set.
 *
 * REQUIREMENTS for Apple Pay to actually work in production:
 *   • Served over HTTPS
 *   • Domain associated with merchantId in the Apple Developer portal
 *   • `apple-developer-merchantid-domain-association` file at the well-known URL
 *   • Browser: Safari 10+, or Chrome/Firefox via PaymentRequest API on supported devices
 *
 * The component does NOT perform any backend handshake — once the user
 * approves the sheet, the resulting payment token is forwarded via the
 * `success` event for the merchant's own server to forward to its PSP.
 *
 * @example
 *   import { ApplePay } from 'ariannajs/components/payments';
 *
 *   const ap = new ApplePay('#applepay', {
 *       merchantId : 'merchant.com.example.shop',
 *       countryCode: 'IT',
 *       currency   : 'EUR',
 *       amount     : 99.00,
 *       label      : 'AriannA Pro license',
 *       supportedNetworks: ['visa', 'masterCard', 'amex'],
 *   });
 *   ap.on('success', e => api.processApplePayToken(e.token));
 *   ap.on('error',   e => showToast(e.message));
 *   ap.on('cancel',  () => console.log('User cancelled'));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export type ApplePayNetwork =
    | 'visa' | 'masterCard' | 'amex' | 'discover' | 'maestro'
    | 'jcb'  | 'cartesBancaires' | 'unionPay' | 'mada' | 'electron';

export type ApplePayMerchantCapability =
    'supports3DS' | 'supportsCredit' | 'supportsDebit' | 'supportsEMV';

export interface ApplePayOptions extends CtrlOptions
{
    merchantId    : string;
    /** ISO 3166-1 alpha-2 country code where the merchant is based. */
    countryCode   : string;
    /** ISO 4217 currency code. */
    currency      : string;
    /** Total amount to charge. */
    amount        : number;
    /** Description shown in the Apple Pay sheet. Default 'Total'. */
    label?        : string;
    /** Card networks accepted. Default ['visa','masterCard','amex']. */
    supportedNetworks? : ApplePayNetwork[];
    /** Merchant capabilities. Default ['supports3DS']. */
    merchantCapabilities? : ApplePayMerchantCapability[];
    /** Force the button to render even if device can't pay (for debugging). */
    forceShow?    : boolean;
    /** Button style. Default 'black'. */
    buttonStyle?  : 'black' | 'white' | 'white-outline';
    /** Button label key. Default 'plain'. Other choices map to Apple's spec. */
    buttonType?   : 'plain' | 'buy' | 'donate' | 'check-out' | 'subscribe' | 'reload';
}

// ── Component ────────────────────────────────────────────────────────────────

export class ApplePay extends Control<ApplePayOptions>
{
    private _elBtn!     : HTMLButtonElement;
    private _elFallback!: HTMLElement;

    constructor(container: string | HTMLElement | null, opts: ApplePayOptions)
    {
        super(container, 'div', {
            label                : 'Total',
            supportedNetworks    : ['visa', 'masterCard', 'amex'],
            merchantCapabilities : ['supports3DS'],
            forceShow            : false,
            buttonStyle          : 'black',
            buttonType           : 'plain',
            ...opts,
        });

        this.el.className = `ar-applepay${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Programmatically trigger the Apple Pay sheet. */
    pay(): Promise<void> { return this._pay(); }

    /**
     * Detect whether Apple Pay can be invoked on this device. Resolves to
     * `true` if a PaymentRequest could be constructed (does NOT confirm the
     * user has cards on file — that requires `canMakePayment()`).
     */
    static async isAvailable(): Promise<boolean>
    {
        if (typeof window === 'undefined') return false;
        // Native Safari API
        const w = window as unknown as { ApplePaySession?: { canMakePayments(): boolean } };
        if (w.ApplePaySession?.canMakePayments) return w.ApplePaySession.canMakePayments();
        // PaymentRequest API
        if (typeof (window as unknown as { PaymentRequest?: unknown }).PaymentRequest !== 'undefined') return true;
        return false;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        const buttonStyle = this._get<string>('buttonStyle', 'black');
        const buttonType  = this._get<string>('buttonType', 'plain');

        this.el.innerHTML = `
<button class="ar-applepay__btn ar-applepay__btn--${buttonStyle} ar-applepay__btn--${buttonType}" data-r="btn" type="button">
  <span class="ar-applepay__logo">${APPLE_LOGO_SVG}</span>
  <span class="ar-applepay__label">${this._buttonLabel()}</span>
</button>
<div class="ar-applepay__fallback" data-r="fallback" style="display:none">
  Apple Pay is not available on this device.
</div>`;

        this._elBtn      = this.el.querySelector<HTMLButtonElement>('[data-r="btn"]')!;
        this._elFallback = this.el.querySelector<HTMLElement>('[data-r="fallback"]')!;

        this._elBtn.addEventListener('click', () => { void this._pay(); });

        // Hide button if not available, unless forceShow
        ApplePay.isAvailable().then(ok => {
            if (!ok && !this._get<boolean>('forceShow', false))
            {
                this._elBtn.style.display = 'none';
                this._elFallback.style.display = '';
            }
            this._emit('ready', { available: ok });
        });
    }

    private _buttonLabel(): string
    {
        const t = this._get<string>('buttonType', 'plain');
        switch (t)
        {
            case 'buy':       return 'Buy with';
            case 'donate':    return 'Donate with';
            case 'check-out': return 'Check out with';
            case 'subscribe': return 'Subscribe with';
            case 'reload':    return 'Reload with';
            default:          return '';
        }
    }

    private async _pay(): Promise<void>
    {
        // Try the W3C PaymentRequest API first
        const PR = (window as unknown as { PaymentRequest?: unknown }).PaymentRequest;
        if (!PR)
        {
            this._emit('error', { message: 'PaymentRequest API not supported' });
            return;
        }

        const networks = this._get<ApplePayNetwork[]>('supportedNetworks', ['visa', 'masterCard', 'amex']);
        const caps     = this._get<ApplePayMerchantCapability[]>('merchantCapabilities', ['supports3DS']);
        const amount   = this._get<number>('amount', 0).toFixed(2);
        const currency = this._get<string>('currency', 'EUR');
        const country  = this._get<string>('countryCode', 'IT');

        const methodData = [{
            supportedMethods: 'https://apple.com/apple-pay',
            data: {
                version             : 3,
                merchantIdentifier  : this._get<string>('merchantId', ''),
                merchantCapabilities: caps,
                supportedNetworks   : networks,
                countryCode         : country,
            },
        }];
        const details = {
            total: { label: this._get<string>('label', 'Total'), amount: { currency, value: amount } },
        };

        try
        {
            // Cast through unknown — PaymentRequest types vary across DOM lib versions
            const Ctor = PR as new (m: unknown, d: unknown) => {
                show(): Promise<unknown>;
                canMakePayment(): Promise<boolean>;
            };
            const req = new Ctor(methodData, details);
            const can = await req.canMakePayment();
            if (!can)
            {
                this._emit('error', { message: 'No Apple Pay cards available' });
                return;
            }
            const response = await req.show();
            // Hand back the (already-encrypted) payment token to the caller
            const r = response as { details?: unknown; complete?: (s: string) => Promise<void> };
            this._emit('success', { token: r.details });
            await r.complete?.('success');
        }
        catch (e)
        {
            const msg = (e as Error).message || 'Apple Pay failed';
            if (/cancel|abort/i.test(msg)) this._emit('cancel', {});
            else                            this._emit('error', { message: msg });
        }
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-applepay-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-applepay-styles';
        s.textContent = `
.ar-applepay { display:inline-block; }
.ar-applepay__btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-width:160px; padding:11px 20px; border:0; border-radius:6px; font:600 16px -apple-system,system-ui,sans-serif; cursor:pointer; transition:transform .08s; -webkit-appearance:none; }
.ar-applepay__btn:active { transform:scale(0.98); }
.ar-applepay__btn--black         { background:#000; color:#fff; }
.ar-applepay__btn--white         { background:#fff; color:#000; border:1px solid #000; }
.ar-applepay__btn--white-outline { background:#fff; color:#000; border:1px solid #000; }
.ar-applepay__btn:hover { opacity:0.92; }
.ar-applepay__logo svg { display:block; height:18px; width:auto; }
.ar-applepay__btn--white .ar-applepay__logo svg path,
.ar-applepay__btn--white-outline .ar-applepay__logo svg path { fill:#000; }
.ar-applepay__label:empty { display:none; }
.ar-applepay__fallback { color:#888; font:12px sans-serif; padding:6px 10px; }
`;
        document.head.appendChild(s);
    }
}

const APPLE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 22" aria-hidden="true">
<path fill="#fff" d="M14.94 11.5c0-2.06 1.69-3.05 1.76-3.1a3.78 3.78 0 0 0-2.98-1.61c-1.26-.13-2.45.74-3.09.74-.65 0-1.62-.72-2.67-.7A3.95 3.95 0 0 0 4.6 8.86c-1.43 2.48-.36 6.13 1.02 8.13.69.97 1.51 2.07 2.58 2.03 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.6.67 2.69.65 1.11-.02 1.81-1 2.49-1.97a8.78 8.78 0 0 0 1.13-2.31 3.79 3.79 0 0 1-2.26-3.22zM12.92 5.5a3.75 3.75 0 0 0 .85-2.69 3.79 3.79 0 0 0-2.46 1.27 3.55 3.55 0 0 0-.87 2.6c.93.07 1.86-.47 2.48-1.18z"/>
</svg>`;
