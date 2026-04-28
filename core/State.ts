/**
 * @module    State
 * @author    Riccardo Angeli
 * @version   1.2.0
 * @copyright Riccardo Angeli 2012-2026
 *
 * Deep reactive state container per AriannA.
 * I primitivi Signal sono importati da Observable — zero duplicazione.
 *
 *   State.signal(v)       → Signal<T> atomico
 *   State.signalMono(v)   → SignalMono<T> slot singolo
 *   State.effect(fn)      → Effect isolato con cleanup
 *   State.computed(fn)    → Signal derivato read-only
 *   State.batch(fn)       → flush raggruppato
 *   State.untrack(fn)     → lettura senza dipendenze
 *   new State({ ... })    → deep reactive con Proxy + getter/setter
 */

import { signal, signalMono, sinkText, effect, computed, batch, untrack, uuid } from './Observable.ts';
import type { Signal, SignalMono, ReadonlySignal, AriannAEvent } from './Observable.ts';

export type { Signal, SignalMono, ReadonlySignal };

export interface StateEvent extends AriannAEvent
{
    Target   : object;
    State    : State<object>;
    Property : { Name: string | symbol; Old: unknown; New: unknown };
}

interface Listener { readonly Id: string; Handler: (e: StateEvent) => void; Target: object; }

const COLLECTION_MUTATORS = new Set(['set','add','delete','clear','push','pop','shift','unshift','splice','fill','sort','reverse','copyWithin']);

export class State<T extends object>
{
    readonly #events  = new Map<string, Set<Listener>>();
    readonly #states  = new Map<string, Partial<T>>();
    readonly #history : Array<{ key: string | symbol; old: unknown; new: unknown; ts: number }> = [];
    #source  : T;
    #state!  : T;

    // ── Static fine-grain API ─────────────────────────────────────────────────

    static signal     = signal;
    static signalMono = signalMono;
    static sinkText   = sinkText;
    static effect     = effect;
    static computed   = computed;
    static batch      = batch;
    static untrack    = untrack;

    constructor(source: T)
    {
        this.#source = source;
        this.#state  = this.#load(source);
        this.#history.push({ key: '__init__', old: undefined, new: source, ts: Date.now() });

        Object.defineProperty(this, 'State',   { enumerable: true, configurable: false, get: () => this.#state, set: (v: T) => { if (v && typeof v === 'object') { this.#source = v; this.#state = this.#load(v); } } });
        Object.defineProperty(this, 'States',  { enumerable: true, configurable: false, get: () => this.#states });
        Object.defineProperty(this, 'History', { enumerable: true, configurable: false, get: () => this.#history });
    }

    declare readonly State   : T;
    declare readonly States  : Map<string, Partial<T>>;
    declare readonly History : Array<{ key: string | symbol; old: unknown; new: unknown; ts: number }>;

    on(types: string, cb: (e: StateEvent) => void): this
    {
        const ls: Listener = { Id: uuid(), Handler: cb, Target: this };
        types.split(/(?!-)\W/g).filter(Boolean).forEach(t => { const b = this.#events.get(t) ?? new Set<Listener>(); b.add(ls); this.#events.set(t, b); });
        return this;
    }

    off(type: string, cb: (e: StateEvent) => void): this
    { this.#events.get(type)?.forEach(l => l.Handler === cb && this.#events.get(type)!.delete(l)); return this; }

    fire(event: StateEvent): this
    { if (!event?.Type) return this; this.#events.get(event.Type)?.forEach(l => l.Handler.call(l.Target, event)); return this; }

    match(types: string, cb: (e: StateEvent) => void): this { return this.on(types, cb); }
    addState(name: string, snapshot: Partial<T>): this    { this.#states.set(name, snapshot); return this; }
    removeState(name: string): this                        { this.#states.delete(name); return this; }

    #emit(key: string | symbol, old: unknown, newVal: unknown, target: object): void
    {
        const k  = String(key);
        const ev : StateEvent = { Type: '', Target: target, State: this, Property: { Name: key, Old: old, New: newVal } };
        const fire = (type: string) => { ev.Type = type; this.fire(ev); };
        fire('State-Changing'); fire(`State-${k}-Changing`);
        fire(`State-${k}-Changed`); fire('State-Changed');
        this.#history.push({ key, old, new: newVal, ts: Date.now() });
        if (this.#states.size) this.#states.forEach(snap => {
            if ((snap as Record<string, unknown>)[k] === newVal) {
                const se = { ...ev }; se.Type = 'State-Reached'; this.fire(se);
                se.Type = `State-${k}-Reached`; this.fire(se);
            }
        });
    }

    #proxyHandler(parent: object): ProxyHandler<object>
    {
        const self = this;
        return {
            get(target, key, recv) {
                const val = Reflect.get(target, key, recv);
                if (typeof val === 'function' && COLLECTION_MUTATORS.has(String(key).toLowerCase()))
                    return function(this: object, ...args: unknown[]) { const old = Array.isArray(target) ? [...target] : undefined; self.#emit(key, old, args[0], target); return (val as (...a: unknown[]) => unknown).apply(target, args); };
                return val;
            },
            set(target, key, value, recv): boolean { const old = (target as Record<string|symbol, unknown>)[key]; if (old === value) return true; Reflect.set(target, key, value, recv); self.#emit(key, old, value, target); return true; },
        };
    }

    #load(source: T): T
    {
        const s = { ...source } as Record<string, unknown>;
        const wrap = (o: Record<string, unknown>): Record<string, unknown> => {
            for (const k of Object.keys(o)) {
                let v = o[k];
                Object.defineProperty(o, k, {
                    enumerable: true, configurable: true,
                    get: () => v,
                    set: (V: unknown) => {
                        if (v === V) return;
                        const old = v; v = V;
                        this.#emit(k, old, V, o);
                        if (V && typeof V === 'object' && !(V instanceof Map) && !(V instanceof Set) && !(V instanceof WeakMap) && !(V instanceof WeakSet) && !Array.isArray(V))
                            v = wrap(V as Record<string, unknown>);
                    },
                });
                if (v && typeof v === 'object') {
                    if (v instanceof Map || v instanceof WeakMap || v instanceof Set || v instanceof WeakSet || Array.isArray(v))
                        o[k] = v = new Proxy(v as object, this.#proxyHandler(o));
                    else o[k] = v = wrap(v as Record<string, unknown>);
                }
            }
            return o;
        };
        return wrap(s) as T;
    }
}

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'State', { enumerable: true, configurable: false, writable: false, value: State });

export default State;
