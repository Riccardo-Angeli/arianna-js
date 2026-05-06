/**
 * @module    PianoRoll
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * MIDI piano-roll editor with vertical keyboard, scrollable beat grid,
 * draw/select/erase tools, snap-to-grid, velocity lane, and live MIDI
 * event emission for external synth/audio engines.
 *
 * @example
 *   import { PianoRoll } from 'ariannajs/components/audio/PianoRoll';
 *
 *   const pr = new PianoRoll('#root', {
 *     bpm: 120,
 *     bars: 8,
 *     pitchLow: 36,
 *     pitchHigh: 96,
 *   });
 *
 *   // Listen to MIDI events during playback
 *   pr.on('midi', evt => {
 *     // evt = { type:'note-on'|'note-off', pitch, velocity, channel, time }
 *     mySynth.send(evt);
 *   });
 *
 *   // Programmatic note creation
 *   pr.addNote(60, 0,    1, 100);   // C4 at beat 0, 1 beat long
 *   pr.addNote(64, 1,    1, 100);   // E4
 *   pr.addNote(67, 2,    2,  90);   // G4 (held longer, softer)
 *
 *   pr.play();
 *
 *   // Round-trippable JSON
 *   const json = pr.export();
 *   pr.load(json);
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Public types ────────────────────────────────────────────────────────────

export interface PianoRollNote {
    /** MIDI pitch 0-127. */
    pitch     : number;
    /** Start in beats (1 beat = 1 quarter note). */
    start     : number;
    /** Duration in beats. */
    duration  : number;
    /** Velocity 0-127. */
    velocity  : number;
    /** MIDI channel 1-16. */
    channel?  : number;
}

export interface MidiEvent {
    type      : 'note-on' | 'note-off';
    pitch     : number;
    velocity  : number;
    channel   : number;
    /** performance.now() at emission. */
    time      : number;
}

export type Tool = 'draw' | 'select' | 'erase';
export type RunState = 'idle' | 'running' | 'paused';

export interface PianoRollOptions extends CtrlOptions {
    /** Tempo in BPM. Default 120. */
    bpm?       : number;
    /** Number of bars (4/4 only for now). Default 8. */
    bars?      : number;
    /** Lowest visible pitch. Default 36 (C2). */
    pitchLow?  : number;
    /** Highest visible pitch. Default 96 (C7). */
    pitchHigh? : number;
    /** Initial snap value in beats. Default 0.25 (1/16). */
    snap?      : number;
    /** Show toolbar. Default true. */
    showToolbar? : boolean;
    /** Show velocity lane. Default true. */
    showVelocity?: boolean;
    /** Show floating events log. Default true. */
    showEvents?  : boolean;
    /** Initial sequence to load. */
    initialSequence? : ExportedSequence;
}

export interface ExportedSequence {
    bpm      : number;
    bars     : number;
    timeSig  : [number, number];
    notes    : PianoRollNote[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROW_HEIGHT    = 16;
const BEAT_WIDTH    = 80;
const BEATS_PER_BAR = 4;
const NOTE_NAMES    = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const BLACK_KEYS    = new Set([1, 3, 6, 8, 10]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function noteName(pitch: number): string {
    const oct = Math.floor(pitch / 12) - 1;
    return NOTE_NAMES[pitch % 12] + oct;
}

interface InternalNote extends PianoRollNote {
    id: string;
}

// ── Implementation ──────────────────────────────────────────────────────────

export class PianoRoll extends Control<PianoRollOptions> {
    // State
    private _notes     : InternalNote[] = [];
    private _nextId    = 1;
    private _runState  : RunState = 'idle';
    private _tool      : Tool = 'draw';
    private _selected  = new Set<string>();
    private _showVel   : boolean;

    // Playback
    private _playhead  = 0;          // beats
    private _playStart = 0;          // performance.now() reference
    private _playRAF   = 0;
    private _activeKeys = new Set<string>();   // pitch+id to track active
    private _eventLog  : MidiEvent[] = [];

    // Loop state — Task B (Loop selection). Stored in BEATS (the PianoRoll's
    // native time unit), not seconds. Convert via bpm if needed.
    private _loop = { start: 0, end: 0, enabled: false };
    private _elLoopRange?      : HTMLElement;
    private _elLoopHandleLeft? : HTMLElement;
    private _elLoopHandleRight?: HTMLElement;

    // DOM
    private _elKeys!       : HTMLElement;
    private _elRuler!      : HTMLElement;
    private _elCanvas!     : HTMLElement;
    private _elGridBg!     : HTMLElement;
    private _elVel!        : HTMLElement;
    private _elPlayhead!   : HTMLElement;
    private _elEvents?     : HTMLElement;
    private _elStatus!     : HTMLElement;
    private _elToolBtns    : Record<Tool, HTMLButtonElement> = {} as Record<Tool, HTMLButtonElement>;
    private _elBpm!        : HTMLInputElement;
    private _elBars!       : HTMLInputElement;
    private _elSnap!       : HTMLSelectElement;
    private _elVelToggle?  : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: PianoRollOptions = {}) {
        super(container, 'div', {
            bpm           : 120,
            bars          : 8,
            pitchLow      : 36,
            pitchHigh     : 96,
            snap          : 0.25,
            showToolbar   : true,
            showVelocity  : true,
            showEvents    : true,
            ...opts,
        });

        this.el.className = `ar-pianoroll${opts.class ? ' ' + opts.class : ''}`;
        this._showVel = this._get<boolean>('showVelocity', true);
        this._injectStyles();
        this._buildShell();

        this._buildKeyboard();
        this._buildRuler();
        this._buildGrid();
        this._renderEvents();

        if (opts.initialSequence) {
            queueMicrotask(() => this.load(opts.initialSequence!));
        }

        // Auto-center on middle C
        queueMicrotask(() => {
            this._elCanvas.scrollTop = this._pitchToY(72) - 100;
        });

        // Keyboard shortcuts
        this._on(document as unknown as HTMLElement, 'keydown', (e: KeyboardEvent) => {
            // Only when this editor's element has focus or is in viewport
            if (!this.el.contains(document.activeElement) &&
                document.activeElement !== document.body) return;
            const tg = e.target as HTMLElement;
            if (tg.tagName === 'INPUT' || tg.tagName === 'SELECT') return;
            if (e.key === 'd' || e.key === 'D') this.setTool('draw');
            if (e.key === 's' || e.key === 'S') this.setTool('select');
            if (e.key === 'e' || e.key === 'E') this.setTool('erase');
            if (e.key === ' ') {
                e.preventDefault();
                if (this._runState === 'running') this.pause();
                else this.play();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                for (const id of [...this._selected]) this.removeNote(id);
            }
        });
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /** Add a note. Returns its generated id. */
    addNote(pitch: number, start: number, duration: number, velocity = 100, channel = 1): string {
        const note: InternalNote = {
            id: `n${this._nextId++}`, pitch, start, duration, velocity, channel,
        };
        this._notes.push(note);
        this._renderNote(note);
        this._renderVelocity();
        this._emit('change', { reason: 'add-note', note });
        return note.id;
    }

    /** Remove a note by id. */
    removeNote(id: string): void {
        this._notes = this._notes.filter(n => n.id !== id);
        this._selected.delete(id);
        this.el.querySelector(`[data-note-id="${CSS.escape(id)}"]`)?.remove();
        this._renderVelocity();
        this._emit('change', { reason: 'remove-note', id });
    }

    /** Update a note's properties. */
    updateNote(id: string, patch: Partial<PianoRollNote>): void {
        const note = this._notes.find(n => n.id === id);
        if (!note) return;
        Object.assign(note, patch);
        const el = this.el.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(id)}"]`);
        if (el) {
            el.style.left   = this._beatToX(note.start) + 'px';
            el.style.top    = this._pitchToY(note.pitch) + 'px';
            el.style.width  = this._beatToX(note.duration) + 'px';
            el.style.height = ROW_HEIGHT + 'px';
            const lbl = el.querySelector('.ar-pianoroll__note-lbl');
            if (lbl) lbl.textContent = noteName(note.pitch);
        }
        this._renderVelocity();
        this._emit('change', { reason: 'update-note', id });
    }

    /** Clear all notes. */
    clear(): void {
        this.el.querySelectorAll('.ar-pianoroll__note').forEach(n => n.remove());
        this._notes = [];
        this._selected.clear();
        this._renderVelocity();
        this._emit('change', { reason: 'clear' });
    }

    /** Set active tool. */
    setTool(t: Tool): void {
        this._tool = t;
        for (const k of Object.keys(this._elToolBtns)) {
            this._elToolBtns[k as Tool].classList.toggle('active', k === t);
        }
        this._elCanvas.style.cursor =
            t === 'draw'  ? 'crosshair' :
            t === 'erase' ? 'not-allowed' :
                            'default';
    }

    getTool(): Tool { return this._tool; }

    /** Start playback. */
    play(): void {
        if (this._runState === 'running') return;
        this._runState = 'running';
        this._refreshStatus();
        this._elPlayhead.style.display = 'block';
        const bpm = this._get<number>('bpm', 120);
        this._playStart = performance.now() - (this._playhead / (bpm / 60)) * 1000;
        this._activeKeys.clear();
        this._tick();
        this._emit('run-state', { state: 'running' });
    }

    /** Pause playback. Resume keeps current position. */
    pause(): void {
        if (this._runState !== 'running') return;
        this._runState = 'paused';
        this._refreshStatus();
        if (this._playRAF) cancelAnimationFrame(this._playRAF);
        for (const key of this._activeKeys) {
            const pitch = parseInt(key.split(':')[0], 10);
            this._fireMidi('note-off', pitch, 0, 1);
        }
        this._activeKeys.clear();
        this._emit('run-state', { state: 'paused' });
    }

    /** Stop and rewind. */
    stop(): void {
        this._runState = 'idle';
        this._refreshStatus();
        this._playhead = 0;
        this._elPlayhead.style.display = 'none';
        if (this._playRAF) cancelAnimationFrame(this._playRAF);
        for (const key of this._activeKeys) {
            const pitch = parseInt(key.split(':')[0], 10);
            this._fireMidi('note-off', pitch, 0, 1);
        }
        this._activeKeys.clear();
        this._emit('run-state', { state: 'idle' });
    }

    getRunState(): RunState { return this._runState; }
    getNotes(): readonly PianoRollNote[] {
        return this._notes.map(n => ({
            pitch: n.pitch, start: n.start, duration: n.duration,
            velocity: n.velocity, channel: n.channel,
        }));
    }

    /** Manually trigger a note (e.g. from UI key click). */
    triggerNote(pitch: number, velocity = 100, channel = 1): void {
        this._fireMidi('note-on', pitch, velocity, channel);
    }
    releaseNote(pitch: number, channel = 1): void {
        this._fireMidi('note-off', pitch, 0, channel);
    }

    /** Export sequence as round-trippable JSON. */
    export(): ExportedSequence {
        return {
            bpm:     this._get<number>('bpm', 120),
            bars:    this._get<number>('bars', 8),
            timeSig: [4, 4],
            notes:   this._notes.map(n => ({
                pitch: n.pitch, start: n.start, duration: n.duration,
                velocity: n.velocity, channel: n.channel,
            })),
        };
    }

    /** Load a sequence, replacing current notes. */
    load(seq: ExportedSequence): void {
        this.clear();
        this._set('bpm',  seq.bpm);
        this._set('bars', seq.bars);
        this._elBpm.value  = String(seq.bpm);
        this._elBars.value = String(seq.bars);
        this._buildRuler();
        this._buildGrid();
        for (const n of seq.notes) {
            this.addNote(n.pitch, n.start, n.duration, n.velocity, n.channel ?? 1);
        }
    }

    // ── Coordinate helpers ──────────────────────────────────────────────────

    private _pitchToY(p: number): number { return (this._get<number>('pitchHigh', 96) - p) * ROW_HEIGHT; }
    private _yToPitch(y: number): number { return this._get<number>('pitchHigh', 96) - Math.floor(y / ROW_HEIGHT); }
    private _beatToX(b: number): number  { return b * BEAT_WIDTH; }
    private _xToBeat(x: number): number  { return x / BEAT_WIDTH; }
    private _snapBeat(b: number): number {
        const s = this._get<number>('snap', 0.25);
        return Math.round(b / s) * s;
    }

    // ── DOM construction ────────────────────────────────────────────────────

    protected _build(): void { /* surgical updates only */ }

    private _buildShell(): void {
        const showToolbar = this._get<boolean>('showToolbar', true);
        this.el.innerHTML = (showToolbar ? `
<div class="ar-pianoroll__toolbar">
  <h3 class="ar-pianoroll__title">PianoRoll</h3>
  <span class="ar-pianoroll__status" data-r="status">— idle</span>
  <div style="width:14px"></div>
  <button class="ar-pianoroll__tool-btn active" data-r="tool-draw">✏ Draw</button>
  <button class="ar-pianoroll__tool-btn"        data-r="tool-select">⌖ Select</button>
  <button class="ar-pianoroll__tool-btn"        data-r="tool-erase">⌫ Erase</button>
  <div style="width:14px"></div>
  <span class="ar-pianoroll__lbl">Snap</span>
  <select class="ar-pianoroll__input" data-r="snap" style="width:auto">
    <option value="0.0625">1/16</option>
    <option value="0.125">1/8</option>
    <option value="0.25" selected>1/4</option>
    <option value="0.5">1/2</option>
    <option value="1">1/1</option>
  </select>
  <span class="ar-pianoroll__lbl">BPM</span>
  <input type="number" class="ar-pianoroll__input" data-r="bpm" min="20" max="300">
  <span class="ar-pianoroll__lbl">Bars</span>
  <input type="number" class="ar-pianoroll__input" data-r="bars" min="1" max="64">
  <div style="flex:1"></div>
  <button class="ar-pianoroll__btn play"  data-r="play">▶ Play</button>
  <button class="ar-pianoroll__btn pause" data-r="pause">‖ Pause</button>
  <button class="ar-pianoroll__btn stop"  data-r="stop">■ Stop</button>
  <div style="width:14px"></div>
  <button class="ar-pianoroll__btn" data-r="clear">Clear</button>
  <button class="ar-pianoroll__btn" data-r="export">Export JSON</button>
</div>
` : '') + `
<div class="ar-pianoroll__grid">
  <div class="ar-pianoroll__corner"></div>
  <div class="ar-pianoroll__ruler" data-r="ruler"></div>
  <div class="ar-pianoroll__keys"  data-r="keys"></div>
  <div class="ar-pianoroll__canvas" data-r="canvas">
    <div class="ar-pianoroll__grid-bg" data-r="grid-bg"></div>
    <div class="ar-pianoroll__vel"     data-r="vel"></div>
    <button class="ar-pianoroll__vel-toggle" data-r="vel-toggle">▼ Velocity</button>
    <div class="ar-pianoroll__playhead" data-r="playhead" style="display:none"></div>
  </div>
</div>` + (this._get<boolean>('showEvents', true) ? `
<div class="ar-pianoroll__events" data-r="events">
  <div class="ar-pianoroll__events-ttl">MIDI Events</div>
  <div data-r="events-list" style="color:#888">(no events yet — press Play)</div>
</div>` : '');

        // Wire refs
        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elKeys      = r('keys');
        this._elRuler     = r('ruler');
        this._elCanvas    = r('canvas');
        this._elGridBg    = r('grid-bg');
        this._elVel       = r('vel');
        this._elPlayhead  = r('playhead');
        if (this._get<boolean>('showEvents', true)) this._elEvents = r('events-list');

        if (showToolbar) {
            this._elStatus  = r('status');
            this._elBpm     = r('bpm') as HTMLInputElement;
            this._elBars    = r('bars') as HTMLInputElement;
            this._elSnap    = r('snap') as HTMLSelectElement;
            this._elVelToggle = r('vel-toggle');

            this._elBpm.value  = String(this._get<number>('bpm',  120));
            this._elBars.value = String(this._get<number>('bars',   8));
            this._elSnap.value = String(this._get<number>('snap', 0.25));

            this._elToolBtns = {
                draw  : r('tool-draw') as HTMLButtonElement,
                select: r('tool-select') as HTMLButtonElement,
                erase : r('tool-erase') as HTMLButtonElement,
            };

            this._elToolBtns.draw  .addEventListener('click', () => this.setTool('draw'));
            this._elToolBtns.select.addEventListener('click', () => this.setTool('select'));
            this._elToolBtns.erase .addEventListener('click', () => this.setTool('erase'));

            r('play') .addEventListener('click', () => this.play());
            r('pause').addEventListener('click', () => this.pause());
            r('stop') .addEventListener('click', () => this.stop());
            r('clear').addEventListener('click', () => {
                if (confirm('Clear all notes?')) this.clear();
            });
            r('export').addEventListener('click', () => this._exportFile());

            this._elBpm.addEventListener('change',  () => this._set('bpm',  parseInt(this._elBpm.value, 10)));
            this._elBars.addEventListener('change', () => {
                this._set('bars', parseInt(this._elBars.value, 10));
                this._buildRuler();
                this._buildGrid();
            });
            this._elSnap.addEventListener('change', () => {
                this._set('snap', parseFloat(this._elSnap.value));
                this._buildGrid();
            });

            this._elVelToggle?.addEventListener('click', () => {
                this._showVel = !this._showVel;
                this._elVel.style.display = this._showVel ? 'block' : 'none';
                if (this._elVelToggle)
                    this._elVelToggle.textContent = this._showVel ? '▼ Velocity' : '▲ Velocity';
            });
        }

        // Canvas pointer (for drawing & selecting)
        this._elCanvas.addEventListener('pointerdown', e => this._onCanvasDown(e));

        // Ruler interactions: shift+drag → loop range, plain click → seek
        this._elRuler.addEventListener('pointerdown', e => this._onRulerDown(e));

        // Sync scroll: keys vertical, ruler horizontal
        this._elCanvas.addEventListener('scroll', () => {
            this._elKeys.scrollTop  = this._elCanvas.scrollTop;
            this._elRuler.scrollLeft = this._elCanvas.scrollLeft;
        });
    }

    private _buildKeyboard(): void {
        this._elKeys.innerHTML = '';
        const lo = this._get<number>('pitchLow', 36);
        const hi = this._get<number>('pitchHigh', 96);
        const totalH = (hi - lo + 1) * ROW_HEIGHT;
        this._elKeys.style.height = totalH + 'px';

        for (let p = hi; p >= lo; p--) {
            const k = document.createElement('div');
            k.className = 'ar-pianoroll__key ' + (BLACK_KEYS.has(p % 12) ? 'black' : 'white');
            k.style.top    = this._pitchToY(p) + 'px';
            k.style.height = ROW_HEIGHT + 'px';
            if (p % 12 === 0 || p % 12 === 7) k.textContent = noteName(p);
            k.dataset.pitch = String(p);
            k.addEventListener('mousedown', e => {
                e.preventDefault();
                this.triggerNote(p, 100);
                const onUp = () => {
                    this.releaseNote(p);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mouseup', onUp);
            });
            this._elKeys.appendChild(k);
        }
    }

    private _buildRuler(): void {
        this._elRuler.innerHTML = '';
        const totalBeats = this._get<number>('bars', 8) * BEATS_PER_BAR;
        this._elRuler.style.width = this._beatToX(totalBeats) + 'px';
        for (let beat = 0; beat <= totalBeats; beat++) {
            const tick = document.createElement('div');
            tick.className = 'ar-pianoroll__tick' + (beat % BEATS_PER_BAR === 0 ? ' bar' : '');
            tick.style.left = this._beatToX(beat) + 'px';
            this._elRuler.appendChild(tick);
            if (beat % BEATS_PER_BAR === 0) {
                const lbl = document.createElement('div');
                lbl.className = 'ar-pianoroll__tick-lbl';
                lbl.style.left = (this._beatToX(beat) + 2) + 'px';
                lbl.textContent = String(beat / BEATS_PER_BAR + 1);
                this._elRuler.appendChild(lbl);
            }
        }

        // Loop overlay (Task B) — re-mounted on every ruler render
        this._renderLoopOverlay();
    }

    /** Render the loop-range overlay + 2 resize handles. Beats-based. */
    private _renderLoopOverlay(): void
    {
        if (this._elLoopRange)       this._elLoopRange.remove();
        if (this._elLoopHandleLeft)  this._elLoopHandleLeft.remove();
        if (this._elLoopHandleRight) this._elLoopHandleRight.remove();
        this._elLoopRange = this._elLoopHandleLeft = this._elLoopHandleRight = undefined;

        if (!this._loop.enabled || this._loop.end <= this._loop.start) return;

        const left  = this._beatToX(this._loop.start);
        const width = this._beatToX(this._loop.end - this._loop.start);

        const range = document.createElement('div');
        range.className = 'ar-pianoroll__loop-range';
        range.style.left  = left + 'px';
        range.style.width = width + 'px';
        this._elRuler.appendChild(range);

        const hL = document.createElement('div');
        hL.className = 'ar-pianoroll__loop-handle ar-pianoroll__loop-handle--left';
        hL.style.left = left + 'px';
        this._elRuler.appendChild(hL);

        const hR = document.createElement('div');
        hR.className = 'ar-pianoroll__loop-handle ar-pianoroll__loop-handle--right';
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
        const startX = e.clientX;
        const startLoop = { ...this._loop };
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const dt = this._xToBeat(ev.clientX - startX);
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
        const startX = e.clientX;
        const startLoop = { ...this._loop };
        const range = e.currentTarget as HTMLElement;
        range.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const dt = this._xToBeat(ev.clientX - startX);
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
     * Pointer-down on the ruler. Shift+drag → create loop range; plain click
     * → seek the playhead (in beats).
     */
    private _onRulerDown(e: PointerEvent): void
    {
        const target = e.target as HTMLElement;
        if (target.classList.contains('ar-pianoroll__loop-range') ||
            target.classList.contains('ar-pianoroll__loop-handle')) return;

        const rect = this._elRuler.getBoundingClientRect();
        const x0 = e.clientX - rect.left + this._elRuler.scrollLeft;
        const b0 = this._xToBeat(x0);

        if (e.shiftKey)
        {
            e.preventDefault();
            e.stopPropagation();
            this._loop.start   = b0;
            this._loop.end     = b0 + 0.001;
            this._loop.enabled = true;
            this._renderLoopOverlay();
            this._elRuler.setPointerCapture(e.pointerId);

            const onMove = (ev: PointerEvent) => {
                const x = ev.clientX - rect.left + this._elRuler.scrollLeft;
                const b = this._xToBeat(x);
                if (b >= b0) { this._loop.start = b0; this._loop.end = b; }
                else         { this._loop.start = b;  this._loop.end = b0; }
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

        // Plain click → seek (write directly; the PianoRoll has no
        // _renderPlayhead method — _tick + this fragment write to _elPlayhead).
        this._playhead = Math.max(0, b0);
        this._elPlayhead.style.left = this._beatToX(this._playhead) + 'px';
        this._elPlayhead.style.display = 'block';
    }

    // ── Loop API (Task B) ──────────────────────────────────────────────────

    /** Get the current loop range (start, end in beats; enabled flag). */
    getLoop(): { start: number; end: number; enabled: boolean }
    {
        return { ...this._loop };
    }

    /** Define and enable the loop range. Values are in beats. */
    setLoop(loop: { start: number; end?: number; enabled?: boolean }): this
    {
        this._loop.start = Math.max(0, loop.start);
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

    private _buildGrid(): void {
        const lo = this._get<number>('pitchLow', 36);
        const hi = this._get<number>('pitchHigh', 96);
        const totalBeats = this._get<number>('bars', 8) * BEATS_PER_BAR;
        const totalH = (hi - lo + 1) * ROW_HEIGHT;
        const totalW = this._beatToX(totalBeats);

        this._elGridBg.style.width  = totalW + 'px';
        this._elGridBg.style.height = totalH + 'px';

        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width',  String(totalW));
        svg.setAttribute('height', String(totalH));
        svg.style.cssText = 'position:absolute;inset:0;pointer-events:none';

        // Black-key row backgrounds
        for (let p = hi; p >= lo; p--) {
            if (BLACK_KEYS.has(p % 12)) {
                const r = document.createElementNS(ns, 'rect');
                r.setAttribute('x', '0');
                r.setAttribute('y', String(this._pitchToY(p)));
                r.setAttribute('width', String(totalW));
                r.setAttribute('height', String(ROW_HEIGHT));
                r.setAttribute('fill', '#f6f6f6');
                svg.appendChild(r);
            }
        }
        // Horizontal pitch lines
        for (let p = lo; p <= hi; p++) {
            const y = this._pitchToY(p);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', '0');
            line.setAttribute('x2', String(totalW));
            line.setAttribute('y1', String(y));
            line.setAttribute('y2', String(y));
            line.setAttribute('stroke', p % 12 === 0 ? '#bbb' : '#eee');
            line.setAttribute('stroke-width', p % 12 === 0 ? '1' : '0.5');
            svg.appendChild(line);
        }
        // Vertical beat/bar lines
        for (let beat = 0; beat <= totalBeats; beat++) {
            const x = this._beatToX(beat);
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', String(x));
            line.setAttribute('x2', String(x));
            line.setAttribute('y1', '0');
            line.setAttribute('y2', String(totalH));
            line.setAttribute('stroke', beat % BEATS_PER_BAR === 0 ? '#bbb' : '#e8e8e8');
            line.setAttribute('stroke-width', beat % BEATS_PER_BAR === 0 ? '1' : '0.5');
            svg.appendChild(line);
        }
        // Sub-snap lines
        const snap = this._get<number>('snap', 0.25);
        if (snap < 1) {
            for (let beat = 0; beat <= totalBeats; beat += snap) {
                if (Math.abs(beat - Math.round(beat)) < 0.001) continue;
                const x = this._beatToX(beat);
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', String(x));
                line.setAttribute('x2', String(x));
                line.setAttribute('y1', '0');
                line.setAttribute('y2', String(totalH));
                line.setAttribute('stroke', '#f4f4f4');
                line.setAttribute('stroke-width', '0.5');
                svg.appendChild(line);
            }
        }

        this._elGridBg.innerHTML = '';
        this._elGridBg.appendChild(svg as unknown as Node);
    }

    // ── Pointer interactions ────────────────────────────────────────────────

    private _onCanvasDown(e: PointerEvent): void {
        const target = e.target as HTMLElement;
        if (target.closest('.ar-pianoroll__note')) return;

        const rect = this._elCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left + this._elCanvas.scrollLeft;
        const y = e.clientY - rect.top  + this._elCanvas.scrollTop;
        const pitch = this._yToPitch(y);
        const startBeat = this._snapBeat(this._xToBeat(x));

        if (this._tool === 'draw') {
            const lo = this._get<number>('pitchLow', 36);
            const hi = this._get<number>('pitchHigh', 96);
            if (pitch < lo || pitch > hi) return;
            const id = this.addNote(pitch, startBeat, this._get<number>('snap', 0.25), 100);
            const note = this._notes.find(n => n.id === id)!;
            const noteEl = this.el.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(id)}"]`)!;
            this._startResize(note, noteEl, e);
        } else if (this._tool === 'select') {
            if (!e.shiftKey) {
                this._selected.clear();
                this.el.querySelectorAll('.ar-pianoroll__note.selected')
                    .forEach(n => n.classList.remove('selected'));
            }
        }
    }

    private _renderNote(note: InternalNote): void {
        const el = document.createElement('div');
        el.className = 'ar-pianoroll__note';
        el.dataset.noteId = note.id;
        el.style.left   = this._beatToX(note.start) + 'px';
        el.style.top    = this._pitchToY(note.pitch) + 'px';
        el.style.width  = this._beatToX(note.duration) + 'px';
        el.style.height = ROW_HEIGHT + 'px';
        el.style.opacity = (0.4 + 0.6 * (note.velocity / 127)).toFixed(2);

        const lbl = document.createElement('span');
        lbl.className = 'ar-pianoroll__note-lbl';
        lbl.textContent = noteName(note.pitch);
        el.appendChild(lbl);

        const handle = document.createElement('div');
        handle.className = 'ar-pianoroll__note-resize';
        el.appendChild(handle);

        if (this._selected.has(note.id)) el.classList.add('selected');

        el.addEventListener('pointerdown', e => this._onNoteDown(e, note, el, handle));
        this._elCanvas.appendChild(el);
    }

    private _onNoteDown(e: PointerEvent, note: InternalNote, el: HTMLElement, handle: HTMLElement): void {
        e.preventDefault();
        e.stopPropagation();

        if (this._tool === 'erase') {
            this.removeNote(note.id);
            return;
        }
        if (e.target === handle) {
            this._startResize(note, el, e);
            return;
        }

        if (!this._selected.has(note.id)) {
            if (!e.shiftKey) {
                this._selected.clear();
                this.el.querySelectorAll('.ar-pianoroll__note.selected')
                    .forEach(n => n.classList.remove('selected'));
            }
            this._selected.add(note.id);
            el.classList.add('selected');
        }

        const startMouseX = e.clientX, startMouseY = e.clientY;
        const startBeat   = note.start, startPitch = note.pitch;
        el.setPointerCapture(e.pointerId);

        const lo = this._get<number>('pitchLow', 36);
        const hi = this._get<number>('pitchHigh', 96);

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startMouseX;
            const dy = ev.clientY - startMouseY;
            const newBeat  = this._snapBeat(startBeat + this._xToBeat(dx));
            const newPitch = startPitch + Math.round(-dy / ROW_HEIGHT);
            if (newPitch < lo || newPitch > hi) return;
            this.updateNote(note.id, { start: Math.max(0, newBeat), pitch: newPitch });
        };
        const onUp = () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup',   onUp);
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup',   onUp);
    }

    private _startResize(note: InternalNote, el: HTMLElement, e: PointerEvent): void {
        e.preventDefault();
        const startMouseX = e.clientX;
        const startDur = note.duration;
        const minDur = this._get<number>('snap', 0.25);
        el.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startMouseX;
            const newDur = this._snapBeat(Math.max(minDur, startDur + this._xToBeat(dx)));
            this.updateNote(note.id, { duration: newDur });
        };
        const onUp = () => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup',   onUp);
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup',   onUp);
    }

    // ── Velocity lane ───────────────────────────────────────────────────────

    private _renderVelocity(): void {
        this._elVel.innerHTML = '';
        if (!this._showVel) return;
        const totalBeats = this._get<number>('bars', 8) * BEATS_PER_BAR;
        this._elVel.style.width = this._beatToX(totalBeats) + 'px';
        for (const note of this._notes) {
            const bar = document.createElement('div');
            bar.className = 'ar-pianoroll__vel-bar';
            bar.style.left   = this._beatToX(note.start) + 'px';
            bar.style.height = (note.velocity / 127 * 60) + 'px';
            bar.title = `vel ${note.velocity}`;
            this._elVel.appendChild(bar);
        }
    }

    // ── Playback ────────────────────────────────────────────────────────────

    private _tick = (): void => {
        const bpm = this._get<number>('bpm', 120);
        const totalBeats = this._get<number>('bars', 8) * BEATS_PER_BAR;
        const now = performance.now();
        const elapsed = (now - this._playStart) / 1000;
        this._playhead = elapsed * (bpm / 60);

        // Loop wrap during playback (Task B). When loop is enabled and the
        // playhead moves past loop.end, re-anchor _playStart so the playhead
        // resumes from loop.start while time keeps flowing. Active note-on
        // events get a clean note-off so we don't strand stuck notes.
        if (this._loop.enabled && this._loop.end > this._loop.start && this._playhead >= this._loop.end)
        {
            // All currently-firing notes get a note-off — they'll re-trigger
            // naturally on the next pass if their range still applies.
            for (const key of this._activeKeys) {
                const [p] = key.split(':');
                this._fireMidi('note-off', parseInt(p!, 10), 0, 1);
            }
            this._activeKeys.clear();
            // Re-anchor so playhead = loop.start at this exact moment
            const beatToSec = 60 / bpm;
            this._playStart = now - this._loop.start * beatToSec * 1000;
            this._playhead  = this._loop.start;
            this._emit('loop-wrap', { start: this._loop.start, end: this._loop.end });
        }

        if (this._playhead >= totalBeats) { this.stop(); return; }
        this._elPlayhead.style.left = this._beatToX(this._playhead) + 'px';

        for (const note of this._notes) {
            const key = note.pitch + ':' + note.id;
            const inRange = this._playhead >= note.start &&
                            this._playhead <  note.start + note.duration;
            if (inRange && !this._activeKeys.has(key)) {
                this._fireMidi('note-on', note.pitch, note.velocity, note.channel ?? 1);
                this._activeKeys.add(key);
            } else if (!inRange && this._activeKeys.has(key)) {
                this._fireMidi('note-off', note.pitch, 0, note.channel ?? 1);
                this._activeKeys.delete(key);
            }
        }

        this._playRAF = requestAnimationFrame(this._tick);
    };

    // ── MIDI events ─────────────────────────────────────────────────────────

    private _fireMidi(type: 'note-on'|'note-off', pitch: number, velocity: number, channel: number): void {
        const evt: MidiEvent = { type, pitch, velocity, channel, time: performance.now() };
        this._eventLog.unshift(evt);
        if (this._eventLog.length > 30) this._eventLog.length = 30;
        this._renderEvents();
        this._emit('midi', evt);
    }

    private _renderEvents(): void {
        if (!this._elEvents) return;
        if (this._eventLog.length === 0) {
            this._elEvents.innerHTML = '<span style="color:#888">(no events yet)</span>';
            return;
        }
        this._elEvents.innerHTML = this._eventLog.map(e => {
            const t = ((e.time / 1000) % 100).toFixed(2);
            const color = e.type === 'note-on' ? '#ffab40' : '#888';
            return `<div class="ar-pianoroll__events-row"><span class="t">${t}</span><span class="ev" style="color:${color}">${e.type} ${noteName(e.pitch)} v${e.velocity}</span></div>`;
        }).join('');
    }

    // ── Status & file export ────────────────────────────────────────────────

    private _refreshStatus(): void {
        if (!this._elStatus) return;
        const map: Record<RunState, [string, string]> = {
            idle:    ['— idle',    '#888'],
            running: ['— running', '#16a34a'],
            paused:  ['— paused',  '#eab308'],
        };
        const [t, c] = map[this._runState];
        this._elStatus.textContent = t;
        this._elStatus.style.color = c;
    }

    private _exportFile(): void {
        const blob = new Blob([JSON.stringify(this.export(), null, 2)],
                              { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'sequence.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
    }

    // ── Stylesheet (auto-injected once) ─────────────────────────────────────

    private _injectStyles(): void {
        if (document.getElementById('ar-pianoroll-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-pianoroll-styles';
        s.textContent = `
.ar-pianoroll { font:13px -apple-system,system-ui,sans-serif; color:#222; height:100%; display:flex; flex-direction:column; position:relative; background:#fff; }
.ar-pianoroll__toolbar { background:#1e1e1e; color:#d4d4d4; display:flex; align-items:center; padding:0 16px; gap:10px; height:44px; flex-shrink:0; border-bottom:1px solid #333; }
.ar-pianoroll__title { font-size:13px; margin:0; font-weight:500; color:#e40c88; }
.ar-pianoroll__status { font:11px ui-monospace,monospace; color:#888; }
.ar-pianoroll__lbl { font:11px sans-serif; color:#888; }
.ar-pianoroll__btn,.ar-pianoroll__tool-btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:4px 12px; font:12px sans-serif; border-radius:3px; cursor:pointer; }
.ar-pianoroll__tool-btn { padding:4px 8px; min-width:32px; }
.ar-pianoroll__btn:hover,.ar-pianoroll__tool-btn:hover { background:#2a2a2a; }
.ar-pianoroll__tool-btn.active { background:#e40c88; border-color:#e40c88; color:#fff; }
.ar-pianoroll__btn.play { background:#16a34a; border-color:#16a34a; color:#fff; } .ar-pianoroll__btn.play:hover { background:#15803d; }
.ar-pianoroll__btn.stop { background:#dc2626; border-color:#dc2626; color:#fff; } .ar-pianoroll__btn.stop:hover { background:#b91c1c; }
.ar-pianoroll__btn.pause { background:#eab308; border-color:#eab308; color:#1f1f1f; } .ar-pianoroll__btn.pause:hover { background:#ca8a04; }
.ar-pianoroll__input { background:transparent; border:1px solid #444; color:#d4d4d4; padding:3px 8px; font:12px ui-monospace,monospace; border-radius:3px; width:60px; }

.ar-pianoroll__grid { display:grid; grid-template-columns:64px 1fr; grid-template-rows:22px 1fr; flex:1; min-height:0; background:#fff; }
.ar-pianoroll__corner { background:#f0f0f0; border-right:1px solid #ddd; border-bottom:1px solid #ddd; }
.ar-pianoroll__ruler { background:#f0f0f0; border-bottom:1px solid #ddd; position:relative; overflow:hidden; font:10px ui-monospace,monospace; color:#666; }
.ar-pianoroll__tick { position:absolute; top:0; bottom:0; width:1px; background:#ccc; }
.ar-pianoroll__tick.bar { background:#888; }
.ar-pianoroll__tick-lbl { position:absolute; top:4px; font-size:10px; color:#555; padding-left:3px; user-select:none; }
.ar-pianoroll__keys { background:#fff; border-right:1px solid #ddd; position:relative; overflow:hidden; user-select:none; }
.ar-pianoroll__key { position:absolute; left:0; right:0; border-bottom:1px solid #eee; font:9px ui-monospace,monospace; color:#888; padding-left:4px; line-height:1; display:flex; align-items:center; cursor:pointer; }
.ar-pianoroll__key.black { background:#2a2a2a; color:#ccc; right:28%; z-index:2; }
.ar-pianoroll__key.white { background:#fff; }
.ar-pianoroll__key:hover { background:#fde7f3; }
.ar-pianoroll__key.black:hover { background:#4a3040; }

.ar-pianoroll__canvas { position:relative; overflow:auto; background:#fff; cursor:crosshair; }
.ar-pianoroll__grid-bg { position:absolute; inset:0; pointer-events:none; }
.ar-pianoroll__note { position:absolute; background:#e40c88; border:1px solid #b80b6f; border-radius:2px; cursor:move; font:9px ui-monospace,monospace; color:#fff; padding:1px 4px; line-height:1.2; overflow:hidden; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,.15); transition:filter .1s; }
.ar-pianoroll__note.selected { background:#f06ab1; border-color:#fff; box-shadow:0 0 0 2px #e40c88,0 1px 4px rgba(0,0,0,.25); }
.ar-pianoroll__note:hover { filter:brightness(1.08); }
.ar-pianoroll__note-resize { position:absolute; right:0; top:0; bottom:0; width:6px; cursor:ew-resize; background:rgba(255,255,255,.2); }
.ar-pianoroll__playhead { position:absolute; top:0; bottom:0; width:2px; background:#16a34a; pointer-events:none; box-shadow:0 0 4px rgba(22,163,74,.5); }

/* Loop selection — overlay on the ruler (Task B) */
.ar-pianoroll__loop-range  { position:absolute; top:0; bottom:0; background:rgba(228,12,136,0.18); border-top:2px solid #e40c88; border-bottom:2px solid #e40c88; cursor:grab; z-index:5; }
.ar-pianoroll__loop-range:active { cursor:grabbing; }
.ar-pianoroll__loop-handle { position:absolute; top:0; bottom:0; width:6px; margin-left:-3px; background:#e40c88; cursor:ew-resize; z-index:6; }
.ar-pianoroll__loop-handle::after { content:''; position:absolute; top:50%; left:50%; width:2px; height:8px; margin:-4px 0 0 -1px; background:rgba(255,255,255,0.7); border-radius:1px; }

.ar-pianoroll__vel { position:absolute; bottom:0; left:0; right:0; height:60px; background:rgba(245,245,245,.95); border-top:1px solid #ddd; pointer-events:none; }
.ar-pianoroll__vel-bar { position:absolute; bottom:0; width:3px; background:#e40c88; border-radius:1px 1px 0 0; opacity:.7; }
.ar-pianoroll__vel-toggle { position:absolute; right:6px; bottom:60px; background:#1e1e1e; color:#d4d4d4; border:0; font:10px sans-serif; padding:2px 8px; border-radius:3px 3px 0 0; cursor:pointer; pointer-events:auto; z-index:5; }

.ar-pianoroll__events { position:absolute; right:12px; top:80px; width:240px; max-height:200px; background:#1e1e1e; color:#d4d4d4; border-radius:6px; padding:8px 10px; font:10px ui-monospace,monospace; overflow-y:auto; z-index:10; box-shadow:0 4px 12px rgba(0,0,0,.15); }
.ar-pianoroll__events-ttl { color:#c3e88d; font-weight:600; margin-bottom:4px; text-transform:uppercase; font-size:9px; letter-spacing:.5px; }
.ar-pianoroll__events-row { display:flex; justify-content:space-between; padding:1px 0; border-bottom:1px solid #333; }
.ar-pianoroll__events-row .t { color:#6cb6ff; }
.ar-pianoroll__events-row .ev { color:#ffab40; }
`;
        document.head.appendChild(s);
    }
}
