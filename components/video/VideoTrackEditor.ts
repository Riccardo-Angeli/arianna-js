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
        this._playhead = Math.max(0, t);
        this._renderPlayhead();
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

        const startX = e.clientX;
        const startStart = c.start, startDur = c.duration, startSrcIn = c.sourceIn;
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
                c.sourceIn = startSrcIn + delta;
                c.duration = Math.max(0.05, startDur - delta);
            }
            el.style.left  = (c.start * px) + 'px';
            el.style.width = Math.max(20, c.duration * px) + 'px';
        };

        const onUp = () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup',   onUp);
            this._renderClips();
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
`;
        document.head.appendChild(s);
    }
}

function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
}
