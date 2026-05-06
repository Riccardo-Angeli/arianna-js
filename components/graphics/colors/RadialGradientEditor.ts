/**
 * @module    components/graphics/2D/RadialGradientEditor
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Radial gradient editor — Illustrator/Photoshop style. On top of the
 * shared stop strip from `GradientEditorBase`, exposes the geometry
 * specific to a CSS `radial-gradient(...)`:
 *
 *   • Shape: `circle` or `ellipse`
 *   • Size :  `closest-side`, `farthest-side`, `closest-corner`, `farthest-corner`,
 *             or explicit `length-percentage` pair
 *   • Center: `cx%, cy%` — interactive picker on a small canvas
 *   • Aspect ratio : ellipse only — separate radius-x / radius-y
 *
 *   ┌──────────────────────────────────┬────────────────────┐
 *   │ ████████████████████████████████ │ Color [#e40c88]    │
 *   │ ▣  ◆  ▣          ▣            ▣ │ Position [42.0]%   │
 *   ├──────────────────────────────────┤ Alpha   [1.00]     │
 *   │ Shape [circle ▾]  Size [farthest-corner ▾] │            │
 *   │ Center: [50]% [50]%   ◯ ← drag in preview │            │
 *   ├──────────────────────────────────┤                    │
 *   │ Preview swatch                   │                    │
 *   └──────────────────────────────────┴────────────────────┘
 */

import { GradientEditorBase, type GradientEditorOptions } from './GradientEditor.ts';

// ── Options ────────────────────────────────────────────────────────────────

export type RadialShape = 'circle' | 'ellipse';
export type RadialSize  = 'closest-side' | 'farthest-side' | 'closest-corner' | 'farthest-corner';

export interface RadialGradientEditorOptions extends GradientEditorOptions
{
    /** Default 'circle'. */
    shape?  : RadialShape;
    /** Default 'farthest-corner'. */
    size?   : RadialSize;
    /** Centre X in % (0-100). Default 50. */
    cx?     : number;
    /** Centre Y in % (0-100). Default 50. */
    cy?     : number;
    /** Interpolation space. Default 'srgb'. */
    interp? : 'srgb' | 'oklab' | 'oklch' | 'hsl';
}

// ── Component ──────────────────────────────────────────────────────────────

export class RadialGradientEditor extends GradientEditorBase<RadialGradientEditorOptions>
{
    private _shape  : RadialShape;
    private _size   : RadialSize;
    private _cx     : number;
    private _cy     : number;
    private _interp : RadialGradientEditorOptions['interp'];

    private _elPreview!       : HTMLElement;
    private _elInspectorHost! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: RadialGradientEditorOptions = {})
    {
        super(container, 'div', {
            shape: 'circle', size: 'farthest-corner', cx: 50, cy: 50, interp: 'srgb',
            ...opts,
        });
        this._shape  = this._get<RadialShape>('shape', 'circle');
        this._size   = this._get<RadialSize>('size',  'farthest-corner');
        this._cx     = this._get<number>('cx', 50);
        this._cy     = this._get<number>('cy', 50);
        this._interp = this._get<RadialGradientEditorOptions['interp']>('interp', 'srgb');

        this.el.className = `ar-grad ar-grad--radial${opts.class ? ' ' + opts.class : ''}`;
        this._injectGradientStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    setShape(shape: RadialShape): this { this._shape = shape; this._render(); this._fireChange(); return this; }
    setSize(size: RadialSize): this    { this._size  = size;  this._render(); this._fireChange(); return this; }
    setCenter(cx: number, cy: number): this
    {
        this._cx = Math.max(0, Math.min(100, cx));
        this._cy = Math.max(0, Math.min(100, cy));
        this._render();
        this._fireChange();
        return this;
    }

    getCenter(): { cx: number; cy: number } { return { cx: this._cx, cy: this._cy }; }
    getShape(): RadialShape { return this._shape; }
    getSize() : RadialSize  { return this._size; }

    toCSS(): string
    {
        const stops = this._stopsToCss();
        const space = this._interp === 'srgb' ? '' : ` in ${this._interp}`;
        return `radial-gradient(${this._shape} ${this._size} at ${this._cx}% ${this._cy}%${space}, ${stops})`;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    private _fireChange(): void
    {
        this._emit('change', {
            stops: this.getStops(),
            shape: this._shape, size: this._size, cx: this._cx, cy: this._cy, interp: this._interp,
        });
    }

    protected _build(): void
    {
        this.el.innerHTML = `
<div class="ar-grad__row">
  <div class="ar-grad__col">
    <div data-r="strip-host"></div>
    <div class="ar-grad__field" style="margin-top:10px">
      <span>Shape</span>
      <select data-r="shape">
        <option value="circle"  ${this._shape === 'circle'  ? 'selected' : ''}>Circle</option>
        <option value="ellipse" ${this._shape === 'ellipse' ? 'selected' : ''}>Ellipse</option>
      </select>
      <span style="margin-left:10px">Size</span>
      <select data-r="size">
        <option value="closest-side"     ${this._size === 'closest-side'     ? 'selected' : ''}>Closest side</option>
        <option value="farthest-side"    ${this._size === 'farthest-side'    ? 'selected' : ''}>Farthest side</option>
        <option value="closest-corner"   ${this._size === 'closest-corner'   ? 'selected' : ''}>Closest corner</option>
        <option value="farthest-corner"  ${this._size === 'farthest-corner'  ? 'selected' : ''}>Farthest corner</option>
      </select>
    </div>
    <div class="ar-grad__field">
      <span>Center</span>
      <input data-r="cx" type="number" min="0" max="100" step="1" value="${this._cx}">%
      <input data-r="cy" type="number" min="0" max="100" step="1" value="${this._cy}">%
      <span style="margin-left:10px">Space</span>
      <select data-r="interp">
        <option value="srgb"  ${this._interp === 'srgb'  ? 'selected' : ''}>sRGB</option>
        <option value="oklab" ${this._interp === 'oklab' ? 'selected' : ''}>OKLab</option>
        <option value="oklch" ${this._interp === 'oklch' ? 'selected' : ''}>OKLCH</option>
      </select>
    </div>
    <div class="ar-grad__preview" data-r="preview" style="margin-top:10px;cursor:crosshair;position:relative;height:160px"></div>
  </div>
  <div class="ar-grad__inspector" data-r="inspector"></div>
</div>`;

        const stripHost = this.el.querySelector<HTMLElement>('[data-r="strip-host"]')!;
        this._elInspectorHost = this.el.querySelector<HTMLElement>('[data-r="inspector"]')!;
        this._elPreview = this.el.querySelector<HTMLElement>('[data-r="preview"]')!;

        this._renderStripDom(stripHost, `linear-gradient(to right, ${this._stopsToCss()})`);

        const shapeSel  = this.el.querySelector<HTMLSelectElement>('[data-r="shape"]')!;
        const sizeSel   = this.el.querySelector<HTMLSelectElement>('[data-r="size"]')!;
        const cxInp     = this.el.querySelector<HTMLInputElement>('[data-r="cx"]')!;
        const cyInp     = this.el.querySelector<HTMLInputElement>('[data-r="cy"]')!;
        const interpSel = this.el.querySelector<HTMLSelectElement>('[data-r="interp"]')!;

        shapeSel.addEventListener('change', () => this.setShape(shapeSel.value as RadialShape));
        sizeSel .addEventListener('change', () => this.setSize(sizeSel.value as RadialSize));
        cxInp   .addEventListener('change', () => this.setCenter(parseFloat(cxInp.value), this._cy));
        cyInp   .addEventListener('change', () => this.setCenter(this._cx, parseFloat(cyInp.value)));
        interpSel.addEventListener('change', () => {
            this._interp = interpSel.value as RadialGradientEditorOptions['interp'];
            this._render();
            this._fireChange();
        });

        // Drag inside preview to move centre
        this._elPreview.addEventListener('pointerdown', e => {
            this._elPreview.setPointerCapture?.(e.pointerId);
            const handle = (ev: PointerEvent) => {
                const rect = this._elPreview.getBoundingClientRect();
                const cx = ((ev.clientX - rect.left) / rect.width)  * 100;
                const cy = ((ev.clientY - rect.top)  / rect.height) * 100;
                cxInp.value = cx.toFixed(0);
                cyInp.value = cy.toFixed(0);
                this.setCenter(cx, cy);
            };
            handle(e);
            this._elPreview.addEventListener('pointermove', handle);
            this._elPreview.addEventListener('pointerup', () => {
                this._elPreview.removeEventListener('pointermove', handle);
            }, { once: true });
        });

        this._render();
    }

    protected _render(): void
    {
        if (this._elStrip)
        {
            const stripHost = this.el.querySelector<HTMLElement>('[data-r="strip-host"]');
            if (stripHost) this._renderStripDom(stripHost, `linear-gradient(to right, ${this._stopsToCss()})`);
        }
        if (this._elPreview) this._elPreview.style.background = this.toCSS();
        if (this._elInspectorHost) this._renderInspector(this._elInspectorHost);
    }
}
