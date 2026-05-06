/**
 * @module    ToolsPalette
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Illustrator-style tool palette: vertical toolbar with mutually-exclusive
 * tool buttons grouped by purpose. Designed to drive the Wires/Daedalus
 * vector editors but works standalone — emits a `tool` event whenever the
 * active tool changes; consumer code maps the tool to canvas behaviour.
 *
 * Built-in tools:
 *
 *   ┌─┐
 *   │ ▶ │   selection      — pick & move
 *   │ ◇ │   direct-select  — pick anchor points / segments
 *   │ ✎ │   pen            — draw bezier paths
 *   │ ╱ │   line           — draw straight lines
 *   │ ◯ │   ellipse        — draw ellipses / circles
 *   │ ▭ │   rect           — draw rectangles
 *   │ ★ │   polygon        — draw stars / regular polygons
 *   │ ✏ │   pencil         — freehand
 *   │ ✦ │   magic-wand     — select by similar colour
 *   │ ⌫ │   eraser         — delete intersected geometry
 *   │ ✂ │   knife          — cut path along a stroke
 *   │ ◻ │   crop           — crop artboard / image
 *   │ 🎨│   eyedropper     — sample colour
 *   │ 🔍│   zoom           — click to zoom canvas
 *   │ ✋ │   hand           — pan canvas
 *   └─┘
 *
 * Custom tools can be added via `addTool(...)`. The active tool persists
 * until another is picked or `setTool(null)` is called.
 *
 * @example
 *   import { ToolsPalette } from 'ariannajs/components/gfx2d';
 *
 *   const pal = new ToolsPalette('#palette');
 *   pal.on('tool', e => canvas.setMode(e.tool));
 *
 *   pal.setTool('pen');
 *   console.log(pal.getTool());   // 'pen'
 *
 *   pal.addTool({ id: 'spiral', label: 'Spiral', icon: '🌀' });
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Built-in tool catalogue ─────────────────────────────────────────────────

export interface PaletteTool {
    id        : string;
    label     : string;
    icon      : string;        // unicode glyph or SVG path string
    /** Optional shortcut key (single letter). */
    shortcut? : string;
    /** Optional grouping label (separator before the next group). */
    group?    : string;
}

const BUILTIN_TOOLS: PaletteTool[] = [
    { id: 'select',        label: 'Selection',     icon: '▶',  shortcut: 'V', group: 'select' },
    { id: 'direct-select', label: 'Direct select', icon: '◇',  shortcut: 'A', group: 'select' },
    { id: 'magic-wand',    label: 'Magic wand',    icon: '✦',  shortcut: 'Y', group: 'select' },

    { id: 'pen',           label: 'Pen',           icon: '✎',  shortcut: 'P', group: 'draw'   },
    { id: 'pencil',        label: 'Pencil',        icon: '✏',  shortcut: 'N', group: 'draw'   },
    { id: 'line',          label: 'Line',          icon: '╱',  shortcut: '\\', group: 'draw'  },

    { id: 'rect',          label: 'Rectangle',     icon: '▭',  shortcut: 'M', group: 'shape'  },
    { id: 'ellipse',       label: 'Ellipse',       icon: '◯',  shortcut: 'L', group: 'shape'  },
    { id: 'polygon',       label: 'Polygon',       icon: '★',  shortcut: '*', group: 'shape'  },

    { id: 'eraser',        label: 'Eraser',        icon: '⌫',  shortcut: 'E', group: 'edit'   },
    { id: 'knife',         label: 'Knife',         icon: '✂',  shortcut: 'C', group: 'edit'   },
    { id: 'crop',          label: 'Crop',          icon: '◻',  shortcut: 'X', group: 'edit'   },

    { id: 'eyedropper',    label: 'Eyedropper',    icon: '🎨', shortcut: 'I', group: 'view'   },
    { id: 'zoom',          label: 'Zoom',          icon: '🔍', shortcut: 'Z', group: 'view'   },
    { id: 'hand',          label: 'Hand',          icon: '✋', shortcut: 'H', group: 'view'   },
];

// ── Options ──────────────────────────────────────────────────────────────────

export interface ToolsPaletteOptions extends CtrlOptions {
    /** Initially active tool id. Default 'select'. */
    activeTool? : string;
    /** Layout. Default 'vertical'. */
    layout?     : 'vertical' | 'horizontal';
    /** Show keyboard shortcuts as tooltips. Default true. */
    showShortcuts? : boolean;
    /** Use the built-in tool set + any custom additions. Default true. Set
     *  to false to start from a blank palette. */
    useBuiltins? : boolean;
    /** Disable global keyboard shortcuts. Default false. */
    disableHotkeys? : boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export class ToolsPalette extends Control<ToolsPaletteOptions>
{
    private _tools  : PaletteTool[] = [];
    private _active : string | null = null;
    private _btns   : Map<string, HTMLButtonElement> = new Map();

    private _onKeyBound = (e: KeyboardEvent) => this._onKey(e);

    constructor(container: string | HTMLElement | null, opts: ToolsPaletteOptions = {})
    {
        super(container, 'div', {
            activeTool     : 'select',
            layout         : 'vertical',
            showShortcuts  : true,
            useBuiltins    : true,
            disableHotkeys : false,
            ...opts,
        });

        this.el.className = `ar-palette ar-palette--${this._get<string>('layout', 'vertical')}${opts.class ? ' ' + opts.class : ''}`;
        if (this._get<boolean>('useBuiltins', true)) this._tools.push(...BUILTIN_TOOLS);

        this._injectStyles();
        this._build();

        const initial = this._get<string>('activeTool', 'select');
        if (initial && this._tools.find(t => t.id === initial)) this.setTool(initial);

        if (!this._get<boolean>('disableHotkeys', false))
            window.addEventListener('keydown', this._onKeyBound);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Currently active tool id, or null if none. */
    getTool(): string | null { return this._active; }

    /**
     * Set the active tool. Pass null to deactivate. Returns this for chaining.
     * Emits `tool` event { tool, prev }.
     */
    setTool(id: string | null): this
    {
        if (id !== null && !this._tools.find(t => t.id === id))
        {
            console.warn('[ToolsPalette] unknown tool:', id);
            return this;
        }
        const prev = this._active;
        this._active = id;
        this._refreshButtons();
        this._emit('tool', { tool: id, prev });
        return this;
    }

    /** All tools currently in the palette (in display order). */
    getTools(): PaletteTool[] { return this._tools.slice(); }

    /** Add a custom tool to the palette. */
    addTool(tool: PaletteTool): this
    {
        if (this._tools.find(t => t.id === tool.id))
        {
            console.warn('[ToolsPalette] tool id already exists:', tool.id);
            return this;
        }
        this._tools.push(tool);
        this._build();   // rebuild the toolbar to insert the new button
        return this;
    }

    /** Remove a tool from the palette. */
    removeTool(id: string): this
    {
        const i = this._tools.findIndex(t => t.id === id);
        if (i < 0) return this;
        this._tools.splice(i, 1);
        if (this._active === id) this._active = null;
        this._build();
        return this;
    }

    /** Detach all listeners. Call when removing the palette from the DOM. */
    destroy(): void
    {
        if (!this._get<boolean>('disableHotkeys', false))
            window.removeEventListener('keydown', this._onKeyBound);
    }

    // ── Internal: build + render ───────────────────────────────────────────

    protected _build(): void
    {
        const showShortcuts = this._get<boolean>('showShortcuts', true);
        this.el.innerHTML = '';
        this._btns.clear();

        let lastGroup: string | undefined;
        for (const t of this._tools)
        {
            // Insert a separator when the group changes
            if (t.group && t.group !== lastGroup && lastGroup !== undefined)
            {
                const sep = document.createElement('div');
                sep.className = 'ar-palette__sep';
                this.el.appendChild(sep);
            }
            lastGroup = t.group;

            const b = document.createElement('button');
            b.className = 'ar-palette__btn';
            b.dataset.tool = t.id;
            b.innerHTML = `<span class="ar-palette__icon">${escapeHtml(t.icon)}</span>`;
            b.title = showShortcuts && t.shortcut ? `${t.label} (${t.shortcut})` : t.label;
            b.addEventListener('click', () => this.setTool(t.id));
            this.el.appendChild(b);
            this._btns.set(t.id, b);
        }

        this._refreshButtons();
    }

    private _refreshButtons(): void
    {
        for (const [id, btn] of this._btns)
        {
            btn.classList.toggle('ar-palette__btn--active', id === this._active);
        }
    }

    private _onKey(e: KeyboardEvent): void
    {
        // Ignore if the user is typing in an input
        const tg = e.target as HTMLElement;
        if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' ||
                  (tg as HTMLElement).isContentEditable)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        const k = e.key.toUpperCase();
        const t = this._tools.find(x => x.shortcut?.toUpperCase() === k);
        if (t) { e.preventDefault(); this.setTool(t.id); }
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-palette-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-palette-styles';
        s.textContent = `
.ar-palette { display:inline-flex; gap:2px; padding:6px; background:#1e1e1e; border:1px solid #333; border-radius:6px; user-select:none; }
.ar-palette--vertical   { flex-direction:column; }
.ar-palette--horizontal { flex-direction:row; }
.ar-palette__btn { background:transparent; border:1px solid transparent; color:#d4d4d4; width:34px; height:34px; padding:0; cursor:pointer; border-radius:3px; font:18px sans-serif; display:flex; align-items:center; justify-content:center; transition:background .12s, border-color .12s; }
.ar-palette__btn:hover  { background:#2a2a2a; }
.ar-palette__btn--active { background:#e40c88; border-color:#e40c88; color:#fff; }
.ar-palette__icon { line-height:1; pointer-events:none; }
.ar-palette__sep { background:#333; }
.ar-palette--vertical   .ar-palette__sep { height:1px; margin:4px 4px; }
.ar-palette--horizontal .ar-palette__sep { width:1px;  margin:4px 4px; }
`;
        document.head.appendChild(s);
    }
}

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}
