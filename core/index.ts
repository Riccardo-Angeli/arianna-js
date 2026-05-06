/**
 * @module    core
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * AriannA core — public package barrel. Re-exports the foundational
 * primitives every component and addon depends on. Sub-modules are also
 * importable individually:
 *
 *   import { Core }            from 'arianna/core';
 *   import { signal, effect }  from 'arianna/observable';
 *   import { Real }            from 'arianna/real';
 *
 * The default export of each module is re-exported here as a named
 * binding so downstream code can use the familiar `import { Core } from
 * '../core/index.ts'` pattern.
 */

// ── Default class exports as named bindings ───────────────────────────────

export { default as Core }       from './Core.ts';
export { default as Observable } from './Observable.ts';
export { default as State }      from './State.ts';
export { default as Real }       from './Real.ts';
export { default as Virtual }    from './Virtual.ts';
export { default as Component }  from './Component.ts';
export { default as Directive }  from './Directive.ts';
export { default as Sheet }      from './Stylesheet.ts';
export { default as Context }    from './Context.ts';
export { default as Namespace }  from './Namespace.ts';
export { default as SSR }        from './SSR.ts';
export { default as Workers }    from './Workers.ts';

// ── Reactive primitives (named exports from Observable.ts) ────────────────

export {
    signal, signalMono, effect, computed, batch, untrack, uuid,
    AriannATemplate,
} from './Observable.ts';

// ── Rule system (CSS rule engine) ─────────────────────────────────────────

export { Rule, CssState } from './Rule.ts';

// ── Public types ──────────────────────────────────────────────────────────

export type {
    Signal, SignalMono, ReadonlySignal, AriannAEvent, ListenerOptions,
} from './Observable.ts';
export type { TypeDescriptor, NamespaceDescriptor } from './Core.ts';
export type { StateEvent }                          from './State.ts';
export type { RealTarget, RealDef }                 from './Real.ts';
export type { VAttrs, VChild, VirtualNode }         from './Virtual.ts';
export type { ComponentMeta }                       from './Directive.ts';
export type { CSSProperties, RuleDefinition, RuleEvent } from './Rule.ts';
export type { ContextEvent }                        from './Context.ts';
export type { WorkerTask }                          from './Workers.ts';
