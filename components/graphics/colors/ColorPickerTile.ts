/**
 * @module    components/graphics/2D/ColorPickerTile
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Tile-style colour picker — the third member of the colour-picker
 * family alongside `ColorPickerWheel` and `ColorPickerSquare`. Renders a
 * grid of swatches that the user can click. Supports:
 *
 *   • Built-in tile palettes: `material`, `tailwind`, `pastel`, `web-safe`,
 *     `mac-os-classic`, or any custom array of hex strings.
 *   • A "recent colours" strip that auto-grows as the user picks.
 *   • Per-tile tooltip with the colour value in the requested space.
 *   • Optional eyedropper / hex input on the side.
 *
 *   ┌────────────────────────────┐
 *   │ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣           │
 *   │ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣           │
 *   │ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣           │
 *   ├────────────────────────────┤
 *   │ Recent: ▣ ▣ ▣ ▣            │
 *   ├────────────────────────────┤
 *   │ HEX [#e40c88 ]    [Pick]   │
 *   └────────────────────────────┘
 *
 * The displayed colour is exposed in every space supported by `additionals/Colors`:
 * RGB / HEX / HSL / HSV / CMYK / OKLCH / CIELUV / Cube.
 *
 * @example
 *   import { ColorPickerTile } from 'ariannajs/components/graphics/2D';
 *
 *   const cp = new ColorPickerTile('#tiles', { palette: 'material' });
 *   cp.on('change', e => brush.setColor(e.hex));
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';
import {
    type RGB, parseHex, rgbToHex,
    rgbToHsl, rgbToHsv, rgbToCmyk, rgbToCieluv, rgbToOklch, rgbToCube,
} from '../../../additionals/Colors.ts';

// ── Built-in palettes ──────────────────────────────────────────────────────

const PALETTES: Record<string, string[]> = {
    'tailwind': [
        '#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899',
        '#dc2626','#ea580c','#ca8a04','#16a34a','#0891b2','#2563eb','#7c3aed','#db2777',
        '#991b1b','#9a3412','#854d0e','#15803d','#0e7490','#1d4ed8','#6d28d9','#9d174d',
        '#1e1e1e','#374151','#6b7280','#9ca3af','#d1d5db','#e5e7eb','#f3f4f6','#ffffff',
    ],
    'material': [
        '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4',
        '#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722',
        '#795548','#9e9e9e','#607d8b','#000000','#ffffff','#212121','#424242','#757575',
    ],
    'pastel': [
        '#ffd1dc','#ffb3c1','#ffd6e0','#ffe5d9','#fef3c7','#d9f99d','#bbf7d0','#a7f3d0',
        '#bae6fd','#bfdbfe','#c7d2fe','#ddd6fe','#e9d5ff','#f5d0fe','#fce7f3','#fbcfe8',
    ],
    'web-safe': [
        '#000000','#000033','#000066','#000099','#0000cc','#0000ff',
        '#003300','#003333','#003366','#003399','#0033cc','#0033ff',
        '#006600','#006633','#006666','#006699','#0066cc','#0066ff',
        '#009900','#009933','#009966','#009999','#0099cc','#0099ff',
        '#00cc00','#00cc33','#00cc66','#00cc99','#00cccc','#00ccff',
        '#00ff00','#00ff33','#00ff66','#00ff99','#00ffcc','#00ffff',
    ],
    'mac-os-classic': [
        '#000000','#404040','#808080','#bfbfbf','#ffffff',
        '#7f0000','#ff0000','#7f7f00','#ffff00','#007f00','#00ff00','#007f7f','#00ffff',
        '#00007f','#0000ff','#7f007f','#ff00ff','#ff7f00','#7f3f00','#ffbf7f','#7f7f3f',
    ],
};

// ── Options ────────────────────────────────────────────────────────────────

export interface ColorPickerTileOptions extends CtrlOptions
{
    /** Built-in palette name OR custom array of hex colours. Default 'tailwind'. */
    palette?    : keyof typeof PALETTES | string[];
    /** Initially-selected colour. */
    color?      : string;
    /** Show "recent colours" strip. Default true. */
    showRecent? : boolean;
    /** Maximum recent colours to remember. Default 12. */
    recentMax?  : number;
    /** Show hex input below the grid. Default true. */
    showInput?  : boolean;
    /** Number of tile columns. Default 8. */
    columns?    : number;
    /** Tile size in px. Default 28. */
    tileSize?   : number;
}

// ── Component ──────────────────────────────────────────────────────────────

export class ColorPickerTile extends Control<ColorPickerTileOptions>
{
    private _selected : string = '#000000';
    private _recent   : string[] = [];

    private _elGrid!  : HTMLElement;
    private _elRecent?: HTMLElement;
    private _elInput? : HTMLInputElement;

    constructor(container: string | HTMLElement | null, opts: ColorPickerTileOptions = {})
    {
        super(container, 'div', {
            palette   : 'tailwind',
            showRecent: true,
            recentMax : 12,
            showInput : true,
            columns   : 8,
            tileSize  : 28,
            ...opts,
        });
        this.el.className = `ar-cpt${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();

        const init = this._get<string>('color', '');
        if (init) this.setColor(init);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Set the selected colour and add to recents. */
    setColor(hex: string): this
    {
        const rgb = parseHex(hex);
        if (!rgb) return this;
        this._selected = rgbToHex(rgb);
        this._addRecent(this._selected);
        this._refreshSelection();
        if (this._elInput) this._elInput.value = this._selected;
        this._emit('change', this.getColor());
        return this;
    }

    /** Currently-selected colour in every supported space. */
    getColor()
    {
        const rgb = parseHex(this._selected) || { r: 0, g: 0, b: 0 };
        return {
            rgb,
            hex   : this._selected,
            hsl   : rgbToHsl(rgb),
            hsv   : rgbToHsv(rgb),
            cmyk  : rgbToCmyk(rgb),
            cieluv: rgbToCieluv(rgb),
            oklch : rgbToOklch(rgb),
            cube  : rgbToCube(rgb),
        };
    }

    /** Recent-colours history (newest first). */
    getRecent(): string[] { return this._recent.slice(); }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        const showRecent = this._get<boolean>('showRecent', true);
        const showInput  = this._get<boolean>('showInput', true);

        this.el.innerHTML = `
<div class="ar-cpt__grid" data-r="grid"></div>
${showRecent ? `<div class="ar-cpt__sep">Recent</div><div class="ar-cpt__recent" data-r="recent"></div>` : ''}
${showInput  ? `<div class="ar-cpt__input-row">
  <input class="ar-cpt__inp" data-r="inp" type="text" placeholder="#rrggbb">
  <input class="ar-cpt__cpc" data-r="cpc" type="color">
</div>` : ''}`;

        this._elGrid = this.el.querySelector<HTMLElement>('[data-r="grid"]')!;
        this._elRecent = this.el.querySelector<HTMLElement>('[data-r="recent"]') ?? undefined;
        this._elInput  = this.el.querySelector<HTMLInputElement>('[data-r="inp"]') ?? undefined;
        const cpc      = this.el.querySelector<HTMLInputElement>('[data-r="cpc"]');

        this._renderGrid();

        if (this._elInput)
        {
            this._elInput.addEventListener('change', () => this.setColor(this._elInput!.value));
        }
        if (cpc)
        {
            cpc.addEventListener('input', () => this.setColor(cpc.value));
        }
    }

    private _renderGrid(): void
    {
        const palette = this._resolvePalette();
        const cols = this._get<number>('columns', 8);
        const size = this._get<number>('tileSize', 28);

        this._elGrid.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
        this._elGrid.innerHTML = '';

        for (const hex of palette)
        {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'ar-cpt__tile' + (hex.toLowerCase() === this._selected.toLowerCase() ? ' ar-cpt__tile--sel' : '');
            tile.style.background = hex;
            tile.style.width = `${size}px`;
            tile.style.height = `${size}px`;
            tile.title = hex;
            tile.dataset.color = hex;
            tile.addEventListener('click', () => this.setColor(hex));
            this._elGrid.appendChild(tile);
        }
    }

    private _resolvePalette(): string[]
    {
        const p = this._get<string | string[]>('palette', 'tailwind');
        if (Array.isArray(p)) return p;
        return PALETTES[p] || PALETTES['tailwind']!;
    }

    private _addRecent(hex: string): void
    {
        const max = this._get<number>('recentMax', 12);
        const idx = this._recent.indexOf(hex);
        if (idx >= 0) this._recent.splice(idx, 1);
        this._recent.unshift(hex);
        if (this._recent.length > max) this._recent.length = max;
        this._renderRecent();
    }

    private _renderRecent(): void
    {
        if (!this._elRecent) return;
        const size = this._get<number>('tileSize', 28);
        this._elRecent.innerHTML = this._recent.map(c =>
            `<button type="button" class="ar-cpt__tile" style="background:${c};width:${size}px;height:${size}px" data-color="${c}" title="${c}"></button>`
        ).join('');
        this._elRecent.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(btn => {
            btn.addEventListener('click', () => this.setColor(btn.dataset.color!));
        });
    }

    private _refreshSelection(): void
    {
        const sel = this._selected.toLowerCase();
        this._elGrid.querySelectorAll<HTMLElement>('.ar-cpt__tile').forEach(t => {
            t.classList.toggle('ar-cpt__tile--sel', t.dataset.color?.toLowerCase() === sel);
        });
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-cpt-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-cpt-styles';
        s.textContent = `
.ar-cpt { display:inline-flex; flex-direction:column; gap:8px; padding:12px; background:#1e1e1e; border:1px solid #333; border-radius:8px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; }
.ar-cpt__grid, .ar-cpt__recent { display:grid; gap:3px; }
.ar-cpt__recent { grid-template-columns:repeat(auto-fill, 28px); }
.ar-cpt__sep { font:600 10px sans-serif; color:#888; letter-spacing:.06em; text-transform:uppercase; padding-top:4px; }
.ar-cpt__tile { border:1px solid #444; border-radius:3px; cursor:pointer; padding:0; transition:transform .08s; }
.ar-cpt__tile:hover { transform:scale(1.12); border-color:#fff; z-index:1; }
.ar-cpt__tile--sel { border-color:#e40c88; box-shadow:0 0 0 2px rgba(228,12,136,0.4); }
.ar-cpt__input-row { display:flex; gap:6px; align-items:center; }
.ar-cpt__inp { flex:1; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:5px 8px; font:12px ui-monospace,monospace; border-radius:3px; }
.ar-cpt__inp:focus { outline:none; border-color:#e40c88; }
.ar-cpt__cpc { width:32px; height:28px; border:1px solid #333; border-radius:3px; padding:0; background:transparent; cursor:pointer; }
`;
        document.head.appendChild(s);
    }
}
