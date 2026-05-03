/**
 * @module    AudioPlayer
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Audio playback component with transport (play/pause/stop), seek bar,
 * volume, time display, and Web Audio routing (output is a GainNode
 * that downstream components can connect to).
 *
 * @example
 *   import { AudioPlayer } from 'ariannajs/components/audio';
 *
 *   const p = new AudioPlayer('#root', {
 *     src: 'song.mp3',
 *     loop: false,
 *     volume: 0.8,
 *   });
 *
 *   p.on('timeupdate', e => console.log(e.time, e.duration));
 *   p.on('ended',      ()  => console.log('done'));
 *
 *   // Web Audio routing
 *   p.connect(strip);
 */

import { AudioComponent, type AudioComponentOptions } from './AudioComponent.ts';

export interface AudioPlayerOptions extends AudioComponentOptions {
    /** Initial source URL. */
    src?      : string;
    /** Loop playback. Default false. */
    loop?     : boolean;
    /** Initial volume 0..1. Default 1. */
    volume?   : number;
    /** Auto-play on load (subject to browser autoplay policy). */
    autoplay? : boolean;
    /** Show transport controls. Default true. */
    showControls? : boolean;
}

export class AudioPlayer extends AudioComponent<AudioPlayerOptions> {
    private _audio!     : HTMLAudioElement;
    private _source!    : MediaElementAudioSourceNode;
    private _gain!      : GainNode;

    private _elPlay!    : HTMLButtonElement;
    private _elTime!    : HTMLElement;
    private _elBar!     : HTMLInputElement;
    private _elVolume!  : HTMLInputElement;
    private _elDuration!: HTMLElement;

    constructor(container: string | HTMLElement | null, opts: AudioPlayerOptions = {}) {
        super(container, 'div', {
            loop         : false,
            volume       : 1,
            autoplay     : false,
            showControls : true,
            ...opts,
        });

        this.el.className = `ar-audioplayer${opts.class ? ' ' + opts.class : ''}`;
        this._injectStyles();
        this._buildAudioGraph();
        this._buildShell();

        if (opts.src) this.load(opts.src);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    load(src: string): this {
        this._audio.src = src;
        this._audio.load();
        return this;
    }

    play(): Promise<void> {
        // User-gesture guarantee: resume context if suspended
        AudioComponent.resume();
        return this._audio.play();
    }

    pause(): this { this._audio.pause(); return this; }
    stop():  this { this._audio.pause(); this._audio.currentTime = 0; return this; }

    seek(time: number): this {
        this._audio.currentTime = Math.max(0, Math.min(time, this._audio.duration || 0));
        return this;
    }

    setVolume(v: number): this {
        const clamped = Math.max(0, Math.min(1, v));
        this._audio.volume = clamped;
        this._gain.gain.value = clamped;
        if (this._elVolume) this._elVolume.value = String(clamped);
        return this;
    }

    setLoop(loop: boolean): this { this._audio.loop = loop; return this; }

    getCurrentTime(): number { return this._audio.currentTime; }
    getDuration():    number { return this._audio.duration || 0; }
    isPlaying():      boolean { return !this._audio.paused; }

    // ── Internal ────────────────────────────────────────────────────────────

    protected _buildAudioGraph(): void {
        this._audio = document.createElement('audio');
        this._audio.crossOrigin = 'anonymous';
        this._audio.loop     = this._get<boolean>('loop',     false);
        this._audio.volume   = this._get<number>('volume',   1);
        this._audio.autoplay = this._get<boolean>('autoplay', false);

        this._source = this._audioCtx.createMediaElementSource(this._audio);
        this._gain   = this._audioCtx.createGain();
        this._gain.gain.value = this._get<number>('volume', 1);

        this._source.connect(this._gain);
        // Auto-connect to destination by default; user can disconnect to route elsewhere
        this._gain.connect(this._audioCtx.destination);

        this._output = this._gain;
        // Input not used — AudioPlayer is a source

        // Forward HTML media events to AriannA's event system
        this._audio.addEventListener('play',       () => this._emit('play',       {}));
        this._audio.addEventListener('pause',      () => this._emit('pause',      {}));
        this._audio.addEventListener('ended',      () => this._emit('ended',      {}));
        this._audio.addEventListener('timeupdate', () => {
            this._refreshTime();
            this._emit('timeupdate', { time: this._audio.currentTime, duration: this._audio.duration });
        });
        this._audio.addEventListener('loadedmetadata', () => {
            this._refreshTime();
            this._emit('loaded', { duration: this._audio.duration });
        });
    }

    protected _build(): void { /* shell built explicitly */ }

    private _buildShell(): void {
        if (!this._get<boolean>('showControls', true)) {
            this.el.appendChild(this._audio);
            return;
        }

        this.el.innerHTML = `
<div class="ar-audioplayer__row">
  <button class="ar-audioplayer__btn play" data-r="play" title="Play / Pause">▶</button>
  <button class="ar-audioplayer__btn"      data-r="stop" title="Stop">■</button>
  <span class="ar-audioplayer__time" data-r="time">0:00</span>
  <input  class="ar-audioplayer__bar"  data-r="bar"  type="range" min="0" max="1000" value="0">
  <span class="ar-audioplayer__time" data-r="duration">0:00</span>
  <span class="ar-audioplayer__lbl">Vol</span>
  <input  class="ar-audioplayer__vol" data-r="volume" type="range" min="0" max="1" step="0.01">
</div>`;
        this.el.appendChild(this._audio);

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elPlay     = r('play')     as HTMLButtonElement;
        this._elTime     = r('time');
        this._elDuration = r('duration');
        this._elBar      = r('bar')      as HTMLInputElement;
        this._elVolume   = r('volume')   as HTMLInputElement;

        this._elVolume.value = String(this._get<number>('volume', 1));

        this._elPlay.addEventListener('click', () => {
            if (this.isPlaying()) this.pause();
            else                  this.play();
        });
        r('stop').addEventListener('click', () => this.stop());

        this._elBar.addEventListener('input', () => {
            const frac = parseInt(this._elBar.value, 10) / 1000;
            this.seek(frac * (this._audio.duration || 0));
        });
        this._elVolume.addEventListener('input', () => {
            this.setVolume(parseFloat(this._elVolume.value));
        });

        this._audio.addEventListener('play',  () => this._elPlay.textContent = '‖');
        this._audio.addEventListener('pause', () => this._elPlay.textContent = '▶');
        this._audio.addEventListener('ended', () => this._elPlay.textContent = '▶');
    }

    private _refreshTime(): void {
        if (!this._elTime) return;
        const cur = this._audio.currentTime || 0;
        const dur = this._audio.duration   || 0;
        this._elTime.textContent     = formatTime(cur);
        this._elDuration.textContent = formatTime(dur);
        if (dur > 0 && this._elBar) {
            this._elBar.value = String(Math.round(cur / dur * 1000));
        }
    }

    private _injectStyles(): void {
        if (document.getElementById('ar-audioplayer-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-audioplayer-styles';
        s.textContent = `
.ar-audioplayer { font:13px -apple-system,system-ui,sans-serif; background:#1e1e1e; color:#d4d4d4; padding:8px 12px; border-radius:6px; }
.ar-audioplayer__row { display:flex; align-items:center; gap:10px; }
.ar-audioplayer__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:4px 10px; font:14px sans-serif; border-radius:3px; cursor:pointer; min-width:32px; }
.ar-audioplayer__btn:hover { background:#2a2a2a; }
.ar-audioplayer__btn.play { background:#16a34a; border-color:#16a34a; color:#fff; }
.ar-audioplayer__btn.play:hover { background:#15803d; }
.ar-audioplayer__time { font:11px ui-monospace,monospace; color:#888; min-width:40px; text-align:center; }
.ar-audioplayer__bar { flex:1; -webkit-appearance:none; height:4px; background:#444; border-radius:2px; outline:none; cursor:pointer; }
.ar-audioplayer__bar::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#e40c88; cursor:pointer; }
.ar-audioplayer__bar::-moz-range-thumb     { width:12px; height:12px; border-radius:50%; background:#e40c88; cursor:pointer; border:0; }
.ar-audioplayer__lbl { font:10px sans-serif; color:#888; }
.ar-audioplayer__vol { width:80px; -webkit-appearance:none; height:3px; background:#444; border-radius:2px; outline:none; cursor:pointer; }
.ar-audioplayer__vol::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; border-radius:50%; background:#d4d4d4; cursor:pointer; }
.ar-audioplayer__vol::-moz-range-thumb     { width:10px; height:10px; border-radius:50%; background:#d4d4d4; cursor:pointer; border:0; }
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
