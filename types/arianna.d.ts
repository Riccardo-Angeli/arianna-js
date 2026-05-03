/**
 * @file arianna.d.ts
 * @description Global window declarations for AriannA Framework v1.2.0
 * @author Riccardo Angeli
 * @copyright Riccardo Angeli 2012–2026
 *
 * Include in tsconfig.json:
 *   { "compilerOptions": { "types": ["arianna"] } }
 * or reference directly:
 *   /// <reference types="arianna" />
 */

import type { default as _Core, TypeDescriptor, NamespaceDescriptor } from '../core/Core.ts';
import type { default as _Observable, Signal, SignalMono, ReadonlySignal,
              AriannAEvent, ListenerOptions } from '../core/Observable.ts';
import type { default as _State, StateEvent } from '../core/State.ts';
import type { default as _Real, RealTarget, RealDef } from '../core/Real.ts';
import type { default as _Virtual, VirtualNode } from '../core/Virtual.ts';
import type { default as _Component, ComponentOptions } from '../core/Component.ts';
import type { default as _Directive, ComponentMeta } from '../core/Directive.ts';
import type { Rule as _Rule, CssState as _CssState, CSSProperties } from '../core/Rule.ts';
import type { default as _Sheet } from '../core/Stylesheet.ts';
import type { default as _Context, ContextEvent } from '../core/Context.ts';
import type { default as _Namespace } from '../core/Namespace.ts';

// Composite & audio components
import type { NodeEditor as _NodeEditor } from '../components/composite/NodeEditor.ts';
import type { PianoRoll  as _PianoRoll  } from '../components/audio/PianoRoll.ts';
import type { AudioPlayer      as _AudioPlayer      } from '../components/audio/AudioPlayer.ts';
import type { VideoPlayer      as _VideoPlayer      } from '../components/video/VideoPlayer.ts';
import type { ChannelStrip     as _ChannelStrip     } from '../components/audio/ChannelStrip.ts';
import type { AudioTrackEditor as _AudioTrackEditor } from '../components/audio/AudioTrackEditor.ts';
import type { VideoTrackEditor as _VideoTrackEditor } from '../components/video/VideoTrackEditor.ts';
import type { AudioEditor      as _AudioEditor      } from '../components/audio/AudioEditor.ts';
import type { AudioComponent   as _AudioComponent   } from '../components/audio/AudioComponent.ts';

declare global {

    // ── Constructors / classes available on window ────────────────────────────

    /** AriannA Core — global registry, plugin system, namespace management. */
    const Core: typeof _Core;

    /** Observable — pub/sub event bus + fine-grain Signal primitives. */
    const Observable: typeof _Observable;

    /** State — deep reactive proxy state container. */
    const State: typeof _State;

    /**
     * Real — fluent chainable Real DOM wrapper.
     * Also callable as a factory: Real('div', { class: 'foo' })
     */
    const Real: typeof _Real & ((...args: ConstructorParameters<typeof _Real>) => InstanceType<typeof _Real>);

    /**
     * Virtual — Virtual DOM node.
     * Also callable as a factory: Virtual('div', { class: 'foo' })
     */
    const Virtual: typeof VirtualNode & ((...args: ConstructorParameters<typeof VirtualNode>) => VirtualNode);

    /** Component — dual-mode component (Real/Virtual). */
    const Component: typeof _Component & ((...args: ConstructorParameters<typeof _Component>) => InstanceType<typeof _Component>);

    /** Directive — DOM directive runtime + TS decorator helpers. */
    const Directive: typeof _Directive;

    /** Rule — CSS rule engine v2. */
    const Rule: typeof _Rule;

    /** Sheet — stylesheet manager. */
    const Sheet: typeof _Sheet;

    /** CssState — CSS state machine helper. */
    const CssState: typeof _CssState;

    /** Context — provider/consumer context API. */
    const Context: typeof _Context;

    /** Namespace — namespace registration (HTML, SVG, MathML, X3D). */
    const Namespace: typeof _Namespace;

    // ── Fine-grain reactive primitives (also on window) ───────────────────────

    /** Create an atomic reactive Signal<T>. */
    function signal<T>(value: T): Signal<T>;

    /** Create a single-slot SignalMono<T> for direct TextNode patching. */
    function signalMono<T>(value: T): SignalMono<T>;

    /** Register a reactive Effect — re-runs when any read Signal changes. */
    function effect(fn: () => void): () => void;

    /** Create a read-only computed Signal derived from other Signals. */
    function computed<T>(fn: () => T): ReadonlySignal<T>;

    /** Batch multiple Signal updates into a single flush. */
    function batch(fn: () => void): void;

    /** Read Signals without tracking dependencies. */
    function untrack<T>(fn: () => T): T;

    // ── Window interface augmentation ─────────────────────────────────────────

    /** PianoRoll — MIDI piano-roll editor with playback. */
    const PianoRoll: typeof _PianoRoll;

    /** AudioPlayer — audio playback with transport, seek, volume, Web Audio routing. */
    const AudioPlayer: typeof _AudioPlayer;

    /** VideoPlayer — video playback with transport, fullscreen, Web Audio routing. */
    const VideoPlayer: typeof _VideoPlayer;

    /** ChannelStrip — DAW-style channel strip with gain, EQ, pan, fader, meter. */
    const ChannelStrip: typeof _ChannelStrip;

    /** AudioTrackEditor — multi-track audio timeline with waveform clip editing. */
    const AudioTrackEditor: typeof _AudioTrackEditor;

    /** VideoTrackEditor — multi-track video timeline with thumbnail clip editing. */
    const VideoTrackEditor: typeof _VideoTrackEditor;

    /** AudioEditor — single-clip Audacity-style waveform editor. */
    const AudioEditor: typeof _AudioEditor;

    /** AudioComponent — base class for all audio components. */
    const AudioComponent: typeof _AudioComponent;

    /** NodeEditor — generic JSON-schema-driven node graph editor. */
    const NodeEditor: typeof _NodeEditor;

    interface Window {
        Core       : typeof _Core;
        Observable : typeof _Observable;
        State      : typeof _State;
        Real       : typeof _Real;
        Virtual    : typeof VirtualNode;
        Component  : typeof _Component;
        Directive  : typeof _Directive;
        Rule       : typeof _Rule;
        Sheet      : typeof _Sheet;
        Context    : typeof _Context;
        Namespace  : typeof _Namespace;
        signal     : <T>(value: T) => Signal<T>;
        signalMono : <T>(value: T) => SignalMono<T>;
        effect     : (fn: () => void) => () => void;
        computed   : <T>(fn: () => T) => ReadonlySignal<T>;
        batch      : (fn: () => void) => void;
        untrack    : <T>(fn: () => T) => T;
        PianoRoll        : typeof _PianoRoll;
        AudioPlayer      : typeof _AudioPlayer;
        VideoPlayer      : typeof _VideoPlayer;
        ChannelStrip     : typeof _ChannelStrip;
        AudioTrackEditor : typeof _AudioTrackEditor;
        VideoTrackEditor : typeof _VideoTrackEditor;
        AudioEditor      : typeof _AudioEditor;
        AudioComponent   : typeof _AudioComponent;
        NodeEditor       : typeof _NodeEditor;
    }
}

export {};
