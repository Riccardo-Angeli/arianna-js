/**
 * @module    AudioComponent
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Base class for all AriannA audio components. Provides a shared
 * AudioContext, common .connect()/.disconnect() routing API, and
 * standard input/output AudioNode references.
 *
 * Subclasses override _buildAudioGraph() to construct their internal
 * Web Audio graph and assign this._input / this._output.
 *
 * @example
 *   const mic    = new AudioInput();
 *   const strip  = new ChannelStrip('#strip');
 *   const player = new AudioPlayer('#play', { src: 'song.mp3' });
 *
 *   // Routing: each component returns `this` for chaining
 *   mic.connect(strip).connect(AudioComponent.context.destination);
 *   player.connect(strip);
 *
 *   strip.on('change', e => console.log(e.gain, e.pan));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Shared AudioContext ─────────────────────────────────────────────────────
// One context per page. Created lazily on first access (autoplay policy).

let _sharedCtx: AudioContext | undefined;

function getSharedContext(): AudioContext {
    if (!_sharedCtx) {
        const Ctor = (window.AudioContext ||
                     (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        _sharedCtx = new Ctor();
    }
    return _sharedCtx;
}

// ── Common options ──────────────────────────────────────────────────────────

export interface AudioComponentOptions extends CtrlOptions {
    /** Use a custom AudioContext instead of the shared one. */
    audioContext? : AudioContext;
}

// ── Base class ──────────────────────────────────────────────────────────────

export abstract class AudioComponent<O extends AudioComponentOptions = AudioComponentOptions>
    extends Control<O>
{
    /** Static accessor for the shared AudioContext. */
    static get context(): AudioContext { return getSharedContext(); }

    /** Resume the shared context (call after user gesture). */
    static async resume(): Promise<void> {
        const ctx = getSharedContext();
        if (ctx.state === 'suspended') await ctx.resume();
    }

    /** Per-instance context (defaults to shared). */
    protected _audioCtx: AudioContext;

    /** Where signals enter this component. */
    protected _input?: AudioNode;

    /** Where signals leave this component. */
    protected _output?: AudioNode;

    /** Track active downstream connections for clean disconnect. */
    private _downstream: Set<AudioNode> = new Set();

    constructor(container: string | HTMLElement | null, tag: string, opts: O) {
        super(container, tag, opts);
        this._audioCtx = opts.audioContext ?? getSharedContext();
    }

    /**
     * Connect this component's output to another audio destination.
     * Returns the destination so calls can chain:
     *   mic.connect(strip).connect(destination)
     */
    connect(target: AudioComponent | AudioNode): AudioComponent | AudioNode {
        if (!this._output) {
            console.warn('[AudioComponent] no output node defined; subclass must assign this._output');
            return target;
        }
        const dst = (target instanceof AudioComponent) ? target.getInput() : target;
        if (!dst) {
            console.warn('[AudioComponent] target has no input');
            return target;
        }
        this._output.connect(dst);
        this._downstream.add(dst);
        return target;
    }

    /** Disconnect from all downstream targets. */
    disconnect(): this {
        if (!this._output) return this;
        for (const dst of this._downstream) {
            try { this._output.disconnect(dst); } catch { /* already gone */ }
        }
        this._downstream.clear();
        return this;
    }

    /** Get the input node for routing into this component. */
    getInput(): AudioNode | undefined { return this._input; }

    /** Get the output node for routing out of this component. */
    getOutput(): AudioNode | undefined { return this._output; }

    /** Get the shared/instance context. */
    getContext(): AudioContext { return this._audioCtx; }

    /**
     * Subclasses build their Web Audio graph here and assign
     * this._input and/or this._output.
     */
    protected abstract _buildAudioGraph(): void;
}

// ── Helpers exported for subclasses & user code ─────────────────────────────

/** Resume the shared AudioContext (call after a user gesture). */
export async function resumeAudio(): Promise<void> {
    return AudioComponent.resume();
}

/** Get the shared AudioContext. */
export function audioContext(): AudioContext {
    return AudioComponent.context;
}
