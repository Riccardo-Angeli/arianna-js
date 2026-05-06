/**
 * @module    BezierEditor
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Interactive cubic Bézier path editor — Illustrator-style. Lets the user
 * build, edit and manipulate paths made of anchor points joined by cubic
 * Bézier segments. Each anchor has two control handles (`hIn`, `hOut`) that
 * can be either symmetric (mirrored), asymmetric (independent magnitudes,
 * mirrored direction), or fully independent (corner point).
 *
 *   ●─────╲                ╱─────●
 *    \     ╲              ╱     /
 *     ●     ╲            ╱     ●
 *           Anchor     Anchor
 *           (smooth)   (corner)
 *
 * Built-in interactions:
 *
 *   • Pen mode: click in empty space to add an anchor; drag to define the
 *     out-handle (and a mirrored in-handle on the next anchor's hIn).
 *   • Edit mode: drag anchors to move; drag handles to reshape; alt-drag a
 *     handle to break symmetry; double-click an anchor to toggle smooth/corner.
 *   • Delete mode: click an anchor to remove it.
 *   • Closed/open paths via `closePath()` / `openPath()`.
 *
 * Coordinate system is world-space — meant to be embedded inside a Canvas2D
 * (or any other transform-aware viewport). Set `pxPerUnit` to control the
 * displayed scale of handle dots.
 *
 * Output: an SVG `<path>` `d` attribute can be obtained via `toSVGPath()`.
 *
 * @example
 *   import { BezierEditor } from 'ariannajs/components/gfx2d';
 *
 *   const ed = new BezierEditor('#bezier', { width: 600, height: 400 });
 *   ed.setMode('pen');
 *   ed.on('change', () => console.log(ed.toSVGPath()));
 *
 *   // Programmatic build
 *   ed.addAnchor({ x: 100, y: 100 });
 *   ed.addAnchor({ x: 300, y: 100, hIn: { x: -50, y: 0 }, hOut: { x: 50, y: 0 } });
 *   ed.closePath();
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Vec2 { x: number; y: number; }

/**
 * One anchor point. `hIn` and `hOut` are stored relative to the anchor — so
 * `(0,0)` means the handle is on top of the anchor (a corner). Move them
 * outwards to make smooth Bézier transitions.
 */
export interface Anchor {
    x    : number;
    y    : number;
    hIn  : Vec2;
    hOut : Vec2;
    /** 'smooth' = handles mirrored & equal magnitude;
     *  'asym'   = handles mirrored but independent magnitudes;
     *  'corner' = handles fully independent. */
    kind : 'smooth' | 'asym' | 'corner';
}

export type BezierMode = 'pen' | 'edit' | 'delete';

export interface BezierEditorOptions extends CtrlOptions {
    /** SVG width. Default 600. */
    width?      : number;
    /** SVG height. Default 400. */
    height?     : number;
    /** Initial editing mode. Default 'pen'. */
    mode?       : BezierMode;
    /** Initial path. Default empty. */
    anchors?    : Anchor[];
    /** Whether the path is closed. Default false. */
    closed?     : boolean;
    /** Stroke colour for the path. Default '#e40c88'. */
    stroke?     : string;
    /** Stroke width. Default 2. */
    strokeWidth?: number;
    /** Fill colour ('none' to leave open). Default 'none'. */
    fill?       : string;
}

// ── Component ────────────────────────────────────────────────────────────────

export class BezierEditor extends Control<BezierEditorOptions>
{
    private _anchors : Anchor[] = [];
    private _closed  : boolean  = false;
    private _mode    : BezierMode;

    private _selected : number | null = null;          // selected anchor index
    private _draggingAnchor: number | null = null;     // index being dragged
    private _draggingHandle: { i: number; which: 'in' | 'out' } | null = null;

    // DOM
    private _svg!     : SVGSVGElement;
    private _gPath!   : SVGGElement;
    private _gOverlay!: SVGGElement;     // anchors + handles overlay

    constructor(container: string | HTMLElement | null, opts: BezierEditorOptions = {})
    {
        super(container, 'div', {
            width      : 600,
            height     : 400,
            mode       : 'pen',
            anchors    : [],
            closed     : false,
            stroke     : '#e40c88',
            strokeWidth: 2,
            fill       : 'none',
            ...opts,
        });

        this.el.className = `ar-bezier${opts.class ? ' ' + opts.class : ''}`;
        this._mode    = this._get<BezierMode>('mode', 'pen');
        this._anchors = (this._get<Anchor[]>('anchors', []) || []).map(a => this._cloneAnchor(a));
        this._closed  = this._get<boolean>('closed', false);

        this._injectStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** All current anchors (deep-cloned, safe to mutate). */
    getAnchors(): Anchor[] { return this._anchors.map(a => this._cloneAnchor(a)); }

    /** Replace all anchors. */
    setAnchors(arr: Anchor[]): this
    {
        this._anchors = arr.map(a => this._cloneAnchor(a));
        this._render();
        this._emitChange('replace');
        return this;
    }

    /** Add an anchor at the end of the path. */
    addAnchor(opts: Partial<Anchor> & Vec2): Anchor
    {
        const a: Anchor = {
            x: opts.x, y: opts.y,
            hIn  : opts.hIn  ? { ...opts.hIn  } : { x: 0, y: 0 },
            hOut : opts.hOut ? { ...opts.hOut } : { x: 0, y: 0 },
            kind : opts.kind ?? 'corner',
        };
        this._anchors.push(a);
        this._selected = this._anchors.length - 1;
        this._render();
        this._emitChange('add', { index: this._selected });
        return a;
    }

    /** Remove an anchor by index. */
    removeAnchor(index: number): this
    {
        if (index < 0 || index >= this._anchors.length) return this;
        this._anchors.splice(index, 1);
        if (this._selected === index) this._selected = null;
        else if (this._selected !== null && this._selected > index) this._selected--;
        this._render();
        this._emitChange('remove', { index });
        return this;
    }

    /** Update a single anchor's fields. */
    updateAnchor(index: number, patch: Partial<Anchor>): this
    {
        if (index < 0 || index >= this._anchors.length) return this;
        const a = this._anchors[index]!;
        if (patch.x !== undefined) a.x = patch.x;
        if (patch.y !== undefined) a.y = patch.y;
        if (patch.hIn)  a.hIn  = { ...patch.hIn };
        if (patch.hOut) a.hOut = { ...patch.hOut };
        if (patch.kind) a.kind = patch.kind;
        this._render();
        this._emitChange('update', { index });
        return this;
    }

    /** Close the path (last anchor connects back to first). */
    closePath(): this { this._closed = true;  this._render(); this._emitChange('close'); return this; }

    /** Open a previously-closed path. */
    openPath(): this  { this._closed = false; this._render(); this._emitChange('open');  return this; }

    /** Is the path closed? */
    isClosed(): boolean { return this._closed; }

    /** Set the editing mode (pen / edit / delete). */
    setMode(mode: BezierMode): this
    {
        this._mode = mode;
        this._svg.setAttribute('data-mode', mode);
        this._emit('mode', { mode });
        return this;
    }

    getMode(): BezierMode { return this._mode; }

    /**
     * Render the path as an SVG `d` attribute string. Supports both open
     * and closed paths, with cubic Bézier segments between anchors that
     * have handle points.
     */
    toSVGPath(): string
    {
        if (!this._anchors.length) return '';
        const a0 = this._anchors[0]!;
        const parts: string[] = [`M ${fmt(a0.x)} ${fmt(a0.y)}`];

        const segs = this._closed ? this._anchors.length : this._anchors.length - 1;
        for (let i = 0; i < segs; i++)
        {
            const a = this._anchors[i]!;
            const b = this._anchors[(i + 1) % this._anchors.length]!;
            const c1 = { x: a.x + a.hOut.x, y: a.y + a.hOut.y };
            const c2 = { x: b.x + b.hIn.x,  y: b.y + b.hIn.y  };
            parts.push(`C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(b.x)} ${fmt(b.y)}`);
        }
        if (this._closed) parts.push('Z');
        return parts.join(' ');
    }

    /** Index of the currently selected anchor, or null. */
    getSelected(): number | null { return this._selected; }

    /** Programmatically select an anchor. */
    select(index: number | null): this
    {
        this._selected = index;
        this._render();
        return this;
    }

    // ── Build + render ─────────────────────────────────────────────────────

    protected _build(): void
    {
        const w = this._get<number>('width',  600);
        const h = this._get<number>('height', 400);

        const svgNS = 'http://www.w3.org/2000/svg';
        this._svg = document.createElementNS(svgNS, 'svg') as SVGSVGElement;
        this._svg.setAttribute('width',  String(w));
        this._svg.setAttribute('height', String(h));
        this._svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        this._svg.setAttribute('class', 'ar-bezier__svg');
        this._svg.setAttribute('data-mode', this._mode);

        // Background hit area for canvas-level pen clicks
        const bg = document.createElementNS(svgNS, 'rect');
        bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
        bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h));
        bg.setAttribute('fill', 'transparent');
        bg.setAttribute('class', 'ar-bezier__bg');
        bg.addEventListener('pointerdown', e => this._onBgDown(e));
        this._svg.appendChild(bg);

        this._gPath    = document.createElementNS(svgNS, 'g') as SVGGElement;
        this._gOverlay = document.createElementNS(svgNS, 'g') as SVGGElement;
        this._gPath.setAttribute('class', 'ar-bezier__path-g');
        this._gOverlay.setAttribute('class', 'ar-bezier__overlay-g');
        this._svg.appendChild(this._gPath);
        this._svg.appendChild(this._gOverlay);

        this.el.appendChild(this._svg);
        this._render();
    }

    private _render(): void
    {
        this._gPath.innerHTML    = '';
        this._gOverlay.innerHTML = '';
        if (!this._anchors.length) return;

        const svgNS = 'http://www.w3.org/2000/svg';
        const stroke = this._get<string>('stroke', '#e40c88');
        const sw     = this._get<number>('strokeWidth', 2);
        const fill   = this._get<string>('fill', 'none');

        // Path
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', this.toSVGPath());
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', String(sw));
        path.setAttribute('fill', fill);
        this._gPath.appendChild(path);

        // Overlay: handles + anchors
        for (let i = 0; i < this._anchors.length; i++)
        {
            const a = this._anchors[i]!;
            const isSel = this._selected === i;

            // Lines from anchor to handles
            if (isSel || a.hIn.x !== 0 || a.hIn.y !== 0)
            {
                const lin = document.createElementNS(svgNS, 'line');
                lin.setAttribute('x1', fmt(a.x));        lin.setAttribute('y1', fmt(a.y));
                lin.setAttribute('x2', fmt(a.x + a.hIn.x));  lin.setAttribute('y2', fmt(a.y + a.hIn.y));
                lin.setAttribute('class', 'ar-bezier__handle-line');
                this._gOverlay.appendChild(lin);
            }
            if (isSel || a.hOut.x !== 0 || a.hOut.y !== 0)
            {
                const lout = document.createElementNS(svgNS, 'line');
                lout.setAttribute('x1', fmt(a.x));        lout.setAttribute('y1', fmt(a.y));
                lout.setAttribute('x2', fmt(a.x + a.hOut.x)); lout.setAttribute('y2', fmt(a.y + a.hOut.y));
                lout.setAttribute('class', 'ar-bezier__handle-line');
                this._gOverlay.appendChild(lout);
            }

            // Handle dots
            if (isSel)
            {
                if (a.hIn.x !== 0 || a.hIn.y !== 0)
                {
                    const hin = document.createElementNS(svgNS, 'circle');
                    hin.setAttribute('cx', fmt(a.x + a.hIn.x)); hin.setAttribute('cy', fmt(a.y + a.hIn.y));
                    hin.setAttribute('r', '4');
                    hin.setAttribute('class', 'ar-bezier__handle');
                    hin.dataset.role = 'h-in';
                    hin.dataset.idx  = String(i);
                    hin.addEventListener('pointerdown', e => this._onHandleDown(e, i, 'in'));
                    this._gOverlay.appendChild(hin);
                }
                if (a.hOut.x !== 0 || a.hOut.y !== 0)
                {
                    const hout = document.createElementNS(svgNS, 'circle');
                    hout.setAttribute('cx', fmt(a.x + a.hOut.x)); hout.setAttribute('cy', fmt(a.y + a.hOut.y));
                    hout.setAttribute('r', '4');
                    hout.setAttribute('class', 'ar-bezier__handle');
                    hout.dataset.role = 'h-out';
                    hout.dataset.idx  = String(i);
                    hout.addEventListener('pointerdown', e => this._onHandleDown(e, i, 'out'));
                    this._gOverlay.appendChild(hout);
                }
            }

            // Anchor dot
            const dot = document.createElementNS(svgNS, isSel ? 'rect' : 'circle');
            if (isSel)
            {
                (dot as SVGRectElement).setAttribute('x', fmt(a.x - 4));
                (dot as SVGRectElement).setAttribute('y', fmt(a.y - 4));
                (dot as SVGRectElement).setAttribute('width', '8');
                (dot as SVGRectElement).setAttribute('height', '8');
            }
            else
            {
                (dot as SVGCircleElement).setAttribute('cx', fmt(a.x));
                (dot as SVGCircleElement).setAttribute('cy', fmt(a.y));
                (dot as SVGCircleElement).setAttribute('r', '4');
            }
            dot.setAttribute('class', 'ar-bezier__anchor' + (isSel ? ' selected' : '') +
                                     (a.kind === 'corner' ? ' corner' : ''));
            dot.dataset.idx = String(i);
            dot.addEventListener('pointerdown', e => this._onAnchorDown(e as unknown as PointerEvent, i));
            dot.addEventListener('dblclick',    () => this._onAnchorDblClick(i));
            this._gOverlay.appendChild(dot);
        }
    }

    // ── Event handlers ─────────────────────────────────────────────────────

    private _onBgDown(e: PointerEvent): void
    {
        if (this._mode !== 'pen') { this._selected = null; this._render(); return; }
        e.preventDefault();
        const pt = this._svgCoord(e);
        const newAnchor = this.addAnchor({ x: pt.x, y: pt.y });
        this._selected = this._anchors.length - 1;

        // Press-drag to define the out-handle of the new anchor
        const idx = this._selected!;
        const startX = e.clientX, startY = e.clientY;
        (e.target as Element).setPointerCapture?.(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const cur = this._svgCoord(ev);
            const dx = cur.x - newAnchor.x, dy = cur.y - newAnchor.y;
            this.updateAnchor(idx, {
                hOut: { x: dx, y: dy },
                hIn:  { x: -dx, y: -dy },     // mirrored
                kind: 'smooth',
            });
            // Mark drag actually happened
            void (ev.clientX - startX);
            void (ev.clientY - startY);
        };
        const onUp = () => {
            this._svg.removeEventListener('pointermove', onMove);
            this._svg.removeEventListener('pointerup',   onUp);
        };
        this._svg.addEventListener('pointermove', onMove);
        this._svg.addEventListener('pointerup',   onUp);
    }

    private _onAnchorDown(e: PointerEvent, idx: number): void
    {
        e.preventDefault();
        e.stopPropagation();

        if (this._mode === 'delete') { this.removeAnchor(idx); return; }

        this._selected = idx;
        this._render();

        const a = this._anchors[idx]!;
        const start = { x: a.x, y: a.y };
        const startEv = this._svgCoord(e);
        (e.target as Element).setPointerCapture?.(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const cur = this._svgCoord(ev);
            this.updateAnchor(idx, {
                x: start.x + (cur.x - startEv.x),
                y: start.y + (cur.y - startEv.y),
            });
        };
        const onUp = () => {
            this._svg.removeEventListener('pointermove', onMove);
            this._svg.removeEventListener('pointerup',   onUp);
        };
        this._svg.addEventListener('pointermove', onMove);
        this._svg.addEventListener('pointerup',   onUp);
    }

    private _onHandleDown(e: PointerEvent, idx: number, which: 'in' | 'out'): void
    {
        e.preventDefault();
        e.stopPropagation();

        const a = this._anchors[idx]!;
        const startEv = this._svgCoord(e);
        const startHandle = which === 'in' ? { ...a.hIn } : { ...a.hOut };
        const breakSym = e.altKey;
        (e.target as Element).setPointerCapture?.(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const cur = this._svgCoord(ev);
            const newH = {
                x: startHandle.x + (cur.x - startEv.x),
                y: startHandle.y + (cur.y - startEv.y),
            };
            const patch: Partial<Anchor> = which === 'in' ? { hIn: newH } : { hOut: newH };
            // Auto-mirror the opposite handle unless alt-drag (break symmetry)
            if (!breakSym && a.kind !== 'corner')
            {
                if (which === 'in')  patch.hOut = { x: -newH.x, y: -newH.y };
                else                 patch.hIn  = { x: -newH.x, y: -newH.y };
            }
            else if (breakSym)
            {
                patch.kind = 'corner';
            }
            this.updateAnchor(idx, patch);
        };
        const onUp = () => {
            this._svg.removeEventListener('pointermove', onMove);
            this._svg.removeEventListener('pointerup',   onUp);
        };
        this._svg.addEventListener('pointermove', onMove);
        this._svg.addEventListener('pointerup',   onUp);
    }

    private _onAnchorDblClick(idx: number): void
    {
        const a = this._anchors[idx]!;
        const next: Anchor['kind'] = a.kind === 'corner' ? 'smooth' : 'corner';
        if (next === 'corner')
        {
            this.updateAnchor(idx, { kind: 'corner' });
        }
        else
        {
            // Recreate symmetric handles based on adjacent neighbours
            const prev = this._anchors[(idx - 1 + this._anchors.length) % this._anchors.length]!;
            const nxt  = this._anchors[(idx + 1) % this._anchors.length]!;
            const dx = (nxt.x - prev.x) / 4;
            const dy = (nxt.y - prev.y) / 4;
            this.updateAnchor(idx, {
                kind: 'smooth',
                hIn:  { x: -dx, y: -dy },
                hOut: { x:  dx, y:  dy },
            });
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Map a DOM pointer event to SVG-internal coordinates. */
    private _svgCoord(e: { clientX: number; clientY: number }): Vec2
    {
        const rect = this._svg.getBoundingClientRect();
        const w = this._get<number>('width', 600);
        const h = this._get<number>('height', 400);
        const sx = w / (rect.width  || w);
        const sy = h / (rect.height || h);
        return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    }

    private _cloneAnchor(a: Anchor): Anchor
    {
        return { x: a.x, y: a.y, hIn: { ...a.hIn }, hOut: { ...a.hOut }, kind: a.kind };
    }

    private _emitChange(kind: string, extra?: Record<string, unknown>): void
    {
        this._emit('change', { kind, ...(extra || {}) });
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-bezier-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-bezier-styles';
        s.textContent = `
.ar-bezier { display:inline-block; background:#0d0d0d; border:1px solid #333; border-radius:4px; }
.ar-bezier__svg { display:block; cursor:crosshair; }
.ar-bezier__svg[data-mode="edit"]   { cursor:default; }
.ar-bezier__svg[data-mode="delete"] { cursor:not-allowed; }
.ar-bezier__bg     { cursor:inherit; }
.ar-bezier__handle-line { stroke:rgba(228,12,136,0.5); stroke-width:1; }
.ar-bezier__handle      { fill:#fff; stroke:#e40c88; stroke-width:1.5; cursor:move; }
.ar-bezier__handle:hover { fill:#e40c88; }
.ar-bezier__anchor      { fill:#fff; stroke:#e40c88; stroke-width:1.5; cursor:move; }
.ar-bezier__anchor.corner { fill:#1e1e1e; }
.ar-bezier__anchor.selected { fill:#e40c88; stroke:#fff; }
`;
        document.head.appendChild(s);
    }
}

function fmt(n: number): string
{
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
