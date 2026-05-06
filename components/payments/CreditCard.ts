/**
 * @module    components/payments/CreditCard
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Generic credit/debit card form. Detects the brand from the card number
 * (Visa, Mastercard, Amex, Maestro), validates with Luhn, formats input as
 * the user types, and emits a `submit` event with the (un-tokenised) card
 * data when the form is valid.
 *
 * IMPORTANT — PCI compliance: this component handles raw PAN/CVV in memory.
 * Production deployments MUST tokenise via the gateway (Stripe Elements,
 * Adyen Web Components, etc.) before transmitting to your servers, or be
 * served via a PCI-compliant iframe. This component is intended for:
 *
 *   • UI prototyping
 *   • Self-hosted closed-loop gift cards / loyalty
 *   • Developer environments with sandbox-only flows
 *   • Internal admin tooling where PCI scope is already managed
 *
 * Visual layout (Illustrator-style card preview + form fields):
 *
 *   ┌─────────────────────────────┐
 *   │  ╔═══════════════════════╗  │
 *   │  ║      VISA / MC        ║  │  ← live preview of brand
 *   │  ║  •••• •••• •••• 4242  ║  │
 *   │  ║  CARDHOLDER     12/28 ║  │
 *   │  ╚═══════════════════════╝  │
 *   │                             │
 *   │  Card number  [____________]│
 *   │  Cardholder   [____________]│
 *   │  MM/YY [__]   CVV [___]     │
 *   │  Country [▾]  ZIP [_____]   │
 *   │  ☐ Save card                │
 *   │  [    PAY EUR 99.00      ]  │
 *   └─────────────────────────────┘
 *
 * Built-in brands: Visa, Mastercard, American Express, Maestro. The
 * `detectBrand` helper is exported so consumers can apply the same logic
 * elsewhere.
 *
 * @example
 *   import { CreditCard } from 'ariannajs/components/payments';
 *
 *   const cc = new CreditCard('#pay', {
 *       amount: 99.00,
 *       currency: 'EUR',
 *       saveOption: true,
 *   });
 *   cc.on('submit', e => api.charge(e.card));
 *   cc.on('error',  e => showToast(e.message));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'maestro' | 'unknown';

export interface CardData
{
    /** Raw PAN — digits only. */
    number     : string;
    cardholder : string;
    /** 2-digit month, 1-12. */
    expMonth   : string;
    /** 4-digit year. */
    expYear    : string;
    /** 3 digits (Visa/MC/Maestro) or 4 digits (Amex). */
    cvv        : string;
    /** ISO 3166-1 alpha-2 country code. */
    country?   : string;
    zip?       : string;
    brand      : CardBrand;
    /** True if the user opted into "save this card". */
    save?      : boolean;
}

export interface CreditCardOptions extends CtrlOptions
{
    /** Amount to charge. Used only for the button label. */
    amount    : number;
    /** ISO 4217 currency code. Default 'EUR'. */
    currency? : string;
    /** Show the country / ZIP fields. Default true. */
    showAddress? : boolean;
    /** Show the "save card" checkbox. Default false. */
    saveOption?  : boolean;
    /** Lock the cardholder name and pre-fill it. */
    cardholder?  : string;
    /** Restrict accepted brands; everything else triggers an error. */
    allowedBrands? : CardBrand[];
    /** Locale for the button label and validation messages. Default 'en'. */
    locale?      : string;
}

// ── Component ────────────────────────────────────────────────────────────────

export class CreditCard extends Control<CreditCardOptions>
{
    private _brand : CardBrand = 'unknown';
    private _save  = false;

    // DOM
    private _elPreview!  : HTMLElement;
    private _elBrandLogo!: HTMLElement;
    private _elPreviewNumber!  : HTMLElement;
    private _elPreviewName!    : HTMLElement;
    private _elPreviewExp!     : HTMLElement;
    private _elNumber!   : HTMLInputElement;
    private _elName!     : HTMLInputElement;
    private _elExp!      : HTMLInputElement;
    private _elCvv!      : HTMLInputElement;
    private _elCountry?  : HTMLInputElement;
    private _elZip?      : HTMLInputElement;
    private _elSave?     : HTMLInputElement;
    private _elBtn!      : HTMLButtonElement;
    private _elError!    : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: CreditCardOptions)
    {
        super(container, 'div', {
            currency       : 'EUR',
            showAddress    : true,
            saveOption     : false,
            allowedBrands  : ['visa', 'mastercard', 'amex', 'maestro'],
            locale         : 'en',
            ...opts,
        });

        this.el.className = `ar-cc${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
        this._refreshPreview();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Get the current card data. Returns a deep clone — the caller may
     * inspect or mutate without affecting the form.
     */
    getCard(): CardData
    {
        return {
            number     : this._elNumber.value.replace(/\s+/g, ''),
            cardholder : this._elName.value.trim(),
            expMonth   : this._expParts().mm,
            expYear    : this._expParts().yyyy,
            cvv        : this._elCvv.value,
            country    : this._elCountry?.value.trim().toUpperCase() || undefined,
            zip        : this._elZip?.value.trim() || undefined,
            brand      : this._brand,
            save       : this._save,
        };
    }

    /** Programmatically set field values. */
    setCard(data: Partial<CardData>): this
    {
        if (data.number !== undefined)
        {
            this._elNumber.value = formatCardNumber(data.number, data.brand ?? detectBrand(data.number));
            this._brand = data.brand ?? detectBrand(data.number);
        }
        if (data.cardholder !== undefined) this._elName.value = data.cardholder;
        if (data.expMonth !== undefined && data.expYear !== undefined)
        {
            const yy = data.expYear.length === 4 ? data.expYear.slice(2) : data.expYear;
            this._elExp.value = `${data.expMonth.padStart(2, '0')}/${yy.padStart(2, '0')}`;
        }
        if (data.cvv !== undefined) this._elCvv.value = data.cvv;
        if (data.country !== undefined && this._elCountry) this._elCountry.value = data.country;
        if (data.zip !== undefined && this._elZip)         this._elZip.value     = data.zip;
        this._refreshPreview();
        return this;
    }

    /**
     * Trigger validation + submission programmatically. Equivalent to clicking
     * the "Pay" button.
     */
    pay(): this { this._submit(); return this; }

    /** Validate the current input. Returns null if valid, error message if not. */
    validate(): string | null
    {
        const c = this.getCard();
        if (!validateLuhn(c.number)) return 'Invalid card number';
        if (this._brand === 'unknown') return 'Unknown card brand';
        const allowed = this._get<CardBrand[]>('allowedBrands', []);
        if (allowed.length && !allowed.includes(this._brand))
            return `${this._brand} cards are not accepted`;
        if (!c.cardholder) return 'Cardholder name required';
        if (!c.expMonth || !c.expYear) return 'Expiry date required';
        const m = parseInt(c.expMonth, 10), y = parseInt(c.expYear, 10);
        if (!(m >= 1 && m <= 12)) return 'Invalid expiry month';
        const now = new Date();
        const expEnd = new Date(y, m, 0, 23, 59, 59);  // last day of expiry month
        if (expEnd < now) return 'Card has expired';
        const cvvLen = this._brand === 'amex' ? 4 : 3;
        if (c.cvv.length !== cvvLen) return `CVV must be ${cvvLen} digits`;
        return null;
    }

    // ── Build + render ─────────────────────────────────────────────────────

    protected _build(): void
    {
        const showAddress = this._get<boolean>('showAddress', true);
        const saveOption  = this._get<boolean>('saveOption', false);
        const cardholder  = this._get<string>('cardholder', '');

        this.el.innerHTML = `
<div class="ar-cc__preview" data-r="preview">
  <div class="ar-cc__preview-top">
    <span class="ar-cc__chip">▣</span>
    <span class="ar-cc__brand-logo" data-r="brand-logo">CARD</span>
  </div>
  <div class="ar-cc__preview-number" data-r="preview-number">•••• •••• •••• ••••</div>
  <div class="ar-cc__preview-bottom">
    <div>
      <div class="ar-cc__lbl">CARDHOLDER</div>
      <div class="ar-cc__preview-name" data-r="preview-name">YOUR NAME</div>
    </div>
    <div>
      <div class="ar-cc__lbl">EXPIRES</div>
      <div class="ar-cc__preview-exp" data-r="preview-exp">MM/YY</div>
    </div>
  </div>
</div>

<div class="ar-cc__form">
  <label class="ar-cc__field ar-cc__field--full">
    <span>Card number</span>
    <input data-r="number" type="text" inputmode="numeric" maxlength="23" placeholder="1234 5678 9012 3456" autocomplete="cc-number">
  </label>
  <label class="ar-cc__field ar-cc__field--full">
    <span>Cardholder</span>
    <input data-r="name" type="text" placeholder="Name on card" autocomplete="cc-name" value="${escapeHtml(cardholder)}">
  </label>
  <label class="ar-cc__field">
    <span>MM/YY</span>
    <input data-r="exp" type="text" inputmode="numeric" maxlength="5" placeholder="12/28" autocomplete="cc-exp">
  </label>
  <label class="ar-cc__field">
    <span>CVV</span>
    <input data-r="cvv" type="text" inputmode="numeric" maxlength="4" placeholder="123" autocomplete="cc-csc">
  </label>
  ${showAddress ? `
  <label class="ar-cc__field">
    <span>Country</span>
    <input data-r="country" type="text" maxlength="2" placeholder="IT" autocomplete="country">
  </label>
  <label class="ar-cc__field">
    <span>ZIP</span>
    <input data-r="zip" type="text" maxlength="10" placeholder="00100" autocomplete="postal-code">
  </label>` : ''}
  ${saveOption ? `
  <label class="ar-cc__save ar-cc__field--full">
    <input data-r="save" type="checkbox">
    <span>Save card for future purchases</span>
  </label>` : ''}
  <div class="ar-cc__error" data-r="error" style="display:none"></div>
  <button class="ar-cc__btn" data-r="btn">${this._buttonLabel()}</button>
</div>`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elPreview         = r('preview');
        this._elBrandLogo       = r('brand-logo');
        this._elPreviewNumber   = r('preview-number');
        this._elPreviewName     = r('preview-name');
        this._elPreviewExp      = r('preview-exp');
        this._elNumber          = r('number') as HTMLInputElement;
        this._elName            = r('name')   as HTMLInputElement;
        this._elExp             = r('exp')    as HTMLInputElement;
        this._elCvv             = r('cvv')    as HTMLInputElement;
        if (showAddress) {
            this._elCountry     = r('country') as HTMLInputElement;
            this._elZip         = r('zip')     as HTMLInputElement;
        }
        if (saveOption) this._elSave = r('save') as HTMLInputElement;
        this._elBtn             = r('btn')   as HTMLButtonElement;
        this._elError           = r('error');

        this._wireEvents();
    }

    private _wireEvents(): void
    {
        // Live formatting
        this._elNumber.addEventListener('input', () => {
            const raw = this._elNumber.value.replace(/\D/g, '');
            this._brand = detectBrand(raw);
            this._elNumber.value = formatCardNumber(raw, this._brand);
            // Adjust CVV maxlength based on brand
            this._elCvv.maxLength = this._brand === 'amex' ? 4 : 3;
            this._refreshPreview();
        });

        this._elName.addEventListener('input', () => this._refreshPreview());

        this._elExp.addEventListener('input', () => {
            // Auto-insert "/" after 2 digits
            const raw = this._elExp.value.replace(/\D/g, '').slice(0, 4);
            this._elExp.value = raw.length >= 3 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
            this._refreshPreview();
        });

        this._elCvv.addEventListener('input', () => {
            this._elCvv.value = this._elCvv.value.replace(/\D/g, '');
        });

        if (this._elSave) this._elSave.addEventListener('change', () => {
            this._save = this._elSave!.checked;
        });

        this._elBtn.addEventListener('click', () => this._submit());
    }

    private _submit(): void
    {
        const err = this.validate();
        if (err)
        {
            this._showError(err);
            this._emit('error', { message: err });
            return;
        }
        this._showError(null);
        this._emit('submit', { card: this.getCard() });
    }

    private _showError(msg: string | null): void
    {
        if (!msg) { this._elError.style.display = 'none'; this._elError.textContent = ''; return; }
        this._elError.style.display = '';
        this._elError.textContent = msg;
    }

    private _refreshPreview(): void
    {
        // Brand logo on the card preview
        this._elBrandLogo.textContent = brandLogoText(this._brand);
        this._elBrandLogo.className = 'ar-cc__brand-logo ar-cc__brand-logo--' + this._brand;
        this._elPreview.className = 'ar-cc__preview ar-cc__preview--' + this._brand;

        // Number — last 4 digits visible, rest masked
        const raw = this._elNumber.value.replace(/\s+/g, '');
        if (raw.length === 0)
        {
            this._elPreviewNumber.textContent = this._brand === 'amex'
                ? '•••• •••••• •••••'
                : '•••• •••• •••• ••••';
        }
        else
        {
            this._elPreviewNumber.textContent = formatCardPreview(raw, this._brand);
        }

        this._elPreviewName.textContent = (this._elName.value || 'YOUR NAME').toUpperCase().slice(0, 26);
        this._elPreviewExp.textContent  = this._elExp.value || 'MM/YY';
    }

    private _expParts(): { mm: string; yyyy: string }
    {
        const v = this._elExp.value.trim();
        const m = /^(\d{1,2})\s*\/\s*(\d{1,4})$/.exec(v);
        if (!m) return { mm: '', yyyy: '' };
        const mm = m[1]!.padStart(2, '0');
        let yy = m[2]!;
        if (yy.length === 2) yy = '20' + yy;
        return { mm, yyyy: yy };
    }

    private _buttonLabel(): string
    {
        const amount = this._get<number>('amount', 0);
        const cur    = this._get<string>('currency', 'EUR');
        const loc    = this._get<string>('locale', 'en');
        try
        {
            const fmt = new Intl.NumberFormat(loc, { style: 'currency', currency: cur });
            return `Pay ${fmt.format(amount)}`;
        }
        catch { return `Pay ${cur} ${amount.toFixed(2)}`; }
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-cc-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-cc-styles';
        s.textContent = `
.ar-cc { display:flex; flex-direction:column; gap:18px; padding:20px; background:#1e1e1e; border:1px solid #333; border-radius:8px; color:#d4d4d4; font:13px -apple-system,system-ui,sans-serif; max-width:420px; }
.ar-cc__preview { background:linear-gradient(135deg, #1f2937 0%, #111827 100%); border-radius:10px; padding:18px 20px; color:#fff; aspect-ratio:1.586; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 12px rgba(0,0,0,0.4); transition:background .25s; }
.ar-cc__preview--visa       { background:linear-gradient(135deg, #1a3d8f 0%, #0d1f4d 100%); }
.ar-cc__preview--mastercard { background:linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); }
.ar-cc__preview--amex       { background:linear-gradient(135deg, #006fcf 0%, #003e6b 100%); }
.ar-cc__preview--maestro    { background:linear-gradient(135deg, #0099df 0%, #ed1c2e 100%); }
.ar-cc__preview-top { display:flex; justify-content:space-between; align-items:center; }
.ar-cc__chip { font-size:24px; color:#facc15; }
.ar-cc__brand-logo { font:700 14px sans-serif; letter-spacing:.1em; padding:3px 10px; border-radius:3px; background:rgba(255,255,255,0.15); }
.ar-cc__brand-logo--unknown { opacity:0.4; }
.ar-cc__preview-number { font:600 19px ui-monospace,monospace; letter-spacing:.12em; }
.ar-cc__preview-bottom { display:flex; justify-content:space-between; }
.ar-cc__lbl { font:9px sans-serif; opacity:0.7; letter-spacing:.08em; }
.ar-cc__preview-name, .ar-cc__preview-exp { font:600 12px sans-serif; letter-spacing:.05em; }

.ar-cc__form { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.ar-cc__field { display:flex; flex-direction:column; gap:4px; }
.ar-cc__field--full { grid-column:1 / -1; }
.ar-cc__field span { font:10px sans-serif; color:#888; letter-spacing:.06em; text-transform:uppercase; }
.ar-cc__field input { background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:8px 10px; font:13px ui-monospace,monospace; border-radius:3px; }
.ar-cc__field input:focus { outline:none; border-color:#e40c88; }
.ar-cc__save { display:flex; align-items:center; gap:8px; font:12px sans-serif; color:#888; cursor:pointer; }
.ar-cc__error { grid-column:1 / -1; padding:8px 12px; background:rgba(220,38,38,0.15); border:1px solid #dc2626; border-radius:3px; color:#fca5a5; font-size:12px; }
.ar-cc__btn { grid-column:1 / -1; background:#e40c88; color:#fff; border:0; padding:12px; font:600 14px sans-serif; border-radius:4px; cursor:pointer; transition:background .12s; }
.ar-cc__btn:hover { background:#c30b75; }
.ar-cc__btn:disabled { background:#555; cursor:not-allowed; }
`;
        document.head.appendChild(s);
    }
}

// ── Pure helpers (exported) ─────────────────────────────────────────────────

/**
 * Detect card brand from a (possibly partial) PAN. Uses standard IIN ranges:
 *
 *   • Visa        4xxxxxxxxxxxxx{xxx}      13 / 16 / 19 digits
 *   • Mastercard  5[1-5]xxxxxxxxxxxx       16 digits
 *                 OR 2221-2720 BIN range   16 digits  (2017+ expansion)
 *   • Amex        3[47]xxxxxxxxxxxx        15 digits
 *   • Maestro     50, 56-58, 6xxxxx        12-19 digits (mostly debit EU)
 */
export function detectBrand(pan: string): CardBrand
{
    const n = pan.replace(/\D/g, '');
    if (!n) return 'unknown';

    // Visa
    if (/^4/.test(n)) return 'visa';

    // Amex
    if (/^3[47]/.test(n)) return 'amex';

    // Mastercard
    if (/^5[1-5]/.test(n)) return 'mastercard';
    // 2221-2720 expansion range
    if (/^2[2-7]/.test(n))
    {
        const four = parseInt(n.slice(0, 4), 10);
        if (n.length >= 4 && four >= 2221 && four <= 2720) return 'mastercard';
        if (n.length < 4) return 'mastercard';
    }

    // Maestro  (50, 56, 57, 58, 6) — 6 also overlaps Discover; for MVP we
    // tag it as Maestro since Discover isn't in our supported set yet.
    if (/^(50|5[6-8]|6)/.test(n)) return 'maestro';

    return 'unknown';
}

/**
 * Luhn checksum validator. Accepts a string of digits (already cleaned).
 * Returns false on empty input.
 */
export function validateLuhn(pan: string): boolean
{
    const n = pan.replace(/\D/g, '');
    if (n.length < 12) return false;
    let sum = 0, alt = false;
    for (let i = n.length - 1; i >= 0; i--)
    {
        let d = n.charCodeAt(i) - 48;       // 0-9
        if (alt)
        {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
        alt = !alt;
    }
    return sum % 10 === 0;
}

/**
 * Format the PAN with brand-appropriate spacing for input fields.
 *   Visa/MC/Maestro: 4-4-4-4
 *   Amex:            4-6-5
 */
export function formatCardNumber(pan: string, brand: CardBrand): string
{
    const n = pan.replace(/\D/g, '').slice(0, brand === 'amex' ? 15 : 19);
    if (brand === 'amex')
    {
        const a = n.slice(0, 4), b = n.slice(4, 10), c = n.slice(10, 15);
        return [a, b, c].filter(Boolean).join(' ');
    }
    return n.match(/.{1,4}/g)?.join(' ') ?? n;
}

/** Render the card-preview number with last 4 visible, rest masked. */
function formatCardPreview(pan: string, brand: CardBrand): string
{
    const last4 = pan.slice(-4).padStart(4, '•');
    if (brand === 'amex') return `•••• •••••• •${last4}`;
    return `•••• •••• •••• ${last4}`;
}

function brandLogoText(brand: CardBrand): string
{
    switch (brand)
    {
        case 'visa':       return 'VISA';
        case 'mastercard': return 'MC';
        case 'amex':       return 'AMEX';
        case 'maestro':    return 'MAESTRO';
        default:           return 'CARD';
    }
}

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}
