/**
 * @module    components/graphics/2D/ColorPickerSquare
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Photoshop-style colour picker: large square for Saturation × Value,
 * vertical hue strip on the right, optional alpha strip below the hue,
 * and full numeric readouts for every supported colour space:
 *
 *   ┌────────────────┬────┐
 *   │                │ │  │
 *   │   S × V        │ H  │
 *   │   square       │ u  │
 *   │                │ e  │
 *   │                │ │  │
 *   └────────────────┼────┤
 *                    │ α  │
 *                    └────┘
 *
 *   ┌─────────────────────┐
 *   │ HEX  [#e40c88     ] │
 *   │ RGB  [228] [12] [136]│
 *   │ HSL  [328] [90] [47]│
 *   │ HSV  …              │
 *   │ CMYK …              │
 *   │ OKLCH/CIELUV …      │
 *   └─────────────────────┘
 *
 * @example
 *   import { ColorPickerSquare } from 'ariannajs/components/graphics/2D';
 *
 *   const cp = new ColorPickerSquare('#picker', { color: '#e40c88', alpha: true });
 *   cp.on('change', e => fill.set(e.hex));
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';
import {
    type RGB, parseHex, rgbToHex,
    rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb,
    rgbToCmyk, cmykToRgb,
    rgbToCieluv, cieluvToRgb,
    rgbToOklch,  oklchToRgb,
    rgbToCube,
} from '../../../additionals/Colors.ts';

// ── Options ────────────────────────────────────────────────────────────────

export interface ColorPickerSquareOptions extends CtrlOptions
{
    /** Initial colour (hex). Default '#e40c88'. */
    color?  : string;
    /** Show alpha strip + alpha input. Default false. */
    alpha?  : boolean;
    /** Square side in px. Default 220. */
    size?   : number;
}

// ── Component ──────────────────────────────────────────────────────────────

export class ColorPickerSquare extends Control<ColorPickerSquareOptions>
{
    private _h = 0; private _s = 100; private _v = 100; private _a = 1;

    private _sv!     : HTMLCanvasElement;
    private _hue!    : HTMLCanvasElement;
    private _alpha?  : HTMLCanvasElement;
    private _svPin!  : HTMLElement;
    private _huePin! : HTMLElement;
    private _alphaPin?: HTMLElement;
    private _readout!: HTMLElement;

    constructor(container: string | HTMLElement | null, opts: ColorPickerSquareOptions = {})
    {
        super(container, 'div', { color: '#e40c88', alpha: false, size: 220, ...opts });
        this.el.className = `ar-cps${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
        this.setColor(this._get<string>('color', '#e40c88'));
    }

    setColor(hex: string): this
    {
        const rgb = parseHex(hex);
        if (!rgb) return this;
        const hsv = rgbToHsv(rgb);
        this._h = hsv.h; this._s = hsv.s; this._v = hsv.v;
        if (rgb.a !== undefined) this._a = rgb.a;
        this._refresh();
        return this;
    }

    getColor()
    {
        const rgb = hsvToRgb({ h: this._h, s: this._s, v: this._v, a: this._a });
        return {
            rgb,
            hex   : rgbToHex(rgb),
            hsl   : rgbToHsl(rgb),
            hsv   : { h: this._h, s: this._s, v: this._v, a: this._a },
            cmyk  : rgbToCmyk(rgb),
            cieluv: rgbToCieluv(rgb),
            oklch : rgbToOklch(rgb),
            cube  : rgbToCube(rgb),
        };
    }

    protected _build(): void
    {
        const size = this._get<number>('size', 220);
        const showAlpha = this._get<boolean>('alpha', false);

        this.el.innerHTML = `
<div class="ar-cps__main">
  <div class="ar-cps__sv-wrap" style="width:${size}px;height:${size}px">
    <canvas class="ar-cps__sv" data-r="sv" width="${size}" height="${size}"></canvas>
    <div class="ar-cps__sv-pin" data-r="sv-pin"></div>
  </div>
  <div class="ar-cps__strips">
    <div class="ar-cps__hue-wrap" style="height:${size}px">
      <canvas class="ar-cps__hue" data-r="hue" width="18" height="${size}"></canvas>
      <div class="ar-cps__hue-pin" data-r="hue-pin"></div>
    </div>
    ${showAlpha ? `
    <div class="ar-cps__alpha-wrap" style="height:${size}px">
      <canvas class="ar-cps__alpha" data-r="alpha" width="18" height="${size}"></canvas>
      <div class="ar-cps__alpha-pin" data-r="alpha-pin"></div>
    </div>` : ''}
  </div>
</div>
<div class="ar-cps__readout" data-r="readout"></div>`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`);
        this._sv     = r('sv') as HTMLCanvasElement;
        this._hue    = r('hue') as HTMLCanvasElement;
        this._svPin  = r('sv-pin')!;
        this._huePin = r('hue-pin')!;
        if (showAlpha)
        {
            this._alpha    = r('alpha') as HTMLCanvasElement;
            this._alphaPin = r('alpha-pin')!;
        }
        this._readout = r('readout')!;

        this._drawHue();
        this._wireSv();
        this._wireHue();
        if (showAlpha) this._wireAlpha();
    }

    private _drawHue(): void
    {
        const ctx = this._hue.getContext('2d');
        if (!ctx) return;
        const h = this._hue.height;
        for (let y = 0; y < h; y++)
        {
            const hue = (y / h) * 360;
            const rgb = hsvToRgb({ h: hue, s: 100, v: 100 });
            ctx.fillStyle = rgbToHex(rgb);
            ctx.fillRect(0, y, this._hue.width, 1);
        }
    }

    private _drawSv(): void
    {
        const ctx = this._sv.getContext('2d');
        if (!ctx) return;
        const w = this._sv.width, h = this._sv.height;
        const img = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++)
        {
            for (let x = 0; x < w; x++)
            {
                const s = (x / (w - 1)) * 100;
                const v = (1 - y / (h - 1)) * 100;
                const rgb = hsvToRgb({ h: this._h, s, v });
                const i = (y * w + x) * 4;
                img.data[i]   = rgb.r;
                img.data[i+1] = rgb.g;
                img.data[i+2] = rgb.b;
                img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    private _drawAlpha(): void
    {
        if (!this._alpha) return;
        const ctx = this._alpha.getContext('2d');
        if (!ctx) return;
        const w = this._alpha.width, h = this._alpha.height;
        // Checkerboard background
        const cs = 6;
        for (let y = 0; y < h; y += cs)
            for (let x = 0; x < w; x += cs)
            {
                ctx.fillStyle = ((x / cs + y / cs) & 1) ? '#444' : '#888';
                ctx.fillRect(x, y, cs, cs);
            }
        // Vertical alpha gradient using current colour
        const rgb = hsvToRgb({ h: this._h, s: this._s, v: this._v });
        for (let y = 0; y < h; y++)
        {
            ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${1 - y / h})`;
            ctx.fillRect(0, y, w, 1);
        }
    }

    private _wireSv(): void
    {
        const handle = (e: PointerEvent) => {
            const rect = this._sv.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top)  / rect.height;
            this._s = Math.max(0, Math.min(100, x * 100));
            this._v = Math.max(0, Math.min(100, (1 - y) * 100));
            this._refresh();
        };
        this._sv.addEventListener('pointerdown', e => {
            this._sv.setPointerCapture?.(e.pointerId);
            handle(e);
        });
        this._sv.addEventListener('pointermove', e => { if (e.buttons) handle(e); });
    }

    private _wireHue(): void
    {
        const handle = (e: PointerEvent) => {
            const rect = this._hue.getBoundingClientRect();
            const y = (e.clientY - rect.top) / rect.height;
            this._h = Math.max(0, Math.min(360, y * 360));
            this._refresh();
        };
        this._hue.addEventListener('pointerdown', e => {
            this._hue.setPointerCapture?.(e.pointerId);
            handle(e);
        });
        this._hue.addEventListener('pointermove', e => { if (e.buttons) handle(e); });
    }

    private _wireAlpha(): void
    {
        if (!this._alpha) return;
        const handle = (e: PointerEvent) => {
            const rect = this._alpha!.getBoundingClientRect();
            const y = (e.clientY - rect.top) / rect.height;
            this._a = Math.max(0, Math.min(1, 1 - y));
            this._refresh();
        };
        this._alpha.addEventListener('pointerdown', e => {
            this._alpha!.setPointerCapture?.(e.pointerId);
            handle(e);
        });
        this._alpha.addEventListener('pointermove', e => { if (e.buttons) handle(e); });
    }

    private _refresh(): void
    {
        this._drawSv();
        this._drawAlpha();

        // Pin positions
        const svRect = this._sv.getBoundingClientRect();
        const svParent = this._svPin.parentElement!.getBoundingClientRect();
        const sx = (svRect.left - svParent.left) + (this._s / 100) * this._sv.width;
        const sy = (svRect.top  - svParent.top)  + (1 - this._v / 100) * this._sv.height;
        this._svPin.style.left = `${sx}px`;
        this._svPin.style.top  = `${sy}px`;
        this._svPin.style.background = rgbToHex(hsvToRgb({ h: this._h, s: this._s, v: this._v }));

        const hy = (this._h / 360) * this._hue.height;
        this._huePin.style.top = `${hy}px`;

        if (this._alpha && this._alphaPin)
        {
            this._alphaPin.style.top = `${(1 - this._a) * this._alpha.height}px`;
        }

        this._renderReadout();
        this._emit('change', this.getColor());
    }

    private _renderReadout(): void
    {
        const c = this.getColor();
        this._readout.innerHTML = `
<label class="ar-cps__line"><span>HEX</span>   <input data-edit="hex"  value="${c.hex}"></label>
<label class="ar-cps__line"><span>RGB</span>   <input data-edit="rgb"  value="${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b}"></label>
<label class="ar-cps__line"><span>HSL</span>   <input data-edit="hsl"  value="${c.hsl.h.toFixed(0)}, ${c.hsl.s.toFixed(0)}%, ${c.hsl.l.toFixed(0)}%"></label>
<label class="ar-cps__line"><span>HSV</span>   <input data-edit="hsv"  value="${c.hsv.h.toFixed(0)}, ${c.hsv.s.toFixed(0)}%, ${(c.hsv.v ?? 0).toFixed(0)}%"></label>
<label class="ar-cps__line"><span>CMYK</span>  <input data-edit="cmyk" value="${c.cmyk.c.toFixed(0)}, ${c.cmyk.m.toFixed(0)}, ${c.cmyk.y.toFixed(0)}, ${c.cmyk.k.toFixed(0)}"></label>
<label class="ar-cps__line"><span>OKLCH</span> <input data-edit="oklch" value="${(c.oklch.L*100).toFixed(1)}% ${c.oklch.C.toFixed(3)} ${c.oklch.h.toFixed(0)}"></label>
<label class="ar-cps__line"><span>LUV</span>   <input data-edit="luv"  value="${c.cieluv.L.toFixed(1)} ${c.cieluv.C.toFixed(1)} ${c.cieluv.h.toFixed(0)}"></label>
<label class="ar-cps__line"><span>Cube</span>  <code>${c.cube}</code></label>`;
        this._wireReadout();
    }

    private _wireReadout(): void
    {
        const inputs = this._readout.querySelectorAll<HTMLInputElement>('input[data-edit]');
        inputs.forEach(inp => {
            inp.addEventListener('change', () => this._handleEdit(inp.dataset.edit!, inp.value));
        });
    }

    private _handleEdit(field: string, value: string): void
    {
        const nums = value.split(/[\s,%]+/).filter(Boolean).map(Number);
        let rgb: RGB | null = null;
        switch (field)
        {
            case 'hex' : rgb = parseHex(value); break;
            case 'rgb' :
                if (nums.length >= 3) rgb = { r: nums[0]!, g: nums[1]!, b: nums[2]! };
                break;
            case 'hsl' :
                if (nums.length >= 3) rgb = hslToRgb({ h: nums[0]!, s: nums[1]!, l: nums[2]! });
                break;
            case 'hsv' :
                if (nums.length >= 3) rgb = hsvToRgb({ h: nums[0]!, s: nums[1]!, v: nums[2]! });
                break;
            case 'cmyk':
                if (nums.length >= 4) rgb = cmykToRgb({ c: nums[0]!, m: nums[1]!, y: nums[2]!, k: nums[3]! });
                break;
            case 'oklch':
                if (nums.length >= 3) rgb = oklchToRgb({ L: nums[0]! / 100, C: nums[1]!, h: nums[2]! });
                break;
            case 'luv':
                if (nums.length >= 3) rgb = cieluvToRgb({ L: nums[0]!, C: nums[1]!, h: nums[2]! });
                break;
        }
        if (rgb)
        {
            const hsv = rgbToHsv(rgb);
            this._h = hsv.h; this._s = hsv.s; this._v = hsv.v;
            this._refresh();
        }
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-cps-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-cps-styles';
        s.textContent = `
.ar-cps { display:inline-flex; gap:14px; padding:14px; background:#1e1e1e; border:1px solid #333; border-radius:8px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; }
.ar-cps__main { display:flex; gap:10px; }
.ar-cps__sv-wrap, .ar-cps__hue-wrap, .ar-cps__alpha-wrap { position:relative; }
.ar-cps__sv, .ar-cps__hue, .ar-cps__alpha { display:block; cursor:crosshair; border-radius:3px; }
.ar-cps__sv-pin   { position:absolute; width:12px; height:12px; margin:-6px 0 0 -6px; border:2px solid #fff; border-radius:50%; pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,0.6); }
.ar-cps__hue-pin, .ar-cps__alpha-pin { position:absolute; left:0; right:0; height:3px; margin-top:-1px; background:#fff; pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,0.6); }
.ar-cps__strips { display:flex; gap:6px; }
.ar-cps__readout { display:flex; flex-direction:column; gap:3px; min-width:240px; }
.ar-cps__line { display:flex; gap:6px; align-items:center; }
.ar-cps__line span { width:50px; font:10px sans-serif; color:#888; text-transform:uppercase; }
.ar-cps__line input { flex:1; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:4px 6px; font:11px ui-monospace,monospace; border-radius:2px; }
.ar-cps__line input:focus { outline:none; border-color:#e40c88; }
.ar-cps__line code { flex:1; font:11px ui-monospace,monospace; color:#888; padding:4px 6px; }
`;
        document.head.appendChild(s);
    }
}
