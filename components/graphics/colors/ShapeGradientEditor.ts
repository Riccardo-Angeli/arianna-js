/**
 * @module    components/graphics/2D/ShapeGradientEditor
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Illustrator-style "freeform shape" gradient editor — the third member of
 * the gradient-editor trio alongside `LinearGradientEditor` and
 * `RadialGradientEditor`. Instead of a single stop axis, the user places
 * arbitrary 2D **control points**, each carrying an RGBA colour and a
 * **radius of influence**. The renderer mixes contributions from every
 * point using inverse-distance weighting, producing soft mesh-like
 * blends that follow whatever shape the user wants.
 *
 *      ┌────────────────────────────────┐
 *      │                                │
 *      │      ●╮                        │
 *      │       ╲╲                       │
 *      │        ●           ●           │
 *      │       ╱╱╲╲        ╱╲           │
 *      │      ●   ●     ──●  ●          │
 *      │                                │
 *      └────────────────────────────────┘
 *      ↑
 *      drag points to reposition; click empty area to add; double-click
 *      a point to remove; click a point and edit its colour/radius in
 *      the inspector.
 *
 * The editor renders into a `<canvas>` (per-pixel sampling) so the
 * preview is the actual gradient. `toSVG()` exports an SVG `<filter>` /
 * radial-gradient-blend approximation suitable for static reuse.
 *
 * NOTE: this component intentionally does NOT inherit from
 * `GradientEditorBase` — its data model isn't a 1-D stop list. It still
 * speaks the same colour space (`additionals/Colors`) and exposes a familiar
 * `change` event.
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';
import { type RGB, parseHex, rgbToHex } from '../../../additionals/Colors.ts';

// ── Data model ──────────────────────────────────────────────────────────────

export interface ShapeStop
{
    /** X coordinate within the gradient area, normalised 0..1. */
    x      : number;
    /** Y coordinate, normalised 0..1. */
    y      : number;
    /** RGBA colour. */
    color  : RGB;
    /** Influence radius normalised by max(width, height). Default 0.3. */
    radius : number;
}

export interface ShapeGradientEditorOptions extends CtrlOptions
{
    /** Initial control points. Default: 4-corner gradient. */
    stops?     : ShapeStop[];
    /** Canvas width  in px. Default 360. */
    width?     : number;
    /** Canvas height in px. Default 240. */
    height?    : number;
    /** Resolution divisor — render at width/divisor for speed. Default 2. */
    speed?     : number;
}

// ── Component ──────────────────────────────────────────────────────────────

export class ShapeGradientEditor extends Control<ShapeGradientEditorOptions>
{
    private _stops    : ShapeStop[];
    private _selected : number = 0;

    private _canvas!  : HTMLCanvasElement;
    private _overlay! : HTMLElement;
    private _inspector! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: ShapeGradientEditorOptions = {})
    {
        super(container, 'div', {
            width: 360, height: 240, speed: 2,
            stops: ShapeGradientEditor.defaultStops(),
            ...opts,
        });
        this._stops = (this._get<ShapeStop[]>('stops', []) || []).slice();
        this.el.className = `ar-grad ar-grad--shape${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();
    }

    /** Default 4-corner gradient. */
    static defaultStops(): ShapeStop[]
    {
        return [
            { x: 0.15, y: 0.20, color: { r: 228, g:  12, b: 136, a: 1 }, radius: 0.45 },
            { x: 0.85, y: 0.25, color: { r:  59, g: 130, b: 246, a: 1 }, radius: 0.45 },
            { x: 0.20, y: 0.80, color: { r:  34, g: 197, b:  94, a: 1 }, radius: 0.45 },
            { x: 0.80, y: 0.78, color: { r: 250, g: 204, b:  21, a: 1 }, radius: 0.45 },
        ];
    }

    // ── Public API ─────────────────────────────────────────────────────────

    getStops(): ShapeStop[] { return this._stops.map(s => ({ ...s, color: { ...s.color } })); }

    setStops(stops: ShapeStop[]): this
    {
        this._stops = stops.map(s => ({ ...s, color: { ...s.color } }));
        if (this._selected >= this._stops.length) this._selected = 0;
        this._render();
        this._emit('change', { stops: this.getStops() });
        return this;
    }

    addStop(s: ShapeStop): ShapeStop
    {
        this._stops.push({ ...s, color: { ...s.color } });
        this._selected = this._stops.length - 1;
        this._render();
        this._emit('change', { stops: this.getStops() });
        return this._stops[this._selected]!;
    }

    removeStop(i: number): this
    {
        if (this._stops.length <= 1) return this;
        if (i < 0 || i >= this._stops.length) return this;
        this._stops.splice(i, 1);
        if (this._selected >= this._stops.length) this._selected = this._stops.length - 1;
        this._render();
        this._emit('change', { stops: this.getStops() });
        return this;
    }

    updateStop(i: number, patch: Partial<ShapeStop>): this
    {
        const s = this._stops[i];
        if (!s) return this;
        if (patch.x      !== undefined) s.x      = clamp01(patch.x);
        if (patch.y      !== undefined) s.y      = clamp01(patch.y);
        if (patch.color  !== undefined) s.color  = { ...patch.color };
        if (patch.radius !== undefined) s.radius = Math.max(0.01, Math.min(2, patch.radius));
        this._render();
        this._emit('change', { stops: this.getStops() });
        return this;
    }

    select(i: number): this { this._selected = i; this._render(); return this; }

    /** Approximate SVG output: union of radial-gradient `<radialGradient>`s with multiply blend. */
    toSVG(): string
    {
        const w = this._get<number>('width', 360);
        const h = this._get<number>('height', 240);
        const defs = this._stops.map((s, i) => `
<radialGradient id="ar-grad-${i}" cx="${s.x * 100}%" cy="${s.y * 100}%" r="${s.radius * 100}%">
  <stop offset="0%"   stop-color="${rgbToHex(s.color)}" stop-opacity="${s.color.a ?? 1}"/>
  <stop offset="100%" stop-color="${rgbToHex(s.color)}" stop-opacity="0"/>
</radialGradient>`).join('');
        const rects = this._stops.map((_, i) =>
            `<rect width="100%" height="100%" fill="url(#ar-grad-${i})" style="mix-blend-mode:lighten"/>`
        ).join('');
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${rects}</svg>`;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        const w = this._get<number>('width',  360);
        const h = this._get<number>('height', 240);

        this.el.innerHTML = `
<div class="ar-grad__row">
  <div class="ar-grad__col">
    <div class="ar-shgrad__stage" style="width:${w}px;height:${h}px;position:relative">
      <canvas data-r="canvas" width="${w}" height="${h}" class="ar-shgrad__canvas"></canvas>
      <div class="ar-shgrad__overlay" data-r="overlay"></div>
    </div>
    <div class="ar-shgrad__hint">
      Click empty area to add a stop · drag stops · double-click a stop to remove
    </div>
  </div>
  <div class="ar-grad__inspector" data-r="inspector"></div>
</div>`;

        this._canvas    = this.el.querySelector<HTMLCanvasElement>('[data-r="canvas"]')!;
        this._overlay   = this.el.querySelector<HTMLElement>('[data-r="overlay"]')!;
        this._inspector = this.el.querySelector<HTMLElement>('[data-r="inspector"]')!;

        this._wireOverlay();
        this._render();
    }

    private _wireOverlay(): void
    {
        // Click on empty overlay → add stop using sampled colour
        this._overlay.addEventListener('click', e => {
            if ((e.target as HTMLElement).classList.contains('ar-shgrad__pin')) return;
            const rect = this._overlay.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top)  / rect.height;
            const c = this._sample(x, y);
            this.addStop({ x, y, color: c, radius: 0.3 });
        });
    }

    private _render(): void
    {
        this._renderCanvas();
        this._renderPins();
        this._renderInspector();
    }

    private _renderCanvas(): void
    {
        const ctx = this._canvas.getContext('2d');
        if (!ctx) return;
        const fullW = this._canvas.width;
        const fullH = this._canvas.height;
        const div = Math.max(1, this._get<number>('speed', 2));
        const w = Math.max(2, Math.floor(fullW / div));
        const h = Math.max(2, Math.floor(fullH / div));

        const img = ctx.createImageData(w, h);
        for (let py = 0; py < h; py++)
        {
            for (let px = 0; px < w; px++)
            {
                const c = this._sample(px / (w - 1), py / (h - 1));
                const i = (py * w + px) * 4;
                img.data[i]   = c.r;
                img.data[i+1] = c.g;
                img.data[i+2] = c.b;
                img.data[i+3] = Math.round((c.a ?? 1) * 255);
            }
        }
        // Stretch back up
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        tmp.getContext('2d')!.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, fullW, fullH);
        ctx.drawImage(tmp, 0, 0, fullW, fullH);
    }

    /** Inverse-distance-weighted blend of all stops at point (x,y). */
    private _sample(x: number, y: number): RGB
    {
        let totalW = 0;
        let r = 0, g = 0, b = 0, a = 0;
        for (const s of this._stops)
        {
            const dx = (x - s.x), dy = (y - s.y);
            const d  = Math.sqrt(dx * dx + dy * dy);
            // Smoothstep falloff inside radius, inverse-square outside
            const t = Math.min(1, d / s.radius);
            const wgt = (1 - t * t) * (1 - t * t) + 1e-6;
            totalW += wgt;
            r += s.color.r * wgt;
            g += s.color.g * wgt;
            b += s.color.b * wgt;
            a += (s.color.a ?? 1) * wgt;
        }
        if (totalW === 0) return { r: 0, g: 0, b: 0, a: 1 };
        return {
            r: Math.round(r / totalW),
            g: Math.round(g / totalW),
            b: Math.round(b / totalW),
            a: a / totalW,
        };
    }

    private _renderPins(): void
    {
        this._overlay.innerHTML = '';
        for (let i = 0; i < this._stops.length; i++)
        {
            const s = this._stops[i]!;
            const pin = document.createElement('div');
            pin.className = 'ar-shgrad__pin' + (i === this._selected ? ' ar-shgrad__pin--sel' : '');
            pin.style.left = `${s.x * 100}%`;
            pin.style.top  = `${s.y * 100}%`;
            pin.style.background = rgbToHex(s.color);
            pin.title = `Stop ${i + 1}`;

            pin.addEventListener('pointerdown', e => {
                e.stopPropagation();
                this.select(i);
                pin.setPointerCapture?.(e.pointerId);
                const move = (ev: PointerEvent) => {
                    const rect = this._overlay.getBoundingClientRect();
                    const x = clamp01((ev.clientX - rect.left) / rect.width);
                    const y = clamp01((ev.clientY - rect.top)  / rect.height);
                    this.updateStop(i, { x, y });
                };
                const up = () => {
                    pin.removeEventListener('pointermove', move);
                    pin.removeEventListener('pointerup',   up);
                };
                pin.addEventListener('pointermove', move);
                pin.addEventListener('pointerup',   up);
            });

            pin.addEventListener('dblclick', e => {
                e.stopPropagation();
                this.removeStop(i);
            });

            this._overlay.appendChild(pin);
        }
    }

    private _renderInspector(): void
    {
        const s = this._stops[this._selected];
        if (!s) { this._inspector.innerHTML = ''; return; }
        const hex = rgbToHex(s.color);

        this._inspector.innerHTML = `
<label class="ar-grad__field"><span>Color</span>
  <input data-r="col"  type="color" value="${hex}">
  <input data-r="hex"  type="text"  value="${hex}">
</label>
<label class="ar-grad__field"><span>X</span>
  <input data-r="x"    type="number" min="0" max="100" step="0.1" value="${(s.x * 100).toFixed(1)}">%
</label>
<label class="ar-grad__field"><span>Y</span>
  <input data-r="y"    type="number" min="0" max="100" step="0.1" value="${(s.y * 100).toFixed(1)}">%
</label>
<label class="ar-grad__field"><span>Radius</span>
  <input data-r="rad"  type="number" min="0.05" max="2" step="0.05" value="${s.radius.toFixed(2)}">
</label>
<label class="ar-grad__field"><span>Alpha</span>
  <input data-r="a"    type="number" min="0" max="1" step="0.01" value="${(s.color.a ?? 1).toFixed(2)}">
</label>
<div class="ar-grad__btns">
  <button data-r="del" class="ar-grad__btn ar-grad__btn--danger" type="button">Remove stop</button>
</div>`;

        const idx = this._selected;
        const get = <T extends HTMLElement = HTMLInputElement>(name: string) =>
            this._inspector.querySelector<T>(`[data-r="${name}"]`)!;

        get('col').addEventListener('input',   () => {
            const c = parseHex((get('col') as HTMLInputElement).value);
            if (c) this.updateStop(idx, { color: { ...c, a: parseFloat((get('a') as HTMLInputElement).value) } });
        });
        get('hex').addEventListener('change',  () => {
            const c = parseHex((get('hex') as HTMLInputElement).value);
            if (c) this.updateStop(idx, { color: { ...c, a: parseFloat((get('a') as HTMLInputElement).value) } });
        });
        get('x'  ).addEventListener('change',  () => this.updateStop(idx, { x: parseFloat((get('x'  ) as HTMLInputElement).value) / 100 }));
        get('y'  ).addEventListener('change',  () => this.updateStop(idx, { y: parseFloat((get('y'  ) as HTMLInputElement).value) / 100 }));
        get('rad').addEventListener('change',  () => this.updateStop(idx, { radius: parseFloat((get('rad') as HTMLInputElement).value) }));
        get('a'  ).addEventListener('change',  () => {
            const cur = this._stops[idx]; if (!cur) return;
            this.updateStop(idx, { color: { ...cur.color, a: parseFloat((get('a') as HTMLInputElement).value) } });
        });
        (get('del') as HTMLButtonElement).addEventListener('click', () => this.removeStop(idx));
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-shgrad-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-shgrad-styles';
        s.textContent = `
.ar-shgrad__stage { border:1px solid #333; border-radius:6px; overflow:hidden; }
.ar-shgrad__canvas { position:absolute; inset:0; }
.ar-shgrad__overlay { position:absolute; inset:0; cursor:copy; }
.ar-shgrad__pin { position:absolute; width:14px; height:14px; margin:-7px 0 0 -7px; border:2px solid #fff; border-radius:50%; cursor:grab; box-shadow:0 0 0 1px rgba(0,0,0,0.6); }
.ar-shgrad__pin--sel { border-color:#e40c88; transform:scale(1.2); }
.ar-shgrad__hint { font:11px sans-serif; color:#888; padding-top:6px; }
`;
        document.head.appendChild(s);
        // The base `.ar-grad__*` styles come from GradientEditor
        // (in case the user uses ShapeGradientEditor without the others, replicate the bare minimum here)
        if (!document.getElementById('ar-grad-styles'))
        {
            const sb = document.createElement('style');
            sb.id = 'ar-grad-styles';
            sb.textContent = `
.ar-grad { display:flex; flex-direction:column; gap:10px; padding:12px; background:#1e1e1e; border:1px solid #333; border-radius:8px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; }
.ar-grad__row { display:flex; gap:14px; align-items:flex-start; }
.ar-grad__col { flex:1; min-width:0; }
.ar-grad__inspector { width:240px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; }
.ar-grad__field { display:flex; gap:8px; align-items:center; }
.ar-grad__field span { width:70px; font:10px sans-serif; color:#888; text-transform:uppercase; }
.ar-grad__field input[type="text"], .ar-grad__field input[type="number"] { background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:4px 6px; font:11px ui-monospace,monospace; border-radius:2px; flex:1; min-width:0; }
.ar-grad__field input[type="color"] { width:30px; height:24px; border:1px solid #333; padding:0; background:transparent; cursor:pointer; }
.ar-grad__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:5px 10px; font:11px sans-serif; border-radius:3px; cursor:pointer; }
.ar-grad__btn--danger:hover { background:#dc2626; border-color:#dc2626; color:#fff; }
`;
            document.head.appendChild(sb);
        }
    }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
