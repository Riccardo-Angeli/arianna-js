/**
 * @module    components/payments/PaymentGateway
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Compound widget that presents *all* enabled payment methods in a single
 * checkout UI, lets the user pick one, and forwards the appropriate event
 * to the merchant code. This is the single integration point most apps
 * actually want — instead of mounting ApplePay / GPay / Stripe / Satispay
 * separately, drop in `PaymentGateway` and configure which methods to
 * expose for the current order.
 *
 *   ┌─────────────────────────────────────┐
 *   │ Choose how to pay                   │
 *   ├─────────────────────────────────────┤
 *   │ ◉ Apple Pay         [    Pay    ]   │
 *   │ ○ Google Pay                        │
 *   │ ○ Credit / Debit Card                │
 *   │ ○ PayPal                            │
 *   │ ○ Stripe                            │
 *   │ ○ Satispay                          │
 *   │ ○ Nexi                              │
 *   │ ○ Alipay                            │
 *   └─────────────────────────────────────┘
 *
 * The component instantiates the underlying widgets *lazily* — only when a
 * method is selected does it create the corresponding ApplePay / GPay / …
 * instance. Events from the underlying widget bubble up through this one.
 *
 * @example
 *   import { PaymentGateway } from 'ariannajs/components/payments';
 *
 *   const pg = new PaymentGateway('#checkout', {
 *       amount  : 99.00,
 *       currency: 'EUR',
 *       methods : {
 *           applePay : { merchantId: 'merchant.com.example', countryCode: 'IT' },
 *           googlePay: { merchantId: '01234567', merchantName: 'X', countryCode: 'IT', gateway: 'stripe', gatewayMerchantId: 'acct_1' },
 *           card     : { saveOption: true },
 *           paypal   : { clientId: 'AYxxx' },
 *           stripe   : { publishableKey: 'pk_test_…', clientSecret: '…', returnUrl: 'https://…' },
 *           satispay : { redirectUrl: 'https://online.satispay.com/…' },
 *           nexi     : { redirectUrl: 'https://ecommerce.nexi.it/…' },
 *           alipay   : { mode: 'redirect', redirectUrl: 'https://openapi.alipay.com/…' },
 *       },
 *   });
 *   pg.on('success', e => api.confirm(e.method, e.payload));
 *   pg.on('error',   e => showToast(`${e.method}: ${e.message}`));
 *   pg.on('cancel',  e => console.log('cancelled', e.method));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';
import { ApplePay,   type ApplePayOptions   } from './ApplePay.ts';
import { GooglePay,  type GooglePayOptions  } from './GooglePay.ts';
import { CreditCard, type CreditCardOptions } from './CreditCard.ts';
import { PayPal,     type PayPalOptions     } from './PayPal.ts';
import { Stripe,     type StripeOptions     } from './Stripe.ts';
import { Satispay,   type SatispayOptions   } from './Satispay.ts';
import { Nexi,       type NexiOptions       } from './Nexi.ts';
import { AliPay,     type AliPayOptions     } from './AliPay.ts';

// ── Method identifiers ──────────────────────────────────────────────────────

export type PaymentMethodId =
    | 'applePay' | 'googlePay' | 'card' | 'paypal'
    | 'stripe'   | 'satispay'  | 'nexi' | 'alipay';

interface MethodMeta { id: PaymentMethodId; label: string; icon: string; }

const METHOD_META: MethodMeta[] = [
    { id: 'applePay',  label: 'Apple Pay',         icon: '' },
    { id: 'googlePay', label: 'Google Pay',        icon: 'G' },
    { id: 'card',      label: 'Credit / Debit Card', icon: '▣' },
    { id: 'paypal',    label: 'PayPal',            icon: 'P' },
    { id: 'stripe',    label: 'Stripe',            icon: 'S' },
    { id: 'satispay',  label: 'Satispay',          icon: '◉' },
    { id: 'nexi',      label: 'Nexi',              icon: 'n' },
    { id: 'alipay',    label: 'Alipay',            icon: '支' },
];

// ── Per-method option subsets ───────────────────────────────────────────────
//
// We omit the always-redundant fields (amount/currency live at the gateway
// level, and the container is allocated dynamically per method). The
// remaining fields are exactly the per-PSP credentials/config the merchant
// has to provide.
type ApplePaySubset   = Omit<ApplePayOptions,   'amount' | 'currency' | 'class'>;
type GooglePaySubset  = Omit<GooglePayOptions,  'amount' | 'currency' | 'class'>;
type CardSubset       = Omit<CreditCardOptions, 'amount' | 'currency' | 'class'>;
type PayPalSubset     = Omit<PayPalOptions,     'amount' | 'currency' | 'class'>;
type StripeSubset     = Omit<StripeOptions,                            'class'>;
type SatispaySubset   = Omit<SatispayOptions,   'amount' | 'currency' | 'class'>;
type NexiSubset       = Omit<NexiOptions,       'amount' | 'currency' | 'class'>;
type AliPaySubset     = Omit<AliPayOptions,     'amount' | 'currency' | 'class'>;

export interface PaymentGatewayMethodConfig
{
    applePay?  : Partial<ApplePaySubset>;
    googlePay? : Partial<GooglePaySubset>;
    card?      : Partial<CardSubset>;
    paypal?    : Partial<PayPalSubset>;
    stripe?    : Partial<StripeSubset>;
    satispay?  : Partial<SatispaySubset>;
    nexi?      : Partial<NexiSubset>;
    alipay?    : Partial<AliPaySubset>;
}

export interface PaymentGatewayOptions extends CtrlOptions
{
    amount      : number;
    /** ISO 4217 currency. */
    currency    : string;
    /** Per-method config — only the methods present here are shown. */
    methods     : PaymentGatewayMethodConfig;
    /** Initially-selected method. Default = first available. */
    initial?    : PaymentMethodId;
    /** Title above the method list. Default 'Choose how to pay'. */
    title?      : string;
    /** Reorder methods. Default uses METHOD_META order. */
    order?      : PaymentMethodId[];
    /** Locale for built-in labels. */
    locale?     : 'it' | 'en';
}

// ── Component ────────────────────────────────────────────────────────────────

export class PaymentGateway extends Control<PaymentGatewayOptions>
{
    private _selected : PaymentMethodId | null = null;
    /** Lazily-instantiated child widgets, keyed by method id. */
    private _children : Partial<Record<PaymentMethodId, Control<CtrlOptions>>> = {};

    private _elList!  : HTMLElement;
    private _elPanel! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: PaymentGatewayOptions)
    {
        super(container, 'div', {
            title  : detectIt() ? 'Scegli come pagare' : 'Choose how to pay',
            locale : detectIt() ? 'it' : 'en',
            ...opts,
        });

        this.el.className = `ar-pg${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();

        const initial = opts.initial ?? this._availableMethods()[0];
        if (initial) this.select(initial);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Methods the merchant has actually configured (in display order). */
    getAvailableMethods(): PaymentMethodId[] { return this._availableMethods(); }

    /** Currently-selected method id, or null. */
    getSelected(): PaymentMethodId | null { return this._selected; }

    /** Select a payment method (rebuilds the panel). */
    select(id: PaymentMethodId): this
    {
        if (!this._availableMethods().includes(id))
        {
            this._emit('error', { method: id, message: 'method not configured' });
            return this;
        }
        this._selected = id;
        this._refreshList();
        this._buildPanel();
        this._emit('select', { method: id });
        return this;
    }

    /** Trigger pay() on the currently-selected child widget, if it has one. */
    pay(): this
    {
        const id = this._selected;
        if (!id) { this._emit('error', { method: null, message: 'no method selected' }); return this; }
        const child = this._children[id] as { pay?: () => unknown } | undefined;
        if (child && typeof child.pay === 'function') { void child.pay(); }
        return this;
    }

    // ── Build + render ─────────────────────────────────────────────────────

    protected _build(): void
    {
        this.el.innerHTML = `
<div class="ar-pg__head">
  <span class="ar-pg__title">${escapeHtml(this._get<string>('title', 'Choose how to pay'))}</span>
  <span class="ar-pg__total">${this._formatTotal()}</span>
</div>
<div class="ar-pg__body">
  <div class="ar-pg__list" data-r="list"></div>
  <div class="ar-pg__panel" data-r="panel"></div>
</div>`;
        this._elList  = this.el.querySelector<HTMLElement>('[data-r="list"]')!;
        this._elPanel = this.el.querySelector<HTMLElement>('[data-r="panel"]')!;
        this._refreshList();
    }

    private _refreshList(): void
    {
        this._elList.innerHTML = '';
        for (const id of this._availableMethods())
        {
            const meta = METHOD_META.find(m => m.id === id)!;
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'ar-pg__row' + (id === this._selected ? ' ar-pg__row--selected' : '');
            row.dataset.id = id;
            row.innerHTML = `
<span class="ar-pg__radio">${id === this._selected ? '◉' : '○'}</span>
<span class="ar-pg__icon">${escapeHtml(meta.icon)}</span>
<span class="ar-pg__label">${escapeHtml(meta.label)}</span>`;
            row.addEventListener('click', () => this.select(id));
            this._elList.appendChild(row);
        }
    }

    private _buildPanel(): void
    {
        this._elPanel.innerHTML = '';
        if (!this._selected) return;

        // Mount point for the child widget
        const mount = document.createElement('div');
        mount.className = 'ar-pg__mount';
        mount.dataset.method = this._selected;
        this._elPanel.appendChild(mount);

        // Reuse cached child if already built once for this method (to avoid
        // re-loading external SDK scripts on each selection toggle).
        if (this._children[this._selected])
        {
            const cached = this._children[this._selected]!;
            mount.appendChild(cached.el);
            return;
        }

        // Build the appropriate child widget with merged options
        const amount   = this._get<number>('amount', 0);
        const currency = this._get<string>('currency', 'EUR');
        const cfg      = this._get<PaymentGatewayMethodConfig>('methods', {});

        let child: Control<CtrlOptions> | null = null;
        // Each branch builds the merged options object then casts to the
        // concrete component's option type. We strip amount/currency out of
        // the per-method config (if present) so the gateway-level values
        // always win.
        const stripTotals = <T extends object>(o: T | undefined): T =>
            (o ? { ...o, amount: undefined, currency: undefined } : {}) as T;

        switch (this._selected)
        {
            case 'applePay':  child = new ApplePay  (mount, { amount, currency, ...stripTotals(cfg.applePay)  } as ApplePayOptions);   break;
            case 'googlePay': child = new GooglePay (mount, { amount, currency, ...stripTotals(cfg.googlePay) } as GooglePayOptions); break;
            case 'card':      child = new CreditCard(mount, { amount, currency, ...stripTotals(cfg.card)      } as CreditCardOptions); break;
            case 'paypal':    child = new PayPal    (mount, { amount, currency, ...stripTotals(cfg.paypal)    } as PayPalOptions);    break;
            case 'stripe':    child = new Stripe    (mount, { ...(cfg.stripe   as StripeOptions) });                                  break;
            case 'satispay':  child = new Satispay  (mount, { amount, currency, ...stripTotals(cfg.satispay)  } as SatispayOptions);  break;
            case 'nexi':      child = new Nexi      (mount, { amount, currency, ...stripTotals(cfg.nexi)      } as NexiOptions);      break;
            case 'alipay':    child = new AliPay    (mount, { amount, currency, ...stripTotals(cfg.alipay)    } as AliPayOptions);    break;
        }

        if (child)
        {
            this._children[this._selected] = child;
            // Bubble events up — tag with the method
            for (const evt of ['ready', 'submit', 'success', 'error', 'cancel', 'click', 'pending'])
            {
                child.on(evt, (data: unknown) =>
                    this._emit(evt, { method: this._selected, ...(data as Record<string, unknown>) }));
            }
        }
    }

    private _availableMethods(): PaymentMethodId[]
    {
        const cfg   = this._get<PaymentGatewayMethodConfig>('methods', {});
        const order = this._get<PaymentMethodId[]>('order', METHOD_META.map(m => m.id));
        return order.filter(id => cfg[id] !== undefined);
    }

    private _formatTotal(): string
    {
        const amount   = this._get<number>('amount', 0);
        const currency = this._get<string>('currency', 'EUR');
        const locale   = this._get<'it' | 'en'>('locale', 'en');
        try
        {
            const fmt = new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-US', {
                style: 'currency', currency,
            });
            return fmt.format(amount);
        }
        catch { return `${currency} ${amount.toFixed(2)}`; }
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-pg-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-pg-styles';
        s.textContent = `
.ar-pg { display:flex; flex-direction:column; max-width:720px; background:#1e1e1e; border:1px solid #333; border-radius:8px; color:#d4d4d4; font:13px -apple-system,system-ui,sans-serif; }
.ar-pg__head { display:flex; align-items:baseline; justify-content:space-between; padding:14px 18px; border-bottom:1px solid #333; }
.ar-pg__title { font:600 14px sans-serif; }
.ar-pg__total { font:600 16px ui-monospace,monospace; color:#e40c88; }
.ar-pg__body { display:flex; min-height:240px; }
.ar-pg__list  { width:240px; flex-shrink:0; border-right:1px solid #333; padding:8px; display:flex; flex-direction:column; gap:2px; }
.ar-pg__row   { display:flex; align-items:center; gap:10px; padding:10px 12px; background:transparent; border:0; color:#d4d4d4; cursor:pointer; border-radius:4px; text-align:left; font:13px sans-serif; }
.ar-pg__row:hover { background:#2a2a2a; }
.ar-pg__row--selected { background:rgba(228,12,136,0.15); border-left:3px solid #e40c88; padding-left:9px; }
.ar-pg__radio { font-size:14px; color:#888; width:14px; }
.ar-pg__row--selected .ar-pg__radio { color:#e40c88; }
.ar-pg__icon  { width:22px; text-align:center; font:600 14px sans-serif; }
.ar-pg__label { flex:1; }
.ar-pg__panel { flex:1; padding:18px; min-height:200px; display:flex; align-items:flex-start; }
.ar-pg__mount { width:100%; }
`;
        document.head.appendChild(s);
    }
}

function detectIt(): boolean
{
    if (typeof navigator !== 'undefined' && navigator.language?.startsWith('it')) return true;
    return false;
}

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}
