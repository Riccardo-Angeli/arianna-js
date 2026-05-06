/**
 * @module    Canvas2D
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * 2D infinite canvas with pan, zoom and scroll — the foundation layer for
 * Wires, Daedalus and any 2D vector editor in AriannA. Provides:
 *
 *   • Infinite virtual coordinate space (no document size limit)
 *   • Pan: middle-mouse drag, space+drag, or two-finger trackpad
 *   • Zoom: ctrl/cmd+wheel, pinch, or programmatic API
 *   • Scroll: standard wheel scroll (vertical) + shift+wheel (horizontal)
 *   • Coordinate transforms: world ↔ screen, with scale & origin
 *   • Render layers stacked back-to-front
 *   • Grid background (toggleable, snap-aware)
 *   • Rulers on top + left edges (showing world units, in pixels by default)
 *
 * The Canvas2D itself does not render content — it provides the viewport,
 * the transform, and a child container into which consumer code mounts SVG
 * or Canvas elements. The consumer's elements should use world coordinates;
 * Canvas2D handles the transform via CSS `transform` on the content layer.
 *
 * @example
 *   import { Canvas2D } from 'ariannajs/components/gfx2d';
 *
 *   const cv = new Canvas2D('#root', {
 *       width: '100%',
 *       height: '600px',
 *       gridSize: 20,
 *       showRulers: true,
 *   });
 *
 *   // Mount a piece of SVG into the world
 *   const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
 *   svg.setAttribute('width', '200'); svg.setAttribute('height', '100');
 *   svg.innerHTML = '<rect width="200" height="100" fill="#3b82f6"/>';
 *   cv.world.appendChild(svg);
 *
 *   // Programmatic camera
 *   cv.zoomTo(2);
 *   cv.panTo(0, 0);
 *   cv.fitContent();
 *
 *   // Coordinate conversion
 *   const wp = cv.screenToWorld({ x: 300, y: 200 });
 *   const sp = cv.worldToScreen(wp);
 *
 *   cv.on('viewport', e => console.log(e.zoom, e.panX, e.panY));
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Options ──────────────────────────────────────────────────────────────────

export interface Canvas2DOptions extends CtrlOptions {
    /** CSS width. Default '100%'. */
    width?       : string;
    /** CSS height. Default '600px'. */
    height?      : string;
    /** Initial pan X in world units. Default 0. */
    panX?        : number;
    /** Initial pan Y in world units. Default 0. */
    panY?        : number;
    /** Initial zoom factor. 1 = identity. Default 1. */
    zoom?        : number;
    /** Min zoom (most zoomed out). Default 0.05. */
    zoomMin?     : number;
    /** Max zoom (most zoomed in). Default 32. */
    zoomMax?     : number;
    /** Grid step in world units (0 to disable). Default 20. */
    gridSize?    : number;
    /** Major grid every N minor steps. Default 5. */
    gridMajorEvery?: number;
    /** Show rulers on top + left. Default true. */
    showRulers?  : boolean;
    /** Background fill. Default '#0d0d0d'. */
    background?  : string;
}

export interface Point2D { x: number; y: number; }

// ── Component ────────────────────────────────────────────────────────────────

export class Canvas2D extends Control<Canvas2DOptions>
{
    // Camera state
    private _zoom    : number;
    private _panX    : number;
    private _panY    : number;
    private readonly _zoomMin: number;
    private readonly _zoomMax: number;

    // DOM refs
    private _elViewport! : HTMLElement;
    /** Public: consumer code mounts world content here. */
    world!               : HTMLElement;
    private _elGrid!     : HTMLElement;
    private _elRulerTop? : HTMLElement;
    private _elRulerLeft?: HTMLElement;
    private _elInfoTag!  : HTMLElement;

    // Interaction state
    private _spaceHeld  = false;
    private _panning    = false;
    private _panStartX  = 0;
    private _panStartY  = 0;
    private _panOrigX   = 0;
    private _panOrigY   = 0;

    constructor(container: string | HTMLElement | null, opts: Canvas2DOptions = {})
    {
        super(container, 'div', {
            width          : '100%',
            height         : '600px',
            panX           : 0,
            panY           : 0,
            zoom           : 1,
            zoomMin        : 0.05,
            zoomMax        : 32,
            gridSize       : 20,
            gridMajorEvery : 5,
            showRulers     : true,
            background     : '#0d0d0d',
            ...opts,
        });

        this.el.className = `ar-canvas2d${opts.class ? ' ' + opts.class : ''}`;
        this._zoom    = this._get<number>('zoom', 1);
        this._panX    = this._get<number>('panX', 0);
        this._panY    = this._get<number>('panY', 0);
        this._zoomMin = this._get<number>('zoomMin', 0.05);
        this._zoomMax = this._get<number>('zoomMax', 32);

        this._injectStyles();
        this._build();
    }

    // ── Public API: camera ──────────────────────────────────────────────────

    /** Current zoom factor. */
    getZoom(): number { return this._zoom; }

    /** Current pan in world units. */
    getPan(): Point2D { return { x: this._panX, y: this._panY }; }

    /**
     * Set zoom around an optional pivot in screen pixels (defaults to viewport
     * centre). World point under the pivot stays fixed during the zoom.
     */
    zoomTo(zoom: number, pivot?: Point2D): this
    {
        const newZoom = Math.max(this._zoomMin, Math.min(this._zoomMax, zoom));
        const rect = this._elViewport.getBoundingClientRect();
        const px = pivot ? pivot.x : rect.width / 2;
        const py = pivot ? pivot.y : rect.height / 2;

        // Keep the world point under the pivot fixed
        const worldBefore = this._screenToWorldRaw(px, py);
        this._zoom = newZoom;
        const worldAfter  = this._screenToWorldRaw(px, py);
        this._panX += worldAfter.x - worldBefore.x;
        this._panY += worldAfter.y - worldBefore.y;

        this._applyTransform();
        this._emit('viewport', { zoom: this._zoom, panX: this._panX, panY: this._panY });
        return this;
    }

    /** Multiply current zoom by `factor` around an optional screen pivot. */
    zoomBy(factor: number, pivot?: Point2D): this { return this.zoomTo(this._zoom * factor, pivot); }

    /** Set pan in world units. */
    panTo(x: number, y: number): this
    {
        this._panX = x;
        this._panY = y;
        this._applyTransform();
        this._emit('viewport', { zoom: this._zoom, panX: this._panX, panY: this._panY });
        return this;
    }

    /** Adjust pan by a delta in world units. */
    panBy(dx: number, dy: number): this { return this.panTo(this._panX + dx, this._panY + dy); }

    /**
     * Compute and apply a viewport that frames all child elements of `world`
     * with the given padding (world units).
     */
    fitContent(padding = 40): this
    {
        const bbox = this._worldBoundingBox();
        if (!bbox) return this;
        const rect = this._elViewport.getBoundingClientRect();
        const sx = rect.width  / (bbox.width  + padding * 2);
        const sy = rect.height / (bbox.height + padding * 2);
        const z  = Math.min(sx, sy);

        this._zoom = Math.max(this._zoomMin, Math.min(this._zoomMax, z));
        // Centre the bbox in the viewport
        this._panX = -(bbox.x + bbox.width  / 2) + (rect.width  / 2) / this._zoom;
        this._panY = -(bbox.y + bbox.height / 2) + (rect.height / 2) / this._zoom;
        this._applyTransform();
        this._emit('viewport', { zoom: this._zoom, panX: this._panX, panY: this._panY });
        return this;
    }

    /** Reset to identity (zoom=1, pan=0,0). */
    resetView(): this
    {
        this._zoom = 1; this._panX = 0; this._panY = 0;
        this._applyTransform();
        this._emit('viewport', { zoom: this._zoom, panX: this._panX, panY: this._panY });
        return this;
    }

    // ── Public API: coordinate conversion ──────────────────────────────────

    /** Screen pixel (relative to viewport top-left) → world coordinates. */
    screenToWorld(p: Point2D): Point2D
    {
        return this._screenToWorldRaw(p.x, p.y);
    }

    /** World coordinates → screen pixel (relative to viewport top-left). */
    worldToScreen(p: Point2D): Point2D
    {
        return {
            x: (p.x + this._panX) * this._zoom,
            y: (p.y + this._panY) * this._zoom,
        };
    }

    private _screenToWorldRaw(sx: number, sy: number): Point2D
    {
        return { x: sx / this._zoom - this._panX, y: sy / this._zoom - this._panY };
    }

    /** Bounding box of all children of `world` in world coordinates. */
    private _worldBoundingBox(): { x: number; y: number; width: number; height: number } | null
    {
        if (!this.world.children.length) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of Array.from(this.world.children) as HTMLElement[])
        {
            // We respect inline left/top + width/height as world-space hints
            const left   = parseFloat(c.style.left   || '0');
            const top    = parseFloat(c.style.top    || '0');
            const width  = parseFloat(c.style.width  || (c.getAttribute('width')  || '0'));
            const height = parseFloat(c.style.height || (c.getAttribute('height') || '0'));
            if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, left + width);
            maxY = Math.max(maxY, top + height);
        }
        if (!Number.isFinite(minX)) return null;
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    // ── Internal: build + transform ────────────────────────────────────────

    protected _build(): void
    {
        this.el.style.width  = this._get<string>('width',  '100%');
        this.el.style.height = this._get<string>('height', '600px');
        this.el.style.background = this._get<string>('background', '#0d0d0d');

        const showR = this._get<boolean>('showRulers', true);
        this.el.innerHTML = `
${showR ? '<div class="ar-canvas2d__ruler ar-canvas2d__ruler--top"  data-r="rulerTop"></div>' : ''}
${showR ? '<div class="ar-canvas2d__ruler ar-canvas2d__ruler--left" data-r="rulerLeft"></div>' : ''}
<div class="ar-canvas2d__viewport" data-r="viewport">
  <div class="ar-canvas2d__grid"  data-r="grid"></div>
  <div class="ar-canvas2d__world" data-r="world"></div>
</div>
<div class="ar-canvas2d__info" data-r="info">100%</div>`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elViewport = r('viewport');
        this.world       = r('world');
        this._elGrid     = r('grid');
        this._elInfoTag  = r('info');
        if (showR)
        {
            this._elRulerTop  = r('rulerTop');
            this._elRulerLeft = r('rulerLeft');
        }

        this._wireEvents();
        this._applyTransform();
    }

    private _wireEvents(): void
    {
        // Wheel: ctrl/cmd → zoom, otherwise scroll/pan
        this._elViewport.addEventListener('wheel', e =>
        {
            e.preventDefault();
            const rect = this._elViewport.getBoundingClientRect();
            const pivot: Point2D = { x: e.clientX - rect.left, y: e.clientY - rect.top };

            if (e.ctrlKey || e.metaKey)
            {
                // Zoom — exponential, smoother on trackpads
                const factor = Math.exp(-e.deltaY * 0.005);
                this.zoomBy(factor, pivot);
            }
            else
            {
                // Pan — vertical wheel = vertical pan, shift swaps to horizontal
                const dx = (e.shiftKey ? e.deltaY : e.deltaX) / this._zoom;
                const dy = (e.shiftKey ? 0        : e.deltaY) / this._zoom;
                this.panBy(-dx, -dy);
            }
        }, { passive: false });

        // Spacebar = pan tool
        window.addEventListener('keydown', e => { if (e.key === ' ') this._spaceHeld = true; });
        window.addEventListener('keyup',   e => { if (e.key === ' ') this._spaceHeld = false; });

        // Pointerdown — middle-mouse OR space+left-click → pan
        this._elViewport.addEventListener('pointerdown', e =>
        {
            const wantsPan = e.button === 1 || (e.button === 0 && this._spaceHeld);
            if (!wantsPan) return;

            e.preventDefault();
            this._panning   = true;
            this._panStartX = e.clientX;
            this._panStartY = e.clientY;
            this._panOrigX  = this._panX;
            this._panOrigY  = this._panY;
            this._elViewport.style.cursor = 'grabbing';
            this._elViewport.setPointerCapture(e.pointerId);
        });

        this._elViewport.addEventListener('pointermove', e =>
        {
            if (!this._panning) return;
            const dx = (e.clientX - this._panStartX) / this._zoom;
            const dy = (e.clientY - this._panStartY) / this._zoom;
            this.panTo(this._panOrigX + dx, this._panOrigY + dy);
        });

        this._elViewport.addEventListener('pointerup', e =>
        {
            if (!this._panning) return;
            this._panning = false;
            this._elViewport.style.cursor = '';
            try { this._elViewport.releasePointerCapture(e.pointerId); } catch { /* */ }
        });
    }

    /** Apply current camera state to the world and grid via CSS transforms. */
    private _applyTransform(): void
    {
        const z = this._zoom, px = this._panX, py = this._panY;
        // World layer: scale then translate (so pan stays in world units)
        this.world.style.transform = `scale(${z}) translate(${px}px, ${py}px)`;
        this.world.style.transformOrigin = '0 0';

        this._renderGrid();
        this._renderRulers();

        if (this._elInfoTag)
            this._elInfoTag.textContent = Math.round(z * 100) + '%';
    }

    /**
     * Render the grid using a CSS `background-image` so we don't pay the cost
     * of laying out individual divs. The background is sized in world units
     * and offset by the current pan.
     */
    private _renderGrid(): void
    {
        const g = this._get<number>('gridSize', 20);
        if (g <= 0) { this._elGrid.style.display = 'none'; return; }
        this._elGrid.style.display = 'block';

        const z = this._zoom;
        const major = this._get<number>('gridMajorEvery', 5);
        const stepMinor = g * z;
        const stepMajor = g * z * major;

        // Phase = (pan * zoom) mod step, in pixels — keeps the grid pinned
        const ofX = ((this._panX * z) % stepMinor + stepMinor) % stepMinor;
        const ofY = ((this._panY * z) % stepMinor + stepMinor) % stepMinor;

        this._elGrid.style.backgroundImage =
            `linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px),
             linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px)`;
        this._elGrid.style.backgroundSize =
            `${stepMinor}px ${stepMinor}px,
             ${stepMinor}px ${stepMinor}px,
             ${stepMajor}px ${stepMajor}px,
             ${stepMajor}px ${stepMajor}px`;
        this._elGrid.style.backgroundPosition =
            `${ofX}px 0, 0 ${ofY}px, ${ofX}px 0, 0 ${ofY}px`;
    }

    private _renderRulers(): void
    {
        if (!this._elRulerTop || !this._elRulerLeft) return;
        // For now we render a single CSS-gradient ruler. Detailed tick labels
        // are an optional enhancement; the ruler is still useful as a visual
        // anchor for screen-vs-world separation.
        const z = this._zoom;
        const g = this._get<number>('gridSize', 20);
        const stepMinor = g * z;
        const stepMajor = stepMinor * this._get<number>('gridMajorEvery', 5);
        const ofX = ((this._panX * z) % stepMinor + stepMinor) % stepMinor;
        const ofY = ((this._panY * z) % stepMinor + stepMinor) % stepMinor;

        this._elRulerTop.style.backgroundImage  = `linear-gradient(to right,  #555 1px, transparent 1px), linear-gradient(to right,  #888 1px, transparent 1px)`;
        this._elRulerTop.style.backgroundSize   = `${stepMinor}px 100%, ${stepMajor}px 100%`;
        this._elRulerTop.style.backgroundPosition = `${ofX}px 0, ${ofX}px 0`;

        this._elRulerLeft.style.backgroundImage  = `linear-gradient(to bottom, #555 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)`;
        this._elRulerLeft.style.backgroundSize   = `100% ${stepMinor}px, 100% ${stepMajor}px`;
        this._elRulerLeft.style.backgroundPosition = `0 ${ofY}px, 0 ${ofY}px`;
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-canvas2d-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-canvas2d-styles';
        s.textContent = `
.ar-canvas2d { position:relative; overflow:hidden; user-select:none; font:12px -apple-system,system-ui,sans-serif; color:#d4d4d4; }
.ar-canvas2d__ruler { position:absolute; background:#1a1a1a; pointer-events:none; }
.ar-canvas2d__ruler--top  { top:0; left:20px; right:0; height:20px; border-bottom:1px solid #333; }
.ar-canvas2d__ruler--left { top:20px; left:0; bottom:0; width:20px; border-right:1px solid #333; }
.ar-canvas2d__viewport { position:absolute; top:20px; left:20px; right:0; bottom:0; overflow:hidden; cursor:default; }
.ar-canvas2d__grid  { position:absolute; inset:0; pointer-events:none; }
.ar-canvas2d__world { position:absolute; top:0; left:0; transform-origin:0 0; pointer-events:auto; }
.ar-canvas2d__info  { position:absolute; bottom:8px; right:10px; background:rgba(0,0,0,0.6); padding:3px 8px; border-radius:3px; font:11px ui-monospace,monospace; pointer-events:none; }
`;
        document.head.appendChild(s);
    }
}
