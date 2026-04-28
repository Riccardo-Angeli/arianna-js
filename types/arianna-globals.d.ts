/**
 * @file arianna-globals.d.ts
 * @description Module augmentation for the 'arianna' package.
 * @author Riccardo Angeli
 * @copyright Riccardo Angeli 2012–2026
 */

declare module 'arianna' {
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
