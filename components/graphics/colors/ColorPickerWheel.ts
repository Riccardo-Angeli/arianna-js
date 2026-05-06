/**
 * @module    components/graphics/2D/ColorPickerWheel
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Illustrator-style colour wheel: outer ring picks Hue (HSV/HSL),
 * inner square picks Saturation × Value. Wheel is rendered as an SVG
 * conic gradient using Canvas → data URL fallback for browsers without
 * `conic-gradient` SVG support.
 *
 *           ╭────────────╮
 *         ╱   ┌──────┐    ╲
 *        │   │ S × V │     │   ← inner square (saturation horizontal,
 *        │   │       │     │     value vertical)
 *         ╲   └──────┘    ╱
 *           ╰────────────╯
 *                 ↑ outer ring = hue
 *
 * Side panel exposes editable values for every supported colour space:
 *   RGB, HEX, HSL, HSV, CMYK, OKLCH, CIELUV, plus the 24-bit Cube index.
 *
 * @example
 *   import { ColorPickerWheel } from 'ariannajs/components/graphics/2D';
 *
 *   const cp = new ColorPickerWheel('#wheel', { color: '#e40c88', alpha: true });
 *   cp.on('change', e => brush.setColor(e.hex));
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';
import {
    type RGB, parseHex, rgbToHex,
    rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb,
    rgbToCmyk, rgbToCieluv, rgbToOklch, rgbToCube,
} from '../../../additionals/Colors.ts';

// ── Options ────────────────────────────────────────────────────────────────

export interface ColorPickerWheelOptions extends CtrlOptions
{
    /** Initial colour (hex). Default '#e40c88'. */
    color?  : string;
    /** Show alpha slider. Default false. */
    alpha?  : boolean;
    /** Wheel diameter in px. Default 240. */
    size?   : number;
    /** Show the readout panel. Default true. */
    readout?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export class ColorPickerWheel extends Control<ColorPickerWheelOptions>
{
    private _h = 0; private _s = 100; private _v = 100; private _a = 1;

    private _wheel!: HTMLCanvasElement;
    private _sv!   : HTMLCanvasElement;
    private _huePin!: HTMLElement;
    private _svPin! : HTMLElement;
    private _readout?: HTMLElement;

    constructor(container: string | HTMLElement | null, opts: ColorPickerWheelOptions = {})
    {
        super(container, 'div', {
            color: '#e40c88', alpha: false, size: 240, readout: true, ...opts,
        });
        this.el.className = `ar-cpw${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
        this.setColor(this._get<string>('color', '#e40c88'));
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Set the active colour from any hex / RGB-ish input. */
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

    /** Current colour in every supported space. */
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

    // ── Build / render ─────────────────────────────────────────────────────

    protected _build(): void
    {
        const size = this._get<number>('size', 240);
        this.el.innerHTML = `
<div class="ar-cpw__wheel-wrap" style="width:${size}px;height:${size}px">
  <canvas class="ar-cpw__wheel" data-r="wheel" width="${size}" height="${size}"></canvas>
  <canvas class="ar-cpw__sv"    data-r="sv"    width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}"></canvas>
  <div class="ar-cpw__hue-pin" data-r="hue-pin"></div>
  <div class="ar-cpw__sv-pin"  data-r="sv-pin"></div>
</div>
${this._get<boolean>('readout', true) ? `<div class="ar-cpw__readout" data-r="readout"></div>` : ''}`;

        this._wheel  = this.el.querySelector<HTMLCanvasElement>('[data-r="wheel"]')!;
        this._sv     = this.el.querySelector<HTMLCanvasElement>('[data-r="sv"]')!;
        this._huePin = this.el.querySelector<HTMLElement>('[data-r="hue-pin"]')!;
        this._svPin  = this.el.querySelector<HTMLElement>('[data-r="sv-pin"]')!;
        this._readout = this.el.querySelector<HTMLElement>('[data-r="readout"]') ?? undefined;

        this._drawWheel();
        this._wireHue();
        this._wireSv();
    }

    private _drawWheel(): void
    {
        const ctx = this._wheel.getContext('2d');
        if (!ctx) return;
        const size = this._wheel.width;
        const cx = size / 2, cy = size / 2;
        const ro = size / 2;
        const ri = size / 2 - Math.max(18, size * 0.14);

        // Hue ring via per-pixel sweep (works without conic-gradient)
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++)
        {
            for (let x = 0; x < size; x++)
            {
                const dx = x - cx, dy = y - cy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > ro || d < ri) continue;
                const ang = Math.atan2(dy, dx) * 180 / Math.PI;
                const hue = ((ang + 90) + 360) % 360;
                const rgb = hsvToRgb({ h: hue, s: 100, v: 100 });
                const i = (y * size + x) * 4;
                img.data[i]   = rgb.r;
                img.data[i+1] = rgb.g;
                img.data[i+2] = rgb.b;
                img.data[i+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);

        // Position SV square inside the ring
        const svSize = this._sv.width;
        const half = svSize / 2;
        this._sv.style.left = `${cx - half}px`;
        this._sv.style.top  = `${cy - half}px`;
    }

    private _drawSv(): void
    {
        const ctx = this._sv.getContext('2d');
        if (!ctx) return;
        const w = this._sv.width, h = this._sv.height;
        // s on x (0→100), v on y (100→0 going down)
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

    private _wireHue(): void
    {
        const handle = (e: PointerEvent) => {
            const rect = this._wheel.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const ang = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
            this._h = ((ang + 90) + 360) % 360;
            this._refresh();
        };
        this._wheel.addEventListener('pointerdown', e => {
            this._wheel.setPointerCapture?.(e.pointerId);
            handle(e);
        });
        this._wheel.addEventListener('pointermove', e => {
            if (e.buttons) handle(e);
        });
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
        this._sv.addEventListener('pointermove', e => {
            if (e.buttons) handle(e);
        });
    }

    private _refresh(): void
    {
        // SV repaint (changes when hue changes)
        this._drawSv();

        const size = this._wheel.width;
        const cx = size / 2, cy = size / 2;
        const ringRadius = size / 2 - Math.max(9, size * 0.07);
        const ang = (this._h - 90) * Math.PI / 180;
        const hx = cx + Math.cos(ang) * ringRadius;
        const hy = cy + Math.sin(ang) * ringRadius;
        this._huePin.style.left = `${hx}px`;
        this._huePin.style.top  = `${hy}px`;

        const svRect = this._sv.getBoundingClientRect();
        const wheelRect = this._wheel.getBoundingClientRect();
        const offX = svRect.left - wheelRect.left;
        const offY = svRect.top  - wheelRect.top;
        const sx = offX + (this._s / 100) * this._sv.width;
        const sy = offY + (1 - this._v / 100) * this._sv.height;
        this._svPin.style.left = `${sx}px`;
        this._svPin.style.top  = `${sy}px`;

        // Pin colour for contrast
        const rgb = hsvToRgb({ h: this._h, s: this._s, v: this._v });
        this._svPin.style.background = rgbToHex(rgb);

        if (this._readout) this._renderReadout();
        this._emit('change', this.getColor());
    }

    private _renderReadout(): void
    {
        if (!this._readout) return;
        const c = this.getColor();
        this._readout.innerHTML = `
<div class="ar-cpw__row"><span>HEX</span><code>${c.hex}</code></div>
<div class="ar-cpw__row"><span>RGB</span><code>${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b}</code></div>
<div class="ar-cpw__row"><span>HSL</span><code>${c.hsl.h.toFixed(0)}°, ${c.hsl.s.toFixed(0)}%, ${c.hsl.l.toFixed(0)}%</code></div>
<div class="ar-cpw__row"><span>HSV</span><code>${c.hsv.h.toFixed(0)}°, ${c.hsv.s.toFixed(0)}%, ${c.hsv.v.toFixed(0)}%</code></div>
<div class="ar-cpw__row"><span>CMYK</span><code>${c.cmyk.c.toFixed(0)}, ${c.cmyk.m.toFixed(0)}, ${c.cmyk.y.toFixed(0)}, ${c.cmyk.k.toFixed(0)}</code></div>
<div class="ar-cpw__row"><span>OKLCH</span><code>${(c.oklch.L*100).toFixed(1)}% ${c.oklch.C.toFixed(3)} ${c.oklch.h.toFixed(0)}°</code></div>
<div class="ar-cpw__row"><span>CIELUV</span><code>${c.cieluv.L.toFixed(1)} ${c.cieluv.C.toFixed(1)} ${c.cieluv.h.toFixed(0)}°</code></div>
<div class="ar-cpw__row"><span>Cube</span><code>${c.cube}</code></div>`;
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-cpw-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-cpw-styles';
        s.textContent = `
.ar-cpw { display:inline-flex; gap:14px; padding:14px; background:#1e1e1e; border:1px solid #333; border-radius:8px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; }
.ar-cpw__wheel-wrap { position:relative; flex:none; }
.ar-cpw__wheel { display:block; cursor:crosshair; border-radius:50%; }
.ar-cpw__sv    { position:absolute; cursor:crosshair; }
.ar-cpw__hue-pin, .ar-cpw__sv-pin { position:absolute; width:12px; height:12px; margin:-6px 0 0 -6px; border:2px solid #fff; border-radius:50%; pointer-events:none; box-shadow:0 0 0 1px rgba(0,0,0,0.6); }
.ar-cpw__readout { display:flex; flex-direction:column; gap:4px; min-width:220px; }
.ar-cpw__row { display:flex; gap:8px; padding:4px 8px; background:#0d0d0d; border-radius:3px; align-items:center; }
.ar-cpw__row span { width:50px; font:10px sans-serif; color:#888; text-transform:uppercase; }
.ar-cpw__row code { font:11px ui-monospace,monospace; color:#d4d4d4; flex:1; }
`;
        document.head.appendChild(s);
    }
}
