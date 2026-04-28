import Core, { type TypeDescriptor } from './Core.ts';
import { VirtualNode } from './Virtual.ts';
import { signal, signalMono, sinkText, effect, computed, batch, untrack, AriannATemplate, type Signal, type SignalMono, type ReadonlySignal } from './Observable.ts';
import Rule from './Rule.ts';
import Sheet from './Stylesheet.ts';
export type { Signal, SignalMono, ReadonlySignal };
export type ShadowState = 'open' | 'close';
export type ShadowMode  = 'drop' | 'inset' | 'glow' | 'layered';
export interface ShadowOptions { color?: string; blur?: number; spread?: number; x?: number; y?: number; }
export interface ShadowLayer extends ShadowOptions { inset?: boolean; }
function _alpha(color: string, a: number): string {
    const rgba = color.match(/rgba?\(([^)]+)\)/); if (rgba) { const p = rgba[1].split(',').map(s => s.trim()); if (p.length >= 3) return `rgba(${p[0]},${p[1]},${p[2]},${a})`; }
    const hex = color.match(/^#([0-9a-fA-F]{3,8})$/); if (hex) { const h = hex[1]; const r = parseInt(h.length >= 6 ? h.slice(0,2) : h[0]+h[0], 16); const g = parseInt(h.length >= 6 ? h.slice(2,4) : h[1]+h[1], 16); const b = parseInt(h.length >= 6 ? h.slice(4,6) : h[2]+h[2], 16); return `rgba(${r},${g},${b},${a})`; }
    return color;
}
function _preset(mode: ShadowMode, o: ShadowOptions): string {
    const color = o.color ?? 'rgba(0,0,0,0.25)', blur = o.blur ?? 8, spread = o.spread ?? 0, x = o.x ?? 0;
    switch (mode) {
        case 'drop':    return `${x}px ${o.y ?? 4}px ${blur}px ${spread}px ${color}`;
        case 'inset':   return `inset ${x}px ${o.y ?? 0}px ${blur}px ${spread}px ${color}`;
        case 'glow':    return `0 0 ${blur}px ${spread+2}px ${color}, 0 0 ${blur*2}px ${spread}px ${_alpha(color, 0.5)}`;
        case 'layered': { const y = o.y ?? 4; return `${x}px ${y}px ${blur}px ${color}, ${x}px ${y*2}px ${blur*2}px ${_alpha(color, 0.15)}`; }
    }
}
function _layerCSS(l: ShadowLayer): string { return `${l.inset ? 'inset ' : ''}${l.x ?? 0}px ${l.y ?? 4}px ${l.blur ?? 8}px ${l.spread ?? 0}px ${l.color ?? 'rgba(0,0,0,0.25)'}`; }
function _shadowCSS(state: ShadowState, mode: ShadowMode | ShadowLayer[] | Rule | Sheet = 'drop', opts: ShadowOptions = {}): string {
    if (state === 'close') return 'none';
    if (mode instanceof Rule)  { const v = mode.Properties['boxShadow'] ?? mode.Properties['box-shadow']; return v ?? _preset('drop', opts); }
    if (mode instanceof Sheet) { for (const r of mode.Rules) { const v = r.Properties['boxShadow'] ?? r.Properties['box-shadow']; if (v) return v; } return _preset('drop', opts); }
    if (Array.isArray(mode)) return mode.map(_layerCSS).join(', ');
    return _preset(mode, opts);
}
export type RealTarget = string | Element | AriannATemplate | (new (...a: unknown[]) => Element) | VirtualNode | RealDef | Real;
export interface RealDef { Tag?: string; Attributes?: Record<string, string>; Style?: Record<string, string>; }
type Getter<T> = () => T;
type NodeInput = RealTarget | string | Element | Node | VirtualNode | Real | null;
function toNodes(items: NodeInput[]): Node[] {
    return items.flatMap(item => {
        if (!item) return [];
        if (item instanceof Node) return [item];
        if (item instanceof Real) return [item.render()];
        if (item instanceof VirtualNode) return [item.render()];
        if (item instanceof AriannATemplate) return [item.clone()];
        if (typeof item === 'string') { const t = document.createElement('template'); t.innerHTML = item; return Array.from(t.content.childNodes); }
        if (typeof item === 'object' && 'Tag' in item) { const el = document.createElement((item as RealDef).Tag ?? 'div'); if ((item as RealDef).Attributes) for (const [k,v] of Object.entries((item as RealDef).Attributes!)) el.setAttribute(k,v); return [el]; }
        return [];
    });
}
export class Real {
    #el: Element; #mode: boolean; #descriptor: TypeDescriptor | false; #value: unknown; #effects: Array<() => void> = [];
    static readonly Instances: Real[] = [];
    static get Namespaces() { return Core.Namespaces; }
    constructor(arg0: RealTarget, arg1?: Record<string, unknown> | (new (...a: unknown[]) => Element), arg2?: new (...a: unknown[]) => Element) {
        this.#mode = new.target !== undefined; this.#el = document.createElement('div'); this.#descriptor = false; this.#value = this;
        this.#init(arg0, arg1, arg2);
        if (this.#mode) { Real.Instances.push(this); if (!this.#el.id) { this.#el.id = `Real-Instance-${Real.Instances.length}`; this.#el.className = this.#el.id; } }
    }
    #init(arg0: RealTarget, arg1?: Record<string, unknown> | (new (...a: unknown[]) => Element), arg2?: new (...a: unknown[]) => Element): void {
        if (arg0 instanceof AriannATemplate) { this.#el = arg0.clone(); this.#mode = true; return; }
        if (!this.#mode) {
            if (typeof arg0 === 'string') { if (arg1 && typeof arg1 === 'function') { Core.Define(arg0, arg1 as new () => Element, (arg2 ?? HTMLElement) as new () => Element); this.#value = arg1; return; } const d = Core.GetDescriptor(arg0); if (d) { this.#descriptor = d; this.#value = d.Constructor ?? d.Interface; return; } const el = document.querySelector(arg0); if (el) { this.#el = el; this.#descriptor = Core.GetDescriptor(el); this.#value = new Real(el); } return; }
            if (typeof arg0 === 'function') { const d = Core.GetDescriptor(arg0 as new () => Element); if (d) { this.#descriptor = d; this.#value = d.Interface ?? arg0; } return; }
            if (arg0 instanceof Element) { this.#el = arg0; this.#descriptor = Core.GetDescriptor(arg0); this.#value = new Real(arg0); this.#mode = true; return; }
            return;
        }
        if (typeof arg0 === 'string') { const d = Core.GetDescriptor(arg0); this.#el = (d && d.Namespace?.functions?.create) ? d.Namespace.functions.create(arg0) as Element : document.createElement(arg0); if (d) this.#descriptor = d; }
        else if (arg0 instanceof Element) { this.#el = arg0; this.#descriptor = Core.GetDescriptor(arg0); }
        else if (arg0 instanceof Real) { this.#el = arg0.render(); }
        else if (arg0 instanceof VirtualNode) { this.#el = arg0.render(); }
        else if (typeof arg0 === 'object' && 'Tag' in (arg0 as object)) { const def = arg0 as RealDef; this.#el = document.createElement(def.Tag ?? 'div'); if (def.Attributes) for (const [k,v] of Object.entries(def.Attributes)) this.#el.setAttribute(k,v); }
        if (arg1 && typeof arg1 === 'object' && typeof arg1 !== 'function') { const opts = arg1 as Record<string, unknown>; if (opts.id) this.#el.id = String(opts.id); if (opts.class || opts.className) this.#el.className = String(opts.class ?? opts.className); }
    }
    render(): Element { return this.#el; }
    valueOf(): Element { return this.#el; }
    log(v?: unknown): this { console.log(v ?? this.#el); return this; }
    on(type: string, cb: EventListener, opts?: AddEventListenerOptions | boolean): this { this.#el.addEventListener(type, cb, opts); return this; }
    off(type: string, cb: EventListener, opts?: EventListenerOptions | boolean): this { this.#el.removeEventListener(type, cb, opts); return this; }
    fire(event: Event | string, init?: CustomEventInit): this { this.#el.dispatchEvent(typeof event === 'string' ? new CustomEvent(event, init) : event); return this; }
    append(parent: string | Element | Real | VirtualNode | null): this { const p = typeof parent === 'string' ? document.querySelector(parent) : parent instanceof Real ? parent.render() : parent instanceof VirtualNode ? parent.render() : parent; if (p) p.appendChild(this.#el); return this; }
    add(...args: (NodeInput | number)[]): this { const last = args[args.length-1]; const items = typeof last === 'number' ? args.slice(0,-1) as NodeInput[] : args as NodeInput[]; const index = typeof last === 'number' ? last : this.#el.childNodes.length; const nodes = toNodes(items); const ref = this.#el.childNodes[index] ?? null; const frag = document.createDocumentFragment(); nodes.forEach(n => frag.appendChild(n)); this.#el.insertBefore(frag, ref); return this; }
    push(...nodes: NodeInput[]): this    { return this.add(...nodes); }
    unshift(...nodes: NodeInput[]): this { return this.add(...nodes, 0); }
    remove(...targets: (string | Node | Real | number)[]): this { for (const t of targets) { let node: Node | null = null; if (typeof t === 'number') node = this.#el.childNodes[t] ?? null; else if (typeof t === 'string') node = this.#el.querySelector(t); else if (t instanceof Real) node = t.render(); else if (t instanceof Node) node = t; if (node && this.#el.contains(node)) this.#el.removeChild(node); } return this; }
    shift(n = 1): this { for (let i = 0; i < n && this.#el.firstChild; i++) this.#el.removeChild(this.#el.firstChild); return this; }
    pop(n = 1): this   { for (let i = 0; i < n && this.#el.lastChild;  i++) this.#el.removeChild(this.#el.lastChild);  return this; }
    get(name: string): string | undefined { const u = name.toUpperCase(); for (let i = 0; i < this.#el.attributes.length; i++) { const a = this.#el.attributes.item(i)!; if (a.name.toUpperCase() === u) return a.value; } const rec = this.#el as unknown as Record<string, unknown>; for (const k of Object.keys(rec)) if (k.toUpperCase() === u) return String(rec[k]); return undefined; }
    set(name: string, value: string): this { const u = name.toUpperCase(); for (let i = 0; i < this.#el.attributes.length; i++) { const a = this.#el.attributes.item(i)!; if (a.name.toUpperCase() === u) { this.#el.setAttribute(a.name, value); return this; } } const rec = this.#el as unknown as Record<string, unknown>; for (const k of Object.keys(rec)) if (k.toUpperCase() === u) { rec[k] = value; return this; } this.#el.setAttribute(name.toLowerCase(), value); return this; }
    show(): this { (this.#el as HTMLElement).style.display = ''; return this; }
    hide(): this { (this.#el as HTMLElement).style.display = 'none'; return this; }
    contains(...nodes: (Node | Real | string)[]): boolean { for (const n of nodes) { const el = typeof n === 'string' ? this.#el.querySelector(n) : n instanceof Real ? n.render() : n; if (!el || !this.#el.contains(el)) return false; } return true; }
    child(path: number[]): Node { let n: Node = this.#el; for (const i of path) n = n.childNodes[i]!; return n; }
    shadow(state: ShadowState, mode: ShadowMode | ShadowLayer[] | Rule | Sheet = 'drop', opts: ShadowOptions = {}): this { (this.#el as HTMLElement).style.boxShadow = _shadowCSS(state, mode, opts); return this; }
    signal<T>(value: T): Signal<T>         { return signal(value); }
    signalMono<T>(value: T): SignalMono<T> { return signalMono(value); }
    effect(fn: () => void): this { this.#effects.push(effect(fn)); return this; }
    computed<T>(fn: () => T): ReadonlySignal<T> { const s = signal<T>(undefined as T); this.#effects.push(effect(() => s.set(fn()))); return s.readonly(); }
    text(getter: Getter<string>): this { const node = document.createTextNode(getter()); this.#el.appendChild(node); this.#effects.push(effect(() => { node.nodeValue = getter(); })); return this; }
    textMono(s: SignalMono<string>, node?: Text): this { if (!node) { node = document.createTextNode(s.peek()); this.#el.appendChild(node); } sinkText(s, node); return this; }
    attr(name: string, getter: Getter<string | null>): this { const el = this.#el; this.#effects.push(effect(() => { const v = getter(); if (v === null) el.removeAttribute(name); else el.setAttribute(name, v); })); return this; }
    cls(name: string, getter: Getter<boolean>): this { const el = this.#el; this.#effects.push(effect(() => { if (getter()) el.classList.add(name); else el.classList.remove(name); })); return this; }
    clsMono(name: string): (v: boolean) => void { const el = this.#el; return (v: boolean) => { if (v) el.classList.add(name); else el.classList.remove(name); }; }
    prop(name: string, getter: Getter<unknown>): this { const rec = this.#el as unknown as Record<string, unknown>; this.#effects.push(effect(() => { rec[name] = getter(); })); return this; }
    style(prop: string, getter: Getter<string>): this { const el = this.#el as HTMLElement; const cssProp = prop.replace(/([A-Z])/g, c => `-${c.toLowerCase()}`); this.#effects.push(effect(() => { el.style.setProperty(cssProp, getter()); })); return this; }
    bind(getter: Getter<string>, setter?: (v: string) => void): this { this.prop('value', getter); if (setter) this.#el.addEventListener('input', e => setter((e.target as HTMLInputElement).value)); return this; }
    destroy(): this { this.#effects.forEach(s => s()); this.#effects = []; return this; }
    static tpl(html: string): AriannATemplate { return new AriannATemplate(html); }
    static Define(tag: string, ctor: new (...a: unknown[]) => Element, base: new (...a: unknown[]) => Element = HTMLElement, style: Record<string, string> = {}): TypeDescriptor | false { return Core.Define(tag, ctor, base, style); }
    static GetDescriptor = Core.GetDescriptor;
    static Render(obj: RealDef | VirtualNode | Element | Real | AriannATemplate): Element | null { if (obj instanceof Element) return obj; if (obj instanceof Real) return obj.render(); if (obj instanceof VirtualNode) return obj.render(); if (obj instanceof AriannATemplate) return obj.clone(); if (typeof obj === 'object' && 'Tag' in obj) { const el = document.createElement((obj as RealDef).Tag ?? 'div'); if ((obj as RealDef).Attributes) for (const [k,v] of Object.entries((obj as RealDef).Attributes!)) el.setAttribute(k,v); return el; } return null; }
    static signal     = signal;
    static signalMono = signalMono;
    static sinkText   = sinkText;
    static effect     = effect;
    static computed   = computed;
    static batch      = batch;
    static untrack    = untrack;
    static template   = (html: string) => new AriannATemplate(html);
}
if (typeof window !== 'undefined') Object.defineProperty(window, 'Real', { enumerable: true, configurable: false, writable: false, value: Real });
export default Real;
