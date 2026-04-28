/**
 * @module    Observable
 * @author    Riccardo Angeli
 * @version   1.2.0
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Modulo base AriannA — zero dipendenze, ESM native.
 *
 * ── FINE-GRAIN REACTIVE PRIMITIVES ───────────────────────────────────────────
 *   signal<T>(v)          → Signal<T> multi-subscriber
 *   signalMono<T>(v)      → SignalMono<T> slot singolo, zero Set (1:1 TextNode)
 *   sinkText(s, node)     → collega SignalMono a TextNode direttamente
 *   effect(fn)            → Effect isolato, restituisce cleanup () => void
 *   computed(fn)          → Signal derivato read-only
 *   batch(fn)             → raggruppa N set() in un flush
 *   untrack(fn)           → legge Signal senza registrare dipendenze
 *
 * ── TEMPLATE ENGINE (v12) — Vue/Solid style, zero JSX ────────────────────────
 *   new AriannATemplate(html)  → parse UNA VOLTA, N clone O(1) C++
 *   tpl.clone()                → Element clon dal fragment pre-parsato
 *   tpl.cloneAll()             → DocumentFragment per multi-root
 *   tpl.walk(el, ...paths)     → accesso O(1) ai nodi interni via path
 *
 * ── INSTANCE PUB/SUB ─────────────────────────────────────────────────────────
 *   new Observable(target?)
 *   obs.on / obs.off / obs.fire / obs.once
 *   obs.signal / obs.effect / obs.computed / obs.destroy
 *
 * ── STATIC DOM BUS ────────────────────────────────────────────────────────────
 *   Observable.On / Off / Fire / Once / Trigger / All
 *
 * @example
 *   // Template engine — parse 1 volta, clone 10k volte
 *   const tpl = new AriannATemplate(
 *     '<tr><td class="col-md-1"></td>' +
 *     '<td class="col-md-4"><a class="lbl"></a></td></tr>'
 *   );
 *   const tr  = tpl.clone() as HTMLTableRowElement;
 *   const lbl = tr.children[1].firstChild as Text;
 *
 *   const $label = signalMono('ciao');
 *   sinkText($label, lbl);      // → lbl.nodeValue = 'ciao'
 *   $label.set('hello');        // → lbl.nodeValue = 'hello' diretto
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AriannAEvent         { Type: string; [k: string]: unknown; }
export interface ListenerOptions      { Passive?: boolean; Capture?: boolean; Once?: boolean; Signal?: AbortSignal; Phase?: 'bubble' | 'capture'; }
export interface DomEventTypeDescriptor      { Name: string; Interface: abstract new (...a: never[]) => Event; }
export interface DomEventInterfaceDescriptor { Name: string; Types: Record<string, DomEventTypeDescriptor>; }

export interface ListenerRecord
{
    UUID        : string;
    Type        : string;
    Target      : EventTarget | object;
    Function    : EventListenerOrEventListenerObject | ((e: AriannAEvent) => void);
    Propagation : 'bubble' | 'capture' | undefined;
    XML         : string;
}

interface InstanceListener { readonly Id: string; Handler: (e: AriannAEvent) => void; Target: object; }

// ── UUID ──────────────────────────────────────────────────────────────────────

export function uuid(): string
{
    const b: string[] = [];
    for (let i = 0; i < 9; i++)
        b.push((Math.floor(1 + Math.random() * 0x10000)).toString(16).slice(1));
    return `${b[1]}${b[2]}-${b[3]}-${b[4]}-${b[5]}-${b[6]}${b[7]}${b[8]}`;
}

// ── Fine-grain primitives ─────────────────────────────────────────────────────

type EffectRunner = { run(): void; deps: Set<Set<EffectRunner>> };
let _activeEffect: EffectRunner | null = null;
let _batchDepth = 0;
const _pendingEffects: EffectRunner[] = [];

function _notify(subs: Set<EffectRunner>): void
{
    if (_batchDepth > 0) { subs.forEach(e => { if (!_pendingEffects.includes(e)) _pendingEffects.push(e); }); return; }
    [...subs].forEach(e => e.run());
}

// ── Signal<T> — multi-subscriber ─────────────────────────────────────────────

export interface Signal<T>
{
    get(): T;
    set(v: T): void;
    peek(): T;
    readonly(): ReadonlySignal<T>;
}
export interface ReadonlySignal<T> { get(): T; peek(): T; }

export function signal<T>(value: T): Signal<T>
{
    const subs = new Set<EffectRunner>();
    return {
        get(): T   { if (_activeEffect) subs.add(_activeEffect); return value; },
        set(v: T)  { if (Object.is(v, value)) return; value = v; _notify(subs); },
        peek(): T  { return value; },
        readonly() { return { get: () => { if (_activeEffect) subs.add(_activeEffect); return value; }, peek: () => value }; },
    };
}

// ── SignalMono<T> — slot singolo 1:1 TextNode ─────────────────────────────────

/**
 * Signal ottimizzato per il pattern 1 Signal → 1 TextNode.
 * Zero Set, zero EffectRunner — solo una funzione slot.
 * Il compilatore v12 trasforma signalMono() in variabili scalari a build-time:
 *   let $label_v = v; let $label_sub = null;
 */
export interface SignalMono<T>
{
    get(): T;
    set(v: T): void;
    peek(): T;
    _sub: (() => void) | null;
}

export function signalMono<T>(value: T): SignalMono<T>
{
    const s: SignalMono<T> = {
        _sub: null,
        get(): T  { return value; },
        set(v: T) { if (!Object.is(v, value)) { value = v; s._sub?.(); } },
        peek(): T { return value; },
    };
    return s;
}

/**
 * Sink statico — collega un SignalMono a un TextNode senza EffectRunner.
 * Forma "compilata": node.nodeValue = s.peek() + slot diretto.
 */
export function sinkText(s: SignalMono<string>, node: Text): void
{
    node.nodeValue = s.peek();
    s._sub = () => { node.nodeValue = s.peek(); };
}

/**
 * Sink classe CSS — collega un getter booleano a classList.
 * Usato con _selFn slot per selection senza Effect.
 */
export function sinkClass(el: Element, cls: string, getter: () => boolean): () => void
{
    const update = () => { if (getter()) el.classList.add(cls); else el.classList.remove(cls); };
    update();
    return update;
}

// ── Effect ────────────────────────────────────────────────────────────────────

export function effect(fn: () => void): () => void
{
    const runner: EffectRunner = {
        deps: new Set(),
        run() {
            runner.deps.forEach(d => d.delete(runner)); runner.deps.clear();
            const prev = _activeEffect; _activeEffect = runner;
            try { fn(); } finally { _activeEffect = prev; }
        },
    };
    runner.run();
    return () => { runner.deps.forEach(d => d.delete(runner)); runner.deps.clear(); };
}

export function computed<T>(fn: () => T): ReadonlySignal<T>
{
    const s = signal<T>(undefined as T);
    effect(() => s.set(fn()));
    return s.readonly();
}

export function batch(fn: () => void): void
{
    _batchDepth++;
    try { fn(); } finally {
        if (--_batchDepth === 0) {
            const p = _pendingEffects.splice(0);
            p.forEach(e => e.run());
        }
    }
}

export function untrack<T>(fn: () => T): T
{
    const prev = _activeEffect; _activeEffect = null;
    try { return fn(); } finally { _activeEffect = prev; }
}

// ── AriannATemplate — HTMLTemplateElement engine ──────────────────────────────

/**
 * AriannATemplate — Vue/Solid style template engine, zero JSX, zero runtime parser.
 *
 * Architettura:
 *   1. new AriannATemplate(html) → browser parsa HTML UNA SOLA VOLTA in C++
 *   2. tpl.clone()               → cloneNode O(1) — puro C++, zero parser JS
 *   3. tpl.walk(el, [0,0])       → accesso O(1) ai nodi interni via path di indici
 *
 * Perché è più veloce di createElement + innerHTML per ogni riga:
 *   - innerHTML su ogni clone = N parse HTML separati
 *   - HTMLTemplateElement = 1 parse + N cloneNode C++ (~30% più veloce su 01/07/08)
 *
 * Equivalente a:
 *   - Vue 3: `const _hoisted = createElementVNode(...)` + `cloneVNode`
 *   - Solid: `const _tmpl$ = template(...)` + `_tmpl$.cloneNode(true)`
 *   - AriannA: `const tpl = new AriannATemplate(...)` + `tpl.clone()`
 *
 * @example
 *   const tpl = new AriannATemplate(
 *     '<tr data-id="">' +
 *     '<td class="col-md-1"></td>' +
 *     '<td class="col-md-4"><a class="lbl"></a></td>' +
 *     '<td class="col-md-6"></td></tr>'
 *   );
 *
 *   // Ogni riga — O(1) C++
 *   const tr       = tpl.clone() as HTMLTableRowElement;
 *   const idTxt    = tpl.walk(tr, [0, 0]) as Text;
 *   const labelTxt = tpl.walk(tr, [1, 0, 0]) as Text;
 *
 *   const $label = signalMono('ciao');
 *   sinkText($label, labelTxt as Text);
 */
export class AriannATemplate
{
    readonly #tpl: HTMLTemplateElement;

    constructor(html: string)
    {
        this.#tpl          = document.createElement('template');
        this.#tpl.innerHTML = html;
        // Il browser compila il fragment in C++ al momento dell'assegnazione
        // .content è già un DocumentFragment ottimizzato, pronto per cloneNode
    }

    /**
     * Clona il primo elemento del template — O(1) in C++.
     * Zero HTML parsing. Zero allocazione JS oltre il nodo clonato.
     */
    clone(): Element
    {
        return this.#tpl.content.firstElementChild!.cloneNode(true) as Element;
    }

    /**
     * Clona l'intero content come DocumentFragment.
     * Per template con più elementi root.
     */
    cloneAll(): DocumentFragment
    {
        return this.#tpl.content.cloneNode(true) as DocumentFragment;
    }

    /**
     * Accesso O(1) a un nodo interno tramite path di indici childNodes.
     * Evita querySelector — accesso diretto via childNodes[i] chain.
     *
     * @example
     *   const tr    = tpl.clone();
     *   const idTxt = tpl.walk(tr, [0, 0]) as Text;
     *   // tr.childNodes[0].childNodes[0]
     */
    walk(root: Node, path: number[]): Node
    {
        let n: Node = root;
        for (const i of path) n = n.childNodes[i];
        return n;
    }

    /**
     * Accesso O(1) a più nodi interni in una singola chiamata.
     * Restituisce array di nodi nell'ordine dei path forniti.
     *
     * @example
     *   const [idTxt, labelTxt] = tpl.walkAll(tr, [0,0], [1,0,0]);
     */
    walkAll(root: Node, ...paths: number[][]): Node[]
    {
        return paths.map(p => this.walk(root, p));
    }

    /** Il DocumentFragment interno — read-only. */
    get content(): DocumentFragment { return this.#tpl.content; }
}

// ── DOM event type registry ───────────────────────────────────────────────────

const DOM_TYPES: Readonly<Record<string, DomEventTypeDescriptor>> = Object.freeze(
{
    click:{Name:'click',Interface:MouseEvent}, dblclick:{Name:'dblclick',Interface:MouseEvent},
    mouseenter:{Name:'mouseenter',Interface:MouseEvent}, mouseleave:{Name:'mouseleave',Interface:MouseEvent},
    mousemove:{Name:'mousemove',Interface:MouseEvent}, mouseout:{Name:'mouseout',Interface:MouseEvent},
    mouseover:{Name:'mouseover',Interface:MouseEvent}, mouseup:{Name:'mouseup',Interface:MouseEvent},
    mousedown:{Name:'mousedown',Interface:MouseEvent}, contextmenu:{Name:'contextmenu',Interface:MouseEvent},
    drag:{Name:'drag',Interface:DragEvent}, dragend:{Name:'dragend',Interface:DragEvent},
    dragenter:{Name:'dragenter',Interface:DragEvent}, dragleave:{Name:'dragleave',Interface:DragEvent},
    dragover:{Name:'dragover',Interface:DragEvent}, dragstart:{Name:'dragstart',Interface:DragEvent},
    drop:{Name:'drop',Interface:DragEvent},
    wheel:{Name:'wheel',Interface:WheelEvent},
    keypress:{Name:'keypress',Interface:KeyboardEvent}, keydown:{Name:'keydown',Interface:KeyboardEvent},
    keyup:{Name:'keyup',Interface:KeyboardEvent},
    animationstart:{Name:'animationstart',Interface:AnimationEvent},
    animationend:{Name:'animationend',Interface:AnimationEvent},
    animationiteration:{Name:'animationiteration',Interface:AnimationEvent},
    abort:{Name:'abort',Interface:UIEvent}, load:{Name:'load',Interface:UIEvent},
    resize:{Name:'resize',Interface:UIEvent}, scroll:{Name:'scroll',Interface:UIEvent},
    select:{Name:'select',Interface:UIEvent}, unload:{Name:'unload',Interface:UIEvent},
    focusin:{Name:'focusin',Interface:FocusEvent}, focusout:{Name:'focusout',Interface:FocusEvent},
    focus:{Name:'focus',Interface:FocusEvent}, blur:{Name:'blur',Interface:FocusEvent},
    cut:{Name:'cut',Interface:ClipboardEvent}, copy:{Name:'copy',Interface:ClipboardEvent},
    paste:{Name:'paste',Interface:ClipboardEvent},
    compositionstart:{Name:'compositionstart',Interface:CompositionEvent},
    compositionend:{Name:'compositionend',Interface:CompositionEvent},
    change:{Name:'change',Interface:Event}, input:{Name:'input',Interface:Event},
    submit:{Name:'submit',Interface:Event}, reset:{Name:'reset',Interface:Event},
    DOMContentLoaded:{Name:'DOMContentLoaded',Interface:Event},
    message:{Name:'message',Interface:Event}, online:{Name:'online',Interface:Event},
    offline:{Name:'offline',Interface:Event}, popstate:{Name:'popstate',Interface:Event},
    hashchange:{Name:'hashchange',Interface:Event}, beforeunload:{Name:'beforeunload',Interface:Event},
    touchstart:{Name:'touchstart',Interface:TouchEvent}, touchend:{Name:'touchend',Interface:TouchEvent},
    touchmove:{Name:'touchmove',Interface:TouchEvent}, touchcancel:{Name:'touchcancel',Interface:TouchEvent},
    pointerdown:{Name:'pointerdown',Interface:PointerEvent}, pointerup:{Name:'pointerup',Interface:PointerEvent},
    pointermove:{Name:'pointermove',Interface:PointerEvent}, pointercancel:{Name:'pointercancel',Interface:PointerEvent},
    pointerenter:{Name:'pointerenter',Interface:PointerEvent}, pointerleave:{Name:'pointerleave',Interface:PointerEvent},
    transitionstart:{Name:'transitionstart',Interface:TransitionEvent},
    transitionend:{Name:'transitionend',Interface:TransitionEvent},
    transitioncancel:{Name:'transitioncancel',Interface:TransitionEvent},
});

const DOM_INTERFACES: Record<string, DomEventInterfaceDescriptor> = {};
for (const [name, desc] of Object.entries(DOM_TYPES)) {
    const iname = desc.Interface.name;
    if (!DOM_INTERFACES[iname]) DOM_INTERFACES[iname] = { Name: iname, Types: {} };
    DOM_INTERFACES[iname].Types[name] = desc;
}

const _globalListeners = new Map<string, ListenerRecord>();

function _toTargets(target: EventTarget | EventTarget[] | string): EventTarget[]
{
    if (typeof target === 'string') return typeof document !== 'undefined' ? Array.from(document.querySelectorAll(target)) : [];
    return Array.isArray(target) ? target : [target];
}
function _toTypes(types: string): string[] { return types.split(/[\s,|]+/).filter(Boolean); }

// ── Observable class ──────────────────────────────────────────────────────────

export class Observable
{
    readonly #events : Map<string, Set<InstanceListener>> = new Map();
    readonly #target : object;
    readonly #effects: Array<() => void> = [];

    constructor(target?: object) { this.#target = target ?? this; }

    // ── Instance Signal API ───────────────────────────────────────────────────

    signal<T>(value: T): Signal<T>           { return signal(value); }
    signalMono<T>(value: T): SignalMono<T>   { return signalMono(value); }

    effect(fn: () => void): this
    { this.#effects.push(effect(fn)); return this; }

    computed<T>(fn: () => T): ReadonlySignal<T>
    { const s = signal<T>(undefined as T); this.#effects.push(effect(() => s.set(fn()))); return s.readonly(); }

    // ── Instance pub/sub ──────────────────────────────────────────────────────

    on(types: string, cb: (e: AriannAEvent) => void): this
    {
        const ls: InstanceListener = { Id: uuid(), Handler: cb, Target: this.#target };
        types.split(/(?!-)\W/g).filter(Boolean).forEach(t => {
            const b = this.#events.get(t) ?? new Set<InstanceListener>();
            b.add(ls); this.#events.set(t, b);
        });
        return this;
    }

    off(type: string, cb: (e: AriannAEvent) => void): this
    { this.#events.get(type)?.forEach(l => l.Handler === cb && this.#events.get(type)!.delete(l)); return this; }

    fire(event: AriannAEvent): this
    { if (!event?.Type) return this; this.#events.get(event.Type)?.forEach(l => l.Handler.call(l.Target, event)); return this; }

    once(event: AriannAEvent, cb: (e: AriannAEvent) => void): this
    { const w = (e: AriannAEvent) => { cb(e); this.off(event.Type, w); }; return this.on(event.Type, w); }

    all(event: AriannAEvent): this { return this.fire(event); }

    destroy(): this
    { this.#effects.forEach(s => s()); (this.#effects as Array<() => void>).length = 0; this.#events.clear(); return this; }

    // ── Static DOM bus ────────────────────────────────────────────────────────

    static On(target: EventTarget | EventTarget[] | string, types: string, handler: EventListenerOrEventListenerObject, opts?: ListenerOptions): string[]
    {
        const ids: string[] = [];
        const addOpts: AddEventListenerOptions = { passive: opts?.Passive, capture: opts?.Capture ?? opts?.Phase === 'capture', once: opts?.Once, signal: opts?.Signal };
        for (const t of _toTargets(target)) for (const type of _toTypes(types)) {
            const id = uuid();
            t.addEventListener(type, handler, addOpts);
            _globalListeners.set(id, { UUID: id, Type: type, Target: t, Function: handler, Propagation: addOpts.capture ? 'capture' : 'bubble', XML: '' });
            ids.push(id);
        }
        return ids;
    }

    static Off(target: EventTarget | EventTarget[] | string, types: string, handler: EventListenerOrEventListenerObject, opts?: ListenerOptions): void
    { for (const t of _toTargets(target)) for (const type of _toTypes(types)) t.removeEventListener(type, handler, { capture: opts?.Capture ?? opts?.Phase === 'capture' }); }

    static Fire(target: EventTarget | EventTarget[] | string, type: string, init?: EventInit, detail?: CustomEventInit): void
    { const ev = detail !== undefined ? new CustomEvent(type, { ...init, ...detail }) : new Event(type, init); _toTargets(target).forEach(t => t.dispatchEvent(ev)); }

    static Once(target: EventTarget | EventTarget[] | string, types: string, handler: EventListenerOrEventListenerObject, opts?: ListenerOptions): string[]
    { return Observable.On(target, types, handler, { ...opts, Once: true }); }

    static Trigger(target: EventTarget | EventTarget[] | string, type: string): void { Observable.Fire(target, type); }
    static All = Observable.On;

    static get Listeners() { return _globalListeners; }
    static GetListener(id: string): ListenerRecord | undefined { return _globalListeners.get(id); }
    static GetListeners(target: EventTarget | object, type?: string): ListenerRecord[]
    { return [..._globalListeners.values()].filter(r => r.Target === target && (type === undefined || r.Type === type)); }

    static readonly Dom = { Types: DOM_TYPES, Interfaces: DOM_INTERFACES };
    static GetInterface(eventType: string): string | undefined { return DOM_TYPES[eventType]?.Interface?.name; }
    static GetTypes(interfaceName: string): string[] { return Object.keys(DOM_INTERFACES[interfaceName]?.Types ?? {}); }

    // ── Static Signal + Template shorthands ───────────────────────────────────

    static signal      = signal;
    static signalMono  = signalMono;
    static sinkText    = sinkText;
    static sinkClass   = sinkClass;
    static effect      = effect;
    static computed    = computed;
    static batch       = batch;
    static untrack     = untrack;

    /**
     * Crea un AriannATemplate — parse HTML una volta, clone O(1) N volte.
     * @example
     *   const tpl = Observable.template('<tr><td></td></tr>');
     *   const tr  = tpl.clone();
     */
    static template(html: string): AriannATemplate { return new AriannATemplate(html); }
}

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Observable', { enumerable: true, configurable: false, writable: false, value: Observable });

export default Observable;
