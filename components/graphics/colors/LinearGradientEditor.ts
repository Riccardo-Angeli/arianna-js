/**
 * @module    components/graphics/2D/LinearGradientEditor
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Linear gradient editor — Illustrator/Photoshop style. Edits the two
 * dimensions specific to a linear gradient on top of the shared
 * `GradientEditorBase` (stops, colours, positions): the **angle** in
 * degrees (0° = top→bottom by CSS convention) and an optional
 * **interpolation space** (linear sRGB, OKLab, OKLCH, HSL).
 *
 *   ┌──────────────────────────────────┬────────────────────┐
 *   │ ████████████████████████████████ │ Color [#e40c88]    │
 *   │ ▣  ◆  ▣          ▣            ▣ │ Position [42.0]%   │
 *   ├──────────────────────────────────┤ Alpha   [1.00]     │
 *   │ Angle [   90 ]°  Space [oklab ▾] │ [Remove stop]      │
 *   ├──────────────────────────────────┤                    │
 *   │ Preview swatch                   │                    │
 *   │ (60×60, applies the gradient)    │                    │
 *   └──────────────────────────────────┴────────────────────┘
 *
 * @example
 *   import { LinearGradientEditor } from 'ariannajs/components/graphics/2D';
 *
 *   const ed = new LinearGradientEditor('#grad', { angle: 45 });
 *   ed.on('change', e => fill.setBackground(ed.toCSS()));
 */

import { GradientEditorBase, type GradientEditorOptions } from './GradientEditor.ts';

// ── Options ────────────────────────────────────────────────────────────────

export type GradientInterp = 'srgb' | 'oklab' | 'oklch' | 'hsl';

export interface LinearGradientEditorOptions extends GradientEditorOptions
{
    /** Angle in degrees (CSS convention: 0=upwards, 90=right). Default 90. */
    angle?  : number;
    /** Colour interpolation space. Default 'srgb' (universally supported). */
    interp? : GradientInterp;
}

// ── Component ──────────────────────────────────────────────────────────────

export class LinearGradientEditor extends GradientEditorBase<LinearGradientEditorOptions>
{
    private _angle  : number;
    private _interp : GradientInterp;

    private _elPreview!  : HTMLElement;
    private _elInspectorHost! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: LinearGradientEditorOptions = {})
    {
        super(container, 'div', { angle: 90, interp: 'srgb', alpha: true, ...opts });
        this._angle  = this._get<number>('angle', 90);
        this._interp = this._get<GradientInterp>('interp', 'srgb');

        this.el.className = `ar-grad ar-grad--linear${opts.class ? ' ' + opts.class : ''}`;
        this._injectGradientStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    setAngle(deg: number): this
    {
        this._angle = ((deg % 360) + 360) % 360;
        this._render();
        this._emit('change', { stops: this.getStops(), angle: this._angle });
        return this;
    }

    getAngle(): number { return this._angle; }

    setInterp(space: GradientInterp): this
    {
        this._interp = space;
        this._render();
        this._emit('change', { stops: this.getStops(), interp: this._interp });
        return this;
    }

    getInterp(): GradientInterp { return this._interp; }

    /** Render the gradient as a CSS `linear-gradient(...)` string. */
    toCSS(): string
    {
        const stops = this._stopsToCss();
        const space = this._interp === 'srgb' ? '' : ` in ${this._interp}`;
        return `linear-gradient(${this._angle}deg${space}, ${stops})`;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        this.el.innerHTML = `
<div class="ar-grad__row">
  <div class="ar-grad__col">
    <div data-r="strip-host"></div>
    <div class="ar-grad__field" style="margin-top:10px">
      <span>Angle</span>
      <input data-r="angle"  type="number" min="0" max="360" step="1" value="${this._angle}">°
      <span style="margin-left:10px">Space</span>
      <select data-r="interp">
        <option value="srgb"  ${this._interp === 'srgb'  ? 'selected' : ''}>sRGB</option>
        <option value="oklab" ${this._interp === 'oklab' ? 'selected' : ''}>OKLab</option>
        <option value="oklch" ${this._interp === 'oklch' ? 'selected' : ''}>OKLCH</option>
        <option value="hsl"   ${this._interp === 'hsl'   ? 'selected' : ''}>HSL</option>
      </select>
    </div>
    <div class="ar-grad__preview" data-r="preview" style="margin-top:10px"></div>
  </div>
  <div class="ar-grad__inspector" data-r="inspector"></div>
</div>`;

        const stripHost = this.el.querySelector<HTMLElement>('[data-r="strip-host"]')!;
        this._elInspectorHost = this.el.querySelector<HTMLElement>('[data-r="inspector"]')!;
        this._elPreview = this.el.querySelector<HTMLElement>('[data-r="preview"]')!;

        // Render initial strip
        this._renderStripDom(stripHost, `linear-gradient(to right, ${this._stopsToCss()})`);

        // Wire angle + interp
        const angleInp = this.el.querySelector<HTMLInputElement>('[data-r="angle"]')!;
        angleInp.addEventListener('change', () => this.setAngle(parseFloat(angleInp.value) || 0));

        const interpSel = this.el.querySelector<HTMLSelectElement>('[data-r="interp"]')!;
        interpSel.addEventListener('change', () => this.setInterp(interpSel.value as GradientInterp));

        this._render();
    }

    protected _render(): void
    {
        // Repaint the strip
        if (this._elStrip) this._elStrip.style.background = `linear-gradient(to right, ${this._stopsToCss()})`;
        // Re-render pins (also updates selection class)
        if (this._elPins)
        {
            this._elPins.innerHTML = '';
            const stripHost = this.el.querySelector<HTMLElement>('[data-r="strip-host"]');
            if (stripHost) this._renderStripDom(stripHost, `linear-gradient(to right, ${this._stopsToCss()})`);
        }
        // Preview applies the actual gradient (with angle)
        if (this._elPreview) this._elPreview.style.background = this.toCSS();
        // Inspector
        if (this._elInspectorHost) this._renderInspector(this._elInspectorHost);
    }
}
