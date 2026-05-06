/**
 * @module    ColorPicker
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * HSL + RGB integrated colour picker. The classic SV square + hue strip +
 * inputs for both HSL (H/S/L) and RGB (R/G/B), with hex display. All four
 * representations stay in sync — editing any one updates the others.
 *
 * Designed to drop into the Illustrator-style palette of the Wires/Daedalus
 * vector editors but works standalone.
 *
 *   ┌─────────────────┐  ┌──┐
 *   │      SV         │  │H │
 *   │     square      │  │U │
 *   │                 │  │E │
 *   │                 │  │  │
 *   └─────────────────┘  └──┘
 *
 *   #e40c88
 *   R [228]  G [12]   B [136]
 *   H [325]  S [90%]  L [47%]
 *   A [1.0]
 *
 * @example
 *   import { ColorPicker } from 'ariannajs/components/gfx2d';
 *
 *   const pick = new ColorPicker('#palette', { color: '#e40c88' });
 *   pick.on('change', e => element.style.fill = e.hex);
 *
 *   // Programmatic
 *   pick.setColor('#3b82f6');
 *   pick.setColor({ h: 217, s: 91, l: 60 });
 *   pick.setColor({ r: 59, g: 130, b: 246 });
 *
 *   const c = pick.getColor();   // { hex, r, g, b, h, s, l, a }
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RGB { r: number; g: number; b: number; }   // 0..255
export interface HSL { h: number; s: number; l: number; }   // h 0..360, s/l 0..100
export interface Color extends RGB, HSL { hex: string; a: number; }

export interface ColorPickerOptions extends CtrlOptions {
    /** Initial colour as hex / RGB object / HSL object. Default '#e40c88'. */
    color?    : string | Partial<RGB> | Partial<HSL>;
    /** Show alpha slider. Default false. */
    alpha?    : boolean;
    /** Show hex input. Default true. */
    showHex?  : boolean;
    /** Show RGB inputs. Default true. */
    showRGB?  : boolean;
    /** Show HSL inputs. Default true. */
    showHSL?  : boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export class ColorPicker extends Control<ColorPickerOptions>
{
    // Canonical state — always store HSL, derive RGB/hex on demand
    private _h: number = 325;     // hue 0..360
    private _s: number = 90;      // saturation 0..100
    private _l: number = 47;      // lightness 0..100
    private _a: number = 1;       // alpha 0..1

    // DOM refs
    private _elSv!      : HTMLElement;
    private _elSvDot!   : HTMLElement;
    private _elHue!     : HTMLElement;
    private _elHueDot!  : HTMLElement;
    private _elHex?     : HTMLInputElement;
    private _elR?       : HTMLInputElement;
    private _elG?       : HTMLInputElement;
    private _elB?       : HTMLInputElement;
    private _elHi?      : HTMLInputElement;
    private _elSi?      : HTMLInputElement;
    private _elLi?      : HTMLInputElement;
    private _elAlpha?   : HTMLInputElement;
    private _elPreview! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: ColorPickerOptions = {})
    {
        super(container, 'div', {
            color   : '#e40c88',
            alpha   : false,
            showHex : true,
            showRGB : true,
            showHSL : true,
            ...opts,
        });

        this.el.className = `ar-colorpicker${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
        this.setColor(this._get<string | Partial<RGB> | Partial<HSL>>('color', '#e40c88'));
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Get the current colour in all four representations + alpha.
     */
    getColor(): Color
    {
        const rgb = hslToRgb(this._h, this._s, this._l);
        return {
            hex: rgbToHex(rgb.r, rgb.g, rgb.b),
            r: rgb.r, g: rgb.g, b: rgb.b,
            h: this._h, s: this._s, l: this._l,
            a: this._a,
        };
    }

    /**
     * Set the current colour. Accepts a hex string, an RGB object, an HSL
     * object, or a plain `{ a }` to update only alpha. Missing channels are
     * preserved from the current state.
     */
    setColor(c: string | Partial<RGB> | Partial<HSL> | { a?: number }): this
    {
        if (typeof c === 'string')
        {
            const parsed = parseHex(c);
            if (parsed)
            {
                const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
                this._h = hsl.h; this._s = hsl.s; this._l = hsl.l;
            }
        }
        else if (c)
        {
            // RGB object?
            if ('r' in c || 'g' in c || 'b' in c)
            {
                const cur = hslToRgb(this._h, this._s, this._l);
                const r = Math.max(0, Math.min(255, Math.round((c as RGB).r ?? cur.r)));
                const g = Math.max(0, Math.min(255, Math.round((c as RGB).g ?? cur.g)));
                const b = Math.max(0, Math.min(255, Math.round((c as RGB).b ?? cur.b)));
                const hsl = rgbToHsl(r, g, b);
                this._h = hsl.h; this._s = hsl.s; this._l = hsl.l;
            }
            // HSL object?
            else if ('h' in c || 's' in c || 'l' in c)
            {
                if ('h' in c) this._h = ((c.h as number) % 360 + 360) % 360;
                if ('s' in c) this._s = Math.max(0, Math.min(100, c.s as number));
                if ('l' in c) this._l = Math.max(0, Math.min(100, c.l as number));
            }
            // Alpha-only object
            if ('a' in c && typeof c.a === 'number')
                this._a = Math.max(0, Math.min(1, c.a));
        }

        this._refresh();
        this._emitChange();
        return this;
    }

    // ── Internal: build UI ─────────────────────────────────────────────────

    protected _build(): void
    {
        const showHex = this._get<boolean>('showHex', true);
        const showRGB = this._get<boolean>('showRGB', true);
        const showHSL = this._get<boolean>('showHSL', true);
        const alpha   = this._get<boolean>('alpha',   false);

        this.el.innerHTML = `
<div class="ar-colorpicker__top">
  <div class="ar-colorpicker__sv"  data-r="sv">
    <div class="ar-colorpicker__sv-dot" data-r="svDot"></div>
  </div>
  <div class="ar-colorpicker__hue" data-r="hue">
    <div class="ar-colorpicker__hue-dot" data-r="hueDot"></div>
  </div>
</div>
<div class="ar-colorpicker__row">
  <div class="ar-colorpicker__preview" data-r="preview"></div>
  ${showHex ? `<input class="ar-colorpicker__inp ar-colorpicker__inp--hex" data-r="hex" type="text" maxlength="9" value="">` : ''}
</div>
${showRGB ? `
<div class="ar-colorpicker__row">
  <label>R</label><input class="ar-colorpicker__inp" data-r="r" type="number" min="0" max="255">
  <label>G</label><input class="ar-colorpicker__inp" data-r="g" type="number" min="0" max="255">
  <label>B</label><input class="ar-colorpicker__inp" data-r="b" type="number" min="0" max="255">
</div>` : ''}
${showHSL ? `
<div class="ar-colorpicker__row">
  <label>H</label><input class="ar-colorpicker__inp" data-r="hi" type="number" min="0" max="360">
  <label>S</label><input class="ar-colorpicker__inp" data-r="si" type="number" min="0" max="100">
  <label>L</label><input class="ar-colorpicker__inp" data-r="li" type="number" min="0" max="100">
</div>` : ''}
${alpha ? `
<div class="ar-colorpicker__row ar-colorpicker__row--alpha">
  <label>A</label><input class="ar-colorpicker__alpha" data-r="alpha" type="range" min="0" max="1" step="0.01" value="1">
</div>` : ''}`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`);
        this._elSv      = r('sv')!;
        this._elSvDot   = r('svDot')!;
        this._elHue     = r('hue')!;
        this._elHueDot  = r('hueDot')!;
        this._elPreview = r('preview')!;
        if (showHex) this._elHex   = r('hex')   as HTMLInputElement;
        if (showRGB) {
            this._elR = r('r') as HTMLInputElement;
            this._elG = r('g') as HTMLInputElement;
            this._elB = r('b') as HTMLInputElement;
        }
        if (showHSL) {
            this._elHi = r('hi') as HTMLInputElement;
            this._elSi = r('si') as HTMLInputElement;
            this._elLi = r('li') as HTMLInputElement;
        }
        if (alpha) this._elAlpha = r('alpha') as HTMLInputElement;

        this._wireSV();
        this._wireHue();
        this._wireInputs();
    }

    private _wireSV(): void
    {
        const updateFromEvent = (ev: PointerEvent) => {
            const rect = this._elSv.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width,  ev.clientX - rect.left));
            const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
            this._s = (x / rect.width)  * 100;
            this._l = (1 - y / rect.height) * 100;
            // Keep saturation→lightness convention of the SV square: top-right
            // means full-saturation primary; bottom-right = black; top-left = white.
            // We map: x = saturation, y = (1-lightness) but corrected to match
            // common picker behaviour (top = bright, bottom = dark).
            this._refresh(); this._emitChange();
        };
        this._elSv.addEventListener('pointerdown', e => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            updateFromEvent(e);
            const move = (ev: PointerEvent) => updateFromEvent(ev);
            const up = () => {
                this._elSv.removeEventListener('pointermove', move);
                this._elSv.removeEventListener('pointerup',   up);
            };
            this._elSv.addEventListener('pointermove', move);
            this._elSv.addEventListener('pointerup',   up);
        });
    }

    private _wireHue(): void
    {
        const updateFromEvent = (ev: PointerEvent) => {
            const rect = this._elHue.getBoundingClientRect();
            const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top));
            this._h = (y / rect.height) * 360;
            this._refresh(); this._emitChange();
        };
        this._elHue.addEventListener('pointerdown', e => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            updateFromEvent(e);
            const move = (ev: PointerEvent) => updateFromEvent(ev);
            const up = () => {
                this._elHue.removeEventListener('pointermove', move);
                this._elHue.removeEventListener('pointerup',   up);
            };
            this._elHue.addEventListener('pointermove', move);
            this._elHue.addEventListener('pointerup',   up);
        });
    }

    private _wireInputs(): void
    {
        if (this._elHex) this._elHex.addEventListener('change', () => {
            const v = this._elHex!.value.trim();
            if (parseHex(v)) this.setColor(v);
        });
        const onRgb = () => {
            const r = parseInt(this._elR!.value, 10) || 0;
            const g = parseInt(this._elG!.value, 10) || 0;
            const b = parseInt(this._elB!.value, 10) || 0;
            this.setColor({ r, g, b });
        };
        if (this._elR) this._elR.addEventListener('change', onRgb);
        if (this._elG) this._elG.addEventListener('change', onRgb);
        if (this._elB) this._elB.addEventListener('change', onRgb);
        const onHsl = () => {
            const h = parseInt(this._elHi!.value, 10) || 0;
            const s = parseInt(this._elSi!.value, 10) || 0;
            const l = parseInt(this._elLi!.value, 10) || 0;
            this.setColor({ h, s, l });
        };
        if (this._elHi) this._elHi.addEventListener('change', onHsl);
        if (this._elSi) this._elSi.addEventListener('change', onHsl);
        if (this._elLi) this._elLi.addEventListener('change', onHsl);
        if (this._elAlpha) this._elAlpha.addEventListener('input', () => {
            this._a = parseFloat(this._elAlpha!.value);
            this._refresh(); this._emitChange();
        });
    }

    /** Refresh the entire UI to reflect _h/_s/_l/_a state. */
    private _refresh(): void
    {
        const c = this.getColor();

        // SV square background = pure hue with saturation+lightness gradients
        this._elSv.style.background =
            `linear-gradient(to top,    rgba(0,0,0,1),  rgba(0,0,0,0)),
             linear-gradient(to right,  rgba(255,255,255,1), rgba(255,255,255,0)),
             hsl(${this._h}, 100%, 50%)`;
        // Dot position
        const px = this._s, py = 100 - this._l;
        this._elSvDot.style.left = px + '%';
        this._elSvDot.style.top  = py + '%';

        // Hue strip dot
        this._elHueDot.style.top = (this._h / 360 * 100) + '%';

        // Inputs
        if (this._elHex) this._elHex.value = c.hex;
        if (this._elR)   this._elR.value   = String(c.r);
        if (this._elG)   this._elG.value   = String(c.g);
        if (this._elB)   this._elB.value   = String(c.b);
        if (this._elHi)  this._elHi.value  = String(Math.round(c.h));
        if (this._elSi)  this._elSi.value  = String(Math.round(c.s));
        if (this._elLi)  this._elLi.value  = String(Math.round(c.l));

        // Preview
        const previewBg = this._a < 1 ? `rgba(${c.r},${c.g},${c.b},${this._a})` : c.hex;
        this._elPreview.style.background = previewBg;
    }

    private _emitChange(): void { this._emit('change', this.getColor()); }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-colorpicker-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-colorpicker-styles';
        s.textContent = `
.ar-colorpicker { display:inline-flex; flex-direction:column; gap:8px; padding:10px; background:#1e1e1e; border:1px solid #333; border-radius:6px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; user-select:none; width:240px; }
.ar-colorpicker__top { display:flex; gap:8px; align-items:stretch; }
.ar-colorpicker__sv  { position:relative; flex:1; height:150px; border-radius:3px; cursor:crosshair; overflow:hidden; }
.ar-colorpicker__sv-dot { position:absolute; width:12px; height:12px; border:2px solid #fff; border-radius:50%; box-shadow:0 0 2px rgba(0,0,0,0.7); transform:translate(-50%, -50%); pointer-events:none; }
.ar-colorpicker__hue { position:relative; width:18px; height:150px; border-radius:3px; cursor:ns-resize; overflow:hidden;
    background:linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%); }
.ar-colorpicker__hue-dot { position:absolute; left:0; right:0; height:2px; background:#fff; box-shadow:0 0 2px rgba(0,0,0,0.7); transform:translateY(-50%); pointer-events:none; }
.ar-colorpicker__row { display:flex; gap:6px; align-items:center; }
.ar-colorpicker__row label { font:10px ui-monospace,monospace; color:#888; min-width:8px; text-align:right; }
.ar-colorpicker__inp { flex:1; min-width:0; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:3px 6px; font:11px ui-monospace,monospace; border-radius:3px; }
.ar-colorpicker__inp--hex { font:12px ui-monospace,monospace; text-align:center; }
.ar-colorpicker__preview { width:24px; height:24px; border:1px solid #333; border-radius:3px; flex-shrink:0;
    background-image:linear-gradient(45deg,#888 25%,transparent 25%),linear-gradient(-45deg,#888 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#888 75%),linear-gradient(-45deg,transparent 75%,#888 75%);
    background-size:8px 8px; background-position:0 0,0 4px,4px -4px,-4px 0px; }
.ar-colorpicker__alpha { flex:1; -webkit-appearance:none; height:14px; border-radius:2px; background:linear-gradient(to right, transparent, #fff); border:1px solid #333; cursor:pointer; }
`;
        document.head.appendChild(s);
    }
}

// ── Pure conversion helpers (exported for testing) ──────────────────────────

/**
 * Parse a hex colour string in any common form: #rgb, #rrggbb, #rrggbbaa.
 * Returns null on invalid input. Alpha defaults to 1 if omitted.
 */
export function parseHex(s: string): { r: number; g: number; b: number; a: number } | null
{
    if (!s) return null;
    let h = s.trim().toLowerCase();
    if (h.startsWith('#')) h = h.slice(1);
    if (/^[0-9a-f]{3}$/.test(h))
    {
        const r = parseInt(h[0]! + h[0], 16);
        const g = parseInt(h[1]! + h[1], 16);
        const b = parseInt(h[2]! + h[2], 16);
        return { r, g, b, a: 1 };
    }
    if (/^[0-9a-f]{6}$/.test(h))
    {
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    if (/^[0-9a-f]{8}$/.test(h))
    {
        return {
            r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255,
        };
    }
    return null;
}

export function rgbToHex(r: number, g: number, b: number): string
{
    const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
}

/** Convert RGB (0..255) to HSL (h 0..360, s/l 0..100). */
export function rgbToHsl(r: number, g: number, b: number): HSL
{
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min)
    {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max)
        {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2;               break;
            case b: h = (r - g) / d + 4;               break;
        }
        h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
}

/** Convert HSL (h 0..360, s/l 0..100) to RGB (0..255). */
export function hslToRgb(h: number, s: number, l: number): RGB
{
    h = ((h % 360) + 360) % 360 / 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    let r: number, g: number, b: number;
    if (s === 0) { r = g = b = l; }
    else
    {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
