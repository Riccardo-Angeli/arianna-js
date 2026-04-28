import Core, { type TypeDescriptor } from './Core.ts';
import { signal, signalMono, sinkText, effect, computed, batch, untrack, AriannATemplate, type Signal, type SignalMono, type ReadonlySignal } from './Observable.ts';
import Rule from './Rule.ts';
import Sheet from './Stylesheet.ts';
export type { Signal, SignalMono, ReadonlySignal };
export type VAttrs = Record<string, string | number | boolean | null>;
export type VChild = VirtualNode | string | number | boolean | null | undefined;
export interface VNodeDef { Tag?: string; Text?: string; Attributes?: VAttrs; Children?: VChild[]; Root?: Element | null; Parent?: VirtualNode | null; }
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
interface QueuedListener { type: string; cb: EventListener; opts?: AddEventListenerOptions | boolean; }
type Getter<T> = () => T;
interface PendingSink { type: 'text' | 'textMono' | 'attr' | 'cls' | 'prop' | 'style' | 'bind' | 'shadow'; getter: Getter<unknown>; setter?: (v: string) => void; name?: string; mono?: SignalMono<string>; node?: Text; shadowMode?: ShadowMode | ShadowLayer[]; shadowModeRule?: Rule | Sheet; shadowOpts?: ShadowOptions; }
let _counter = 0; const _nodes: Record<string, VirtualNode> = {};
function uid(): string { return `vn-${++_counter}-${Math.random().toString(36).slice(2,6)}`; }
function normalizeChild(c: VChild): VirtualNode { if (c instanceof VirtualNode) return c; const n = new VirtualNode('span'); n.set('textContent', c == null ? '' : String(c)); return n; }
export class VirtualNode {
    #id: string; #tag: string; #attrs: VAttrs; #children: VirtualNode[]; #text: string;
    #dom: Element | null = null; #parent: VirtualNode | null = null; #mounted = false;
    #domQueue: QueuedListener[] = []; #effects: Array<() => void> = []; #sinks: PendingSink[] = [];
    static readonly Instances: VirtualNode[] = [];
    constructor(def: VNodeDef | string | AriannATemplate, attrs?: VAttrs, ...children: VChild[]) {
        if (def instanceof AriannATemplate) { const el = def.clone(); this.#tag = el.tagName.toLowerCase(); this.#attrs = {}; this.#children = []; this.#text = ''; this.#id = uid(); _nodes[this.#id] = this; VirtualNode.Instances.push(this); this.#dom = el; return; }
        if (typeof def === 'string') { this.#tag = def.toLowerCase(); this.#attrs = { ...(attrs ?? {}) }; this.#children = children.map(normalizeChild); this.#text = ''; }
        else { this.#tag = (def.Tag ?? 'div').toLowerCase(); this.#attrs = { ...(def.Attributes ?? {}) }; this.#children = (def.Children ?? []).map(normalizeChild); this.#text = def.Text ?? ''; this.#parent = def.Parent ?? null; }
        this.#id = uid(); _nodes[this.#id] = this; VirtualNode.Instances.push(this);
    }
    render(): Element {
        if (this.#dom) return this.#dom;
        const d = Core.GetDescriptor(this.#tag) as TypeDescriptor & { Namespace?: { functions?: { create?(tag: string): Element | false } } } | false;
        this.#dom = (d && d.Namespace?.functions?.create) ? d.Namespace.functions.create(this.#tag) as Element : document.createElement(this.#tag);
        for (const [k, v] of Object.entries(this.#attrs)) if (v !== null) this.#dom!.setAttribute(k, String(v));
        if (this.#text) this.#dom!.textContent = this.#text;
        for (const child of this.#children) this.#dom!.appendChild(child.render());
        this.#applySinks();
        for (const { type, cb, opts } of this.#domQueue) this.#dom!.addEventListener(type, cb, opts);
        this.#domQueue = []; this.#mounted = true;
        return this.#dom!;
    }
    #applySinks(): void {
        if (!this.#dom) return;
        for (const sink of this.#sinks) {
            switch (sink.type) {
                case 'text': { const node = document.createTextNode(String((sink.getter as Getter<string>)())); this.#dom!.appendChild(node); this.#effects.push(effect(() => { node.nodeValue = (sink.getter as Getter<string>)(); })); break; }
                case 'textMono': { const node = sink.node ?? document.createTextNode(sink.mono!.peek()); if (!sink.node) this.#dom!.appendChild(node); sinkText(sink.mono!, node); break; }
                case 'attr': { const el = this.#dom!; this.#effects.push(effect(() => { const v = (sink.getter as Getter<string | null>)(); if (v === null) el.removeAttribute(sink.name!); else el.setAttribute(sink.name!, v); })); break; }
                case 'cls': { const el = this.#dom!; this.#effects.push(effect(() => { if ((sink.getter as Getter<boolean>)()) el.classList.add(sink.name!); else el.classList.remove(sink.name!); })); break; }
                case 'prop': { const rec = this.#dom as unknown as Record<string, unknown>; this.#effects.push(effect(() => { rec[sink.name!] = sink.getter(); })); break; }
                case 'style': { const el = this.#dom as HTMLElement; const p = sink.name!.replace(/([A-Z])/g, c => `-${c.toLowerCase()}`); this.#effects.push(effect(() => { el.style.setProperty(p, (sink.getter as Getter<string>)()); })); break; }
                case 'bind': { const rec = this.#dom as unknown as Record<string, unknown>; this.#effects.push(effect(() => { rec['value'] = (sink.getter as Getter<string>)(); })); if (sink.setter) this.#dom!.addEventListener('input', e => sink.setter!((e.target as HTMLInputElement).value)); break; }
                case 'shadow': {
                    const mode = sink.shadowModeRule ?? sink.shadowMode ?? 'drop';
                    (this.#dom as HTMLElement).style.boxShadow = _shadowCSS('open', mode as ShadowMode | ShadowLayer[] | Rule | Sheet, sink.shadowOpts ?? {});
                    break;
                }
            }
        }
        this.#sinks = [];
    }
    valueOf(): Element { return this.render(); }
    log(v?: unknown): this { console.log(v ?? this.#dom ?? `[VirtualNode <${this.#tag}> unmounted]`); return this; }
    on(type: string, cb: EventListener, opts?: AddEventListenerOptions | boolean): this { if (this.#dom) this.#dom.addEventListener(type, cb, opts); else this.#domQueue.push({ type, cb, ...(opts !== undefined ? { opts } : {}) }); return this; }
    off(type: string, cb: EventListener, opts?: EventListenerOptions | boolean): this { this.#dom?.removeEventListener(type, cb, opts); return this; }
    fire(type: string, init?: CustomEventInit): this { this.#dom?.dispatchEvent(new CustomEvent(type, init)); return this; }
    append(parent: string | Element | VirtualNode | { render(): Element } | null): this { const p = typeof parent === 'string' ? document.querySelector(parent) : parent instanceof VirtualNode ? parent.render() : typeof (parent as { render?(): Element })?.render === 'function' ? (parent as { render(): Element }).render() : parent instanceof Element ? parent : null; if (p) p.appendChild(this.render()); this.#mounted = true; return this; }
    mount(parent?: string | Element | VirtualNode | null): this { return this.append(parent ?? null); }
    unmount(): this { this.#dom?.parentNode?.removeChild(this.#dom); this.#mounted = false; return this; }
    add(...args: (VChild | number)[]): this { const last = args[args.length-1]; const items = typeof last === 'number' ? args.slice(0,-1) : args; const index = typeof last === 'number' ? last : this.#children.length; const vnodes = (items as VChild[]).map(normalizeChild); this.#children.splice(index, 0, ...vnodes); if (this.#dom) { const ref = this.#dom.childNodes[index] ?? null; const frag = document.createDocumentFragment(); vnodes.forEach(n => frag.appendChild(n.render())); this.#dom.insertBefore(frag, ref); } return this; }
    push(...nodes: VChild[]): this    { return this.add(...nodes); }
    unshift(...nodes: VChild[]): this { return this.add(...nodes, 0); }
    remove(...targets: (string | number | VirtualNode)[]): this { for (const t of targets) { if (typeof t === 'number') { const vn = this.#children.splice(t,1)[0]; if (vn) { const el = vn.render(); el.parentNode?.removeChild(el); } } else if (typeof t === 'string') { const el = this.#dom?.querySelector(t); el?.parentNode?.removeChild(el); } else if (t instanceof VirtualNode) { const i = this.#children.indexOf(t); if (i >= 0) this.#children.splice(i,1); if (t.#dom) t.#dom.parentNode?.removeChild(t.#dom); } } return this; }
    shift(n = 1): this { for (let i = 0; i < n; i++) { const vn = this.#children.shift(); if (vn) { const el = vn.render(); el.parentNode?.removeChild(el); } } return this; }
    pop(n = 1): this   { for (let i = 0; i < n; i++) { const vn = this.#children.pop();   if (vn) { const el = vn.render(); el.parentNode?.removeChild(el); } } return this; }
    get(name: string): string | undefined { return this.#dom?.getAttribute(name) ?? (this.#attrs[name] !== undefined && this.#attrs[name] !== null ? String(this.#attrs[name]) : undefined); }
    set(name: string, value: string | number | boolean | null): this { if (this.#dom) { if (name in (this.#dom as unknown as Record<string, unknown>)) (this.#dom as unknown as Record<string, unknown>)[name] = value; else if (value !== null) this.#dom.setAttribute(name, String(value)); else this.#dom.removeAttribute(name); } else this.#attrs[name] = value; return this; }
    css(prop: string, val: string): this { if (this.#dom) (this.#dom as HTMLElement).style.setProperty(prop, val); return this; }
    show(): this { this.css('display', ''); return this; }
    hide(): this { this.css('display', 'none'); return this; }
    child(path: number[]): Node { let n: Node = this.render(); for (const i of path) n = n.childNodes[i]!; return n; }
    shadow(state: ShadowState, mode: ShadowMode | ShadowLayer[] | Rule | Sheet = 'drop', opts: ShadowOptions = {}): this {
        if (this.#dom) (this.#dom as HTMLElement).style.boxShadow = _shadowCSS(state, mode, opts);
        else if (state === 'close') this.#sinks.push({ type: 'shadow', getter: () => null, shadowOpts: {} });
        else if (mode instanceof Rule || mode instanceof Sheet) this.#sinks.push({ type: 'shadow', getter: () => null, shadowModeRule: mode, shadowOpts: opts });
        else this.#sinks.push({ type: 'shadow', getter: () => null, shadowMode: mode as ShadowMode | ShadowLayer[], shadowOpts: opts });
        return this;
    }
    signal<T>(value: T): Signal<T>         { return signal(value); }
    signalMono<T>(value: T): SignalMono<T> { return signalMono(value); }
    effect(fn: () => void): this { if (this.#dom) this.#effects.push(effect(fn)); else this.#sinks.push({ type: 'text', getter: fn as Getter<string> }); return this; }
    computed<T>(fn: () => T): ReadonlySignal<T> { const s = signal<T>(undefined as T); this.#effects.push(effect(() => s.set(fn()))); return s.readonly(); }
    text(getter: Getter<string>): this { if (this.#dom) { const n = document.createTextNode(getter()); this.#dom.appendChild(n); this.#effects.push(effect(() => { n.nodeValue = getter(); })); } else this.#sinks.push({ type: 'text', getter }); return this; }
    textMono(s: SignalMono<string>, node?: Text): this { if (this.#dom) { const n = node ?? document.createTextNode(s.peek()); if (!node) this.#dom.appendChild(n); sinkText(s, n); } else this.#sinks.push({ type: 'textMono', getter: s.peek as Getter<string>, mono: s, ...(node !== undefined ? { node } : {}) }); return this; }
    attr(name: string, getter: Getter<string | null>): this { if (this.#dom) { const el = this.#dom; this.#effects.push(effect(() => { const v = getter(); if (v === null) el.removeAttribute(name); else el.setAttribute(name, v); })); } else this.#sinks.push({ type: 'attr', getter, name }); return this; }
    cls(name: string, getter: Getter<boolean>): this { if (this.#dom) { const el = this.#dom; this.#effects.push(effect(() => { if (getter()) el.classList.add(name); else el.classList.remove(name); })); } else this.#sinks.push({ type: 'cls', getter, name }); return this; }
    clsMono(name: string): (v: boolean) => void { const el = this.render(); return (v: boolean) => { if (v) el.classList.add(name); else el.classList.remove(name); }; }
    prop(name: string, getter: Getter<unknown>): this { if (this.#dom) { const rec = this.#dom as unknown as Record<string, unknown>; this.#effects.push(effect(() => { rec[name] = getter(); })); } else this.#sinks.push({ type: 'prop', getter, name }); return this; }
    style(prop: string, getter: Getter<string>): this { if (this.#dom) { const el = this.#dom as HTMLElement; const p = prop.replace(/([A-Z])/g, c => `-${c.toLowerCase()}`); this.#effects.push(effect(() => { el.style.setProperty(p, getter()); })); } else this.#sinks.push({ type: 'style', getter, name: prop }); return this; }
    bind(getter: Getter<string>, setter?: (v: string) => void): this { this.prop('value', getter); if (setter) this.on('input', e => setter((e.target as HTMLInputElement).value)); return this; }
    destroy(): this { this.#effects.forEach(s => s()); this.#effects = []; this.#sinks = []; return this; }
    static signal     = signal;
    static signalMono = signalMono;
    static sinkText   = sinkText;
    static effect     = effect;
    static computed   = computed;
    static batch      = batch;
    static untrack    = untrack;
    static tpl        = (html: string) => new AriannATemplate(html);
    static template   = (html: string) => new AriannATemplate(html);
}
if (typeof window !== 'undefined') Object.defineProperty(window, 'Virtual', { value: VirtualNode, writable: false, enumerable: false, configurable: false });
export default VirtualNode;
