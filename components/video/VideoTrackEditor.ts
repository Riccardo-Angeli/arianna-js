/**
 * @module    VideoTrackEditor
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Multi-track video editor (timeline pool) — DaVinci/Premiere-style cut,
 * move, resize, copy/paste of clips. Pure UI/data layer; rendering and
 * export are external (FFmpeg via Tauri or WebCodecs).
 *
 * Each clip references a video source (URL or File) and a sub-range of
 * its duration. Thumbnails are auto-generated from the source.
 *
 * @example
 *   import { VideoTrackEditor } from 'ariannajs/components/audio';
 *
 *   const ed = new VideoTrackEditor('#root', { tracks: 3 });
 *
 *   const src = await ed.loadSource('clip.mp4');
 *   ed.addClip('v1', { source: src, start: 0, sourceIn: 0, duration: 5 });
 *
 *   ed.on('change', e => console.log(e));
 *   const project = ed.export();   // serializable project JSON
 */

import { AudioComponent, type AudioComponentOptions } from '../audio/AudioComponent.ts';

export interface VideoTrack {
    id     : string;
    name   : string;
    color? : string;
    type?  : 'video' | 'audio';
    muted? : boolean;
    soloed?: boolean;
}

export interface VideoSource {
    id        : string;
    url       : string;
    duration  : number;
    width?    : number;
    height?   : number;
    thumbnails: string[];      // base64 dataURLs at evenly-spaced times
}

export interface VideoClip {
    id        : string;
    trackId   : string;
    sourceId  : string;
    /** Start on the timeline in seconds. */
    start     : number;
    /** Where in the source we begin (in-point), in seconds. */
    sourceIn  : number;
    /** Clip duration in seconds. */
    duration  : number;
    name?     : string;
}

export interface VideoTrackEditorOptions extends AudioComponentOptions {
    tracks?   : number;
    pxPerSec? : number;
    zoom?     : number;
}

export interface ExportedProject {
    tracks  : VideoTrack[];
    clips   : VideoClip[];
    sources : Array<Pick<VideoSource, 'id' | 'url' | 'duration' | 'width' | 'height'>>;
}

const TRACK_HEIGHT = 60;

export class VideoTrackEditor extends AudioComponent<VideoTrackEditorOptions> {
    private _tracks  : VideoTrack[]  = [];
    private _clips   : VideoClip[]   = [];
    private _sources : Map<string, VideoSource> = new Map();
    private _nextId  = 1;
    private _zoom    : number;
    private _pxPerSec: number;

    private _selected = new Set<string>();
    private _clipboard: VideoClip[] = [];
    private _playhead = 0;

    // Loop state — Task B (Loop selection)
    // The host (or the user dragging on the ruler) can define a time range
    // that the playhead will wrap around when reaching `end`. The TrackEditor
    // does NOT own the playback engine — when `enabled` and `setPlayhead()` is
    // called past `end`, we wrap to `start` and emit a `loop-wrap` event so
    // the engine can adjust.
    private _loop = { start: 0, end: 0, enabled: false };
    private _elLoopRange?      : HTMLElement;       // overlay rectangle on ruler
    private _elLoopHandleLeft? : HTMLElement;       // left resize handle
    private _elLoopHandleRight?: HTMLElement;       // right resize handle

    // DOM
    private _elTrackHeads!  : HTMLElement;
    private _elTrackBodies! : HTMLElement;
    private _elRuler!       : HTMLElement;
    private _elPlayhead!    : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: VideoTrackEditorOptions = {}) {
        super(container, 'div', {
            tracks   : 3,
            pxPerSec : 50,
            zoom     : 1,
            ...opts,
        });

        this.el.className = `ar-videotrack${opts.class ? ' ' + opts.class : ''}`;
        this._zoom     = this._get<number>('zoom', 1);
        this._pxPerSec = this._get<number>('pxPerSec', 50);
        this._injectStyles();
        this._buildAudioGraph();
        this._buildShell();

        // Default tracks (video-first)
        const n = this._get<number>('tracks', 3);
        for (let i = 0; i < n; i++) {
            this.addTrack({
                id   : `v${i+1}`,
                name : i === n - 1 ? 'Audio' : `V${i+1}`,
                color: i === n - 1 ? '#a855f7' : '#3b82f6',
                type : i === n - 1 ? 'audio' : 'video',
            });
        }

        this._on(document as unknown as HTMLElement, 'keydown', (e: KeyboardEvent) => {
            if (!this.el.contains(document.activeElement) && document.activeElement !== document.body) return;
            const tg = e.target as HTMLElement;
            if (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA') return;
            if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) { this.copy();  e.preventDefault(); }
            if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) { this.paste(this._playhead); e.preventDefault(); }
            if ((e.metaKey || e.ctrlKey) && (e.key === 'x' || e.key === 'X')) { this.cut();   e.preventDefault(); }
            if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteSelection(); e.preventDefault(); }
        });
    }

    // ── Public API ──────────────────────────────────────────────────────────

    addTrack(t: Partial<VideoTrack> & { id: string; name: string }): VideoTrack {
        const tk: VideoTrack = { color: '#3b82f6', type: 'video', muted: false, soloed: false, ...t };
        this._tracks.push(tk);
        this._renderTracks();
        this._emit('change', { kind: 'add-track', track: tk });
        return tk;
    }

    removeTrack(id: string): void {
        this._tracks = this._tracks.filter(t => t.id !== id);
        this._clips  = this._clips.filter(c => c.trackId !== id);
        this._renderTracks();
        this._renderClips();
        this._emit('change', { kind: 'remove-track', id });
    }

    /** Load a video source from URL or File. Generates thumbnails. */
    async loadSource(srcOrFile: string | File, thumbCount = 8): Promise<VideoSource> {
        const url = typeof srcOrFile === 'string' ? srcOrFile : URL.createObjectURL(srcOrFile);
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.src = url;

        await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error('video load failed'));
        });

        const duration = video.duration;
        const thumbnails: string[] = [];
        const canvas = document.createElement('canvas');
        canvas.width  = 80;
        canvas.height = 45;
        const ctx = canvas.getContext('2d');

        for (let i = 0; i < thumbCount; i++) {
            const t = (duration / thumbCount) * i;
            video.currentTime = t;
            await new Promise<void>(r => { video.onseeked = () => r(); });
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                thumbnails.push(canvas.toDataURL('image/jpeg', 0.6));
            }
        }

        const source: VideoSource = {
            id      : `s${this._nextId++}`,
            url,
            duration,
            width   : video.videoWidth,
            height  : video.videoHeight,
            thumbnails,
        };
        this._sources.set(source.id, source);
        return source;
    }

    addClip(trackId: string, opts: { source: VideoSource; start: number; sourceIn?: number; duration?: number; name?: string }): VideoClip {
        const clip: VideoClip = {
            id       : `c${this._nextId++}`,
            trackId,
            sourceId : opts.source.id,
            start    : opts.start,
            sourceIn : opts.sourceIn ?? 0,
            duration : opts.duration ?? opts.source.duration,
            name     : opts.name,
        };
        this._clips.push(clip);
        this._renderClips();
        this._emit('change', { kind: 'add-clip', clip });
        return clip;
    }

    removeClip(id: string): void {
        this._clips = this._clips.filter(c => c.id !== id);
        this._selected.delete(id);
        this._renderClips();
        this._emit('change', { kind: 'remove-clip', id });
    }

    splitClip(id: string, atTime: number): [VideoClip, VideoClip] | null {
        const c = this._clips.find(x => x.id === id);
        if (!c) return null;
        const local = atTime - c.start;
        if (local <= 0 || local >= c.duration) return null;

        const left:  VideoClip = { ...c, duration: local };
        const right: VideoClip = { ...c, id: `c${this._nextId++}`, start: c.start + local, sourceIn: c.sourceIn + local, duration: c.duration - local };
        this._clips = this._clips.filter(x => x.id !== id);
        this._clips.push(left, right);
        this._renderClips();
        this._emit('change', { kind: 'split', original: id, parts: [left, right] });
        return [left, right];
    }

    copy(): void {
        this._clipboard = [...this._selected].map(id => {
            const c = this._clips.find(x => x.id === id);
            return c ? { ...c } : null;
        }).filter(Boolean) as VideoClip[];
    }

    cut(): void { this.copy(); this.deleteSelection(); }

    paste(atTime: number): void {
        if (this._clipboard.length === 0) return;
        const baseTime = Math.min(...this._clipboard.map(c => c.start));
        const offset = atTime - baseTime;
        for (const c of this._clipboard) {
            this._clips.push({ ...c, id: `c${this._nextId++}`, start: c.start + offset });
        }
        this._renderClips();
        this._emit('change', { kind: 'paste' });
    }

    deleteSelection(): void {
        this._clips = this._clips.filter(c => !this._selected.has(c.id));
        this._selected.clear();
        this._renderClips();
        this._emit('change', { kind: 'delete-selection' });
    }

    setZoom(z: number): this {
        this._zoom = Math.max(0.1, Math.min(8, z));
        this._renderRuler();
        this._renderClips();
        this._emit('change', { kind: 'zoom', value: this._zoom });
        return this;
    }

    setPlayhead(t: number): this {
        let pos = Math.max(0, t);

        // Loop wrap (Task B): if a loop range is active and the new position
        // is past the loop end, snap back to the loop start. Emits
        // 'loop-wrap' so the host playback engine can adjust if needed.
        if (this._loop.enabled && this._loop.end > this._loop.start && pos >= this._loop.end)
        {
            pos = this._loop.start;
            this._emit('loop-wrap', { start: this._loop.start, end: this._loop.end });
        }
        this._playhead = pos;
        this._renderPlayhead();
        return this;
    }

    // ── Loop API (Task B) ──────────────────────────────────────────────────

    /**
     * Get the current loop range. Always defined; if no loop is active,
     * `enabled` is false and start/end may be 0.
     */
    getLoop(): { start: number; end: number; enabled: boolean }
    {
        return { ...this._loop };
    }

    /**
     * Define and (optionally) enable the loop range. Both `start` and `end`
     * are in seconds; `start` < `end` is enforced. Setting `enabled: false`
     * keeps the range stored but disables wrap-around.
     */
    setLoop(loop: { start: number; end?: number; enabled?: boolean }): this
    {
        this._loop.start   = Math.max(0, loop.start);
        if (loop.end !== undefined)     this._loop.end     = Math.max(this._loop.start + 0.05, loop.end);
        if (loop.enabled !== undefined) this._loop.enabled = loop.enabled;
        this._renderLoopOverlay();
        this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        return this;
    }

    /** Disable the loop. The stored range is preserved, only the flag flips. */
    enableLoop(enabled: boolean): this
    {
        this._loop.enabled = enabled;
        this._renderLoopOverlay();
        this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        return this;
    }

    /** Clear the loop range entirely (start = end = 0, disabled). */
    clearLoop(): this
    {
        this._loop = { start: 0, end: 0, enabled: false };
        this._renderLoopOverlay();
        this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        return this;
    }

    /** Serialize the whole project. */
    export(): ExportedProject {
        return {
            tracks: this._tracks.map(t => ({ ...t })),
            clips:  this._clips.map(c => ({ ...c })),
            sources: [...this._sources.values()].map(s => ({
                id: s.id, url: s.url, duration: s.duration, width: s.width, height: s.height,
            })),
        };
    }

    // ── Internal ────────────────────────────────────────────────────────────

    protected _buildAudioGraph(): void {
        // No actual audio routing — VideoTrackEditor is a UI/data composer.
        // Subclasses can override to wire sources into Web Audio.
    }

    protected _build(): void { /* shell built explicitly */ }

    private _buildShell(): void {
        this.el.innerHTML = `
<div class="ar-videotrack__toolbar">
  <button class="ar-videotrack__btn" data-r="add-track">+ Track</button>
  <label class="ar-videotrack__btn" style="cursor:pointer">+ Source
    <input type="file" accept="video/*" data-r="upload" style="display:none">
  </label>
  <span class="ar-videotrack__lbl">Zoom</span>
  <input type="range" class="ar-videotrack__zoom" data-r="zoom" min="0.1" max="4" step="0.1" value="1">
  <span class="ar-videotrack__lbl" data-r="info"></span>
</div>
<div class="ar-videotrack__main">
  <div class="ar-videotrack__heads" data-r="heads"></div>
  <div class="ar-videotrack__rest">
    <div class="ar-videotrack__ruler" data-r="ruler"></div>
    <div class="ar-videotrack__bodies" data-r="bodies">
      <div class="ar-videotrack__playhead" data-r="playhead"></div>
    </div>
  </div>
</div>`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elTrackHeads  = r('heads');
        this._elTrackBodies = r('bodies');
        this._elRuler       = r('ruler');
        this._elPlayhead    = r('playhead');

        r('add-track').addEventListener('click', () => {
            const i = this._tracks.length + 1;
            this.addTrack({ id: `v${this._nextId++}`, name: `V${i}` });
        });

        const upload = r('upload') as HTMLInputElement;
        upload.addEventListener('change', async () => {
            const f = upload.files?.[0];
            if (!f) return;
            const info = r('info');
            info.textContent = '⏳ Loading...';
            const src = await this.loadSource(f);
            info.textContent = `Loaded: ${f.name} (${src.duration.toFixed(1)}s)`;
            // Auto-add to first video track
            const firstVideo = this._tracks.find(t => t.type === 'video');
            if (firstVideo) {
                this.addClip(firstVideo.id, { source: src, start: 0, name: f.name });
            }
        });

        const zoom = r('zoom') as HTMLInputElement;
        zoom.addEventListener('input', () => this.setZoom(parseFloat(zoom.value)));

        // Click on body sets playhead
        this._elTrackBodies.addEventListener('click', e => {
            if ((e.target as HTMLElement).closest('.ar-videotrack__clip')) return;
            const rect = this._elTrackBodies.getBoundingClientRect();
            const x = e.clientX - rect.left + this._elTrackBodies.scrollLeft;
            const px = this._pxPerSec * this._zoom;
            this.setPlayhead(x / px);
        });

        // ── Ruler interactions ─────────────────────────────────────────────
        // • Plain click  → seek (move playhead)
        // • Shift+drag   → create / replace the loop range
        // • Click on existing loop overlay → handled by _onLoopHandleDown / _onLoopRangeDown
        this._elRuler.addEventListener('pointerdown', e => this._onRulerDown(e));

        this._renderRuler();
    }

    private _renderTracks(): void {
        this._elTrackHeads.innerHTML = '';
        for (const t of this._tracks) {
            const head = document.createElement('div');
            head.className = 'ar-videotrack__head';
            head.style.borderLeft = `4px solid ${t.color}`;
            head.innerHTML = `
<div class="ar-videotrack__head-row">
  <span class="ar-videotrack__head-name">${t.name}</span>
  <button class="ar-videotrack__head-x" data-act="remove">×</button>
</div>
<div class="ar-videotrack__head-row">
  <button class="ar-videotrack__btn-sm mute ${t.muted ? 'active':''}" data-act="mute">M</button>
  <button class="ar-videotrack__btn-sm solo ${t.soloed ? 'active':''}" data-act="solo">S</button>
</div>`;
            head.querySelector('[data-act="remove"]')!.addEventListener('click', () => this.removeTrack(t.id));
            head.querySelector('[data-act="mute"]')!.addEventListener('click',   () => { t.muted  = !t.muted;  this._renderTracks(); });
            head.querySelector('[data-act="solo"]')!.addEventListener('click',   () => { t.soloed = !t.soloed; this._renderTracks(); });
            this._elTrackHeads.appendChild(head);
        }
        for (const t of this._tracks) {
            let body = this._elTrackBodies.querySelector<HTMLElement>(`[data-track-row="${t.id}"]`);
            if (!body) {
                body = document.createElement('div');
                body.className = 'ar-videotrack__body';
                body.dataset.trackRow = t.id;
                this._elTrackBodies.insertBefore(body, this._elPlayhead);
            }
        }
        this._elTrackBodies.querySelectorAll<HTMLElement>('[data-track-row]').forEach(el => {
            if (!this._tracks.find(t => t.id === el.dataset.trackRow)) el.remove();
        });
        this._renderClips();
    }

    private _renderRuler(): void {
        this._elRuler.innerHTML = '';
        const total = 120;
        const px = this._pxPerSec * this._zoom;
        this._elRuler.style.width = (total * px) + 'px';
        this._elTrackBodies.style.width = (total * px) + 'px';
        for (let s = 0; s <= total; s++) {
            if (s % 5 === 0) {
                const t = document.createElement('div');
                t.className = 'ar-videotrack__ruler-tick';
                t.style.left = (s * px) + 'px';
                this._elRuler.appendChild(t);
                const lbl = document.createElement('div');
                lbl.className = 'ar-videotrack__ruler-lbl';
                lbl.style.left = (s * px + 2) + 'px';
                lbl.textContent = formatTime(s);
                this._elRuler.appendChild(lbl);
            }
        }

        // ── Loop selection overlay (Task B) ────────────────────────────────
        // Re-mount the loop range UI on every ruler render so it stays
        // sync'd with zoom/pxPerSec changes. The DOM elements are owned
        // privately (this._elLoopRange & handles) and re-created here.
        this._renderLoopOverlay();
    }

    /**
     * Render the loop-range overlay and its two resize handles on the ruler.
     * Visible only when `_loop.enabled` and `start < end`. The overlay is a
     * semi-transparent rectangle that visually marks the looped region; the
     * handles let the user drag-resize either side. Drag-creating a loop range
     * is done by shift-clicking on the ruler (see _onRulerDown).
     */
    private _renderLoopOverlay(): void
    {
        // Drop any existing overlay
        if (this._elLoopRange)       this._elLoopRange.remove();
        if (this._elLoopHandleLeft)  this._elLoopHandleLeft.remove();
        if (this._elLoopHandleRight) this._elLoopHandleRight.remove();
        this._elLoopRange = this._elLoopHandleLeft = this._elLoopHandleRight = undefined;

        if (!this._loop.enabled || this._loop.end <= this._loop.start) return;

        const px = this._pxPerSec * this._zoom;
        const left  = this._loop.start * px;
        const width = (this._loop.end - this._loop.start) * px;

        const range = document.createElement('div');
        range.className = 'ar-videotrack__loop-range';
        range.style.left  = left + 'px';
        range.style.width = width + 'px';
        this._elRuler.appendChild(range);

        const hL = document.createElement('div');
        hL.className = 'ar-videotrack__loop-handle ar-videotrack__loop-handle--left';
        hL.style.left = left + 'px';
        this._elRuler.appendChild(hL);

        const hR = document.createElement('div');
        hR.className = 'ar-videotrack__loop-handle ar-videotrack__loop-handle--right';
        hR.style.left = (left + width) + 'px';
        this._elRuler.appendChild(hR);

        this._elLoopRange       = range;
        this._elLoopHandleLeft  = hL;
        this._elLoopHandleRight = hR;

        // Drag handlers for the two handles → resize loop range
        hL.addEventListener('pointerdown', e => this._onLoopHandleDown(e, 'left'));
        hR.addEventListener('pointerdown', e => this._onLoopHandleDown(e, 'right'));
        // Drag-move on the range body itself → translate (move) the whole loop
        range.addEventListener('pointerdown', e => this._onLoopRangeDown(e));
    }

    /**
     * Pointer-down handler on a loop handle; resize the loop range while
     * dragging. The opposite handle's time stays anchored.
     */
    private _onLoopHandleDown(e: PointerEvent, which: 'left' | 'right'): void
    {
        e.preventDefault();
        e.stopPropagation();
        const px = this._pxPerSec * this._zoom;
        const startX = e.clientX;
        const startLoop = { ...this._loop };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const dt = (ev.clientX - startX) / px;
            if (which === 'left')
            {
                // New start, clamped: 0 <= newStart < end
                this._loop.start = Math.max(0, Math.min(startLoop.start + dt, this._loop.end - 0.05));
            }
            else
            {
                this._loop.end = Math.max(this._loop.start + 0.05, startLoop.end + dt);
            }
            this._renderLoopOverlay();
        };
        const onUp = () => {
            (e.currentTarget as HTMLElement).removeEventListener('pointermove', onMove);
            (e.currentTarget as HTMLElement).removeEventListener('pointerup',   onUp);
            this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        };
        (e.currentTarget as HTMLElement).addEventListener('pointermove', onMove);
        (e.currentTarget as HTMLElement).addEventListener('pointerup',   onUp);
    }

    /** Drag the whole loop range (translate without resize). */
    private _onLoopRangeDown(e: PointerEvent): void
    {
        e.preventDefault();
        e.stopPropagation();
        const px = this._pxPerSec * this._zoom;
        const startX = e.clientX;
        const startLoop = { ...this._loop };
        const range = e.currentTarget as HTMLElement;
        range.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const dt = (ev.clientX - startX) / px;
            const len = startLoop.end - startLoop.start;
            this._loop.start = Math.max(0, startLoop.start + dt);
            this._loop.end   = this._loop.start + len;
            this._renderLoopOverlay();
        };
        const onUp = () => {
            range.removeEventListener('pointermove', onMove);
            range.removeEventListener('pointerup',   onUp);
            this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        };
        range.addEventListener('pointermove', onMove);
        range.addEventListener('pointerup',   onUp);
    }

    /**
     * Pointer-down handler on the timeline ruler.
     *
     * Two interactions are supported:
     *   • Shift+drag — define a fresh loop range (replaces any existing one).
     *     The drag direction doesn't matter — start/end are sorted at the end.
     *   • Plain click / drag — moves the playhead. (Useful as a quick scrub.)
     *
     * Clicks on the loop overlay or its handles are intercepted earlier and
     * never reach this handler.
     */
    private _onRulerDown(e: PointerEvent): void
    {
        // Ignore if click started on the loop overlay or handles
        const target = e.target as HTMLElement;
        if (target.classList.contains('ar-videotrack__loop-range') ||
            target.classList.contains('ar-videotrack__loop-handle')) return;

        const px = this._pxPerSec * this._zoom;
        const rect = this._elRuler.getBoundingClientRect();
        const x0 = e.clientX - rect.left + this._elRuler.scrollLeft;
        const t0 = x0 / px;

        if (e.shiftKey)
        {
            // Begin a new loop range — start at t0, end follows the cursor
            e.preventDefault();
            e.stopPropagation();
            this._loop.start   = t0;
            this._loop.end     = t0 + 0.001;     // tiny seed; will grow on drag
            this._loop.enabled = true;
            this._renderLoopOverlay();
            this._elRuler.setPointerCapture(e.pointerId);

            const onMove = (ev: PointerEvent) => {
                const x = ev.clientX - rect.left + this._elRuler.scrollLeft;
                const t = x / px;
                if (t >= t0) { this._loop.start = t0; this._loop.end = t; }
                else         { this._loop.start = t;  this._loop.end = t0; }
                this._renderLoopOverlay();
            };
            const onUp = () => {
                this._elRuler.removeEventListener('pointermove', onMove);
                this._elRuler.removeEventListener('pointerup',   onUp);
                // Discard tiny ranges (treat as cancel)
                if (this._loop.end - this._loop.start < 0.05)
                {
                    this._loop = { start: 0, end: 0, enabled: false };
                    this._renderLoopOverlay();
                }
                this._emit('change', { kind: 'loop', loop: { ...this._loop } });
            };
            this._elRuler.addEventListener('pointermove', onMove);
            this._elRuler.addEventListener('pointerup',   onUp);
            return;
        }

        // Plain click on ruler → seek
        this.setPlayhead(t0);
    }

    private _renderClips(): void {
        this._elTrackBodies.querySelectorAll('.ar-videotrack__clip').forEach(n => n.remove());
        const px = this._pxPerSec * this._zoom;

        for (const c of this._clips) {
            const row = this._elTrackBodies.querySelector<HTMLElement>(`[data-track-row="${c.trackId}"]`);
            if (!row) continue;
            const t = this._tracks.find(x => x.id === c.trackId);
            const src = this._sources.get(c.sourceId);

            const el = document.createElement('div');
            el.className = 'ar-videotrack__clip';
            el.style.left  = (c.start * px) + 'px';
            el.style.width = Math.max(20, c.duration * px) + 'px';
            el.style.background = (t?.color || '#3b82f6') + '33';
            el.style.borderColor = t?.color || '#3b82f6';
            if (this._selected.has(c.id)) el.classList.add('selected');

            // Thumbnails as background
            if (src && src.thumbnails.length > 0) {
                const thumbsContainer = document.createElement('div');
                thumbsContainer.className = 'ar-videotrack__thumbs';
                const w = Math.max(20, c.duration * px) | 0;
                const thumbW = 80;
                const count = Math.max(1, Math.ceil(w / thumbW));
                for (let i = 0; i < count; i++) {
                    const sourceTime = c.sourceIn + (i / count) * c.duration;
                    const idx = Math.min(src.thumbnails.length - 1,
                                         Math.floor((sourceTime / src.duration) * src.thumbnails.length));
                    const img = document.createElement('img');
                    img.src = src.thumbnails[idx];
                    img.className = 'ar-videotrack__thumb';
                    thumbsContainer.appendChild(img);
                }
                el.appendChild(thumbsContainer);
            }

            const lbl = document.createElement('div');
            lbl.className = 'ar-videotrack__clip-lbl';
            lbl.textContent = c.name || c.id;
            el.appendChild(lbl);

            const lh = document.createElement('div'); lh.className = 'ar-videotrack__clip-h left';   el.appendChild(lh);
            const rh = document.createElement('div'); rh.className = 'ar-videotrack__clip-h right';  el.appendChild(rh);

            el.addEventListener('pointerdown', e => this._onClipDown(e, c, el, lh, rh));
            row.appendChild(el);
        }
    }

    private _onClipDown(e: PointerEvent, c: VideoClip, el: HTMLElement, lh: HTMLElement, rh: HTMLElement): void {
        e.preventDefault();
        e.stopPropagation();
        const px = this._pxPerSec * this._zoom;

        if (!this._selected.has(c.id)) {
            if (!e.shiftKey) {
                this._selected.clear();
                this.el.querySelectorAll('.ar-videotrack__clip.selected').forEach(n => n.classList.remove('selected'));
            }
            this._selected.add(c.id);
            el.classList.add('selected');
        }

        const mode = e.target === lh ? 'resize-left'
                   : e.target === rh ? 'resize-right'
                                     : 'move';

        const startX        = e.clientX;
        const startY        = e.clientY;
        const startStart    = c.start, startDur = c.duration, startSrcIn = c.sourceIn;
        const startTrackId  = c.trackId;

        // Cross-track drag bookkeeping ──────────────────────────────────────
        // Capture every track row's vertical bounds at the moment drag starts;
        // use these to map clientY → target track on every pointermove event.
        // We capture once on pointerdown so that scroll / row mutations during
        // drag don't break the mapping (the editor doesn't allow track add/remove
        // mid-drag in any case).
        const rowRects: Array<{ id: string; top: number; bottom: number }> = [];
        this._elTrackBodies.querySelectorAll<HTMLElement>('[data-track-row]').forEach(row => {
            const rect = row.getBoundingClientRect();
            rowRects.push({ id: row.dataset.trackRow!, top: rect.top, bottom: rect.bottom });
        });

        /** Find which track row contains a given clientY. Returns null if outside. */
        const rowAt = (clientY: number): string | null => {
            // Inside an existing row?
            for (const r of rowRects) if (clientY >= r.top && clientY < r.bottom) return r.id;
            // Above first or below last? Snap to nearest edge so the drag does
            // something useful even if the cursor leaves the body slightly.
            if (rowRects.length === 0) return null;
            if (clientY < rowRects[0]!.top)              return rowRects[0]!.id;
            if (clientY >= rowRects[rowRects.length-1]!.bottom) return rowRects[rowRects.length-1]!.id;
            return null;
        };

        // The clip element gets re-parented when the user crosses into a
        // different row; we keep a reference to the highlighted target row so
        // we can clear its highlight on each step.
        let highlightedRow: HTMLElement | null = null;
        const setHighlight = (rowId: string | null) => {
            if (highlightedRow) highlightedRow.classList.remove('ar-videotrack__body--dropping');
            highlightedRow = rowId
                ? this._elTrackBodies.querySelector<HTMLElement>(`[data-track-row="${rowId}"]`)
                : null;
            if (highlightedRow) highlightedRow.classList.add('ar-videotrack__body--dropping');
        };

        el.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const dx = (ev.clientX - startX) / px;

            // ── X axis: time-based move/resize (existing behaviour) ────────
            if (mode === 'move') {
                c.start = Math.max(0, startStart + dx);
            } else if (mode === 'resize-right') {
                c.duration = Math.max(0.05, startDur + dx);
            } else if (mode === 'resize-left') {
                const newStart = Math.max(0, startStart + dx);
                const delta = newStart - startStart;
                c.start = newStart;
                c.sourceIn = startSrcIn + delta;
                c.duration = Math.max(0.05, startDur - delta);
            }
            el.style.left  = (c.start * px) + 'px';
            el.style.width = Math.max(20, c.duration * px) + 'px';

            // ── Y axis: cross-track drag (Task A — new behaviour) ──────────
            // Only when in 'move' mode; resize handles stay locked to row.
            if (mode === 'move') {
                const targetTrackId = rowAt(ev.clientY);
                if (targetTrackId && targetTrackId !== c.trackId) {
                    // Move clip data + DOM into the new row
                    c.trackId = targetTrackId;
                    const newRow = this._elTrackBodies.querySelector<HTMLElement>(`[data-track-row="${targetTrackId}"]`);
                    if (newRow && el.parentElement !== newRow) newRow.appendChild(el);
                    // Re-tint the clip with the destination track's colour
                    const t = this._tracks.find(x => x.id === targetTrackId);
                    if (t) {
                        el.style.background  = (t.color || '#3b82f6') + '33';
                        el.style.borderColor =  t.color || '#3b82f6';
                    }
                    setHighlight(targetTrackId);
                } else if (!targetTrackId) {
                    setHighlight(null);
                } else {
                    setHighlight(targetTrackId);
                }
            }

            // Live drag delta (deltaY) is also useful for tests / consumers
            void (ev.clientY - startY);
        };

        const onUp = () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup',   onUp);
            setHighlight(null);
            this._renderClips();
            // Emit a track-change event when the clip moved between tracks,
            // in addition to the regular move event, so consumers can react.
            if (mode === 'move' && c.trackId !== startTrackId) {
                this._emit('change', { kind: 'move-clip-track', clip: c, fromTrack: startTrackId, toTrack: c.trackId });
            }
            this._emit('change', { kind: mode + '-clip', clip: c });
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup',   onUp);
    }

    private _renderPlayhead(): void {
        const px = this._pxPerSec * this._zoom;
        this._elPlayhead.style.left = (this._playhead * px) + 'px';
    }

    private _injectStyles(): void {
        if (document.getElementById('ar-videotrack-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-videotrack-styles';
        s.textContent = `
.ar-videotrack { font:12px -apple-system,system-ui,sans-serif; background:#1e1e1e; color:#d4d4d4; border-radius:4px; display:flex; flex-direction:column; height:100%; min-height:300px; user-select:none; }
.ar-videotrack__toolbar { background:#252525; padding:6px 10px; display:flex; gap:8px; align-items:center; border-bottom:1px solid #333; flex-shrink:0; }
.ar-videotrack__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:4px 10px; font:12px sans-serif; border-radius:3px; cursor:pointer; }
.ar-videotrack__btn:hover { background:#2a2a2a; }
.ar-videotrack__lbl { font:11px sans-serif; color:#888; }
.ar-videotrack__zoom { width:120px; -webkit-appearance:none; height:3px; background:#444; border-radius:2px; outline:none; cursor:pointer; }
.ar-videotrack__zoom::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; border-radius:50%; background:#3b82f6; cursor:pointer; }
.ar-videotrack__main { flex:1; display:flex; min-height:0; overflow:hidden; }
.ar-videotrack__heads { width:120px; background:#252525; border-right:1px solid #333; overflow-y:auto; flex-shrink:0; }
.ar-videotrack__head { height:60px; padding:6px 8px; border-bottom:1px solid #333; box-sizing:border-box; }
.ar-videotrack__head-row { display:flex; align-items:center; gap:4px; margin:2px 0; }
.ar-videotrack__head-name { flex:1; font-weight:600; font-size:11px; }
.ar-videotrack__head-x { background:transparent; border:0; color:#666; font-size:14px; cursor:pointer; padding:0 4px; }
.ar-videotrack__head-x:hover { color:#dc2626; }
.ar-videotrack__btn-sm { background:transparent; border:1px solid #444; color:#d4d4d4; padding:2px 8px; font:10px sans-serif; font-weight:600; border-radius:2px; cursor:pointer; }
.ar-videotrack__btn-sm.mute.active { background:#dc2626; border-color:#dc2626; color:#fff; }
.ar-videotrack__btn-sm.solo.active { background:#eab308; border-color:#eab308; color:#1f1f1f; }
.ar-videotrack__rest { flex:1; overflow:auto; }
.ar-videotrack__ruler { background:#252525; border-bottom:1px solid #333; height:22px; position:relative; }
.ar-videotrack__ruler-tick { position:absolute; top:0; bottom:0; width:1px; background:#555; }
.ar-videotrack__ruler-lbl  { position:absolute; top:4px; font:10px ui-monospace,monospace; color:#999; }
.ar-videotrack__bodies { position:relative; min-height:200px; cursor:crosshair; }
.ar-videotrack__body { height:60px; border-bottom:1px solid #333; position:relative; }
.ar-videotrack__clip { position:absolute; top:4px; bottom:4px; border:1.5px solid #3b82f6; border-radius:3px; cursor:move; overflow:hidden; }
.ar-videotrack__clip.selected { box-shadow:0 0 0 2px #fff inset; }
.ar-videotrack__clip-lbl { position:absolute; top:2px; left:6px; font:10px sans-serif; color:#fff; pointer-events:none; text-shadow:0 1px 2px rgba(0,0,0,.5); z-index:2; }
.ar-videotrack__clip-h { position:absolute; top:0; bottom:0; width:6px; cursor:ew-resize; z-index:3; }
.ar-videotrack__clip-h.left  { left:0; }
.ar-videotrack__clip-h.right { right:0; }
.ar-videotrack__thumbs { position:absolute; inset:0; display:flex; }
.ar-videotrack__thumb { width:80px; height:100%; object-fit:cover; flex-shrink:0; opacity:.85; }
.ar-videotrack__playhead { position:absolute; top:0; bottom:0; width:2px; background:#16a34a; pointer-events:none; box-shadow:0 0 4px rgba(22,163,74,.5); z-index:10; }

/* Cross-track drag — highlight on the destination track row */
.ar-videotrack__body--dropping { background:rgba(228,12,136,0.10); outline:1px dashed #e40c88; outline-offset:-1px; }

/* Loop selection — overlay on the ruler (Task B) */
.ar-videotrack__loop-range  { position:absolute; top:0; bottom:0; background:rgba(228,12,136,0.18); border-top:2px solid #e40c88; border-bottom:2px solid #e40c88; cursor:grab; z-index:5; }
.ar-videotrack__loop-range:active { cursor:grabbing; }
.ar-videotrack__loop-handle { position:absolute; top:0; bottom:0; width:6px; margin-left:-3px; background:#e40c88; cursor:ew-resize; z-index:6; }
.ar-videotrack__loop-handle::after { content:''; position:absolute; top:50%; left:50%; width:2px; height:8px; margin:-4px 0 0 -1px; background:rgba(255,255,255,0.7); border-radius:1px; }
`;
        document.head.appendChild(s);
    }
}

function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
}
