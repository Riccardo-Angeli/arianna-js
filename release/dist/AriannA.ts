/**
 * AriannA.ts — Single-file bundle
 *
 * @author    Riccardo Angeli
 * @version   1.2.0
 * @license   MIT / Commercial (dual license)
 *
 * MIT License
 * Copyright (c) 2012-2026 Riccardo Angeli
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * For commercial / enterprise use, a separate commercial license applies.
 * Contact: arianna-wip@riccardoangeli.com
 *
 * Dedicated with love to Arianna. ♡
 *
 * ── USAGE (no build step needed) ─────────────────────────────────────────────
 *
 *   import AriannA, { Core, Real, Virtual, State, Observable, Directive } from './AriannA.ts';
 *
 *   const card  = new Real('div', { class: 'card' });
 *   const state = new State({ count: 0 });
 *   card.on('click', () => state.State.count++).append(document.body);
 *
 * ── MODULES ───────────────────────────────────────────────────────────────────
 *
 *   Core        — kernel: namespace registry, plugin system, type descriptors
 *   Observable  — dual-mode pub/sub: instance bus + static DOM event wrapper
 *   State       — deep reactive state (getter/setter + Proxy for collections)
 *   Real        — fluent live DOM wrapper
 *   Virtual     — fluent virtual DOM (identical API to Real)
 *   Directive   — template directives (a-if, a-for, a-model, a-bind, etc.)
 *   Rule        — CSS rule builder
 *   Sheet       — CSS stylesheet manager
 *   Context     — prop-drilling elimination via CustomEvent bus
 *
 * ── CHANGELOG v1.1.0 ─────────────────────────────────────────────────────────
 *
 *   [State]    raw(fn)          — suspend reactivity for bulk mutations
 *   [State]    subscribe/unsub  — simple callback subscription
 *   [State]    historyLimit     — cap history to prevent memory leaks (default 500)
 *   [State]    State.Signal()   — derived computed value, auto-updated
 *   [Real]     Real.Pool        — non-keyed DOM row pool (eliminates GC on clear)
 *   [Real]     Real.batch()     — batch DOM mutations into a single reflow
 *   [Real]     Real.delegate()  — event delegation (1 listener instead of N)
 *   [Real]     .css()           — set CSS property / custom property
 *   [Real]     .destroy()       — detach + remove from Instances
 *   [Real]     Instances opt-in — no longer auto-populated (prevents GC retention)
 *   [Virtual]  Virtual.Pool     — non-keyed VDOM pool for Krause benchmark
 *   [Virtual]  .patch()         — partial attr/text update without re-render
 *   [Virtual]  .destroy()       — detach + cleanup bus + remove from Instances
 *   [Virtual]  .css()           — set CSS property / custom property
 *   [Virtual]  Lazy #bus        — internal bus Map allocated only on first use
 *   [Virtual]  Instances opt-in — use Virtual.trackInstance()
 *   [License]  MIT / Commercial dual license (previously AGPL)
 *   [Workers]  Full implementation: WorkerPool, SharedState, SignalWorker, OffscreenBridge
 *   [SSR]      Full implementation: renderToString, renderToStream, hydrate, Island
 */

// ── Version ───────────────────────────────────────────────────────────────────

export const version = Object.freeze({ major: 1, minor: 1, patch: 0, string: '1.2.0' });

// ── Types ─────────────────────────────────────────────────────────────────────

export type Scope           = { writable: boolean; configurable: boolean; enumerable: boolean };
export type CorePlugin      = { name: string; install(core: typeof Core, opts?: unknown): void };
export type NodeInput       = string | Node | Real | VirtualNode;
export type VAttrs          = Record<string, string | number | boolean | null>;
export type VChild          = VirtualNode | string | number | boolean | null | undefined;

export interface AriannAEvent
{
    Type : string;
    [k: string]: unknown;
}

export interface TypeDescriptor
{
    Tag        : string;
    Tags       : string[];
    Constructor: (new (...a: unknown[]) => Element) | null;
    Standard   : boolean;
    Custom     : boolean;
    Namespace  : string;
    Schema     : string;
    Attributes : Record<string, string>;
    Style      : Record<string, string>;
    Update?    : ((el: HTMLElement) => void);
}

// ── UUID ──────────────────────────────────────────────────────────────────────

export function uuid(): string
{
    const b: string[] = [];
    for (let i = 0; i < 9; i++)
        b.push((Math.floor(1 + Math.random() * 0x10000)).toString(16).slice(1));
    return `${b[1]}${b[2]}-${b[3]}-${b[4]}-${b[5]}-${b[6]}${b[7]}${b[8]}`;
}

// ── Core ──────────────────────────────────────────────────────────────────────

const _NS: Record<string, {
    schema : string;
    types  : { standard: Record<string, TypeDescriptor>; custom: Record<string, TypeDescriptor> };
}> = {};
const _installedNames: string[] = [];
const _installed = new Map<string, CorePlugin>();

export const Core: any = {
    version: Object.freeze({ major: 1, minor: 1, patch: 0, string: '1.2.0' }),

    Scopes: {
        Private      : { writable: false, configurable: false, enumerable: false },
        Readonly     : { writable: false, configurable: true,  enumerable: true  },
        Writable     : { writable: true,  configurable: true,  enumerable: true  },
        Configurable : { writable: true,  configurable: true,  enumerable: false },
    } as Record<string, Scope>,

    get Namespaces() { return _NS; },

    use(plugin: CorePlugin, opts?: unknown): typeof Core
    {
        if (_installedNames.includes(plugin.name)) return Core;
        _installedNames.push(plugin.name);
        _installed.set(plugin.name, plugin);
        plugin.install(Core, opts);
        return Core;
    },

    plugins(): string[] { return [..._installedNames]; },

    Define(
        tag  : string,
        ctor : new (...a: unknown[]) => Element,
        base : new (...a: unknown[]) => Element = HTMLElement,
        style: Record<string, string> = {},
    ): TypeDescriptor | false
    {
        try
        {
            const ns  = _NS['html'] ?? (_NS['html'] = { schema: 'http://www.w3.org/1999/xhtml', types: { standard: {}, custom: {} } });
            const key = tag.toLowerCase();
            if (ns.types.custom[key]) return ns.types.custom[key];
            customElements.define(key, ctor as CustomElementConstructor, {
                extends: base === HTMLElement
                    ? undefined
                    : base.name.replace('HTML', '').replace('Element', '').toLowerCase(),
            });
            const d: TypeDescriptor = {
                Tag: key, Tags: [key], Constructor: ctor, Standard: false, Custom: true,
                Namespace: 'html', Schema: ns.schema, Attributes: {}, Style: style,
            };
            ns.types.custom[key] = d;
            return d;
        } catch { return false; }
    },

    GetDescriptor(target: string | Element | (new (...a: unknown[]) => Element)): TypeDescriptor | false
    {
        for (const ns of Object.values(_NS))
        {
            for (const pool of [ns.types.standard, ns.types.custom])
            {
                if (typeof target === 'string')
                {
                    if (pool[target.toLowerCase()]) return pool[target.toLowerCase()];
                } else
                {
                    const found = Object.values(pool).find(d => d.Constructor === target);
                    if (found) return found;
                }
            }
        }
        return false;
    },

    GetPrototypeChain(obj: object): string[]
    {
        const chain: string[] = [];
        let p = Object.getPrototypeOf(obj);
        while (p && p !== Object.prototype)
        {
            if (p.constructor?.name) chain.push(p.constructor.name);
            p = Object.getPrototypeOf(p);
        }
        return chain;
    },

    SetDescriptors(obj: object, scope: Scope): void
    {
        Object.keys(obj).forEach(k =>
            Object.defineProperty(obj, k, { ...scope, value: (obj as Record<string, unknown>)[k] }));
    },

    _initHTML(): void
    {
        if (_NS['html']) return;
        const ns = _NS['html'] = { schema: 'http://www.w3.org/1999/xhtml', types: { standard: {} as Record<string, TypeDescriptor>, custom: {} as Record<string, TypeDescriptor> } };
        const tags = ['a','abbr','address','area','article','aside','audio','b','base','bdi','bdo','blockquote',
            'body','br','button','canvas','caption','cite','code','col','colgroup','data','datalist','dd','del',
            'details','dfn','dialog','div','dl','dt','em','embed','fieldset','figcaption','figure','footer','form',
            'h1','h2','h3','h4','h5','h6','head','header','hr','html','i','iframe','img','input','ins','kbd',
            'label','legend','li','link','main','map','mark','menu','meta','meter','nav','noscript','object','ol',
            'optgroup','option','output','p','picture','pre','progress','q','rp','rt','ruby','s','samp','script',
            'search','section','select','slot','small','source','span','strong','style','sub','summary','sup',
            'table','tbody','td','template','textarea','tfoot','th','thead','time','title','tr','track','u','ul',
            'var','video','wbr'];
        tags.forEach(t =>
        {
            ns.types.standard[t] = {
                Tag: t, Tags: [t], Constructor: null, Standard: true, Custom: false,
                Namespace: 'html', Schema: ns.schema, Attributes: {}, Style: {},
            };
        });
    },
};

Core._initHTML();
try { Object.defineProperty(window, 'Core', { value: Core, writable: false, enumerable: false, configurable: false }); } catch {}

// ── Observable ────────────────────────────────────────────────────────────────

type OEvent    = { Type: string; [k: string]: unknown };
type OListener = { Id: string; Handler: (e: OEvent) => void; Target: object };

export class Observable
{
    readonly #reg  = new Map<string, Set<OListener>>();
    readonly #self : this;

    static readonly Listeners = new Map<string, {
        UUID       : string;
        Type       : string;
        Target     : EventTarget | object;
        Function   : EventListenerOrEventListenerObject | ((e: AriannAEvent) => void);
        Propagation: 'bubble' | 'capture' | undefined;
        XML        : string;
    }>();

    constructor(readonly Target?: object) { this.#self = this; }

    /**
     * Register listener(s) for one or more event types.
     * Separators: space, comma, or pipe.
     *
     * @example
     *   obs.on('State-Changed State-Changing', e => console.log(e.Type));
     */
    on(types: string, cb: (e: OEvent) => void): this
    {
        const ls: OListener = { Id: uuid(), Handler: cb, Target: this.#self };
        types.split(/(?!-)\W/g).filter(Boolean).forEach(t =>
        {
            const b = this.#reg.get(t) ?? new Set<OListener>();
            b.add(ls); this.#reg.set(t, b);
        });
        return this.#self;
    }

    /**
     * Remove a listener by exact callback reference.
     *
     * @example
     *   obs.off('State-Changed', myHandler);
     */
    off(type: string, cb: (e: OEvent) => void): this
    {
        this.#reg.get(type)?.forEach(l =>
        {
            if (l.Handler === cb) this.#reg.get(type)!.delete(l);
        });
        return this.#self;
    }

    /**
     * Dispatch an event to all listeners of event.Type.
     *
     * @example
     *   obs.fire({ Type: 'State-Changed', Property: { Name: 'x', New: 1 } });
     */
    fire(event: OEvent): this
    {
        if (!event?.Type) return this.#self;
        this.#reg.get(event.Type)?.forEach(l => l.Handler.call(l.Target, event));
        return this.#self;
    }

    /**
     * One-shot callback — auto-removed after first call.
     *
     * @example
     *   obs.once({ Type: 'Ready' }, e => console.log('fired once'));
     */
    once(event: OEvent, cb?: (e: OEvent) => void): this
    {
        if (cb) { const w = (e: OEvent) => { cb.call(this.#self, e); this.off(event.Type, w); }; this.on(event.Type, w); }
        return this.fire(event);
    }

    /** Alias of fire(). */
    all(event: OEvent): this { return this.fire(event); }

    get registry(): ReadonlyMap<string, Set<OListener>> { return this.#reg; }

    // ── Static DOM bus ────────────────────────────────────────────────────────

    /**
     * Add a DOM event listener. Registers in Observable.Listeners.
     *
     * @example
     *   Observable.On('#btn', 'click mouseenter', handler);
     *   Observable.On([el1, el2], 'mouseup', handler);
     */
    static On(
        target : string | EventTarget | EventTarget[],
        types  : string,
        cb     : EventListenerOrEventListenerObject,
        opts?  : { Passive?: boolean; Capture?: boolean; Once?: boolean; Signal?: AbortSignal },
    ): void
    {
        const resolve = (t: string | EventTarget | EventTarget[]): EventTarget[] =>
            typeof t === 'string'
                ? Array.from(document.querySelectorAll<Element>(t))
                : Array.isArray(t) ? t : [t];
        const split   = (s: string) => s.split(/\s+|,|\|/g).filter(Boolean);
        const adOpts: AddEventListenerOptions = {
            passive: opts?.Passive, capture: opts?.Capture,
            once: opts?.Once, signal: opts?.Signal,
        };
        resolve(target).forEach(el => split(types).forEach(t =>
        {
            el.addEventListener(t, cb, adOpts);
            const id = uuid();
            Observable.Listeners.set(id, {
                UUID: id, Type: t, Target: el, Function: cb,
                Propagation: opts?.Capture ? 'capture' : 'bubble',
                XML: `<listener uuid="${id}" type="${t}"/>`,
            });
        }));
    }

    /**
     * Remove a DOM event listener. Also removes from Observable.Listeners.
     *
     * @example
     *   Observable.Off('#btn', 'click', handler);
     */
    static Off(
        target : string | EventTarget | EventTarget[],
        types  : string,
        cb     : EventListenerOrEventListenerObject,
        opts?  : boolean | EventListenerOptions,
    ): void
    {
        const resolve = (t: string | EventTarget | EventTarget[]): EventTarget[] =>
            typeof t === 'string'
                ? Array.from(document.querySelectorAll<Element>(t))
                : Array.isArray(t) ? t : [t];
        resolve(target).forEach(el => types.split(/\s+/).filter(Boolean).forEach(t =>
        {
            el.removeEventListener(t, cb, opts);
            for (const [id, rec] of Observable.Listeners)
                if (rec.Target === el && rec.Type === t && rec.Function === cb)
                    Observable.Listeners.delete(id);
        }));
    }

    /**
     * Dispatch a DOM event on target(s).
     *
     * @example
     *   Observable.Fire(button, 'click', { bubbles: true });
     */
    static Fire(
        target  : string | EventTarget | EventTarget[],
        types   : string,
        init?   : EventInit | CustomEventInit,
        detail? : Record<string, unknown>,
    ): void
    {
        const resolve = (t: string | EventTarget | EventTarget[]): EventTarget[] =>
            typeof t === 'string'
                ? Array.from(document.querySelectorAll<Element>(t))
                : Array.isArray(t) ? t : [t];
        resolve(target).forEach(el => types.split(/\s+/).filter(Boolean).forEach(t =>
            el.dispatchEvent(new CustomEvent(t, { ...init, detail }))));
    }

    static Trigger = Observable.Fire;
    static Once(
        target : string | EventTarget | EventTarget[],
        types  : string,
        cb     : EventListenerOrEventListenerObject,
    ): void { Observable.On(target, types, cb, { Once: true }); }
    static All = Observable.On;

    static GetListener(id: string) { return Observable.Listeners.get(id); }
    static GetListeners(target: EventTarget, type?: string) {
        const result = [];
        for (const rec of Observable.Listeners.values())
            if (rec.Target === target && (!type || rec.Type === type)) result.push(rec);
        return result;
    }
}

try { Object.defineProperty(window, 'Observable', { value: Observable, writable: false, enumerable: false, configurable: false }); } catch {}

// ── State ─────────────────────────────────────────────────────────────────────

export interface StateEvent extends AriannAEvent
{
    Target   : object;
    State    : State<object>;
    Property : { Name: string | symbol; Old: unknown; New: unknown };
}

export interface StateOptions { historyLimit?: number; }

export interface StateSignal<T>
{
    readonly value : T;
    dispose()      : void;
}

interface SListener { readonly Id: string; Handler: (e: StateEvent) => void; Target: object; }

const COLLECTION_MUTATORS = new Set([
    'set', 'add', 'delete', 'clear', 'push', 'pop', 'shift', 'unshift',
    'splice', 'fill', 'sort', 'reverse', 'copyWithin',
]);

export class State<T extends object = Record<string, unknown>>
{
    readonly #events  = new Map<string, Set<SListener>>();
    readonly #states  = new Map<string, Partial<T>>();
    readonly #history : Array<{ key: string | symbol; old: unknown; new: unknown; ts: number }> = [];
    readonly #subs    = new Set<() => void>();
    #source     : T;
    #state!     : T;
    #rawMode    = false;
    #rawDirty   = false;
    #histLimit  : number;

    constructor(source: T, options?: StateOptions)
    {
        this.#source    = source;
        this.#histLimit = options?.historyLimit ?? 500;
        this.#state     = this.#load(source);
        this.#history.push({ key: '__init__', old: undefined, new: source, ts: Date.now() });

        Object.defineProperty(this, 'State', {
            enumerable: true, configurable: false,
            get : ()    => this.#state,
            set : (v: T) =>
            {
                if (v && typeof v === 'object') { this.#source = v; this.#state = this.#load(v); }
            },
        });
        Object.defineProperty(this, 'States',  { enumerable: true, configurable: false, get: () => this.#states });
        Object.defineProperty(this, 'History', { enumerable: true, configurable: false, get: () => this.#history });
    }

    declare readonly State   : T;
    declare readonly States  : Map<string, Partial<T>>;
    declare readonly History : Array<{ key: string | symbol; old: unknown; new: unknown; ts: number }>;

    /**
     * Register listener(s) for one or more State event types.
     *
     * @example
     *   s.on('State-Changed', e => console.log(e.Property.Name, e.Property.New));
     */
    on(types: string, cb: (e: StateEvent) => void): this
    {
        const ls: SListener = { Id: uuid(), Handler: cb as (e: StateEvent) => void, Target: this };
        types.split(/(?!-)\W/g).filter(Boolean).forEach(t =>
        {
            const b = this.#events.get(t) ?? new Set<SListener>();
            b.add(ls); this.#events.set(t, b);
        });
        return this;
    }

    /**
     * Remove a listener by exact callback reference.
     *
     * @example
     *   s.off('State-Changed', myHandler);
     */
    off(type: string, cb: (e: StateEvent) => void): this
    {
        this.#events.get(type)?.forEach(l =>
            l.Handler === (cb as (e: StateEvent) => void) && this.#events.get(type)!.delete(l));
        return this;
    }

    /**
     * Dispatch a StateEvent directly.
     *
     * @example
     *   s.fire({ Type: 'State-Changed', Target: {}, State: s, Property: { Name: 'x', Old: 0, New: 1 } });
     */
    fire(event: StateEvent): this
    {
        if (!event?.Type) return this;
        this.#events.get(event.Type)?.forEach(l => l.Handler.call(l.Target, event as StateEvent));
        return this;
    }

    /** Alias of on(). */
    match(types: string, cb: (e: StateEvent) => void): this { return this.on(types, cb); }

    /**
     * Register a simple callback invoked on every State-Changed.
     *
     * @example
     *   state.subscribe(() => render());
     */
    subscribe(cb: () => void): this
    {
        this.#subs.add(cb);
        this.on('State-Changed', cb as unknown as (e: StateEvent) => void);
        return this;
    }

    /**
     * Remove a subscribe() callback.
     *
     * @example
     *   state.unsubscribe(renderFn);
     */
    unsubscribe(cb: () => void): this
    {
        this.#subs.delete(cb);
        this.off('State-Changed', cb as unknown as (e: StateEvent) => void);
        return this;
    }

    /**
     * Execute fn with reactivity suspended.
     * A single State-Changed fires after fn returns if anything changed.
     * Equivalent to Solid's untrack().
     *
     * @example
     *   state.raw(() => { state.State.rows = buildRows(1000); });
     */
    raw(fn: () => void): this
    {
        this.#rawMode = true;
        try { fn(); }
        finally
        {
            this.#rawMode = false;
            if (this.#rawDirty)
            {
                this.#rawDirty = false;
                this.fire({
                    Type    : 'State-Changed',
                    Target  : this.#source,
                    State   : this as unknown as State<object>,
                    Property: { Name: '__raw__', Old: undefined, New: undefined },
                });
                this.#subs.forEach(cb => cb());
            }
        }
        return this;
    }

    /**
     * Register a named state snapshot for state-machine matching.
     *
     * @example
     *   ui.addState('loading', { status: 'loading' });
     *   ui.State.status = 'loading'; // fires State-Reached
     */
    addState(name: string, snapshot: Partial<T>): this { this.#states.set(name, snapshot); return this; }

    /**
     * Remove a named state snapshot.
     *
     * @example
     *   ui.removeState('loading');
     */
    removeState(name: string): this { this.#states.delete(name); return this; }

    /**
     * Create a computed Signal derived from this State.
     * Auto-recomputed on State-Changed.
     *
     * @example
     *   const doubled = State.Signal(s, () => s.State.count * 2);
     *   s.State.count = 5;
     *   console.log(doubled.value); // 10
     *   doubled.dispose();
     */
    static Signal<S extends object, R>(state: State<S>, getter: () => R): StateSignal<R>
    {
        let cached = getter();
        const handler = () => { cached = getter(); };
        state.on('State-Changed', handler as (e: StateEvent) => void);
        return {
            get value() { return cached; },
            dispose() { state.off('State-Changed', handler as (e: StateEvent) => void); },
        };
    }

    #emit(key: string | symbol, old: unknown, newVal: unknown, target: object): void
    {
        if (this.#rawMode) { this.#rawDirty = true; return; }
        const k  = String(key);
        const ev : StateEvent = {
            Type    : '',
            Target  : target,
            State   : this as unknown as State<object>,
            Property: { Name: key, Old: old, New: newVal },
        };
        const fire = (type: string) => { ev.Type = type; this.fire(ev); };
        fire('State-Changing');
        fire(`State-${k}-Changing`);
        fire(`State-${k}-Changed`);
        fire('State-Changed');
        this.#history.push({ key, old, new: newVal, ts: Date.now() });
        if (this.#history.length > this.#histLimit)
            this.#history.splice(0, this.#history.length - this.#histLimit);
        this.#subs.forEach(cb => cb());
        this.#checkStates(k, newVal, ev);
    }

    #checkStates(key: string, value: unknown, ev: StateEvent): void
    {
        if (!this.#states.size) return;
        this.#states.forEach(snap =>
        {
            if ((snap as Record<string, unknown>)[key] === value)
            {
                const se = { ...ev };
                se.Type = 'State-Reached';        this.fire(se);
                se.Type = `State-${key}-Reached`; this.fire(se);
            }
        });
    }

    #proxyHandler(parent: object): ProxyHandler<object>
    {
        const self = this;
        return {
            get(target: object, key: string | symbol, recv: object)
            {
                const val = Reflect.get(target, key, recv);
                if (typeof val === 'function' && COLLECTION_MUTATORS.has(String(key).toLowerCase()))
                {
                    return function(this: object, ...args: unknown[])
                    {
                        const old = Array.isArray(target) ? [...target] : undefined;
                        self.#emit(key, old, args[0], target);
                        return (val as (...a: unknown[]) => unknown).apply(target, args);
                    };
                }
                return val;
            },
            set(target: object, key: string | symbol, value: unknown, recv: object): boolean
            {
                const old = (target as Record<string | symbol, unknown>)[key];
                if (old === value) return true;
                Reflect.set(target, key, value, recv);
                self.#emit(key, old, value, target);
                return true;
            },
        };
    }

    #load(source: T): T
    {
        const s = { ...source } as Record<string, unknown>;
        const wrap = (o: Record<string, unknown>): Record<string, unknown> =>
        {
            for (const k of Object.keys(o))
            {
                let v = o[k];
                Object.defineProperty(o, k, {
                    enumerable  : true,
                    configurable: true,
                    get : () => v,
                    set : (V: unknown) =>
                    {
                        if (v === V) return;
                        const old = v; v = V;
                        this.#emit(k, old, V, o);
                        if (V && typeof V === 'object'
                            && !(V instanceof Map)     && !(V instanceof Set)
                            && !(V instanceof WeakMap) && !(V instanceof WeakSet)
                            && !Array.isArray(V))
                            v = wrap(V as Record<string, unknown>);
                    },
                });
                if (v && typeof v === 'object')
                {
                    if (v instanceof Map || v instanceof WeakMap
                        || v instanceof Set || v instanceof WeakSet || Array.isArray(v))
                        o[k] = v = new Proxy(v as object, this.#proxyHandler(o));
                    else
                        o[k] = v = wrap(v as Record<string, unknown>);
                }
            }
            return o;
        };
        return wrap(s) as T;
    }
}

try { Object.defineProperty(window, 'State', { value: State, writable: false, enumerable: false, configurable: false }); } catch {}


// ── Shadow types + resolver ───────────────────────────────────────────────────

export type ShadowState = 'open' | 'close';
export type ShadowMode  = 'drop' | 'inset' | 'glow' | 'layered';

export interface ShadowOptions
{
    color?  : string;
    blur?   : number;
    spread? : number;
    x?      : number;
    y?      : number;
}

export interface ShadowLayer extends ShadowOptions
{
    inset? : boolean;
}

function _shadowAlpha(color: string, a: number): string
{
    const rgba = color.match(/rgba?\(([^)]+)\)/);
    if (rgba) { const p = rgba[1].split(',').map(s => s.trim()); if (p.length >= 3) return `rgba(${p[0]},${p[1]},${p[2]},${a})`; }
    const hex = color.match(/^#([0-9a-fA-F]{3,8})$/);
    if (hex) { const h = hex[1]; const r = parseInt(h.length >= 6 ? h.slice(0,2) : h[0]+h[0], 16); const g = parseInt(h.length >= 6 ? h.slice(2,4) : h[1]+h[1], 16); const b = parseInt(h.length >= 6 ? h.slice(4,6) : h[2]+h[2], 16); return `rgba(${r},${g},${b},${a})`; }
    return color;
}

function _shadowPreset(mode: ShadowMode, o: ShadowOptions): string
{
    const color = o.color ?? 'rgba(0,0,0,0.25)', blur = o.blur ?? 8, spread = o.spread ?? 0, x = o.x ?? 0;
    switch (mode) {
        case 'drop':    return `${x}px ${o.y ?? 4}px ${blur}px ${spread}px ${color}`;
        case 'inset':   return `inset ${x}px ${o.y ?? 0}px ${blur}px ${spread}px ${color}`;
        case 'glow':    return `0 0 ${blur}px ${spread+2}px ${color}, 0 0 ${blur*2}px ${spread}px ${_shadowAlpha(color, 0.5)}`;
        case 'layered': { const y = o.y ?? 4; return `${x}px ${y}px ${blur}px ${color}, ${x}px ${y*2}px ${blur*2}px ${_shadowAlpha(color, 0.15)}`; }
    }
}

function _shadowLayerCSS(l: ShadowLayer): string
{ return `${l.inset ? 'inset ' : ''}${l.x ?? 0}px ${l.y ?? 4}px ${l.blur ?? 8}px ${l.spread ?? 0}px ${l.color ?? 'rgba(0,0,0,0.25)'}`; }

function _shadowCSS(state: ShadowState, mode: ShadowMode | ShadowLayer[] | Rule | Sheet = 'drop', opts: ShadowOptions = {}): string
{
    if (state === 'close') return 'none';
    if (mode instanceof Rule)  { const v = mode.__props['boxShadow'] ?? mode.__props['box-shadow']; return v ?? _shadowPreset('drop', opts); }
    if (mode instanceof Sheet) { for (const r of mode.__rules) { const v = r.__props['boxShadow'] ?? r.__props['box-shadow']; if (v) return v; } return _shadowPreset('drop', opts); }
    if (Array.isArray(mode)) return mode.map(_shadowLayerCSS).join(', ');
    return _shadowPreset(mode, opts);
}

// ── Real ──────────────────────────────────────────────────────────────────────

type RealTarget = string | Element | Real | VirtualNode | { render(): Element };

function _toNodes(items: (NodeInput | null)[]): Node[]
{
    return items.flatMap(item =>
    {
        if (!item) return [];
        if (item instanceof Node)        return [item];
        if (item instanceof Real)        return [item.render()];
        if (item instanceof VirtualNode) return [item.render()];
        if (typeof item === 'string')
        {
            const t = document.createElement('template');
            t.innerHTML = item;
            return Array.from(t.content.childNodes);
        }
        return [];
    });
}

class Real
{
    #el         : Element;
    #mode       : boolean;
    #descriptor : TypeDescriptor | false;

    /** Opt-in registry of tracked Real instances. Use Real.trackInstance() to register. */
    static readonly Instances: Real[] = [];

    /** Register a Real instance in the global Instances registry. */
    static trackInstance(instance: Real): void
    {
        if (!Real.Instances.includes(instance)) Real.Instances.push(instance);
    }

    static get Namespaces() { return Core.Namespaces; }

    constructor(arg0: RealTarget, arg1?: Record<string, unknown> | (new (...a: unknown[]) => Element), arg2?: new (...a: unknown[]) => Element)
    {
        this.#mode       = new.target !== undefined;
        this.#el         = document.createElement('div');
        this.#descriptor = false;
        this.#init(arg0, arg1, arg2);
        if (this.#mode && (arg1 as Record<string, unknown>)?.['track'] === true)
            Real.Instances.push(this);
    }

    #init(arg0: RealTarget, arg1?: Record<string, unknown> | (new (...a: unknown[]) => Element), arg2?: new (...a: unknown[]) => Element): void
    {
        if (!this.#mode)
        {
            if (typeof arg0 === 'string')
            {
                if (arg1 && typeof arg1 === 'function') { Core.Define(arg0, arg1 as new () => Element, arg2 ?? HTMLElement); return; }
                const d = Core.GetDescriptor(arg0);
                if (d) { this.#descriptor = d; return; }
                const el = document.querySelector(arg0);
                if (el) { this.#el = el; this.#descriptor = Core.GetDescriptor(el); }
                return;
            }
            if (arg0 instanceof Element) { this.#el = arg0; this.#descriptor = Core.GetDescriptor(arg0); this.#mode = true; }
            return;
        }

        if (typeof arg0 === 'string')
        {
            this.#el         = document.createElement(arg0);
            this.#descriptor = Core.GetDescriptor(arg0);
        }
        else if (arg0 instanceof Element)  { this.#el = arg0; this.#descriptor = Core.GetDescriptor(arg0); }
        else if (arg0 instanceof VirtualNode) { this.#el = arg0.render(); }
        else if (typeof (arg0 as { render?: unknown }).render === 'function') { this.#el = (arg0 as { render(): Element }).render(); }

        if (arg1 && typeof arg1 === 'object' && typeof arg1 !== 'function')
        {
            const opts  = arg1 as Record<string, unknown>;
            const style = (opts['Style'] ?? opts['Css'] ?? opts['css'] ?? opts['style']) as Record<string, string> | undefined;
            if (style && this.#el instanceof HTMLElement)
                for (const [k, v] of Object.entries(style))
                    (this.#el as HTMLElement).style.setProperty(
                        k.startsWith('--') ? k : k.replace(/([A-Z])/g, c => `-${c.toLowerCase()}`), v);
            const attrs = opts['Attributes'] as Record<string, string> | undefined;
            if (attrs) for (const [k, v] of Object.entries(attrs)) this.#el.setAttribute(k, v);
        }
    }

    get name(): string { return this.#el.tagName?.toLowerCase() ?? ''; }
    get descriptor(): TypeDescriptor | false { return this.#descriptor; }

    render(): Element  { return this.#el; }
    valueOf(): Element { return this.#el; }
    log(node?: unknown): this { console.log(node ?? this.#el); return this; }

    /**
     * Detach from DOM and remove from Real.Instances.
     *
     * @example
     *   row.destroy();
     */
    destroy(): void
    {
        this.#el.parentNode?.removeChild(this.#el);
        const idx = Real.Instances.indexOf(this);
        if (idx >= 0) Real.Instances.splice(idx, 1);
    }

    /**
     * Applica o rimuove un box-shadow sull'elemento.
     * @param state - 'open' applica il shadow, 'close' lo rimuove (boxShadow: none).
     * @param mode  - Modalità: 'drop' | 'inset' | 'glow' | 'layered' | ShadowLayer[] | Rule | Sheet
     * @param opts  - color, blur, spread, x, y
     * @example
     *   el.shadow('open')
     *   el.shadow('open', 'glow', { color: '#e40c88', blur: 24 })
     *   el.shadow('open', myRule)
     *   el.shadow('open', [{ x:0, y:2, blur:4, color:'rgba(0,0,0,.12)' }])
     *   el.shadow('close')
     */
    shadow(state: ShadowState, mode: ShadowMode | ShadowLayer[] | Rule | Sheet = 'drop', opts: ShadowOptions = {}): this
    { (this.#el as HTMLElement).style.boxShadow = _shadowCSS(state, mode, opts); return this; }

    /**
     * Add DOM event listener (chainable). Supports space-separated multi-type.
     *
     * @example
     *   btn.on('click mouseenter', handler);
     */
    on(type: string, cb: EventListener, opts?: AddEventListenerOptions): this
    {
        type.split(/\s+/).filter(Boolean).forEach(t => this.#el.addEventListener(t, cb, opts));
        return this;
    }

    /**
     * Remove DOM event listener.
     *
     * @example
     *   btn.off('click', myHandler);
     */
    off(type: string, cb: EventListener, opts?: boolean | EventListenerOptions): this
    {
        type.split(/\s+/).filter(Boolean).forEach(t => this.#el.removeEventListener(t, cb, opts as EventListenerOptions));
        return this;
    }

    /**
     * Dispatch a CustomEvent.
     *
     * @example
     *   btn.fire('my-event', { detail: { value: 42 } });
     */
    fire(type: string, init?: CustomEventInit): this
    {
        this.#el.dispatchEvent(new CustomEvent(type, { bubbles: true, ...init }));
        return this;
    }

    /**
     * Attach to a parent element.
     *
     * @example
     *   new Real('div').append('#container');
     */
    append(parent: string | Node | Real | VirtualNode): this
    {
        let par: Node | null = null;
        if (typeof parent === 'string')         par = document.querySelector(parent);
        else if (parent instanceof Real)        par = parent.render();
        else if (parent instanceof VirtualNode) par = parent.render();
        else if (parent instanceof Node)        par = parent;
        if (par)
        {
            if (this.#el.parentNode && this.#el.parentNode !== par) this.#el.parentNode.removeChild(this.#el);
            if (!par.contains(this.#el)) par.appendChild(this.#el);
        }
        return this;
    }

    /**
     * Add children. Uses DocumentFragment for single reflow.
     * Last numeric argument sets the insertion index.
     *
     * @example
     *   btn.add('<span>Label</span>');
     *   btn.add(iconNode, labelNode, 0);
     */
    add(...args: (NodeInput | number)[]): this
    {
        const last  = args[args.length - 1];
        const items = typeof last === 'number' ? args.slice(0, -1) as NodeInput[] : args as NodeInput[];
        const index = typeof last === 'number' ? last : this.#el.childNodes.length;
        const nodes = _toNodes(items as (NodeInput | null)[]);
        if (!nodes.length) return this;
        const ref  = this.#el.childNodes[index] ?? null;
        const frag = document.createDocumentFragment();
        nodes.forEach(n => frag.appendChild(n));
        this.#el.insertBefore(frag, ref);
        return this;
    }

    unshift(...nodes: NodeInput[]): this { return this.add(...nodes, 0); }
    push(...nodes: NodeInput[]): this    { return this.add(...nodes); }

    /**
     * Remove specific children.
     *
     * @example
     *   list.remove(0); list.remove('.old'); list.remove(myReal);
     */
    remove(...targets: (string | Node | Real | number)[]): this
    {
        for (const t of targets)
        {
            let node: Node | null = null;
            if (typeof t === 'number')    node = this.#el.childNodes[t] ?? null;
            else if (typeof t === 'string') node = this.#el.querySelector(t);
            else if (t instanceof Real)   node = t.render();
            else if (t instanceof Node)   node = t;
            if (node && this.#el.contains(node)) this.#el.removeChild(node);
        }
        return this;
    }

    shift(n = 1): this { for (let i = 0; i < n && this.#el.firstChild; i++) this.#el.removeChild(this.#el.firstChild); return this; }
    pop(n = 1):   this { for (let i = 0; i < n && this.#el.lastChild;  i++) this.#el.removeChild(this.#el.lastChild);  return this; }

    contains(...nodes: (Node | Real | string)[]): boolean
    {
        for (const n of nodes)
        {
            const el = typeof n === 'string' ? this.#el.querySelector(n) : n instanceof Real ? n.render() : n;
            if (!el || !this.#el.contains(el)) return false;
        }
        return true;
    }

    /**
     * Get an attribute or DOM property (case-insensitive).
     *
     * @example
     *   real.get('id')    // attribute lookup
     *   real.get('VALUE') // property lookup
     */
    get(name: string): string | undefined
    {
        const u = name.toUpperCase();
        for (let i = 0; i < this.#el.attributes.length; i++)
        {
            const a = this.#el.attributes.item(i)!;
            if (a.name.toUpperCase() === u) return a.value;
        }
        const prop = (this.#el as unknown as Record<string, unknown>)[name];
        return prop !== undefined ? String(prop) : undefined;
    }

    /**
     * Set an attribute or DOM property.
     * `textContent` and `innerHTML` are handled as direct property sets.
     *
     * @example
     *   real.set('textContent', 'Hello').set('id', 'my-id')
     */
    set(name: string, value: string): this
    {
        const u  = name.toUpperCase();
        const el = this.#el as unknown as Record<string, unknown>;
        if (u === 'TEXTCONTENT') { this.#el.textContent = value; return this; }
        if (u === 'INNERHTML')   { this.#el.innerHTML   = value; return this; }
        if (name in el) el[name] = value;
        else this.#el.setAttribute(name, value);
        return this;
    }

    /**
     * Set a CSS style or custom property.
     *
     * @example
     *   real.css('color', 'dodgerblue')
     *   real.css('--brand-color', '#cc00cc')
     */
    css(prop: string, value: string): this
    {
        const el = this.#el as HTMLElement;
        if (!el.style) return this;
        if (prop.startsWith('--')) el.style.setProperty(prop, value);
        else (el.style as unknown as Record<string, string>)[prop] = value;
        return this;
    }

    show(): this { (this.#el as HTMLElement).style.display = '';     return this; }
    hide(): this { (this.#el as HTMLElement).style.display = 'none'; return this; }

    static Define(
        tag  : string,
        ctor : new (...a: unknown[]) => Element,
        base : new (...a: unknown[]) => Element = HTMLElement,
        style: Record<string, string> = {},
    ): TypeDescriptor | false { return Core.Define(tag, ctor, base, style); }

    static GetDescriptor = Core.GetDescriptor;

    static Render(obj: { Tag?: string; Attributes?: Record<string, string> } | VirtualNode | Element | Real): Element | null
    {
        if (obj instanceof Element)     return obj;
        if (obj instanceof Real)        return obj.render();
        if (obj instanceof VirtualNode) return obj.render();
        if (typeof obj === 'object' && 'Tag' in obj)
        {
            const el = document.createElement((obj as { Tag?: string }).Tag ?? 'div');
            if ((obj as { Attributes?: Record<string, string> }).Attributes)
                for (const [k, v] of Object.entries((obj as { Attributes: Record<string, string> }).Attributes))
                    el.setAttribute(k, v);
            return el;
        }
        return null;
    }

    /**
     * Batch DOM mutations synchronously (or deferred via rAF when async=true).
     *
     * @example
     *   Real.batch(() => { rows.forEach((r, i) => pool[i].set('textContent', r.label)); });
     */
    static batch(fn: () => void, async = false): void
    {
        if (async) requestAnimationFrame(fn);
        else fn();
    }

    /**
     * Attach a delegated event listener on a parent.
     * Returns an unsubscribe function.
     *
     * @example
     *   const off = Real.delegate(tbody, 'click', 'tr', (e, el) => select(el.dataset.id));
     *   off(); // remove listener
     */
    static delegate(
        parent   : string | Element | Real,
        type     : string,
        selector : string,
        cb       : (e: Event, el: Element) => void,
        opts?    : AddEventListenerOptions,
    ): () => void
    {
        const par = typeof parent === 'string'
            ? (document.querySelector(parent) as Element | null)
            : parent instanceof Real ? parent.render() : parent;
        if (!par) return () => {};
        const handler = (e: Event) =>
        {
            const target = (e.target as Element)?.closest(selector);
            if (target && par.contains(target)) cb(e, target);
        };
        par.addEventListener(type, handler, opts);
        return () => par.removeEventListener(type, handler, opts);
    }

    /**
     * Non-keyed DOM row pool — pre-allocate and reuse elements.
     * Eliminates GC churn on repeated create/destroy patterns (Krause 09_clear).
     *
     * @example
     *   const pool = Real.Pool.create(1000, i => new Real('tr'));
     *   Real.Pool.mount(pool, rows, tbody, (node, row) => {
     *       node.set('textContent', row.label);
     *   });
     *   Real.Pool.clear(pool, tbody);
     */
    static Pool = {
        create(n: number, template: (i: number) => Real): Real[]
        {
            const pool: Real[] = new Array(n);
            for (let i = 0; i < n; i++) pool[i] = template(i);
            return pool;
        },
        mount<T>(
            pool      : Real[],
            data      : T[],
            container : Element | Real,
            patcher   : (node: Real, item: T, i: number) => void,
            template? : (i: number) => Real,
        ): void
        {
            const par  = container instanceof Real ? container.render() : container;
            const frag = document.createDocumentFragment();
            for (let i = 0; i < data.length; i++)
            {
                if (i >= pool.length && template) pool.push(template(i));
                if (i < pool.length)
                {
                    patcher(pool[i], data[i], i);
                    frag.appendChild(pool[i].render());
                }
            }
            par.appendChild(frag);
        },
        clear(pool: Real[], container: Element | Real): void
        {
            const par = container instanceof Real ? container.render() : container;
            if (typeof (par as Element & { replaceChildren?(): void }).replaceChildren === 'function')
                (par as Element & { replaceChildren(): void }).replaceChildren();
            else
                par.textContent = '';
            void pool;
        },
        destroy(pool: Real[]): void
        {
            for (let i = 0; i < pool.length; i++)
                pool[i].render().parentNode?.removeChild(pool[i].render());
            pool.length = 0;
        },
    };
}

const _realFactory = function(this: unknown, ...args: ConstructorParameters<typeof Real>): Real {
    return new Real(...args);
} as unknown as typeof Real;
Object.setPrototypeOf(_realFactory, Real);
(_realFactory as unknown as Function).prototype = Real.prototype;
_realFactory.Define        = Real.Define;
_realFactory.GetDescriptor = Real.GetDescriptor;
_realFactory.Render        = Real.Render;
_realFactory.batch         = Real.batch;
_realFactory.delegate      = Real.delegate;
_realFactory.Pool          = Real.Pool;
_realFactory.trackInstance = Real.trackInstance;
Object.defineProperty(_realFactory, 'Instances',  { get: () => Real.Instances });
Object.defineProperty(_realFactory, 'Namespaces', { get: () => Real.Namespaces });

try { Object.defineProperty(window, 'Real', { value: _realFactory, writable: false, enumerable: false, configurable: false }); } catch {}
export { _realFactory as Real };

// ── VirtualNode ───────────────────────────────────────────────────────────────

interface _QueuedListener { type: string; cb: EventListener; opts?: AddEventListenerOptions; }

let _vnCounter = 0;
const _vnNodes: Record<string, VirtualNode> = {};
function _vnUid(): string { return `vn-${++_vnCounter}-${Math.random().toString(36).slice(2, 6)}`; }

function _normalizeChild(c: VChild): VirtualNode
{
    if (c instanceof VirtualNode) return c;
    const n = new VirtualNode('span');
    n.set('textContent', c == null ? '' : String(c));
    return n;
}

export class VirtualNode
{
    __id      : string;
    __tag     : string;
    __attrs   : VAttrs;
    __children: VirtualNode[];
    __text    : string;
    __dom     : Element | null    = null;
    __changes : Record<string, unknown> = {};
    __mounted : boolean = false;
    __domQueue: _QueuedListener[] = [];
    __parent  : VirtualNode | null = null;
    __bus     : Map<string, Set<{ Id: string; Handler: (e: object) => void; Target: VirtualNode }>> | null = null;
    __pendingShadow: { state: ShadowState; mode: ShadowMode | ShadowLayer[] | Rule | Sheet; opts: ShadowOptions } | null = null;

    /** Opt-in instance registry. */
    static readonly Instances: VirtualNode[] = [];
    static trackInstance(node: VirtualNode): void
    {
        if (!VirtualNode.Instances.includes(node)) VirtualNode.Instances.push(node);
    }

    constructor(def: string | { Tag?: string; Text?: string; Attributes?: VAttrs; Children?: VChild[]; Parent?: VirtualNode | null }, attrs?: VAttrs, ...children: VChild[])
    {
        if (typeof def === 'string')
        {
            this.__tag      = def.toLowerCase();
            this.__attrs    = { ...(attrs ?? {}) };
            this.__children = children.map(_normalizeChild);
            this.__text     = '';
        } else
        {
            this.__tag      = (def.Tag ?? 'div').toLowerCase();
            this.__attrs    = { ...(def.Attributes ?? {}) };
            this.__children = (def.Children ?? []).map(_normalizeChild);
            this.__text     = def.Text ?? '';
            this.__parent   = def.Parent ?? null;
        }
        this.__id = _vnUid();
        _vnNodes[this.__id] = this;
    }

    get Id()  { return this.__id; }
    get Tag() { return this.__tag; }
    get Dom() { return this.__dom; }

    __flush(): void
    {
        if (!this.__dom) return;
        for (const [k, v] of Object.entries(this.__changes))
        {
            const el = this.__dom as unknown as Record<string, unknown>;
            const u  = k.toUpperCase();
            if (u === 'TEXTCONTENT') { this.__dom.textContent = String(v); }
            else if (u === 'INNERHTML') { (this.__dom as HTMLElement).innerHTML = String(v); }
            else if (k in el) { el[k] = v; }
            else { this.__dom.setAttribute(k, String(v)); }
        }
        this.__changes = {};
    }

    render(): Element
    {
        if (this.__dom) { this.__flush(); return this.__dom; }
        const el = document.createElement(this.__tag);
        for (const [k, v] of Object.entries(this.__attrs))
        {
            if (v === null || v === false) continue;
            if (v === true) { el.setAttribute(k, ''); continue; }
            el.setAttribute(k, String(v));
        }
        if (this.__text) el.textContent = this.__text;
        for (const child of this.__children) el.appendChild(child.render());
        this.__dom = el; this.__mounted = true;
        for (const q of this.__domQueue) el.addEventListener(q.type, q.cb, q.opts);
        this.__domQueue = [];
        if (this.__pendingShadow) { const { state, mode, opts } = this.__pendingShadow; (el as HTMLElement).style.boxShadow = _shadowCSS(state, mode, opts); this.__pendingShadow = null; }
        return el;
    }

    valueOf(): Element { return this.render(); }

    on(type: string, cb: EventListener, opts?: AddEventListenerOptions): this
    {
        type.split(/\s+/).filter(Boolean).forEach(t =>
        {
            if (this.__dom) this.__dom.addEventListener(t, cb, opts);
            else            this.__domQueue.push({ type: t, cb, opts });
        });
        return this;
    }
    off(type: string, cb: EventListener, opts?: boolean | EventListenerOptions): this
    {
        type.split(/\s+/).filter(Boolean).forEach(t =>
        {
            this.__dom?.removeEventListener(t, cb, opts as EventListenerOptions);
            this.__domQueue = this.__domQueue.filter(q => !(q.type === t && q.cb === cb));
        });
        return this;
    }
    fire(type: string, init?: CustomEventInit): this
    {
        this.__dom?.dispatchEvent(new CustomEvent(type, { bubbles: true, ...init }));
        return this;
    }

    /** Lazy internal bus — only allocated on first busOn() call. */
    busOn(types: string, cb: (e: object) => void): this
    {
        if (!this.__bus) this.__bus = new Map();
        const ls = { Id: _vnUid(), Handler: cb, Target: this };
        types.split(/[\s,]+/).filter(Boolean).forEach(t =>
        {
            const s = this.__bus!.get(t) ?? new Set();
            s.add(ls); this.__bus!.set(t, s);
        });
        return this;
    }
    busOff(type: string, cb: (e: object) => void): this
    {
        this.__bus?.get(type)?.forEach(l =>
        {
            if (l.Handler === cb) this.__bus!.get(type)!.delete(l);
        });
        return this;
    }
    busFire(event: { Type: string; [k: string]: unknown }): this
    {
        if (!event?.Type || !this.__bus) return this;
        this.__bus.get(event.Type)?.forEach(l => l.Handler.call(l.Target, event));
        return this;
    }

    append(parent: string | Element | VirtualNode | { render(): Element }): this
    {
        const par = typeof parent === 'string' ? document.querySelector(parent)
            : parent instanceof VirtualNode ? parent.render()
            : typeof (parent as { render?: unknown }).render === 'function' ? (parent as { render(): Element }).render()
            : parent instanceof Element ? parent : null;
        if (par) { const el = this.render(); if (!par.contains(el)) par.appendChild(el); }
        return this;
    }

    mount(parent?: string | Element | VirtualNode | { render(): Element }): this
    {
        if (parent) return this.append(parent as never);
        this.render(); return this;
    }
    unmount(): this { this.__dom?.parentNode?.removeChild(this.__dom); this.__mounted = false; return this; }
    update():  this { this.__flush(); return this; }

    /**
     * Detach from DOM, release bus, remove from Instances.
     *
     * @example
     *   rows.forEach(r => r.destroy());
     */
    destroy(): void
    {
        this.__dom?.parentNode?.removeChild(this.__dom);
        this.__bus?.clear(); this.__bus = null;
        const idx = VirtualNode.Instances.indexOf(this);
        if (idx >= 0) VirtualNode.Instances.splice(idx, 1);
        delete _vnNodes[this.__id];
    }

    /**
     * Applica o rimuove un box-shadow sul VirtualNode.
     * Se non ancora montato, viene applicato al render() via __pendingShadow.
     * @example
     *   Virtual('div').shadow('open', 'glow', { color: '#e40c88', blur: 24 })
     *   Virtual('div').shadow('close')
     */
    shadow(state: ShadowState, mode: ShadowMode | ShadowLayer[] | Rule | Sheet = 'drop', opts: ShadowOptions = {}): this
    {
        if (this.__dom) (this.__dom as HTMLElement).style.boxShadow = _shadowCSS(state, mode, opts);
        else            this.__pendingShadow = { state, mode, opts };
        return this;
    }

    add(...args: (VChild | number)[]): this
    {
        const last   = args[args.length - 1];
        const hasIdx = typeof last === 'number';
        const items  = (hasIdx ? args.slice(0, -1) : args) as VChild[];
        const idx    = hasIdx ? (last as number) : undefined;
        const nodes  = items.map(_normalizeChild);
        if (idx !== undefined) this.__children.splice(idx, 0, ...nodes);
        else                   this.__children.push(...nodes);
        if (this.__dom)
        {
            const frag = document.createDocumentFragment();
            nodes.forEach(n => frag.appendChild(n.render()));
            const ref = idx !== undefined ? (this.__dom.children[idx] ?? null) : null;
            if (ref) this.__dom.insertBefore(frag, ref);
            else     this.__dom.appendChild(frag);
        }
        return this;
    }
    unshift(...nodes: VChild[]): this { return this.add(...nodes, 0); }
    push(...nodes: VChild[]): this    { return this.add(...nodes); }

    remove(...targets: (string | Element | VirtualNode | number)[]): this
    {
        for (const t of targets)
        {
            if (typeof t === 'number')         { const vn = this.__children[t]; if (vn) { this.__children.splice(t, 1); vn.__dom?.parentNode?.removeChild(vn.__dom); } }
            else if (t instanceof VirtualNode) { const i = this.__children.indexOf(t); if (i >= 0) { this.__children.splice(i, 1); t.__dom?.parentNode?.removeChild(t.__dom); } }
            else if (typeof t === 'string')    { const el = this.__dom?.querySelector(t); if (el) { el.parentNode?.removeChild(el); this.__children = this.__children.filter(c => c.__dom !== el); } }
            else if (t instanceof Element)     { t.parentNode?.removeChild(t); this.__children = this.__children.filter(c => c.__dom !== t); }
        }
        return this;
    }
    shift(n = 1): this { for (let i = 0; i < n; i++) { const vn = this.__children.shift(); if (vn) vn.__dom?.parentNode?.removeChild(vn.__dom); } return this; }
    pop(n = 1):   this { for (let i = 0; i < n; i++) { const vn = this.__children.pop();   if (vn) vn.__dom?.parentNode?.removeChild(vn.__dom); } return this; }

    get(name: string): string | undefined
    {
        const u = name.toUpperCase();
        const k = Object.keys(this.__attrs).find(k2 => k2.toUpperCase() === u);
        if (k !== undefined) return String(this.__attrs[k] ?? '');
        if (this.__dom) { const a = this.__dom.getAttribute(name); if (a !== null) return a; const p = (this.__dom as unknown as Record<string, unknown>)[name]; if (p !== undefined) return String(p); }
        return undefined;
    }

    set(name: string, value: string): this
    {
        const u   = name.toUpperCase();
        const key = Object.keys(this.__attrs).find(k => k.toUpperCase() === u) ?? name;
        this.__attrs[key] = value;
        if (this.__dom)
        {
            const el = this.__dom as unknown as Record<string, unknown>;
            if (u === 'TEXTCONTENT') { this.__dom.textContent = value; return this; }
            if (u === 'INNERHTML')   { this.__dom.innerHTML   = value; return this; }
            if (name in el) el[name] = value; else this.__dom.setAttribute(name, value);
        } else { this.__changes[name] = value; }
        return this;
    }

    /**
     * Apply partial updates from a plain data object.
     *
     * @example
     *   row.patch({ textContent: newLabel, 'data-id': String(id) });
     */
    patch(data: Record<string, string>): this
    {
        for (const [k, v] of Object.entries(data)) this.set(k, v);
        return this;
    }

    css(prop: string, value: string): this
    {
        if (this.__dom instanceof HTMLElement)
        {
            if (prop.startsWith('--')) this.__dom.style.setProperty(prop, value);
            else (this.__dom.style as unknown as Record<string, string>)[prop] = value;
        } else
        {
            const kebab = prop.startsWith('--') ? prop : prop.replace(/([A-Z])/g, m => '-' + m.toLowerCase());
            const cur   = String(this.__attrs['style'] ?? '');
            this.__attrs['style'] = cur.replace(new RegExp(`${kebab}\\s*:[^;]+;?`, 'i'), '') + `;${kebab}:${value}`;
        }
        return this;
    }

    show(): this { const el = this.render(); if (el instanceof HTMLElement) el.style.display = '';     return this; }
    hide(): this { const el = this.render(); if (el instanceof HTMLElement) el.style.display = 'none'; return this; }

    contains(...nodes: (Element | VirtualNode | string)[]): boolean
    {
        for (const n of nodes)
        {
            if (n instanceof VirtualNode) { if (!this.__children.some(c => c.__id === n.__id)) return false; }
            else if (n instanceof Element) { if (!this.__children.some(c => c.__dom === n))    return false; }
            else if (typeof n === 'string') { if (!this.__dom?.querySelector(n))               return false; }
        }
        return true;
    }
    log(v?: unknown): this { console.log(v ?? (this.__dom ?? { tag: this.__tag, attrs: this.__attrs })); return this; }

    clone(): VirtualNode
    {
        const c = new VirtualNode(this.__tag, { ...this.__attrs });
        for (const ch of this.__children) c.add(ch.clone());
        return c;
    }

    parse(el: Element): this
    {
        this.__tag = el.tagName.toLowerCase(); this.__dom = el; this.__mounted = true; this.__attrs = {};
        for (let i = 0; i < el.attributes.length; i++) { const a = el.attributes.item(i)!; this.__attrs[a.name] = a.value; }
        this.__children = [];
        for (const child of Array.from(el.childNodes))
        {
            if (child.nodeType === Node.ELEMENT_NODE)     { const vn = new VirtualNode((child as Element).tagName.toLowerCase()); vn.parse(child as Element); this.__children.push(vn); }
            else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) { const vn = new VirtualNode('span'); vn.set('textContent', child.textContent ?? ''); this.__children.push(vn); }
        }
        return this;
    }

    compare(b: VirtualNode): object { return VirtualNode.Compare(this, b); }

    static Compare(a: VirtualNode, b: VirtualNode): object
    {
        const allKeys = new Set([...Object.keys(a.__attrs), ...Object.keys(b.__attrs)]);
        const attrsAdded: VAttrs = {}, attrsRemoved: string[] = [], attrsChanged: VAttrs = {};
        for (const k of allKeys)
        {
            if (!(k in a.__attrs))                                attrsAdded[k]   = b.__attrs[k]!;
            else if (!(k in b.__attrs))                           attrsRemoved.push(k);
            else if (String(a.__attrs[k]) !== String(b.__attrs[k])) attrsChanged[k] = b.__attrs[k]!;
        }
        const childDiffs: object[] = [];
        for (let i = 0; i < Math.max(a.__children.length, b.__children.length); i++)
            if (a.__children[i] && b.__children[i])
                childDiffs.push(VirtualNode.Compare(a.__children[i], b.__children[i]));
        return { tagChanged: a.__tag !== b.__tag, attrsAdded, attrsRemoved, attrsChanged, textChanged: a.__text !== b.__text, childDiffs };
    }

    static Create(tag: string, attrs?: VAttrs, ...children: VChild[]): VirtualNode { return new VirtualNode(tag, attrs, ...children); }
    static Clone(node: VirtualNode): VirtualNode { return node.clone(); }
    static Parse(el: Element): VirtualNode       { return new VirtualNode(el.tagName.toLowerCase()).parse(el); }
}

// ── Virtual factory + Pool ────────────────────────────────────────────────────

type VTarget = string | Element | VirtualNode | { render(): Element };

function _vFactory(this: unknown, arg0: VTarget, arg1?: VAttrs | (new (...a: unknown[]) => Element), arg2?: new (...a: unknown[]) => Element, ...rest: VChild[]): VirtualNode
{
    if (arg0 instanceof VirtualNode) return arg0;
    if (typeof arg0 === 'string' && typeof arg1 === 'function' && arg2 !== undefined) { Core.Define(arg0, arg1 as new () => Element, arg2); return new VirtualNode(arg0); }
    if (typeof arg0 === 'string' && (arg0.startsWith('#') || arg0.startsWith('.'))) { const found = document.querySelector(arg0); if (found) return new VirtualNode(found.tagName.toLowerCase()).parse(found); }
    if (typeof arg0 === 'string') { const attrs = arg1 && typeof arg1 !== 'function' ? arg1 as VAttrs : undefined; return new VirtualNode(arg0, attrs, ...rest); }
    if (typeof (arg0 as { render?: unknown }).render === 'function') { const el = (arg0 as { render(): Element }).render(); return new VirtualNode(el.tagName.toLowerCase()).parse(el); }
    if (arg0 instanceof Element) return new VirtualNode(arg0.tagName.toLowerCase()).parse(arg0);
    return new VirtualNode('div');
}

Object.setPrototypeOf(_vFactory, Function.prototype);
(_vFactory as Function).prototype = VirtualNode.prototype;

const _virtualStatics = {
    Nodes         : _vnNodes,
    Instances     : VirtualNode.Instances,
    Root          : null as VirtualNode | null,
    get Uuid()    { return _vnUid(); },
    trackInstance : VirtualNode.trackInstance,

    Create(tag: string, attrs?: VAttrs, ...children: VChild[]) { return new VirtualNode(tag, attrs, ...children); },
    Mount(node: VirtualNode, parent: string | Element | VirtualNode) { return node.append(parent as never); },
    Unmount(node: VirtualNode) { return node.unmount(); },
    Render(node: VirtualNode, parent?: Element) { const el = node.render(); if (parent) parent.appendChild(el); return el; },
    Parse(el: Element)               { return VirtualNode.Parse(el); },
    Clone(node: VirtualNode)         { return node.clone(); },
    Compare(a: VirtualNode, b: VirtualNode) { return VirtualNode.Compare(a, b); },
    Define(tag: string, ctor: new (...a: unknown[]) => Element, base: new (...a: unknown[]) => Element = HTMLElement, style: Record<string, string> = {}) { return Core.Define(tag, ctor, base, style); },

    /**
     * Non-keyed VDOM pool — pre-allocate and reuse nodes.
     * Primary optimization for Krause 09_clear_x8 benchmark.
     *
     * @example
     *   const pool = Virtual.Pool.create(1000, i => Virtual('tr', {}, Virtual('td', {}, '')));
     *   Virtual.Pool.mount(pool, tbody);
     *   Virtual.Pool.clear(pool, tbody);
     */
    Pool: {
        create(n: number, template: (i: number) => VirtualNode): VirtualNode[]
        {
            const nodes: VirtualNode[] = new Array(n);
            for (let i = 0; i < n; i++) nodes[i] = template(i);
            return nodes;
        },
        update<T>(pool: VirtualNode[], data: T[], patcher: (node: VirtualNode, item: T, i: number) => void, template?: (i: number) => VirtualNode): void
        {
            for (let i = 0; i < data.length; i++)
            {
                if (i < pool.length) patcher(pool[i], data[i], i);
                else if (template) { const n = template(i); patcher(n, data[i], i); pool.push(n); }
            }
        },
        mount(pool: VirtualNode[], container: Element): void
        {
            const frag = document.createDocumentFragment();
            for (let i = 0; i < pool.length; i++) frag.appendChild(pool[i].render());
            container.appendChild(frag);
        },
        clear(pool: VirtualNode[], container?: Element): void
        {
            if (container)
            {
                if (typeof (container as Element & { replaceChildren?(): void }).replaceChildren === 'function')
                    (container as Element & { replaceChildren(): void }).replaceChildren();
                else
                    container.textContent = '';
            } else
            {
                for (let i = 0; i < pool.length; i++) pool[i].unmount();
            }
        },
        destroy(pool: VirtualNode[]): void { for (let i = 0; i < pool.length; i++) pool[i].destroy(); pool.length = 0; },
    },
};

Object.assign(_vFactory, _virtualStatics);

export type VirtualCallable = {
    (arg0: VTarget, attrs?: VAttrs, ...children: VChild[]): VirtualNode;
    new (arg0: VTarget, attrs?: VAttrs, ...children: VChild[]): VirtualNode;
    prototype: typeof VirtualNode.prototype;
} & typeof _virtualStatics;

export const Virtual = _vFactory as unknown as VirtualCallable;
try { Object.defineProperty(window, 'Virtual', { value: Virtual, writable: false, enumerable: false, configurable: false }); } catch {}

// ── Directive ─────────────────────────────────────────────────────────────────

type DirectiveDef = { mounted(el: Element, value?: unknown): void; unmounted?(el: Element): void };
const _directives = new Map<string, DirectiveDef>();

function _resolveEl(el: Element | Real | VirtualNode | string): Element | null
{
    if (typeof el === 'string')    return document.querySelector(el);
    if (el instanceof Real)        return el.render();
    if (el instanceof VirtualNode) return el.render();
    if (el instanceof Element)     return el;
    return null;
}

export const Directive = {
    if(el: Element | Real | VirtualNode, cond: () => boolean, thenHtml: string, elseHtml = ''): () => void
    {
        const e = _resolveEl(el)!;
        const update = () => { e.innerHTML = cond() ? thenHtml : elseHtml; };
        update(); return update;
    },
    for<T>(el: Element | Real | VirtualNode, items: () => T[], tpl: (item: T, i: number) => string): () => void
    {
        const e = _resolveEl(el)!;
        const update = () => { e.innerHTML = items().map((item, i) => tpl(item, i)).join(''); };
        update(); return update;
    },
    foreach<T extends object>(el: Element | Real | VirtualNode, obj: () => T, tpl: (key: string, value: unknown) => string): void
    {
        _resolveEl(el)!.innerHTML = Object.entries(obj()).map(([k, v]) => tpl(k, v)).join('');
    },
    while(el: Element | Real | VirtualNode, cond: () => boolean, body: () => string): void
    {
        const e = _resolveEl(el)!;
        const parts: string[] = [];
        while (cond()) parts.push(body());
        e.innerHTML = parts.join('');
    },
    switch<T extends string>(el: Element | Real | VirtualNode, val: () => T, cases: Record<string, string>): () => void
    {
        const e = _resolveEl(el)!;
        const update = () => { const v = val(); e.innerHTML = cases[v] !== undefined ? cases[v] : (cases['default'] ?? ''); };
        update(); return update;
    },
    bind(el: Element | Real | VirtualNode, prop: string, source: () => unknown): () => void
    {
        const e = _resolveEl(el) as unknown as Record<string, unknown>;
        const update = () => { e[prop] = source(); };
        update(); return update;
    },
    model(el: Element | Real | VirtualNode, state: State, key: string): () => void
    {
        const input = _resolveEl(el) as HTMLInputElement;
        input.value = String((state.State as Record<string, unknown>)[key] ?? '');
        input.addEventListener('input', () => { (state.State as Record<string, unknown>)[key] = input.value; });
        return () => { input.value = String((state.State as Record<string, unknown>)[key] ?? ''); };
    },
    show(el: Element | Real | VirtualNode, cond: () => boolean): () => void
    {
        const e = _resolveEl(el) as HTMLElement;
        const update = () => { e.style.display = cond() ? '' : 'none'; };
        update(); return update;
    },
    on(el: Element | Real | VirtualNode, types: string, cb: EventListener, opts?: AddEventListenerOptions): void
    {
        const e = _resolveEl(el)!;
        types.split(/\s+/).filter(Boolean).forEach(t => e.addEventListener(t, cb, opts));
    },
    template(el: Element | Real | VirtualNode, scope: Record<string, unknown>): void
    {
        const e = _resolveEl(el)!;
        e.innerHTML = e.innerHTML.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (_, path: string) =>
        {
            try
            {
                const parts = path.replace(/\[(\w+)\]/g, '.$1').split('.');
                let val: unknown = scope;
                for (const p of parts) val = (val as Record<string, unknown>)[p];
                return val !== undefined ? String(val) : '';
            } catch { return ''; }
        });
    },
    register(name: string, def: DirectiveDef): void { _directives.set(name, def); },
    apply(name: string, el: Element | Real | VirtualNode, value?: unknown): void
    {
        const d = _directives.get(name);
        if (!d) return;
        d.mounted(_resolveEl(el)!, value);
    },
    bootstrap(root: Element | Real | VirtualNode | string, scope: Record<string, unknown>): void
    {
        const r = _resolveEl(root as never)!;
        if (!r) return;
        r.querySelectorAll('[a-if]').forEach(el =>
        {
            const cond = () => !!scope[el.getAttribute('a-if')!];
            const next = el.nextElementSibling;
            const hasElse = next?.hasAttribute('a-else');
            (el as HTMLElement).style.display = cond() ? '' : 'none';
            if (hasElse) (next as HTMLElement).style.display = cond() ? 'none' : '';
        });
        r.querySelectorAll('[a-show]').forEach(el =>
        {
            (el as HTMLElement).style.display = !!scope[el.getAttribute('a-show')!] ? '' : 'none';
        });
        r.querySelectorAll('[a-for]').forEach(el =>
        {
            const expr  = el.getAttribute('a-for')!;
            const match = expr.match(/^(\w+)(?:,\s*(\w+))?\s+in\s+(\w+)$/);
            if (!match) return;
            const [, itemVar,, arrKey] = match;
            const tpl = el.innerHTML;
            const arr = (scope[arrKey] as unknown[]) ?? [];
            el.innerHTML = arr.map((item, i) =>
                tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
                    k === itemVar ? String(item) : k === 'i' ? String(i) : String((item as Record<string, unknown>)[k] ?? ''))
            ).join('');
        });
        r.querySelectorAll('[a-switch]').forEach(container =>
        {
            const val = String(scope[container.getAttribute('a-switch')!] ?? '');
            container.querySelectorAll('[a-case]').forEach(branch =>
            {
                (branch as HTMLElement).style.display = branch.getAttribute('a-case') === val ? '' : 'none';
            });
        });
        r.querySelectorAll('[a-model]').forEach(el =>
        {
            const key   = el.getAttribute('a-model')!;
            const input = el as HTMLInputElement;
            const parts = key.split('.');
            const getVal = () => { let v: unknown = scope; for (const p of parts) v = (v as Record<string, unknown>)[p]; return v; };
            const setVal = (val: unknown) => { let v: unknown = scope; for (let i = 0; i < parts.length - 1; i++) v = (v as Record<string, unknown>)[parts[i]]; (v as Record<string, unknown>)[parts[parts.length - 1]] = val; };
            input.value = String(getVal() ?? '');
            input.addEventListener('input', () => setVal(input.value));
        });
        r.querySelectorAll('[a-bind]').forEach(el =>
        {
            const [prop, key] = el.getAttribute('a-bind')!.split(':');
            if (!prop || !key) return;
            let val: unknown = scope;
            for (const p of key.split('.')) val = (val as Record<string, unknown>)[p];
            (el as unknown as Record<string, unknown>)[prop.trim()] = val;
        });
        r.querySelectorAll('[a-on]').forEach(el =>
        {
            const [types, handlerKey] = el.getAttribute('a-on')!.split(':');
            if (!types || !handlerKey) return;
            const handler = scope[handlerKey.trim()];
            if (typeof handler === 'function')
                types.split(/\s+/).filter(Boolean).forEach(t => el.addEventListener(t, handler as EventListener));
        });
        const walk = (node: Node) =>
        {
            if (node.nodeType === Node.TEXT_NODE)
            {
                const orig = node.textContent ?? '';
                if (orig.includes('{{'))
                    node.textContent = orig.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (_, path: string) =>
                    {
                        try
                        {
                            const parts = path.replace(/\[(\w+)\]/g, '.$1').split('.');
                            let val: unknown = scope;
                            for (const p of parts) val = (val as Record<string, unknown>)[p];
                            return val !== undefined ? String(val) : '';
                        } catch { return ''; }
                    });
            } else if (node.nodeType === Node.ELEMENT_NODE)
            {
                if (!(node as Element).hasAttribute('a-for') && !(node as Element).hasAttribute('a-switch'))
                    Array.from(node.childNodes).forEach(walk);
            }
        };
        Array.from(r.childNodes).forEach(walk);
    },
};

try { Object.defineProperty(window, 'Directive', { value: Directive, writable: false, enumerable: false, configurable: false }); } catch {}

// ── Rule ──────────────────────────────────────────────────────────────────────

export class Rule
{
    __selector : string;
    __props    : Record<string, string>;

    constructor(selectorOrDef: string | { Selector: string; Contents: Record<string, string> }, contents?: Record<string, string> | string)
    {
        if (typeof selectorOrDef === 'object')
        {
            this.__selector = selectorOrDef.Selector;
            this.__props    = selectorOrDef.Contents;
        } else
        {
            this.__selector = selectorOrDef;
            this.__props    = typeof contents === 'string'
                ? Object.fromEntries(contents.split(';').filter(Boolean).map(p =>
                {
                    const [k, ...v] = p.split(':');
                    return [k.trim(), v.join(':').trim()];
                }))
                : (contents ?? {});
        }
    }

    get Selector() { return this.__selector; }
    get Text(): string
    {
        const body = Object.entries(this.__props)
            .map(([k, v]) => `${k.replace(/([A-Z])/g, m => '-' + m.toLowerCase())}:${v}`)
            .join(';');
        return `${this.__selector}{${body}}`;
    }
    get(k: string): string | undefined { return this.__props[k]; }
    set(k: string, v: string): this    { this.__props[k] = v; return this; }
    remove(k: string): this            { delete this.__props[k]; return this; }
    merge(other: Rule): this           { Object.assign(this.__props, other.__props); return this; }
    clone(): Rule                      { return new Rule(this.__selector, { ...this.__props }); }
}

try { Object.defineProperty(window, 'Rule', { value: Rule, writable: false, enumerable: false, configurable: false }); } catch {}

// ── Sheet (Stylesheet) ────────────────────────────────────────────────────────

export class Sheet
{
    __rules : Rule[] = [];
    __style : HTMLStyleElement | null = null;

    constructor(...rules: Rule[]) { this.__rules = [...rules]; }

    get Length() { return this.__rules.length; }
    get Text()   { return this.__rules.map(r => r.Text).join('\n'); }

    add(rule: Rule, index?: number): this
    {
        index !== undefined ? this.__rules.splice(index, 0, rule) : this.__rules.push(rule);
        this.__sync(); return this;
    }
    remove(rule: Rule): this  { this.__rules = this.__rules.filter(r => r !== rule); this.__sync(); return this; }
    shift(n = 1): this        { this.__rules.splice(0, n); this.__sync(); return this; }
    pop(n = 1): this          { this.__rules.splice(-n, n); this.__sync(); return this; }
    clear(): this             { this.__rules = []; this.__sync(); return this; }
    contains(r: Rule): boolean { return this.__rules.includes(r); }
    getIndex(r: Rule): number  { return this.__rules.indexOf(r); }

    inject(target = document.head): this
    {
        if (!this.__style)
        {
            this.__style = document.createElement('style');
            target.appendChild(this.__style);
        }
        this.__sync(); return this;
    }
    __sync(): void { if (this.__style) this.__style.textContent = this.Text; }
}

export { Sheet as Stylesheet };
try { Object.defineProperty(window, 'Sheet', { value: Sheet, writable: false, enumerable: false, configurable: false }); } catch {}

// ── Context ───────────────────────────────────────────────────────────────────

interface _CtxRecord<T> { value: T | undefined; providers: Set<Element>; consumers: Set<_CtxConsumer<T>>; }
interface _CtxConsumer<T> { id: string; element: Element; events: Map<string, Set<(e: object) => void>>; }
const _ctxRegistry = new Map<string, _CtxRecord<unknown>>();

function _ctxGet<T>(key: string): _CtxRecord<T>
{
    if (!_ctxRegistry.has(key)) _ctxRegistry.set(key, { value: undefined, providers: new Set(), consumers: new Set() });
    return _ctxRegistry.get(key) as _CtxRecord<T>;
}

export class Context<T = unknown>
{
    readonly #key : string;
    readonly #rec : _CtxRecord<T>;

    constructor(key: string, value?: T) { this.#key = key; this.#rec = _ctxGet<T>(key); if (value !== undefined) this.#rec.value = value; }

    get key(): string   { return this.#key; }
    get value(): T | undefined { return this.#rec.value; }

    provide(element: Element): this
    {
        this.#rec.providers.add(element);
        element.addEventListener('arianna-wip:context-request', (e: Event) =>
        {
            const ce = e as CustomEvent<{ key: string; resolve: (v: unknown) => void }>;
            if (ce.detail.key === this.#key) { ce.stopPropagation(); ce.detail.resolve(this.#rec.value); }
        });
        return this;
    }

    update(value: T): this
    {
        const old = this.#rec.value;
        if (old === value) return this;
        this.#rec.value = value;
        const ev = { Type: 'Context-Changed', Key: this.#key, Value: value, Old: old };
        for (const c of this.#rec.consumers)
        {
            const b = c.events.get('Context-Changed');
            if (b) for (const cb of b) cb(ev);
        }
        return this;
    }

    destroy(): void { this.#rec.providers.clear(); this.#rec.consumers.clear(); _ctxRegistry.delete(this.#key); }

    static consume<T>(key: string, element: Element): { value: T | undefined; on(types: string, cb: (e: object) => void): void; off(type: string, cb: (e: object) => void): void; detach(): void }
    {
        const rec = _ctxGet<T>(key);
        const cr: _CtxConsumer<T> = { id: uuid(), element, events: new Map() };
        rec.consumers.add(cr);
        let resolved = false;
        element.dispatchEvent(new CustomEvent('arianna-wip:context-request',
        {
            bubbles  : true,
            composed : true,
            detail   : { key, resolve: (v: unknown) => { if (!resolved) { resolved = true; rec.value = v as T; } } },
        }));
        return {
            get value() { return rec.value; },
            on(types: string, cb: (e: object) => void)
            {
                types.split(/\s+|,|\|/g).filter(Boolean).forEach(t =>
                {
                    const b = cr.events.get(t) ?? new Set();
                    b.add(cb); cr.events.set(t, b);
                });
            },
            off(type: string, cb: (e: object) => void) { cr.events.get(type)?.delete(cb); },
            detach() { rec.consumers.delete(cr); },
        };
    }

    static has(key: string, element: Element): boolean
    {
        let found = false;
        element.dispatchEvent(new CustomEvent('arianna-wip:context-request',
            { bubbles: true, composed: true, detail: { key, resolve: () => { found = true; } } }));
        return found;
    }

    static keys(): string[] { return Array.from(_ctxRegistry.keys()); }
}

try { Object.defineProperty(window, 'Context', { value: Context, writable: false, enumerable: false, configurable: false }); } catch {}

// ── Default export ────────────────────────────────────────────────────────────

export default {
    version,
    Core,
    Observable,
    State,
    Real,
    Virtual,
    VirtualNode,
    Directive,
    Rule,
    Sheet,
    Stylesheet : Sheet,
    Context,
};
