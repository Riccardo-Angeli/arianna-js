/**
 * @module    VideoPlayer
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Video playback component with transport, seek bar, volume, time display,
 * fullscreen, and Web Audio routing on the audio track.
 *
 * @example
 *   import { VideoPlayer } from 'ariannajs/components/audio';
 *
 *   const v = new VideoPlayer('#root', {
 *     src: 'movie.mp4',
 *     poster: 'poster.jpg',
 *     loop: false,
 *   });
 *
 *   // Web Audio routing on the audio track
 *   v.connect(strip);
 *
 *   v.on('timeupdate', e => updateSubtitles(e.time));
 */

import { AudioComponent, type AudioComponentOptions } from '../audio/AudioComponent.ts';

export interface VideoPlayerOptions extends AudioComponentOptions {
    src?           : string;
    poster?        : string;
    loop?          : boolean;
    volume?        : number;
    autoplay?      : boolean;
    showControls?  : boolean;
    /** Aspect-ratio for the player. Default '16/9'. */
    aspectRatio?   : string;
}

export class VideoPlayer extends AudioComponent<VideoPlayerOptions> {
    private _video!    : HTMLVideoElement;
    private _source!   : MediaElementAudioSourceNode;
    private _gain!     : GainNode;

    private _elPlay!   : HTMLButtonElement;
    private _elTime!   : HTMLElement;
    private _elBar!    : HTMLInputElement;
    private _elVolume! : HTMLInputElement;
    private _elDur!    : HTMLElement;
    private _elFs!     : HTMLButtonElement;

    constructor(container: string | HTMLElement | null, opts: VideoPlayerOptions = {}) {
        super(container, 'div', {
            loop         : false,
            volume       : 1,
            autoplay     : false,
            showControls : true,
            aspectRatio  : '16/9',
            ...opts,
        });

        this.el.className = `ar-videoplayer${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._buildAudioGraph();
        this._buildShell();

        if (opts.src) this.load(opts.src, opts.poster);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    load(src: string, poster?: string): this {
        this._video.src = src;
        if (poster) this._video.poster = poster;
        this._video.load();
        return this;
    }

    play(): Promise<void> {
        AudioComponent.resume();
        return this._video.play();
    }

    pause(): this { this._video.pause(); return this; }
    stop():  this { this._video.pause(); this._video.currentTime = 0; return this; }

    seek(time: number): this {
        this._video.currentTime = Math.max(0, Math.min(time, this._video.duration || 0));
        return this;
    }

    setVolume(v: number): this {
        const c = Math.max(0, Math.min(1, v));
        this._video.volume = c;
        this._gain.gain.value = c;
        if (this._elVolume) this._elVolume.value = String(c);
        return this;
    }

    setLoop(loop: boolean): this { this._video.loop = loop; return this; }

    fullscreen(): this {
        if (this._video.requestFullscreen) this._video.requestFullscreen();
        return this;
    }

    getCurrentTime(): number { return this._video.currentTime; }
    getDuration():    number { return this._video.duration || 0; }
    isPlaying():      boolean { return !this._video.paused; }
    getElement():     HTMLVideoElement { return this._video; }

    // ── Internal ────────────────────────────────────────────────────────────

    protected _buildAudioGraph(): void {
        this._video = document.createElement('video');
        this._video.crossOrigin = 'anonymous';
        this._video.loop     = this._get<boolean>('loop',     false);
        this._video.volume   = this._get<number>('volume',   1);
        this._video.autoplay = this._get<boolean>('autoplay', false);
        this._video.playsInline = true;

        this._source = this._audioCtx.createMediaElementSource(this._video);
        this._gain   = this._audioCtx.createGain();
        this._gain.gain.value = this._get<number>('volume', 1);

        this._source.connect(this._gain);
        this._gain.connect(this._audioCtx.destination);

        this._output = this._gain;

        this._video.addEventListener('play',       () => this._emit('play',       {}));
        this._video.addEventListener('pause',      () => this._emit('pause',      {}));
        this._video.addEventListener('ended',      () => this._emit('ended',      {}));
        this._video.addEventListener('timeupdate', () => {
            this._refreshTime();
            this._emit('timeupdate', { time: this._video.currentTime, duration: this._video.duration });
        });
        this._video.addEventListener('loadedmetadata', () => {
            this._refreshTime();
            this._emit('loaded', { duration: this._video.duration,
                                   width: this._video.videoWidth,
                                   height: this._video.videoHeight });
        });
    }

    protected _build(): void { /* shell built explicitly */ }

    private _buildShell(): void {
        const ar = this._get<string>('aspectRatio', '16/9');
        this.el.innerHTML = `
<div class="ar-videoplayer__stage" data-r="stage" style="aspect-ratio:${ar}"></div>
${this._get<boolean>('showControls', true) ? `
<div class="ar-videoplayer__row">
  <button class="ar-videoplayer__btn play" data-r="play" title="Play / Pause">▶</button>
  <button class="ar-videoplayer__btn"      data-r="stop" title="Stop">■</button>
  <span class="ar-videoplayer__time" data-r="time">0:00</span>
  <input  class="ar-videoplayer__bar"  data-r="bar"  type="range" min="0" max="1000" value="0">
  <span class="ar-videoplayer__time" data-r="duration">0:00</span>
  <span class="ar-videoplayer__lbl">Vol</span>
  <input  class="ar-videoplayer__vol" data-r="volume" type="range" min="0" max="1" step="0.01">
  <button class="ar-videoplayer__btn" data-r="fs" title="Fullscreen">⛶</button>
</div>` : ''}`;

        const stage = this.el.querySelector<HTMLElement>('[data-r="stage"]')!;
        stage.appendChild(this._video);

        if (!this._get<boolean>('showControls', true)) return;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elPlay   = r('play')     as HTMLButtonElement;
        this._elTime   = r('time');
        this._elDur    = r('duration');
        this._elBar    = r('bar')      as HTMLInputElement;
        this._elVolume = r('volume')   as HTMLInputElement;
        this._elFs     = r('fs')       as HTMLButtonElement;

        this._elVolume.value = String(this._get<number>('volume', 1));

        this._elPlay.addEventListener('click', () => {
            if (this.isPlaying()) this.pause();
            else                  this.play();
        });
        r('stop').addEventListener('click', () => this.stop());

        this._elBar.addEventListener('input', () => {
            const frac = parseInt(this._elBar.value, 10) / 1000;
            this.seek(frac * (this._video.duration || 0));
        });
        this._elVolume.addEventListener('input', () =>
            this.setVolume(parseFloat(this._elVolume.value)));

        this._elFs.addEventListener('click', () => this.fullscreen());

        this._video.addEventListener('play',  () => this._elPlay.textContent = '‖');
        this._video.addEventListener('pause', () => this._elPlay.textContent = '▶');
        this._video.addEventListener('ended', () => this._elPlay.textContent = '▶');
    }

    private _refreshTime(): void {
        if (!this._elTime) return;
        const cur = this._video.currentTime || 0;
        const dur = this._video.duration   || 0;
        this._elTime.textContent = formatTime(cur);
        this._elDur.textContent  = formatTime(dur);
        if (dur > 0 && this._elBar) {
            this._elBar.value = String(Math.round(cur / dur * 1000));
        }
    }

    private _injectStyles(): void {
        if (document.getElementById('ar-videoplayer-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-videoplayer-styles';
        s.textContent = `
.ar-videoplayer { font:13px -apple-system,system-ui,sans-serif; background:#1e1e1e; color:#d4d4d4; border-radius:6px; overflow:hidden; }
.ar-videoplayer__stage { width:100%; background:#000; position:relative; }
.ar-videoplayer__stage video { width:100%; height:100%; display:block; }
.ar-videoplayer__row { display:flex; align-items:center; gap:10px; padding:8px 12px; }
.ar-videoplayer__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:4px 10px; font:14px sans-serif; border-radius:3px; cursor:pointer; min-width:32px; }
.ar-videoplayer__btn:hover { background:#2a2a2a; }
.ar-videoplayer__btn.play { background:#16a34a; border-color:#16a34a; color:#fff; }
.ar-videoplayer__btn.play:hover { background:#15803d; }
.ar-videoplayer__time { font:11px ui-monospace,monospace; color:#888; min-width:40px; text-align:center; }
.ar-videoplayer__bar { flex:1; -webkit-appearance:none; height:4px; background:#444; border-radius:2px; outline:none; cursor:pointer; }
.ar-videoplayer__bar::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#e40c88; cursor:pointer; }
.ar-videoplayer__bar::-moz-range-thumb     { width:12px; height:12px; border-radius:50%; background:#e40c88; cursor:pointer; border:0; }
.ar-videoplayer__lbl { font:10px sans-serif; color:#888; }
.ar-videoplayer__vol { width:80px; -webkit-appearance:none; height:3px; background:#444; border-radius:2px; outline:none; cursor:pointer; }
.ar-videoplayer__vol::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; border-radius:50%; background:#d4d4d4; cursor:pointer; }
.ar-videoplayer__vol::-moz-range-thumb     { width:10px; height:10px; border-radius:50%; background:#d4d4d4; cursor:pointer; border:0; }
`;
        document.head.appendChild(s);
    }
}

function formatTime(s: number): string {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
}
