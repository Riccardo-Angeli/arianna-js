/**
 * @module    Audio
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. Audio — Web Audio API engine: synthesis, effects, sequencer.
 * Zero dependencies.
 *
 * MIDI moved to additionals/Midi.ts (separate addon, supports MPE / MIDI 2.0
 * binary format and Web MIDI hardware I/O).
 *
 * ── CORE ──────────────────────────────────────────────────────────────────────
 *   AudioEngine   — AudioContext wrapper, master chain, context lifecycle
 *
 * ── PLAYBACK ──────────────────────────────────────────────────────────────────
 *   AudioPlayer   — load + play audio files / ArrayBuffer
 *   AudioRecorder — microphone capture via MediaRecorder
 *
 * ── SYNTHESIS ────────────────────────────────────────────────────────────────
 *   Oscillator    — waveform generator (sine/square/sawtooth/triangle/custom)
 *   Sampler       — sample player with pitch shifting
 *   NoiseGenerator— white/pink/brown noise
 *
 * ── EFFECTS ──────────────────────────────────────────────────────────────────
 *   Reverb / Delay / Compressor / Filter / EQ / Distortion / Panner / Chorus
 *
 * ── ANALYSIS ─────────────────────────────────────────────────────────────────
 *   Analyser     — FFT spectrum, waveform, peak/RMS
 *
 * ── SEQUENCER ────────────────────────────────────────────────────────────────
 *   Sequencer    — step sequencer, BPM clock, pattern scheduling
 */

// ── AudioEngine ───────────────────────────────────────────────────────────────

export class AudioEngine {
    #ctx   : AudioContext | null = null;
    #master: GainNode    | null = null;
    #compressor: DynamicsCompressorNode | null = null;

    get context(): AudioContext {
        if (!this.#ctx) {
            this.#ctx      = new AudioContext();
            this.#master   = this.#ctx.createGain();
            this.#compressor = this.#ctx.createDynamicsCompressor();
            this.#master.connect(this.#compressor);
            this.#compressor.connect(this.#ctx.destination);
        }
        return this.#ctx;
    }

    get master(): GainNode {
        this.context; // ensure created
        return this.#master!;
    }

    get destination(): AudioNode { return this.master; }

    async resume(): Promise<void> { if (this.#ctx?.state === 'suspended') await this.#ctx.resume(); }
    async suspend(): Promise<void> { await this.#ctx?.suspend(); }
    close(): void { this.#ctx?.close(); this.#ctx = null; }

    get time(): number { return this.#ctx?.currentTime ?? 0; }
    set volume(v: number) { if (this.#master) this.#master.gain.value = Math.max(0, Math.min(1, v)); }
    get volume(): number { return this.#master?.gain.value ?? 1; }
}

export const _engine = new AudioEngine();

// ── AudioPlayer ───────────────────────────────────────────────────────────────

export class AudioPlayer {
    #buf  : AudioBuffer | null = null;
    #src  : AudioBufferSourceNode | null = null;
    #gain : GainNode;
    #engine: AudioEngine;

    constructor(engine = _engine) {
        this.#engine = engine;
        this.#gain   = engine.context.createGain();
        this.#gain.connect(engine.destination);
    }

    async load(src: string | ArrayBuffer | Blob): Promise<this> {
        const ctx = this.#engine.context;
        let ab: ArrayBuffer;
        if (src instanceof ArrayBuffer) {
            ab = src;
        } else if (src instanceof Blob) {
            ab = await src.arrayBuffer();
        } else {
            ab = await (await fetch(src)).arrayBuffer();
        }
        this.#buf = await ctx.decodeAudioData(ab);
        return this;
    }

    play(offset = 0, duration?: number): this {
        this.#engine.resume();
        this.stop();
        const ctx  = this.#engine.context;
        this.#src  = ctx.createBufferSource();
        this.#src.buffer = this.#buf;
        this.#src.connect(this.#gain);
        this.#src.start(0, offset, duration);
        return this;
    }

    stop(): this { try { this.#src?.stop(); } catch {} this.#src = null; return this; }
    set volume(v: number) { this.#gain.gain.value = Math.max(0, v); }
    get volume(): number  { return this.#gain.gain.value; }
    set loop(v: boolean)  { if (this.#src) this.#src.loop = v; }
    set playbackRate(r: number) { if (this.#src) this.#src.playbackRate.value = r; }
    connect(node: AudioNode): this { this.#gain.disconnect(); this.#gain.connect(node); return this; }
    get buffer(): AudioBuffer | null { return this.#buf; }
    get duration(): number { return this.#buf?.duration ?? 0; }
}

// ── AudioRecorder ─────────────────────────────────────────────────────────────

export class AudioRecorder {
    #stream  : MediaStream | null = null;
    #recorder: MediaRecorder | null = null;
    #chunks  : Blob[] = [];

    async start(constraints: MediaStreamConstraints = { audio: true }): Promise<this> {
        this.#stream   = await navigator.mediaDevices.getUserMedia(constraints);
        this.#chunks   = [];
        this.#recorder = new MediaRecorder(this.#stream);
        this.#recorder.ondataavailable = e => { if (e.data.size > 0) this.#chunks.push(e.data); };
        this.#recorder.start();
        return this;
    }

    async stop(): Promise<Blob> {
        return new Promise(res => {
            if (!this.#recorder) { res(new Blob()); return; }
            this.#recorder.onstop = () => res(new Blob(this.#chunks, { type: 'audio/webm' }));
            this.#recorder.stop();
            this.#stream?.getTracks().forEach(t => t.stop());
        });
    }
}

// ── Oscillator ────────────────────────────────────────────────────────────────

export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom';

export class Oscillator {
    #osc  : OscillatorNode | null = null;
    #gain : GainNode;
    #engine: AudioEngine;
    #type : OscillatorType;
    #freq : number;

    constructor(freq = 440, type: WaveType = 'sine', engine = _engine) {
        this.#engine = engine;
        this.#type   = type as OscillatorType;
        this.#freq   = freq;
        this.#gain   = engine.context.createGain();
        this.#gain.connect(engine.destination);
    }

    start(volume = 0.5): this {
        this.#engine.resume();
        this.stop();
        const ctx = this.#engine.context;
        this.#osc = ctx.createOscillator();
        this.#osc.type = this.#type;
        this.#osc.frequency.value = this.#freq;
        this.#gain.gain.value = volume;
        this.#osc.connect(this.#gain);
        this.#osc.start();
        return this;
    }

    stop(): this { try { this.#osc?.stop(); } catch {} this.#osc = null; return this; }

    set frequency(f: number) { this.#freq = f; if (this.#osc) this.#osc.frequency.setValueAtTime(f, this.#engine.context.currentTime); }
    set volume(v: number) { this.#gain.gain.value = Math.max(0, v); }
    set detune(cents: number) { if (this.#osc) this.#osc.detune.value = cents; }
    connect(node: AudioNode): this { this.#gain.disconnect(); this.#gain.connect(node); return this; }
}

// ── NoiseGenerator ────────────────────────────────────────────────────────────

export class NoiseGenerator {
    #script: ScriptProcessorNode | null = null;
    #gain  : GainNode;
    #engine: AudioEngine;
    #noiseType: 'white' | 'pink' | 'brown';
    #b0 = 0; #b1 = 0; #b2 = 0; #b3 = 0; #b4 = 0; #b5 = 0; #b6 = 0;
    #lastOut = 0;

    constructor(type: 'white' | 'pink' | 'brown' = 'white', engine = _engine) {
        this.#engine    = engine;
        this.#noiseType = type;
        this.#gain      = engine.context.createGain();
        this.#gain.connect(engine.destination);
    }

    start(volume = 0.1): this {
        this.stop();
        const ctx = this.#engine.context;
        this.#script = ctx.createScriptProcessor(4096, 1, 1);
        this.#script.onaudioprocess = (e) => {
            const out = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < out.length; i++) {
                const white = Math.random() * 2 - 1;
                if (this.#noiseType === 'white') {
                    out[i] = white;
                } else if (this.#noiseType === 'pink') {
                    this.#b0 = 0.99886*this.#b0 + white*0.0555179; this.#b1 = 0.99332*this.#b1 + white*0.0750759;
                    this.#b2 = 0.96900*this.#b2 + white*0.1538520; this.#b3 = 0.86650*this.#b3 + white*0.3104856;
                    this.#b4 = 0.55000*this.#b4 + white*0.5329522; this.#b5 = -0.7616*this.#b5 - white*0.0168980;
                    out[i] = (this.#b0+this.#b1+this.#b2+this.#b3+this.#b4+this.#b5+this.#b6+white*0.5362) * 0.11;
                    this.#b6 = white * 0.115926;
                } else {
                    out[i] = this.#lastOut = (this.#lastOut + 0.02*white) / 1.02;
                }
            }
        };
        this.#gain.gain.value = volume;
        this.#script.connect(this.#gain);
        return this;
    }

    stop(): this { this.#script?.disconnect(); this.#script = null; return this; }
    set volume(v: number) { this.#gain.gain.value = Math.max(0, v); }
}

// ── Effects ───────────────────────────────────────────────────────────────────

export class Reverb {
    #convolver: ConvolverNode;
    #wet : GainNode; #dry: GainNode; #output: GainNode;

    constructor(engine = _engine, opts: { decay?: number; wet?: number } = {}) {
        const ctx = engine.context;
        const decay = opts.decay ?? 2;
        const sr    = ctx.sampleRate, len = Math.round(decay * sr);
        const buf   = ctx.createBuffer(2, len, sr);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, decay);
        }
        this.#convolver = ctx.createConvolver(); this.#convolver.buffer = buf;
        this.#wet = ctx.createGain(); this.#dry = ctx.createGain();
        this.#output = ctx.createGain();
        this.#wet.gain.value = opts.wet ?? 0.3; this.#dry.gain.value = 1 - (opts.wet ?? 0.3);
        this.#convolver.connect(this.#wet); this.#wet.connect(this.#output); this.#dry.connect(this.#output);
    }

    get input():  AudioNode { return this.#dry; }
    get output(): AudioNode { return this.#output; }
    set wet(v: number) { this.#wet.gain.value = Math.max(0,Math.min(1,v)); this.#dry.gain.value = 1-v; }
}

export class Delay {
    #node  : DelayNode;
    #gain  : GainNode;
    #output: GainNode;

    constructor(engine = _engine, opts: { time?: number; feedback?: number } = {}) {
        const ctx = engine.context;
        this.#node   = ctx.createDelay(5);
        this.#node.delayTime.value = opts.time ?? 0.3;
        this.#gain   = ctx.createGain(); this.#gain.gain.value = opts.feedback ?? 0.4;
        this.#output = ctx.createGain();
        this.#node.connect(this.#gain); this.#gain.connect(this.#node); this.#node.connect(this.#output);
    }

    get input():  AudioNode { return this.#node; }
    get output(): AudioNode { return this.#output; }
    set time(t: number)     { this.#node.delayTime.value = Math.max(0,Math.min(5,t)); }
    set feedback(v: number) { this.#gain.gain.value = Math.max(0,Math.min(0.99,v)); }
}

export class Filter {
    #node: BiquadFilterNode;

    constructor(engine = _engine, opts: { type?: BiquadFilterType; freq?: number; Q?: number; gain?: number } = {}) {
        this.#node = engine.context.createBiquadFilter();
        this.#node.type            = opts.type ?? 'lowpass';
        this.#node.frequency.value = opts.freq ?? 1000;
        this.#node.Q.value         = opts.Q    ?? 1;
        this.#node.gain.value      = opts.gain ?? 0;
    }

    get node(): BiquadFilterNode { return this.#node; }
    set frequency(f: number) { this.#node.frequency.value = f; }
    set Q(v: number)         { this.#node.Q.value         = v; }
}

// ── Analyser ──────────────────────────────────────────────────────────────────

export class Analyser {
    #node: AnalyserNode;
    #fftBuf : Float32Array;
    #timeBuf: Float32Array;

    constructor(engine = _engine, fftSize = 2048) {
        this.#node    = engine.context.createAnalyser();
        this.#node.fftSize = fftSize;
        this.#fftBuf  = new Float32Array(this.#node.frequencyBinCount);
        this.#timeBuf = new Float32Array(fftSize);
        engine.destination.connect(this.#node);
    }

    get node(): AnalyserNode { return this.#node; }

    getSpectrum(): Float32Array {
        // Cast through `any` because the DOM API expects `Float32Array<ArrayBuffer>`
        // (concrete) while TS infers `Float32Array<ArrayBufferLike>` (the union),
        // and refining the buffer type at construction is not portable across
        // TS major versions.
        this.#node.getFloatFrequencyData(this.#fftBuf as never);
        return this.#fftBuf;
    }

    getWaveform(): Float32Array {
        this.#node.getFloatTimeDomainData(this.#timeBuf as never);
        return this.#timeBuf;
    }

    getPeak(): number { return Math.max(...this.getWaveform().map(Math.abs)); }

    getRMS(): number {
        const w = this.getWaveform();
        return Math.sqrt(w.reduce((a,v)=>a+v*v,0)/w.length);
    }
}

// ── Sequencer ─────────────────────────────────────────────────────────────────

export type StepCallback = (step: number, time: number) => void;

export class Sequencer {
    #steps    : boolean[];
    #bpm      : number;
    #interval : ReturnType<typeof setInterval> | null = null;
    #step     = 0;
    #callbacks: StepCallback[] = [];

    constructor(steps = 16, bpm = 120) {
        this.#steps = new Array(steps).fill(false);
        this.#bpm   = bpm;
    }

    set(step: number, active: boolean): this { this.#steps[step] = active; return this; }
    setPattern(pattern: boolean[]): this { this.#steps = [...pattern]; return this; }
    onStep(cb: StepCallback): this { this.#callbacks.push(cb); return this; }
    set bpm(v: number) { this.#bpm = v; if (this.#interval) { this.stop(); this.start(); } }

    start(): this {
        this.stop();
        const ms = (60 / this.#bpm / 4) * 1000; // 16th note
        this.#interval = setInterval(() => {
            if (this.#steps[this.#step]) this.#callbacks.forEach(cb => cb(this.#step, _engine.time));
            this.#step = (this.#step + 1) % this.#steps.length;
        }, ms);
        return this;
    }

    stop(): this {
        if (this.#interval) { clearInterval(this.#interval); this.#interval = null; }
        this.#step = 0;
        return this;
    }

    get currentStep(): number { return this.#step; }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const Audio = {
    engine: _engine, AudioEngine, AudioPlayer, AudioRecorder,
    Oscillator, NoiseGenerator,
    Reverb, Delay, Filter, Analyser,
    Sequencer,
};

if (typeof window !== 'undefined') {
    // Use try/catch + delete + assign because window.Audio is a builtin (HTMLAudioElement
    // constructor) and Object.defineProperty with configurable:false would throw.
    // The shadow is intentional: Audio.* takes precedence, but we don't want a hard crash.
    try { delete (window as any).Audio; } catch {}
    try { (window as any).Audio = Audio; } catch {}
}

export default Audio;
