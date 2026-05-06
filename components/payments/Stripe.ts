/**
 * @module    components/payments/Stripe
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Stripe Elements wrapper. Loads Stripe.js on demand
 * (`js.stripe.com/v3/`) and mounts the unified `payment` element which
 * Stripe routes to the appropriate UI (card, SEPA, iDEAL, …) based on the
 * customer's country and the payment intent's `payment_method_types`.
 *
 * The widget needs a Payment Intent to be created server-side first; the
 * client-side just confirms the intent. The flow is:
 *
 *   1. Server creates PaymentIntent → returns `client_secret`
 *   2. Browser instantiates this widget with `clientSecret`
 *   3. User fills the card form (Stripe-hosted iframe → PCI-safe)
 *   4. User clicks Pay → `stripe.confirmPayment(clientSecret)`
 *   5. Stripe redirects (3DS) or returns success/error inline
 *
 * @example
 *   import { Stripe } from 'ariannajs/components/payments';
 *
 *   // 1. Backend creates PaymentIntent and returns client_secret
 *   const { clientSecret } = await api.createIntent({ amount: 9900, currency: 'eur' });
 *
 *   // 2. Mount widget
 *   const sp = new Stripe('#stripe', {
 *       publishableKey: 'pk_test_…',
 *       clientSecret  : clientSecret,
 *       returnUrl     : 'https://example.com/checkout/return',
 *   });
 *   sp.on('success', e => api.confirmOrder(e.intent.id));
 *   sp.on('error',   e => showToast(e.message));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StripeOptions extends CtrlOptions
{
    /** Publishable key from the Stripe dashboard (`pk_test_…` or `pk_live_…`). */
    publishableKey : string;
    /** Client secret of the PaymentIntent (or SetupIntent). */
    clientSecret   : string;
    /** URL to redirect to after authentication / 3DS. */
    returnUrl      : string;
    /** Stripe Elements appearance object. */
    appearance?    : Record<string, unknown>;
    /** Stripe Elements locale. Default 'auto'. */
    locale?        : string;
    /** Button label. Default 'Pay'. */
    buttonLabel?   : string;
    /** Pin the API version (production: pin to a known version). */
    apiVersion?    : string;
}

// ── Component ────────────────────────────────────────────────────────────────

export class Stripe extends Control<StripeOptions>
{
    private _stripe   : unknown = null;
    private _elements : unknown = null;
    private _paymentEl: unknown = null;

    private _elMount! : HTMLElement;
    private _elBtn!   : HTMLButtonElement;
    private _elError! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: StripeOptions)
    {
        super(container, 'div', {
            locale       : 'auto',
            buttonLabel  : 'Pay',
            ...opts,
        });

        this.el.className = `ar-stripe${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Confirm the PaymentIntent. Equivalent to clicking the Pay button. */
    pay(): Promise<void> { return this._confirm(); }

    /** True once Stripe.js has loaded and the payment element has mounted. */
    isReady(): boolean { return this._paymentEl !== null; }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        this.el.innerHTML = `
<div class="ar-stripe__mount" data-r="mount"></div>
<div class="ar-stripe__error" data-r="error" style="display:none"></div>
<button class="ar-stripe__btn" data-r="btn" disabled>${escapeHtml(this._get<string>('buttonLabel', 'Pay'))}</button>`;

        this._elMount = this.el.querySelector<HTMLElement>('[data-r="mount"]')!;
        this._elError = this.el.querySelector<HTMLElement>('[data-r="error"]')!;
        this._elBtn   = this.el.querySelector<HTMLButtonElement>('[data-r="btn"]')!;
        this._elBtn.addEventListener('click', () => { void this._confirm(); });

        void this._loadAndMount();
    }

    private async _loadAndMount(): Promise<void>
    {
        try { await loadStripeScript(); }
        catch (e) {
            this._showError('Failed to load Stripe: ' + (e as Error).message);
            return;
        }

        const Stripe = (window as unknown as { Stripe?: (key: string, opts?: Record<string, unknown>) => unknown }).Stripe;
        if (!Stripe)
        {
            this._showError('Stripe.js not available');
            return;
        }

        const apiVersion = this._get<string>('apiVersion', '');
        this._stripe = Stripe(
            this._get<string>('publishableKey', ''),
            apiVersion ? { apiVersion } : {},
        );

        const elementsCfg: Record<string, unknown> = {
            clientSecret: this._get<string>('clientSecret', ''),
            locale      : this._get<string>('locale', 'auto'),
        };
        const appearance = this._get<Record<string, unknown>>('appearance', {});
        if (Object.keys(appearance).length) elementsCfg.appearance = appearance;

        const stripe = this._stripe as { elements: (cfg: unknown) => { create: (kind: string) => { mount: (el: HTMLElement) => void } } };
        this._elements = stripe.elements(elementsCfg);
        const elements = this._elements as { create: (kind: string) => { mount: (el: HTMLElement) => void } };

        this._paymentEl = elements.create('payment');
        const paymentEl = this._paymentEl as { mount: (el: HTMLElement) => void };
        paymentEl.mount(this._elMount);

        this._elBtn.disabled = false;
        this._emit('ready', {});
    }

    private async _confirm(): Promise<void>
    {
        if (!this._stripe || !this._elements)
        {
            this._showError('Not ready yet');
            return;
        }
        this._showError(null);
        this._elBtn.disabled = true;

        const stripe = this._stripe as {
            confirmPayment: (cfg: { elements: unknown; confirmParams: { return_url: string }; redirect: 'if_required' }) => Promise<{ error?: { message?: string }; paymentIntent?: { id: string; status: string } }>;
        };

        try
        {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements: this._elements,
                confirmParams: { return_url: this._get<string>('returnUrl', '') },
                redirect: 'if_required',
            });
            this._elBtn.disabled = false;
            if (error)
            {
                this._showError(error.message || 'Payment failed');
                this._emit('error', { message: error.message });
                return;
            }
            if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture'))
            {
                this._emit('success', { intent: paymentIntent });
            }
            else
            {
                this._emit('pending', { intent: paymentIntent });
            }
        }
        catch (e)
        {
            this._elBtn.disabled = false;
            this._showError((e as Error).message || 'Unexpected error');
            this._emit('error', { message: (e as Error).message });
        }
    }

    private _showError(msg: string | null): void
    {
        if (!msg) { this._elError.style.display = 'none'; this._elError.textContent = ''; return; }
        this._elError.style.display = '';
        this._elError.textContent = msg;
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-stripe-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-stripe-styles';
        s.textContent = `
.ar-stripe { display:flex; flex-direction:column; gap:12px; padding:16px; background:#1e1e1e; border:1px solid #333; border-radius:8px; max-width:420px; }
.ar-stripe__mount { background:#fff; padding:14px; border-radius:6px; min-height:80px; }
.ar-stripe__error { padding:8px 12px; background:rgba(220,38,38,0.15); border:1px solid #dc2626; border-radius:3px; color:#fca5a5; font:12px sans-serif; }
.ar-stripe__btn { background:#635bff; color:#fff; border:0; padding:12px; font:600 14px sans-serif; border-radius:4px; cursor:pointer; transition:background .12s; }
.ar-stripe__btn:hover:not(:disabled) { background:#4f46e5; }
.ar-stripe__btn:disabled { background:#555; cursor:not-allowed; }
`;
        document.head.appendChild(s);
    }
}

// ── Script loader ───────────────────────────────────────────────────────────

let _stripePromise: Promise<void> | null = null;
function loadStripeScript(): Promise<void>
{
    if (_stripePromise) return _stripePromise;
    _stripePromise = new Promise((resolve, reject) => {
        if (typeof document === 'undefined') { reject(new Error('no document')); return; }
        if ((window as unknown as { Stripe?: unknown }).Stripe) { resolve(); return; }

        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.async = true;
        s.onload  = () => resolve();
        s.onerror = () => reject(new Error('script load failed'));
        document.head.appendChild(s);
    });
    return _stripePromise;
}

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}
