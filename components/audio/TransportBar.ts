/**
 * @module    TransportBar
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * DAW-style transport control bar (Cubase/Nuendo/Pro Tools/Logic terminology).
 *
 * Centralised playback control intended to be reused across every AriannA
 * timeline editor — both audio (AudioTrackEditor, PianoRoll) and video
 * (VideoTrackEditor) — and any composite scenario (NodeEditor with timeline,
 * automation curves, etc.). It lives in `components/composite/` because it
 * is cross-domain by design: not specific to audio, not specific to video.
 *
 * The counter supports both display worlds:
 *
 *   • Bars mode  → `bars.beats.ticks`     (musical use: audio + MIDI)
 *   • SMPTE mode → `HH:MM:SS:FF`           (video use: 24/25/29.97/30/50/59.94/60 fps)
 *
 *   ⏮  rewind   ▶  play   ⏸  pause   ⏹  stop   ⏭  ff   ⏺  record   🔁  loop
 *
 *   │   00:00:24:15   │   12.3.480   │   BPM 120   │   4/4   │   48 kHz   │
 *
 * The component does not own a playback engine — it emits events and the host
 * decides how to interpret them. The host calls `setTime(seconds)` to drive
 * the displayed counter, and the bar drives the host through events.
 *
 * @example
 *   // Audio editor
 *   import { TransportBar } from 'ariannajs/components/composite';
 *
 *   const tb = new TransportBar('#transport', { bpm: 128, timeSignature: '4/4' });
 *
 *   tb.on('play',   () => engine.play());
 *   tb.on('pause',  () => engine.pause());
 *   tb.on('stop',   () => { engine.stop(); engine.seek(0); });
 *   tb.on('seek',   e  => engine.seek(e.time));
 *   tb.on('loop',   e  => engine.setLoop(e.enabled));
 *   tb.on('bpm',    e  => engine.setBpm(e.bpm));
 *   tb.on('record', e  => engine.setRecording(e.enabled));
 *
 *   engine.on('tick', t => tb.setTime(t));
 *
 * @example
 *   // Video editor — same component, SMPTE mode, no record button
 *   const tb = new TransportBar('#transport', {
 *       mode: 'smpte', framerate: 30, showRecord: false,
 *   });
 *   tb.on('play',  () => videoPlayer.play());
 *   tb.on('seek',  e  => videoPlayer.seek(e.time));
 *   videoPlayer.on('timeupdate', e => tb.setTime(e.time));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Modes ────────────────────────────────────────────────────────────────────

/** Display mode for the time counter. */
export type TimecodeMode = 'smpte' | 'bars';

/** Common SMPTE framerates. Drop-frame is approximated with `29.97`. */
export type Framerate = 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60;

// ── Options ──────────────────────────────────────────────────────────────────

export interface TransportBarOptions extends CtrlOptions {
    /** Initial timecode mode. Default 'bars'. */
    mode?           : TimecodeMode;
    /** Initial BPM. Default 120. */
    bpm?            : number;
    /** Time signature as a string `"N/D"`. Default `"4/4"`. */
    timeSignature?  : string;
    /** Sample rate in Hz, displayed only. Default 48000. */
    sampleRate?     : number;
    /** Ticks per beat for bars mode. Default 480 (industry standard MIDI PPQN). */
    ppqn?           : number;
    /** Framerate for SMPTE mode. Default 30. */
    framerate?      : Framerate;
    /** Show BPM/time-sig/sr indicators on the right side. Default true. */
    showIndicators? : boolean;
    /** Show record button. Default true. */
    showRecord?     : boolean;
    /** Initial loop state. Default false. */
    loopEnabled?    : boolean;
    /** Initial play state. Default false. */
    playing?        : boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * The TransportBar is a stateless display + controls component. The host
 * is responsible for the actual playback engine; the bar simply emits
 * `play`, `pause`, `stop`, `rewind`, `forward`, `record`, `loop`, `seek`,
 * `bpm`, `mode` events and reflects state set via `setPlaying()`,
 * `setTime()`, `setRecording()`, `setLoop()`, `setBpm()`.
 */
export class TransportBar extends Control<TransportBarOptions> {

    // State
    private _playing   : boolean = false;
    private _recording : boolean = false;
    private _loop      : boolean = false;
    private _time      : number  = 0;       // current position in seconds
    private _bpm       : number  = 120;
    private _ppqn      : number  = 480;
    private _framerate : Framerate = 30;
    private _timeSig   : [number, number] = [4, 4];
    private _sampleRate: number  = 48000;
    private _mode      : TimecodeMode = 'bars';

    // DOM refs
    private _elRewind!  : HTMLButtonElement;
    private _elPlay!    : HTMLButtonElement;
    private _elStop!    : HTMLButtonElement;
    private _elForward! : HTMLButtonElement;
    private _elRecord?  : HTMLButtonElement;
    private _elLoop!    : HTMLButtonElement;
    private _elCounter! : HTMLElement;
    private _elModeBtn! : HTMLButtonElement;
    private _elBpm?     : HTMLInputElement;
    private _elTimeSig? : HTMLInputElement;

    constructor(container: string | HTMLElement | null, opts: TransportBarOptions = {})
    {
        super(container, 'div', {
            mode           : 'bars',
            bpm            : 120,
            timeSignature  : '4/4',
            sampleRate     : 48000,
            ppqn           : 480,
            framerate      : 30,
            showIndicators : true,
            showRecord     : true,
            loopEnabled    : false,
            playing        : false,
            ...opts,
        });

        this.el.className = `ar-transportbar${opts.class ? ' ' + opts.class : ''}`;

        // Initialise state from options
        this._mode       = this._get<TimecodeMode>('mode', 'bars');
        this._bpm        = this._get<number>('bpm', 120);
        this._ppqn       = this._get<number>('ppqn', 480);
        this._framerate  = this._get<Framerate>('framerate', 30);
        this._sampleRate = this._get<number>('sampleRate', 48000);
        this._loop       = this._get<boolean>('loopEnabled', false);
        this._playing    = this._get<boolean>('playing', false);
        this._timeSig    = parseTimeSig(this._get<string>('timeSignature', '4/4'));

        this._injectStyles();
        this._build();
    }

    // ── Public API: state setters (host → bar) ─────────────────────────────

    /** Update displayed playback state without firing events. */
    setPlaying(playing: boolean): this
    {
        this._playing = playing;
        this._refreshPlayButton();
        return this;
    }

    /** Update displayed counter (host drives this on every audio frame / tick). */
    setTime(seconds: number): this
    {
        this._time = Math.max(0, seconds);
        this._refreshCounter();
        return this;
    }

    /** Update record-armed state without firing events. */
    setRecording(rec: boolean): this
    {
        this._recording = rec;
        this._refreshRecordButton();
        return this;
    }

    /** Update loop-enabled state without firing events. */
    setLoop(enabled: boolean): this
    {
        this._loop = enabled;
        this._refreshLoopButton();
        return this;
    }

    /** Programmatically change BPM (also updates the input). */
    setBpm(bpm: number): this
    {
        this._bpm = Math.max(1, bpm);
        if (this._elBpm) this._elBpm.value = String(this._bpm);
        this._refreshCounter();   // bars-mode position depends on BPM
        return this;
    }

    /** Programmatically change time signature (e.g. "3/4", "7/8"). */
    setTimeSignature(sig: string): this
    {
        this._timeSig = parseTimeSig(sig);
        if (this._elTimeSig) this._elTimeSig.value = sig;
        this._refreshCounter();
        return this;
    }

    /** Switch between SMPTE and bars display. */
    setMode(mode: TimecodeMode): this
    {
        this._mode = mode;
        this._elModeBtn.textContent = mode === 'smpte' ? 'SMPTE' : 'BARS';
        this._refreshCounter();
        this._emit('mode', { mode });
        return this;
    }

    // ── Public API: getters ────────────────────────────────────────────────

    getTime():     number  { return this._time; }
    getBpm():      number  { return this._bpm; }
    getMode():     TimecodeMode { return this._mode; }
    isPlaying():   boolean { return this._playing; }
    isRecording(): boolean { return this._recording; }
    isLooping():   boolean { return this._loop; }

    // ── Building ──────────────────────────────────────────────────────────

    protected _build(): void
    {
        const showIndicators = this._get<boolean>('showIndicators', true);
        const showRecord     = this._get<boolean>('showRecord',     true);

        this.el.innerHTML = `
<div class="ar-transportbar__group ar-transportbar__group--ctrl">
  <button class="ar-transportbar__btn" data-r="rewind"  title="Rewind">⏮</button>
  <button class="ar-transportbar__btn ar-transportbar__btn--play" data-r="play" title="Play">▶</button>
  <button class="ar-transportbar__btn" data-r="stop"    title="Stop">■</button>
  <button class="ar-transportbar__btn" data-r="forward" title="Fast forward">⏭</button>
  ${showRecord ? `<button class="ar-transportbar__btn ar-transportbar__btn--rec" data-r="record" title="Record">●</button>` : ''}
  <button class="ar-transportbar__btn" data-r="loop"   title="Toggle loop">🔁</button>
</div>

<div class="ar-transportbar__counter" data-r="counter" title="Click to switch mode">0.1.0</div>
<button class="ar-transportbar__mode" data-r="mode" title="Switch SMPTE / BARS">${this._mode.toUpperCase()}</button>

${showIndicators ? `
<div class="ar-transportbar__group ar-transportbar__group--meta">
  <label class="ar-transportbar__lbl">BPM</label>
  <input  class="ar-transportbar__num" data-r="bpm" type="number" min="1" max="999" step="1" value="${this._bpm}">
  <label class="ar-transportbar__lbl">Sig</label>
  <input  class="ar-transportbar__sig" data-r="timesig" type="text" maxlength="5" value="${this._timeSig[0]}/${this._timeSig[1]}">
  <span class="ar-transportbar__sr">${formatSampleRate(this._sampleRate)}</span>
</div>` : ''}
`;
        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;

        this._elRewind  = r('rewind')  as HTMLButtonElement;
        this._elPlay    = r('play')    as HTMLButtonElement;
        this._elStop    = r('stop')    as HTMLButtonElement;
        this._elForward = r('forward') as HTMLButtonElement;
        this._elLoop    = r('loop')    as HTMLButtonElement;
        this._elCounter = r('counter');
        this._elModeBtn = r('mode')    as HTMLButtonElement;
        if (showRecord)     this._elRecord  = r('record')  as HTMLButtonElement;
        if (showIndicators)
        {
            this._elBpm     = r('bpm')     as HTMLInputElement;
            this._elTimeSig = r('timesig') as HTMLInputElement;
        }

        this._wireEvents();
        this._refreshPlayButton();
        this._refreshLoopButton();
        this._refreshRecordButton();
        this._refreshCounter();
    }

    private _wireEvents(): void
    {
        this._elRewind.addEventListener('click', () =>
        {
            this._time = 0;
            this._refreshCounter();
            this._emit('rewind', { time: this._time });
            this._emit('seek',   { time: this._time });
        });

        this._elPlay.addEventListener('click', () =>
        {
            if (this._playing) { this._playing = false; this._emit('pause', {}); }
            else               { this._playing = true;  this._emit('play',  {}); }
            this._refreshPlayButton();
        });

        this._elStop.addEventListener('click', () =>
        {
            this._playing = false;
            this._time    = 0;
            this._refreshPlayButton();
            this._refreshCounter();
            this._emit('stop', {});
        });

        this._elForward.addEventListener('click', () =>
        {
            // Move forward by 1 second (host can intercept and override)
            this._time += 1;
            this._refreshCounter();
            this._emit('forward', { time: this._time });
            this._emit('seek',    { time: this._time });
        });

        if (this._elRecord)
        {
            this._elRecord.addEventListener('click', () =>
            {
                this._recording = !this._recording;
                this._refreshRecordButton();
                this._emit('record', { enabled: this._recording });
            });
        }

        this._elLoop.addEventListener('click', () =>
        {
            this._loop = !this._loop;
            this._refreshLoopButton();
            this._emit('loop', { enabled: this._loop });
        });

        this._elCounter.addEventListener('click', () => this._toggleMode());
        this._elModeBtn.addEventListener('click', () => this._toggleMode());

        if (this._elBpm)
        {
            this._elBpm.addEventListener('change', () =>
            {
                const v = parseFloat(this._elBpm!.value);
                if (Number.isFinite(v) && v > 0)
                {
                    this._bpm = v;
                    this._refreshCounter();
                    this._emit('bpm', { bpm: this._bpm });
                }
            });
        }

        if (this._elTimeSig)
        {
            this._elTimeSig.addEventListener('change', () =>
            {
                const sig = this._elTimeSig!.value.trim();
                this._timeSig = parseTimeSig(sig);
                this._refreshCounter();
                this._emit('timeSignature', { numerator: this._timeSig[0], denominator: this._timeSig[1] });
            });
        }
    }

    private _toggleMode(): void
    {
        this.setMode(this._mode === 'smpte' ? 'bars' : 'smpte');
    }

    // ── Refresh helpers ────────────────────────────────────────────────────

    private _refreshPlayButton(): void
    {
        if (this._playing)
        {
            this._elPlay.textContent = '‖';
            this._elPlay.classList.add('ar-transportbar__btn--active');
            this._elPlay.title = 'Pause';
        }
        else
        {
            this._elPlay.textContent = '▶';
            this._elPlay.classList.remove('ar-transportbar__btn--active');
            this._elPlay.title = 'Play';
        }
    }

    private _refreshRecordButton(): void
    {
        if (!this._elRecord) return;
        this._elRecord.classList.toggle('ar-transportbar__btn--armed', this._recording);
    }

    private _refreshLoopButton(): void
    {
        this._elLoop.classList.toggle('ar-transportbar__btn--active', this._loop);
    }

    private _refreshCounter(): void
    {
        if (this._mode === 'smpte')
        {
            this._elCounter.textContent = formatSMPTE(this._time, this._framerate);
        }
        else
        {
            this._elCounter.textContent = formatBars(this._time, this._bpm, this._timeSig, this._ppqn);
        }
    }

    // ── Styles ─────────────────────────────────────────────────────────────

    private _injectStyles(): void
    {
        if (document.getElementById('ar-transportbar-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-transportbar-styles';
        s.textContent = `
.ar-transportbar { display:flex; align-items:center; gap:14px; padding:8px 14px; background:#1e1e1e; border:1px solid #333; border-radius:6px; color:#d4d4d4; font:13px -apple-system,system-ui,sans-serif; user-select:none; }
.ar-transportbar__group { display:flex; align-items:center; gap:4px; }
.ar-transportbar__group--meta { gap:6px; margin-left:auto; }
.ar-transportbar__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:4px 10px; font:13px sans-serif; border-radius:3px; cursor:pointer; min-width:34px; transition:background .12s, border-color .12s; }
.ar-transportbar__btn:hover { background:#2a2a2a; }
.ar-transportbar__btn--play { background:#16a34a; border-color:#16a34a; color:#fff; }
.ar-transportbar__btn--play:hover { background:#15803d; }
.ar-transportbar__btn--play.ar-transportbar__btn--active { background:#15803d; }
.ar-transportbar__btn--rec { color:#ef4444; }
.ar-transportbar__btn--rec.ar-transportbar__btn--armed { background:#ef4444; color:#fff; border-color:#ef4444; animation:ar-pulse 1.2s ease-in-out infinite; }
@keyframes ar-pulse { 0%,100% { opacity:1; } 50% { opacity:.55; } }
.ar-transportbar__btn--active { background:#e40c88; border-color:#e40c88; color:#fff; }
.ar-transportbar__counter { font:600 18px ui-monospace,SFMono-Regular,Menlo,monospace; color:#fff; background:#0d0d0d; border:1px solid #333; border-radius:4px; padding:4px 12px; min-width:120px; text-align:center; cursor:pointer; letter-spacing:.06em; }
.ar-transportbar__counter:hover { border-color:#e40c88; }
.ar-transportbar__mode { background:transparent; border:1px solid #555; color:#888; font:600 10px sans-serif; padding:4px 8px; border-radius:3px; cursor:pointer; letter-spacing:.08em; }
.ar-transportbar__mode:hover { color:#e40c88; border-color:#e40c88; }
.ar-transportbar__lbl { font:10px sans-serif; color:#888; text-transform:uppercase; letter-spacing:.04em; }
.ar-transportbar__num { width:54px; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:3px 6px; font:13px ui-monospace,monospace; border-radius:3px; }
.ar-transportbar__sig { width:48px; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:3px 6px; font:13px ui-monospace,monospace; text-align:center; border-radius:3px; }
.ar-transportbar__sr { font:10px ui-monospace,monospace; color:#888; padding-left:6px; border-left:1px solid #333; }
`;
        document.head.appendChild(s);
    }
}

// ── Pure helpers (exported for testing) ─────────────────────────────────────

/** Parse a time signature string like `"4/4"` or `"7/8"` into `[num, den]`. */
export function parseTimeSig(s: string): [number, number]
{
    const m = (s || '').match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!m) return [4, 4];
    return [parseInt(m[1]!, 10) || 4, parseInt(m[2]!, 10) || 4];
}

/** Format a sample rate like `48000` as `"48 kHz"`. */
export function formatSampleRate(hz: number): string
{
    if (hz >= 1000) return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kHz`;
    return `${hz} Hz`;
}

/**
 * Format seconds as `HH:MM:SS:FF` SMPTE timecode.
 *
 *   formatSMPTE(0,        30)  → "00:00:00:00"
 *   formatSMPTE(24.5,     30)  → "00:00:24:15"
 *   formatSMPTE(3661.0,   25)  → "01:01:01:00"
 */
export function formatSMPTE(seconds: number, framerate: Framerate = 30): string
{
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const totalFrames = Math.floor(seconds * framerate);
    const ff   = totalFrames % Math.round(framerate);
    const totS = Math.floor(totalFrames / framerate);
    const ss   = totS % 60;
    const mm   = Math.floor(totS / 60) % 60;
    const hh   = Math.floor(totS / 3600);
    return [hh, mm, ss, ff].map(n => String(n).padStart(2, '0')).join(':');
}

/**
 * Format seconds as `bars.beats.ticks` (musical timecode).
 *
 * Bars are 1-indexed (first bar is "1"), beats are 1-indexed (first beat
 * is "1.1"), ticks are 0-indexed within a beat (`0..ppqn-1`). The
 * denominator of the time signature scales the beat unit: 4/4 counts
 * quarter notes, 6/8 counts eighth notes, etc.
 *
 *   formatBars(0,    120, [4,4], 480)  → "1.1.0"
 *   formatBars(0.5,  120, [4,4], 480)  → "1.2.0"      (one quarter note @ 120 BPM = 0.5s)
 *   formatBars(2.0,  120, [4,4], 480)  → "2.1.0"      (4 quarter notes = 1 bar)
 */
export function formatBars(
    seconds  : number,
    bpm      : number,
    timeSig  : [number, number] = [4, 4],
    ppqn     : number = 480,
): string
{
    if (!isFinite(seconds) || seconds < 0) seconds = 0;

    const [num, den] = timeSig;
    // BPM is always quarter-note BPM by industry convention; convert to beats
    // of the signature denominator so 6/8 counts eighth-note beats
    const beatsPerSecond = (bpm / 60) * (den / 4);
    const beatsTotal     = seconds * beatsPerSecond;

    const beatIdx     = Math.floor(beatsTotal);
    const beatFrac    = beatsTotal - beatIdx;
    const tick        = Math.floor(beatFrac * ppqn);

    const bar         = Math.floor(beatIdx / num) + 1;     // 1-indexed
    const beatInBar   = (beatIdx % num) + 1;               // 1-indexed

    return `${bar}.${beatInBar}.${tick}`;
}
