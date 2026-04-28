/**
 * AriannA — Fine-grain reactive UI framework
 * @author    Riccardo Angeli
 * @version   1.2.0
 * @license   MIT
 * @copyright Riccardo Angeli 2012-2026
 *
 * @example
 *   import { Real, State, Sheet, signal, effect } from 'arianna';
 */

// ── Core kernel ───────────────────────────────────────────────────────────────
export { default as Core }         from './Core.ts';
export type { Scope, TypeDescriptor, NamespaceDescriptor, CorePlugin } from './Core.ts';

// ── Fine-grain reactive primitives ────────────────────────────────────────────
export {
    signal,
    signalMono,
    sinkText,
    sinkClass,
    effect,
    computed,
    batch,
    untrack,
    uuid,
    AriannATemplate,
    Observable,
} from './Observable.ts';

export type {
    Signal,
    SignalMono,
    ReadonlySignal,
    AriannAEvent,
    ListenerOptions,
    ListenerRecord,
} from './Observable.ts';

// ── DOM wrappers ──────────────────────────────────────────────────────────────
export { default as Real }                       from './Real.ts';
export { default as VirtualNode,
         default as Virtual }                    from './Virtual.ts';
export type { RealTarget, RealDef }              from './Real.ts';

// ── State ─────────────────────────────────────────────────────────────────────
export { default as State }        from './State.ts';
export type { StateEvent }         from './State.ts';

// ── Context ───────────────────────────────────────────────────────────────────
export { default as Context }      from './Context.ts';
export type { ContextEvent }       from './Context.ts';

// ── Namespace ─────────────────────────────────────────────────────────────────
export { default as Namespace }    from './Namespace.ts';

// ── Component + Directive ─────────────────────────────────────────────────────
export { default as Component }    from './Component.ts';
export { default as Directive }    from './Directive.ts';

// ── CSS ───────────────────────────────────────────────────────────────────────
export { Rule, CssState }          from './Rule.ts';
export { default as Sheet }        from './Stylesheet.ts';
export type { RuleDefinition, CSSProperties, SelectorObject } from './Rule.ts';
export type { SheetInput, SheetObjectDef }                    from './Stylesheet.ts';

// ── SSR ───────────────────────────────────────────────────────────────────────
export { default as SSR }          from './SSR.ts';

// ── Workers ───────────────────────────────────────────────────────────────────
export { Workers, WorkerPool }     from './Workers.ts';
export type { WorkerTask }         from './Workers.ts';
