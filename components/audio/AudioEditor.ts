/**
 * @module    AudioEditor
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Single-clip audio editor (Audacity-style). Loads an AudioBuffer,
 * displays the full waveform, supports selection, deep zoom, cut/copy/
 * paste/delete, fade-in/fade-out on selection, normalize, gain,
 * silence/insert, undo/redo.
 *
 * The internal model is a single Float32Array per channel which is
 * mutated by destructive edits and re-rendered on canvas.
 *
 * @example
 *   import { AudioEditor } from 'ariannajs/components/audio';
 *
 *   const ed = new AudioEditor('#root');
 *   const buf = await ed.loadFile(file);   // File or URL
 *   ed.setBuffer(buf);
 *
 *   ed.on('change', e => console.log(e.kind));
 *   ed.fadeIn();           // on current selection
 *   ed.normalize();        // peak to 0dBFS
 *
 *   const out = ed.getBuffer();   // post-edit AudioBuffer
 */

import { AudioComponent, type AudioComponentOptions } from './AudioComponent.ts';

export interface AudioEditorOptions extends AudioComponentOptions {
    /** Initial buffer or URL/File to load. */
    src?       : AudioBuffer | string | File;
    /** Pixels per sample at zoom 1. Default 0.05 (whole 1-min file ~3000px). */
    pxPerSample? : number;
    /** Initial zoom factor. Default 1. */
    zoom?      : number;
    /** Maximum undo stack size. Default 50. */
    maxUndo?   : number;
}

interface Selection {
    start: number;     // sample index
    end:   number;     // sample index (exclusive)
}

interface UndoFrame {
    channels: Float32Array[];
    sampleRate: number;
    numChannels: number;
    selection: Selection;
}

export class AudioEditor extends AudioComponent<AudioEditorOptions> {
    // Audio data — flattened mutable buffer
    private _channels    : Float32Array[] = [];
    private _sampleRate  = 44100;
    private _numChannels = 1;

    // View state
    private _zoom        : number;
    private _basePxPerSample: number;
    private _scrollSamples = 0;          // first visible sample index
    private _selection   : Selection = { start: 0, end: 0 };

    // Undo
    private _undoStack: UndoFrame[] = [];
    private _redoStack: UndoFrame[] = [];

    // Playback
    private _activeSource? : AudioBufferSourceNode;
    private _outputGain!   : GainNode;
    private _playStart    = 0;       // ctx time at play start
    private _playFromSample = 0;
    private _playRAF       = 0;
    private _playing       = false;

    // Clipboard (in-memory)
    private _clipboard: { channels: Float32Array[]; sampleRate: number } | null = null;

    // DOM
    private _elCanvas!   : HTMLCanvasElement;
    private _elScroll!   : HTMLElement;
    private _elInfo!     : HTMLElement;
    private _elPlayhead! : HTMLElement;
    private _elZoom!     : HTMLInputElement;

    constructor(container: string | HTMLElement | null, opts: AudioEditorOptions = {}) {
        super(container, 'div', {
            pxPerSample : 0.05,
            zoom        : 1,
            maxUndo     : 50,
            ...opts,
        });

        this.el.className = `ar-audioeditor${opts.class ? ' ' + opts.class : ''}`;
        this._zoom = this._get<number>('zoom', 1);
        this._basePxPerSample = this._get<number>('pxPerSample', 0.05);

        this._injectStyles();
        this._buildAudioGraph();
        this._buildShell();

        if (opts.src) {
            if (opts.src instanceof AudioBuffer) {
                this.setBuffer(opts.src);
            } else {
                queueMicrotask(async () => {
                    const buf = await this.loadFile(opts.src as string | File);
                    this.setBuffer(buf);
                });
            }
        }

        // Keyboard shortcuts
        this._on(document as unknown as HTMLElement, 'keydown', (e: KeyboardEvent) => {
            if (!this.el.contains(document.activeElement) && document.activeElement !== document.body) return;
            const tg = e.target as HTMLElement;
            if (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA') return;
            const meta = e.metaKey || e.ctrlKey;
            if (meta && e.key === 'z' && !e.shiftKey) { this.undo(); e.preventDefault(); }
            else if (meta && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { this.redo(); e.preventDefault(); }
            else if (meta && (e.key === 'c' || e.key === 'C')) { this.copy(); e.preventDefault(); }
            else if (meta && (e.key === 'x' || e.key === 'X')) { this.cut(); e.preventDefault(); }
            else if (meta && (e.key === 'v' || e.key === 'V')) { this.paste(); e.preventDefault(); }
            else if (meta && (e.key === 'a' || e.key === 'A')) {
                this._selection = { start: 0, end: this._totalSamples() };
                this._redraw(); e.preventDefault();
            }
            else if (e.key === 'Delete' || e.key === 'Backspace') { this.delete(); e.preventDefault(); }
            else if (e.key === ' ') { e.preventDefault(); this._playing ? this.stop() : this.play(); }
        });
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /** Load a file or URL into an AudioBuffer (does not set it). */
    async loadFile(src: string | File | ArrayBuffer): Promise<AudioBuffer> {
        let arr: ArrayBuffer;
        if (typeof src === 'string')   arr = await (await fetch(src)).arrayBuffer();
        else if (src instanceof File)  arr = await src.arrayBuffer();
        else                           arr = src;
        return await this._audioCtx.decodeAudioData(arr);
    }

    /** Set the buffer to edit. Replaces current data; clears undo. */
    setBuffer(buf: AudioBuffer): this {
        this._sampleRate  = buf.sampleRate;
        this._numChannels = buf.numberOfChannels;
        this._channels = [];
        for (let c = 0; c < buf.numberOfChannels; c++) {
            this._channels.push(new Float32Array(buf.getChannelData(c)));
        }
        this._selection = { start: 0, end: 0 };
        this._undoStack = [];
        this._redoStack = [];
        this._scrollSamples = 0;
        this._redraw();
        this._refreshInfo();
        this._emit('change', { kind: 'load' });
        return this;
    }

    /** Build a fresh AudioBuffer from current state. */
    getBuffer(): AudioBuffer | null {
        if (this._channels.length === 0) return null;
        const buf = this._audioCtx.createBuffer(
            this._numChannels, this._channels[0].length, this._sampleRate);
        for (let c = 0; c < this._numChannels; c++) {
            buf.getChannelData(c).set(this._channels[c]);
        }
        return buf;
    }

    /** Set selection in seconds. */
    setSelectionTime(start: number, end: number): this {
        this._selection = {
            start: Math.max(0, Math.floor(start * this._sampleRate)),
            end:   Math.min(this._totalSamples(), Math.floor(end * this._sampleRate)),
        };
        this._redraw();
        this._emit('selection', this.getSelectionTime());
        return this;
    }

    /** Get selection in seconds. */
    getSelectionTime(): { start: number; end: number } {
        return {
            start: this._selection.start / this._sampleRate,
            end:   this._selection.end   / this._sampleRate,
        };
    }

    setZoom(z: number): this {
        this._zoom = Math.max(0.05, Math.min(50, z));
        if (this._elZoom) this._elZoom.value = String(this._zoom);
        this._redraw();
        return this;
    }

    // ── Edit operations (all destructive, all push undo) ───────────────────

    cut(): this {
        if (this._channels.length === 0) return this;
        if (this._selection.start === this._selection.end) return this;
        this.copy();
        this.delete();
        return this;
    }

    copy(): this {
        const sel = this._selection;
        if (sel.start === sel.end) return this;
        this._clipboard = {
            channels: this._channels.map(ch => new Float32Array(ch.subarray(sel.start, sel.end))),
            sampleRate: this._sampleRate,
        };
        this._emit('change', { kind: 'copy' });
        return this;
    }

    paste(): this {
        if (!this._clipboard) return this;
        if (this._channels.length === 0) {
            // Empty editor — paste creates the buffer
            this._sampleRate  = this._clipboard.sampleRate;
            this._numChannels = this._clipboard.channels.length;
            this._channels = this._clipboard.channels.map(c => new Float32Array(c));
            this._selection = { start: 0, end: this._channels[0].length };
            this._refreshInfo();
            this._redraw();
            this._emit('change', { kind: 'paste' });
            return this;
        }
        this._pushUndo();
        const insertAt = this._selection.start;
        const sel = this._selection;
        // If selection spans, replace it; otherwise insert at start
        const replaceLen = sel.end - sel.start;
        const pasteLen   = this._clipboard.channels[0].length;

        for (let c = 0; c < this._numChannels; c++) {
            const ch = this._channels[c];
            const clip = this._clipboard.channels[Math.min(c, this._clipboard.channels.length - 1)];
            const out = new Float32Array(ch.length - replaceLen + pasteLen);
            out.set(ch.subarray(0, insertAt));
            out.set(clip, insertAt);
            out.set(ch.subarray(insertAt + replaceLen), insertAt + pasteLen);
            this._channels[c] = out;
        }
        this._selection = { start: insertAt, end: insertAt + pasteLen };
        this._refreshInfo();
        this._redraw();
        this._emit('change', { kind: 'paste' });
        return this;
    }

    delete(): this {
        const sel = this._selection;
        if (sel.start === sel.end || this._channels.length === 0) return this;
        this._pushUndo();
        const len = sel.end - sel.start;
        for (let c = 0; c < this._numChannels; c++) {
            const ch = this._channels[c];
            const out = new Float32Array(ch.length - len);
            out.set(ch.subarray(0, sel.start));
            out.set(ch.subarray(sel.end), sel.start);
            this._channels[c] = out;
        }
        this._selection = { start: sel.start, end: sel.start };
        this._refreshInfo();
        this._redraw();
        this._emit('change', { kind: 'delete' });
        return this;
    }

    /** Insert N seconds of silence at selection start. */
    insertSilence(seconds: number): this {
        if (this._channels.length === 0) return this;
        this._pushUndo();
        const insertAt = this._selection.start;
        const len = Math.floor(seconds * this._sampleRate);
        for (let c = 0; c < this._numChannels; c++) {
            const ch = this._channels[c];
            const out = new Float32Array(ch.length + len);
            out.set(ch.subarray(0, insertAt));
            // silence (zeros) is already there
            out.set(ch.subarray(insertAt), insertAt + len);
            this._channels[c] = out;
        }
        this._selection = { start: insertAt, end: insertAt + len };
        this._refreshInfo();
        this._redraw();
        this._emit('change', { kind: 'silence' });
        return this;
    }

    /** Apply linear fade-in to current selection. */
    fadeIn(): this {
        const sel = this._selection;
        if (sel.start === sel.end) return this;
        this._pushUndo();
        const len = sel.end - sel.start;
        for (const ch of this._channels) {
            for (let i = 0; i < len; i++) {
                ch[sel.start + i] *= i / len;
            }
        }
        this._redraw();
        this._emit('change', { kind: 'fade-in' });
        return this;
    }

    /** Apply linear fade-out to current selection. */
    fadeOut(): this {
        const sel = this._selection;
        if (sel.start === sel.end) return this;
        this._pushUndo();
        const len = sel.end - sel.start;
        for (const ch of this._channels) {
            for (let i = 0; i < len; i++) {
                ch[sel.start + i] *= 1 - (i / len);
            }
        }
        this._redraw();
        this._emit('change', { kind: 'fade-out' });
        return this;
    }

    /** Normalize selection (or whole file if no selection) to peak target. */
    normalize(targetDb = 0): this {
        if (this._channels.length === 0) return this;
        this._pushUndo();
        const sel = this._selection.start === this._selection.end
            ? { start: 0, end: this._totalSamples() }
            : this._selection;

        let peak = 0;
        for (const ch of this._channels) {
            for (let i = sel.start; i < sel.end; i++) {
                const v = Math.abs(ch[i]);
                if (v > peak) peak = v;
            }
        }
        if (peak === 0) return this;
        const target = Math.pow(10, targetDb / 20);
        const factor = target / peak;
        for (const ch of this._channels) {
            for (let i = sel.start; i < sel.end; i++) {
                ch[i] *= factor;
            }
        }
        this._redraw();
        this._emit('change', { kind: 'normalize', factor });
        return this;
    }

    /** Apply gain (dB) to selection or whole. */
    gain(db: number): this {
        if (this._channels.length === 0) return this;
        this._pushUndo();
        const sel = this._selection.start === this._selection.end
            ? { start: 0, end: this._totalSamples() }
            : this._selection;
        const factor = Math.pow(10, db / 20);
        for (const ch of this._channels) {
            for (let i = sel.start; i < sel.end; i++) {
                ch[i] *= factor;
            }
        }
        this._redraw();
        this._emit('change', { kind: 'gain', db });
        return this;
    }

    /** Reverse selection in-place. */
    reverse(): this {
        if (this._channels.length === 0) return this;
        this._pushUndo();
        const sel = this._selection.start === this._selection.end
            ? { start: 0, end: this._totalSamples() }
            : this._selection;
        for (const ch of this._channels) {
            const seg = ch.subarray(sel.start, sel.end);
            seg.reverse();
        }
        this._redraw();
        this._emit('change', { kind: 'reverse' });
        return this;
    }

    // ── Undo / Redo ─────────────────────────────────────────────────────────

    private _pushUndo(): void {
        const max = this._get<number>('maxUndo', 50);
        this._undoStack.push({
            channels: this._channels.map(c => new Float32Array(c)),
            sampleRate: this._sampleRate,
            numChannels: this._numChannels,
            selection: { ...this._selection },
        });
        if (this._undoStack.length > max) this._undoStack.shift();
        this._redoStack = [];
    }

    undo(): this {
        const f = this._undoStack.pop();
        if (!f) return this;
        this._redoStack.push({
            channels: this._channels.map(c => new Float32Array(c)),
            sampleRate: this._sampleRate,
            numChannels: this._numChannels,
            selection: { ...this._selection },
        });
        this._channels = f.channels.map(c => new Float32Array(c));
        this._sampleRate = f.sampleRate;
        this._numChannels = f.numChannels;
        this._selection = { ...f.selection };
        this._refreshInfo();
        this._redraw();
        this._emit('change', { kind: 'undo' });
        return this;
    }

    redo(): this {
        const f = this._redoStack.pop();
        if (!f) return this;
        this._undoStack.push({
            channels: this._channels.map(c => new Float32Array(c)),
            sampleRate: this._sampleRate,
            numChannels: this._numChannels,
            selection: { ...this._selection },
        });
        this._channels = f.channels.map(c => new Float32Array(c));
        this._sampleRate = f.sampleRate;
        this._numChannels = f.numChannels;
        this._selection = { ...f.selection };
        this._refreshInfo();
        this._redraw();
        this._emit('change', { kind: 'redo' });
        return this;
    }

    // ── Playback ────────────────────────────────────────────────────────────

    play(): this {
        if (this._playing || this._channels.length === 0) return this;
        AudioComponent.resume();
        this._playing = true;

        const buf = this.getBuffer();
        if (!buf) return this;

        // Play from selection start (or 0 if no selection)
        const fromSample = this._selection.start;
        this._playFromSample = fromSample;
        this._playStart = this._audioCtx.currentTime;

        const src = this._audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(this._outputGain);
        src.start(0, fromSample / this._sampleRate);
        src.onended = () => {
            if (this._activeSource === src) {
                this._playing = false;
                if (this._playRAF) cancelAnimationFrame(this._playRAF);
                this._elPlayhead.style.display = 'none';
            }
        };
        this._activeSource = src;
        this._elPlayhead.style.display = 'block';
        this._tickPlayhead();
        this._emit('play', {});
        return this;
    }

    stop(): this {
        if (this._activeSource) {
            try { this._activeSource.stop(); } catch {}
            this._activeSource = undefined;
        }
        this._playing = false;
        if (this._playRAF) cancelAnimationFrame(this._playRAF);
        this._elPlayhead.style.display = 'none';
        this._emit('stop', {});
        return this;
    }

    private _tickPlayhead = (): void => {
        if (!this._playing) return;
        const elapsed = this._audioCtx.currentTime - this._playStart;
        const sample = this._playFromSample + elapsed * this._sampleRate;
        if (sample >= this._totalSamples()) { this.stop(); return; }
        const px = this._sampleToPixel(sample);
        this._elPlayhead.style.left = px + 'px';
        this._playRAF = requestAnimationFrame(this._tickPlayhead);
    };

    // ── Internal ────────────────────────────────────────────────────────────

    protected _buildAudioGraph(): void {
        this._outputGain = this._audioCtx.createGain();
        this._outputGain.connect(this._audioCtx.destination);
        this._output = this._outputGain;
    }

    protected _build(): void { /* shell built explicitly */ }

    private _buildShell(): void {
        this.el.innerHTML = `
<div class="ar-audioeditor__toolbar">
  <label class="ar-audioeditor__btn" style="cursor:pointer">+ Load
    <input type="file" accept="audio/*" data-r="upload" style="display:none">
  </label>
  <button class="ar-audioeditor__btn" data-r="play">▶</button>
  <button class="ar-audioeditor__btn" data-r="stop">■</button>
  <span class="ar-audioeditor__sep">|</span>
  <button class="ar-audioeditor__btn" data-r="cut"   title="Cut (⌘X)">Cut</button>
  <button class="ar-audioeditor__btn" data-r="copy"  title="Copy (⌘C)">Copy</button>
  <button class="ar-audioeditor__btn" data-r="paste" title="Paste (⌘V)">Paste</button>
  <button class="ar-audioeditor__btn" data-r="del"   title="Delete (⌫)">Del</button>
  <span class="ar-audioeditor__sep">|</span>
  <button class="ar-audioeditor__btn" data-r="fadein">Fade In</button>
  <button class="ar-audioeditor__btn" data-r="fadeout">Fade Out</button>
  <button class="ar-audioeditor__btn" data-r="norm">Normalize</button>
  <button class="ar-audioeditor__btn" data-r="rev">Reverse</button>
  <span class="ar-audioeditor__sep">|</span>
  <button class="ar-audioeditor__btn" data-r="undo" title="Undo (⌘Z)">↶</button>
  <button class="ar-audioeditor__btn" data-r="redo" title="Redo (⌘⇧Z)">↷</button>
  <span class="ar-audioeditor__sep">|</span>
  <span class="ar-audioeditor__lbl">Zoom</span>
  <input type="range" class="ar-audioeditor__zoom" data-r="zoom" min="0.05" max="50" step="0.05" value="1">
  <span class="ar-audioeditor__info" data-r="info">no audio</span>
</div>
<div class="ar-audioeditor__canvas-wrap" data-r="scroll">
  <canvas class="ar-audioeditor__canvas" data-r="canvas"></canvas>
  <div class="ar-audioeditor__playhead" data-r="playhead" style="display:none"></div>
</div>`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elCanvas   = r('canvas') as HTMLCanvasElement;
        this._elScroll   = r('scroll');
        this._elInfo     = r('info');
        this._elPlayhead = r('playhead');
        this._elZoom     = r('zoom') as HTMLInputElement;

        const upload = r('upload') as HTMLInputElement;
        upload.addEventListener('change', async () => {
            const f = upload.files?.[0];
            if (!f) return;
            this._elInfo.textContent = '⏳ decoding...';
            const buf = await this.loadFile(f);
            this.setBuffer(buf);
        });

        r('play').addEventListener('click', () => this.play());
        r('stop').addEventListener('click', () => this.stop());
        r('cut').addEventListener('click',   () => this.cut());
        r('copy').addEventListener('click',  () => this.copy());
        r('paste').addEventListener('click', () => this.paste());
        r('del').addEventListener('click',   () => this.delete());
        r('fadein').addEventListener('click',  () => this.fadeIn());
        r('fadeout').addEventListener('click', () => this.fadeOut());
        r('norm').addEventListener('click',    () => this.normalize());
        r('rev').addEventListener('click',     () => this.reverse());
        r('undo').addEventListener('click',    () => this.undo());
        r('redo').addEventListener('click',    () => this.redo());

        this._elZoom.addEventListener('input', () => this.setZoom(parseFloat(this._elZoom.value)));

        // Selection drag on canvas
        this._elCanvas.addEventListener('pointerdown', e => this._onCanvasDown(e));

        // Resize observer for canvas dimensions
        new ResizeObserver(() => this._redraw()).observe(this._elScroll);
    }

    private _onCanvasDown(e: PointerEvent): void {
        if (this._channels.length === 0) return;
        e.preventDefault();
        const rect = this._elCanvas.getBoundingClientRect();
        const x0 = e.clientX - rect.left;
        const startSample = this._pixelToSample(x0);

        this._selection = { start: startSample, end: startSample };
        this._redraw();
        this._elCanvas.setPointerCapture(e.pointerId);

        const onMove = (ev: PointerEvent) => {
            const x = ev.clientX - rect.left;
            const s = this._pixelToSample(x);
            this._selection = {
                start: Math.min(startSample, s),
                end:   Math.max(startSample, s),
            };
            this._redraw();
        };
        const onUp = () => {
            this._elCanvas.removeEventListener('pointermove', onMove);
            this._elCanvas.removeEventListener('pointerup',   onUp);
            this._emit('selection', this.getSelectionTime());
        };
        this._elCanvas.addEventListener('pointermove', onMove);
        this._elCanvas.addEventListener('pointerup',   onUp);
    }

    private _totalSamples(): number {
        return this._channels.length > 0 ? this._channels[0].length : 0;
    }

    private _sampleToPixel(s: number): number {
        return s * this._basePxPerSample * this._zoom;
    }

    private _pixelToSample(x: number): number {
        return Math.max(0, Math.min(this._totalSamples(),
            Math.floor(x / (this._basePxPerSample * this._zoom))));
    }

    private _redraw(): void {
        if (this._channels.length === 0) {
            const ctx = this._elCanvas.getContext('2d');
            if (ctx) {
                this._elCanvas.width  = this._elScroll.clientWidth;
                this._elCanvas.height = this._elScroll.clientHeight;
                ctx.fillStyle = '#1e1e1e';
                ctx.fillRect(0, 0, this._elCanvas.width, this._elCanvas.height);
                ctx.fillStyle = '#666';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Drop or load an audio file', this._elCanvas.width / 2, this._elCanvas.height / 2);
            }
            return;
        }
        const totalPx = Math.max(this._elScroll.clientWidth, this._sampleToPixel(this._totalSamples()));
        this._elCanvas.width  = Math.ceil(totalPx);
        this._elCanvas.height = this._elScroll.clientHeight;

        const ctx = this._elCanvas.getContext('2d');
        if (!ctx) return;

        const w = this._elCanvas.width, h = this._elCanvas.height;
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, w, h);

        // Selection background
        if (this._selection.start !== this._selection.end) {
            const x1 = this._sampleToPixel(this._selection.start);
            const x2 = this._sampleToPixel(this._selection.end);
            ctx.fillStyle = 'rgba(228, 12, 136, 0.2)';
            ctx.fillRect(x1, 0, x2 - x1, h);
        }

        // Center line
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        const channelH = h / this._numChannels;
        for (let c = 0; c < this._numChannels; c++) {
            const mid = c * channelH + channelH / 2;
            ctx.beginPath();
            ctx.moveTo(0, mid);
            ctx.lineTo(w, mid);
            ctx.stroke();
        }

        // Waveform per channel
        const totalSamples = this._totalSamples();
        const samplesPerPx = totalSamples / w;
        ctx.fillStyle = '#e40c88';

        for (let c = 0; c < this._numChannels; c++) {
            const data = this._channels[c];
            const mid = c * channelH + channelH / 2;

            if (samplesPerPx >= 1) {
                // Many samples per pixel: min/max
                for (let x = 0; x < w; x++) {
                    const i = Math.floor(x * samplesPerPx);
                    const j = Math.min(totalSamples, Math.floor((x + 1) * samplesPerPx));
                    let min = 1, max = -1;
                    for (let k = i; k < j; k++) {
                        const v = data[k];
                        if (v < min) min = v;
                        if (v > max) max = v;
                    }
                    const y1 = mid - max * (channelH / 2);
                    const y2 = mid - min * (channelH / 2);
                    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
                }
            } else {
                // Few samples per pixel: draw line
                ctx.strokeStyle = '#e40c88';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let x = 0; x < w; x++) {
                    const i = Math.floor(x * samplesPerPx);
                    const v = data[i] || 0;
                    const y = mid - v * (channelH / 2);
                    if (x === 0) ctx.moveTo(x, y);
                    else         ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }

        // Selection borders
        if (this._selection.start !== this._selection.end) {
            const x1 = this._sampleToPixel(this._selection.start);
            const x2 = this._sampleToPixel(this._selection.end);
            ctx.strokeStyle = '#e40c88';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
            ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
            ctx.stroke();
        }
    }

    private _refreshInfo(): void {
        if (this._channels.length === 0) {
            this._elInfo.textContent = 'no audio';
            return;
        }
        const dur = this._totalSamples() / this._sampleRate;
        const sel = this._selection;
        const selDur = (sel.end - sel.start) / this._sampleRate;
        let txt = `${this._numChannels}ch · ${this._sampleRate}Hz · ${formatTime(dur)}`;
        if (selDur > 0) txt += ` · sel ${formatTime(selDur)}`;
        this._elInfo.textContent = txt;
    }

    private _injectStyles(): void {
        if (document.getElementById('ar-audioeditor-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-audioeditor-styles';
        s.textContent = `
.ar-audioeditor { font:12px -apple-system,system-ui,sans-serif; background:#1e1e1e; color:#d4d4d4; border-radius:4px; display:flex; flex-direction:column; height:100%; min-height:300px; user-select:none; }
.ar-audioeditor__toolbar { background:#252525; padding:6px 10px; display:flex; gap:6px; align-items:center; border-bottom:1px solid #333; flex-shrink:0; flex-wrap:wrap; }
.ar-audioeditor__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:4px 10px; font:12px sans-serif; border-radius:3px; cursor:pointer; }
.ar-audioeditor__btn:hover { background:#2a2a2a; }
.ar-audioeditor__sep { color:#444; padding:0 4px; }
.ar-audioeditor__lbl { font:11px sans-serif; color:#888; }
.ar-audioeditor__zoom { width:120px; -webkit-appearance:none; height:3px; background:#444; border-radius:2px; outline:none; cursor:pointer; }
.ar-audioeditor__zoom::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; border-radius:50%; background:#e40c88; cursor:pointer; }
.ar-audioeditor__zoom::-moz-range-thumb     { width:10px; height:10px; border-radius:50%; background:#e40c88; cursor:pointer; border:0; }
.ar-audioeditor__info { font:10px ui-monospace,monospace; color:#888; margin-left:auto; }
.ar-audioeditor__canvas-wrap { flex:1; overflow-x:auto; overflow-y:hidden; position:relative; min-height:0; }
.ar-audioeditor__canvas { display:block; cursor:crosshair; }
.ar-audioeditor__playhead { position:absolute; top:0; bottom:0; width:2px; background:#16a34a; pointer-events:none; box-shadow:0 0 4px rgba(22,163,74,.5); }
`;
        document.head.appendChild(s);
    }
}

function formatTime(s: number): string {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const r = (s % 60).toFixed(2);
    return `${m}:${r.padStart(5, '0')}`;
}
