/**
 * @module    AudioTrackEditor
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Multi-track audio editor with waveform display per clip and standard
 * cut/move/resize/copy/paste/zoom operations. Pure UI/data layer —
 * actual audio rendering happens in Web Audio when clips are played
 * via the connected output (one BufferSource per clip).
 *
 * @example
 *   import { AudioTrackEditor } from 'ariannajs/components/audio';
 *
 *   const ed = new AudioTrackEditor('#root', { tracks: 4, bpm: 120 });
 *
 *   ed.addTrack({ id:'vox', name:'Vocals', color:'#e40c88' });
 *   const buffer = await ed.loadFile('vocals.wav');
 *   ed.addClip('vox', { buffer, start: 0, name: 'Take 1' });
 *
 *   ed.on('change', e => console.log(e));
 */

import { AudioComponent, type AudioComponentOptions } from './AudioComponent.ts';

export interface AudioTrack {
    id     : string;
    name   : string;
    color? : string;
    muted? : boolean;
    soloed?: boolean;
}

export interface AudioClip {
    id        : string;
    trackId   : string;
    buffer    : AudioBuffer;
    /** Start in seconds along the timeline. */
    start     : number;
    /** Offset into the buffer in seconds (for trim-from-start). */
    offset    : number;
    /** Duration to play in seconds (for trim end). */
    duration  : number;
    name?     : string;
}

export interface AudioTrackEditorOptions extends AudioComponentOptions {
    tracks?   : number;
    bpm?      : number;
    /** Pixels per second at zoom 1. Default 50. */
    pxPerSec? : number;
    /** Initial zoom factor. Default 1. */
    zoom?     : number;
}

const TRACK_HEIGHT = 80;
const HEADER_W     = 140;
const RULER_H      = 22;

export class AudioTrackEditor extends AudioComponent<AudioTrackEditorOptions> {
    private _tracks  : AudioTrack[] = [];
    private _clips   : AudioClip[]  = [];
    private _nextId  = 1;
    private _zoom    : number;
    private _pxPerSec: number;

    private _selected = new Set<string>();
    private _clipboard: AudioClip[] = [];

    // Loop state — Task B (Loop selection)
    private _loop = { start: 0, end: 0, enabled: false };
    private _elLoopRange?      : HTMLElement;
    private _elLoopHandleLeft? : HTMLElement;
    private _elLoopHandleRight?: HTMLElement;

    protected declare _output: GainNode;
    private _activeSources: AudioBufferSourceNode[] = [];
    private _playing = false;
    private _playStart = 0;
    private _playRAF = 0;
    private _playhead = 0;     // seconds

    // DOM
    private _elTrackHeads!: HTMLElement;
    private _elTrackBodies!: HTMLElement;
    private _elRuler!     : HTMLElement;
    private _elPlayhead!  : HTMLElement;
    private _elScroller!  : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: AudioTrackEditorOptions = {}) {
        super(container, 'div', {
            tracks   : 4,
            bpm      : 120,
            pxPerSec : 50,
            zoom     : 1,
            ...opts,
        });

        this.el.className = `ar-audiotrack${opts.class ? ' ' + opts.class : ''}`;
        this._zoom     = this._get<number>('zoom', 1);
        this._pxPerSec = this._get<number>('pxPerSec', 50);
        this._injectStyles();
        this._buildAudioGraph();
        this._buildShell();

        // Default tracks
        const n = this._get<number>('tracks', 4);
        for (let i = 0; i < n; i++) {
            this.addTrack({ id: `t${i+1}`, name: `Track ${i+1}` });
        }

        // Keyboard shortcuts (scoped via document but only when our element is focused)
        this._on(document as unknown as HTMLElement, 'keydown', (e: KeyboardEvent) => {
            if (!this.el.contains(document.activeElement) && document.activeElement !== document.body) return;
            const tg = e.target as HTMLElement;
            if (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA') return;
            if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) { this.copy();  e.preventDefault(); }
            if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) { this.paste(this._playhead); e.preventDefault(); }
            if ((e.metaKey || e.ctrlKey) && (e.key === 'x' || e.key === 'X')) { this.cut();   e.preventDefault(); }
            if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteSelection(); e.preventDefault(); }
            if (e.key === ' ') { e.preventDefault(); this._playing ? this.stop() : this.play(); }
        });
    }

    // ── Track / Clip API ────────────────────────────────────────────────────

    addTrack(t: Partial<AudioTrack> & { id: string; name: string }): AudioTrack {
        const tk: AudioTrack = { color: '#e40c88', muted: false, soloed: false, ...t };
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

    addClip(trackId: string, opts: { buffer: AudioBuffer; start: number; offset?: number; duration?: number; name?: string }): AudioClip {
        const clip: AudioClip = {
            id      : `c${this._nextId++}`,
            trackId,
            buffer  : opts.buffer,
            start   : opts.start,
            offset  : opts.offset ?? 0,
            duration: opts.duration ?? opts.buffer.duration,
            name    : opts.name,
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

    /** Load an audio file URL or a File object into an AudioBuffer. */
    async loadFile(src: string | File | ArrayBuffer): Promise<AudioBuffer> {
        let arr: ArrayBuffer;
        if (typeof src === 'string')      arr = await (await fetch(src)).arrayBuffer();
        else if (src instanceof File)     arr = await src.arrayBuffer();
        else                              arr = src;
        return await this._audioCtx.decodeAudioData(arr);
    }

    // ── Edit operations ─────────────────────────────────────────────────────

    copy(): void {
        this._clipboard = [...this._selected].map(id => {
            const c = this._clips.find(x => x.id === id);
            return c ? { ...c } : null;
        }).filter(Boolean) as AudioClip[];
    }

    cut(): void {
        this.copy();
        this.deleteSelection();
    }

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

    /** Split a clip at given time (timeline seconds). */
    splitClip(id: string, atTime: number): [AudioClip, AudioClip] | null {
        const c = this._clips.find(x => x.id === id);
        if (!c) return null;
        const local = atTime - c.start;
        if (local <= 0 || local >= c.duration) return null;

        const left:  AudioClip = { ...c, duration: local };
        const right: AudioClip = { ...c, id: `c${this._nextId++}`, start: c.start + local, offset: c.offset + local, duration: c.duration - local };

        this._clips = this._clips.filter(x => x.id !== id);
        this._clips.push(left, right);
        this._renderClips();
        this._emit('change', { kind: 'split', original: id, parts: [left, right] });
        return [left, right];
    }

    setZoom(z: number): this {
        this._zoom = Math.max(0.1, Math.min(8, z));
        this._renderRuler();
        this._renderClips();
        this._emit('change', { kind: 'zoom', value: this._zoom });
        return this;
    }

    // ── Playback ────────────────────────────────────────────────────────────

    play(): this {
        if (this._playing) return this;
        AudioComponent.resume();
        this._playing = true;
        this._playStart = this._audioCtx.currentTime - this._playhead;

        const soloed = this._tracks.filter(t => t.soloed).map(t => t.id);
        const isAudible = (trackId: string): boolean => {
            const t = this._tracks.find(x => x.id === trackId);
            if (!t) return false;
            if (soloed.length > 0) return soloed.includes(trackId);
            return !t.muted;
        };

        for (const c of this._clips) {
            if (!isAudible(c.trackId)) continue;
            const src = this._audioCtx.createBufferSource();
            src.buffer = c.buffer;
            src.connect(this._output);
            const startAt = Math.max(0, c.start - this._playhead);
            const offsetIn = c.start < this._playhead ? c.offset + (this._playhead - c.start) : c.offset;
            const dur = c.duration - (offsetIn - c.offset);
            if (dur > 0) src.start(this._audioCtx.currentTime + startAt, offsetIn, dur);
            this._activeSources.push(src);
        }

        this._tickPlayhead();
        this._emit('play', {});
        return this;
    }

    pause(): this {
        if (!this._playing) return this;
        this._playing = false;
        for (const s of this._activeSources) { try { s.stop(); } catch {} }
        this._activeSources = [];
        if (this._playRAF) cancelAnimationFrame(this._playRAF);
        this._emit('pause', {});
        return this;
    }

    stop(): this {
        this.pause();
        this._playhead = 0;
        this._renderPlayhead();
        return this;
    }

    private _tickPlayhead = (): void => {
        if (!this._playing) return;
        let pos = this._audioCtx.currentTime - this._playStart;

        // Loop wrap during playback (Task B)
        if (this._loop.enabled && this._loop.end > this._loop.start && pos >= this._loop.end)
        {
            // Restart playback from loop.start by re-anchoring _playStart
            const overshoot = pos - this._loop.start;
            this._playStart = this._audioCtx.currentTime - this._loop.start;
            pos = this._audioCtx.currentTime - this._playStart;
            this._emit('loop-wrap', { start: this._loop.start, end: this._loop.end, overshoot });
            // Note: the audio sources themselves don't auto-reseek — host must
            // restart playback. We emit the event; for fully-automatic loop
            // playback the host would call .pause() then .play() inside the
            // 'loop-wrap' handler.
        }

        this._playhead = pos;
        this._renderPlayhead();
        this._playRAF = requestAnimationFrame(this._tickPlayhead);
    };

    // ── Internal ────────────────────────────────────────────────────────────

    protected _buildAudioGraph(): void {
        this._output = this._audioCtx.createGain();
        this._output.connect(this._audioCtx.destination);
        // No input: this is a source/composer
    }

    protected _build(): void { /* shell built explicitly */ }

    private _buildShell(): void {
        this.el.innerHTML = `
<div class="ar-audiotrack__toolbar">
  <button class="ar-audiotrack__btn" data-r="play">▶ Play</button>
  <button class="ar-audiotrack__btn" data-r="stop">■ Stop</button>
  <button class="ar-audiotrack__btn" data-r="add-track">+ Track</button>
  <span class="ar-audiotrack__lbl">Zoom</span>
  <input type="range" class="ar-audiotrack__zoom" data-r="zoom" min="0.1" max="4" step="0.1" value="1">
</div>
<div class="ar-audiotrack__main" data-r="scroller">
  <div class="ar-audiotrack__heads" data-r="heads"></div>
  <div class="ar-audiotrack__rest">
    <div class="ar-audiotrack__ruler" data-r="ruler"></div>
    <div class="ar-audiotrack__bodies" data-r="bodies">
      <div class="ar-audiotrack__playhead" data-r="playhead" style="display:none"></div>
    </div>
  </div>
</div>`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elTrackHeads  = r('heads');
        this._elTrackBodies = r('bodies');
        this._elRuler       = r('ruler');
        this._elPlayhead    = r('playhead');
        this._elScroller    = r('scroller');

        r('play').addEventListener('click', () => this._playing ? this.pause() : this.play());
        r('stop').addEventListener('click', () => this.stop());
        r('add-track').addEventListener('click', () => {
            const i = this._tracks.length + 1;
            this.addTrack({ id: `t${this._nextId++}`, name: `Track ${i}` });
        });
        const elZoom = r('zoom') as HTMLInputElement;
        elZoom.addEventListener('input', () => this.setZoom(parseFloat(elZoom.value)));

        // Ruler interactions: shift+drag → loop range, plain click → seek
        this._elRuler.addEventListener('pointerdown', e => this._onRulerDown(e));

        this._renderRuler();
    }

    private _renderTracks(): void {
        this._elTrackHeads.innerHTML = '';
        for (const t of this._tracks) {
            const head = document.createElement('div');
            head.className = 'ar-audiotrack__head';
            head.dataset.trackId = t.id;
            head.style.borderLeft = `4px solid ${t.color}`;
            head.innerHTML = `
<div class="ar-audiotrack__head-row">
  <span class="ar-audiotrack__head-name">${t.name}</span>
  <button class="ar-audiotrack__head-x" data-act="remove">×</button>
</div>
<div class="ar-audiotrack__head-row">
  <button class="ar-audiotrack__btn-sm mute ${t.muted ? 'active':''}" data-act="mute">M</button>
  <button class="ar-audiotrack__btn-sm solo ${t.soloed ? 'active':''}" data-act="solo">S</button>
  <label class="ar-audiotrack__btn-sm" style="cursor:pointer">+
    <input type="file" accept="audio/*" data-act="upload" style="display:none">
  </label>
</div>`;
            head.querySelector('[data-act="remove"]')!.addEventListener('click', () => this.removeTrack(t.id));
            head.querySelector('[data-act="mute"]')!  .addEventListener('click', () => { t.muted  = !t.muted;  this._renderTracks(); });
            head.querySelector('[data-act="solo"]')!  .addEventListener('click', () => { t.soloed = !t.soloed; this._renderTracks(); });
            head.querySelector('[data-act="upload"]')!.addEventListener('change', async (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (!f) return;
                const buf = await this.loadFile(f);
                this.addClip(t.id, { buffer: buf, start: 0, name: f.name });
            });
            this._elTrackHeads.appendChild(head);
        }
        // Match height of bodies
        for (const t of this._tracks) {
            let body = this._elTrackBodies.querySelector<HTMLElement>(`[data-track-row="${t.id}"]`);
            if (!body) {
                body = document.createElement('div');
                body.className = 'ar-audiotrack__body';
                body.dataset.trackRow = t.id;
                this._elTrackBodies.insertBefore(body, this._elPlayhead);
            }
        }
        // Remove orphans
        this._elTrackBodies.querySelectorAll<HTMLElement>('[data-track-row]').forEach(el => {
            if (!this._tracks.find(t => t.id === el.dataset.trackRow)) el.remove();
        });
        this._renderClips();
    }

    private _renderRuler(): void {
        this._elRuler.innerHTML = '';
        const totalSec = 120; // default 2 min
        const px = this._pxPerSec * this._zoom;
        this._elRuler.style.width = (totalSec * px) + 'px';
        this._elTrackBodies.style.width = (totalSec * px) + 'px';
        for (let s = 0; s <= totalSec; s++) {
            if (s % 5 === 0) {
                const t = document.createElement('div');
                t.className = 'ar-audiotrack__ruler-tick';
                t.style.left = (s * px) + 'px';
                this._elRuler.appendChild(t);
                const lbl = document.createElement('div');
                lbl.className = 'ar-audiotrack__ruler-lbl';
                lbl.style.left = (s * px + 2) + 'px';
                lbl.textContent = formatTime(s);
                this._elRuler.appendChild(lbl);
            }
        }

        // Loop overlay (Task B) — re-mounted on every ruler render
        this._renderLoopOverlay();
    }

    /**
     * Render the loop-range overlay and resize handles on the ruler.
     * Visible only when `_loop.enabled && start < end`. Re-rendered after
     * every zoom / pxPerSec change to stay aligned with the timeline.
     */
    private _renderLoopOverlay(): void
    {
        if (this._elLoopRange)       this._elLoopRange.remove();
        if (this._elLoopHandleLeft)  this._elLoopHandleLeft.remove();
        if (this._elLoopHandleRight) this._elLoopHandleRight.remove();
        this._elLoopRange = this._elLoopHandleLeft = this._elLoopHandleRight = undefined;

        if (!this._loop.enabled || this._loop.end <= this._loop.start) return;

        const px = this._pxPerSec * this._zoom;
        const left  = this._loop.start * px;
        const width = (this._loop.end - this._loop.start) * px;

        const range = document.createElement('div');
        range.className = 'ar-audiotrack__loop-range';
        range.style.left  = left + 'px';
        range.style.width = width + 'px';
        this._elRuler.appendChild(range);

        const hL = document.createElement('div');
        hL.className = 'ar-audiotrack__loop-handle ar-audiotrack__loop-handle--left';
        hL.style.left = left + 'px';
        this._elRuler.appendChild(hL);

        const hR = document.createElement('div');
        hR.className = 'ar-audiotrack__loop-handle ar-audiotrack__loop-handle--right';
        hR.style.left = (left + width) + 'px';
        this._elRuler.appendChild(hR);

        this._elLoopRange       = range;
        this._elLoopHandleLeft  = hL;
        this._elLoopHandleRight = hR;

        hL.addEventListener('pointerdown', e => this._onLoopHandleDown(e, 'left'));
        hR.addEventListener('pointerdown', e => this._onLoopHandleDown(e, 'right'));
        range.addEventListener('pointerdown', e => this._onLoopRangeDown(e));
    }

    private _onLoopHandleDown(e: PointerEvent, which: 'left' | 'right'): void
    {
        e.preventDefault();
        e.stopPropagation();
        const px = this._pxPerSec * this._zoom;
        const startX = e.clientX;
        const startLoop = { ...this._loop };
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const dt = (ev.clientX - startX) / px;
            if (which === 'left')
            {
                this._loop.start = Math.max(0, Math.min(startLoop.start + dt, this._loop.end - 0.05));
            }
            else
            {
                this._loop.end = Math.max(this._loop.start + 0.05, startLoop.end + dt);
            }
            this._renderLoopOverlay();
        };
        const onUp = () => {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup',   onUp);
            this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup',   onUp);
    }

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
     * Pointer-down on the timeline ruler: shift+drag → create loop range,
     * plain click → seek the playhead.
     */
    private _onRulerDown(e: PointerEvent): void
    {
        const target = e.target as HTMLElement;
        if (target.classList.contains('ar-audiotrack__loop-range') ||
            target.classList.contains('ar-audiotrack__loop-handle')) return;

        const px = this._pxPerSec * this._zoom;
        const rect = this._elRuler.getBoundingClientRect();
        const x0 = e.clientX - rect.left + this._elRuler.scrollLeft;
        const t0 = x0 / px;

        if (e.shiftKey)
        {
            e.preventDefault();
            e.stopPropagation();
            this._loop.start   = t0;
            this._loop.end     = t0 + 0.001;
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

    // ── Loop API (Task B) ──────────────────────────────────────────────────

    getLoop(): { start: number; end: number; enabled: boolean }
    {
        return { ...this._loop };
    }

    setLoop(loop: { start: number; end?: number; enabled?: boolean }): this
    {
        this._loop.start   = Math.max(0, loop.start);
        if (loop.end !== undefined)     this._loop.end     = Math.max(this._loop.start + 0.05, loop.end);
        if (loop.enabled !== undefined) this._loop.enabled = loop.enabled;
        this._renderLoopOverlay();
        this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        return this;
    }

    enableLoop(enabled: boolean): this
    {
        this._loop.enabled = enabled;
        this._renderLoopOverlay();
        this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        return this;
    }

    clearLoop(): this
    {
        this._loop = { start: 0, end: 0, enabled: false };
        this._renderLoopOverlay();
        this._emit('change', { kind: 'loop', loop: { ...this._loop } });
        return this;
    }

    /**
     * Programmatically move the playhead. If a loop range is active and the
     * new position is past `loop.end`, wraps to `loop.start` and emits
     * `loop-wrap` so the host playback engine can resync. This is also called
     * automatically by `_tickPlayhead` during real-time playback.
     */
    setPlayhead(t: number): this
    {
        let pos = Math.max(0, t);
        if (this._loop.enabled && this._loop.end > this._loop.start && pos >= this._loop.end)
        {
            pos = this._loop.start;
            this._emit('loop-wrap', { start: this._loop.start, end: this._loop.end });
        }
        this._playhead = pos;
        this._renderPlayhead();
        return this;
    }

    private _renderClips(): void {
        this._elTrackBodies.querySelectorAll('.ar-audiotrack__clip').forEach(n => n.remove());
        const px = this._pxPerSec * this._zoom;

        for (const c of this._clips) {
            const row = this._elTrackBodies.querySelector<HTMLElement>(`[data-track-row="${c.trackId}"]`);
            if (!row) continue;
            const t = this._tracks.find(x => x.id === c.trackId);

            const el = document.createElement('div');
            el.className = 'ar-audiotrack__clip';
            el.dataset.clipId = c.id;
            el.style.left  = (c.start * px) + 'px';
            el.style.width = Math.max(20, c.duration * px) + 'px';
            el.style.background = (t?.color || '#e40c88') + '33';
            el.style.borderColor = t?.color || '#e40c88';
            if (this._selected.has(c.id)) el.classList.add('selected');

            // Waveform canvas
            const canvas = document.createElement('canvas');
            canvas.className = 'ar-audiotrack__wave';
            const w = Math.max(20, c.duration * px) | 0;
            canvas.width  = w;
            canvas.height = TRACK_HEIGHT - 22;
            this._drawWaveform(canvas, c);
            el.appendChild(canvas);

            const lbl = document.createElement('div');
            lbl.className = 'ar-audiotrack__clip-lbl';
            lbl.textContent = c.name || c.id;
            el.appendChild(lbl);

            // Resize handles
            const lh = document.createElement('div'); lh.className = 'ar-audiotrack__clip-h left';   el.appendChild(lh);
            const rh = document.createElement('div'); rh.className = 'ar-audiotrack__clip-h right';  el.appendChild(rh);

            el.addEventListener('pointerdown', e => this._onClipDown(e, c, el, lh, rh));
            row.appendChild(el);
        }
    }

    private _onClipDown(e: PointerEvent, c: AudioClip, el: HTMLElement, lh: HTMLElement, rh: HTMLElement): void {
        e.preventDefault();
        e.stopPropagation();
        const px = this._pxPerSec * this._zoom;

        // Selection
        if (!this._selected.has(c.id)) {
            if (!e.shiftKey) {
                this._selected.clear();
                this.el.querySelectorAll('.ar-audiotrack__clip.selected').forEach(n => n.classList.remove('selected'));
            }
            this._selected.add(c.id);
            el.classList.add('selected');
        }

        // Resize-left / resize-right / move
        const mode = e.target === lh ? 'resize-left'
                   : e.target === rh ? 'resize-right'
                                     : 'move';

        const startX        = e.clientX;
        const startStart    = c.start, startDur = c.duration, startOffset = c.offset;
        const startTrackId  = c.trackId;

        // Cross-track drag bookkeeping (Task A) — capture row bounds at start
        const rowRects: Array<{ id: string; top: number; bottom: number }> = [];
        this._elTrackBodies.querySelectorAll<HTMLElement>('[data-track-row]').forEach(row => {
            const rect = row.getBoundingClientRect();
            rowRects.push({ id: row.dataset.trackRow!, top: rect.top, bottom: rect.bottom });
        });

        const rowAt = (clientY: number): string | null => {
            for (const r of rowRects) if (clientY >= r.top && clientY < r.bottom) return r.id;
            if (rowRects.length === 0) return null;
            if (clientY < rowRects[0]!.top)                    return rowRects[0]!.id;
            if (clientY >= rowRects[rowRects.length-1]!.bottom) return rowRects[rowRects.length-1]!.id;
            return null;
        };

        let highlightedRow: HTMLElement | null = null;
        const setHighlight = (rowId: string | null) => {
            if (highlightedRow) highlightedRow.classList.remove('ar-audiotrack__body--dropping');
            highlightedRow = rowId
                ? this._elTrackBodies.querySelector<HTMLElement>(`[data-track-row="${rowId}"]`)
                : null;
            if (highlightedRow) highlightedRow.classList.add('ar-audiotrack__body--dropping');
        };

        el.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const dx = (ev.clientX - startX) / px;
            if (mode === 'move') {
                c.start = Math.max(0, startStart + dx);
            } else if (mode === 'resize-right') {
                c.duration = Math.max(0.05, startDur + dx);
            } else if (mode === 'resize-left') {
                const newStart = Math.max(0, startStart + dx);
                const delta = newStart - startStart;
                c.start = newStart;
                c.offset = startOffset + delta;
                c.duration = Math.max(0.05, startDur - delta);
            }
            el.style.left  = (c.start * px) + 'px';
            el.style.width = Math.max(20, c.duration * px) + 'px';

            // Cross-track Y movement (Task A)
            if (mode === 'move') {
                const targetTrackId = rowAt(ev.clientY);
                if (targetTrackId && targetTrackId !== c.trackId) {
                    c.trackId = targetTrackId;
                    const newRow = this._elTrackBodies.querySelector<HTMLElement>(`[data-track-row="${targetTrackId}"]`);
                    if (newRow && el.parentElement !== newRow) newRow.appendChild(el);
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
        };

        const onUp = () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup',   onUp);
            setHighlight(null);
            this._renderClips();
            if (mode === 'move' && c.trackId !== startTrackId) {
                this._emit('change', { kind: 'move-clip-track', clip: c, fromTrack: startTrackId, toTrack: c.trackId });
            }
            this._emit('change', { kind: mode + '-clip', clip: c });
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup',   onUp);
    }

    private _drawWaveform(canvas: HTMLCanvasElement, c: AudioClip): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width, h = canvas.height;
        const data = c.buffer.getChannelData(0);
        const startSample = Math.floor(c.offset * c.buffer.sampleRate);
        const endSample   = Math.min(data.length, startSample + Math.floor(c.duration * c.buffer.sampleRate));
        const samplesPerPx = (endSample - startSample) / w;

        ctx.fillStyle = 'rgba(255,255,255,.7)';
        const mid = h / 2;
        for (let x = 0; x < w; x++) {
            const i = startSample + Math.floor(x * samplesPerPx);
            const j = Math.min(endSample, i + Math.ceil(samplesPerPx));
            let min = 1, max = -1;
            for (let k = i; k < j; k++) {
                const v = data[k] || 0;
                if (v < min) min = v;
                if (v > max) max = v;
            }
            const y1 = mid - max * mid;
            const y2 = mid - min * mid;
            ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
        }
    }

    private _renderPlayhead(): void {
        const px = this._pxPerSec * this._zoom;
        this._elPlayhead.style.display = 'block';
        this._elPlayhead.style.left = (this._playhead * px) + 'px';
    }

    private _injectStyles(): void {
        if (document.getElementById('ar-audiotrack-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-audiotrack-styles';
        s.textContent = `
.ar-audiotrack { font:12px -apple-system,system-ui,sans-serif; background:#1e1e1e; color:#d4d4d4; border-radius:4px; display:flex; flex-direction:column; height:100%; min-height:300px; user-select:none; }
.ar-audiotrack__toolbar { background:#252525; padding:6px 10px; display:flex; gap:8px; align-items:center; border-bottom:1px solid #333; flex-shrink:0; }
.ar-audiotrack__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:4px 10px; font:12px sans-serif; border-radius:3px; cursor:pointer; }
.ar-audiotrack__btn:hover { background:#2a2a2a; }
.ar-audiotrack__lbl { font:11px sans-serif; color:#888; }
.ar-audiotrack__zoom { width:120px; -webkit-appearance:none; height:3px; background:#444; border-radius:2px; outline:none; cursor:pointer; }
.ar-audiotrack__zoom::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; border-radius:50%; background:#e40c88; cursor:pointer; }
.ar-audiotrack__main { flex:1; display:flex; min-height:0; overflow:hidden; }
.ar-audiotrack__heads { width:140px; background:#252525; border-right:1px solid #333; overflow-y:auto; flex-shrink:0; }
.ar-audiotrack__head { height:80px; padding:6px 8px; border-bottom:1px solid #333; box-sizing:border-box; }
.ar-audiotrack__head-row { display:flex; align-items:center; gap:4px; margin:2px 0; }
.ar-audiotrack__head-name { flex:1; font-weight:600; font-size:11px; }
.ar-audiotrack__head-x { background:transparent; border:0; color:#666; font-size:14px; cursor:pointer; padding:0 4px; }
.ar-audiotrack__head-x:hover { color:#dc2626; }
.ar-audiotrack__btn-sm { background:transparent; border:1px solid #444; color:#d4d4d4; padding:2px 8px; font:10px sans-serif; font-weight:600; border-radius:2px; cursor:pointer; }
.ar-audiotrack__btn-sm.mute.active { background:#dc2626; border-color:#dc2626; color:#fff; }
.ar-audiotrack__btn-sm.solo.active { background:#eab308; border-color:#eab308; color:#1f1f1f; }
.ar-audiotrack__rest { flex:1; overflow:auto; }
.ar-audiotrack__ruler { background:#252525; border-bottom:1px solid #333; height:22px; position:relative; }
.ar-audiotrack__ruler-tick { position:absolute; top:0; bottom:0; width:1px; background:#555; }
.ar-audiotrack__ruler-lbl  { position:absolute; top:4px; font:10px ui-monospace,monospace; color:#999; }
.ar-audiotrack__bodies { position:relative; min-height:200px; }
.ar-audiotrack__body { height:80px; border-bottom:1px solid #333; position:relative; }
.ar-audiotrack__clip { position:absolute; top:4px; bottom:4px; border:1.5px solid #e40c88; border-radius:3px; background:rgba(228,12,136,.2); cursor:move; overflow:hidden; }
.ar-audiotrack__clip.selected { box-shadow:0 0 0 2px #fff inset; }
.ar-audiotrack__clip-lbl { position:absolute; top:2px; left:6px; font:10px sans-serif; color:#fff; pointer-events:none; }
.ar-audiotrack__clip-h { position:absolute; top:0; bottom:0; width:6px; cursor:ew-resize; }
.ar-audiotrack__clip-h.left { left:0; }
.ar-audiotrack__clip-h.right { right:0; }
.ar-audiotrack__wave { position:absolute; left:0; top:18px; pointer-events:none; }
.ar-audiotrack__playhead { position:absolute; top:0; bottom:0; width:2px; background:#16a34a; pointer-events:none; box-shadow:0 0 4px rgba(22,163,74,.5); z-index:10; }

/* Cross-track drag — destination row highlight (Task A) */
.ar-audiotrack__body--dropping { background:rgba(228,12,136,0.10); outline:1px dashed #e40c88; outline-offset:-1px; }

/* Loop selection — overlay on the ruler (Task B) */
.ar-audiotrack__loop-range  { position:absolute; top:0; bottom:0; background:rgba(228,12,136,0.18); border-top:2px solid #e40c88; border-bottom:2px solid #e40c88; cursor:grab; z-index:5; }
.ar-audiotrack__loop-range:active { cursor:grabbing; }
.ar-audiotrack__loop-handle { position:absolute; top:0; bottom:0; width:6px; margin-left:-3px; background:#e40c88; cursor:ew-resize; z-index:6; }
.ar-audiotrack__loop-handle::after { content:''; position:absolute; top:50%; left:50%; width:2px; height:8px; margin:-4px 0 0 -1px; background:rgba(255,255,255,0.7); border-radius:1px; }
`;
        document.head.appendChild(s);
    }
}

function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
}
