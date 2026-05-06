/**
 * @module    components/payments/GooglePay
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Google Pay button + sheet integration. Uses the Google Pay JS API
 * (`pay.js`) loaded on demand from `pay.google.com/gp/p/js/pay.js`. The
 * widget is renderer-agnostic and only emits events; the merchant's server
 * is responsible for forwarding the encrypted payment token to its PSP.
 *
 * The button follows Google Pay's brand guidelines (black, white, plain).
 *
 * REQUIREMENTS for Google Pay to actually work in production:
 *   • Served over HTTPS (or localhost during development)
 *   • Merchant registered in the Google Pay Business Console
 *   • Gateway integration set up (Stripe, Adyen, Worldpay, …) — Google Pay
 *     is a *wallet*, not a *gateway* — the merchant still needs a PSP
 *
 * @example
 *   import { GooglePay } from 'ariannajs/components/payments';
 *
 *   const gp = new GooglePay('#gpay', {
 *       merchantId    : '01234567890123456789',
 *       merchantName  : 'AriannA',
 *       amount        : 99.00,
 *       currency      : 'EUR',
 *       countryCode   : 'IT',
 *       gateway       : 'stripe',
 *       gatewayMerchantId: 'acct_1A2B3C',
 *       allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX'],
 *   });
 *   gp.on('success', e => api.processGooglePayToken(e.token));
 *   gp.on('cancel',  () => console.log('User cancelled'));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export type GPayCardNetwork = 'AMEX' | 'DISCOVER' | 'JCB' | 'MASTERCARD' | 'VISA' | 'INTERAC';
export type GPayAuthMethod  = 'PAN_ONLY' | 'CRYPTOGRAM_3DS';

export interface GooglePayOptions extends CtrlOptions
{
    /** Google Pay merchant ID from the Business Console. */
    merchantId         : string;
    merchantName       : string;
    amount             : number;
    /** ISO 4217. */
    currency           : string;
    /** ISO 3166-1 alpha-2 country code of the merchant. */
    countryCode        : string;
    /** PSP token-handler name. e.g. 'stripe', 'adyen', 'worldpay'. */
    gateway            : string;
    /** Per-PSP merchant id (Stripe acct, Adyen merchantAccount, etc.). */
    gatewayMerchantId  : string;
    /** Card networks accepted. Default ['VISA','MASTERCARD','AMEX']. */
    allowedCardNetworks? : GPayCardNetwork[];
    /** Auth methods. Default ['PAN_ONLY','CRYPTOGRAM_3DS']. */
    allowedAuthMethods?  : GPayAuthMethod[];
    /** Test environment. Default true so devs can sandbox-test. Set false in prod. */
    test?              : boolean;
    /** Button color. Default 'black'. */
    buttonColor?       : 'black' | 'white';
    /** Button type. Default 'buy'. */
    buttonType?        : 'book' | 'buy' | 'checkout' | 'donate' | 'order' | 'pay' | 'plain' | 'subscribe';
}

// ── Component ────────────────────────────────────────────────────────────────

export class GooglePay extends Control<GooglePayOptions>
{
    private _elBtnHost! : HTMLElement;
    private _elFallback!: HTMLElement;
    private _client    : unknown = null;

    constructor(container: string | HTMLElement | null, opts: GooglePayOptions)
    {
        super(container, 'div', {
            allowedCardNetworks : ['VISA', 'MASTERCARD', 'AMEX'],
            allowedAuthMethods  : ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            test                : true,
            buttonColor         : 'black',
            buttonType          : 'buy',
            ...opts,
        });

        this.el.className = `ar-gpay${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Trigger the Google Pay sheet programmatically. */
    pay(): Promise<void> { return this._pay(); }

    /** Whether Google Pay JS API is loaded and a client is ready. */
    isReady(): boolean { return this._client !== null; }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        this.el.innerHTML = `
<div class="ar-gpay__btn-host" data-r="btn"></div>
<div class="ar-gpay__fallback" data-r="fallback" style="display:none">
  Google Pay is not available.
</div>`;
        this._elBtnHost  = this.el.querySelector<HTMLElement>('[data-r="btn"]')!;
        this._elFallback = this.el.querySelector<HTMLElement>('[data-r="fallback"]')!;

        void this._loadAndInit();
    }

    private async _loadAndInit(): Promise<void>
    {
        try { await loadGooglePayScript(); }
        catch (e) {
            this._showFallback();
            this._emit('error', { message: 'Failed to load Google Pay script: ' + (e as Error).message });
            return;
        }

        const w = window as unknown as { google?: { payments?: { api?: { PaymentsClient: new (cfg: unknown) => unknown } } } };
        if (!w.google?.payments?.api?.PaymentsClient)
        {
            this._showFallback();
            this._emit('error', { message: 'Google Pay API not present after load' });
            return;
        }

        const test = this._get<boolean>('test', true);
        const Client = w.google.payments.api.PaymentsClient;
        this._client = new Client({ environment: test ? 'TEST' : 'PRODUCTION' });

        // Check readiness
        const isReady = (this._client as { isReadyToPay: (req: unknown) => Promise<{ result: boolean }> })
            .isReadyToPay(this._isReadyRequest());
        try
        {
            const res = await isReady;
            if (!res.result)
            {
                this._showFallback();
                this._emit('ready', { available: false });
                return;
            }
            this._renderButton();
            this._emit('ready', { available: true });
        }
        catch (e)
        {
            this._showFallback();
            this._emit('error', { message: 'isReadyToPay failed: ' + (e as Error).message });
        }
    }

    private _renderButton(): void
    {
        const c = this._client as { createButton: (cfg: unknown) => HTMLElement };
        const btn = c.createButton({
            buttonColor : this._get<string>('buttonColor', 'black'),
            buttonType  : this._get<string>('buttonType', 'buy'),
            buttonSizeMode: 'fill',
            onClick     : () => { void this._pay(); },
        });
        this._elBtnHost.innerHTML = '';
        this._elBtnHost.appendChild(btn);
    }

    private async _pay(): Promise<void>
    {
        if (!this._client)
        {
            this._emit('error', { message: 'Google Pay client not ready' });
            return;
        }
        const c = this._client as { loadPaymentData: (req: unknown) => Promise<unknown> };
        try
        {
            const data = await c.loadPaymentData(this._paymentDataRequest());
            this._emit('success', { token: (data as { paymentMethodData?: unknown }).paymentMethodData });
        }
        catch (e)
        {
            const err = e as { statusCode?: string; message?: string };
            if (err.statusCode === 'CANCELED') this._emit('cancel', {});
            else this._emit('error', { message: err.message || 'Google Pay failed' });
        }
    }

    private _baseCardPaymentMethod(): unknown
    {
        return {
            type: 'CARD',
            parameters: {
                allowedAuthMethods: this._get<GPayAuthMethod[]>('allowedAuthMethods', ['PAN_ONLY', 'CRYPTOGRAM_3DS']),
                allowedCardNetworks: this._get<GPayCardNetwork[]>('allowedCardNetworks', ['VISA', 'MASTERCARD', 'AMEX']),
            },
        };
    }

    private _isReadyRequest(): unknown
    {
        return {
            apiVersion: 2,
            apiVersionMinor: 0,
            allowedPaymentMethods: [this._baseCardPaymentMethod()],
        };
    }

    private _paymentDataRequest(): unknown
    {
        const card = this._baseCardPaymentMethod() as { parameters: object; tokenizationSpecification?: unknown };
        card.tokenizationSpecification = {
            type: 'PAYMENT_GATEWAY',
            parameters: {
                gateway: this._get<string>('gateway', ''),
                gatewayMerchantId: this._get<string>('gatewayMerchantId', ''),
            },
        };
        return {
            apiVersion: 2,
            apiVersionMinor: 0,
            allowedPaymentMethods: [card],
            transactionInfo: {
                totalPriceStatus: 'FINAL',
                totalPrice: this._get<number>('amount', 0).toFixed(2),
                currencyCode: this._get<string>('currency', 'EUR'),
                countryCode: this._get<string>('countryCode', 'IT'),
            },
            merchantInfo: {
                merchantId  : this._get<string>('merchantId', ''),
                merchantName: this._get<string>('merchantName', ''),
            },
        };
    }

    private _showFallback(): void
    {
        this._elBtnHost.style.display = 'none';
        this._elFallback.style.display = '';
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-gpay-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-gpay-styles';
        s.textContent = `
.ar-gpay { display:inline-block; min-width:200px; }
.ar-gpay__btn-host { display:inline-block; }
.ar-gpay__fallback { color:#888; font:12px sans-serif; padding:6px 10px; }
`;
        document.head.appendChild(s);
    }
}

// ── Script loader (cached across instances) ─────────────────────────────────

let _gpayPromise: Promise<void> | null = null;
function loadGooglePayScript(): Promise<void>
{
    if (_gpayPromise) return _gpayPromise;
    _gpayPromise = new Promise((resolve, reject) => {
        if (typeof document === 'undefined') { reject(new Error('no document')); return; }

        // Already loaded?
        const w = window as unknown as { google?: { payments?: unknown } };
        if (w.google?.payments) { resolve(); return; }

        const s = document.createElement('script');
        s.src = 'https://pay.google.com/gp/p/js/pay.js';
        s.async = true;
        s.onload  = () => resolve();
        s.onerror = () => reject(new Error('script load failed'));
        document.head.appendChild(s);
    });
    return _gpayPromise;
}
