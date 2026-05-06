/**
 * @module    LinesPalette2D
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * 2D drawing palette tailored to *profile creation*: lines, arcs, polylines,
 * splines, plus closure operations and the profile-to-3D conversion choices
 * (extrude / revolve / sweep / loft). The pipeline this enables is:
 *
 *   draw planar profile (line tools)
 *           ↓
 *   close + select        (this palette)
 *           ↓
 *   apply 3D modifier     (PaletteModifiers3D / direct call)
 *           ↓
 *   3D mesh               (Three.js / WebGPU)
 *
 * Tool groups:
 *
 *   draw    — line, arc, polyline, spline, freehand, rect, ellipse, polygon
 *   close   — close path, open path, reverse direction
 *   to-3d   — extrude (linear), revolve (rotate around axis),
 *             sweep (along path), loft (between profiles)
 *
 * The palette only emits events; consumer (Wires/Daedalus) maps them to
 * actual canvas behaviour and 3D geometry generation.
 *
 * @example
 *   import { LinesPalette2D } from 'ariannajs/components/gfx3d';
 *
 *   const pl = new LinesPalette2D('#lines2d');
 *   pl.on('tool',    e => canvas.setMode(e.tool));
 *   pl.on('action',  e => canvas.run(e.action));     // close, reverse, etc.
 *   pl.on('to-3d',   e => buildMeshFrom2D(e.kind, e.params));
 *
 *   pl.setTool('arc');
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Built-in tool catalogue ─────────────────────────────────────────────────

export interface LineTool {
    id        : string;
    label     : string;
    icon      : string;
    shortcut? : string;
    /** 'tool'   = stays selected (drawing mode);
     *  'action' = fires once and returns to previous tool;
     *  'to-3d'  = profile-to-3D conversion. */
    behaviour : 'tool' | 'action' | 'to-3d';
    group     : 'draw' | 'close' | 'to-3d';
}

const BUILTIN: LineTool[] = [
    // Drawing primitives
    { id: 'line',      label: 'Line',      icon: '╱',  shortcut: 'L', behaviour: 'tool',   group: 'draw' },
    { id: 'arc',       label: 'Arc',       icon: '◜',  shortcut: 'A', behaviour: 'tool',   group: 'draw' },
    { id: 'polyline',  label: 'Polyline',  icon: '⌇',  shortcut: 'P', behaviour: 'tool',   group: 'draw' },
    { id: 'spline',    label: 'Spline',    icon: '∿',  shortcut: 'S', behaviour: 'tool',   group: 'draw' },
    { id: 'freehand',  label: 'Freehand',  icon: '✎',  shortcut: 'F', behaviour: 'tool',   group: 'draw' },
    { id: 'rect',      label: 'Rect',      icon: '▭',  shortcut: 'R', behaviour: 'tool',   group: 'draw' },
    { id: 'ellipse',   label: 'Ellipse',   icon: '◯',  shortcut: 'O', behaviour: 'tool',   group: 'draw' },
    { id: 'polygon',   label: 'Polygon',   icon: '⬡',  shortcut: 'G', behaviour: 'tool',   group: 'draw' },

    // Path-closure actions
    { id: 'close',     label: 'Close',     icon: '⊙',  shortcut: 'C', behaviour: 'action', group: 'close' },
    { id: 'open',      label: 'Open',      icon: '◌',                 behaviour: 'action', group: 'close' },
    { id: 'reverse',   label: 'Reverse',   icon: '⇌',                 behaviour: 'action', group: 'close' },

    // 2D → 3D conversions
    { id: 'extrude',   label: 'Extrude',   icon: '⬚',                 behaviour: 'to-3d',  group: 'to-3d' },
    { id: 'revolve',   label: 'Revolve',   icon: '⟳',                 behaviour: 'to-3d',  group: 'to-3d' },
    { id: 'sweep',     label: 'Sweep',     icon: '↪',                 behaviour: 'to-3d',  group: 'to-3d' },
    { id: 'loft',      label: 'Loft',      icon: '☷',                 behaviour: 'to-3d',  group: 'to-3d' },
];

// ── Options ──────────────────────────────────────────────────────────────────

export interface LinesPalette2DOptions extends CtrlOptions {
    /** Initial tool (drawing mode). Default 'line'. */
    activeTool? : string;
    /** Layout. Default 'vertical'. */
    layout?     : 'vertical' | 'horizontal';
    /** Show keyboard shortcuts in tooltips. Default true. */
    showShortcuts? : boolean;
    /** Disable global keyboard shortcuts. Default false. */
    disableHotkeys? : boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export class LinesPalette2D extends Control<LinesPalette2DOptions>
{
    private _tools  : LineTool[] = BUILTIN.slice();
    private _active : string | null = null;
    private _btns   : Map<string, HTMLButtonElement> = new Map();

    private _onKeyBound = (e: KeyboardEvent) => this._onKey(e);

    constructor(container: string | HTMLElement | null, opts: LinesPalette2DOptions = {})
    {
        super(container, 'div', {
            activeTool     : 'line',
            layout         : 'vertical',
            showShortcuts  : true,
            disableHotkeys : false,
            ...opts,
        });

        this.el.className = `ar-pal2d ar-pal2d--${this._get<string>('layout', 'vertical')}${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._build();

        const init = this._get<string>('activeTool', 'line');
        if (init && this._tools.find(t => t.id === init && t.behaviour === 'tool'))
            this.setTool(init);

        if (!this._get<boolean>('disableHotkeys', false))
            window.addEventListener('keydown', this._onKeyBound);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Currently active drawing tool, or null. */
    getTool(): string | null { return this._active; }

    /**
     * Set the active drawing tool. Only `behaviour: 'tool'` items can be
     * "active". Pass null to deactivate. Returns this for chaining.
     */
    setTool(id: string | null): this
    {
        if (id !== null)
        {
            const t = this._tools.find(x => x.id === id);
            if (!t) { console.warn('[LinesPalette2D] unknown tool:', id); return this; }
            if (t.behaviour !== 'tool')
            {
                console.warn(`[LinesPalette2D] '${id}' is a ${t.behaviour}, use trigger() instead`);
                return this;
            }
        }
        const prev = this._active;
        this._active = id;
        this._refreshButtons();
        this._emit('tool', { tool: id, prev });
        return this;
    }

    /**
     * Trigger an action or to-3d conversion. Actions don't change the active
     * tool. Emits the appropriate event ('action' or 'to-3d') with the id.
     */
    trigger(id: string, params?: Record<string, unknown>): this
    {
        const t = this._tools.find(x => x.id === id);
        if (!t) { console.warn('[LinesPalette2D] unknown tool:', id); return this; }
        if (t.behaviour === 'tool')
        {
            console.warn(`[LinesPalette2D] '${id}' is a tool, use setTool() instead`);
            return this;
        }
        this._emit(t.behaviour === 'to-3d' ? 'to-3d' : 'action',
                   { kind: id, action: id, params: params || {} });
        return this;
    }

    /** All tools (drawing + actions + to-3d). */
    getTools(): LineTool[] { return this._tools.slice(); }

    /** Detach listeners. */
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
            if (t.group !== lastGroup && lastGroup !== undefined)
            {
                const sep = document.createElement('div');
                sep.className = 'ar-pal2d__sep';
                this.el.appendChild(sep);
            }
            lastGroup = t.group;

            const b = document.createElement('button');
            b.className = `ar-pal2d__btn ar-pal2d__btn--${t.behaviour}`;
            b.dataset.tool = t.id;
            b.innerHTML = `<span class="ar-pal2d__icon">${escapeHtml(t.icon)}</span>`;
            b.title = showShortcuts && t.shortcut ? `${t.label} (${t.shortcut})` : t.label;
            b.addEventListener('click', () => {
                if (t.behaviour === 'tool') this.setTool(t.id);
                else                        this.trigger(t.id);
            });
            this.el.appendChild(b);
            this._btns.set(t.id, b);
        }

        this._refreshButtons();
    }

    private _refreshButtons(): void
    {
        for (const [id, btn] of this._btns)
            btn.classList.toggle('ar-pal2d__btn--active', id === this._active);
    }

    private _onKey(e: KeyboardEvent): void
    {
        const tg = e.target as HTMLElement;
        if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' ||
                  (tg as HTMLElement).isContentEditable)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        const k = e.key.toUpperCase();
        const t = this._tools.find(x => x.shortcut?.toUpperCase() === k);
        if (!t) return;
        e.preventDefault();
        if (t.behaviour === 'tool') this.setTool(t.id);
        else                        this.trigger(t.id);
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-pal2d-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-pal2d-styles';
        s.textContent = `
.ar-pal2d { display:inline-flex; gap:2px; padding:6px; background:#1e1e1e; border:1px solid #333; border-radius:6px; user-select:none; }
.ar-pal2d--vertical   { flex-direction:column; }
.ar-pal2d--horizontal { flex-direction:row; }
.ar-pal2d__btn { background:transparent; border:1px solid transparent; color:#d4d4d4; width:34px; height:34px; padding:0; cursor:pointer; border-radius:3px; font:18px sans-serif; display:flex; align-items:center; justify-content:center; transition:background .12s, border-color .12s; }
.ar-pal2d__btn:hover { background:#2a2a2a; }
.ar-pal2d__btn--active { background:#e40c88; border-color:#e40c88; color:#fff; }
.ar-pal2d__btn--action { color:#22c55e; }
.ar-pal2d__btn--to-3d  { color:#f59e0b; }
.ar-pal2d__icon { line-height:1; pointer-events:none; }
.ar-pal2d__sep { background:#333; }
.ar-pal2d--vertical   .ar-pal2d__sep { height:1px; margin:4px 4px; }
.ar-pal2d--horizontal .ar-pal2d__sep { width:1px;  margin:4px 4px; }
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
