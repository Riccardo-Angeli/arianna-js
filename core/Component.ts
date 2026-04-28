/**
 * @module    Component
 * @author    Riccardo Angeli
 * @version   1.2.0
 * @copyright Riccardo Angeli 2012-2026
 *
 * Component — dual-mode AriannA component system.
 * Dedicated with love to Arianna. ♡
 *
 * Fine-grain Signal+Sink — same fluent API as Real and Virtual.
 *
 *   .text(getter)     → reactive TextNode Sink
 *   .attr(name, g)    → Attribute Sink
 *   .cls(name, g)     → Class Sink
 *   .prop(name, g)    → Property Sink
 *   .style(prop, g)   → Style Sink
 *   .bind(g, s?)      → Two-way binding
 *   .destroy()        → deregister all Effects
 *
 * @Prop() uses signal() internally — every prop becomes a Signal.
 * @Watch and Effects reading that prop react granularly without
 * re-rendering the entire component.
 *
 * @example
 *   const title = signal('hello');
 *   new Component('h1')
 *     .text(() => title.get())
 *     .append(document.body);
 *   title.set('world');   // only the TextNode updates
 *
 * @example
 *   @ComponentDecorator({ tag: 'my-card' })
 *   class MyCard extends HTMLElement {
 *     @Prop() name = '';
 *     @Ref()  nameEl!: HTMLSpanElement;
 *
 *     @Watch('name')
 *     onName(next: string) {
 *       if (this.nameEl) this.nameEl.textContent = next;
 *     }
 *   }
 */

import Real, { type ShadowState, type ShadowMode, type ShadowLayer, type ShadowOptions } from './Real.ts';
import { VirtualNode } from './Virtual.ts';
import Core            from './Core.ts';
import { signal }      from './Observable.ts';
import type { Signal } from './Observable.ts';

// ── Types ──────────────────────────────────────────────────────────────────────

export type RenderMode = 'real' | 'virtual';

export interface ComponentOptions extends Record<string, unknown>
{
    mode?: RenderMode;
}

type ComponentTarget =
    | string
    | Element
    | Real
    | VirtualNode
    | { render(): Element };

type Delegate = Real | VirtualNode;
type Getter<T> = () => T;

// ── Component class ────────────────────────────────────────────────────────────

export class Component
{
    readonly #delegate : Delegate;
    readonly mode      : RenderMode;

    static readonly Instances: Component[] = [];

    constructor(
        arg0       : ComponentTarget,
        arg1?      : ComponentOptions | Record<string, unknown>,
        ...children: unknown[]
    )
    {
        const opts  = (arg1 ?? {}) as ComponentOptions;
        const mode  : RenderMode              = (opts.mode as RenderMode) ?? 'real';
        const attrs : Record<string, unknown> = { ...opts };
        delete attrs['mode'];

        this.mode = mode;

        if (mode === 'virtual') {
            // FIX: VirtualNode is a class — always use `new`, never call directly
            this.#delegate = arg0 instanceof VirtualNode
                ? arg0
                : new VirtualNode(
                    arg0 as string,
                    attrs as Record<string, string>,
                    ...(children as never[]),
                  );
        } else {
            this.#delegate = arg0 instanceof VirtualNode
                ? new Real(arg0.render())
                : new Real(arg0 as never, attrs as never, ...children as never[]);
        }

        Component.Instances.push(this);
    }

    // ── Core API ──────────────────────────────────────────────────────────────

    render(): Element       { return this.#delegate.render(); }
    valueOf(): Element      { return this.render(); }
    log(v?: unknown): this  { this.#delegate.log(v); return this; }

    on(type: string, cb: EventListener, opts?: AddEventListenerOptions): this
    { this.#delegate.on(type, cb, opts); return this; }

    off(type: string, cb: EventListener, opts?: boolean | EventListenerOptions): this
    { this.#delegate.off(type, cb, opts as never); return this; }

    fire(type: string, init?: CustomEventInit): this
    { this.#delegate.fire(type, init); return this; }

    append(parent: string | Element | Component | VirtualNode | { render(): Element }): this
    {
        const target = parent instanceof Component ? parent.render() : parent;
        this.#delegate.append(target as never);
        return this;
    }

    add(...args: (Component | Element | VirtualNode | string | number)[]): this
    {
        const normalized = args.map(a => a instanceof Component ? a.render() : a);
        (this.#delegate.add as (...a: unknown[]) => unknown)(...normalized);
        return this;
    }

    unshift(...nodes: (Component | Element | VirtualNode | string)[]): this
    { return this.add(...nodes, 0); }

    push(...nodes: (Component | Element | VirtualNode | string)[]): this
    { return this.add(...nodes); }

    remove(...targets: (Component | Element | VirtualNode | string | number)[]): this
    {
        const normalized = targets.map(t => t instanceof Component ? t.render() : t);
        (this.#delegate.remove as (...a: unknown[]) => unknown)(...normalized);
        return this;
    }

    shift(n = 1): this { this.#delegate.shift(n); return this; }
    pop(n = 1):   this { this.#delegate.pop(n);   return this; }

    get(name: string): string | undefined
    { return this.#delegate.get(name) ?? undefined; }

    set(name: string, value: string): this
    { this.#delegate.set(name, value); return this; }

    show(): this { this.#delegate.show(); return this; }
    hide(): this { this.#delegate.hide(); return this; }

    /**
     * Returns true if the rendered element contains all given nodes.
     * FIX: implemented directly on the DOM element — Real/VirtualNode
     * do not expose a .contains() method.
     */
    contains(...nodes: (Component | Element | VirtualNode | string)[]): boolean
    {
        const root = this.render();
        return nodes.every(n => {
            if (n instanceof Component)   return root.contains(n.render());
            if (n instanceof VirtualNode) return root.contains(n.render());
            if (n instanceof Element)     return root.contains(n);
            if (typeof n === 'string')    return !!root.querySelector(n);
            return false;
        });
    }

    css(prop: string, value: string): this
    {
        const el = this.render();
        // FIX: double-cast via `unknown` to satisfy TS2352
        if (el instanceof HTMLElement)
            (el.style as unknown as Record<string, string>)[prop] = value;
        return this;
    }

    // ── Fine-grain Signal+Sink API ─────────────────────────────────────────────

    text(getter: Getter<string>): this
    { (this.#delegate as Real & VirtualNode).text(getter); return this; }

    attr(name: string, getter: Getter<string | null>): this
    { (this.#delegate as Real & VirtualNode).attr(name, getter); return this; }

    cls(name: string, getter: Getter<boolean>): this
    { (this.#delegate as Real & VirtualNode).cls(name, getter); return this; }

    prop(name: string, getter: Getter<unknown>): this
    { (this.#delegate as Real & VirtualNode).prop(name, getter); return this; }

    style(prop: string, getter: Getter<string>): this
    { (this.#delegate as Real & VirtualNode).style(prop, getter); return this; }

    bind(getter: Getter<string>, setter?: (v: string) => void): this
    { (this.#delegate as Real & VirtualNode).bind(getter, setter); return this; }

    destroy(): this
    { (this.#delegate as Real & VirtualNode).destroy(); return this; }

    /**
     * Applica o rimuove un box-shadow delegando a Real / VirtualNode.
     * @example
     *   new Component('div').shadow('open', 'glow', { color: '#e40c88', blur: 24 })
     *   new Component('div').shadow('close')
     */
    shadow(state: ShadowState, mode: ShadowMode | ShadowLayer[] = 'drop', opts: ShadowOptions = {}): this
    { (this.#delegate as Real & VirtualNode).shadow(state, mode as never, opts); return this; }

    // ── Static API ────────────────────────────────────────────────────────────

    static Define(
        tag   : string,
        ctor  : new (...a: unknown[]) => Element,
        base  : new (...a: unknown[]) => Element = HTMLElement,
        style : Record<string, string>           = {},
    )
    {
        return Core.Define(tag, ctor, base, style);
    }

    static get Namespaces() { return Core.Namespaces; }
}

// ── Callable factory ──────────────────────────────────────────────────────────
// Allows both `new Component(...)` and `Component(...)` call patterns
// without relying on Reflect.construct (which requires ES2015+ lib).

function _cFactory(
    this  : unknown,
    arg0  : ComponentTarget,
    arg1? : ComponentOptions | Record<string, unknown>,
    ...rest: unknown[]
): Component
{
    return new Component(arg0, arg1, ...rest);
}

Object.defineProperties(_cFactory, {
    prototype : { value: Component.prototype, writable: false },
    name      : { value: 'Component' },
});

// ── Decorator: @ComponentDecorator({ tag, mode? }) ────────────────────────────
// FIX: was named `ComponentDecorator` locally but exported as `Component`,
// causing TS2323 (redeclare) and TS2484 (export conflict).
// Now exported under its real name `ComponentDecorator`.

export function ComponentDecorator(opts: {
    tag      : string;
    mode?    : RenderMode;
    extends? : string;
})
{
    return function <T extends new (...a: unknown[]) => HTMLElement>(ctor: T): T
    {
        Core.Define(opts.tag, ctor as unknown as new () => Element, HTMLElement);
        return ctor;
    };
}

// ── Decorator: @Prop() ────────────────────────────────────────────────────────

/**
 * Reactive property backed by a Signal.
 *
 * Each prop becomes an internal Signal<T>.
 * Effects and @Watch handlers reading this prop react granularly.
 * Dispatches 'prop-change' CustomEvent for external observers.
 *
 * @example
 *   @Prop() count = 0;
 */
export function Prop()
{
    return function (target: object, key: string): void
    {
        const sigKey = `__sig_${key}__`;

        Object.defineProperty(target, key, {
            get(this: Record<string, unknown>)
            {
                if (!this[sigKey]) this[sigKey] = signal<unknown>(undefined);
                return (this[sigKey] as Signal<unknown>).get();
            },
            set(
                this: HTMLElement
                    & Record<string, unknown>
                    & { render?: () => string; _root?: Element },
                v: unknown,
            )
            {
                if (!this[sigKey]) this[sigKey] = signal<unknown>(undefined);
                const sig  = this[sigKey] as Signal<unknown>;
                const prev = sig.peek();
                if (Object.is(prev, v)) return;

                sig.set(v);

                const watchKey = `__watch_${key}__`;
                const watchers = this[watchKey];
                if (Array.isArray(watchers))
                    (watchers as Array<(n: unknown, p: unknown) => void>)
                        .forEach(fn => fn.call(this, v, prev));

                if (typeof (this as { render?: () => string }).render === 'function') {
                    const html = (this as { render(): string }).render();
                    if (this._root)                    this._root.innerHTML = html;
                    else if (typeof html === 'string') this.innerHTML       = html;
                    _resolveRefs(this);
                }

                this.dispatchEvent(new CustomEvent('prop-change', {
                    detail: { key, value: v, prev }, bubbles: true,
                }));
            },
            enumerable  : true,
            configurable: true,
        });
    };
}

/**
 * Access the raw Signal of a @Prop for fine-grain Effect wiring.
 *
 * @example
 *   const sig = PropSignal.of(this, 'name');
 *   effect(() => { nameNode.nodeValue = sig.get(); });
 */
export const PropSignal = {
    of<T>(instance: Record<string, unknown>, key: string): Signal<T> | undefined {
        return instance[`__sig_${key}__`] as Signal<T> | undefined;
    },
};

// ── Decorator: @Watch(key) ────────────────────────────────────────────────────

export function Watch(key: string)
{
    return function (
        target     : object,
        _methodKey : string,
        descriptor : PropertyDescriptor,
    ): PropertyDescriptor
    {
        const original = descriptor.value as (next: unknown, prev: unknown) => void;
        const watchKey = `__watch_${key}__`;
        const proto    = target as Record<string, unknown[]>;
        if (!proto[watchKey]) proto[watchKey] = [];
        proto[watchKey].push(function (this: unknown, next: unknown, prev: unknown) {
            original.call(this, next, prev);
        });
        return descriptor;
    };
}

// ── Decorator: @Emit(event?) ──────────────────────────────────────────────────

export function Emit(eventName?: string)
{
    return function (
        target     : object,
        methodKey  : string,
        descriptor : PropertyDescriptor,
    ): PropertyDescriptor
    {
        const original = descriptor.value as (...args: unknown[]) => unknown;
        descriptor.value = function (this: HTMLElement, ...args: unknown[]) {
            const result = original.apply(this, args);
            const name   = eventName ?? methodKey;
            // FIX: type the Promise.then callback explicitly (TS7044)
            if (result instanceof Promise)
                void result.then((v: unknown) =>
                    this.dispatchEvent(new CustomEvent(name, { detail: v, bubbles: true })));
            else
                this.dispatchEvent(new CustomEvent(name, { detail: result, bubbles: true }));
            return result;
        };
        return descriptor;
    };
}

// ── Decorator: @Ref() ─────────────────────────────────────────────────────────

export function Ref()
{
    return function (target: object, key: string): void
    {
        Object.defineProperty(target, key, {
            get(this: HTMLElement)
            { return this.querySelector(`[data-ref="${key}"]`) ?? null; },
            enumerable  : true,
            configurable: true,
        });
    };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _resolveRefs(el: HTMLElement): void
{
    el.querySelectorAll('[data-ref]').forEach(ref => {
        const key = ref.getAttribute('data-ref');
        if (key && key in el) (el as unknown as Record<string, unknown>)[key] = ref;
    });
}

// ── Window registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
{
    Object.defineProperty(window, 'Component', {
        value      : _cFactory,
        writable   : false,
        enumerable : false,
        configurable: false,
    });
}

// ── Exports ───────────────────────────────────────────────────────────────────
// FIX summary:
//   - Removed conflicting `export { ComponentDecorator as Component }`
//   - ComponentDecorator is now exported under its own name
//   - Component class exported as ComponentClass for named import
//   - Default export remains the Component class

export { Component as ComponentClass };
export type { ComponentTarget };
export default Component;
