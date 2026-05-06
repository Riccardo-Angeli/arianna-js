/**
 * @module    components/graphics/2D/GradientEditor
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Shared abstract base for the three gradient editors:
 *
 *   • LinearGradientEditor — angle + stops along a straight line
 *   • RadialGradientEditor — centre + radius + stops along a ray
 *   • ShapeGradientEditor  — Illustrator "freeform mesh" gradient with
 *                            arbitrary 2D control points each carrying a
 *                            colour and influence falloff.
 *
 * Every editor owns the same data model: an ordered list of `GradientStop`
 * each with a normalised `t ∈ [0,1]` parameter, an RGBA colour, and an
 * optional `midpoint` (the "0.5" handle between this stop and the next
 * one — the same control Illustrator exposes as a tiny diamond on the
 * gradient bar). Subclasses add geometry on top.
 *
 * Output: each editor exposes `toCSS()` returning a `linear-gradient(...)`
 * / `radial-gradient(...)` / SVG-mesh string suitable to paint a fill.
 *
 * The shared base also renders the *stop strip* — the horizontal bar with
 * stop pins, midpoints, add-stop click area, and double-click-to-remove.
 *
 * Design rules:
 *   • Stops are always kept sorted by `t`.
 *   • Two stops may share a `t` (Illustrator allows hard transitions).
 *   • Removing a stop falls back gracefully to keeping at least 2.
 *   • Selection is by stop index; subclasses display their geometry pins.
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';
import { type RGB, parseHex, rgbToHex } from '../../../additionals/Colors.ts';

// ── Data model ──────────────────────────────────────────────────────────────

export interface GradientStop
{
    /** Position along the gradient axis, 0..1. */
    t      : number;
    /** Colour as RGBA. Alpha defaults to 1. */
    color  : RGB;
    /**
     * Optional midpoint between this stop and the next, expressed in absolute
     * gradient space (0..1). Mirrors Illustrator's diamond handle. If unset
     * the visual midpoint is `(this.t + next.t) / 2`.
     */
    midpoint? : number;
}

export interface GradientEditorOptions extends CtrlOptions
{
    /** Initial stops. Default: black → white. */
    stops? : GradientStop[];
    /** Width of the stop strip. Default 360. */
    width? : number;
    /** Show alpha controls. Default true. */
    alpha? : boolean;
}

// ── Base class ──────────────────────────────────────────────────────────────

export abstract class GradientEditorBase<O extends GradientEditorOptions = GradientEditorOptions>
    extends Control<O>
{
    protected _stops    : GradientStop[];
    protected _selected : number = 0;

    protected _elStrip!  : HTMLElement;
    protected _elPins!   : HTMLElement;
    protected _elInspector! : HTMLElement;

    constructor(container: string | HTMLElement | null, tag: string, opts: O)
    {
        super(container, tag, opts);
        this._stops = (opts.stops ?? GradientEditorBase.defaultStops()).slice();
        this._sortStops();
    }

    /** Default 2-stop black→white gradient. */
    static defaultStops(): GradientStop[]
    {
        return [
            { t: 0, color: { r: 0,   g: 0,   b: 0,   a: 1 } },
            { t: 1, color: { r: 255, g: 255, b: 255, a: 1 } },
        ];
    }

    // ── Public API: stops ──────────────────────────────────────────────────

    getStops(): GradientStop[] { return this._stops.map(s => ({ ...s, color: { ...s.color } })); }

    setStops(stops: GradientStop[]): this
    {
        this._stops = stops.map(s => ({ ...s, color: { ...s.color } }));
        this._sortStops();
        if (this._selected >= this._stops.length) this._selected = 0;
        this._render();
        this._emit('change', { stops: this.getStops() });
        return this;
    }

    addStop(t: number, color: RGB | string): GradientStop
    {
        const rgb = typeof color === 'string' ? (parseHex(color) ?? { r: 0, g: 0, b: 0, a: 1 }) : color;
        const stop: GradientStop = { t: clamp01(t), color: { ...rgb, a: rgb.a ?? 1 } };
        this._stops.push(stop);
        this._sortStops();
        this._selected = this._stops.indexOf(stop);
        this._render();
        this._emit('change', { stops: this.getStops() });
        return stop;
    }

    removeStop(index: number): this
    {
        if (this._stops.length <= 2) return this;     // always keep at least 2
        if (index < 0 || index >= this._stops.length) return this;
        this._stops.splice(index, 1);
        if (this._selected >= this._stops.length) this._selected = this._stops.length - 1;
        this._render();
        this._emit('change', { stops: this.getStops() });
        return this;
    }

    updateStop(index: number, patch: Partial<GradientStop>): this
    {
        const s = this._stops[index];
        if (!s) return this;
        if (patch.t !== undefined)        s.t = clamp01(patch.t);
        if (patch.color !== undefined)    s.color = { ...patch.color };
        if (patch.midpoint !== undefined) s.midpoint = clamp01(patch.midpoint);
        this._sortStops();
        this._render();
        this._emit('change', { stops: this.getStops() });
        return this;
    }

    select(index: number): this
    {
        this._selected = Math.max(0, Math.min(this._stops.length - 1, index));
        this._render();
        return this;
    }

    getSelected(): number { return this._selected; }

    // ── Rendering helpers used by subclasses ───────────────────────────────

    /** CSS gradient string. Subclasses override the wrapper. */
    abstract toCSS(): string;

    /** Render the editor — subclasses implement. */
    protected abstract _render(): void;

    // ── Shared utilities ────────────────────────────────────────────────────

    private _sortStops(): void { this._stops.sort((a, b) => a.t - b.t); }

    /** Build a CSS colour-stops list e.g. `red 0%, blue 100%`. */
    protected _stopsToCss(): string
    {
        return this._stops.map(s => {
            const c = s.color;
            const css = c.a !== undefined && c.a < 1
                ? `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a.toFixed(3)})`
                : rgbToHex(c);
            return `${css} ${(s.t * 100).toFixed(2)}%`;
        }).join(', ');
    }

    /** Common stop-strip DOM (used inside subclasses). */
    protected _renderStripDom(host: HTMLElement, css: string): void
    {
        host.innerHTML = `
<div class="ar-grad__strip" data-r="strip" style="background:${css}"></div>
<div class="ar-grad__pins"  data-r="pins"></div>`;
        this._elStrip = host.querySelector<HTMLElement>('[data-r="strip"]')!;
        this._elPins  = host.querySelector<HTMLElement>('[data-r="pins"]')!;
        this._wireStrip();
        this._renderPins();
    }

    private _wireStrip(): void
    {
        // Click on empty strip → add stop at that position
        this._elStrip.addEventListener('click', e => {
            const rect = this._elStrip.getBoundingClientRect();
            const t = (e.clientX - rect.left) / rect.width;
            // Sample colour at that point (linear interp)
            const c = this._sampleAt(t);
            this.addStop(t, c);
        });
    }

    private _renderPins(): void
    {
        this._elPins.innerHTML = '';
        for (let i = 0; i < this._stops.length; i++)
        {
            const s = this._stops[i]!;
            const pin = document.createElement('div');
            pin.className = 'ar-grad__pin' + (i === this._selected ? ' ar-grad__pin--sel' : '');
            pin.style.left = `${s.t * 100}%`;
            pin.style.background = rgbToHex(s.color);
            pin.title = `Stop ${i + 1} · ${rgbToHex(s.color)} @ ${(s.t * 100).toFixed(1)}%`;

            // Drag to reposition
            pin.addEventListener('pointerdown', e => {
                e.stopPropagation();
                this.select(i);
                pin.setPointerCapture?.(e.pointerId);
                const move = (ev: PointerEvent) => {
                    const rect = this._elStrip.getBoundingClientRect();
                    const t = clamp01((ev.clientX - rect.left) / rect.width);
                    this.updateStop(i, { t });
                };
                const up = () => {
                    pin.removeEventListener('pointermove', move);
                    pin.removeEventListener('pointerup',   up);
                };
                pin.addEventListener('pointermove', move);
                pin.addEventListener('pointerup',   up);
            });

            // Double-click to remove
            pin.addEventListener('dblclick', e => {
                e.stopPropagation();
                this.removeStop(i);
            });

            this._elPins.appendChild(pin);
        }
    }

    /** Sample the gradient at parameter t — used when adding new stops. */
    private _sampleAt(t: number): RGB
    {
        if (!this._stops.length) return { r: 0, g: 0, b: 0, a: 1 };
        if (t <= this._stops[0]!.t) return { ...this._stops[0]!.color };
        if (t >= this._stops[this._stops.length - 1]!.t) return { ...this._stops[this._stops.length - 1]!.color };
        for (let i = 0; i < this._stops.length - 1; i++)
        {
            const a = this._stops[i]!, b = this._stops[i + 1]!;
            if (t >= a.t && t <= b.t)
            {
                const f = (t - a.t) / (b.t - a.t || 1);
                return {
                    r: Math.round(a.color.r + (b.color.r - a.color.r) * f),
                    g: Math.round(a.color.g + (b.color.g - a.color.g) * f),
                    b: Math.round(a.color.b + (b.color.b - a.color.b) * f),
                    a: (a.color.a ?? 1) + ((b.color.a ?? 1) - (a.color.a ?? 1)) * f,
                };
            }
        }
        return { ...this._stops[0]!.color };
    }

    /** Inspector for the selected stop — colour + t input + alpha. */
    protected _renderInspector(host: HTMLElement): void
    {
        const s = this._stops[this._selected];
        if (!s) { host.innerHTML = ''; return; }
        const css = rgbToHex(s.color);
        host.innerHTML = `
<label class="ar-grad__field"><span>Color</span>
  <input data-r="ins-col" type="color" value="${css}">
  <input data-r="ins-hex" type="text"  value="${css}">
</label>
<label class="ar-grad__field"><span>Position</span>
  <input data-r="ins-t" type="number" min="0" max="100" step="0.1" value="${(s.t * 100).toFixed(1)}">%
</label>
<label class="ar-grad__field"><span>Alpha</span>
  <input data-r="ins-a" type="number" min="0" max="1"   step="0.01" value="${(s.color.a ?? 1).toFixed(2)}">
</label>
<div class="ar-grad__btns">
  <button data-r="ins-del" class="ar-grad__btn ar-grad__btn--danger" type="button">Remove stop</button>
</div>`;

        const r = (n: string) => host.querySelector<HTMLInputElement>(`[data-r="${n}"]`);
        const idx = this._selected;
        const colInp = r('ins-col')!;
        const hexInp = r('ins-hex')!;
        const tInp   = r('ins-t')!;
        const aInp   = r('ins-a')!;
        const delBtn = host.querySelector<HTMLButtonElement>('[data-r="ins-del"]')!;

        colInp.addEventListener('input',  () => {
            const c = parseHex(colInp.value);
            if (c) this.updateStop(idx, { color: { ...c, a: parseFloat(aInp.value) } });
        });
        hexInp.addEventListener('change', () => {
            const c = parseHex(hexInp.value);
            if (c) this.updateStop(idx, { color: { ...c, a: parseFloat(aInp.value) } });
        });
        tInp.addEventListener('change',   () => this.updateStop(idx, { t: parseFloat(tInp.value) / 100 }));
        aInp.addEventListener('change',   () => {
            const cur = this._stops[idx];
            if (cur) this.updateStop(idx, { color: { ...cur.color, a: parseFloat(aInp.value) } });
        });
        delBtn.addEventListener('click',  () => this.removeStop(idx));
    }

    protected _injectGradientStyles(): void
    {
        if (document.getElementById('ar-grad-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-grad-styles';
        s.textContent = `
.ar-grad { display:flex; flex-direction:column; gap:10px; padding:12px; background:#1e1e1e; border:1px solid #333; border-radius:8px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; }
.ar-grad__strip { position:relative; height:30px; border-radius:3px; cursor:copy; box-shadow:inset 0 0 0 1px #333; background-image:linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%); background-size:8px 8px; background-position:0 0, 0 4px, 4px -4px, -4px 0px; }
.ar-grad__pins  { position:relative; height:14px; }
.ar-grad__pin   { position:absolute; top:0; width:12px; height:14px; transform:translateX(-50%); border:2px solid #fff; border-radius:2px; box-shadow:0 0 0 1px rgba(0,0,0,0.6); cursor:grab; }
.ar-grad__pin--sel { border-color:#e40c88; transform:translateX(-50%) scale(1.15); }
.ar-grad__field { display:flex; gap:8px; align-items:center; }
.ar-grad__field span { width:70px; font:10px sans-serif; color:#888; text-transform:uppercase; }
.ar-grad__field input[type="text"], .ar-grad__field input[type="number"] { background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:4px 6px; font:11px ui-monospace,monospace; border-radius:2px; flex:1; min-width:0; }
.ar-grad__field input[type="color"] { width:30px; height:24px; border:1px solid #333; padding:0; background:transparent; cursor:pointer; }
.ar-grad__field input:focus { outline:none; border-color:#e40c88; }
.ar-grad__btns { margin-top:6px; }
.ar-grad__btn  { background:transparent; border:1px solid #444; color:#d4d4d4; padding:5px 10px; font:11px sans-serif; border-radius:3px; cursor:pointer; }
.ar-grad__btn:hover { background:#2a2a2a; }
.ar-grad__btn--danger:hover { background:#dc2626; border-color:#dc2626; color:#fff; }
.ar-grad__preview { width:100%; height:60px; border-radius:4px; box-shadow:inset 0 0 0 1px #333; }
.ar-grad__row { display:flex; gap:14px; align-items:flex-start; }
.ar-grad__col { flex:1; min-width:0; }
.ar-grad__inspector { width:240px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; }
`;
        document.head.appendChild(s);
    }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
