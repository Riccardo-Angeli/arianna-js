/**
 * @module    CameraViewer3D
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Industry-standard 3D viewport widget — 4 panes laid out as:
 *
 *   ┌─────────┬─────────┐
 *   │   Top   │  Front  │
 *   │   (-Y)  │  (-Z)   │
 *   ├─────────┼─────────┤
 *   │  Side   │ Perspec │
 *   │  (+X)   │   tive  │
 *   └─────────┴─────────┘
 *
 * Each pane displays:
 *   • A render surface (consumer-supplied: SVG, canvas, three.js wrapper, etc.)
 *   • An overlay with axis gizmo (X red, Y green, Z blue)
 *   • Pane label (TOP / FRONT / SIDE / PERSPECTIVE)
 *   • Camera info (zoom %, focal length for perspective)
 *
 * The widget owns:
 *   • Layout (grid, splitters between panes)
 *   • Camera state per pane (position, target, zoom)
 *   • Pane focus (click → activate; one pane is "active" at a time)
 *   • Maximize/restore (double-click pane to toggle)
 *   • Pan/orbit interactions on the active pane (events emitted; consumers
 *     translate to their own renderer's camera ops)
 *
 * It does NOT own a renderer — consumers mount their own SVG / canvas / etc.
 * into the `surface` element of each pane and listen for `camera` events to
 * keep their renderer's camera in sync.
 *
 * @example
 *   import { CameraViewer3D } from 'ariannajs/components/gfx3d';
 *
 *   const cv = new CameraViewer3D('#viewport');
 *   cv.on('camera', e => myRenderer.updateCamera(e.pane, e.position, e.target, e.zoom));
 *   cv.on('focus',  e => console.log('active pane:', e.pane));
 *
 *   // Mount three.js / canvas into a pane's surface
 *   cv.getPane('perspective').surface.appendChild(threeRenderer.domElement);
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export type PaneId = 'top' | 'front' | 'side' | 'perspective';
export type ProjectionKind = 'orthographic' | 'perspective';

export interface Vec3 { x: number; y: number; z: number; }

export interface Camera {
    /** World-space camera position. */
    position : Vec3;
    /** What the camera looks at (world space). */
    target   : Vec3;
    /** Zoom factor for orthographic panes; FOV-derived scale for perspective. */
    zoom     : number;
    kind     : ProjectionKind;
}

export interface Pane {
    id       : PaneId;
    label    : string;
    /** Consumer mounts their renderer here. */
    surface  : HTMLElement;
    /** The chrome / overlay container (axes, label). Don't mount renderers here. */
    overlay  : HTMLElement;
    camera   : Camera;
}

export interface CameraViewer3DOptions extends CtrlOptions {
    /** CSS width of the whole widget. Default '100%'. */
    width?  : string;
    /** CSS height. Default '600px'. */
    height? : string;
    /** Show axis gizmo per pane. Default true. */
    showAxes? : boolean;
    /** Show pane labels. Default true. */
    showLabels? : boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CAMERAS: Record<PaneId, Camera> = {
    top:         { position: { x: 0, y: 10, z: 0 },   target: { x: 0, y: 0, z: 0 }, zoom: 1, kind: 'orthographic' },
    front:       { position: { x: 0, y: 0,  z: 10 },  target: { x: 0, y: 0, z: 0 }, zoom: 1, kind: 'orthographic' },
    side:        { position: { x: 10, y: 0, z: 0 },   target: { x: 0, y: 0, z: 0 }, zoom: 1, kind: 'orthographic' },
    perspective: { position: { x: 6, y: 5, z: 6 },    target: { x: 0, y: 0, z: 0 }, zoom: 1, kind: 'perspective'  },
};

const PANE_LABELS: Record<PaneId, string> = {
    top: 'TOP', front: 'FRONT', side: 'SIDE', perspective: 'PERSPECTIVE',
};

// ── Component ────────────────────────────────────────────────────────────────

export class CameraViewer3D extends Control<CameraViewer3DOptions>
{
    private _panes   : Map<PaneId, Pane> = new Map();
    private _active  : PaneId = 'perspective';
    private _maximized: PaneId | null = null;

    private _elGrid! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: CameraViewer3DOptions = {})
    {
        super(container, 'div', {
            width      : '100%',
            height     : '600px',
            showAxes   : true,
            showLabels : true,
            ...opts,
        });

        this.el.className = `ar-camera3d${opts.class ? ' ' + opts.class : ''}`;
        this.el.style.width  = this._get<string>('width',  '100%');
        this.el.style.height = this._get<string>('height', '600px');

        this._injectStyles();
        this._build();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Get a pane (with `surface` to mount renderers, `camera`, etc.). */
    getPane(id: PaneId): Pane
    {
        const p = this._panes.get(id);
        if (!p) throw new Error(`unknown pane: ${id}`);
        return p;
    }

    /** Currently active (focused) pane id. */
    getActive(): PaneId { return this._active; }

    /** Focus a pane programmatically (mouse interactions update this). */
    setActive(id: PaneId): this
    {
        if (this._active === id) return this;
        this._active = id;
        this._refreshFocus();
        this._emit('focus', { pane: id });
        return this;
    }

    /** Maximize a pane to fill the whole viewer; passing same id again = restore. */
    toggleMaximize(id?: PaneId): this
    {
        const t = id ?? this._active;
        this._maximized = this._maximized === t ? null : t;
        this._refreshLayout();
        this._emit('maximize', { pane: this._maximized });
        return this;
    }

    /** Update a pane's camera. Emits `camera` so consumers can sync renderers. */
    setCamera(id: PaneId, camera: Partial<Camera>): this
    {
        const p = this._panes.get(id);
        if (!p) return this;
        if (camera.position) p.camera.position = { ...camera.position };
        if (camera.target)   p.camera.target   = { ...camera.target };
        if (camera.zoom !== undefined) p.camera.zoom = camera.zoom;
        if (camera.kind)     p.camera.kind     = camera.kind;
        this._refreshOverlay(p);
        this._emit('camera', { pane: id, ...p.camera });
        return this;
    }

    /** Get a pane's camera (deep-cloned). */
    getCamera(id: PaneId): Camera
    {
        const p = this._panes.get(id);
        if (!p) throw new Error(`unknown pane: ${id}`);
        return {
            position: { ...p.camera.position },
            target:   { ...p.camera.target },
            zoom:     p.camera.zoom,
            kind:     p.camera.kind,
        };
    }

    /** Reset all cameras to default positions. */
    resetCameras(): this
    {
        for (const id of Object.keys(DEFAULT_CAMERAS) as PaneId[])
        {
            this.setCamera(id, DEFAULT_CAMERAS[id]);
        }
        return this;
    }

    // ── Build + render ─────────────────────────────────────────────────────

    protected _build(): void
    {
        this.el.innerHTML = `<div class="ar-camera3d__grid" data-r="grid"></div>`;
        this._elGrid = this.el.querySelector<HTMLElement>('[data-r="grid"]')!;

        for (const id of Object.keys(DEFAULT_CAMERAS) as PaneId[])
        {
            const paneEl = document.createElement('div');
            paneEl.className = 'ar-camera3d__pane';
            paneEl.dataset.pane = id;

            const surface = document.createElement('div');
            surface.className = 'ar-camera3d__surface';

            const overlay = document.createElement('div');
            overlay.className = 'ar-camera3d__overlay';

            paneEl.appendChild(surface);
            paneEl.appendChild(overlay);
            this._elGrid.appendChild(paneEl);

            const pane: Pane = {
                id, label: PANE_LABELS[id], surface, overlay,
                camera: { ...DEFAULT_CAMERAS[id], position: { ...DEFAULT_CAMERAS[id].position }, target: { ...DEFAULT_CAMERAS[id].target } },
            };
            this._panes.set(id, pane);

            this._buildOverlay(pane);
            this._wirePane(paneEl, pane);
        }

        this._refreshFocus();
        this._refreshLayout();
    }

    private _buildOverlay(pane: Pane): void
    {
        const showAxes   = this._get<boolean>('showAxes',   true);
        const showLabels = this._get<boolean>('showLabels', true);

        pane.overlay.innerHTML = `
${showLabels ? `<div class="ar-camera3d__label">${pane.label}</div>` : ''}
<div class="ar-camera3d__info" data-r="info"></div>
${showAxes ? `<div class="ar-camera3d__axes" data-r="axes"></div>` : ''}
`;
        this._refreshOverlay(pane);
    }

    private _refreshOverlay(pane: Pane): void
    {
        const info = pane.overlay.querySelector<HTMLElement>('[data-r="info"]');
        if (info)
        {
            const z = pane.camera.zoom;
            const k = pane.camera.kind === 'perspective' ? 'persp' : 'ortho';
            info.textContent = `${k} · ${Math.round(z * 100)}%`;
        }
        const axes = pane.overlay.querySelector<HTMLElement>('[data-r="axes"]');
        if (axes) this._renderAxesGizmo(pane, axes);
    }

    /**
     * Render the per-pane XYZ axis gizmo. The gizmo's orientation depends on
     * the camera direction:
     *
     *   • Top         camera looks down -Y → X right, Z down
     *   • Front       camera looks down -Z → X right, Y up
     *   • Side        camera looks down +X → Z right, Y up (mirrored)
     *   • Perspective camera arbitrary    → project the world axes to screen
     */
    private _renderAxesGizmo(pane: Pane, root: HTMLElement): void
    {
        const id = pane.id;
        // Pre-computed axis directions for the orthographic panes (in screen
        // coordinates: X = right, Y = down). For the perspective pane, we
        // project the three world basis vectors onto the screen using a
        // simplistic orbital projection.
        let axes: Array<{ name: string; x: number; y: number; color: string }>;

        if (id === 'top')
        {
            // Looking -Y: world X → screen X, world Z → screen Y, world Y goes "into" the screen
            axes = [
                { name: 'X', x: 1,  y: 0,  color: '#ef4444' },
                { name: 'Z', x: 0,  y: 1,  color: '#3b82f6' },
                { name: 'Y', x: 0,  y: 0,  color: '#22c55e' },   // hidden / dot
            ];
        }
        else if (id === 'front')
        {
            // Looking -Z: world X → screen X, world Y → -screen Y, world Z into screen
            axes = [
                { name: 'X', x: 1,  y: 0,  color: '#ef4444' },
                { name: 'Y', x: 0,  y: -1, color: '#22c55e' },
                { name: 'Z', x: 0,  y: 0,  color: '#3b82f6' },   // dot
            ];
        }
        else if (id === 'side')
        {
            // Looking +X: world Z → -screen X, world Y → -screen Y, world X into screen
            axes = [
                { name: 'Z', x: -1, y: 0,  color: '#3b82f6' },
                { name: 'Y', x: 0,  y: -1, color: '#22c55e' },
                { name: 'X', x: 0,  y: 0,  color: '#ef4444' },   // dot
            ];
        }
        else
        {
            // Perspective — naive orbital: project onto a 30°/60° isometric-ish frame.
            // X right, Y up, Z out-of-page tilted.
            const tilt = -0.45;     // ~26°
            axes = [
                { name: 'X', x: Math.cos(tilt),    y: -Math.sin(tilt) * 0.4, color: '#ef4444' },
                { name: 'Y', x: 0,                 y: -1,                    color: '#22c55e' },
                { name: 'Z', x: -Math.cos(tilt),   y: -Math.sin(tilt) * 0.4, color: '#3b82f6' },
            ];
        }

        const r = 26;     // gizmo radius in px
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width',  '64'); svg.setAttribute('height', '64');
        svg.setAttribute('viewBox', '-32 -32 64 64');

        for (const a of axes)
        {
            if (a.x === 0 && a.y === 0)
            {
                const dot = document.createElementNS(svgNS, 'circle');
                dot.setAttribute('cx', '0'); dot.setAttribute('cy', '0');
                dot.setAttribute('r', '4');  dot.setAttribute('fill', a.color);
                svg.appendChild(dot);
                continue;
            }
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', '0'); line.setAttribute('y1', '0');
            line.setAttribute('x2', String(a.x * r)); line.setAttribute('y2', String(a.y * r));
            line.setAttribute('stroke', a.color); line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
            const lbl = document.createElementNS(svgNS, 'text');
            lbl.setAttribute('x', String(a.x * (r + 6))); lbl.setAttribute('y', String(a.y * (r + 6) + 3));
            lbl.setAttribute('fill', a.color);
            lbl.setAttribute('font-size', '10');
            lbl.setAttribute('font-family', 'ui-monospace,monospace');
            lbl.setAttribute('text-anchor', 'middle');
            lbl.textContent = a.name;
            svg.appendChild(lbl);
        }
        root.innerHTML = '';
        root.appendChild(svg);
    }

    private _wirePane(paneEl: HTMLElement, pane: Pane): void
    {
        // Click → focus
        paneEl.addEventListener('pointerdown', () => this.setActive(pane.id));
        // Double-click → maximize/restore
        paneEl.addEventListener('dblclick', () => this.toggleMaximize(pane.id));

        // Wheel → zoom
        paneEl.addEventListener('wheel', e => {
            e.preventDefault();
            const factor = Math.exp(-e.deltaY * 0.005);
            this.setCamera(pane.id, { zoom: pane.camera.zoom * factor });
        }, { passive: false });

        // Drag interactions: middle-mouse = pan, right-mouse / alt+left = orbit
        // We emit events; consumer's renderer applies them.
        paneEl.addEventListener('pointermove', e => {
            if (e.buttons === 0) return;       // no drag
            const orbit = (e.buttons & 2) !== 0 || e.altKey;
            const pan   = (e.buttons & 4) !== 0 || e.shiftKey;
            if (!orbit && !pan) return;
            this._emit(orbit ? 'orbit' : 'pan', {
                pane: pane.id, dx: e.movementX, dy: e.movementY,
            });
        });
        // Disable context menu so right-mouse can be used for orbit
        paneEl.addEventListener('contextmenu', e => e.preventDefault());
    }

    private _refreshFocus(): void
    {
        for (const [id, pane] of this._panes)
        {
            const el = pane.surface.parentElement!;
            el.classList.toggle('ar-camera3d__pane--active', id === this._active);
        }
    }

    private _refreshLayout(): void
    {
        if (this._maximized)
        {
            this._elGrid.classList.add('ar-camera3d__grid--maximized');
            for (const [id, pane] of this._panes)
            {
                pane.surface.parentElement!.style.display = id === this._maximized ? 'block' : 'none';
            }
        }
        else
        {
            this._elGrid.classList.remove('ar-camera3d__grid--maximized');
            for (const [, pane] of this._panes)
                pane.surface.parentElement!.style.display = '';
        }
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-camera3d-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-camera3d-styles';
        s.textContent = `
.ar-camera3d { position:relative; background:#0d0d0d; border:1px solid #333; border-radius:6px; overflow:hidden; }
.ar-camera3d__grid { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:1px; background:#333; height:100%; }
.ar-camera3d__grid--maximized { grid-template-columns:1fr; grid-template-rows:1fr; }
.ar-camera3d__pane { position:relative; background:#1e1e1e; overflow:hidden; cursor:default; }
.ar-camera3d__pane--active { outline:2px solid #e40c88; outline-offset:-2px; }
.ar-camera3d__surface { position:absolute; inset:0; }
.ar-camera3d__overlay { position:absolute; inset:0; pointer-events:none; }
.ar-camera3d__label { position:absolute; top:8px; left:10px; font:600 10px ui-monospace,monospace; color:#888; letter-spacing:.08em; pointer-events:auto; }
.ar-camera3d__pane--active .ar-camera3d__label { color:#e40c88; }
.ar-camera3d__info { position:absolute; bottom:8px; left:10px; font:10px ui-monospace,monospace; color:#666; }
.ar-camera3d__axes { position:absolute; bottom:8px; right:8px; width:64px; height:64px; pointer-events:none; }
`;
        document.head.appendChild(s);
    }
}
