/**
 * @file arianna-globals.d.ts
 * @description Module augmentation for the 'arianna' package. Extends the
 *              base `arianna` module with the Pipeline 6 component family
 *              (audio/video/composite/chat/graphics/payments/shipments)
 *              and the Colors addon under `additionals/`.
 * @author Riccardo Angeli
 * @copyright Riccardo Angeli 2012–2026
 */

declare module 'arianna' {
    // ── Core (unchanged from baseline) ─────────────────────────────────────
    export { default as Core } from './core/Core.ts';
    export { default as Observable, signal, signalMono, effect, computed,
             batch, untrack, uuid, AriannATemplate } from './core/Observable.ts';
    export { default as State }     from './core/State.ts';
    export { default as Real }      from './core/Real.ts';
    export { default as Virtual, default as VirtualNode } from './core/Virtual.ts';
    export { default as Component } from './core/Component.ts';
    export { default as Directive } from './core/Directive.ts';
    export { Rule, CssState }       from './core/Rule.ts';
    export { default as Sheet }     from './core/Stylesheet.ts';
    export { default as Context }   from './core/Context.ts';
    export { default as Namespace } from './core/Namespace.ts';
    export { default as SSR }       from './core/SSR.ts';
    export { Workers, WorkerPool }  from './core/Workers.ts';

    export type { Signal, SignalMono, ReadonlySignal, AriannAEvent,
                  ListenerOptions }                from './core/Observable.ts';
    export type { TypeDescriptor, NamespaceDescriptor } from './core/Core.ts';
    export type { StateEvent }                     from './core/State.ts';
    export type { RealTarget, RealDef }            from './core/Real.ts';
    export type { VAttrs, VChild }                 from './core/Virtual.ts';
    export type { CSSProperties, RuleDefinition }  from './core/Rule.ts';
    export type { ContextEvent }                   from './core/Context.ts';
    export type { ComponentMeta }                  from './core/Directive.ts';
    export type { WorkerTask }                     from './core/Workers.ts';
}

// ── Components — sub-path declarations ─────────────────────────────────────
//
// Each `components/<group>` re-exports its public surface through that
// folder's index.ts. Declared as separate modules so consumers can import
// granularly:
//
//   import { PaymentGateway } from 'arianna/components/payments';
//   import { TrackingMulti }  from 'arianna/components/shipments';

declare module 'arianna/components' {
    export * from './components/audio/index.ts';
    export * from './components/video/index.ts';
    export * from './components/composite/index.ts';
    export * from './components/graphics/2D/index.ts';
    export * from './components/graphics/3D/index.ts';
    export * from './components/graphics/colors/index.ts';
    export * from './components/payments/index.ts';
    export * from './components/shipments/index.ts';
}

declare module 'arianna/components/audio' {
    export * from './components/audio/index.ts';
}

declare module 'arianna/components/video' {
    export * from './components/video/index.ts';
}

declare module 'arianna/components/composite' {
    export * from './components/composite/index.ts';
}

declare module 'arianna/components/graphics/2D' {
    export * from './components/graphics/2D/index.ts';
}

declare module 'arianna/components/graphics/3D' {
    export * from './components/graphics/3D/index.ts';
}

declare module 'arianna/components/graphics/colors' {
    export * from './components/graphics/colors/index.ts';
}

declare module 'arianna/components/payments' {
    export * from './components/payments/index.ts';
}

declare module 'arianna/components/shipments' {
    export * from './components/shipments/index.ts';
}

// ── Additionals — Colors addon ─────────────────────────────────────────────
//
// Pure-math colour conversions used by the colour-pickers and gradient
// editors. Sits alongside the other addons (Three, Two, AI, Finance, …).

declare module 'arianna/additionals/Colors' {
    export * from './additionals/Colors.ts';
}
