/**
 * @module    Context
 * @author    Riccardo Angeli
 * @version   1.2.0
 * @copyright Riccardo Angeli 2012-2026
 *
 * Context per AriannA — elimina il property drilling.
 * Signal integrati — ctx.asSignal() reagisce automaticamente a ctx.update().
 */

import { uuid, signal } from './Observable.ts';
import type { Signal } from './Observable.ts';

export interface ContextEvent<T = unknown>
{
    Type  : string;
    Key   : string;
    Value : T;
    Old   : T | undefined;
}

interface ConsumerHandle<T>
{
    readonly value : T | undefined;
    /** Signal reattivo — aggiornato automaticamente da Context.update(). */
    signal(): Signal<T | undefined>;
    on(types: string, cb: (e: ContextEvent<T>) => void): ConsumerHandle<T>;
    off(type: string, cb: (e: ContextEvent<T>) => void): ConsumerHandle<T>;
    detach(): void;
}

interface ContextRecord<T>
{
    value     : T | undefined;
    $signal   : Signal<T | undefined>;
    providers : Set<Element>;
    consumers : Set<ConsumerRecord<T>>;
}

interface ConsumerRecord<T>
{
    id      : string;
    element : Element;
    events  : Map<string, Set<(e: ContextEvent<T>) => void>>;
}

const _registry = new Map<string, ContextRecord<unknown>>();

function _get<T>(key: string): ContextRecord<T>
{
    if (!_registry.has(key))
        _registry.set(key, { value: undefined, $signal: signal<T | undefined>(undefined), providers: new Set(), consumers: new Set() });
    return _registry.get(key) as ContextRecord<T>;
}

function _fire<T>(record: ContextRecord<T>, key: string, nv: T, old: T | undefined): void
{
    record.$signal.set(nv);
    const ev: ContextEvent<T> = { Type: 'Context-Changed', Key: key, Value: nv, Old: old };
    for (const c of record.consumers) {
        const bucket = c.events.get('Context-Changed');
        if (bucket) for (const cb of bucket) cb(ev);
    }
}

export class Context<T = unknown>
{
    readonly #key : string;
    readonly #rec : ContextRecord<T>;

    constructor(key: string, value?: T)
    {
        this.#key = key;
        this.#rec = _get<T>(key);
        if (value !== undefined) { this.#rec.value = value; this.#rec.$signal.set(value); }
    }

    get key(): string          { return this.#key; }
    get value(): T | undefined { return this.#rec.value; }

    /**
     * Espone il valore come Signal reattivo.
     * Gli Effect che lo leggono reagiscono automaticamente a update().
     * @example
     *   const $theme = ThemeCtx.asSignal();
     *   real.style('background', () => $theme.get()?.primary ?? 'gray');
     */
    asSignal(): Signal<T | undefined> { return this.#rec.$signal; }

    provide(element: Element): this
    {
        this.#rec.providers.add(element);
        element.addEventListener('arianna:context-request', (e: Event) => {
            const ce = e as CustomEvent<{ key: string; resolve: (v: unknown) => void }>;
            if (ce.detail.key === this.#key) { ce.stopPropagation(); ce.detail.resolve(this.#rec.value); }
        });
        return this;
    }

    update(value: T): this
    {
        const old = this.#rec.value;
        if (Object.is(old, value)) return this;
        this.#rec.value = value;
        _fire(this.#rec, this.#key, value, old);
        return this;
    }

    destroy(): void
    { this.#rec.providers.clear(); this.#rec.consumers.clear(); _registry.delete(this.#key); }

    static consume<T>(key: string, element: Element): ConsumerHandle<T>
    {
        const rec = _get<T>(key);
        const cr: ConsumerRecord<T> = { id: uuid(), element, events: new Map() };
        rec.consumers.add(cr);

        let resolved = false;
        element.dispatchEvent(new CustomEvent('arianna:context-request', {
            bubbles: true, composed: true,
            detail: { key, resolve: (v: unknown) => { if (!resolved) { resolved = true; rec.value = v as T; rec.$signal.set(v as T); } } },
        }));

        const handle: ConsumerHandle<T> = {
            get value() { return rec.value; },
            signal()    { return rec.$signal; },
            on(types, cb) { types.split(/\s+|,|\|/g).filter(Boolean).forEach(t => { const b = cr.events.get(t) ?? new Set(); b.add(cb); cr.events.set(t, b); }); return handle; },
            off(type, cb) { cr.events.get(type)?.forEach(l => l === cb && cr.events.get(type)!.delete(l)); return handle; },
            detach() { rec.consumers.delete(cr); },
        };
        return handle;
    }

    static has(key: string, element: Element): boolean
    {
        let found = false;
        element.dispatchEvent(new CustomEvent('arianna:context-request', { bubbles: true, composed: true, detail: { key, resolve: () => { found = true; } } }));
        return found;
    }

    static keys(): string[] { return Array.from(_registry.keys()); }
}

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Context', { enumerable: true, configurable: false, writable: false, value: Context });

export default Context;
