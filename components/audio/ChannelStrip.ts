/**
 * @module    ChannelStrip
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Audio channel strip in DAW style (Luna / Nuendo / Pro Tools).
 * Provides input gain, 3-band EQ (low/mid/high shelves+peak), pan,
 * mute/solo, fader (post-EQ), and a real-time meter.
 *
 * The whole signal chain is built with Web Audio API:
 *   input → gain → EQ low → EQ mid → EQ high → pan → fader → output
 *
 * @example
 *   import { ChannelStrip } from 'ariannajs/components/audio';
 *
 *   const strip = new ChannelStrip('#strip', {
 *     name: 'Lead Vox',
 *     color: '#e40c88',
 *   });
 *
 *   somePlayer.connect(strip);
 *   strip.connect(masterStrip);
 *
 *   strip.on('change', e => console.log(e));
 *   strip.setFader(-6);   // -6 dB
 *   strip.setEQ('low', { gain: 3, freq: 100 });
 */

import { AudioComponent, type AudioComponentOptions } from './AudioComponent.ts';

export type EQBand = 'low' | 'mid' | 'high';

export interface EQBandSettings {
    gain?: number;     // dB, -18..+18
    freq?: number;     // Hz
    q?:    number;     // for 'mid' band only
}

export interface ChannelStripOptions extends AudioComponentOptions {
    name?:    string;
    color?:   string;
    /** Initial fader in dB. Default 0. */
    fader?:   number;
    /** Initial input gain in dB. Default 0. */
    gain?:    number;
    /** Pan -1..+1. Default 0. */
    pan?:     number;
    /** Initial EQ. */
    eq?: {
        low?:  EQBandSettings;
        mid?:  EQBandSettings;
        high?: EQBandSettings;
    };
    /** Show meter. Default true. */
    showMeter?: boolean;
}

const dbToGain = (db: number): number => Math.pow(10, db / 20);
const gainToDb = (g:  number): number => g > 0 ? 20 * Math.log10(g) : -Infinity;

export class ChannelStrip extends AudioComponent<ChannelStripOptions> {
    // Web Audio nodes
    private _gainNode!  : GainNode;
    private _eqLow!     : BiquadFilterNode;
    private _eqMid!     : BiquadFilterNode;
    private _eqHigh!    : BiquadFilterNode;
    private _panNode!   : StereoPannerNode;
    private _faderNode! : GainNode;
    private _analyser!  : AnalyserNode;

    // State
    private _muted = false;
    private _solo  = false;
    private _faderDb: number;

    // DOM refs
    private _elFader!  : HTMLInputElement;
    private _elGain!   : HTMLInputElement;
    private _elPan!    : HTMLInputElement;
    private _elMute!   : HTMLButtonElement;
    private _elSolo!   : HTMLButtonElement;
    private _elFaderVal!: HTMLElement;
    private _elGainVal! : HTMLElement;
    private _elPanVal!  : HTMLElement;
    private _elMeterFill!: HTMLElement;
    private _elName!   : HTMLElement;
    private _eqInputs  : Record<EQBand, { gain: HTMLInputElement; freq: HTMLInputElement }> = {} as Record<EQBand, { gain: HTMLInputElement; freq: HTMLInputElement }>;

    // Meter loop
    private _meterRAF = 0;

    constructor(container: string | HTMLElement | null, opts: ChannelStripOptions = {}) {
        super(container, 'div', {
            name      : 'Channel',
            color     : '#e40c88',
            fader     : 0,
            gain      : 0,
            pan       : 0,
            showMeter : true,
            ...opts,
        });

        this.el.className = `ar-channelstrip${opts.class ? ' ' + opts.class : ''}`;
        this._faderDb = this._get<number>('fader', 0);
        this._injectStyles();
        this._buildAudioGraph();
        this._buildShell();
        this._startMeter();
        this._gc(() => { if (this._meterRAF) cancelAnimationFrame(this._meterRAF); });
    }

    // ── Public API ──────────────────────────────────────────────────────────

    setGain(db: number): this {
        this._gainNode.gain.value = dbToGain(db);
        if (this._elGain)    this._elGain.value = String(db);
        if (this._elGainVal) this._elGainVal.textContent = formatDb(db);
        this._emit('change', { kind: 'gain', value: db });
        return this;
    }

    setFader(db: number): this {
        this._faderDb = db;
        this._applyFader();
        if (this._elFader)    this._elFader.value = String(db);
        if (this._elFaderVal) this._elFaderVal.textContent = formatDb(db);
        this._emit('change', { kind: 'fader', value: db });
        return this;
    }

    setPan(value: number): this {
        const c = Math.max(-1, Math.min(1, value));
        this._panNode.pan.value = c;
        if (this._elPan)    this._elPan.value = String(c);
        if (this._elPanVal) this._elPanVal.textContent = formatPan(c);
        this._emit('change', { kind: 'pan', value: c });
        return this;
    }

    setEQ(band: EQBand, settings: EQBandSettings): this {
        const node = band === 'low' ? this._eqLow : band === 'mid' ? this._eqMid : this._eqHigh;
        if (settings.gain !== undefined) node.gain.value      = settings.gain;
        if (settings.freq !== undefined) node.frequency.value = settings.freq;
        if (settings.q    !== undefined && band === 'mid') node.Q.value = settings.q;
        const i = this._eqInputs[band];
        if (i) {
            if (settings.gain !== undefined) i.gain.value = String(settings.gain);
            if (settings.freq !== undefined) i.freq.value = String(settings.freq);
        }
        this._emit('change', { kind: 'eq', band, settings });
        return this;
    }

    setMute(muted: boolean): this {
        this._muted = muted;
        this._applyFader();
        if (this._elMute) this._elMute.classList.toggle('active', muted);
        this._emit('change', { kind: 'mute', value: muted });
        return this;
    }

    setSolo(solo: boolean): this {
        this._solo = solo;
        if (this._elSolo) this._elSolo.classList.toggle('active', solo);
        this._emit('change', { kind: 'solo', value: solo });
        return this;
    }

    setName(n: string): this {
        if (this._elName) this._elName.textContent = n;
        return this;
    }

    getMute():  boolean { return this._muted; }
    getSolo():  boolean { return this._solo; }
    getFader(): number  { return this._faderDb; }

    // ── Internal ────────────────────────────────────────────────────────────

    protected _buildAudioGraph(): void {
        const ctx = this._audioCtx;

        this._gainNode = ctx.createGain();
        this._gainNode.gain.value = dbToGain(this._get<number>('gain', 0));

        this._eqLow = ctx.createBiquadFilter();
        this._eqLow.type = 'lowshelf';
        this._eqLow.frequency.value = 200;
        this._eqLow.gain.value = 0;

        this._eqMid = ctx.createBiquadFilter();
        this._eqMid.type = 'peaking';
        this._eqMid.frequency.value = 1000;
        this._eqMid.Q.value = 1;
        this._eqMid.gain.value = 0;

        this._eqHigh = ctx.createBiquadFilter();
        this._eqHigh.type = 'highshelf';
        this._eqHigh.frequency.value = 5000;
        this._eqHigh.gain.value = 0;

        this._panNode = ctx.createStereoPanner();
        this._panNode.pan.value = this._get<number>('pan', 0);

        this._faderNode = ctx.createGain();
        this._faderNode.gain.value = dbToGain(this._faderDb);

        this._analyser = ctx.createAnalyser();
        this._analyser.fftSize = 256;
        this._analyser.smoothingTimeConstant = 0.7;

        // Apply initial EQ if provided
        const eq = this._get<NonNullable<ChannelStripOptions['eq']>>('eq', {});
        if (eq?.low)  Object.assign(this._eqLow,  this._toApply(eq.low));
        if (eq?.mid)  Object.assign(this._eqMid,  this._toApply(eq.mid));
        if (eq?.high) Object.assign(this._eqHigh, this._toApply(eq.high));

        // Wire chain
        this._gainNode.connect(this._eqLow);
        this._eqLow.connect(this._eqMid);
        this._eqMid.connect(this._eqHigh);
        this._eqHigh.connect(this._panNode);
        this._panNode.connect(this._faderNode);
        this._faderNode.connect(this._analyser);

        this._input  = this._gainNode;
        this._output = this._analyser;
    }

    private _toApply(s: EQBandSettings): Record<string, unknown> {
        const obj: Record<string, unknown> = {};
        if (s.gain !== undefined) obj.gain = { value: s.gain };
        if (s.freq !== undefined) obj.frequency = { value: s.freq };
        if (s.q    !== undefined) obj.Q = { value: s.q };
        return obj;
    }

    private _applyFader(): void {
        const db = this._muted ? -Infinity : this._faderDb;
        this._faderNode.gain.value = isFinite(db) ? dbToGain(db) : 0;
    }

    protected _build(): void { /* shell built explicitly */ }

    private _buildShell(): void {
        const color = this._get<string>('color', '#e40c88');
        const name  = this._get<string>('name', 'Channel');

        this.el.innerHTML = `
<div class="ar-channelstrip__hd" style="border-top:3px solid ${color}">
  <span class="ar-channelstrip__name" data-r="name">${name}</span>
</div>

<div class="ar-channelstrip__body">
  <div class="ar-channelstrip__sec">
    <div class="ar-channelstrip__sec-ttl">Input</div>
    <div class="ar-channelstrip__row">
      <input type="range" class="ar-channelstrip__knob" data-r="gain" min="-24" max="24" step="0.1" value="0">
      <span class="ar-channelstrip__val" data-r="gain-val">0.0 dB</span>
    </div>
  </div>

  <div class="ar-channelstrip__sec">
    <div class="ar-channelstrip__sec-ttl">EQ</div>
    <div class="ar-channelstrip__eq-band">
      <span class="ar-channelstrip__eq-lbl">Hi</span>
      <input type="range" class="ar-channelstrip__eq-gain" data-r="eq-high-gain" min="-18" max="18" step="0.1" value="0">
      <input type="number" class="ar-channelstrip__eq-freq" data-r="eq-high-freq" value="5000" min="500" max="20000">
    </div>
    <div class="ar-channelstrip__eq-band">
      <span class="ar-channelstrip__eq-lbl">Mid</span>
      <input type="range" class="ar-channelstrip__eq-gain" data-r="eq-mid-gain" min="-18" max="18" step="0.1" value="0">
      <input type="number" class="ar-channelstrip__eq-freq" data-r="eq-mid-freq" value="1000" min="100" max="10000">
    </div>
    <div class="ar-channelstrip__eq-band">
      <span class="ar-channelstrip__eq-lbl">Lo</span>
      <input type="range" class="ar-channelstrip__eq-gain" data-r="eq-low-gain" min="-18" max="18" step="0.1" value="0">
      <input type="number" class="ar-channelstrip__eq-freq" data-r="eq-low-freq" value="200" min="20" max="500">
    </div>
  </div>

  <div class="ar-channelstrip__sec">
    <div class="ar-channelstrip__sec-ttl">Pan</div>
    <div class="ar-channelstrip__row">
      <input type="range" class="ar-channelstrip__knob" data-r="pan" min="-1" max="1" step="0.01" value="0">
      <span class="ar-channelstrip__val" data-r="pan-val">C</span>
    </div>
  </div>

  <div class="ar-channelstrip__sec ar-channelstrip__fader-wrap">
    <div class="ar-channelstrip__sec-ttl">Fader</div>
    <div class="ar-channelstrip__fader-row">
      ${this._get<boolean>('showMeter', true) ? '<div class="ar-channelstrip__meter"><div class="ar-channelstrip__meter-fill" data-r="meter-fill"></div></div>' : ''}
      <input type="range" class="ar-channelstrip__fader" data-r="fader" min="-60" max="12" step="0.1" value="0" orient="vertical">
    </div>
    <span class="ar-channelstrip__val" data-r="fader-val">0.0 dB</span>
  </div>

  <div class="ar-channelstrip__btn-row">
    <button class="ar-channelstrip__btn mute" data-r="mute">M</button>
    <button class="ar-channelstrip__btn solo" data-r="solo">S</button>
  </div>
</div>`;

        const r = (n: string) => this.el.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
        this._elName     = r('name');
        this._elGain     = r('gain')     as HTMLInputElement;
        this._elGainVal  = r('gain-val');
        this._elPan      = r('pan')      as HTMLInputElement;
        this._elPanVal   = r('pan-val');
        this._elFader    = r('fader')    as HTMLInputElement;
        this._elFaderVal = r('fader-val');
        this._elMute     = r('mute')     as HTMLButtonElement;
        this._elSolo     = r('solo')     as HTMLButtonElement;
        if (this._get<boolean>('showMeter', true)) this._elMeterFill = r('meter-fill');

        // EQ refs
        for (const band of ['low', 'mid', 'high'] as EQBand[]) {
            this._eqInputs[band] = {
                gain: r(`eq-${band}-gain`) as HTMLInputElement,
                freq: r(`eq-${band}-freq`) as HTMLInputElement,
            };
        }

        // Initial values
        this._elGain.value  = String(this._get<number>('gain', 0));
        this._elFader.value = String(this._faderDb);
        this._elPan.value   = String(this._get<number>('pan', 0));
        this._elFaderVal.textContent = formatDb(this._faderDb);

        // Listeners
        this._elGain.addEventListener('input',  () => this.setGain(parseFloat(this._elGain.value)));
        this._elFader.addEventListener('input', () => this.setFader(parseFloat(this._elFader.value)));
        this._elPan.addEventListener('input',   () => this.setPan(parseFloat(this._elPan.value)));

        this._elMute.addEventListener('click', () => this.setMute(!this._muted));
        this._elSolo.addEventListener('click', () => this.setSolo(!this._solo));

        for (const band of ['low', 'mid', 'high'] as EQBand[]) {
            this._eqInputs[band].gain.addEventListener('input', () =>
                this.setEQ(band, { gain: parseFloat(this._eqInputs[band].gain.value) }));
            this._eqInputs[band].freq.addEventListener('change', () =>
                this.setEQ(band, { freq: parseFloat(this._eqInputs[band].freq.value) }));
        }
    }

    private _startMeter(): void {
        if (!this._get<boolean>('showMeter', true)) return;
        const buf = new Uint8Array(this._analyser.frequencyBinCount);
        const tick = () => {
            this._analyser.getByteTimeDomainData(buf);
            // Peak amplitude
            let peak = 0;
            for (let i = 0; i < buf.length; i++) {
                const v = Math.abs(buf[i] - 128) / 128;
                if (v > peak) peak = v;
            }
            const pct = Math.min(100, peak * 100);
            if (this._elMeterFill) {
                this._elMeterFill.style.height = pct + '%';
                this._elMeterFill.style.background = pct > 90 ? '#dc2626'
                                                   : pct > 70 ? '#eab308'
                                                              : '#16a34a';
            }
            this._meterRAF = requestAnimationFrame(tick);
        };
        tick();
    }

    private _injectStyles(): void {
        if (document.getElementById('ar-channelstrip-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-channelstrip-styles';
        s.textContent = `
.ar-channelstrip { font:11px -apple-system,system-ui,sans-serif; background:#1e1e1e; color:#d4d4d4; border-radius:4px; padding:0; width:100px; height:520px; display:flex; flex-direction:column; box-shadow:0 1px 3px rgba(0,0,0,.3); user-select:none; }
.ar-channelstrip__hd { padding:6px 8px; border-bottom:1px solid #333; text-align:center; }
.ar-channelstrip__name { font-weight:600; color:#fff; font-size:11px; }
.ar-channelstrip__body { flex:1; display:flex; flex-direction:column; gap:6px; padding:8px 6px; min-height:0; }
.ar-channelstrip__sec { background:#252525; border-radius:3px; padding:6px; }
.ar-channelstrip__sec-ttl { font-size:9px; color:#666; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; text-align:center; }
.ar-channelstrip__row { display:flex; align-items:center; gap:4px; flex-direction:column; }
.ar-channelstrip__knob { width:100%; -webkit-appearance:none; height:3px; background:#444; border-radius:2px; outline:none; cursor:pointer; }
.ar-channelstrip__knob::-webkit-slider-thumb { -webkit-appearance:none; width:10px; height:10px; border-radius:50%; background:#e40c88; cursor:pointer; }
.ar-channelstrip__knob::-moz-range-thumb     { width:10px; height:10px; border-radius:50%; background:#e40c88; cursor:pointer; border:0; }
.ar-channelstrip__val { font:10px ui-monospace,monospace; color:#aaa; text-align:center; }
.ar-channelstrip__eq-band { display:flex; align-items:center; gap:4px; margin:2px 0; }
.ar-channelstrip__eq-lbl  { font-size:9px; color:#888; width:18px; }
.ar-channelstrip__eq-gain { flex:1; -webkit-appearance:none; height:3px; background:#444; border-radius:2px; outline:none; cursor:pointer; min-width:0; }
.ar-channelstrip__eq-gain::-webkit-slider-thumb { -webkit-appearance:none; width:8px; height:8px; border-radius:50%; background:#3b82f6; cursor:pointer; }
.ar-channelstrip__eq-gain::-moz-range-thumb     { width:8px; height:8px; border-radius:50%; background:#3b82f6; cursor:pointer; border:0; }
.ar-channelstrip__eq-freq { width:36px; font:9px ui-monospace,monospace; background:#1a1a1a; border:1px solid #333; color:#d4d4d4; padding:1px 2px; border-radius:2px; }
.ar-channelstrip__fader-wrap { flex:1; display:flex; flex-direction:column; align-items:center; min-height:0; }
.ar-channelstrip__fader-row { flex:1; display:flex; gap:4px; align-items:stretch; min-height:0; }
.ar-channelstrip__meter { width:8px; background:#0a0a0a; border:1px solid #333; border-radius:1px; position:relative; overflow:hidden; }
.ar-channelstrip__meter-fill { position:absolute; bottom:0; left:0; right:0; background:#16a34a; height:0; transition:height .05s linear; }
.ar-channelstrip__fader { writing-mode:bt-lr; -webkit-appearance:slider-vertical; width:24px; height:auto; flex:1; outline:none; cursor:ns-resize; }
.ar-channelstrip__btn-row { display:flex; gap:4px; }
.ar-channelstrip__btn { flex:1; background:transparent; border:1px solid #444; color:#d4d4d4; padding:3px 0; font:10px sans-serif; font-weight:600; border-radius:2px; cursor:pointer; }
.ar-channelstrip__btn:hover { background:#2a2a2a; }
.ar-channelstrip__btn.mute.active { background:#dc2626; border-color:#dc2626; color:#fff; }
.ar-channelstrip__btn.solo.active { background:#eab308; border-color:#eab308; color:#1f1f1f; }
`;
        document.head.appendChild(s);
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDb(db: number): string {
    if (!isFinite(db)) return '-∞';
    return (db >= 0 ? '+' : '') + db.toFixed(1) + ' dB';
}

function formatPan(p: number): string {
    if (Math.abs(p) < 0.01) return 'C';
    return p < 0 ? `L${Math.round(-p * 100)}` : `R${Math.round(p * 100)}`;
}
