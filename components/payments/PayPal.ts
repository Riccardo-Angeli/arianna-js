/**
 * @module    components/payments/PayPal
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * PayPal Smart Button. Loads the PayPal JS SDK on demand
 * (`paypal.com/sdk/js?client-id=…`) and renders the official PayPal button
 * which itself opens the PayPal pop-up / redirect / in-context flow when
 * clicked. The component handles createOrder / onApprove / onCancel /
 * onError lifecycle and emits `success`, `cancel`, and `error` events.
 *
 * The PayPal SDK supports many flow modes; this widget targets the standard
 * "Checkout" flow with a single payment. For subscriptions or vault flows,
 * pass the relevant `intent` and `vault` options.
 *
 * @example
 *   import { PayPal } from 'ariannajs/components/payments';
 *
 *   const pp = new PayPal('#paypal', {
 *       clientId : 'AYxxxxxxxxxxxxxxxxxxx',
 *       amount   : 99.00,
 *       currency : 'EUR',
 *       description: 'AriannA Pro license',
 *   });
 *   pp.on('success', e => api.confirm(e.orderId));
 *   pp.on('cancel',  () => console.log('Cancelled'));
 *   pp.on('error',   e => showToast(e.message));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PayPalOptions extends CtrlOptions
{
    /** PayPal REST API client-id. */
    clientId    : string;
    amount      : number;
    /** ISO 4217. PayPal supports a fixed list — see PayPal docs. */
    currency    : string;
    /** Description shown in the order. */
    description?: string;
    /** Order intent. Default 'capture'. */
    intent?     : 'capture' | 'authorize';
    /** Locale for the button. Default browser default. */
    locale?     : string;
    /** Button style. */
    buttonStyle?: {
        layout? : 'vertical' | 'horizontal';
        color?  : 'gold' | 'blue' | 'silver' | 'white' | 'black';
        shape?  : 'rect' | 'pill';
        label?  : 'paypal' | 'checkout' | 'buynow' | 'pay' | 'subscribe';
        height? : number;     // 25..55
    };
    /** Disable the funding sources you don't want. */
    disableFunding? : Array<'card' | 'credit' | 'paylater' | 'sepa' | 'venmo'>;
}

// ── Component ────────────────────────────────────────────────────────────────

export class PayPal extends Control<PayPalOptions>
{
    private _elHost!    : HTMLElement;
    private _elFallback!: HTMLElement;

    constructor(container: string | HTMLElement | null, opts: PayPalOptions)
    {
        super(container, 'div', {
            description : '',
            intent      : 'capture',
            buttonStyle : { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
            disableFunding: [],
            ...opts,
        });

        this.el.className = `ar-paypal${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
    }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        this.el.innerHTML = `
<div class="ar-paypal__host" data-r="host"></div>
<div class="ar-paypal__fallback" data-r="fallback" style="display:none">
  PayPal is not available right now.
</div>`;
        this._elHost     = this.el.querySelector<HTMLElement>('[data-r="host"]')!;
        this._elFallback = this.el.querySelector<HTMLElement>('[data-r="fallback"]')!;

        void this._loadAndRender();
    }

    private async _loadAndRender(): Promise<void>
    {
        const clientId = this._get<string>('clientId', '');
        const currency = this._get<string>('currency', 'EUR');
        const intent   = this._get<string>('intent', 'capture');
        const locale   = this._get<string>('locale', '');
        const disable  = this._get<string[]>('disableFunding', []);

        try
        {
            await loadPayPalScript({ clientId, currency, intent, locale, disableFunding: disable });
        }
        catch (e)
        {
            this._showFallback();
            this._emit('error', { message: 'Failed to load PayPal SDK: ' + (e as Error).message });
            return;
        }

        const paypal = (window as unknown as { paypal?: { Buttons: (cfg: unknown) => { render: (el: HTMLElement) => Promise<void>; isEligible?: () => boolean } } }).paypal;
        if (!paypal?.Buttons)
        {
            this._showFallback();
            this._emit('error', { message: 'PayPal Buttons not available' });
            return;
        }

        const style = this._get<PayPalOptions['buttonStyle']>('buttonStyle', {});
        const buttons = paypal.Buttons({
            style,
            createOrder: (_d: unknown, actions: { order: { create: (cfg: unknown) => Promise<string> } }) => {
                return actions.order.create({
                    intent: intent.toUpperCase(),
                    purchase_units: [{
                        description: this._get<string>('description', ''),
                        amount: { currency_code: currency, value: this._get<number>('amount', 0).toFixed(2) },
                    }],
                });
            },
            onApprove: async (_d: { orderID: string }, actions: { order: { capture?: () => Promise<unknown>; authorize?: () => Promise<unknown> } }) => {
                try
                {
                    const result = intent === 'capture'
                        ? await actions.order.capture?.()
                        : await actions.order.authorize?.();
                    this._emit('success', { orderId: _d.orderID, result });
                }
                catch (e)
                {
                    this._emit('error', { message: (e as Error).message });
                }
            },
            onCancel: (_d: unknown) => this._emit('cancel', {}),
            onError : (e: unknown) => this._emit('error', { message: (e as Error).message || 'PayPal error' }),
        });

        if (buttons.isEligible && !buttons.isEligible())
        {
            this._showFallback();
            this._emit('ready', { available: false });
            return;
        }
        try
        {
            await buttons.render(this._elHost);
            this._emit('ready', { available: true });
        }
        catch (e)
        {
            this._showFallback();
            this._emit('error', { message: 'Render failed: ' + (e as Error).message });
        }
    }

    private _showFallback(): void
    {
        this._elHost.style.display = 'none';
        this._elFallback.style.display = '';
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-paypal-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-paypal-styles';
        s.textContent = `
.ar-paypal { display:inline-block; min-width:200px; }
.ar-paypal__host { display:inline-block; min-width:200px; }
.ar-paypal__fallback { color:#888; font:12px sans-serif; padding:6px 10px; }
`;
        document.head.appendChild(s);
    }
}

// ── Script loader ───────────────────────────────────────────────────────────

interface PayPalLoadOpts { clientId: string; currency: string; intent: string; locale?: string; disableFunding?: string[]; }
let _ppPromise: Promise<void> | null = null;
let _ppCacheKey = '';
function loadPayPalScript(opts: PayPalLoadOpts): Promise<void>
{
    const key = `${opts.clientId}|${opts.currency}|${opts.intent}|${opts.locale ?? ''}|${(opts.disableFunding ?? []).join(',')}`;
    if (_ppPromise && _ppCacheKey === key) return _ppPromise;

    _ppCacheKey = key;
    _ppPromise = new Promise((resolve, reject) => {
        if (typeof document === 'undefined') { reject(new Error('no document')); return; }
        const params = new URLSearchParams({
            'client-id': opts.clientId,
            currency  : opts.currency,
            intent    : opts.intent,
        });
        if (opts.locale) params.set('locale', opts.locale);
        if (opts.disableFunding && opts.disableFunding.length)
            params.set('disable-funding', opts.disableFunding.join(','));

        const s = document.createElement('script');
        s.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
        s.async = true;
        s.onload  = () => resolve();
        s.onerror = () => reject(new Error('script load failed'));
        document.head.appendChild(s);
    });
    return _ppPromise;
}
