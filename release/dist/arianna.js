// core/Core.ts
function uuid() {
  const b = [];
  for (let i = 0; i < 9; i++)
    b.push(Math.floor(1 + Math.random() * 65536).toString(16).slice(1));
  return `${b[1]}${b[2]}-${b[3]}-${b[4]}-${b[5]}-${b[6]}${b[7]}${b[8]}`;
}
var version = Object.freeze(
  {
    major: 1,
    minor: 0,
    patch: 0,
    get string() {
      return `${this.major}.${this.minor}.${this.patch}`;
    }
  }
);
var Scopes = Object.freeze(
  {
    Private: { configurable: false, enumerable: false, writable: false },
    Readonly: { configurable: false, enumerable: true, writable: false },
    Writable: { configurable: false, enumerable: true, writable: true },
    Configurable: { configurable: true, enumerable: true, writable: false }
  }
);
function GetPrototypeChain(obj) {
  const chain = [];
  let proto = typeof obj === "function" ? obj.prototype : Object.getPrototypeOf(obj);
  while (proto !== null) {
    const ctor = proto.constructor;
    if (ctor?.name) chain.push(ctor.name);
    proto = Object.getPrototypeOf(proto);
  }
  return chain;
}
function SetDescriptors(target, scope, recurse = false) {
  const d = { ...scope };
  for (const key of Object.keys(target)) {
    d.value = target[key];
    try {
      Object.defineProperty(target, key, d);
    } catch {
    }
    if (recurse && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
      SetDescriptors(
        target[key],
        scope,
        true
      );
    }
  }
}
var Namespaces = {};
function RegisterNamespace(key, ns) {
  if (Namespaces[key]) {
    console.warn(`Core.RegisterNamespace: '${key}' already registered \u2014 skipping.`);
    return;
  }
  Namespaces[key] = ns;
}
function GetDescriptor(obj) {
  if (!obj) return false;
  let key;
  const t = typeof obj;
  if (t === "string") {
    key = obj.toLowerCase();
  } else if (t === "function") {
    key = obj.name.toLowerCase();
  } else if (obj instanceof Node) {
    key = obj.nodeName.toLowerCase();
  } else {
    const o = obj;
    const tagKey = Object.keys(o).find((k) => k.toUpperCase() === "TAG");
    if (!tagKey) return false;
    key = String(o[tagKey]).toLowerCase();
  }
  for (const nsKey of Object.keys(Namespaces)) {
    const ns = Namespaces[nsKey];
    const std = ns.types.standard;
    const cst = ns.types.custom;
    const found = std.tags[key] ?? std.interfaces[key] ?? cst.tags[key] ?? cst.interfaces[key];
    if (found) return found;
    if (typeof obj === "function") {
      for (const k of Object.keys(std.interfaces)) {
        const d = std.interfaces[k];
        if (k.toLowerCase() === key || d.Constructor === obj || d.Interface === obj) return d;
      }
      for (const k of Object.keys(cst.interfaces)) {
        const d = cst.interfaces[k];
        if (k.toLowerCase() === key || d.Constructor === obj || d.Interface === obj) return d;
      }
    }
  }
  return false;
}
function Define(tag, constructor, base = HTMLElement, style = {}) {
  const ct = tag.toLowerCase();
  const existing = GetDescriptor(ct);
  if (existing) {
    console.warn(`Core.Define: '${ct}' already registered.`);
    return existing;
  }
  let ns = null;
  const baseDsc = GetDescriptor(base);
  if (baseDsc && baseDsc.Namespace) {
    ns = baseDsc.Namespace;
  } else {
    for (const nsKey of Object.keys(Namespaces)) {
      const candidate = Namespaces[nsKey];
      if (candidate.base === base) {
        ns = candidate;
        break;
      }
      for (const k of Object.keys(candidate.types.standard.interfaces)) {
        const d = candidate.types.standard.interfaces[k];
        if (d.Constructor === base || d.Interface === base) {
          ns = candidate;
          break;
        }
      }
      if (ns) break;
    }
  }
  if (!ns) {
    ns = Namespaces["html"] ?? Object.values(Namespaces)[0];
    console.warn(`Core.Define: base '${base.name}' not found in any registered namespace \u2014 defaulting to html.`);
  }
  const isClass = /^class[\s{]/.test(constructor.toString());
  const descriptor = {
    Name: constructor.name,
    Tags: [ct],
    Namespace: ns,
    Constructor: constructor,
    Interface: base,
    Prototype: constructor.prototype,
    Supported: true,
    Defined: true,
    Declaration: isClass ? "CLASS" : "FUNCTION",
    Type: "CUSTOM",
    Standard: false,
    Custom: true,
    Style: style,
    Update: (el) => {
      Object.setPrototypeOf(constructor.prototype, base.prototype);
      Object.setPrototypeOf(el, constructor.prototype);
      if (isClass) {
        try {
          const src = constructor.toString();
          const m = src.match(/constructor\s*\(\s*\)\s*\{([\s\S]*?)\}(?=\s*\})/);
          if (m) {
            const fn = new Function(`return function(){${m[1]}}`)();
            fn.call(el);
          }
        } catch (_) {
        }
      } else {
        constructor.call(el);
      }
    }
  };
  ns.types.custom.interfaces[constructor.name] = descriptor;
  ns.types.custom.tags[ct] = descriptor;
  document.dispatchEvent(new CustomEvent("arianna-wip:defined", {
    detail: { tag: ct, descriptor }
  }));
  return descriptor;
}
var Events = Object.freeze(
  {
    /**
     * Add a DOM event listener to one or more targets.
     * Prefer `Observable.On` for full listener tracking and registry.
     * @example
     *   Core.Events.On(element, 'click', handler);
     *   Core.Events.On('.btn', 'click mouseenter', handler, { passive: true });
     */
    On(target, types, callback, options) {
      _resolveTargets(target).forEach((el) => _splitTypes(types).forEach((t) => el.addEventListener(t, callback, options)));
    },
    /**
     * Remove a DOM event listener from one or more targets.
     * @example
     *   Core.Events.Off(element, 'click', handler);
     */
    Off(target, types, callback, options) {
      _resolveTargets(target).forEach((el) => _splitTypes(types).forEach((t) => el.removeEventListener(t, callback, options)));
    },
    /**
     * Dispatch a CustomEvent on one or more targets.
     * @example
     *   Core.Events.Fire(button, 'click', { detail: { value: 42 } });
     */
    Fire(target, type, init) {
      const ev = new CustomEvent(type, { bubbles: true, composed: true, ...init });
      _resolveTargets(target).forEach((el) => el.dispatchEvent(ev));
    }
  }
);
function _resolveTargets(t) {
  if (typeof t === "string")
    return Array.from(document.querySelectorAll(t));
  return Array.isArray(t) ? t : [t];
}
function _splitTypes(s) {
  return s.split(/\s+|,|\|/g).filter(Boolean);
}
var Observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type === "attributes" && m.target instanceof Element) {
      const attr = m.target.attributes.getNamedItem(m.attributeName ?? "");
      if (attr) {
        const evName = /^(\w+)/.exec(attr.name)?.[1]?.toLowerCase() ?? attr.name;
        m.target.dispatchEvent(new CustomEvent(`${evName}-change`, {
          detail: { element: m.target, attribute: attr }
        }));
      }
    }
    if (m.type === "childList") {
      for (const node of Array.from(m.addedNodes)) {
        const d = node instanceof Element ? GetDescriptor(node) : false;
        const detail = {
          node,
          descriptor: d,
          state: { loading: true, loaded: false, name: "Loading" }
        };
        if (node instanceof Element)
          node.dispatchEvent(new CustomEvent("arianna-wip:nodeadding", { detail }));
        if (d && d.Custom && d.Constructor && d.Update)
          d.Update(node);
        detail.state = { loading: false, loaded: true, name: "Loaded" };
        document.dispatchEvent(new CustomEvent("arianna-wip:nodeadded", { detail }));
      }
      for (const node of Array.from(m.removedNodes)) {
        const d = node instanceof Element ? GetDescriptor(node) : false;
        document.dispatchEvent(new CustomEvent("arianna-wip:noderemoved", {
          detail: { node, descriptor: d }
        }));
      }
    }
  }
});
if (typeof document !== "undefined") {
  Observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true
  });
}
var _installedPlugins = /* @__PURE__ */ new Set();
function use(plugin, options = {}) {
  if (_installedPlugins.has(plugin.name)) {
    console.warn(`Core.use: plugin '${plugin.name}' is already installed.`);
    return;
  }
  plugin.install(_coreApi, options);
  _installedPlugins.add(plugin.name);
}
function plugins() {
  return Array.from(_installedPlugins);
}
var _coreApi;
function _buildCore() {
  return {
    version,
    Uuid: uuid,
    GetPrototypeChain,
    SetDescriptors,
    Scopes,
    Namespaces,
    RegisterNamespace,
    GetDescriptor,
    Define,
    Events,
    Observer,
    use,
    plugins,
    Root: typeof document !== "undefined" ? document.documentElement : null
  };
}
var Core = Object.freeze(_buildCore());
_coreApi = Core;
if (typeof window !== "undefined") {
  Object.defineProperty(window, "Core", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Core
  });
}
var Core_default = Core;

// core/Observable.ts
function uuid2() {
  const b = [];
  for (let i = 0; i < 9; i++)
    b.push(Math.floor(1 + Math.random() * 65536).toString(16).slice(1));
  return `${b[1]}${b[2]}-${b[3]}-${b[4]}-${b[5]}-${b[6]}${b[7]}${b[8]}`;
}
var _activeEffect = null;
var _batchDepth = 0;
var _pendingEffects = [];
function _notify(subs) {
  if (_batchDepth > 0) {
    subs.forEach((e) => {
      if (!_pendingEffects.includes(e)) _pendingEffects.push(e);
    });
    return;
  }
  [...subs].forEach((e) => e.run());
}
function signal(value) {
  const subs = /* @__PURE__ */ new Set();
  return {
    get() {
      if (_activeEffect) subs.add(_activeEffect);
      return value;
    },
    set(v) {
      if (Object.is(v, value)) return;
      value = v;
      _notify(subs);
    },
    peek() {
      return value;
    },
    readonly() {
      return { get: () => {
        if (_activeEffect) subs.add(_activeEffect);
        return value;
      }, peek: () => value };
    }
  };
}
function signalMono(value) {
  const s = {
    _sub: null,
    get() {
      return value;
    },
    set(v) {
      if (!Object.is(v, value)) {
        value = v;
        s._sub?.();
      }
    },
    peek() {
      return value;
    }
  };
  return s;
}
function sinkText(s, node) {
  node.nodeValue = s.peek();
  s._sub = () => {
    node.nodeValue = s.peek();
  };
}
function sinkClass(el, cls, getter) {
  const update = () => {
    if (getter()) el.classList.add(cls);
    else el.classList.remove(cls);
  };
  update();
  return update;
}
function effect(fn) {
  const runner = {
    deps: /* @__PURE__ */ new Set(),
    run() {
      runner.deps.forEach((d) => d.delete(runner));
      runner.deps.clear();
      const prev = _activeEffect;
      _activeEffect = runner;
      try {
        fn();
      } finally {
        _activeEffect = prev;
      }
    }
  };
  runner.run();
  return () => {
    runner.deps.forEach((d) => d.delete(runner));
    runner.deps.clear();
  };
}
function computed(fn) {
  const s = signal(void 0);
  effect(() => s.set(fn()));
  return s.readonly();
}
function batch(fn) {
  _batchDepth++;
  try {
    fn();
  } finally {
    if (--_batchDepth === 0) {
      const p = _pendingEffects.splice(0);
      p.forEach((e) => e.run());
    }
  }
}
function untrack(fn) {
  const prev = _activeEffect;
  _activeEffect = null;
  try {
    return fn();
  } finally {
    _activeEffect = prev;
  }
}
var AriannATemplate = class {
  #tpl;
  constructor(html) {
    this.#tpl = document.createElement("template");
    this.#tpl.innerHTML = html;
  }
  /**
   * Clona il primo elemento del template — O(1) in C++.
   * Zero HTML parsing. Zero allocazione JS oltre il nodo clonato.
   */
  clone() {
    return this.#tpl.content.firstElementChild.cloneNode(true);
  }
  /**
   * Clona l'intero content come DocumentFragment.
   * Per template con più elementi root.
   */
  cloneAll() {
    return this.#tpl.content.cloneNode(true);
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
  walk(root, path) {
    let n = root;
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
  walkAll(root, ...paths) {
    return paths.map((p) => this.walk(root, p));
  }
  /** Il DocumentFragment interno — read-only. */
  get content() {
    return this.#tpl.content;
  }
};
var DOM_TYPES = Object.freeze(
  {
    click: { Name: "click", Interface: MouseEvent },
    dblclick: { Name: "dblclick", Interface: MouseEvent },
    mouseenter: { Name: "mouseenter", Interface: MouseEvent },
    mouseleave: { Name: "mouseleave", Interface: MouseEvent },
    mousemove: { Name: "mousemove", Interface: MouseEvent },
    mouseout: { Name: "mouseout", Interface: MouseEvent },
    mouseover: { Name: "mouseover", Interface: MouseEvent },
    mouseup: { Name: "mouseup", Interface: MouseEvent },
    mousedown: { Name: "mousedown", Interface: MouseEvent },
    contextmenu: { Name: "contextmenu", Interface: MouseEvent },
    drag: { Name: "drag", Interface: DragEvent },
    dragend: { Name: "dragend", Interface: DragEvent },
    dragenter: { Name: "dragenter", Interface: DragEvent },
    dragleave: { Name: "dragleave", Interface: DragEvent },
    dragover: { Name: "dragover", Interface: DragEvent },
    dragstart: { Name: "dragstart", Interface: DragEvent },
    drop: { Name: "drop", Interface: DragEvent },
    wheel: { Name: "wheel", Interface: WheelEvent },
    keypress: { Name: "keypress", Interface: KeyboardEvent },
    keydown: { Name: "keydown", Interface: KeyboardEvent },
    keyup: { Name: "keyup", Interface: KeyboardEvent },
    animationstart: { Name: "animationstart", Interface: AnimationEvent },
    animationend: { Name: "animationend", Interface: AnimationEvent },
    animationiteration: { Name: "animationiteration", Interface: AnimationEvent },
    abort: { Name: "abort", Interface: UIEvent },
    load: { Name: "load", Interface: UIEvent },
    resize: { Name: "resize", Interface: UIEvent },
    scroll: { Name: "scroll", Interface: UIEvent },
    select: { Name: "select", Interface: UIEvent },
    unload: { Name: "unload", Interface: UIEvent },
    focusin: { Name: "focusin", Interface: FocusEvent },
    focusout: { Name: "focusout", Interface: FocusEvent },
    focus: { Name: "focus", Interface: FocusEvent },
    blur: { Name: "blur", Interface: FocusEvent },
    cut: { Name: "cut", Interface: ClipboardEvent },
    copy: { Name: "copy", Interface: ClipboardEvent },
    paste: { Name: "paste", Interface: ClipboardEvent },
    compositionstart: { Name: "compositionstart", Interface: CompositionEvent },
    compositionend: { Name: "compositionend", Interface: CompositionEvent },
    change: { Name: "change", Interface: Event },
    input: { Name: "input", Interface: Event },
    submit: { Name: "submit", Interface: Event },
    reset: { Name: "reset", Interface: Event },
    DOMContentLoaded: { Name: "DOMContentLoaded", Interface: Event },
    message: { Name: "message", Interface: Event },
    online: { Name: "online", Interface: Event },
    offline: { Name: "offline", Interface: Event },
    popstate: { Name: "popstate", Interface: Event },
    hashchange: { Name: "hashchange", Interface: Event },
    beforeunload: { Name: "beforeunload", Interface: Event },
    touchstart: { Name: "touchstart", Interface: TouchEvent },
    touchend: { Name: "touchend", Interface: TouchEvent },
    touchmove: { Name: "touchmove", Interface: TouchEvent },
    touchcancel: { Name: "touchcancel", Interface: TouchEvent },
    pointerdown: { Name: "pointerdown", Interface: PointerEvent },
    pointerup: { Name: "pointerup", Interface: PointerEvent },
    pointermove: { Name: "pointermove", Interface: PointerEvent },
    pointercancel: { Name: "pointercancel", Interface: PointerEvent },
    pointerenter: { Name: "pointerenter", Interface: PointerEvent },
    pointerleave: { Name: "pointerleave", Interface: PointerEvent },
    transitionstart: { Name: "transitionstart", Interface: TransitionEvent },
    transitionend: { Name: "transitionend", Interface: TransitionEvent },
    transitioncancel: { Name: "transitioncancel", Interface: TransitionEvent }
  }
);
var DOM_INTERFACES = {};
for (const [name, desc] of Object.entries(DOM_TYPES)) {
  const iname = desc.Interface.name;
  if (!DOM_INTERFACES[iname]) DOM_INTERFACES[iname] = { Name: iname, Types: {} };
  DOM_INTERFACES[iname].Types[name] = desc;
}
var _globalListeners = /* @__PURE__ */ new Map();
function _toTargets(target) {
  if (typeof target === "string") return typeof document !== "undefined" ? Array.from(document.querySelectorAll(target)) : [];
  return Array.isArray(target) ? target : [target];
}
function _toTypes(types) {
  return types.split(/[\s,|]+/).filter(Boolean);
}
var Observable = class _Observable {
  #events = /* @__PURE__ */ new Map();
  #target;
  #effects = [];
  constructor(target) {
    this.#target = target ?? this;
  }
  // ── Instance Signal API ───────────────────────────────────────────────────
  signal(value) {
    return signal(value);
  }
  signalMono(value) {
    return signalMono(value);
  }
  effect(fn) {
    this.#effects.push(effect(fn));
    return this;
  }
  computed(fn) {
    const s = signal(void 0);
    this.#effects.push(effect(() => s.set(fn())));
    return s.readonly();
  }
  // ── Instance pub/sub ──────────────────────────────────────────────────────
  on(types, cb) {
    const ls = { Id: uuid2(), Handler: cb, Target: this.#target };
    types.split(/(?!-)\W/g).filter(Boolean).forEach((t) => {
      const b = this.#events.get(t) ?? /* @__PURE__ */ new Set();
      b.add(ls);
      this.#events.set(t, b);
    });
    return this;
  }
  off(type, cb) {
    this.#events.get(type)?.forEach((l) => l.Handler === cb && this.#events.get(type).delete(l));
    return this;
  }
  fire(event) {
    if (!event?.Type) return this;
    this.#events.get(event.Type)?.forEach((l) => l.Handler.call(l.Target, event));
    return this;
  }
  once(event, cb) {
    const w = (e) => {
      cb(e);
      this.off(event.Type, w);
    };
    return this.on(event.Type, w);
  }
  all(event) {
    return this.fire(event);
  }
  destroy() {
    this.#effects.forEach((s) => s());
    this.#effects.length = 0;
    this.#events.clear();
    return this;
  }
  // ── Static DOM bus ────────────────────────────────────────────────────────
  static On(target, types, handler, opts) {
    const ids = [];
    const addOpts = { passive: opts?.Passive, capture: opts?.Capture ?? opts?.Phase === "capture", once: opts?.Once, signal: opts?.Signal };
    for (const t of _toTargets(target)) for (const type of _toTypes(types)) {
      const id = uuid2();
      t.addEventListener(type, handler, addOpts);
      _globalListeners.set(id, { UUID: id, Type: type, Target: t, Function: handler, Propagation: addOpts.capture ? "capture" : "bubble", XML: "" });
      ids.push(id);
    }
    return ids;
  }
  static Off(target, types, handler, opts) {
    for (const t of _toTargets(target)) for (const type of _toTypes(types)) t.removeEventListener(type, handler, { capture: opts?.Capture ?? opts?.Phase === "capture" });
  }
  static Fire(target, type, init, detail) {
    const ev = detail !== void 0 ? new CustomEvent(type, { ...init, ...detail }) : new Event(type, init);
    _toTargets(target).forEach((t) => t.dispatchEvent(ev));
  }
  static Once(target, types, handler, opts) {
    return _Observable.On(target, types, handler, { ...opts, Once: true });
  }
  static Trigger(target, type) {
    _Observable.Fire(target, type);
  }
  static All = _Observable.On;
  static get Listeners() {
    return _globalListeners;
  }
  static GetListener(id) {
    return _globalListeners.get(id);
  }
  static GetListeners(target, type) {
    return [..._globalListeners.values()].filter((r) => r.Target === target && (type === void 0 || r.Type === type));
  }
  static Dom = { Types: DOM_TYPES, Interfaces: DOM_INTERFACES };
  static GetInterface(eventType) {
    return DOM_TYPES[eventType]?.Interface?.name;
  }
  static GetTypes(interfaceName) {
    return Object.keys(DOM_INTERFACES[interfaceName]?.Types ?? {});
  }
  // ── Static Signal + Template shorthands ───────────────────────────────────
  static signal = signal;
  static signalMono = signalMono;
  static sinkText = sinkText;
  static sinkClass = sinkClass;
  static effect = effect;
  static computed = computed;
  static batch = batch;
  static untrack = untrack;
  /**
   * Crea un AriannATemplate — parse HTML una volta, clone O(1) N volte.
   * @example
   *   const tpl = Observable.template('<tr><td></td></tr>');
   *   const tr  = tpl.clone();
   */
  static template(html) {
    return new AriannATemplate(html);
  }
};
if (typeof window !== "undefined")
  Object.defineProperty(window, "Observable", { enumerable: true, configurable: false, writable: false, value: Observable });
var Observable_default = Observable;

// core/Rule.ts
var PAGE_MARGIN_BOXES = /* @__PURE__ */ new Set([
  "TopLeftCorner",
  "TopLeft",
  "TopCenter",
  "TopRight",
  "TopRightCorner",
  "BottomLeftCorner",
  "BottomLeft",
  "BottomCenter",
  "BottomRight",
  "BottomRightCorner",
  "LeftTop",
  "LeftMiddle",
  "LeftBottom",
  "RightTop",
  "RightMiddle",
  "RightBottom"
]);
function toKebab(s) {
  return s.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
}
function toCamel(s) {
  const lc = s.charAt(0).toLowerCase() + s.slice(1);
  return lc.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function trimVal(v) {
  return v.trim().replace(/;$/, "");
}
function parseDeclarations(text) {
  const props = {};
  text.split(";").forEach((decl) => {
    const colon = decl.indexOf(":");
    if (colon < 0) return;
    const key = toCamel(decl.slice(0, colon).trim());
    const val = trimVal(decl.slice(colon + 1));
    if (key && val) props[key] = val;
  });
  return props;
}
function serializeDeclarations(props) {
  return Object.entries(props).map(([k, v]) => `${toKebab(k)}: ${v}`).join("; ");
}
function normaliseProps(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw))
    out[toCamel(k)] = String(v).trim();
  return out;
}
function buildMediaCondition(obj) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (lk === "or") {
      parts.push(`, ${buildMediaCondition(v)}`);
    } else if (lk === "and") {
      parts.push(` and ${buildMediaCondition(v)}`);
    } else if (lk === "not") {
      parts.push(` not (${buildMediaCondition(v)})`);
    } else {
      const prop = toKebab(k).toLowerCase();
      parts.push(`(${prop}: ${v})`);
    }
  }
  return parts.join("");
}
function buildSelector(sel) {
  const type = sel.Type.toLowerCase().trim();
  if (type === "@charset")
    return `@charset "${(sel.Value ?? "UTF-8").replace(/["']/g, "")}"`;
  if (type === "@namespace") {
    const prefix = sel.Prefix ? `${sel.Prefix} ` : "";
    return `@namespace ${prefix}${sel.Url ?? ""}`;
  }
  if (type === "@import") {
    const url = sel.Url ?? "";
    const media = sel.Media ? ` ${sel.Media}` : "";
    const cond = sel.And ? buildMediaCondition(sel.And) : "";
    return `@import ${url}${media}${cond}`;
  }
  if (type === "@media") {
    const media = sel.Media ? ` ${sel.Media}` : "";
    const cond = sel.And ? buildMediaCondition(sel.And) : "";
    return `@media${media}${cond}`;
  }
  if (type === "@supports") {
    const parts = [];
    if (sel.Not)
      parts.push(`not (${buildMediaCondition(sel.Not)})`);
    for (const [k, v] of Object.entries(sel)) {
      const lk = k.toLowerCase();
      if (["type", "not"].includes(lk)) continue;
      if (lk === "or")
        parts.push(`, ${buildMediaCondition(v)}`);
      else if (lk === "and")
        parts.push(` and ${buildMediaCondition(v)}`);
      else
        parts.push(`(${toKebab(k).toLowerCase()}: ${v})`);
    }
    return `@supports ${parts.join(" ")}`;
  }
  if (type === "@document") {
    const conditions = [];
    if (sel.Url) conditions.push(`url("${sel.Url}")`);
    if (sel.Prefix) conditions.push(`url-prefix("${sel.Prefix}")`);
    if (sel.Domain) conditions.push(`domain("${sel.Domain}")`);
    if (sel.Regex) conditions.push(`regexp("${sel.Regex}")`);
    return `@document ${conditions.join(", ")}`;
  }
  if (type === "@page") {
    const name = sel.Name ? ` ${sel.Name}` : "";
    const right = sel.Right ? " :right" : "";
    const left = sel.Left ? " :left" : "";
    return `@page${name}${right}${left}`;
  }
  if (type === "@keyframes")
    return `@keyframes ${sel.Name ?? ""}`;
  if (type === "@counter-style")
    return `@counter-style ${sel.Name ?? ""}`;
  if (type === "@font-face") return "@font-face";
  if (type === "@viewport") return "@viewport";
  return sel.Type;
}
function buildKeyframesText(name, contents) {
  const frames = [];
  for (const [key, val] of Object.entries(contents)) {
    const lk = key.toLowerCase();
    let position;
    let style;
    if (lk === "from") {
      position = "from";
      style = normaliseProps(val);
    } else if (lk === "to") {
      position = "to";
      style = normaliseProps(val);
    } else {
      const frame = val;
      position = frame.Position ?? key;
      style = frame.Style ? normaliseProps(frame.Style) : {};
    }
    const decls = serializeDeclarations(style);
    frames.push(`  ${position} { ${decls}${decls ? ";" : ""} }`);
  }
  return `@keyframes ${name} {
${frames.join("\n")}
}`;
}
function buildPageText(selector, contents) {
  const mainDecls = {};
  const marginBoxes = [];
  for (const [k, v] of Object.entries(contents)) {
    if (PAGE_MARGIN_BOXES.has(k)) {
      const boxSelector = toKebab(k).toLowerCase();
      const props = normaliseProps(v);
      const decls = serializeDeclarations(props);
      marginBoxes.push(`  @${boxSelector} { ${decls}${decls ? ";" : ""} }`);
    } else {
      mainDecls[toCamel(k)] = String(v).trim();
    }
  }
  const main = serializeDeclarations(mainDecls);
  const inner = [
    main ? `  ${main};` : "",
    ...marginBoxes
  ].filter(Boolean).join("\n");
  return `${selector} {
${inner}
}`;
}
var Rule = class _Rule {
  #id;
  #selector;
  #properties;
  #children = [];
  #rawContents = null;
  #selectorObj = null;
  #events = /* @__PURE__ */ new Map();
  constructor(arg0, arg1) {
    this.#id = uuid2();
    if (arg0 instanceof CSSRule) {
      const text = arg0.cssText;
      const m = /^([^{]+)\{([\s\S]*)\}/.exec(text);
      this.#selector = m?.[1]?.trim() ?? "";
      this.#properties = parseDeclarations(m?.[2] ?? "");
    } else if (typeof arg0 === "string") {
      this.#selector = arg0;
      if (!arg1) this.#properties = {};
      else if (typeof arg1 === "string") this.#properties = parseDeclarations(arg1);
      else this.#properties = normaliseProps(arg1);
    } else {
      const def = arg0;
      const rawSel = def.Selector;
      if (rawSel && typeof rawSel === "object") {
        this.#selectorObj = rawSel;
        this.#selector = buildSelector(this.#selectorObj);
      } else {
        this.#selector = rawSel ?? "";
      }
      const body = def.Contents ?? def.Content ?? def.Body ?? def.Rule ?? {};
      if (typeof body === "string") {
        this.#properties = parseDeclarations(body);
      } else {
        const bodyObj = body;
        const type = this.#selectorObj?.Type?.toLowerCase() ?? "";
        if (type === "@keyframes") {
          this.#rawContents = bodyObj;
          this.#properties = {};
        } else if (type === "@page") {
          this.#rawContents = bodyObj;
          this.#properties = {};
        } else {
          this.#properties = normaliseProps(bodyObj);
        }
      }
      if (def.Rules)
        this.#children = Object.values(def.Rules).map((d) => new _Rule(d));
    }
    this.#properties ??= {};
  }
  // ── Identity ──────────────────────────────────────────────────────────────
  get Id() {
    return this.#id;
  }
  // ── Selector ──────────────────────────────────────────────────────────────
  get Selector() {
    return this.#selector;
  }
  set Selector(v) {
    const old = this.#selector;
    this.#selector = v;
    this.#emit("Selector", old, v);
  }
  // ── Type (convenience getter) ─────────────────────────────────────────────
  /** The @-rule keyword, e.g. '@media', '@keyframes', or '' for style rules. */
  get Type() {
    const m = /^(@[\w-]+)/.exec(this.#selector.trim());
    return m?.[1] ?? "";
  }
  // ── Children ──────────────────────────────────────────────────────────────
  /** Nested child Rules (for @media, @supports, @document, @import). */
  get Children() {
    return [...this.#children];
  }
  set Children(v) {
    this.#children = v;
  }
  // ── Properties ───────────────────────────────────────────────────────────
  get Properties() {
    return { ...this.#properties };
  }
  get(name) {
    return this.#properties[toCamel(name)];
  }
  set(name, value) {
    const key = toCamel(name);
    const old = this.#properties[key];
    if (old === value) return this;
    this.#properties[key] = trimVal(value);
    this.#emit(key, old, value);
    return this;
  }
  remove(name) {
    const key = toCamel(name);
    const old = this.#properties[key];
    if (old === void 0) return this;
    delete this.#properties[key];
    this.#emit(key, old, void 0);
    return this;
  }
  merge(props) {
    for (const [k, v] of Object.entries(props)) this.set(k, v);
    return this;
  }
  replace(props) {
    const old = { ...this.#properties };
    this.#properties = typeof props === "string" ? parseDeclarations(props) : normaliseProps(props);
    this.#emit("*", old, this.#properties);
    return this;
  }
  has(name) {
    return toCamel(name) in this.#properties;
  }
  // ── Serialization ─────────────────────────────────────────────────────────
  /**
   * Full CSS rule text ready to insert into a stylesheet.
   * Handles: standard rules, @keyframes with frames, @page with margin-boxes,
   * nested rules (@media/@supports/@document/@import with child rules).
   */
  get Text() {
    const type = this.Type.toLowerCase();
    if (type === "@charset" || type === "@namespace")
      return `${this.#selector};`;
    if (type === "@keyframes" && this.#rawContents) {
      const name = this.#selectorObj?.Name ?? this.#selector.replace("@keyframes", "").trim();
      return buildKeyframesText(name, this.#rawContents);
    }
    if (type === "@page" && this.#rawContents)
      return buildPageText(this.#selector, this.#rawContents);
    if (this.#children.length > 0) {
      const inner = this.#children.map((c) => "  " + c.Text.replace(/\n/g, "\n  ")).join("\n");
      return `${this.#selector} {
${inner}
}`;
    }
    const decls = serializeDeclarations(this.#properties);
    return `${this.#selector} { ${decls}${decls ? ";" : ""} }`;
  }
  get cssText() {
    return this.Text;
  }
  toString() {
    return this.Text;
  }
  // ── Pub/sub ───────────────────────────────────────────────────────────────
  on(types, cb) {
    types.split(/\s+|,|\|/g).filter(Boolean).forEach((t) => {
      const b = this.#events.get(t) ?? /* @__PURE__ */ new Set();
      b.add(cb);
      this.#events.set(t, b);
    });
    return this;
  }
  off(type, cb) {
    this.#events.get(type)?.forEach((l) => l === cb && this.#events.get(type).delete(l));
    return this;
  }
  fire(event) {
    if (!event?.Type) return this;
    this.#events.get(event.Type)?.forEach((l) => l(event));
    return this;
  }
  #emit(name, old, nv) {
    const ev = {
      Type: `Rule-${name}-Changed`,
      Rule: this,
      Property: { Name: name, Old: old, New: nv }
    };
    this.fire(ev);
    ev.Type = "Rule-Changed";
    this.fire(ev);
  }
  // ── Comparison ────────────────────────────────────────────────────────────
  matches(other) {
    if (typeof other === "string") return this.#selector.trim() === other.trim();
    if (other instanceof CSSRule) return this.#selector.trim() === other.selectorText?.trim();
    return this.#selector.trim() === other.Selector.trim();
  }
  clone() {
    const r = new _Rule(this.#selector, { ...this.#properties });
    r.#children = this.#children.map((c) => c.clone());
    r.#rawContents = this.#rawContents ? { ...this.#rawContents } : null;
    r.#selectorObj = this.#selectorObj ? { ...this.#selectorObj } : null;
    return r;
  }
  // ── Static helpers ────────────────────────────────────────────────────────
  /**
   * Parse a CSS text string into Rule instances via browser parser.
   */
  static Parse(text) {
    const style = document.createElement("style");
    style.textContent = text;
    document.head.appendChild(style);
    const rules = Array.from(style.sheet?.cssRules ?? []).map((r) => new _Rule(r));
    document.head.removeChild(style);
    return rules;
  }
  static From(cssRule) {
    return new _Rule(cssRule);
  }
  // ── Golem static API ──────────────────────────────────────────────────────
  /**
   * Return the selector string from a RuleDefinition.
   * Mirrors Golem's Css.GetSelector().
   *
   * @example
   *   Rule.GetSelector({ Selector: { Type: '@media', Media: 'screen' } })
   *   // '@media screen'
   */
  static GetSelector(def) {
    const sel = def.Selector;
    if (!sel) return "";
    if (typeof sel === "string") return sel;
    return buildSelector(sel);
  }
  /**
   * Return the @-rule type keyword from a RuleDefinition.
   * Mirrors Golem's Css.GetType().
   *
   * @example
   *   Rule.GetType({ Selector: { Type: '@keyframes', Name: 'spin' } })
   *   // '@keyframes'
   */
  static GetType(def) {
    const sel = def.Selector;
    if (!sel) return "";
    if (typeof sel === "string") {
      const m = /^(@[\w-]+)/.exec(sel.trim());
      return m?.[1] ?? "";
    }
    return sel.Type ?? "";
  }
  /**
   * Return the contents/properties object from a RuleDefinition.
   * Mirrors Golem's Css.GetContents().
   */
  static GetContents(def) {
    const body = def.Contents ?? def.Content ?? def.Body ?? def.Rule ?? {};
    if (typeof body === "string") return parseDeclarations(body);
    return body;
  }
  /**
   * Serialize a RuleDefinition to its CSS text string.
   * Mirrors Golem's Css.GetText().
   */
  static GetText(def) {
    return new _Rule(def).Text;
  }
  /**
   * Parse a CSS text string into a structured JS object.
   * Mirrors Golem's Css.GetObject().
   *
   * Returns an object keyed by selector with contents as nested objects.
   *
   * @example
   *   Rule.GetObject('@media screen { .btn { color: red } }')
   *   // { '@media screen': { '.btn': { color: 'red' } } }
   *
   *   Rule.GetObject('@keyframes spin { from { transform: rotate(0) } }')
   *   // { '@keyframes spin': { from: { transform: 'rotate(0)' } } }
   */
  static GetObject(cssText) {
    if (!cssText?.trim()) return {};
    const result = {};
    const style = document.createElement("style");
    style.textContent = cssText;
    document.head.appendChild(style);
    try {
      const rules = Array.from(style.sheet?.cssRules ?? []);
      for (const rule of rules) {
        if (rule instanceof CSSStyleRule) {
          const decls = {};
          for (let i = 0; i < rule.style.length; i++) {
            const p = rule.style[i] ?? "";
            if (p) decls[toCamel(p)] = rule.style.getPropertyValue(p).trim();
          }
          result[rule.selectorText] = decls;
        } else if (rule instanceof CSSKeyframesRule) {
          const frames = {};
          Array.from(rule.cssRules).forEach((fr) => {
            const kf = fr;
            const decls = {};
            for (let i = 0; i < kf.style.length; i++) {
              const p = kf.style[i] ?? "";
              if (p) decls[toCamel(p)] = kf.style.getPropertyValue(p).trim();
            }
            frames[kf.keyText] = decls;
          });
          result[`@keyframes ${rule.name}`] = frames;
        } else if (rule instanceof CSSMediaRule) {
          const inner = {};
          Array.from(rule.cssRules).forEach((r) => {
            if (r instanceof CSSStyleRule) {
              const d = {};
              for (let i = 0; i < r.style.length; i++) {
                const p = r.style[i] ?? "";
                if (p) d[toCamel(p)] = r.style.getPropertyValue(p).trim();
              }
              inner[r.selectorText] = d;
            }
          });
          const mediaKey = rule.conditionText ? `@media ${rule.conditionText}` : (rule.cssText.split("{")[0] ?? "").trim();
          result[mediaKey] = inner;
        } else if (rule instanceof CSSSupportsRule) {
          const inner = {};
          Array.from(rule.cssRules).forEach((r) => {
            const obj = _Rule.GetObject(r.cssText);
            Object.assign(inner, obj);
          });
          result[`@supports ${rule.conditionText}`] = inner;
        } else if (rule instanceof CSSFontFaceRule) {
          const d = {};
          for (let i = 0; i < rule.style.length; i++) {
            const p = rule.style[i] ?? "";
            if (p) d[toCamel(p)] = rule.style.getPropertyValue(p).trim();
          }
          result["@font-face"] = d;
        } else if (rule instanceof CSSImportRule) {
          result[`@import ${rule.href}`] = { href: rule.href, media: rule.media?.mediaText ?? "" };
        } else if (rule instanceof CSSNamespaceRule) {
          result["@namespace"] = { prefix: rule.prefix, namespaceURI: rule.namespaceURI };
        } else if (rule instanceof CSSPageRule) {
          const d = {};
          for (let i = 0; i < rule.style.length; i++) {
            const p = rule.style[i] ?? "";
            if (p) d[toCamel(p)] = rule.style.getPropertyValue(p).trim();
          }
          result[`@page ${rule.selectorText}`.trim()] = d;
        } else {
          const m = /^([^{]+)\{([\s\S]*)\}/.exec(rule.cssText);
          if (m) {
            const key = m[1]?.trim();
            const val = m[2];
            if (key && val !== void 0) result[key] = parseDeclarations(val);
          }
        }
      }
    } finally {
      document.head.removeChild(style);
    }
    return result;
  }
};
var CssState = class {
  #element;
  #eventName;
  #baseRule;
  #stateProps;
  #keyframes = null;
  action;
  constructor(element, eventName, baseRule, stateProps, action, keyframeSelector, keyframeContents) {
    this.#element = element;
    this.#eventName = eventName.toLowerCase().replace(/^mouse/, "mouse");
    this.#baseRule = baseRule;
    this.#stateProps = normaliseProps(stateProps);
    this.action = action ?? null;
    if (keyframeSelector && keyframeContents) {
      const name = keyframeSelector.replace(/@[Kk]eyframes\s+/, "").trim();
      this.#keyframes = new Rule({
        Selector: { Type: "@keyframes", Name: name },
        Contents: keyframeContents
      });
      const style = document.createElement("style");
      style.textContent = this.#keyframes.Text;
      document.head.appendChild(style);
    }
    const domEvent = this.#mapEvent(eventName);
    element.addEventListener(domEvent, (e) => {
      this.#baseRule.merge(this.#stateProps);
      this.action?.(e);
    });
  }
  #mapEvent(name) {
    const map = {
      "mousedown": "mousedown",
      "mouseup": "mouseup",
      "mouseout": "mouseout",
      "mouseover": "mouseover",
      "mousemove": "mousemove",
      "mouseenter": "mouseenter",
      "mouseleave": "mouseleave",
      "click": "click",
      "focus": "focus",
      "blur": "blur"
    };
    return map[name.toLowerCase()] ?? name.toLowerCase();
  }
  get Keyframes() {
    return this.#keyframes;
  }
};
if (typeof window !== "undefined") {
  Object.defineProperty(window, "Rule", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Rule
  });
  const CssNamespace = {
    GetSelector: (def) => Rule.GetSelector(def),
    GetType: (def) => Rule.GetType(def),
    GetContents: (def) => Rule.GetContents(def),
    GetText: (def) => Rule.GetText(def),
    GetObject: (cssText) => Rule.GetObject(cssText),
    State: CssState
  };
  if (!("Css" in window))
    Object.defineProperty(window, "Css", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: CssNamespace
    });
}
var Rule_default = Rule;

// core/Stylesheet.ts
function toCamel2(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function parseLess(source) {
  const lines = source.replace(/\/\/[^\n]*/g, "").split("\n");
  const vars = {};
  const cleanLines = lines.map((line) => {
    const m = /^\s*[@$]([\w-]+)\s*[:=]\s*(.+)$/.exec(line ?? "");
    if (m && m[1] && m[2]) {
      vars[m[1]] = m[2].trim();
      return null;
    }
    return line;
  }).filter((l) => l !== null);
  const substituted = cleanLines.map((line) => {
    return line.replace(/[@$]([\w-]+)/g, (_, name) => vars[name] ?? `@${name}`);
  });
  return buildCss(substituted, 0, []).css;
}
function getIndent(line) {
  const m = /^(\s*)/.exec(line);
  return m ? m[1]?.length ?? 0 : 0;
}
function buildCss(lines, start, parentSelectors) {
  let out = "";
  let i = start;
  let decls = [];
  function flushDecls(selectors) {
    if (!decls.length) return;
    const sel = selectors.join(", ");
    out += `${sel} { ${decls.join("; ")}; }
`;
    decls = [];
  }
  const baseIndent = start < lines.length ? getIndent(lines[start] ?? "") : 0;
  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    const indent = getIndent(raw);
    if (indent < baseIndent && i > start) break;
    const nextLine = lines[i + 1];
    const nextIndent = i + 1 < lines.length && nextLine && nextLine.trim() ? getIndent(nextLine) : 0;
    if (trimmed.endsWith("{")) {
      flushDecls(parentSelectors.length ? parentSelectors : [trimmed.slice(0, -1).trim()]);
      out += raw + "\n";
      i++;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        const l = lines[i] ?? "";
        out += l + "\n";
        depth += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
        i++;
      }
      continue;
    }
    if (nextIndent > indent && !trimmed.includes(":")) {
      flushDecls(parentSelectors.length ? parentSelectors : []);
      const selectors = parentSelectors.length ? parentSelectors.map((p) => `${p} ${trimmed}`) : [trimmed];
      const child = buildCss(lines, i + 1, selectors);
      out += child.css;
      i = child.end;
      continue;
    }
    if (trimmed.includes(":") || trimmed.includes(" ") && !trimmed.startsWith("@")) {
      const decl = trimmed.includes(":") ? trimmed.replace(/:\s*/, ": ") : trimmed.replace(/\s+/, ": ");
      decls.push(decl.replace(/;$/, ""));
    } else if (trimmed.startsWith("@")) {
      flushDecls(parentSelectors.length ? parentSelectors : []);
      out += trimmed + "\n";
    }
    i++;
  }
  flushDecls(parentSelectors.length ? parentSelectors : []);
  return { css: out, end: i };
}
var Sheet = class _Sheet {
  // ── Private fields ─────────────────────────────────────────────────────────
  #head;
  #link = null;
  #sheet = null;
  #rules = [];
  #loaded = false;
  #loading = true;
  #state = "Loading";
  #index = -1;
  #name = "";
  #obs = false;
  // ── Constructor ─────────────────────────────────────────────────────────────
  constructor(...args) {
    this.#head = document.head ?? document.documentElement;
    const input = args.length === 0 ? void 0 : args.length === 1 ? args[0] : (
      /* multiple args */
      args.filter((a) => a instanceof Rule)
    );
    if (input !== void 0) {
      if (typeof input === "string") {
        if (/^https?:\/\/|^\/\//.test(input.trim())) {
          this.#loadUrl(input.trim());
        } else {
          this.#parseText(input);
        }
      } else if (typeof input === "object") {
        if (input instanceof _Sheet) {
          this.#sheet = input.Sheet;
          this.#rules = input.#rules.map((r) => r.clone());
        } else if (input instanceof CSSStyleSheet) {
          this.#sheet = input;
        } else if (input instanceof CSSRuleList) {
          this.#rules = Array.from(input).map((r) => new Rule(r));
        } else if (input instanceof HTMLLinkElement) {
          this.#link = input;
        } else if (input instanceof Rule) {
          this.#rules = [input];
        } else if (Array.isArray(input)) {
          this.#rules = input.map(
            (r) => r instanceof Rule ? r : new Rule(r)
          );
        } else {
          this.#parseObject(input);
        }
      }
    }
    if (!this.#link) {
      this.#link = document.createElement("link");
      this.#link.type = "text/css";
      this.#link.rel = "stylesheet";
    }
    if (!this.#link.href) {
      const blob = new Blob([""], { type: "text/css" });
      this.#link.href = URL.createObjectURL(blob);
      this.#head.appendChild(this.#link);
    }
    if (!this.#sheet) {
      const style = document.createElement("style");
      this.#head.appendChild(style);
      this.#sheet = style.sheet;
    }
    if (this.#rules.length) this.#flushRules();
    this.#loaded = true;
    this.#loading = false;
    this.#state = "Loaded";
    this.#index = Array.from(document.styleSheets).indexOf(this.#sheet);
  }
  // ── Private helpers ─────────────────────────────────────────────────────────
  #parseText(text) {
    const style = document.createElement("style");
    style.textContent = text;
    this.#head.appendChild(style);
    if (style.sheet)
      this.#rules = Array.from(style.sheet.cssRules).map((r) => new Rule(r));
    this.#head.removeChild(style);
  }
  #parseObject(obj) {
    for (const [, def] of Object.entries(obj)) {
      const d = def;
      if (d.Selector || d.Contents || d.Content || d.Rule || d.Body) {
        this.#rules.push(new Rule(d));
      } else {
        for (const [sel, props] of Object.entries(obj)) {
          if (typeof props === "object" && !("Selector" in props))
            this.#rules.push(new Rule(sel, props));
        }
        break;
      }
    }
  }
  /**
   * Fetch an external stylesheet URL and parse its rules.
   * Fires 'Sheet-Loaded' on completion, 'Sheet-Error' on failure.
   */
  #loadUrl(url) {
    this.#loading = true;
    this.#loaded = false;
    this.#state = "Loading";
    fetch(url).then((r) => r.text()).then((text) => {
      this.#parseText(text);
      this.#loaded = true;
      this.#loading = false;
      this.#state = "Loaded";
      this.#flushRules();
      this.#emit("Sheet-Loaded", { url });
    }).catch((err) => {
      this.#state = "Error";
      this.#loading = false;
      this.#emit("Sheet-Error", { url, error: err });
    });
  }
  #flushRules() {
    if (!this.#sheet) return;
    while (this.#sheet.cssRules.length)
      this.#sheet.deleteRule(0);
    this.#rules.forEach((r, i) => {
      try {
        this.#sheet.insertRule(r.Text, i);
      } catch (e) {
        console.warn(`Sheet: could not insert rule "${r.Selector}":`, e);
      }
    });
  }
  #emit(type, detail) {
    if (this.#obs instanceof Observable_default)
      this.#obs.fire({ Type: type, Sheet: this, Detail: detail });
  }
  // ── Static API ───────────────────────────────────────────────────────────────
  static get Sheets() {
    return Array.from(document.styleSheets).map((s) => new _Sheet(s));
  }
  static get Links() {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  }
  static get Paths() {
    return _Sheet.Links.map((l) => l.href).filter(Boolean);
  }
  static ToString(source) {
    if (typeof source === "string") return source;
    if (Array.isArray(source))
      return source.map((r) => r instanceof Rule ? r.Text : r.cssText).join("\n");
    if (source instanceof _Sheet)
      return source.#rules.map((r) => r.Text).join("\n");
    if (source instanceof CSSStyleSheet)
      return Array.from(source.cssRules).map((r) => r.cssText).join("\n");
    return "";
  }
  static Parse(text) {
    const style = document.createElement("style");
    style.textContent = text;
    document.head.appendChild(style);
    const sheet = style.sheet;
    document.head.removeChild(style);
    return sheet;
  }
  static ToArray(text) {
    const s = _Sheet.Parse(text);
    return s ? Array.from(s.cssRules) : [];
  }
  /**
   * Parse Less/Stylus-style indented CSS to a standard CSS string.
   * Mirrors Golem's SheetES5.Less(text).
   *
   * Supports: indented nesting, variables (@var: val / $var: val / $var = val),
   * variable substitution, single-line comments (//).
   *
   * @example
   *   Sheet.Less(`
   *     @primary: dodgerblue
   *     .box
   *       background: @primary
   *       .inner
   *         color: white
   *   `);
   *   // → '.box { background: dodgerblue; }\n.box .inner { color: white; }\n'
   */
  static Less(text) {
    return parseLess(text);
  }
  // ── Getters ────────────────────────────────────────────────────────────────
  get Index() {
    return this.#index;
  }
  get Length() {
    return this.#rules.length;
  }
  get Loading() {
    return this.#loading;
  }
  get Loaded() {
    return this.#loaded;
  }
  get State() {
    return this.#state;
  }
  get Object() {
    const out = {};
    if (!this.#sheet) return out;
    try {
      for (const rule of Array.from(this.#sheet.cssRules)) {
        if (rule instanceof CSSStyleRule) {
          const decl = rule.style;
          for (let i = 0; i < decl.length; i++) {
            const prop = decl[i] ?? "";
            if (prop) out[toCamel2(prop)] = decl.getPropertyValue(prop).trim();
          }
        }
      }
    } catch {
    }
    return out;
  }
  get Name() {
    return this.#name;
  }
  set Name(v) {
    this.#name = v;
  }
  /** Full serialized CSS text of all rules. */
  get Text() {
    return this.#rules.map((r) => r.Text).join("\n");
  }
  set Text(v) {
    this.parse(v);
  }
  get Link() {
    return this.#link;
  }
  set Link(v) {
    if (typeof v === "string") {
      this.#link = document.createElement("link");
      this.#link.rel = "stylesheet";
      this.#link.href = v;
      this.#head.appendChild(this.#link);
    } else {
      this.#link = v;
    }
  }
  get Sheet() {
    return this.#sheet;
  }
  set Sheet(v) {
    if (v instanceof CSSStyleSheet) {
      this.#sheet = v;
      this.#rules = Array.from(v.cssRules).map((r) => new Rule(r));
    }
  }
  get Rules() {
    return [...this.#rules];
  }
  set Rules(v) {
    if (typeof v === "string") {
      this.add(v);
      return;
    }
    if (v instanceof CSSRuleList) {
      Array.from(v).forEach((r) => this.add(new Rule(r)));
      return;
    }
    v.forEach((r) => this.add(r));
  }
  get Observable() {
    return this.#obs;
  }
  set Observable(v) {
    if (v === true) {
      this.#obs = new Observable_default(this);
      return;
    }
    if (v === false) {
      this.#obs = false;
      return;
    }
    if (v instanceof Observable_default) this.#obs = v;
  }
  on(types, cb) {
    if (!this.#obs) this.#obs = new Observable_default(this);
    this.#obs.on(types, cb);
    return this;
  }
  // ── CRUD methods ──────────────────────────────────────────────────────────
  parse(input) {
    this.#rules = [];
    if (typeof input === "string") {
      if (/^https?:\/\/|^\/\//.test(input.trim()))
        this.#loadUrl(input.trim());
      else
        this.#parseText(input);
    } else if (input instanceof CSSStyleSheet) {
      this.#rules = Array.from(input.cssRules).map((r) => new Rule(r));
      this.#sheet = input;
    } else if (input instanceof CSSRuleList) {
      this.#rules = Array.from(input).map((r) => new Rule(r));
    } else if (Array.isArray(input)) {
      this.#rules = input.map((r) => r instanceof Rule ? r : new Rule(r));
    } else if (typeof input === "object" && input !== null) {
      if (input instanceof _Sheet)
        this.#rules = input.#rules.map((r) => r.clone());
      else
        this.#parseObject(input);
    }
    this.#flushRules();
    this.#emit("Sheet-Changed", { action: "parse" });
    return this;
  }
  getIndex(rule) {
    const selector = typeof rule === "string" ? rule.trim() : rule instanceof Rule ? rule.Selector.trim() : rule.selectorText?.trim() ?? "";
    return this.#rules.findIndex((r) => r.Selector.trim().replace(/\s+/g, "") === selector.replace(/\s+/g, ""));
  }
  contains(...rules) {
    return rules.every((r) => this.getIndex(r) >= 0);
  }
  /**
   * Get one or more rules by selector string, Rule instance, or CSSRule.
   * Also accepts @-rule selectors: sheet.get('@keyframes spin')
   * Mirrors Golem: sheet.Get('@keyframes Settete')
   */
  get(...rules) {
    if (rules.length === 1) {
      const rule0 = rules[0];
      if (rule0 === void 0) return void 0;
      const i = this.getIndex(rule0);
      return i >= 0 ? this.#rules[i] : void 0;
    }
    return rules.map((r) => {
      const i = this.getIndex(r);
      return i >= 0 ? this.#rules[i] : void 0;
    }).filter(Boolean);
  }
  /**
   * Golem alias for .get() — mirrors sheet.Get('@keyframes Settete').
   */
  Get(...rules) {
    return this.get(...rules);
  }
  set(rule, value) {
    const i = this.getIndex(rule);
    if (i < 0) return this;
    const r = this.#rules[i];
    if (!r) return this;
    if (typeof value === "string")
      r.replace(value);
    else
      r.merge(value);
    this.#flushRules();
    this.#emit("Sheet-Changed", { action: "set", index: i, rule: r });
    return this;
  }
  insert(rules, index) {
    const arr = Array.isArray(rules) ? rules : [rules];
    const newRules = arr.map(
      (r) => r instanceof Rule ? r : typeof r === "string" ? Rule.Parse(r)[0] : new Rule(r)
    ).filter(Boolean);
    this.#rules.splice(index, 0, ...newRules);
    this.#flushRules();
    this.#emit("Sheet-Changed", { action: "insert", index, count: newRules.length });
    return this;
  }
  /** Golem alias: sheet.Insert(rule, idx) */
  Insert(rules, index) {
    return this.insert(rules, index);
  }
  add(...args) {
    const last = args[args.length - 1];
    const hasIdx = typeof last === "number";
    const idx = hasIdx ? last : void 0;
    const src = hasIdx ? args.slice(0, -1) : args;
    const flat = src.flat();
    const newRules = flat.map(
      (r) => r instanceof Rule ? r : typeof r === "string" ? Rule.Parse(r)[0] ?? null : new Rule(r)
    ).filter(Boolean);
    if (hasIdx && idx >= 0 && idx <= this.#rules.length)
      this.#rules.splice(idx, 0, ...newRules);
    else
      this.#rules.push(...newRules);
    this.#flushRules();
    this.#emit("Sheet-Changed", { action: "add", count: newRules.length });
    return this;
  }
  /** Golem alias: sheet.Add(rule1, rule2) */
  Add(...args) {
    return this.add(...args);
  }
  unshift(...rules) {
    return this.insert(rules.flat(), 0);
  }
  remove(...rules) {
    for (const r of rules) {
      const i = typeof r === "number" ? r : this.getIndex(r);
      if (i >= 0) this.#rules.splice(i, 1);
    }
    this.#flushRules();
    this.#emit("Sheet-Changed", { action: "remove" });
    return this;
  }
  shift(n = 1) {
    this.#rules.splice(0, n);
    this.#flushRules();
    this.#emit("Sheet-Changed", { action: "shift", count: n });
    return this;
  }
  pop(n = 1) {
    this.#rules.splice(this.#rules.length - n, n);
    this.#flushRules();
    this.#emit("Sheet-Changed", { action: "pop", count: n });
    return this;
  }
  clear() {
    this.#rules = [];
    this.#flushRules();
    this.#emit("Sheet-Changed", { action: "clear" });
    return this;
  }
  toString() {
    return this.Text;
  }
};
if (typeof window !== "undefined") {
  let SheetES5 = function(url) {
    return url ? new Sheet(url) : new Sheet();
  };
  SheetES52 = SheetES5;
  Object.defineProperty(window, "Sheet", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Sheet
  });
  SheetES5.Less = (text) => Sheet.Less(text);
  if (!("SheetES5" in window))
    Object.defineProperty(window, "SheetES5", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: SheetES5
    });
}
var SheetES52;
var Stylesheet_default = Sheet;

// core/Virtual.ts
function _alpha(color, a) {
  const rgba = color.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const p = rgba[1].split(",").map((s) => s.trim());
    if (p.length >= 3) return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
  }
  const hex = color.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    const h = hex[1];
    const r = parseInt(h.length >= 6 ? h.slice(0, 2) : h[0] + h[0], 16);
    const g = parseInt(h.length >= 6 ? h.slice(2, 4) : h[1] + h[1], 16);
    const b = parseInt(h.length >= 6 ? h.slice(4, 6) : h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}
function _preset(mode, o) {
  const color = o.color ?? "rgba(0,0,0,0.25)", blur = o.blur ?? 8, spread = o.spread ?? 0, x = o.x ?? 0;
  switch (mode) {
    case "drop":
      return `${x}px ${o.y ?? 4}px ${blur}px ${spread}px ${color}`;
    case "inset":
      return `inset ${x}px ${o.y ?? 0}px ${blur}px ${spread}px ${color}`;
    case "glow":
      return `0 0 ${blur}px ${spread + 2}px ${color}, 0 0 ${blur * 2}px ${spread}px ${_alpha(color, 0.5)}`;
    case "layered": {
      const y = o.y ?? 4;
      return `${x}px ${y}px ${blur}px ${color}, ${x}px ${y * 2}px ${blur * 2}px ${_alpha(color, 0.15)}`;
    }
  }
}
function _layerCSS(l) {
  return `${l.inset ? "inset " : ""}${l.x ?? 0}px ${l.y ?? 4}px ${l.blur ?? 8}px ${l.spread ?? 0}px ${l.color ?? "rgba(0,0,0,0.25)"}`;
}
function _shadowCSS(state, mode = "drop", opts = {}) {
  if (state === "close") return "none";
  if (mode instanceof Rule_default) {
    const v = mode.Properties["boxShadow"] ?? mode.Properties["box-shadow"];
    return v ?? _preset("drop", opts);
  }
  if (mode instanceof Stylesheet_default) {
    for (const r of mode.Rules) {
      const v = r.Properties["boxShadow"] ?? r.Properties["box-shadow"];
      if (v) return v;
    }
    return _preset("drop", opts);
  }
  if (Array.isArray(mode)) return mode.map(_layerCSS).join(", ");
  return _preset(mode, opts);
}
var _counter = 0;
var _nodes = {};
function uid() {
  return `vn-${++_counter}-${Math.random().toString(36).slice(2, 6)}`;
}
function normalizeChild(c) {
  if (c instanceof VirtualNode) return c;
  const n = new VirtualNode("span");
  n.set("textContent", c == null ? "" : String(c));
  return n;
}
var VirtualNode = class _VirtualNode {
  #id;
  #tag;
  #attrs;
  #children;
  #text;
  #dom = null;
  #parent = null;
  #mounted = false;
  #domQueue = [];
  #effects = [];
  #sinks = [];
  static Instances = [];
  constructor(def, attrs, ...children) {
    if (def instanceof AriannATemplate) {
      const el = def.clone();
      this.#tag = el.tagName.toLowerCase();
      this.#attrs = {};
      this.#children = [];
      this.#text = "";
      this.#id = uid();
      _nodes[this.#id] = this;
      _VirtualNode.Instances.push(this);
      this.#dom = el;
      return;
    }
    if (typeof def === "string") {
      this.#tag = def.toLowerCase();
      this.#attrs = { ...attrs ?? {} };
      this.#children = children.map(normalizeChild);
      this.#text = "";
    } else {
      this.#tag = (def.Tag ?? "div").toLowerCase();
      this.#attrs = { ...def.Attributes ?? {} };
      this.#children = (def.Children ?? []).map(normalizeChild);
      this.#text = def.Text ?? "";
      this.#parent = def.Parent ?? null;
    }
    this.#id = uid();
    _nodes[this.#id] = this;
    _VirtualNode.Instances.push(this);
  }
  render() {
    if (this.#dom) return this.#dom;
    const d = Core_default.GetDescriptor(this.#tag);
    this.#dom = d && d.Namespace?.functions?.create ? d.Namespace.functions.create(this.#tag) : document.createElement(this.#tag);
    for (const [k, v] of Object.entries(this.#attrs)) if (v !== null) this.#dom.setAttribute(k, String(v));
    if (this.#text) this.#dom.textContent = this.#text;
    for (const child of this.#children) this.#dom.appendChild(child.render());
    this.#applySinks();
    for (const { type, cb, opts } of this.#domQueue) this.#dom.addEventListener(type, cb, opts);
    this.#domQueue = [];
    this.#mounted = true;
    return this.#dom;
  }
  #applySinks() {
    if (!this.#dom) return;
    for (const sink of this.#sinks) {
      switch (sink.type) {
        case "text": {
          const node = document.createTextNode(String(sink.getter()));
          this.#dom.appendChild(node);
          this.#effects.push(effect(() => {
            node.nodeValue = sink.getter();
          }));
          break;
        }
        case "textMono": {
          const node = sink.node ?? document.createTextNode(sink.mono.peek());
          if (!sink.node) this.#dom.appendChild(node);
          sinkText(sink.mono, node);
          break;
        }
        case "attr": {
          const el = this.#dom;
          this.#effects.push(effect(() => {
            const v = sink.getter();
            if (v === null) el.removeAttribute(sink.name);
            else el.setAttribute(sink.name, v);
          }));
          break;
        }
        case "cls": {
          const el = this.#dom;
          this.#effects.push(effect(() => {
            if (sink.getter()) el.classList.add(sink.name);
            else el.classList.remove(sink.name);
          }));
          break;
        }
        case "prop": {
          const rec = this.#dom;
          this.#effects.push(effect(() => {
            rec[sink.name] = sink.getter();
          }));
          break;
        }
        case "style": {
          const el = this.#dom;
          const p = sink.name.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
          this.#effects.push(effect(() => {
            el.style.setProperty(p, sink.getter());
          }));
          break;
        }
        case "bind": {
          const rec = this.#dom;
          this.#effects.push(effect(() => {
            rec["value"] = sink.getter();
          }));
          if (sink.setter) this.#dom.addEventListener("input", (e) => sink.setter(e.target.value));
          break;
        }
        case "shadow": {
          const mode = sink.shadowModeRule ?? sink.shadowMode ?? "drop";
          this.#dom.style.boxShadow = _shadowCSS("open", mode, sink.shadowOpts ?? {});
          break;
        }
      }
    }
    this.#sinks = [];
  }
  valueOf() {
    return this.render();
  }
  log(v) {
    console.log(v ?? this.#dom ?? `[VirtualNode <${this.#tag}> unmounted]`);
    return this;
  }
  on(type, cb, opts) {
    if (this.#dom) this.#dom.addEventListener(type, cb, opts);
    else this.#domQueue.push({ type, cb, ...opts !== void 0 ? { opts } : {} });
    return this;
  }
  off(type, cb, opts) {
    this.#dom?.removeEventListener(type, cb, opts);
    return this;
  }
  fire(type, init) {
    this.#dom?.dispatchEvent(new CustomEvent(type, init));
    return this;
  }
  append(parent) {
    const p = typeof parent === "string" ? document.querySelector(parent) : parent instanceof _VirtualNode ? parent.render() : typeof parent?.render === "function" ? parent.render() : parent instanceof Element ? parent : null;
    if (p) p.appendChild(this.render());
    this.#mounted = true;
    return this;
  }
  mount(parent) {
    return this.append(parent ?? null);
  }
  unmount() {
    this.#dom?.parentNode?.removeChild(this.#dom);
    this.#mounted = false;
    return this;
  }
  add(...args) {
    const last = args[args.length - 1];
    const items = typeof last === "number" ? args.slice(0, -1) : args;
    const index = typeof last === "number" ? last : this.#children.length;
    const vnodes = items.map(normalizeChild);
    this.#children.splice(index, 0, ...vnodes);
    if (this.#dom) {
      const ref = this.#dom.childNodes[index] ?? null;
      const frag = document.createDocumentFragment();
      vnodes.forEach((n) => frag.appendChild(n.render()));
      this.#dom.insertBefore(frag, ref);
    }
    return this;
  }
  push(...nodes) {
    return this.add(...nodes);
  }
  unshift(...nodes) {
    return this.add(...nodes, 0);
  }
  remove(...targets) {
    for (const t of targets) {
      if (typeof t === "number") {
        const vn = this.#children.splice(t, 1)[0];
        if (vn) {
          const el = vn.render();
          el.parentNode?.removeChild(el);
        }
      } else if (typeof t === "string") {
        const el = this.#dom?.querySelector(t);
        el?.parentNode?.removeChild(el);
      } else if (t instanceof _VirtualNode) {
        const i = this.#children.indexOf(t);
        if (i >= 0) this.#children.splice(i, 1);
        if (t.#dom) t.#dom.parentNode?.removeChild(t.#dom);
      }
    }
    return this;
  }
  shift(n = 1) {
    for (let i = 0; i < n; i++) {
      const vn = this.#children.shift();
      if (vn) {
        const el = vn.render();
        el.parentNode?.removeChild(el);
      }
    }
    return this;
  }
  pop(n = 1) {
    for (let i = 0; i < n; i++) {
      const vn = this.#children.pop();
      if (vn) {
        const el = vn.render();
        el.parentNode?.removeChild(el);
      }
    }
    return this;
  }
  get(name) {
    return this.#dom?.getAttribute(name) ?? (this.#attrs[name] !== void 0 && this.#attrs[name] !== null ? String(this.#attrs[name]) : void 0);
  }
  set(name, value) {
    if (this.#dom) {
      if (name in this.#dom) this.#dom[name] = value;
      else if (value !== null) this.#dom.setAttribute(name, String(value));
      else this.#dom.removeAttribute(name);
    } else this.#attrs[name] = value;
    return this;
  }
  css(prop, val) {
    if (this.#dom) this.#dom.style.setProperty(prop, val);
    return this;
  }
  show() {
    this.css("display", "");
    return this;
  }
  hide() {
    this.css("display", "none");
    return this;
  }
  child(path) {
    let n = this.render();
    for (const i of path) n = n.childNodes[i];
    return n;
  }
  shadow(state, mode = "drop", opts = {}) {
    if (this.#dom) this.#dom.style.boxShadow = _shadowCSS(state, mode, opts);
    else if (state === "close") this.#sinks.push({ type: "shadow", getter: () => null, shadowOpts: {} });
    else if (mode instanceof Rule_default || mode instanceof Stylesheet_default) this.#sinks.push({ type: "shadow", getter: () => null, shadowModeRule: mode, shadowOpts: opts });
    else this.#sinks.push({ type: "shadow", getter: () => null, shadowMode: mode, shadowOpts: opts });
    return this;
  }
  signal(value) {
    return signal(value);
  }
  signalMono(value) {
    return signalMono(value);
  }
  effect(fn) {
    if (this.#dom) this.#effects.push(effect(fn));
    else this.#sinks.push({ type: "text", getter: fn });
    return this;
  }
  computed(fn) {
    const s = signal(void 0);
    this.#effects.push(effect(() => s.set(fn())));
    return s.readonly();
  }
  text(getter) {
    if (this.#dom) {
      const n = document.createTextNode(getter());
      this.#dom.appendChild(n);
      this.#effects.push(effect(() => {
        n.nodeValue = getter();
      }));
    } else this.#sinks.push({ type: "text", getter });
    return this;
  }
  textMono(s, node) {
    if (this.#dom) {
      const n = node ?? document.createTextNode(s.peek());
      if (!node) this.#dom.appendChild(n);
      sinkText(s, n);
    } else this.#sinks.push({ type: "textMono", getter: s.peek, mono: s, ...node !== void 0 ? { node } : {} });
    return this;
  }
  attr(name, getter) {
    if (this.#dom) {
      const el = this.#dom;
      this.#effects.push(effect(() => {
        const v = getter();
        if (v === null) el.removeAttribute(name);
        else el.setAttribute(name, v);
      }));
    } else this.#sinks.push({ type: "attr", getter, name });
    return this;
  }
  cls(name, getter) {
    if (this.#dom) {
      const el = this.#dom;
      this.#effects.push(effect(() => {
        if (getter()) el.classList.add(name);
        else el.classList.remove(name);
      }));
    } else this.#sinks.push({ type: "cls", getter, name });
    return this;
  }
  clsMono(name) {
    const el = this.render();
    return (v) => {
      if (v) el.classList.add(name);
      else el.classList.remove(name);
    };
  }
  prop(name, getter) {
    if (this.#dom) {
      const rec = this.#dom;
      this.#effects.push(effect(() => {
        rec[name] = getter();
      }));
    } else this.#sinks.push({ type: "prop", getter, name });
    return this;
  }
  style(prop, getter) {
    if (this.#dom) {
      const el = this.#dom;
      const p = prop.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
      this.#effects.push(effect(() => {
        el.style.setProperty(p, getter());
      }));
    } else this.#sinks.push({ type: "style", getter, name: prop });
    return this;
  }
  bind(getter, setter) {
    this.prop("value", getter);
    if (setter) this.on("input", (e) => setter(e.target.value));
    return this;
  }
  destroy() {
    this.#effects.forEach((s) => s());
    this.#effects = [];
    this.#sinks = [];
    return this;
  }
  static signal = signal;
  static signalMono = signalMono;
  static sinkText = sinkText;
  static effect = effect;
  static computed = computed;
  static batch = batch;
  static untrack = untrack;
  static tpl = (html) => new AriannATemplate(html);
  static template = (html) => new AriannATemplate(html);
};
if (typeof window !== "undefined") Object.defineProperty(window, "Virtual", { value: VirtualNode, writable: false, enumerable: false, configurable: false });
var Virtual_default = VirtualNode;

// core/Real.ts
function _alpha2(color, a) {
  const rgba = color.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const p = rgba[1].split(",").map((s) => s.trim());
    if (p.length >= 3) return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
  }
  const hex = color.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    const h = hex[1];
    const r = parseInt(h.length >= 6 ? h.slice(0, 2) : h[0] + h[0], 16);
    const g = parseInt(h.length >= 6 ? h.slice(2, 4) : h[1] + h[1], 16);
    const b = parseInt(h.length >= 6 ? h.slice(4, 6) : h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}
function _preset2(mode, o) {
  const color = o.color ?? "rgba(0,0,0,0.25)", blur = o.blur ?? 8, spread = o.spread ?? 0, x = o.x ?? 0;
  switch (mode) {
    case "drop":
      return `${x}px ${o.y ?? 4}px ${blur}px ${spread}px ${color}`;
    case "inset":
      return `inset ${x}px ${o.y ?? 0}px ${blur}px ${spread}px ${color}`;
    case "glow":
      return `0 0 ${blur}px ${spread + 2}px ${color}, 0 0 ${blur * 2}px ${spread}px ${_alpha2(color, 0.5)}`;
    case "layered": {
      const y = o.y ?? 4;
      return `${x}px ${y}px ${blur}px ${color}, ${x}px ${y * 2}px ${blur * 2}px ${_alpha2(color, 0.15)}`;
    }
  }
}
function _layerCSS2(l) {
  return `${l.inset ? "inset " : ""}${l.x ?? 0}px ${l.y ?? 4}px ${l.blur ?? 8}px ${l.spread ?? 0}px ${l.color ?? "rgba(0,0,0,0.25)"}`;
}
function _shadowCSS2(state, mode = "drop", opts = {}) {
  if (state === "close") return "none";
  if (mode instanceof Rule_default) {
    const v = mode.Properties["boxShadow"] ?? mode.Properties["box-shadow"];
    return v ?? _preset2("drop", opts);
  }
  if (mode instanceof Stylesheet_default) {
    for (const r of mode.Rules) {
      const v = r.Properties["boxShadow"] ?? r.Properties["box-shadow"];
      if (v) return v;
    }
    return _preset2("drop", opts);
  }
  if (Array.isArray(mode)) return mode.map(_layerCSS2).join(", ");
  return _preset2(mode, opts);
}
function toNodes(items) {
  return items.flatMap((item) => {
    if (!item) return [];
    if (item instanceof Node) return [item];
    if (item instanceof Real) return [item.render()];
    if (item instanceof VirtualNode) return [item.render()];
    if (item instanceof AriannATemplate) return [item.clone()];
    if (typeof item === "string") {
      const t = document.createElement("template");
      t.innerHTML = item;
      return Array.from(t.content.childNodes);
    }
    if (typeof item === "object" && "Tag" in item) {
      const el = document.createElement(item.Tag ?? "div");
      if (item.Attributes) for (const [k, v] of Object.entries(item.Attributes)) el.setAttribute(k, v);
      return [el];
    }
    return [];
  });
}
var Real = class _Real {
  #el;
  #mode;
  #descriptor;
  #value;
  #effects = [];
  static Instances = [];
  static get Namespaces() {
    return Core_default.Namespaces;
  }
  constructor(arg0, arg1, arg2) {
    this.#mode = new.target !== void 0;
    this.#el = document.createElement("div");
    this.#descriptor = false;
    this.#value = this;
    this.#init(arg0, arg1, arg2);
    if (this.#mode) {
      _Real.Instances.push(this);
      if (!this.#el.id) {
        this.#el.id = `Real-Instance-${_Real.Instances.length}`;
        this.#el.className = this.#el.id;
      }
    }
  }
  #init(arg0, arg1, arg2) {
    if (arg0 instanceof AriannATemplate) {
      this.#el = arg0.clone();
      this.#mode = true;
      return;
    }
    if (!this.#mode) {
      if (typeof arg0 === "string") {
        if (arg1 && typeof arg1 === "function") {
          Core_default.Define(arg0, arg1, arg2 ?? HTMLElement);
          this.#value = arg1;
          return;
        }
        const d = Core_default.GetDescriptor(arg0);
        if (d) {
          this.#descriptor = d;
          this.#value = d.Constructor ?? d.Interface;
          return;
        }
        const el = document.querySelector(arg0);
        if (el) {
          this.#el = el;
          this.#descriptor = Core_default.GetDescriptor(el);
          this.#value = new _Real(el);
        }
        return;
      }
      if (typeof arg0 === "function") {
        const d = Core_default.GetDescriptor(arg0);
        if (d) {
          this.#descriptor = d;
          this.#value = d.Interface ?? arg0;
        }
        return;
      }
      if (arg0 instanceof Element) {
        this.#el = arg0;
        this.#descriptor = Core_default.GetDescriptor(arg0);
        this.#value = new _Real(arg0);
        this.#mode = true;
        return;
      }
      return;
    }
    if (typeof arg0 === "string") {
      const d = Core_default.GetDescriptor(arg0);
      this.#el = d && d.Namespace?.functions?.create ? d.Namespace.functions.create(arg0) : document.createElement(arg0);
      if (d) this.#descriptor = d;
    } else if (arg0 instanceof Element) {
      this.#el = arg0;
      this.#descriptor = Core_default.GetDescriptor(arg0);
    } else if (arg0 instanceof _Real) {
      this.#el = arg0.render();
    } else if (arg0 instanceof VirtualNode) {
      this.#el = arg0.render();
    } else if (typeof arg0 === "object" && "Tag" in arg0) {
      const def = arg0;
      this.#el = document.createElement(def.Tag ?? "div");
      if (def.Attributes) for (const [k, v] of Object.entries(def.Attributes)) this.#el.setAttribute(k, v);
    }
    if (arg1 && typeof arg1 === "object" && typeof arg1 !== "function") {
      const opts = arg1;
      if (opts.id) this.#el.id = String(opts.id);
      if (opts.class || opts.className) this.#el.className = String(opts.class ?? opts.className);
    }
  }
  render() {
    return this.#el;
  }
  valueOf() {
    return this.#el;
  }
  log(v) {
    console.log(v ?? this.#el);
    return this;
  }
  on(type, cb, opts) {
    this.#el.addEventListener(type, cb, opts);
    return this;
  }
  off(type, cb, opts) {
    this.#el.removeEventListener(type, cb, opts);
    return this;
  }
  fire(event, init) {
    this.#el.dispatchEvent(typeof event === "string" ? new CustomEvent(event, init) : event);
    return this;
  }
  append(parent) {
    const p = typeof parent === "string" ? document.querySelector(parent) : parent instanceof _Real ? parent.render() : parent instanceof VirtualNode ? parent.render() : parent;
    if (p) p.appendChild(this.#el);
    return this;
  }
  add(...args) {
    const last = args[args.length - 1];
    const items = typeof last === "number" ? args.slice(0, -1) : args;
    const index = typeof last === "number" ? last : this.#el.childNodes.length;
    const nodes = toNodes(items);
    const ref = this.#el.childNodes[index] ?? null;
    const frag = document.createDocumentFragment();
    nodes.forEach((n) => frag.appendChild(n));
    this.#el.insertBefore(frag, ref);
    return this;
  }
  push(...nodes) {
    return this.add(...nodes);
  }
  unshift(...nodes) {
    return this.add(...nodes, 0);
  }
  remove(...targets) {
    for (const t of targets) {
      let node = null;
      if (typeof t === "number") node = this.#el.childNodes[t] ?? null;
      else if (typeof t === "string") node = this.#el.querySelector(t);
      else if (t instanceof _Real) node = t.render();
      else if (t instanceof Node) node = t;
      if (node && this.#el.contains(node)) this.#el.removeChild(node);
    }
    return this;
  }
  shift(n = 1) {
    for (let i = 0; i < n && this.#el.firstChild; i++) this.#el.removeChild(this.#el.firstChild);
    return this;
  }
  pop(n = 1) {
    for (let i = 0; i < n && this.#el.lastChild; i++) this.#el.removeChild(this.#el.lastChild);
    return this;
  }
  get(name) {
    const u = name.toUpperCase();
    for (let i = 0; i < this.#el.attributes.length; i++) {
      const a = this.#el.attributes.item(i);
      if (a.name.toUpperCase() === u) return a.value;
    }
    const rec = this.#el;
    for (const k of Object.keys(rec)) if (k.toUpperCase() === u) return String(rec[k]);
    return void 0;
  }
  set(name, value) {
    const u = name.toUpperCase();
    for (let i = 0; i < this.#el.attributes.length; i++) {
      const a = this.#el.attributes.item(i);
      if (a.name.toUpperCase() === u) {
        this.#el.setAttribute(a.name, value);
        return this;
      }
    }
    const rec = this.#el;
    for (const k of Object.keys(rec)) if (k.toUpperCase() === u) {
      rec[k] = value;
      return this;
    }
    this.#el.setAttribute(name.toLowerCase(), value);
    return this;
  }
  show() {
    this.#el.style.display = "";
    return this;
  }
  hide() {
    this.#el.style.display = "none";
    return this;
  }
  contains(...nodes) {
    for (const n of nodes) {
      const el = typeof n === "string" ? this.#el.querySelector(n) : n instanceof _Real ? n.render() : n;
      if (!el || !this.#el.contains(el)) return false;
    }
    return true;
  }
  child(path) {
    let n = this.#el;
    for (const i of path) n = n.childNodes[i];
    return n;
  }
  shadow(state, mode = "drop", opts = {}) {
    this.#el.style.boxShadow = _shadowCSS2(state, mode, opts);
    return this;
  }
  signal(value) {
    return signal(value);
  }
  signalMono(value) {
    return signalMono(value);
  }
  effect(fn) {
    this.#effects.push(effect(fn));
    return this;
  }
  computed(fn) {
    const s = signal(void 0);
    this.#effects.push(effect(() => s.set(fn())));
    return s.readonly();
  }
  text(getter) {
    const node = document.createTextNode(getter());
    this.#el.appendChild(node);
    this.#effects.push(effect(() => {
      node.nodeValue = getter();
    }));
    return this;
  }
  textMono(s, node) {
    if (!node) {
      node = document.createTextNode(s.peek());
      this.#el.appendChild(node);
    }
    sinkText(s, node);
    return this;
  }
  attr(name, getter) {
    const el = this.#el;
    this.#effects.push(effect(() => {
      const v = getter();
      if (v === null) el.removeAttribute(name);
      else el.setAttribute(name, v);
    }));
    return this;
  }
  cls(name, getter) {
    const el = this.#el;
    this.#effects.push(effect(() => {
      if (getter()) el.classList.add(name);
      else el.classList.remove(name);
    }));
    return this;
  }
  clsMono(name) {
    const el = this.#el;
    return (v) => {
      if (v) el.classList.add(name);
      else el.classList.remove(name);
    };
  }
  prop(name, getter) {
    const rec = this.#el;
    this.#effects.push(effect(() => {
      rec[name] = getter();
    }));
    return this;
  }
  style(prop, getter) {
    const el = this.#el;
    const cssProp = prop.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
    this.#effects.push(effect(() => {
      el.style.setProperty(cssProp, getter());
    }));
    return this;
  }
  bind(getter, setter) {
    this.prop("value", getter);
    if (setter) this.#el.addEventListener("input", (e) => setter(e.target.value));
    return this;
  }
  destroy() {
    this.#effects.forEach((s) => s());
    this.#effects = [];
    return this;
  }
  static tpl(html) {
    return new AriannATemplate(html);
  }
  static Define(tag, ctor, base = HTMLElement, style = {}) {
    return Core_default.Define(tag, ctor, base, style);
  }
  static GetDescriptor = Core_default.GetDescriptor;
  static Render(obj) {
    if (obj instanceof Element) return obj;
    if (obj instanceof _Real) return obj.render();
    if (obj instanceof VirtualNode) return obj.render();
    if (obj instanceof AriannATemplate) return obj.clone();
    if (typeof obj === "object" && "Tag" in obj) {
      const el = document.createElement(obj.Tag ?? "div");
      if (obj.Attributes) for (const [k, v] of Object.entries(obj.Attributes)) el.setAttribute(k, v);
      return el;
    }
    return null;
  }
  static signal = signal;
  static signalMono = signalMono;
  static sinkText = sinkText;
  static effect = effect;
  static computed = computed;
  static batch = batch;
  static untrack = untrack;
  static template = (html) => new AriannATemplate(html);
};
if (typeof window !== "undefined") Object.defineProperty(window, "Real", { enumerable: true, configurable: false, writable: false, value: Real });
var Real_default = Real;

// core/State.ts
var COLLECTION_MUTATORS = /* @__PURE__ */ new Set(["set", "add", "delete", "clear", "push", "pop", "shift", "unshift", "splice", "fill", "sort", "reverse", "copyWithin"]);
var State = class {
  #events = /* @__PURE__ */ new Map();
  #states = /* @__PURE__ */ new Map();
  #history = [];
  #source;
  #state;
  // ── Static fine-grain API ─────────────────────────────────────────────────
  static signal = signal;
  static signalMono = signalMono;
  static sinkText = sinkText;
  static effect = effect;
  static computed = computed;
  static batch = batch;
  static untrack = untrack;
  constructor(source) {
    this.#source = source;
    this.#state = this.#load(source);
    this.#history.push({ key: "__init__", old: void 0, new: source, ts: Date.now() });
    Object.defineProperty(this, "State", { enumerable: true, configurable: false, get: () => this.#state, set: (v) => {
      if (v && typeof v === "object") {
        this.#source = v;
        this.#state = this.#load(v);
      }
    } });
    Object.defineProperty(this, "States", { enumerable: true, configurable: false, get: () => this.#states });
    Object.defineProperty(this, "History", { enumerable: true, configurable: false, get: () => this.#history });
  }
  on(types, cb) {
    const ls = { Id: uuid2(), Handler: cb, Target: this };
    types.split(/(?!-)\W/g).filter(Boolean).forEach((t) => {
      const b = this.#events.get(t) ?? /* @__PURE__ */ new Set();
      b.add(ls);
      this.#events.set(t, b);
    });
    return this;
  }
  off(type, cb) {
    this.#events.get(type)?.forEach((l) => l.Handler === cb && this.#events.get(type).delete(l));
    return this;
  }
  fire(event) {
    if (!event?.Type) return this;
    this.#events.get(event.Type)?.forEach((l) => l.Handler.call(l.Target, event));
    return this;
  }
  match(types, cb) {
    return this.on(types, cb);
  }
  addState(name, snapshot) {
    this.#states.set(name, snapshot);
    return this;
  }
  removeState(name) {
    this.#states.delete(name);
    return this;
  }
  #emit(key, old, newVal, target) {
    const k = String(key);
    const ev = { Type: "", Target: target, State: this, Property: { Name: key, Old: old, New: newVal } };
    const fire = (type) => {
      ev.Type = type;
      this.fire(ev);
    };
    fire("State-Changing");
    fire(`State-${k}-Changing`);
    fire(`State-${k}-Changed`);
    fire("State-Changed");
    this.#history.push({ key, old, new: newVal, ts: Date.now() });
    if (this.#states.size) this.#states.forEach((snap) => {
      if (snap[k] === newVal) {
        const se = { ...ev };
        se.Type = "State-Reached";
        this.fire(se);
        se.Type = `State-${k}-Reached`;
        this.fire(se);
      }
    });
  }
  #proxyHandler(parent) {
    const self = this;
    return {
      get(target, key, recv) {
        const val = Reflect.get(target, key, recv);
        if (typeof val === "function" && COLLECTION_MUTATORS.has(String(key).toLowerCase()))
          return function(...args) {
            const old = Array.isArray(target) ? [...target] : void 0;
            self.#emit(key, old, args[0], target);
            return val.apply(target, args);
          };
        return val;
      },
      set(target, key, value, recv) {
        const old = target[key];
        if (old === value) return true;
        Reflect.set(target, key, value, recv);
        self.#emit(key, old, value, target);
        return true;
      }
    };
  }
  #load(source) {
    const s = { ...source };
    const wrap = (o) => {
      for (const k of Object.keys(o)) {
        let v = o[k];
        Object.defineProperty(o, k, {
          enumerable: true,
          configurable: true,
          get: () => v,
          set: (V) => {
            if (v === V) return;
            const old = v;
            v = V;
            this.#emit(k, old, V, o);
            if (V && typeof V === "object" && !(V instanceof Map) && !(V instanceof Set) && !(V instanceof WeakMap) && !(V instanceof WeakSet) && !Array.isArray(V))
              v = wrap(V);
          }
        });
        if (v && typeof v === "object") {
          if (v instanceof Map || v instanceof WeakMap || v instanceof Set || v instanceof WeakSet || Array.isArray(v))
            o[k] = v = new Proxy(v, this.#proxyHandler(o));
          else o[k] = v = wrap(v);
        }
      }
      return o;
    };
    return wrap(s);
  }
};
if (typeof window !== "undefined")
  Object.defineProperty(window, "State", { enumerable: true, configurable: false, writable: false, value: State });
var State_default = State;

// core/Context.ts
var _registry = /* @__PURE__ */ new Map();
function _get(key) {
  if (!_registry.has(key))
    _registry.set(key, { value: void 0, $signal: signal(void 0), providers: /* @__PURE__ */ new Set(), consumers: /* @__PURE__ */ new Set() });
  return _registry.get(key);
}
function _fire(record, key, nv, old) {
  record.$signal.set(nv);
  const ev = { Type: "Context-Changed", Key: key, Value: nv, Old: old };
  for (const c of record.consumers) {
    const bucket = c.events.get("Context-Changed");
    if (bucket) for (const cb of bucket) cb(ev);
  }
}
var Context = class {
  #key;
  #rec;
  constructor(key, value) {
    this.#key = key;
    this.#rec = _get(key);
    if (value !== void 0) {
      this.#rec.value = value;
      this.#rec.$signal.set(value);
    }
  }
  get key() {
    return this.#key;
  }
  get value() {
    return this.#rec.value;
  }
  /**
   * Espone il valore come Signal reattivo.
   * Gli Effect che lo leggono reagiscono automaticamente a update().
   * @example
   *   const $theme = ThemeCtx.asSignal();
   *   real.style('background', () => $theme.get()?.primary ?? 'gray');
   */
  asSignal() {
    return this.#rec.$signal;
  }
  provide(element) {
    this.#rec.providers.add(element);
    element.addEventListener("arianna:context-request", (e) => {
      const ce = e;
      if (ce.detail.key === this.#key) {
        ce.stopPropagation();
        ce.detail.resolve(this.#rec.value);
      }
    });
    return this;
  }
  update(value) {
    const old = this.#rec.value;
    if (Object.is(old, value)) return this;
    this.#rec.value = value;
    _fire(this.#rec, this.#key, value, old);
    return this;
  }
  destroy() {
    this.#rec.providers.clear();
    this.#rec.consumers.clear();
    _registry.delete(this.#key);
  }
  static consume(key, element) {
    const rec = _get(key);
    const cr = { id: uuid2(), element, events: /* @__PURE__ */ new Map() };
    rec.consumers.add(cr);
    let resolved = false;
    element.dispatchEvent(new CustomEvent("arianna:context-request", {
      bubbles: true,
      composed: true,
      detail: { key, resolve: (v) => {
        if (!resolved) {
          resolved = true;
          rec.value = v;
          rec.$signal.set(v);
        }
      } }
    }));
    const handle = {
      get value() {
        return rec.value;
      },
      signal() {
        return rec.$signal;
      },
      on(types, cb) {
        types.split(/\s+|,|\|/g).filter(Boolean).forEach((t) => {
          const b = cr.events.get(t) ?? /* @__PURE__ */ new Set();
          b.add(cb);
          cr.events.set(t, b);
        });
        return handle;
      },
      off(type, cb) {
        cr.events.get(type)?.forEach((l) => l === cb && cr.events.get(type).delete(l));
        return handle;
      },
      detach() {
        rec.consumers.delete(cr);
      }
    };
    return handle;
  }
  static has(key, element) {
    let found = false;
    element.dispatchEvent(new CustomEvent("arianna:context-request", { bubbles: true, composed: true, detail: { key, resolve: () => {
      found = true;
    } } }));
    return found;
  }
  static keys() {
    return Array.from(_registry.keys());
  }
};
if (typeof window !== "undefined")
  Object.defineProperty(window, "Context", { enumerable: true, configurable: false, writable: false, value: Context });
var Context_default = Context;

// core/Namespace.ts
function iface(name, tags) {
  return {
    Name: name,
    Tags: tags,
    Namespace: null,
    // filled during init
    Constructor: null,
    Interface: null,
    Prototype: null,
    Supported: false,
    Defined: false,
    Declaration: "FUNCTION",
    Type: "STANDARD",
    Standard: true,
    Custom: false,
    Style: {}
  };
}
var htmlFunctions = {
  create(tag) {
    let t = tag;
    if (typeof t === "function") {
      const d = Core_default.GetDescriptor(t);
      t = d ? d.Tags[0] : void 0;
    }
    if (typeof t === "string") return document.createElement(t.toLowerCase());
    return false;
  },
  patch(constructorName) {
    const win = window;
    const iface2 = win[constructorName];
    if (!iface2 || typeof iface2 !== "function") return;
    const name = iface2.name;
    const create = htmlFunctions.create;
    const wrapped = function() {
      const p = this.constructor.prototype;
      return Object.setPrototypeOf(
        create(this.constructor),
        p
      );
    };
    Object.defineProperty(wrapped, "name", { value: name });
    wrapped.prototype = iface2.prototype;
    wrapped.prototype.constructor = wrapped;
    win[name] = wrapped;
  }
};
var htmlInterfaces = {
  HTMLElement: iface("HTMLElement", ["address", "article", "footer", "header", "section", "nav", "dd", "dt", "figcaption", "figure", "main", "abbr", "b", "bdi", "bdo", "cite", "code", "dfn", "em", "i", "mark", "rt", "rtc", "ruby", "s", "samp", "small", "strong", "sub", "sup", "u", "var", "wbr", "area", "noscript", "noembed", "plaintext", "strike", "tt", "summary", "acronym", "basefont", "big", "center"]),
  HTMLUnknownElement: iface("HTMLUnknownElement", ["isindex", "spacer", "menuitem", "decorator", "applet", "blink", "keygen"]),
  HTMLHtmlElement: iface("HTMLHtmlElement", ["html"]),
  HTMLHeadElement: iface("HTMLHeadElement", ["head"]),
  HTMLBaseElement: iface("HTMLBaseElement", ["base"]),
  HTMLLinkElement: iface("HTMLLinkElement", ["link"]),
  HTMLMetaElement: iface("HTMLMetaElement", ["meta"]),
  HTMLStyleElement: iface("HTMLStyleElement", ["style"]),
  HTMLTitleElement: iface("HTMLTitleElement", ["title"]),
  HTMLPreElement: iface("HTMLPreElement", ["pre", "listing", "xmp"]),
  HTMLHeadingElement: iface("HTMLHeadingElement", ["h1", "h2", "h3", "h4", "h5", "h6"]),
  HTMLDivElement: iface("HTMLDivElement", ["div"]),
  HTMLDListElement: iface("HTMLDListElement", ["dl"]),
  HTMLHRElement: iface("HTMLHRElement", ["hr"]),
  HTMLLIElement: iface("HTMLLIElement", ["li"]),
  HTMLOListElement: iface("HTMLOListElement", ["ol"]),
  HTMLParagraphElement: iface("HTMLParagraphElement", ["p"]),
  HTMLUListElement: iface("HTMLUListElement", ["ul"]),
  HTMLAnchorElement: iface("HTMLAnchorElement", ["a"]),
  HTMLBRElement: iface("HTMLBRElement", ["br"]),
  HTMLSpanElement: iface("HTMLSpanElement", ["span"]),
  HTMLAudioElement: iface("HTMLAudioElement", ["audio"]),
  HTMLImageElement: iface("HTMLImageElement", ["img"]),
  HTMLVideoElement: iface("HTMLVideoElement", ["video"]),
  HTMLCanvasElement: iface("HTMLCanvasElement", ["canvas"]),
  HTMLIFrameElement: iface("HTMLIFrameElement", ["iframe"]),
  HTMLScriptElement: iface("HTMLScriptElement", ["script"]),
  HTMLInputElement: iface("HTMLInputElement", ["input"]),
  HTMLButtonElement: iface("HTMLButtonElement", ["button"]),
  HTMLTextAreaElement: iface("HTMLTextAreaElement", ["textarea"]),
  HTMLSelectElement: iface("HTMLSelectElement", ["select"]),
  HTMLOptionElement: iface("HTMLOptionElement", ["option"]),
  HTMLFormElement: iface("HTMLFormElement", ["form"]),
  HTMLFieldSetElement: iface("HTMLFieldSetElement", ["fieldset"]),
  HTMLLabelElement: iface("HTMLLabelElement", ["label"]),
  HTMLTableElement: iface("HTMLTableElement", ["table"]),
  HTMLTableRowElement: iface("HTMLTableRowElement", ["tr"]),
  HTMLTableCellElement: iface("HTMLTableCellElement", ["td", "th"]),
  HTMLTableSectionElement: iface("HTMLTableSectionElement", ["tbody", "thead", "tfoot"]),
  HTMLTableColElement: iface("HTMLTableColElement", ["col", "colgroup"]),
  HTMLTableCaptionElement: iface("HTMLTableCaptionElement", ["caption"]),
  HTMLProgressElement: iface("HTMLProgressElement", ["progress"]),
  HTMLDataListElement: iface("HTMLDataListElement", ["datalist"]),
  HTMLOptGroupElement: iface("HTMLOptGroupElement", ["optgroup"]),
  HTMLMapElement: iface("HTMLMapElement", ["map"]),
  HTMLTrackElement: iface("HTMLTrackElement", ["track"]),
  HTMLSourceElement: iface("HTMLSourceElement", ["source"]),
  HTMLEmbedElement: iface("HTMLEmbedElement", ["embed"]),
  HTMLObjectElement: iface("HTMLObjectElement", ["object"]),
  HTMLParamElement: iface("HTMLParamElement", ["param"]),
  HTMLModElement: iface("HTMLModElement", ["ins", "del"]),
  HTMLQuoteElement: iface("HTMLQuoteElement", ["blockquote", "q"]),
  HTMLMenuElement: iface("HTMLMenuElement", ["menu"]),
  HTMLDialogElement: iface("HTMLDialogElement", ["dialog"]),
  HTMLTemplateElement: iface("HTMLTemplateElement", ["template"]),
  HTMLSlotElement: iface("HTMLSlotElement", ["slot"])
};
var htmlNS = {
  name: "html",
  schema: "http://www.w3.org/1999/xhtml",
  state: "enabled",
  enabled: true,
  disabled: false,
  base: HTMLElement,
  tags: {},
  types: {
    standard: { interfaces: htmlInterfaces, tags: {} },
    custom: { interfaces: {}, tags: {} }
  },
  functions: htmlFunctions,
  documentation: { w3c: "https://html.spec.whatwg.org/" }
};
var svgFunctions = {
  create(tag) {
    let t = tag;
    if (typeof t === "function") {
      const d = Core_default.GetDescriptor(t);
      t = d ? d.Tags[0] : void 0;
    }
    if (typeof t === "string")
      return document.createElementNS("http://www.w3.org/2000/svg", t.toLowerCase());
    return false;
  },
  patch: htmlFunctions.patch
  // reuse HTML patcher
};
var svgInterfaces = {
  SVGSVGElement: iface("SVGSVGElement", ["svg"]),
  SVGGElement: iface("SVGGElement", ["g"]),
  SVGPathElement: iface("SVGPathElement", ["path"]),
  SVGRectElement: iface("SVGRectElement", ["rect"]),
  SVGCircleElement: iface("SVGCircleElement", ["circle"]),
  SVGEllipseElement: iface("SVGEllipseElement", ["ellipse"]),
  SVGLineElement: iface("SVGLineElement", ["line"]),
  SVGPolylineElement: iface("SVGPolylineElement", ["polyline"]),
  SVGPolygonElement: iface("SVGPolygonElement", ["polygon"]),
  SVGTextElement: iface("SVGTextElement", ["text"]),
  SVGTSpanElement: iface("SVGTSpanElement", ["tspan"]),
  SVGImageElement: iface("SVGImageElement", ["image"]),
  SVGUseElement: iface("SVGUseElement", ["use"]),
  SVGDefsElement: iface("SVGDefsElement", ["defs"]),
  SVGSymbolElement: iface("SVGSymbolElement", ["symbol"]),
  SVGMarkerElement: iface("SVGMarkerElement", ["marker"]),
  SVGLinearGradientElement: iface("SVGLinearGradientElement", ["lineargradient"]),
  SVGRadialGradientElement: iface("SVGRadialGradientElement", ["radialgradient"]),
  SVGStopElement: iface("SVGStopElement", ["stop"]),
  SVGClipPathElement: iface("SVGClipPathElement", ["clippath"]),
  SVGMaskElement: iface("SVGMaskElement", ["mask"]),
  SVGFilterElement: iface("SVGFilterElement", ["filter"]),
  SVGAnimateElement: iface("SVGAnimateElement", ["animate"]),
  SVGAnimateMotionElement: iface("SVGAnimateMotionElement", ["animatemotion"]),
  SVGAnimateTransformElement: iface("SVGAnimateTransformElement", ["animatetransform"]),
  SVGSetElement: iface("SVGSetElement", ["set"]),
  SVGViewElement: iface("SVGViewElement", ["view"]),
  SVGScriptElement: iface("SVGScriptElement", ["script"]),
  SVGStyleElement: iface("SVGStyleElement", ["style"]),
  SVGTitleElement: iface("SVGTitleElement", ["title"]),
  SVGDescElement: iface("SVGDescElement", ["desc"]),
  SVGMetadataElement: iface("SVGMetadataElement", ["metadata"]),
  SVGForeignObjectElement: iface("SVGForeignObjectElement", ["foreignobject"]),
  SVGSwitchElement: iface("SVGSwitchElement", ["switch"])
};
var svgNS = {
  name: "svg",
  schema: "http://www.w3.org/2000/svg",
  state: "enabled",
  enabled: true,
  disabled: false,
  base: SVGElement,
  tags: {},
  types: {
    standard: { interfaces: svgInterfaces, tags: {} },
    custom: { interfaces: {}, tags: {} }
  },
  functions: svgFunctions,
  documentation: { w3c: "https://www.w3.org/TR/SVG2/" }
};
var mathMLNS = {
  name: "mathML",
  schema: "http://www.w3.org/1998/Math/MathML",
  state: "enabled",
  enabled: true,
  disabled: false,
  base: typeof MathMLElement !== "undefined" ? MathMLElement : HTMLElement,
  tags: {},
  types: {
    standard: {
      interfaces: {
        MathMLElement: iface("MathMLElement", ["math", "mi", "mo", "mn", "ms", "mspace", "mtext", "mfrac", "msqrt", "mroot", "mstyle", "merror", "mpadded", "mphantom", "mrow", "mfenced", "menclose", "msub", "msup", "msubsup", "munder", "mover", "munderover", "mmultiscripts", "mtable", "mtr", "mtd", "mlabeledtr", "maction"])
      },
      tags: {}
    },
    custom: { interfaces: {}, tags: {} }
  },
  functions: {
    create(tag) {
      const t = typeof tag === "string" ? tag : void 0;
      if (!t) return false;
      return document.createElementNS(
        "http://www.w3.org/1998/Math/MathML",
        t.toLowerCase()
      );
    },
    patch: htmlFunctions.patch
  },
  documentation: { w3c: "https://www.w3.org/TR/MathML3/" }
};
var x3dNS = {
  name: "x3d",
  schema: "http://www.web3d.org/specifications/x3d-namespace",
  state: "enabled",
  enabled: true,
  disabled: false,
  base: HTMLElement,
  tags: {},
  types: {
    standard: { interfaces: {}, tags: {} },
    custom: { interfaces: {}, tags: {} }
  },
  functions: {
    create(tag) {
      const t = typeof tag === "string" ? tag : void 0;
      if (!t) return false;
      return document.createElementNS(
        "http://www.web3d.org/specifications/x3d-namespace",
        t
      );
    },
    patch: htmlFunctions.patch
  },
  documentation: { w3c: "https://www.web3d.org/specifications/x3d-4.0/" }
};
function initNamespace(ns) {
  const std = ns.types.standard;
  for (const key of Object.keys(std.interfaces)) {
    const d = std.interfaces[key];
    d.Namespace = ns;
    if (ns.functions.patch) ns.functions.patch(key);
    const win = window;
    d.Supported = Boolean(win[key]);
    d.Defined = true;
    d.Constructor = win[key] ?? null;
    d.Interface = win[key] ?? null;
    d.Prototype = d.Supported ? win[key].prototype : null;
    for (const tag of d.Tags) {
      std.tags[tag] = d;
      ns.tags[tag] = d;
      std.tags[tag].Name = tag;
    }
  }
}
Core_default.RegisterNamespace("html", htmlNS);
Core_default.RegisterNamespace("svg", svgNS);
Core_default.RegisterNamespace("mathML", mathMLNS);
Core_default.RegisterNamespace("x3d", x3dNS);
for (const key of Object.keys(Core_default.Namespaces)) {
  initNamespace(Core_default.Namespaces[key]);
}
var Namespace_default = Core_default.Namespaces;

// core/Component.ts
var Component = class _Component {
  #delegate;
  mode;
  static Instances = [];
  constructor(arg0, arg1, ...children) {
    const opts = arg1 ?? {};
    const mode = opts.mode ?? "real";
    const attrs = { ...opts };
    delete attrs["mode"];
    this.mode = mode;
    if (mode === "virtual") {
      this.#delegate = arg0 instanceof VirtualNode ? arg0 : new VirtualNode(
        arg0,
        attrs,
        ...children
      );
    } else {
      this.#delegate = arg0 instanceof VirtualNode ? new Real_default(arg0.render()) : new Real_default(arg0, attrs, ...children);
    }
    _Component.Instances.push(this);
  }
  // ── Core API ──────────────────────────────────────────────────────────────
  render() {
    return this.#delegate.render();
  }
  valueOf() {
    return this.render();
  }
  log(v) {
    this.#delegate.log(v);
    return this;
  }
  on(type, cb, opts) {
    this.#delegate.on(type, cb, opts);
    return this;
  }
  off(type, cb, opts) {
    this.#delegate.off(type, cb, opts);
    return this;
  }
  fire(type, init) {
    this.#delegate.fire(type, init);
    return this;
  }
  append(parent) {
    const target = parent instanceof _Component ? parent.render() : parent;
    this.#delegate.append(target);
    return this;
  }
  add(...args) {
    const normalized = args.map((a) => a instanceof _Component ? a.render() : a);
    this.#delegate.add(...normalized);
    return this;
  }
  unshift(...nodes) {
    return this.add(...nodes, 0);
  }
  push(...nodes) {
    return this.add(...nodes);
  }
  remove(...targets) {
    const normalized = targets.map((t) => t instanceof _Component ? t.render() : t);
    this.#delegate.remove(...normalized);
    return this;
  }
  shift(n = 1) {
    this.#delegate.shift(n);
    return this;
  }
  pop(n = 1) {
    this.#delegate.pop(n);
    return this;
  }
  get(name) {
    return this.#delegate.get(name) ?? void 0;
  }
  set(name, value) {
    this.#delegate.set(name, value);
    return this;
  }
  show() {
    this.#delegate.show();
    return this;
  }
  hide() {
    this.#delegate.hide();
    return this;
  }
  /**
   * Returns true if the rendered element contains all given nodes.
   * FIX: implemented directly on the DOM element — Real/VirtualNode
   * do not expose a .contains() method.
   */
  contains(...nodes) {
    const root = this.render();
    return nodes.every((n) => {
      if (n instanceof _Component) return root.contains(n.render());
      if (n instanceof VirtualNode) return root.contains(n.render());
      if (n instanceof Element) return root.contains(n);
      if (typeof n === "string") return !!root.querySelector(n);
      return false;
    });
  }
  css(prop, value) {
    const el = this.render();
    if (el instanceof HTMLElement)
      el.style[prop] = value;
    return this;
  }
  // ── Fine-grain Signal+Sink API ─────────────────────────────────────────────
  text(getter) {
    this.#delegate.text(getter);
    return this;
  }
  attr(name, getter) {
    this.#delegate.attr(name, getter);
    return this;
  }
  cls(name, getter) {
    this.#delegate.cls(name, getter);
    return this;
  }
  prop(name, getter) {
    this.#delegate.prop(name, getter);
    return this;
  }
  style(prop, getter) {
    this.#delegate.style(prop, getter);
    return this;
  }
  bind(getter, setter) {
    this.#delegate.bind(getter, setter);
    return this;
  }
  destroy() {
    this.#delegate.destroy();
    return this;
  }
  /**
   * Applica o rimuove un box-shadow delegando a Real / VirtualNode.
   * @example
   *   new Component('div').shadow('open', 'glow', { color: '#e40c88', blur: 24 })
   *   new Component('div').shadow('close')
   */
  shadow(state, mode = "drop", opts = {}) {
    this.#delegate.shadow(state, mode, opts);
    return this;
  }
  // ── Static API ────────────────────────────────────────────────────────────
  static Define(tag, ctor, base = HTMLElement, style = {}) {
    return Core_default.Define(tag, ctor, base, style);
  }
  static get Namespaces() {
    return Core_default.Namespaces;
  }
};
function _cFactory(arg0, arg1, ...rest) {
  return new Component(arg0, arg1, ...rest);
}
Object.defineProperties(_cFactory, {
  prototype: { value: Component.prototype, writable: false },
  name: { value: "Component" }
});
if (typeof window !== "undefined") {
  Object.defineProperty(window, "Component", {
    value: _cFactory,
    writable: false,
    enumerable: false,
    configurable: false
  });
}
var Component_default = Component;

// core/Directive.ts
function _resolve(condition) {
  return typeof condition === "function" ? condition() : Boolean(condition);
}
function _toNode(content) {
  if (!content) return null;
  if (content instanceof Element || content instanceof DocumentFragment) return content;
  if (typeof content === "string") {
    const t = document.createElement("template");
    t.innerHTML = content;
    return t.content.cloneNode(true);
  }
  return null;
}
function _resolveParent(parent) {
  if (typeof parent === "string") return document.querySelector(parent);
  return parent;
}
var Directive = Object.freeze(
  {
    // ── if ─────────────────────────────────────────────────────────────────────
    /**
     * Conditionally insert/remove content based on a condition.
     * Uses an anchor comment node to track position in the DOM.
     * Returns an update() function — call it when the condition may have changed.
     *
     * @param parent    - Parent element or CSS selector
     * @param condition - Boolean or () => boolean
     * @param then_     - Content to show when true  (string | Element | null)
     * @param else_     - Content to show when false (string | Element | null)
     * @returns UpdateFn — call to re-evaluate
     *
     * @example
     *   const update = Directive.if(el, () => user.loggedIn, loginHtml, logoutHtml);
     *   // When condition changes:
     *   update();
     */
    if(parent, condition, then_, else_) {
      const par = _resolveParent(parent);
      if (!par) return () => {
      };
      const anchor = document.createComment(" a:if ");
      par.appendChild(anchor);
      let current = null;
      function update() {
        const val = _resolve(condition);
        const src = val ? then_ : else_;
        if (current) {
          if (Array.isArray(current))
            current.forEach((n) => {
              if (n.parentNode) n.parentNode.removeChild(n);
            });
          else if (current.parentNode)
            current.parentNode.removeChild(current);
          current = null;
        }
        if (src) {
          const next = _toNode(src);
          if (next) {
            const nodes = next.nodeType === 11 ? Array.from(next.childNodes) : [next];
            anchor.parentNode.insertBefore(next, anchor);
            current = nodes.length === 1 ? nodes[0] : nodes;
          }
        }
      }
      update();
      return update;
    },
    // ── for ────────────────────────────────────────────────────────────────────
    /**
     * Render a list from an array. Clears and re-renders on each update().
     *
     * @param parent   - Parent element
     * @param items    - Array or () => Array
     * @param renderFn - (item, index) => string | Element
     * @returns UpdateFn
     *
     * @example
     *   const update = Directive.for(ul, () => items, (item, i) =>
     *     `<li data-i="${i}">${item.name}</li>`);
     */
    for(parent, items, renderFn) {
      const par = _resolveParent(parent);
      if (!par) return () => {
      };
      const anchor = document.createComment(" a:for ");
      par.appendChild(anchor);
      const rendered = [];
      function update() {
        rendered.forEach((n) => {
          if (n.parentNode) n.parentNode.removeChild(n);
        });
        rendered.length = 0;
        const list = typeof items === "function" ? items() : items;
        const frag = document.createDocumentFragment();
        list.forEach((item, i) => {
          const node = _toNode(renderFn(item, i));
          if (node) {
            frag.appendChild(node);
            rendered.push(node);
          }
        });
        anchor.parentNode.insertBefore(frag, anchor);
      }
      update();
      return update;
    },
    // ── foreach ────────────────────────────────────────────────────────────────
    /**
     * Render an object's key/value pairs into a parent element.
     * Matches the Golem `foreach="var planet in object"` HTML attribute pattern.
     *
     * @param parent   - Parent element
     * @param obj      - Object or () => Object to iterate
     * @param renderFn - (key, value, index) => string | Element
     * @returns UpdateFn
     *
     * @example
     *   // Matches: <ol foreach="var planet in object">
     *   //            <li>{{ planet }} : {{ object[planet] }}</li>
     *   //          </ol>
     *   const update = Directive.foreach(ol, () => planets, (key, value) =>
     *     `<li class="Value">${key} : ${value}</li>`);
     */
    foreach(parent, obj, renderFn) {
      const par = _resolveParent(parent);
      if (!par) return () => {
      };
      const anchor = document.createComment(" a:foreach ");
      par.appendChild(anchor);
      const rendered = [];
      function update() {
        rendered.forEach((n) => {
          if (n.parentNode) n.parentNode.removeChild(n);
        });
        rendered.length = 0;
        const source = typeof obj === "function" ? obj() : obj;
        const frag = document.createDocumentFragment();
        Object.entries(source).forEach(([key, value], i) => {
          const node = _toNode(renderFn(key, value, i));
          if (node) {
            frag.appendChild(node);
            rendered.push(node);
          }
        });
        anchor.parentNode.insertBefore(frag, anchor);
      }
      update();
      return update;
    },
    // ── while ──────────────────────────────────────────────────────────────────
    /**
     * Render while a condition is truthy, calling renderFn(iteration) each time.
     * Has a built-in safety limit of 10000 iterations to prevent infinite loops.
     *
     * @param parent    - Parent element
     * @param condition - () => boolean — evaluated each iteration
     * @param renderFn  - (iteration: number) => string | Element
     * @returns UpdateFn
     *
     * @example
     *   let i = 0;
     *   const update = Directive.while(ul, () => i < 5, () => {
     *     const html = `<li>Item ${i}</li>`;
     *     i++;
     *     return html;
     *   });
     */
    while(parent, condition, renderFn) {
      const par = _resolveParent(parent);
      if (!par) return () => {
      };
      const anchor = document.createComment(" a:while ");
      par.appendChild(anchor);
      const rendered = [];
      function update() {
        rendered.forEach((n) => {
          if (n.parentNode) n.parentNode.removeChild(n);
        });
        rendered.length = 0;
        const frag = document.createDocumentFragment();
        let i = 0;
        const MAX = 1e4;
        while (condition() && i < MAX) {
          const node = _toNode(renderFn(i));
          if (node) {
            frag.appendChild(node);
            rendered.push(node);
          }
          i++;
        }
        anchor.parentNode.insertBefore(frag, anchor);
      }
      update();
      return update;
    },
    // ── switch ─────────────────────────────────────────────────────────────────
    /**
     * Render the matching case from a map. Falls back to 'default' key if present.
     *
     * @param parent - Parent element
     * @param value  - Current value or () => value
     * @param cases  - { [caseValue]: content, default?: content }
     * @returns UpdateFn
     *
     * @example
     *   const update = Directive.switch(el, () => tab, {
     *     home    : '<div>Home</div>',
     *     about   : '<div>About</div>',
     *     default : '<div>404</div>',
     *   });
     */
    switch(parent, value, cases) {
      const par = _resolveParent(parent);
      if (!par) return () => {
      };
      const anchor = document.createComment(" a:switch ");
      par.appendChild(anchor);
      let current = null;
      function update() {
        const val = typeof value === "function" ? value() : value;
        const src = cases[String(val)] ?? cases["default"] ?? null;
        if (current) {
          if (Array.isArray(current))
            current.forEach((n) => {
              if (n.parentNode) n.parentNode.removeChild(n);
            });
          else if (current.parentNode)
            current.parentNode.removeChild(current);
          current = null;
        }
        if (src) {
          const next = _toNode(src);
          if (next) {
            const nodes = next.nodeType === 11 ? Array.from(next.childNodes) : [next];
            anchor.parentNode.insertBefore(next, anchor);
            current = nodes.length === 1 ? nodes[0] : nodes;
          }
        }
      }
      update();
      return update;
    },
    // ── bind ───────────────────────────────────────────────────────────────────
    /**
     * One-way bind: element[prop] ← source().
     * Supports string and function sources. For State-based binding,
     * use with state.on('State-Changed', update).
     *
     * @param el   - Target element
     * @param prop - Property name (e.g. 'textContent', 'value', 'href')
     * @param source - Value or () => value
     * @returns UpdateFn
     *
     * @example
     *   const update = Directive.bind(span, 'textContent', () => state.State.name);
     *   state.on('State-Changed', update);
     */
    bind(el, prop, source) {
      function update() {
        const val = typeof source === "function" ? source() : source;
        el[prop] = val;
      }
      update();
      return update;
    },
    // ── show ───────────────────────────────────────────────────────────────────
    /**
     * Toggle visibility without removing from DOM (sets display none/empty).
     *
     * @param el        - Target element
     * @param condition - Boolean or () => boolean
     * @returns UpdateFn
     *
     * @example
     *   const update = Directive.show(panel, () => isVisible);
     *   state.on('State-Changed', update);
     */
    show(el, condition) {
      function update() {
        el.style.display = _resolve(condition) ? "" : "none";
      }
      update();
      return update;
    },
    // ── model ──────────────────────────────────────────────────────────────────
    /**
     * Two-way binding between an input element and a State property.
     * input.value → state.State[key] on 'input' event.
     * state.State[key] → input.value on State-Changed.
     *
     * @param input - Input, textarea, or select element
     * @param state - AriannA State instance
     * @param key   - Property key in state.State
     *
     * @example
     *   const state = new State({ name: 'AriannA', version: 2 });
     *   Directive.model(nameInput, state, 'name');
     *   // nameInput.value ↔ state.State.name
     */
    model(input, state, key) {
      input.addEventListener("input", () => {
        state.State[key] = input.value;
      });
      state.on("State-Changed", () => {
        const v = String(state.State[key] ?? "");
        if (input.value !== v) input.value = v;
      });
      input.value = String(state.State[key] ?? "");
    },
    // ── on ─────────────────────────────────────────────────────────────────────
    /**
     * Add a DOM event listener — thin wrapper matching v-on / @event syntax.
     * Types may be space/comma/pipe-separated.
     *
     * @example
     *   Directive.on(btn, 'click', handler);
     *   Directive.on(form, 'submit', e => { e.preventDefault(); submit(); });
     */
    on(el, types, handler, opts) {
      const target = typeof el === "string" ? document.querySelector(el) : el;
      if (!target) return;
      types.split(/\s+|,|\|/g).filter(Boolean).forEach((t) => target.addEventListener(t, handler, opts));
    },
    // ── template ───────────────────────────────────────────────────────────────
    /**
     * Process {{ expression }} template literals in an element's innerHTML.
     *
     * Supports:
     *   {{ varName }}                  — simple variable lookup
     *   {{ obj.prop }}                 — dot-path lookup (Level1A.Level2A)
     *   {{ obj[key] }}                 — bracket notation
     *
     * Matches the Golem legacy {{ planet }} / {{ object[planet] }} /
     * {{ Level1A.Level2A }} syntax from Golem-Components-Directives-TemplateLiterals.html
     * and Golem-Components-Directives-ForEach.html.
     *
     * @param el   - Element containing {{ }} placeholders
     * @param data - Data context object (defaults to window globals)
     *
     * @example
     *   var example = 'EXAMPLE'; var literals = 'LITERALS';
     *   Directive.template(div, { example, literals });
     *   // <p>This is an EXAMPLE of Template LITERALS</p>
     *
     * @example
     *   // Nested path
     *   Directive.template(el, { Level1A: { Level2A: 'Data Level2A Value' } });
     *   // {{ Level1A.Level2A }} → 'Data Level2A Value'
     */
    template(el, data) {
      const ctx = data ?? (typeof window !== "undefined" ? window : {});
      function resolve(expr) {
        expr = expr.trim();
        try {
          const parts = expr.split(/\.|\[['"]?|['"]?\]/g).filter(Boolean);
          let val = ctx;
          for (const part of parts) {
            if (val == null) return "";
            val = val[part];
          }
          return val != null ? String(val) : "";
        } catch {
          return "";
        }
      }
      el.innerHTML = el.innerHTML.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => resolve(expr));
    },
    // ── bootstrap ──────────────────────────────────────────────────────────────
    /**
     * Scan a root element for directive HTML attributes and apply them.
     * Supports: a-if, a-for, a-foreach, a-while, a-switch, a-bind, a-show, a-model, a-on.
     * Also processes {{ }} template literals in elements with a-template or data-template.
     *
     * This enables declarative HTML-first usage without writing JS:
     * ```html
     * <ol a-foreach="item in items"><li>{{ item }}</li></ol>
     * <div a-if="user.loggedIn">Welcome!</div>
     * <input a-model="state.name">
     * <button a-on="click:submitForm">Submit</button>
     * ```
     *
     * @param root    - Root element to scan (default: document.body)
     * @param context - Data context for expression evaluation (default: window)
     *
     * @example
     *   Directive.bootstrap(document.body, { items, user, state });
     */
    bootstrap(root = document.body, context = {}) {
      const ctx = { ...typeof window !== "undefined" ? window : {}, ...context };
      function evalExpr(expr) {
        try {
          const keys = Object.keys(ctx);
          const vals = Object.values(ctx);
          return new Function(...keys, `return (${expr})`)(...vals);
        } catch {
          return void 0;
        }
      }
      root.querySelectorAll("[a-template],[data-template]").forEach((el) => {
        Directive.template(el, ctx);
      });
      root.querySelectorAll("[a-if]").forEach((el) => {
        const expr = el.getAttribute("a-if") ?? "false";
        Directive.if(el.parentElement ?? root, () => Boolean(evalExpr(expr)), el);
      });
      root.querySelectorAll("[a-show]").forEach((el) => {
        const expr = el.getAttribute("a-show") ?? "false";
        Directive.show(el, () => Boolean(evalExpr(expr)));
      });
      root.querySelectorAll("[a-model]").forEach((el) => {
        const path = el.getAttribute("a-model") ?? "";
        const [stateKey, propKey] = path.split(".");
        const state = ctx[stateKey];
        if (state && propKey) Directive.model(el, state, propKey);
      });
      root.querySelectorAll("[a-on]").forEach((el) => {
        const spec = el.getAttribute("a-on") ?? "";
        const [type, fnName] = spec.split(":").map((s) => s.trim());
        if (type && fnName) {
          const handler = ctx[fnName];
          if (typeof handler === "function")
            Directive.on(el, type, handler);
        }
      });
      root.querySelectorAll("[a-bind]").forEach((el) => {
        const spec = el.getAttribute("a-bind") ?? "";
        const [prop, expr] = spec.split(":").map((s) => s.trim());
        if (prop && expr) Directive.bind(el, prop, () => evalExpr(expr));
      });
    }
  }
);
if (typeof window !== "undefined")
  Object.defineProperty(window, "Directive", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Directive
  });
var Directive_default = Directive;

// core/SSR.ts
var VOID_ELEMENTS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var RAW_ATTRS = /* @__PURE__ */ new Set(["innerHTML", "dangerouslySetInnerHTML"]);
var BOOLEAN_ATTRS = /* @__PURE__ */ new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "readonly",
  "required",
  "reversed",
  "selected",
  "typemustmatch"
]);
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function accessNode(node) {
  const tag = node.Tag ?? "div";
  const rawAttrs = node["__attrs"] ?? node["#attrs"] ?? {};
  const attrs = {};
  for (const [k, v] of Object.entries(rawAttrs)) {
    if (v === null || v === false || v === void 0) continue;
    if (v === true) {
      attrs[k] = "";
      continue;
    }
    attrs[k] = String(v);
  }
  const rawText = node["__text"] ?? node["#text"] ?? "";
  const rawChildren = node["__children"] ?? node["#children"] ?? [];
  return {
    tag,
    attrs,
    text: rawText,
    children: rawChildren.map(accessNode),
    id: node.Id ?? ""
  };
}
function renderAttrs(attrs, ssrId) {
  let s = "";
  for (const [k, v] of Object.entries(attrs)) {
    if (RAW_ATTRS.has(k)) continue;
    if (k === "textContent" || k === "innerHTML") continue;
    if (BOOLEAN_ATTRS.has(k.toLowerCase())) {
      if (v !== "" && v !== "false") s += ` ${k}`;
      continue;
    }
    s += ` ${escapeHtml(k)}="${escapeHtml(v)}"`;
  }
  if (ssrId) s += ` data-arianna-id="${escapeHtml(ssrId)}"`;
  return s;
}
function renderToString(node, options = {}) {
  const { hydration = false, indent = 0 } = options;
  return _renderNode(accessNode(node), hydration, indent, 0);
}
function _renderNode(node, hydration, indent, depth) {
  const pad = indent > 0 ? "\n" + " ".repeat(indent * depth) : "";
  const cPad = indent > 0 ? "\n" + " ".repeat(indent * (depth + 1)) : "";
  const ssrId = hydration ? node.id : void 0;
  const attrs = renderAttrs(node.attrs, ssrId);
  const textContent = node.attrs["textContent"] ?? node.text;
  const innerHTML = node.attrs["innerHTML"];
  if (VOID_ELEMENTS.has(node.tag))
    return `${pad}<${node.tag}${attrs}>`;
  const open = `${pad}<${node.tag}${attrs}>`;
  const close = `${indent > 0 ? "\n" + " ".repeat(indent * depth) : ""}</${node.tag}>`;
  if (innerHTML !== void 0)
    return `${open}${innerHTML}${close}`;
  if (textContent)
    return `${open}${escapeHtml(textContent)}${close}`;
  if (node.children.length === 0)
    return `${open}${close}`;
  const inner = node.children.map((c) => _renderNode(c, hydration, indent, depth + 1)).join("");
  return `${open}${inner}${indent > 0 ? cPad.slice(0, -indent) : ""}${close}`;
}
async function* renderToStream(node, options = {}) {
  const { hydration = false, chunkSize = 512 } = options;
  let buffer = "";
  for (const chunk of _walkNode(accessNode(node), hydration)) {
    buffer += chunk;
    if (buffer.length >= chunkSize) {
      yield buffer;
      buffer = "";
    }
  }
  if (buffer) yield buffer;
}
function* _walkNode(node, hydration) {
  const ssrId = hydration ? node.id : void 0;
  const attrs = renderAttrs(node.attrs, ssrId);
  const textContent = node.attrs["textContent"] ?? node.text;
  const innerHTML = node.attrs["innerHTML"];
  if (VOID_ELEMENTS.has(node.tag)) {
    yield `<${node.tag}${attrs}>`;
    return;
  }
  yield `<${node.tag}${attrs}>`;
  if (innerHTML !== void 0) {
    yield innerHTML;
  } else if (textContent) {
    yield escapeHtml(textContent);
  } else for (const c of node.children) yield* _walkNode(c, hydration);
  yield `</${node.tag}>`;
}
function hydrate(vnode, root, state) {
  _hydrateNode(accessNode(vnode), root);
  if (state) {
    state.on("State-Changed", () => _hydrateNode(accessNode(vnode), root));
  }
}
function _hydrateNode(node, container) {
  if (!node.id) return;
  const el = container.querySelector(`[data-arianna-id="${node.id}"]`) ?? container;
  if (!el) return;
  el.setAttribute("data-arianna-wip-hydrated", "true");
  for (const child of node.children)
    _hydrateNode(child, el);
}
var Island = {
  /**
   * Mark a VirtualNode as static — rendered server-side, never hydrated.
   * Adds data-arianna-wip-island="static" to the node's root element.
   */
  static(node) {
    node.set("data-arianna-wip-island", "static");
    return node;
  },
  /**
   * Mark a VirtualNode as an interactive island.
   * On the client, hydrate() will re-attach AriannA reactivity to this subtree.
   *
   * @param node - The interactive subtree
   * @param id   - Stable identifier for client-side matching
   */
  interactive(node, id) {
    node.set("data-arianna-wip-island", "interactive");
    node.set("data-arianna-wip-island-id", id);
    return node;
  },
  /**
   * Hydrate all interactive islands in a container.
   * Call this once on page load, after server HTML is in the DOM.
   *
   * @example
   *   Island.hydrateAll(document.body, islandMap);
   *   // islandMap: Record<id, VirtualNode>
   */
  hydrateAll(container, islandMap) {
    const islands = container.querySelectorAll('[data-arianna-wip-island="interactive"]');
    for (const el of Array.from(islands)) {
      const id = el.getAttribute("data-arianna-wip-island-id");
      const node = id ? islandMap[id] : null;
      if (node) hydrate(node, el);
    }
  }
};
var SSR = {
  name: "AriannASSR",
  version: "1.0.0",
  install(_core) {
    const api = { renderToString, renderToStream, hydrate, escapeHtml, Island };
    const g = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null;
    if (g) {
      Object.defineProperty(g, "AriannASSR", {
        value: api,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
  }
};
var SSR_default = SSR;

// core/Workers.ts
var WorkerPool = class {
  #workers = [];
  #queue = [];
  #idle = [];
  constructor(size, url) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(url, { type: "module" });
      w.onmessage = (e) => this.#onResult(w, e.data);
      w.onerror = (e) => this.#onError(w, e);
      this.#workers.push(w);
      this.#idle.push(w);
    }
  }
  /**
   * Esegue fn in un worker del pool.
   * Il worker deve esporre un handler che risponde a { fn, args }.
   */
  run(fn, args = []) {
    return new Promise((resolve, reject) => {
      const task = { fn, args, resolve, reject };
      const worker = this.#idle.pop();
      if (worker) this.#dispatch(worker, task);
      else this.#queue.push(task);
    });
  }
  /** Termina tutti i worker del pool. */
  terminate() {
    this.#workers.forEach((w) => w.terminate());
    this.#workers = [];
    this.#idle = [];
    this.#queue = [];
  }
  #dispatch(worker, task) {
    worker["__task__"] = task;
    worker.postMessage({ fn: task.fn.toString(), args: task.args });
  }
  #onResult(worker, data) {
    const task = worker["__task__"];
    task?.resolve(data);
    const next = this.#queue.shift();
    if (next) this.#dispatch(worker, next);
    else this.#idle.push(worker);
  }
  #onError(worker, e) {
    const task = worker["__task__"];
    task?.reject(e.error ?? e.message);
    this.#idle.push(worker);
  }
};
var _sharedSignals = /* @__PURE__ */ new Map();
function sharedSignal(key, initial) {
  if (_sharedSignals.has(key)) return _sharedSignals.get(key);
  const s = signal(initial);
  _sharedSignals.set(key, s);
  return s;
}
function _installWorkerListener() {
  if (typeof window === "undefined") return;
  window.addEventListener("message", (e) => {
    const { type, key, value } = e.data ?? {};
    if (type === "arianna:signal" && _sharedSignals.has(key)) {
      _sharedSignals.get(key).set(value);
    }
  });
}
function offscreen(canvas, worker) {
  if (!("transferControlToOffscreen" in canvas)) {
    console.warn("[AriannA Workers] OffscreenCanvas not supported in this browser");
    return;
  }
  const offscreenCanvas = canvas.transferControlToOffscreen();
  worker.postMessage({ type: "arianna:offscreen", canvas: offscreenCanvas }, [offscreenCanvas]);
}
var Workers = {
  name: "AriannAWorkers",
  version: "0.2.0",
  install(core, _opts) {
    _installWorkerListener();
    const API = {
      WorkerPool,
      sharedSignal,
      offscreen,
      /** Tutti i Signal condivisi attivi — utile per debug. */
      get signals() {
        return _sharedSignals;
      }
    };
    Object.defineProperty(window, "AriannAWorkers", {
      value: API,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
};
var Workers_default = Workers;

// additionals/Math.ts
var MathConstants = Object.freeze({
  // Mathematical
  E: Math.E,
  PI: Math.PI,
  Pi: Math.PI,
  pi: Math.PI,
  P: Math.PI,
  Sqrt2: Math.sqrt(2),
  Sqrt3: Math.sqrt(3),
  Sqrt5: Math.sqrt(5),
  Sqrt6: Math.sqrt(6),
  Sqrt7: Math.sqrt(7),
  P2: Math.log(1 + Math.sqrt(2)) + Math.sqrt(2),
  Gamma: 0.5772156649015329,
  Phi: (1 + Math.sqrt(5)) * 0.5,
  // Physical constants (SI)
  N: 602214129e15,
  // Avogadro (mol⁻¹)
  H: 662606957e-42,
  // Planck (J·s)
  h: 105457172647e-45,
  // Reduced Planck ħ (J·s)
  l: 1616199e-41,
  // Planck length (m)
  m: 217651e-13,
  // Planck mass (kg)
  K: 13806488e-30,
  // Boltzmann (J/K)
  Epsilon: 885418782e-20,
  // Vacuum permittivity (F/m)
  G: 667384e-16,
  // Gravitational (m³/kg·s²)
  g: 9.80665,
  // Standard gravity (m/s²)
  c: 299792458,
  // Speed of light (m/s)
  F: 602214129e15 * Math.E,
  // Faraday (C/mol)
  R: 8.314462175,
  // Gas constant (J/mol·K)
  Mu: 12566370614e-16,
  // Vacuum permeability (H/m)
  Z: 376.73031,
  // Impedance free space (Ω)
  Ke: 8987551787,
  // Coulomb (N·m²/C²)
  e: 160217656535e-30,
  // Elementary charge (C)
  Kj: 48359787011e4,
  // Josephson (Hz/V)
  Phi0: 206783375846e-26,
  // Magnetic flux quantum (Wb)
  Rydberg: 1097373156853955e-8
  // Rydberg (m⁻¹)
});
var Numbers = {
  isNatural(n) {
    return n !== void 0 && !isNaN(n) && n % 1 === 0 && n >= 0;
  },
  isRelative(n) {
    return n !== void 0 && typeof n === "number" && !isNaN(n) && n % 1 === 0;
  },
  isRational(n) {
    return n !== void 0 && typeof n === "number" && !isNaN(n) && isFinite(n);
  },
  isReal(n) {
    return n !== void 0 && typeof n === "number" && !isNaN(n);
  }
};
var Fraction = class _Fraction {
  _n;
  _d;
  _r;
  _rd;
  constructor(numerator, denominator = 1) {
    if (typeof numerator === "string") {
      const p = _Fraction.Parse(numerator);
      this._n = p._n;
      this._d = p._d;
    } else {
      this._n = numerator;
      this._d = denominator;
    }
    if (this._d === 0) throw new Error("Fraction: denominator cannot be zero");
    if (this._d < 0) {
      this._n = -this._n;
      this._d = -this._d;
    }
    const g = _Fraction._gcd(Math.abs(this._n), this._d);
    this._r = this._n / g;
    this._rd = this._d / g;
  }
  // Original Golem properties
  get Numerator() {
    return this._n;
  }
  get Denominator() {
    return this._d;
  }
  get Reduced() {
    return `${this._r}/${this._rd}`;
  }
  get Value() {
    return this._n / this._d;
  }
  get IsInteger() {
    return this._rd === 1;
  }
  get IsProper() {
    return Math.abs(this._n) < this._d;
  }
  // New — MathML and LaTeX output
  get MathML() {
    return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>${this._n}</mn><mn>${this._d}</mn></mfrac></math>`;
  }
  get LaTeX() {
    return `\frac{${this._n}}{${this._d}}`;
  }
  static Is(v) {
    return v instanceof _Fraction;
  }
  static Parse(s) {
    const parts = String(s).split("/");
    if (parts.length === 2) return new _Fraction(parseInt(parts[0]), parseInt(parts[1]));
    const n = parseFloat(s);
    if (!isNaN(n)) {
      const dec = s.includes(".") ? s.split(".")[1].length : 0;
      const d = Math.pow(10, dec);
      return new _Fraction(Math.round(n * d), d);
    }
    throw new Error(`Fraction.Parse: cannot parse "${s}"`);
  }
  static _gcd(a, b) {
    return b === 0 ? a : _Fraction._gcd(b, a % b);
  }
  static _lcm(a, b) {
    return a * b / _Fraction._gcd(a, b);
  }
  // Original Golem operations
  Sum(b) {
    const f = b instanceof _Fraction ? b : new _Fraction(b);
    const d = _Fraction._lcm(this._d, f._d);
    return new _Fraction(this._n * (d / this._d) + f._n * (d / f._d), d);
  }
  Subtract(b) {
    const f = b instanceof _Fraction ? b : new _Fraction(b);
    return this.Sum(new _Fraction(-f._n, f._d));
  }
  Multiply(b) {
    const f = b instanceof _Fraction ? b : new _Fraction(b);
    return new _Fraction(this._n * f._n, this._d * f._d);
  }
  Divide(b) {
    const f = b instanceof _Fraction ? b : new _Fraction(b);
    if (f._n === 0) throw new Error("Division by zero");
    return new _Fraction(this._n * f._d, this._d * f._n);
  }
  Power(exp) {
    return exp < 0 ? new _Fraction(Math.pow(this._d, -exp), Math.pow(this._n, -exp)) : new _Fraction(Math.pow(this._n, exp), Math.pow(this._d, exp));
  }
  Root(n) {
    return Math.pow(this.Value, 1 / n);
  }
  Exponential() {
    return Math.exp(this.Value);
  }
  Logarithm(base = Math.E) {
    return Math.log(this.Value) / Math.log(base);
  }
  Reduce() {
    return new _Fraction(this._r, this._rd);
  }
  // New
  Equals(b) {
    return this._r === b._r && this._rd === b._rd;
  }
  LessThan(b) {
    return this.Value < b.Value;
  }
  GreaterThan(b) {
    return this.Value > b.Value;
  }
  valueOf() {
    return this.Value;
  }
  toString() {
    return `${this._n}/${this._d}`;
  }
};
var MathFunctions = {
  Absolute: (x) => Math.abs(x),
  Sign: (x) => Math.sign(x),
  Sum: (...a) => a.reduce((s, v) => s + v, 0),
  Subtract: (a, b) => a - b,
  Product: (...a) => a.reduce((p, v) => p * v, 1),
  Division: (a, b) => {
    if (b === 0) throw new Error("Division by zero");
    return a / b;
  },
  Power: (b, e) => Math.pow(b, e),
  Root: (x, n = 2) => Math.pow(x, 1 / n),
  Exponential: (x) => Math.exp(x),
  Logarithm: (x, base = Math.E) => Math.log(x) / Math.log(base),
  LeastCommonMultiplier: (a, b) => {
    const gcd = (x, y) => y === 0 ? x : gcd(y, x % y);
    return Math.abs(a * b) / gcd(Math.abs(a), Math.abs(b));
  },
  GreatestCommonDivisor: (a, b) => {
    const gcd = (x, y) => y === 0 ? x : gcd(y, x % y);
    return gcd(Math.abs(a), Math.abs(b));
  },
  Factorial: (n) => {
    if (n < 0) throw new Error("Factorial undefined for negatives");
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  },
  Sine: (x) => Math.sin(x),
  Cosine: (x) => Math.cos(x),
  Tangent: (x) => Math.tan(x),
  Cotangent: (x) => 1 / Math.tan(x),
  Secant: (x) => 1 / Math.cos(x),
  Cosecant: (x) => 1 / Math.sin(x),
  HyperbolicSine: (x) => Math.sinh(x),
  HyperbolicCosine: (x) => Math.cosh(x),
  HyperbolicTangent: (x) => Math.tanh(x),
  HyperbolicCotangent: (x) => 1 / Math.tanh(x),
  HyperbolicSecant: (x) => 1 / Math.cosh(x),
  HyperbolicCosecant: (x) => 1 / Math.sinh(x),
  Random: (min = 0, max = 1) => min + Math.random() * (max - min),
  GetUUID: () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
};
var Range = class _Range {
  constructor(Start, End, Step = 1) {
    this.Start = Start;
    this.End = End;
    this.Step = Step;
    if (Step === 0) throw new Error("Range: step cannot be zero");
  }
  Start;
  End;
  Step;
  get Length() {
    return Math.ceil((this.End - this.Start) / this.Step);
  }
  get Values() {
    const arr = [];
    for (let v = this.Start; this.Step > 0 ? v <= this.End : v >= this.End; v += this.Step) arr.push(v);
    return arr;
  }
  Contains(v) {
    return v >= Math.min(this.Start, this.End) && v <= Math.max(this.Start, this.End);
  }
  Intersect(r) {
    const s = Math.max(Math.min(this.Start, this.End), Math.min(r.Start, r.End));
    const e = Math.min(Math.max(this.Start, this.End), Math.max(r.Start, r.End));
    return s <= e ? new _Range(s, e) : null;
  }
  toString() {
    return `[${this.Start}..${this.End} step ${this.Step}]`;
  }
};
var Monomial = class _Monomial {
  constructor(Coefficient, Variable = "x", Degree = 1) {
    this.Coefficient = Coefficient;
    this.Variable = Variable;
    this.Degree = Degree;
  }
  Coefficient;
  Variable;
  Degree;
  Evaluate(x) {
    return this.Coefficient * Math.pow(x, this.Degree);
  }
  Derivative() {
    if (this.Degree === 0) return new _Monomial(0, this.Variable, 0);
    return new _Monomial(this.Coefficient * this.Degree, this.Variable, this.Degree - 1);
  }
  Integral(C = 0) {
    if (this.Degree === -1) throw new Error("Use Logarithm for degree -1");
    return new _Monomial(this.Coefficient / (this.Degree + 1), this.Variable, this.Degree + 1);
  }
  Sum(m) {
    if (m.Variable !== this.Variable || m.Degree !== this.Degree) throw new Error("Can only sum like terms");
    return new _Monomial(this.Coefficient + m.Coefficient, this.Variable, this.Degree);
  }
  Multiply(m) {
    return new _Monomial(this.Coefficient * m.Coefficient, this.Variable, this.Degree + m.Degree);
  }
  get MathML() {
    if (this.Degree === 0) return `<mn>${this.Coefficient}</mn>`;
    if (this.Degree === 1) return `<mrow><mn>${this.Coefficient}</mn><mi>${this.Variable}</mi></mrow>`;
    return `<mrow><mn>${this.Coefficient}</mn><msup><mi>${this.Variable}</mi><mn>${this.Degree}</mn></msup></mrow>`;
  }
  get LaTeX() {
    if (this.Degree === 0) return `${this.Coefficient}`;
    if (this.Degree === 1) return `${this.Coefficient}${this.Variable}`;
    return `${this.Coefficient}${this.Variable}^{${this.Degree}}`;
  }
  toString() {
    return this.LaTeX;
  }
};
var LinearFunction = class _LinearFunction {
  constructor(slope, intercept) {
    this.slope = slope;
    this.intercept = intercept;
  }
  slope;
  intercept;
  evaluate(x) {
    return this.slope * x + this.intercept;
  }
  zero() {
    return -this.intercept / this.slope;
  }
  inverse() {
    return new _LinearFunction(1 / this.slope, -this.intercept / this.slope);
  }
  get LaTeX() {
    return `y = ${this.slope}x + ${this.intercept}`;
  }
  get MathML() {
    return `<math><mrow><mi>y</mi><mo>=</mo><mn>${this.slope}</mn><mi>x</mi><mo>+</mo><mn>${this.intercept}</mn></mrow></math>`;
  }
  toString() {
    return this.LaTeX;
  }
  static fromPoints(x1, y1, x2, y2) {
    if (x1 === x2) throw new Error("LinearFunction: points are vertical (undefined slope)");
    const s = (y2 - y1) / (x2 - x1);
    return new _LinearFunction(s, y1 - s * x1);
  }
  static fromSlopePoint(slope, x, y) {
    return new _LinearFunction(slope, y - slope * x);
  }
};
var QuadraticFunction = class {
  constructor(a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
  a;
  b;
  c;
  evaluate(x) {
    return this.a * x * x + this.b * x + this.c;
  }
  discriminant() {
    return this.b * this.b - 4 * this.a * this.c;
  }
  vertex() {
    const x = -this.b / (2 * this.a);
    return [x, this.evaluate(x)];
  }
  roots() {
    const d = this.discriminant();
    if (d < 0) return [];
    if (d === 0) return [-this.b / (2 * this.a)];
    return [(-this.b + Math.sqrt(d)) / (2 * this.a), (-this.b - Math.sqrt(d)) / (2 * this.a)];
  }
  derivative() {
    return new LinearFunction(2 * this.a, this.b);
  }
  get LaTeX() {
    return `${this.a}x^2 + ${this.b}x + ${this.c}`;
  }
  get MathML() {
    return `<math><mrow><mn>${this.a}</mn><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>${this.b}</mn><mi>x</mi><mo>+</mo><mn>${this.c}</mn></mrow></math>`;
  }
};
var ExponentialFunction = class {
  constructor(coefficient, base, exponentCoeff = 1) {
    this.coefficient = coefficient;
    this.base = base;
    this.exponentCoeff = exponentCoeff;
  }
  coefficient;
  base;
  exponentCoeff;
  evaluate(x) {
    return this.coefficient * Math.pow(this.base, this.exponentCoeff * x);
  }
  get LaTeX() {
    return `${this.coefficient} cdot ${this.base}^{${this.exponentCoeff}x}`;
  }
};
var Vector2 = class _Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  x;
  y;
  static zero = new _Vector2(0, 0);
  static one = new _Vector2(1, 1);
  static up = new _Vector2(0, 1);
  static right = new _Vector2(1, 0);
  add(v) {
    return new _Vector2(this.x + v.x, this.y + v.y);
  }
  sub(v) {
    return new _Vector2(this.x - v.x, this.y - v.y);
  }
  scale(s) {
    return new _Vector2(this.x * s, this.y * s);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }
  normalize() {
    const l = this.length();
    return l > 0 ? this.scale(1 / l) : _Vector2.zero;
  }
  angle() {
    return Math.atan2(this.y, this.x);
  }
  rotate(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new _Vector2(c * this.x - s * this.y, s * this.x + c * this.y);
  }
  lerp(v, t) {
    return this.add(v.sub(this).scale(t));
  }
  distance(v) {
    return this.sub(v).length();
  }
  toArray() {
    return [this.x, this.y];
  }
  clone() {
    return new _Vector2(this.x, this.y);
  }
  toString() {
    return `Vector2(${this.x}, ${this.y})`;
  }
};
var Vector3 = class _Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  x;
  y;
  z;
  static up = new _Vector3(0, 1, 0);
  static right = new _Vector3(1, 0, 0);
  static fwd = new _Vector3(0, 0, -1);
  static zero = new _Vector3(0, 0, 0);
  static one = new _Vector3(1, 1, 1);
  add(v) {
    return new _Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  sub(v) {
    return new _Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  scale(s) {
    return new _Vector3(this.x * s, this.y * s, this.z * s);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    return new _Vector3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x);
  }
  length() {
    return Math.sqrt(this.dot(this));
  }
  normalize() {
    const l = this.length();
    return l > 0 ? this.scale(1 / l) : _Vector3.zero;
  }
  lerp(v, t) {
    return this.add(v.sub(this).scale(t));
  }
  distance(v) {
    return this.sub(v).length();
  }
  reflect(n) {
    return this.sub(n.scale(2 * this.dot(n)));
  }
  toArray() {
    return [this.x, this.y, this.z];
  }
  toVec4(w = 1) {
    return new Vector4(this.x, this.y, this.z, w);
  }
  clone() {
    return new _Vector3(this.x, this.y, this.z);
  }
  toString() {
    return `Vector3(${this.x.toFixed(4)},${this.y.toFixed(4)},${this.z.toFixed(4)})`;
  }
};
var Vector4 = class _Vector4 {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  x;
  y;
  z;
  w;
  add(v) {
    return new _Vector4(this.x + v.x, this.y + v.y, this.z + v.z, this.w + v.w);
  }
  scale(s) {
    return new _Vector4(this.x * s, this.y * s, this.z * s, this.w * s);
  }
  toVec3() {
    return new Vector3(this.x / this.w, this.y / this.w, this.z / this.w);
  }
  toArray() {
    return [this.x, this.y, this.z, this.w];
  }
  toString() {
    return `Vector4(${this.x},${this.y},${this.z},${this.w})`;
  }
};
var Quaternion = class _Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  x;
  y;
  z;
  w;
  static identity = new _Quaternion(0, 0, 0, 1);
  static fromAxisAngle(axis, rad) {
    const s = Math.sin(rad / 2), n = axis.normalize();
    return new _Quaternion(n.x * s, n.y * s, n.z * s, Math.cos(rad / 2));
  }
  static fromEuler(x, y, z) {
    const cx = Math.cos(x / 2), sx = Math.sin(x / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2), cz = Math.cos(z / 2), sz = Math.sin(z / 2);
    return new _Quaternion(sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz);
  }
  multiply(q) {
    return new _Quaternion(
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z
    );
  }
  rotate(v) {
    const qv = new _Quaternion(v.x, v.y, v.z, 0), inv = new _Quaternion(-this.x, -this.y, -this.z, this.w);
    const r = this.multiply(qv).multiply(inv);
    return new Vector3(r.x, r.y, r.z);
  }
  normalize() {
    const l = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2 + this.w ** 2);
    return l > 0 ? new _Quaternion(this.x / l, this.y / l, this.z / l, this.w / l) : _Quaternion.identity;
  }
  slerp(q, t) {
    let dot = this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
    const qb = dot < 0 ? new _Quaternion(-q.x, -q.y, -q.z, -q.w) : q;
    dot = Math.abs(dot);
    if (dot > 0.9995) return new _Quaternion(this.x + (qb.x - this.x) * t, this.y + (qb.y - this.y) * t, this.z + (qb.z - this.z) * t, this.w + (qb.w - this.w) * t).normalize();
    const th0 = Math.acos(dot), th = th0 * t, s0 = Math.cos(th) - dot * Math.sin(th) / Math.sin(th0), s1 = Math.sin(th) / Math.sin(th0);
    return new _Quaternion(this.x * s0 + qb.x * s1, this.y * s0 + qb.y * s1, this.z * s0 + qb.z * s1, this.w * s0 + qb.w * s1);
  }
  toEuler() {
    const sinr_cosp = 2 * (this.w * this.x + this.y * this.z), cosr_cosp = 1 - 2 * (this.x ** 2 + this.y ** 2);
    const sinp = 2 * (this.w * this.y - this.z * this.x);
    const siny_cosp = 2 * (this.w * this.z + this.x * this.y), cosy_cosp = 1 - 2 * (this.y ** 2 + this.z ** 2);
    return [Math.atan2(sinr_cosp, cosr_cosp), Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp), Math.atan2(siny_cosp, cosy_cosp)];
  }
};
var Matrix4 = class _Matrix4 {
  _m;
  constructor(data) {
    this._m = data ? new Float32Array(data) : new Float32Array(16);
  }
  static identity() {
    return new _Matrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  static translation(x, y, z) {
    return new _Matrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }
  static scale(x, y, z) {
    return new _Matrix4([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  }
  static rotation(q) {
    const { x, y, z, w } = q;
    return new _Matrix4([1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y), 0, 2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x), 0, 2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1]);
  }
  static rotationX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new _Matrix4([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  static rotationY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new _Matrix4([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }
  static rotationZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new _Matrix4([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  static perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new _Matrix4([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  static orthographic(l, r, b, t, n, f) {
    return new _Matrix4([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
  }
  static lookAt(eye, target, up) {
    const z = eye.sub(target).normalize(), x = up.cross(z).normalize(), y = z.cross(x);
    return new _Matrix4([x.x, y.x, z.x, 0, x.y, y.y, z.y, 0, x.z, y.z, z.z, 0, -x.dot(eye), -y.dot(eye), -z.dot(eye), 1]);
  }
  multiply(b) {
    const a = this._m, bm = b._m, out = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out[j * 4 + i] = a[i] * bm[j * 4] + a[4 + i] * bm[j * 4 + 1] + a[8 + i] * bm[j * 4 + 2] + a[12 + i] * bm[j * 4 + 3];
    return new _Matrix4(out);
  }
  transpose() {
    const m = this._m;
    return new _Matrix4([m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]]);
  }
  transformPoint(v) {
    const m = this._m, x = m[0] * v.x + m[4] * v.y + m[8] * v.z + m[12], y = m[1] * v.x + m[5] * v.y + m[9] * v.z + m[13], z = m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14], w = m[3] * v.x + m[7] * v.y + m[11] * v.z + m[15];
    return new Vector3(x / w, y / w, z / w);
  }
  toFloat32Array() {
    return new Float32Array(this._m);
  }
  toArray() {
    return Array.from(this._m);
  }
  toString() {
    const m = this._m;
    return `Matrix4:
[${m[0].toFixed(3)} ${m[4].toFixed(3)} ${m[8].toFixed(3)} ${m[12].toFixed(3)}]
[${m[1].toFixed(3)} ${m[5].toFixed(3)} ${m[9].toFixed(3)} ${m[13].toFixed(3)}]
[${m[2].toFixed(3)} ${m[6].toFixed(3)} ${m[10].toFixed(3)} ${m[14].toFixed(3)}]
[${m[3].toFixed(3)} ${m[7].toFixed(3)} ${m[11].toFixed(3)} ${m[15].toFixed(3)}]`;
  }
};
var Complex = class _Complex {
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
  }
  re;
  im;
  add(c) {
    return new _Complex(this.re + c.re, this.im + c.im);
  }
  sub(c) {
    return new _Complex(this.re - c.re, this.im - c.im);
  }
  mul(c) {
    return new _Complex(this.re * c.re - this.im * c.im, this.re * c.im + this.im * c.re);
  }
  div(c) {
    const d = c.re ** 2 + c.im ** 2;
    return new _Complex((this.re * c.re + this.im * c.im) / d, (this.im * c.re - this.re * c.im) / d);
  }
  abs() {
    return Math.sqrt(this.re ** 2 + this.im ** 2);
  }
  arg() {
    return Math.atan2(this.im, this.re);
  }
  conjugate() {
    return new _Complex(this.re, -this.im);
  }
  pow(n) {
    const r = Math.pow(this.abs(), n), a = this.arg() * n;
    return new _Complex(r * Math.cos(a), r * Math.sin(a));
  }
  sqrt() {
    return this.pow(0.5);
  }
  exp() {
    const e = Math.exp(this.re);
    return new _Complex(e * Math.cos(this.im), e * Math.sin(this.im));
  }
  Norm() {
    return this.re ** 2 + this.im ** 2;
  }
  Argument() {
    return this.arg();
  }
  Conjugate() {
    return this.conjugate();
  }
  static fromPolar(r, theta) {
    return new _Complex(r * Math.cos(theta), r * Math.sin(theta));
  }
  get MathML() {
    return `<math><mrow><mn>${this.re}</mn><mo>+</mo><mn>${this.im}</mn><mi>i</mi></mrow></math>`;
  }
  get LaTeX() {
    return `${this.re}${this.im >= 0 ? "+" : ""}${this.im}i`;
  }
  toString() {
    return this.LaTeX;
  }
};
var Statistics = {
  mean: (d) => d.reduce((a, b) => a + b, 0) / d.length,
  sum: (d) => d.reduce((a, b) => a + b, 0),
  min: (d) => Math.min(...d),
  max: (d) => Math.max(...d),
  range: (d) => Math.max(...d) - Math.min(...d),
  median: (d) => {
    const s = [...d].sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  },
  mode: (d) => {
    const c = /* @__PURE__ */ new Map();
    d.forEach((v) => c.set(v, (c.get(v) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
  },
  variance: (d) => {
    const m = Statistics.mean(d);
    return d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length;
  },
  stdDev: (d) => Math.sqrt(Statistics.variance(d)),
  zScore: (d, x) => (x - Statistics.mean(d)) / Statistics.stdDev(d),
  percentile: (d, p) => {
    const s = [...d].sort((a, b) => a - b), i = p / 100 * (s.length - 1);
    const lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  },
  histogram: (d, buckets) => {
    const mn = Math.min(...d), mx = Math.max(...d), w = (mx - mn) / buckets;
    const out = Array.from({ length: buckets }, (_, i) => ({ min: mn + i * w, max: mn + (i + 1) * w, count: 0, frequency: 0 }));
    d.forEach((v) => {
      const i = Math.min(Math.floor((v - mn) / w), buckets - 1);
      out[i].count++;
    });
    out.forEach((b) => b.frequency = b.count / d.length);
    return out;
  },
  linearRegression: (xs, ys) => {
    const n = xs.length, mx = Statistics.mean(xs), my = Statistics.mean(ys);
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const intercept = my - slope * mx;
    const predicted = xs.map((x) => slope * x + intercept);
    const ss_res = ys.reduce((a, y, i) => a + (y - predicted[i]) ** 2, 0);
    const ss_tot = ys.reduce((a, y) => a + (y - my) ** 2, 0);
    return { slope, intercept, r2: 1 - ss_res / ss_tot, predict: (x) => slope * x + intercept };
  }
};
var AriannaMath = {
  name: "Math",
  version: "1.0.0",
  install(_core) {
    try {
      Object.assign(window, {
        MathConstants,
        Numbers,
        Fraction,
        MathFunctions,
        Range,
        Monomial,
        LinearFunction,
        QuadraticFunction,
        ExponentialFunction,
        Vector2,
        Vector3,
        Vector4,
        Quaternion,
        Matrix4,
        Complex,
        Statistics
      });
    } catch {
    }
  }
};
var Math_default = AriannaMath;
var _PERM = (() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return [...p, ...p];
})();

// additionals/Geometry.ts
var Angle = class _Angle {
  _radians;
  constructor(value, unit = "Radians") {
    this._radians = _Angle._toRadians(value, unit);
  }
  // Unit conversions — all original Golem units
  get Radians() {
    return this._radians;
  }
  get Degrees() {
    return this._radians * 180 / Math.PI;
  }
  get Turns() {
    return this._radians / (2 * Math.PI);
  }
  get Quadrants() {
    return this._radians / (Math.PI / 2);
  }
  get Grads() {
    return this._radians * 200 / Math.PI;
  }
  get Mils() {
    return this._radians * 3200 / Math.PI;
  }
  get Sextants() {
    return this._radians / (Math.PI / 3);
  }
  get Points() {
    return this._radians * 32 / (2 * Math.PI);
  }
  get BinaryDegrees() {
    return this._radians * 256 / (2 * Math.PI);
  }
  get Hours() {
    return this._radians * 12 / Math.PI;
  }
  get Minutes() {
    return this.Hours * 60;
  }
  get Seconds() {
    return this.Hours * 3600;
  }
  // Trig values — original Golem
  get Sine() {
    return Math.sin(this._radians);
  }
  get Cosine() {
    return Math.cos(this._radians);
  }
  get Tangent() {
    return Math.tan(this._radians);
  }
  get Secant() {
    return 1 / Math.cos(this._radians);
  }
  get Cosecant() {
    return 1 / Math.sin(this._radians);
  }
  get Cotangent() {
    return 1 / Math.tan(this._radians);
  }
  // Operations
  add(b) {
    return new _Angle(this._radians + b._radians);
  }
  sub(b) {
    return new _Angle(this._radians - b._radians);
  }
  scale(s) {
    return new _Angle(this._radians * s);
  }
  normalize() {
    return new _Angle((this._radians % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI));
  }
  static Parse(s) {
    const n = parseFloat(s);
    if (s.includes("\xB0") || s.toLowerCase().includes("deg")) return new _Angle(n, "Degrees");
    if (s.toLowerCase().includes("grad")) return new _Angle(n, "Grads");
    if (s.toLowerCase().includes("turn")) return new _Angle(n, "Turns");
    return new _Angle(n, "Radians");
  }
  static Is(v) {
    return v instanceof _Angle;
  }
  static _toRadians(value, unit) {
    switch (unit) {
      case "Degrees":
        return value * Math.PI / 180;
      case "Turns":
        return value * 2 * Math.PI;
      case "Quadrants":
        return value * Math.PI / 2;
      case "Grads":
        return value * Math.PI / 200;
      case "Mils":
        return value * Math.PI / 3200;
      case "Sextants":
        return value * Math.PI / 3;
      case "Points":
        return value * 2 * Math.PI / 32;
      case "BinaryDegrees":
        return value * 2 * Math.PI / 256;
      case "Hours":
        return value * Math.PI / 12;
      case "Minutes":
        return value * Math.PI / 720;
      case "Seconds":
        return value * Math.PI / 43200;
      default:
        return value;
    }
  }
  valueOf() {
    return this._radians;
  }
  toString() {
    return `${this.Degrees.toFixed(4)}\xB0`;
  }
};
var Rotation = class _Rotation {
  _psi;
  _theta;
  _phi;
  constructor(psi = 0, theta = 0, phi = 0, unit = "Radians") {
    this._psi = psi instanceof Angle ? psi : new Angle(psi, unit);
    this._theta = theta instanceof Angle ? theta : new Angle(theta, unit);
    this._phi = phi instanceof Angle ? phi : new Angle(phi, unit);
  }
  get Psi() {
    return this._psi;
  }
  get Theta() {
    return this._theta;
  }
  get Phi() {
    return this._phi;
  }
  get Matrix() {
    return Matrix4.rotation(this.toQuaternion());
  }
  get Quaternion() {
    return this.toQuaternion();
  }
  toQuaternion() {
    return Quaternion.fromEuler(this._psi.Radians, this._theta.Radians, this._phi.Radians);
  }
  static Is(v) {
    return v instanceof _Rotation;
  }
  toString() {
    return `Rotation(\u03C8=${this._psi}, \u03B8=${this._theta}, \u03C6=${this._phi})`;
  }
};
var Size = class _Size {
  constructor(Width = 0, Height = 0, Depth = 0) {
    this.Width = Width;
    this.Height = Height;
    this.Depth = Depth;
  }
  Width;
  Height;
  Depth;
  get Area() {
    return this.Width * this.Height;
  }
  get Volume() {
    return this.Width * this.Height * this.Depth;
  }
  scale(s) {
    return new _Size(this.Width * s, this.Height * s, this.Depth * s);
  }
  toString() {
    return `Size(${this.Width}\xD7${this.Height}\xD7${this.Depth})`;
  }
};
var Point = class _Point {
  constructor(X = 0, Y = 0, Z = 0) {
    this.X = X;
    this.Y = Y;
    this.Z = Z;
  }
  X;
  Y;
  Z;
  distanceTo(p) {
    return Math.sqrt((p.X - this.X) ** 2 + (p.Y - this.Y) ** 2 + (p.Z - this.Z) ** 2);
  }
  toVector3() {
    return new Vector3(this.X, this.Y, this.Z);
  }
  translate(dx, dy, dz = 0) {
    return new _Point(this.X + dx, this.Y + dy, this.Z + dz);
  }
  toString() {
    return `Point(${this.X},${this.Y},${this.Z})`;
  }
};
var Matrix = class _Matrix {
  _data;
  rows;
  cols;
  constructor(data) {
    this._data = data.map((r) => [...r]);
    this.rows = data.length;
    this.cols = data[0]?.length ?? 0;
  }
  static identity(n) {
    return new _Matrix(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => i === j ? 1 : 0)));
  }
  static zeros(rows, cols) {
    return new _Matrix(Array.from({ length: rows }, () => new Array(cols).fill(0)));
  }
  static from(flat, rows, cols) {
    return new _Matrix(Array.from({ length: rows }, (_, i) => flat.slice(i * cols, (i + 1) * cols)));
  }
  static Is(v) {
    return v instanceof _Matrix;
  }
  get(r, c) {
    return this._data[r][c];
  }
  set(r, c, v) {
    this._data[r][c] = v;
    return this;
  }
  row(r) {
    return [...this._data[r]];
  }
  col(c) {
    return this._data.map((r) => r[c]);
  }
  // Original Golem methods
  Diagonal() {
    return Array.from({ length: Math.min(this.rows, this.cols) }, (_, i) => this._data[i][i]);
  }
  Trace() {
    return this.Diagonal().reduce((a, b) => a + b, 0);
  }
  Clone() {
    return new _Matrix(this._data);
  }
  Transpose() {
    return new _Matrix(Array.from({ length: this.cols }, (_, j) => Array.from({ length: this.rows }, (_2, i) => this._data[i][j])));
  }
  Sum(b) {
    return new _Matrix(this._data.map((r, i) => r.map((v, j) => v + b._data[i][j])));
  }
  Subtract(b) {
    return new _Matrix(this._data.map((r, i) => r.map((v, j) => v - b._data[i][j])));
  }
  Multiply(b) {
    const out = _Matrix.zeros(this.rows, b.cols);
    for (let i = 0; i < this.rows; i++) for (let j = 0; j < b.cols; j++) for (let k = 0; k < this.cols; k++) out._data[i][j] += this._data[i][k] * b._data[k][j];
    return out;
  }
  Divide(s) {
    return new _Matrix(this._data.map((r) => r.map((v) => v / s)));
  }
  Determinant() {
    if (this.rows !== this.cols) throw new Error("Determinant: matrix must be square");
    const n = this.rows;
    if (n === 1) return this._data[0][0];
    if (n === 2) return this._data[0][0] * this._data[1][1] - this._data[0][1] * this._data[1][0];
    let det = 0;
    for (let j = 0; j < n; j++) det += (j % 2 === 0 ? 1 : -1) * this._data[0][j] * this.GetMinor(0, j).Determinant();
    return det;
  }
  GetMinor(row, col) {
    return new _Matrix(this._data.filter((_, i) => i !== row).map((r) => r.filter((_, j) => j !== col)));
  }
  Invertible() {
    return Math.abs(this.Determinant()) > 1e-10;
  }
  Singular() {
    return !this.Invertible();
  }
  Inverse() {
    if (!this.Invertible()) throw new Error("Matrix.Inverse: matrix is singular");
    const n = this.rows, det = this.Determinant();
    const adj = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => ((i + j) % 2 === 0 ? 1 : -1) * this.GetMinor(j, i).Determinant()));
    return new _Matrix(adj).Divide(det);
  }
  // LUP decomposition (original Golem)
  LUP() {
    const n = this.rows;
    const L = _Matrix.identity(n), U = this.Clone(), P = _Matrix.identity(n);
    for (let k = 0; k < n; k++) {
      let max = Math.abs(U._data[k][k]), maxRow = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(U._data[i][k]) > max) {
        max = Math.abs(U._data[i][k]);
        maxRow = i;
      }
      [U._data[k], U._data[maxRow]] = [U._data[maxRow], U._data[k]];
      [P._data[k], P._data[maxRow]] = [P._data[maxRow], P._data[k]];
      for (let i = k + 1; i < n; i++) {
        const f = U._data[i][k] / U._data[k][k];
        L._data[i][k] = f;
        for (let j = k; j < n; j++) U._data[i][j] -= f * U._data[k][j];
      }
    }
    return { L, U, P };
  }
  Lower() {
    return this.LUP().L;
  }
  Upper() {
    return this.LUP().U;
  }
  Permutation() {
    return this.LUP().P;
  }
  // QR decomposition (original Golem)
  QR() {
    const n = this.rows, m = this.cols;
    const Q = _Matrix.zeros(n, m), R = _Matrix.zeros(m, m);
    const cols = Array.from({ length: m }, (_, j) => this.col(j));
    const qs = [];
    for (let j = 0; j < m; j++) {
      let u = [...cols[j]];
      for (const q of qs) {
        const dot = u.reduce((s, v, i) => s + v * q[i], 0);
        u = u.map((v, i) => v - dot * q[i]);
      }
      const norm = Math.sqrt(u.reduce((s, v) => s + v * v, 0));
      const e = norm > 1e-10 ? u.map((v) => v / norm) : u;
      qs.push(e);
      for (let i = 0; i < n; i++) Q._data[i][j] = e[i];
      for (let jj = j; jj < m; jj++) R._data[j][jj] = cols[jj].reduce((s, v, i) => s + v * e[i], 0);
    }
    return { Q, R };
  }
  Q() {
    return this.QR().Q;
  }
  R() {
    return this.QR().R;
  }
  H() {
    return this.Transpose();
  }
  // Hermitian (conjugate transpose — same as transpose for real)
  // RREF (Row Reduced Echelon Form)
  RREF() {
    const m = this.Clone();
    let lead = 0;
    for (let r = 0; r < m.rows; r++) {
      if (lead >= m.cols) break;
      let i = r;
      while (Math.abs(m._data[i][lead]) < 1e-10) {
        i++;
        if (i === m.rows) {
          i = r;
          lead++;
          if (lead === m.cols) return m;
        }
      }
      [m._data[i], m._data[r]] = [m._data[r], m._data[i]];
      const lv = m._data[r][lead];
      m._data[r] = m._data[r].map((v) => v / lv);
      for (let j = 0; j < m.rows; j++) if (j !== r) {
        const f = m._data[j][lead];
        m._data[j] = m._data[j].map((v, c) => v - f * m._data[r][c]);
      }
      lead++;
    }
    return m;
  }
  // EigenValues (power iteration for dominant eigenvalue; QR method for all)
  EigenValues() {
    if (this.rows !== this.cols) throw new Error("EigenValues: matrix must be square");
    let A = this.Clone();
    for (let iter = 0; iter < 100; iter++) {
      const { Q, R } = A.QR();
      A = R.Multiply(Q);
    }
    return A.Diagonal();
  }
  EigenVectors() {
    const eigenvals = this.EigenValues();
    const n = this.rows;
    const vecs = [];
    for (const lambda of eigenvals) {
      const shifted = this.Subtract(_Matrix.identity(n).Multiply(new _Matrix([[lambda]])));
      let v = Array.from({ length: n }, () => Math.random());
      for (let iter = 0; iter < 50; iter++) {
        const mv = shifted.Multiply(new _Matrix(v.map((x) => [x]))).col(0);
        const norm = Math.sqrt(mv.reduce((s, x) => s + x * x, 0));
        v = norm > 1e-10 ? mv.map((x) => x / norm) : v;
      }
      vecs.push(v);
    }
    return new _Matrix(vecs[0].map((_, i) => vecs.map((v) => v[i])));
  }
  toString() {
    return this._data.map((r) => "[" + r.map((v) => v.toFixed(4)).join(", ") + "]").join("\n");
  }
};
var Transform = class _Transform {
  _matrix;
  constructor(matrix) {
    this._matrix = matrix ?? Matrix4.identity();
  }
  get Matrix() {
    return this._matrix;
  }
  Translate(x, y, z = 0) {
    return new _Transform(this._matrix.multiply(Matrix4.translation(x, y, z)));
  }
  Scale(x, y, z = 1) {
    return new _Transform(this._matrix.multiply(Matrix4.scale(x, y, z)));
  }
  Rotate(angle, axis = new Vector3(0, 0, 1)) {
    return new _Transform(this._matrix.multiply(Matrix4.rotation(Quaternion.fromAxisAngle(axis, angle.Radians))));
  }
  Skew(ax, ay) {
    const m = Matrix4.identity();
    const arr = m.toArray();
    arr[4] = Math.tan(ax);
    arr[1] = Math.tan(ay);
    return new _Transform(this._matrix.multiply(new Matrix4(arr)));
  }
  Reflect(axis) {
    const s = { x: [-1, 1, 1], y: [1, -1, 1], z: [1, 1, -1] }[axis];
    return new _Transform(this._matrix.multiply(Matrix4.scale(s[0], s[1], s[2])));
  }
  get CSSMatrix() {
    const m = this._matrix.toArray();
    return `matrix3d(${m.map((v) => v.toFixed(6)).join(",")})`;
  }
  get CSS() {
    return `transform: ${this.CSSMatrix};`;
  }
  toString() {
    return this.CSSMatrix;
  }
};
var AABB = class _AABB {
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }
  min;
  max;
  center() {
    return this.min.add(this.max).scale(0.5);
  }
  size() {
    return this.max.sub(this.min);
  }
  contains(p) {
    return p.x >= this.min.x && p.x <= this.max.x && p.y >= this.min.y && p.y <= this.max.y && p.z >= this.min.z && p.z <= this.max.z;
  }
  intersects(b) {
    return this.min.x <= b.max.x && this.max.x >= b.min.x && this.min.y <= b.max.y && this.max.y >= b.min.y && this.min.z <= b.max.z && this.max.z >= b.min.z;
  }
  expand(v) {
    return new _AABB(
      new Vector3(Math.min(this.min.x, v.x), Math.min(this.min.y, v.y), Math.min(this.min.z, v.z)),
      new Vector3(Math.max(this.max.x, v.x), Math.max(this.max.y, v.y), Math.max(this.max.z, v.z))
    );
  }
  merge(b) {
    return new _AABB(
      new Vector3(Math.min(this.min.x, b.min.x), Math.min(this.min.y, b.min.y), Math.min(this.min.z, b.min.z)),
      new Vector3(Math.max(this.max.x, b.max.x), Math.max(this.max.y, b.max.y), Math.max(this.max.z, b.max.z))
    );
  }
  volume() {
    const s = this.size();
    return s.x * s.y * s.z;
  }
  toString() {
    return `AABB(${this.min}, ${this.max})`;
  }
};
var Ray = class {
  origin;
  direction;
  constructor(origin, direction) {
    this.origin = origin;
    this.direction = direction.normalize();
  }
  at(t) {
    return this.origin.add(this.direction.scale(t));
  }
  intersectAABB(box) {
    const inv = new Vector3(1 / this.direction.x, 1 / this.direction.y, 1 / this.direction.z);
    const t1 = (box.min.x - this.origin.x) * inv.x, t2 = (box.max.x - this.origin.x) * inv.x;
    const t3 = (box.min.y - this.origin.y) * inv.y, t4 = (box.max.y - this.origin.y) * inv.y;
    const t5 = (box.min.z - this.origin.z) * inv.z, t6 = (box.max.z - this.origin.z) * inv.z;
    const tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
    const tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));
    const hit = tmax >= 0 && tmin <= tmax;
    return { hit, t: tmin, point: hit ? this.at(tmin) : void 0 };
  }
  intersectPlane(normal, d) {
    const denom = normal.dot(this.direction);
    if (Math.abs(denom) < 1e-6) return { hit: false, t: 0 };
    const t = (d - normal.dot(this.origin)) / denom;
    return { hit: t >= 0, t, point: t >= 0 ? this.at(t) : void 0 };
  }
  intersectSphere(center, radius) {
    const oc = this.origin.sub(center);
    const b = oc.dot(this.direction), c = oc.dot(oc) - radius * radius, disc = b * b - c;
    if (disc < 0) return { hit: false, t: 0 };
    const t = -b - Math.sqrt(disc);
    return { hit: t >= 0, t };
  }
};
var Rectangle = class {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  x;
  y;
  width;
  height;
  get area() {
    return this.width * this.height;
  }
  get perimeter() {
    return 2 * (this.width + this.height);
  }
  get diagonal() {
    return Math.sqrt(this.width ** 2 + this.height ** 2);
  }
  contains(px, py) {
    return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height;
  }
  intersects(r) {
    return !(r.x > this.x + this.width || r.x + r.width < this.x || r.y > this.y + this.height || r.y + r.height < this.y);
  }
  toSVG() {
    return `<rect x="${this.x}" y="${this.y}" width="${this.width}" height="${this.height}"/>`;
  }
  toHTML() {
    return `style="position:absolute;left:${this.x}px;top:${this.y}px;width:${this.width}px;height:${this.height}px"`;
  }
  toString() {
    return `Rectangle(${this.x},${this.y},${this.width}\xD7${this.height})`;
  }
};
var Circle = class {
  constructor(cx, cy, radius) {
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
  }
  cx;
  cy;
  radius;
  get area() {
    return Math.PI * this.radius ** 2;
  }
  get circumference() {
    return 2 * Math.PI * this.radius;
  }
  contains(px, py) {
    return (px - this.cx) ** 2 + (py - this.cy) ** 2 <= this.radius ** 2;
  }
  intersects(c) {
    return Math.sqrt((c.cx - this.cx) ** 2 + (c.cy - this.cy) ** 2) <= this.radius + c.radius;
  }
  toSVG() {
    return `<circle cx="${this.cx}" cy="${this.cy}" r="${this.radius}"/>`;
  }
  toString() {
    return `Circle(${this.cx},${this.cy},r=${this.radius})`;
  }
};
var Triangle = class {
  constructor(a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
  a;
  b;
  c;
  get area() {
    return Math.abs((this.b.X - this.a.X) * (this.c.Y - this.a.Y) - (this.c.X - this.a.X) * (this.b.Y - this.a.Y)) / 2;
  }
  get perimeter() {
    return this.a.distanceTo(this.b) + this.b.distanceTo(this.c) + this.c.distanceTo(this.a);
  }
  centroid() {
    return new Point((this.a.X + this.b.X + this.c.X) / 3, (this.a.Y + this.b.Y + this.c.Y) / 3);
  }
  contains(p) {
    const d1 = Math.sign((p.X - this.b.X) * (this.a.Y - this.b.Y) - (this.a.X - this.b.X) * (p.Y - this.b.Y));
    const d2 = Math.sign((p.X - this.c.X) * (this.b.Y - this.c.Y) - (this.b.X - this.c.X) * (p.Y - this.c.Y));
    const d3 = Math.sign((p.X - this.a.X) * (this.c.Y - this.a.Y) - (this.c.X - this.a.X) * (p.Y - this.a.Y));
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  toSVG() {
    return `<polygon points="${this.a.X},${this.a.Y} ${this.b.X},${this.b.Y} ${this.c.X},${this.c.Y}"/>`;
  }
};
var Polygon = class {
  constructor(points) {
    this.points = points;
  }
  points;
  get area() {
    let a = 0;
    for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) a += (this.points[j].X + this.points[i].X) * (this.points[j].Y - this.points[i].Y);
    return Math.abs(a) / 2;
  }
  get perimeter() {
    return this.points.reduce((s, p, i) => s + p.distanceTo(this.points[(i + 1) % this.points.length]), 0);
  }
  centroid() {
    const n = this.points.length;
    return new Point(this.points.reduce((s, p) => s + p.X, 0) / n, this.points.reduce((s, p) => s + p.Y, 0) / n);
  }
  toSVG() {
    return `<polygon points="${this.points.map((p) => `${p.X},${p.Y}`).join(" ")}"/>`;
  }
};
var Sphere = class {
  constructor(radius) {
    this.radius = radius;
  }
  radius;
  get volume() {
    return 4 / 3 * Math.PI * this.radius ** 3;
  }
  get surfaceArea() {
    return 4 * Math.PI * this.radius ** 2;
  }
  get diameter() {
    return 2 * this.radius;
  }
  toSVG(cx = 0, cy = 0) {
    return `<circle cx="${cx}" cy="${cy}" r="${this.radius}"/>`;
  }
  toString() {
    return `Sphere(r=${this.radius})`;
  }
};
var Box = class {
  constructor(width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;
  }
  width;
  height;
  depth;
  get volume() {
    return this.width * this.height * this.depth;
  }
  get surfaceArea() {
    return 2 * (this.width * this.height + this.height * this.depth + this.depth * this.width);
  }
  get diagonal() {
    return Math.sqrt(this.width ** 2 + this.height ** 2 + this.depth ** 2);
  }
  toAABB(center = new Vector3()) {
    const h = new Vector3(this.width / 2, this.height / 2, this.depth / 2);
    return new AABB(center.sub(h), center.add(h));
  }
  toString() {
    return `Box(${this.width}\xD7${this.height}\xD7${this.depth})`;
  }
};
var Cylinder = class {
  constructor(radius, height) {
    this.radius = radius;
    this.height = height;
  }
  radius;
  height;
  get volume() {
    return Math.PI * this.radius ** 2 * this.height;
  }
  get surfaceArea() {
    return 2 * Math.PI * this.radius * (this.radius + this.height);
  }
  get lateralArea() {
    return 2 * Math.PI * this.radius * this.height;
  }
  toString() {
    return `Cylinder(r=${this.radius},h=${this.height})`;
  }
};
var Torus = class {
  constructor(majorRadius, minorRadius) {
    this.majorRadius = majorRadius;
    this.minorRadius = minorRadius;
  }
  majorRadius;
  minorRadius;
  get volume() {
    return 2 * Math.PI ** 2 * this.majorRadius * this.minorRadius ** 2;
  }
  get surfaceArea() {
    return 4 * Math.PI ** 2 * this.majorRadius * this.minorRadius;
  }
  toString() {
    return `Torus(R=${this.majorRadius},r=${this.minorRadius})`;
  }
};
var Cone = class {
  constructor(radius, height) {
    this.radius = radius;
    this.height = height;
  }
  radius;
  height;
  get slantHeight() {
    return Math.sqrt(this.radius ** 2 + this.height ** 2);
  }
  get volume() {
    return 1 / 3 * Math.PI * this.radius ** 2 * this.height;
  }
  get surfaceArea() {
    return Math.PI * this.radius * (this.radius + this.slantHeight);
  }
  toString() {
    return `Cone(r=${this.radius},h=${this.height})`;
  }
};
var Pyramid = class {
  constructor(baseWidth, baseDepth, height) {
    this.baseWidth = baseWidth;
    this.baseDepth = baseDepth;
    this.height = height;
  }
  baseWidth;
  baseDepth;
  height;
  get volume() {
    return 1 / 3 * this.baseWidth * this.baseDepth * this.height;
  }
  get baseArea() {
    return this.baseWidth * this.baseDepth;
  }
  toString() {
    return `Pyramid(${this.baseWidth}\xD7${this.baseDepth},h=${this.height})`;
  }
};
var Tube = class {
  constructor(outerRadius, innerRadius, height) {
    this.outerRadius = outerRadius;
    this.innerRadius = innerRadius;
    this.height = height;
  }
  outerRadius;
  innerRadius;
  height;
  get volume() {
    return Math.PI * (this.outerRadius ** 2 - this.innerRadius ** 2) * this.height;
  }
  get surfaceArea() {
    return 2 * Math.PI * (this.outerRadius + this.innerRadius) * this.height + 2 * Math.PI * (this.outerRadius ** 2 - this.innerRadius ** 2);
  }
  toString() {
    return `Tube(r=${this.outerRadius},ri=${this.innerRadius},h=${this.height})`;
  }
};
var Shapes = { Rectangle, Circle, Triangle, Polygon };
var Solids = { Sphere, Box, Cylinder, Torus, Cone, Pyramid, Tube };
var Plane3D = class _Plane3D {
  normal;
  constant;
  constructor(nx, ny, nz, d) {
    this.normal = { x: nx, y: ny, z: nz };
    this.constant = d;
  }
  static fromPoints(a, b, c) {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const n = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };
    const len = Math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2) || 1;
    n.x /= len;
    n.y /= len;
    n.z /= len;
    const d = -(n.x * a.x + n.y * a.y + n.z * a.z);
    return new _Plane3D(n.x, n.y, n.z, d);
  }
  distanceToPoint(p) {
    return this.normal.x * p.x + this.normal.y * p.y + this.normal.z * p.z + this.constant;
  }
  projectPoint(p) {
    const d = this.distanceToPoint(p);
    return { x: p.x - d * this.normal.x, y: p.y - d * this.normal.y, z: p.z - d * this.normal.z };
  }
  /** Returns parameter t at which a ray hits this plane, or null. */
  rayIntersect(origin, dir) {
    const denom = this.normal.x * dir.x + this.normal.y * dir.y + this.normal.z * dir.z;
    if (Math.abs(denom) < 1e-6) return null;
    const t = -(this.normal.x * origin.x + this.normal.y * origin.y + this.normal.z * origin.z + this.constant) / denom;
    return t >= 0 ? t : null;
  }
};
var BVH = class {
  #root = null;
  build(triangles, maxLeaf = 4) {
    this.#root = this.#buildNode(triangles, 0, maxLeaf);
    return this;
  }
  #centroid(t) {
    return {
      x: (t.a.x + t.b.x + t.c.x) / 3,
      y: (t.a.y + t.b.y + t.c.y) / 3,
      z: (t.a.z + t.b.z + t.c.z) / 3
    };
  }
  #triBox(tris) {
    const pts = tris.flatMap((t) => [t.a, t.b, t.c]);
    return {
      min: { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)), z: Math.min(...pts.map((p) => p.z)) },
      max: { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)), z: Math.max(...pts.map((p) => p.z)) }
    };
  }
  #buildNode(tris, depth, maxLeaf) {
    const box = this.#triBox(tris);
    if (tris.length <= maxLeaf || depth > 20) return { box, tris };
    const axis = ["x", "y", "z"][[box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z].indexOf(Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z))];
    const sorted = [...tris].sort((a, b) => this.#centroid(a)[axis] - this.#centroid(b)[axis]);
    const mid = Math.floor(sorted.length / 2);
    return {
      box,
      left: this.#buildNode(sorted.slice(0, mid), depth + 1, maxLeaf),
      right: this.#buildNode(sorted.slice(mid), depth + 1, maxLeaf)
    };
  }
  /** Ray-cast: returns nearest hit triangle index and t parameter, or null. */
  raycast(origin, dir) {
    let best = null;
    const traverse = (node) => {
      if (!node || !this.#rayHitsBox(origin, dir, node.box)) return;
      if (node.tris) {
        for (const tri of node.tris) {
          const t = this.#rayTriangle(origin, dir, tri);
          if (t !== null && (best === null || t < best.t)) best = { index: tri.index, t };
        }
      } else {
        traverse(node.left);
        traverse(node.right);
      }
    };
    traverse(this.#root ?? void 0);
    return best;
  }
  #rayHitsBox(o, d, box) {
    let tmin = -Infinity, tmax = Infinity;
    for (const axis of ["x", "y", "z"]) {
      if (Math.abs(d[axis]) < 1e-8) {
        if (o[axis] < box.min[axis] || o[axis] > box.max[axis]) return false;
      } else {
        const t1 = (box.min[axis] - o[axis]) / d[axis];
        const t2 = (box.max[axis] - o[axis]) / d[axis];
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
        if (tmax < tmin) return false;
      }
    }
    return true;
  }
  #rayTriangle(o, d, t) {
    const edge1 = { x: t.b.x - t.a.x, y: t.b.y - t.a.y, z: t.b.z - t.a.z };
    const edge2 = { x: t.c.x - t.a.x, y: t.c.y - t.a.y, z: t.c.z - t.a.z };
    const h = { x: d.y * edge2.z - d.z * edge2.y, y: d.z * edge2.x - d.x * edge2.z, z: d.x * edge2.y - d.y * edge2.x };
    const a = edge1.x * h.x + edge1.y * h.y + edge1.z * h.z;
    if (Math.abs(a) < 1e-8) return null;
    const f = 1 / a;
    const s = { x: o.x - t.a.x, y: o.y - t.a.y, z: o.z - t.a.z };
    const u = f * (s.x * h.x + s.y * h.y + s.z * h.z);
    if (u < 0 || u > 1) return null;
    const q = { x: s.y * edge1.z - s.z * edge1.y, y: s.z * edge1.x - s.x * edge1.z, z: s.x * edge1.y - s.y * edge1.x };
    const v = f * (d.x * q.x + d.y * q.y + d.z * q.z);
    if (v < 0 || u + v > 1) return null;
    const r = f * (edge2.x * q.x + edge2.y * q.y + edge2.z * q.z);
    return r > 1e-8 ? r : null;
  }
};
var Geometry = {
  name: "Geometry",
  version: "1.0.0",
  install(_core) {
    try {
      Object.assign(window, {
        Angle,
        Rotation,
        Size,
        Point,
        Matrix,
        Transform,
        AABB,
        Ray,
        Plane3D,
        BVH,
        Rectangle,
        Circle,
        Triangle,
        Polygon,
        Sphere,
        Box,
        Cylinder,
        Torus,
        Cone,
        Pyramid,
        Tube,
        Shapes,
        Solids
      });
    } catch {
    }
  }
};
var Geometry_default = Geometry;

// additionals/Three.ts
var Vec2 = class _Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  x;
  y;
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  clone() {
    return new _Vec2(this.x, this.y);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  scale(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  normalize() {
    const l = this.length() || 1;
    return this.scale(1 / l);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  toArray() {
    return [this.x, this.y];
  }
  static from(a) {
    return new _Vec2(a[0], a[1]);
  }
};
var Vec3 = class _Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  x;
  y;
  z;
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  clone() {
    return new _Vec3(this.x, this.y, this.z);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  addScalar(s) {
    this.x += s;
    this.y += s;
    this.z += s;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  mul(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
  }
  scale(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  normalize() {
    const l = this.length() || 1;
    return this.scale(1 / l);
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    return new _Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }
  distanceTo(v) {
    return this.clone().sub(v).length();
  }
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
  applyMat4(m) {
    const { x, y, z } = this;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  applyQuat(q) {
    const { x, y, z } = this;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
  }
  toArray() {
    return [this.x, this.y, this.z];
  }
  toFloat32() {
    return new Float32Array([this.x, this.y, this.z]);
  }
  equals(v, eps = 1e-6) {
    return Math.abs(this.x - v.x) < eps && Math.abs(this.y - v.y) < eps && Math.abs(this.z - v.z) < eps;
  }
  static from(a) {
    return new _Vec3(a[0], a[1], a[2]);
  }
  static add(a, b) {
    return a.clone().add(b);
  }
  static sub(a, b) {
    return a.clone().sub(b);
  }
  static cross(a, b) {
    return a.cross(b);
  }
  static dot(a, b) {
    return a.dot(b);
  }
};
var Vec4 = class _Vec4 {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  x;
  y;
  z;
  w;
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  clone() {
    return new _Vec4(this.x, this.y, this.z, this.w);
  }
  toArray() {
    return [this.x, this.y, this.z, this.w];
  }
  toFloat32() {
    return new Float32Array([this.x, this.y, this.z, this.w]);
  }
};
var Quaternion2 = class _Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  x;
  y;
  z;
  w;
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  clone() {
    return new _Quaternion(this.x, this.y, this.z, this.w);
  }
  copy(q) {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }
  identity() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 1;
    return this;
  }
  setFromAxisAngle(axis, angle) {
    const half = angle / 2;
    const s = Math.sin(half);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(half);
    return this;
  }
  setFromEuler(x, y, z) {
    const cx = Math.cos(x / 2), sx = Math.sin(x / 2);
    const cy = Math.cos(y / 2), sy = Math.sin(y / 2);
    const cz = Math.cos(z / 2), sz = Math.sin(z / 2);
    this.x = sx * cy * cz + cx * sy * sz;
    this.y = cx * sy * cz - sx * cy * sz;
    this.z = cx * cy * sz + sx * sy * cz;
    this.w = cx * cy * cz - sx * sy * sz;
    return this;
  }
  multiply(q) {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;
    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
  }
  normalize() {
    const l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w) || 1;
    this.x /= l;
    this.y /= l;
    this.z /= l;
    this.w /= l;
    return this;
  }
  slerp(q, t) {
    let dot = this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
    if (dot < 0) {
      dot = -dot;
      q = new _Quaternion(-q.x, -q.y, -q.z, -q.w);
    }
    if (dot > 0.9995) {
      this.x += t * (q.x - this.x);
      this.y += t * (q.y - this.y);
      this.z += t * (q.z - this.z);
      this.w += t * (q.w - this.w);
      return this.normalize();
    }
    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sin0 = Math.sin(theta0);
    const sinT = Math.sin(theta);
    const s1 = Math.cos(theta) - dot * sinT / sin0;
    const s2 = sinT / sin0;
    this.x = s1 * this.x + s2 * q.x;
    this.y = s1 * this.y + s2 * q.y;
    this.z = s1 * this.z + s2 * q.z;
    this.w = s1 * this.w + s2 * q.w;
    return this;
  }
  toArray() {
    return [this.x, this.y, this.z, this.w];
  }
};
var Mat4 = class _Mat4 {
  elements;
  constructor() {
    this.elements = new Float32Array(16);
    this.identity();
  }
  identity() {
    const e = this.elements;
    e.fill(0);
    e[0] = e[5] = e[10] = e[15] = 1;
    return this;
  }
  clone() {
    const m = new _Mat4();
    m.elements.set(this.elements);
    return m;
  }
  copy(m) {
    this.elements.set(m.elements);
    return this;
  }
  multiply(m) {
    const a = this.elements, b = m.elements, r = new Float32Array(16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j];
        r[i * 4 + j] = s;
      }
    this.elements.set(r);
    return this;
  }
  makeTranslation(x, y, z) {
    this.identity();
    this.elements[12] = x;
    this.elements[13] = y;
    this.elements[14] = z;
    return this;
  }
  makeScale(x, y, z) {
    this.identity();
    this.elements[0] = x;
    this.elements[5] = y;
    this.elements[10] = z;
    return this;
  }
  makeRotationFromQuat(q) {
    const { x, y, z, w } = q;
    const e = this.elements;
    e[0] = 1 - 2 * (y * y + z * z);
    e[1] = 2 * (x * y + z * w);
    e[2] = 2 * (x * z - y * w);
    e[3] = 0;
    e[4] = 2 * (x * y - z * w);
    e[5] = 1 - 2 * (x * x + z * z);
    e[6] = 2 * (y * z + x * w);
    e[7] = 0;
    e[8] = 2 * (x * z + y * w);
    e[9] = 2 * (y * z - x * w);
    e[10] = 1 - 2 * (x * x + y * y);
    e[11] = 0;
    e[12] = 0;
    e[13] = 0;
    e[14] = 0;
    e[15] = 1;
    return this;
  }
  compose(pos, rot, scl) {
    const te = this.elements;
    const { x, y, z, w } = rot;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const { x: sx, y: sy, z: sz } = scl;
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = pos.x;
    te[13] = pos.y;
    te[14] = pos.z;
    te[15] = 1;
    return this;
  }
  makePerspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY * Math.PI / 360);
    const e = this.elements;
    e.fill(0);
    e[0] = f / aspect;
    e[5] = f;
    e[10] = -(far + near) / (far - near);
    e[11] = -1;
    e[14] = -(2 * far * near) / (far - near);
    return this;
  }
  makeOrthographic(l, r, t, b, near, far) {
    const e = this.elements;
    e.fill(0);
    e[0] = 2 / (r - l);
    e[12] = -(r + l) / (r - l);
    e[5] = 2 / (t - b);
    e[13] = -(t + b) / (t - b);
    e[10] = -2 / (far - near);
    e[14] = -(far + near) / (far - near);
    e[15] = 1;
    return this;
  }
  lookAt(eye, target, up) {
    const f = Vec3.sub(eye, target).normalize();
    const r = Vec3.cross(up.clone().normalize(), f).normalize();
    const u = Vec3.cross(f, r);
    const e = this.elements;
    e[0] = r.x;
    e[4] = r.y;
    e[8] = r.z;
    e[12] = -(r.x * eye.x + r.y * eye.y + r.z * eye.z);
    e[1] = u.x;
    e[5] = u.y;
    e[9] = u.z;
    e[13] = -(u.x * eye.x + u.y * eye.y + u.z * eye.z);
    e[2] = f.x;
    e[6] = f.y;
    e[10] = f.z;
    e[14] = -(f.x * eye.x + f.y * eye.y + f.z * eye.z);
    e[3] = 0;
    e[7] = 0;
    e[11] = 0;
    e[15] = 1;
    return this;
  }
  invert() {
    const a = this.elements, inv = new Float32Array(16);
    inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
    inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
    inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
    inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
    inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
    inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
    inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
    inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
    inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
    inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
    inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
    inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
    inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
    inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
    inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
    inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
    let det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
    if (Math.abs(det) < 1e-10) return this;
    det = 1 / det;
    for (let i = 0; i < 16; i++) this.elements[i] = inv[i] * det;
    return this;
  }
  transpose() {
    const e = this.elements;
    let t;
    t = e[1];
    e[1] = e[4];
    e[4] = t;
    t = e[2];
    e[2] = e[8];
    e[8] = t;
    t = e[3];
    e[3] = e[12];
    e[12] = t;
    t = e[6];
    e[6] = e[9];
    e[9] = t;
    t = e[7];
    e[7] = e[13];
    e[13] = t;
    t = e[11];
    e[11] = e[14];
    e[14] = t;
    return this;
  }
};
var Box3 = class {
  min = new Vec3(Infinity, Infinity, Infinity);
  max = new Vec3(-Infinity, -Infinity, -Infinity);
  expandByPoint(p) {
    this.min.x = Math.min(this.min.x, p.x);
    this.min.y = Math.min(this.min.y, p.y);
    this.min.z = Math.min(this.min.z, p.z);
    this.max.x = Math.max(this.max.x, p.x);
    this.max.y = Math.max(this.max.y, p.y);
    this.max.z = Math.max(this.max.z, p.z);
    return this;
  }
  getCenter(out = new Vec3()) {
    return out.set(
      (this.min.x + this.max.x) / 2,
      (this.min.y + this.max.y) / 2,
      (this.min.z + this.max.z) / 2
    );
  }
  getSize(out = new Vec3()) {
    return out.set(
      this.max.x - this.min.x,
      this.max.y - this.min.y,
      this.max.z - this.min.z
    );
  }
};
var Color = class _Color {
  r;
  g;
  b;
  a;
  constructor(r = 1, g = 1, b = 1, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  setHex(hex) {
    const h = hex.replace("#", "");
    this.r = parseInt(h.slice(0, 2), 16) / 255;
    this.g = parseInt(h.slice(2, 4), 16) / 255;
    this.b = parseInt(h.slice(4, 6), 16) / 255;
    return this;
  }
  toArray() {
    return [this.r, this.g, this.b, this.a];
  }
  toFloat32() {
    return new Float32Array([this.r, this.g, this.b, this.a]);
  }
  clone() {
    return new _Color(this.r, this.g, this.b, this.a);
  }
  static fromHex(hex) {
    return new _Color().setHex(hex);
  }
  static white() {
    return new _Color(1, 1, 1, 1);
  }
  static black() {
    return new _Color(0, 0, 0, 1);
  }
};
var BufferGeometry = class _BufferGeometry {
  positions = new Float32Array(0);
  normals = new Float32Array(0);
  uvs = new Float32Array(0);
  indices = new Uint32Array(0);
  vertexCount = 0;
  indexCount = 0;
  boundingBox = new Box3();
  setPositions(data) {
    this.positions = data instanceof Float32Array ? data : new Float32Array(data);
    this.vertexCount = this.positions.length / 3;
    this.#computeBB();
    return this;
  }
  setNormals(data) {
    this.normals = data instanceof Float32Array ? data : new Float32Array(data);
    return this;
  }
  setUVs(data) {
    this.uvs = data instanceof Float32Array ? data : new Float32Array(data);
    return this;
  }
  setIndices(data) {
    this.indices = data instanceof Uint32Array ? data : new Uint32Array(data);
    this.indexCount = this.indices.length;
    return this;
  }
  #computeBB() {
    this.boundingBox = new Box3();
    for (let i = 0; i < this.positions.length; i += 3)
      this.boundingBox.expandByPoint(new Vec3(this.positions[i], this.positions[i + 1], this.positions[i + 2]));
  }
  computeNormals() {
    const pos = this.positions, idx = this.indices;
    const nrm = new Float32Array(pos.length);
    const process = (i0, i1, i2) => {
      const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
      const bx = pos[i1 * 3], by = pos[i1 * 3 + 1], bz = pos[i1 * 3 + 2];
      const cx = pos[i2 * 3], cy = pos[i2 * 3 + 1], cz = pos[i2 * 3 + 2];
      const ex = bx - ax, ey = by - ay, ez = bz - az;
      const fx = cx - ax, fy = cy - ay, fz = cz - az;
      const nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
      for (const ii of [i0, i1, i2]) {
        nrm[ii * 3] += nx;
        nrm[ii * 3 + 1] += ny;
        nrm[ii * 3 + 2] += nz;
      }
    };
    if (idx.length > 0)
      for (let i = 0; i < idx.length; i += 3) process(idx[i], idx[i + 1], idx[i + 2]);
    else
      for (let i = 0; i < pos.length / 3; i += 3) process(i, i + 1, i + 2);
    for (let i = 0; i < nrm.length; i += 3) {
      const l = Math.sqrt(nrm[i] * nrm[i] + nrm[i + 1] * nrm[i + 1] + nrm[i + 2] * nrm[i + 2]) || 1;
      nrm[i] /= l;
      nrm[i + 1] /= l;
      nrm[i + 2] /= l;
    }
    this.normals = nrm;
    return this;
  }
  clone() {
    const g = new _BufferGeometry();
    g.positions = new Float32Array(this.positions);
    g.normals = new Float32Array(this.normals);
    g.uvs = new Float32Array(this.uvs);
    g.indices = new Uint32Array(this.indices);
    g.vertexCount = this.vertexCount;
    g.indexCount = this.indexCount;
    return g;
  }
};
var BoxGeometry = class extends BufferGeometry {
  constructor(w = 1, h = 1, d = 1, wSeg = 1, hSeg = 1, dSeg = 1) {
    super();
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const pos = [], nrm = [], uv = [], idx = [];
    let vi = 0;
    const addFace = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz) => {
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      for (let i = 0; i < 4; i++) nrm.push(nx, ny, nz);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    };
    addFace(-hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd, 0, 0, 1);
    addFace(hw, -hh, -hd, -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd, 0, 0, -1);
    addFace(-hw, hh, hd, hw, hh, hd, hw, hh, -hd, -hw, hh, -hd, 0, 1, 0);
    addFace(-hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd, 0, -1, 0);
    addFace(hw, -hh, hd, hw, -hh, -hd, hw, hh, -hd, hw, hh, hd, 1, 0, 0);
    addFace(-hw, -hh, -hd, -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd, -1, 0, 0);
    this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
  }
};
var SphereGeometry = class extends BufferGeometry {
  constructor(radius = 1, wSeg = 32, hSeg = 16) {
    super();
    const pos = [], nrm = [], uv = [], idx = [];
    for (let j = 0; j <= hSeg; j++) {
      const theta = j * Math.PI / hSeg;
      const sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (let i = 0; i <= wSeg; i++) {
        const phi = i * 2 * Math.PI / wSeg;
        const x = -sinT * Math.cos(phi);
        const y = cosT;
        const z = sinT * Math.sin(phi);
        pos.push(x * radius, y * radius, z * radius);
        nrm.push(x, y, z);
        uv.push(i / wSeg, j / hSeg);
      }
    }
    for (let j = 0; j < hSeg; j++)
      for (let i = 0; i < wSeg; i++) {
        const a = j * (wSeg + 1) + i, b = a + wSeg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
  }
};
var CylinderGeometry = class extends BufferGeometry {
  constructor(rTop = 0.5, rBot = 0.5, height = 1, radSeg = 32, hSeg = 1, openEnded = false) {
    super();
    const pos = [], nrm = [], uv = [], idx = [];
    let vi = 0;
    const hy = height / 2;
    for (let j = 0; j <= hSeg; j++) {
      const v = j / hSeg;
      const r = rTop + (rBot - rTop) * v;
      const y = hy - height * v;
      for (let i = 0; i <= radSeg; i++) {
        const theta = i * 2 * Math.PI / radSeg;
        const x = Math.sin(theta), z = Math.cos(theta);
        const slope = (rBot - rTop) / height;
        const nl = Math.sqrt(1 + slope * slope);
        pos.push(x * r, y, z * r);
        nrm.push(x / nl, slope / nl, z / nl);
        uv.push(i / radSeg, 1 - v);
      }
    }
    for (let j = 0; j < hSeg; j++)
      for (let i = 0; i < radSeg; i++) {
        const a = j * (radSeg + 1) + i, b = a + radSeg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
        vi += 2;
      }
    const colCount = radSeg + 1;
    if (!openEnded) {
      const topY = hy, botY = -hy;
      const topCenter = pos.length / 3;
      pos.push(0, topY, 0);
      nrm.push(0, 1, 0);
      uv.push(0.5, 0.5);
      for (let i = 0; i <= radSeg; i++) {
        const theta = i * 2 * Math.PI / radSeg;
        pos.push(Math.sin(theta) * rTop, topY, Math.cos(theta) * rTop);
        nrm.push(0, 1, 0);
        uv.push(0.5 + 0.5 * Math.sin(theta), 0.5 + 0.5 * Math.cos(theta));
      }
      for (let i = 0; i < radSeg; i++) idx.push(topCenter, topCenter + 1 + i + 1, topCenter + 1 + i);
      const botCenter = pos.length / 3;
      pos.push(0, botY, 0);
      nrm.push(0, -1, 0);
      uv.push(0.5, 0.5);
      for (let i = 0; i <= radSeg; i++) {
        const theta = i * 2 * Math.PI / radSeg;
        pos.push(Math.sin(theta) * rBot, botY, Math.cos(theta) * rBot);
        nrm.push(0, -1, 0);
        uv.push(0.5 + 0.5 * Math.sin(theta), 0.5 + 0.5 * Math.cos(theta));
      }
      for (let i = 0; i < radSeg; i++) idx.push(botCenter, botCenter + 1 + i, botCenter + 1 + i + 1);
    }
    this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
  }
};
var PlaneGeometry = class extends BufferGeometry {
  constructor(w = 1, h = 1, wSeg = 1, hSeg = 1) {
    super();
    const pos = [], nrm = [], uv = [], idx = [];
    const hw = w / 2, hh = h / 2;
    for (let j = 0; j <= hSeg; j++)
      for (let i = 0; i <= wSeg; i++) {
        pos.push(-hw + i * w / wSeg, hh - j * h / hSeg, 0);
        nrm.push(0, 0, 1);
        uv.push(i / wSeg, 1 - j / hSeg);
      }
    for (let j = 0; j < hSeg; j++)
      for (let i = 0; i < wSeg; i++) {
        const a = j * (wSeg + 1) + i, b = a + wSeg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
  }
};
var ConeGeometry = class extends CylinderGeometry {
  constructor(radius = 1, height = 2, radSeg = 32, hSeg = 1) {
    super(0, radius, height, radSeg, hSeg);
  }
};
var TorusGeometry = class extends BufferGeometry {
  constructor(radius = 1, tube = 0.4, radSeg = 32, tubeSeg = 16) {
    super();
    const pos = [], nrm = [], uv = [], idx = [];
    for (let j = 0; j <= radSeg; j++) {
      for (let i = 0; i <= tubeSeg; i++) {
        const u = i / tubeSeg * 2 * Math.PI;
        const v = j / radSeg * 2 * Math.PI;
        const x = (radius + tube * Math.cos(v)) * Math.cos(u);
        const y = (radius + tube * Math.cos(v)) * Math.sin(u);
        const z = tube * Math.sin(v);
        pos.push(x, y, z);
        const cx = Math.cos(u) * Math.cos(v), cy = Math.sin(u) * Math.cos(v), cz = Math.sin(v);
        nrm.push(cx, cy, cz);
        uv.push(i / tubeSeg, j / radSeg);
      }
    }
    for (let j = 0; j < radSeg; j++)
      for (let i = 0; i < tubeSeg; i++) {
        const a = j * (tubeSeg + 1) + i, b = a + tubeSeg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
  }
};
function _toColor(c) {
  if (!c) return Color.white();
  if (c instanceof Color) return c.clone();
  return Color.fromHex(c);
}
var Material = class {
  color;
  emissive;
  roughness;
  metalness;
  opacity;
  wireframe;
  side;
  type = "basic";
  constructor(opts = {}) {
    this.color = _toColor(opts.color);
    this.emissive = _toColor(opts.emissive ?? "#000000");
    this.roughness = opts.roughness ?? 0.5;
    this.metalness = opts.metalness ?? 0;
    this.opacity = opts.opacity ?? 1;
    this.wireframe = opts.wireframe ?? false;
    this.side = opts.side ?? "front";
  }
};
var MeshBasicMaterial = class extends Material {
  constructor(o = {}) {
    super(o);
    this.type = "basic";
  }
};
var MeshLambertMaterial = class extends Material {
  constructor(o = {}) {
    super(o);
    this.type = "lambert";
  }
};
var MeshPhongMaterial = class extends Material {
  shininess = 30;
  constructor(o = {}) {
    super(o);
    this.type = "phong";
    this.shininess = o.shininess ?? 30;
  }
};
var MeshPBRMaterial = class extends Material {
  constructor(o = {}) {
    super(o);
    this.type = "pbr";
  }
};
var WireframeMaterial = class extends Material {
  constructor(o = {}) {
    super({ ...o, wireframe: true });
    this.type = "wireframe";
  }
};
var LineMaterial = class extends Material {
  lineWidth = 1;
  constructor(o = {}) {
    super(o);
    this.type = "line";
    this.lineWidth = o.lineWidth ?? 1;
  }
};
var Light = class {
  color;
  intensity;
  type = "ambient";
  constructor(opts = {}) {
    this.color = _toColor(opts.color ?? "#ffffff");
    this.intensity = opts.intensity ?? 1;
  }
};
var AmbientLight = class extends Light {
  constructor(o = {}) {
    super(o);
    this.type = "ambient";
  }
};
var DirectionalLight = class extends Light {
  direction = new Vec3(0, -1, 0);
  castShadow = false;
  constructor(o = {}) {
    super(o);
    this.type = "directional";
    if (o.direction) this.direction.copy(o.direction);
  }
};
var PointLight = class extends Light {
  position = new Vec3();
  distance = 0;
  decay = 2;
  constructor(o = {}) {
    super(o);
    this.type = "point";
    if (o.position) this.position.copy(o.position);
    if (o.distance !== void 0) this.distance = o.distance;
  }
};
var SpotLight = class extends Light {
  position = new Vec3();
  direction = new Vec3(0, -1, 0);
  angle = Math.PI / 6;
  penumbra = 0.1;
  constructor(o = {}) {
    super(o);
    this.type = "spot";
    if (o.position) this.position.copy(o.position);
    if (o.direction) this.direction.copy(o.direction);
    if (o.angle !== void 0) this.angle = o.angle;
  }
};
var _objId = 0;
var Object3D = class _Object3D {
  id = ++_objId;
  name = "";
  position = new Vec3();
  rotation = new Vec3();
  // Euler XYZ radians
  quaternion = new Quaternion2();
  scale = new Vec3(1, 1, 1);
  matrix = new Mat4();
  matrixWorld = new Mat4();
  parent = null;
  children = [];
  visible = true;
  castShadow = false;
  receiveShadow = false;
  userData = {};
  add(...objects) {
    for (const o of objects) {
      if (o.parent) o.parent.remove(o);
      o.parent = this;
      this.children.push(o);
    }
    return this;
  }
  remove(...objects) {
    for (const o of objects) {
      const i = this.children.indexOf(o);
      if (i >= 0) {
        this.children.splice(i, 1);
        o.parent = null;
      }
    }
    return this;
  }
  updateMatrix() {
    this.quaternion.setFromEuler(this.rotation.x, this.rotation.y, this.rotation.z);
    this.matrix.compose(this.position, this.quaternion, this.scale);
  }
  updateMatrixWorld(force = false) {
    this.updateMatrix();
    if (!this.parent) {
      this.matrixWorld.copy(this.matrix);
    } else {
      this.matrixWorld.copy(this.parent.matrixWorld).multiply(this.matrix);
    }
    for (const child of this.children) child.updateMatrixWorld(force);
  }
  traverse(cb) {
    cb(this);
    for (const c of this.children) c.traverse(cb);
  }
  getWorldPosition(out = new Vec3()) {
    this.updateMatrixWorld();
    out.x = this.matrixWorld.elements[12];
    out.y = this.matrixWorld.elements[13];
    out.z = this.matrixWorld.elements[14];
    return out;
  }
  lookAt(target) {
    const pos = this.getWorldPosition();
    const m = new Mat4().lookAt(pos, target, new Vec3(0, 1, 0));
    this.quaternion.setFromEuler(
      Math.atan2(m.elements[6], m.elements[10]),
      Math.atan2(-m.elements[2], Math.sqrt(m.elements[6] ** 2 + m.elements[10] ** 2)),
      Math.atan2(m.elements[1], m.elements[0])
    );
  }
  clone(recursive = true) {
    const o = new _Object3D();
    o.name = this.name;
    o.position = this.position.clone();
    o.rotation = this.rotation.clone();
    o.scale = this.scale.clone();
    o.visible = this.visible;
    if (recursive) for (const c of this.children) o.add(c.clone(true));
    return o;
  }
};
var Group = class extends Object3D {
};
var Mesh = class _Mesh extends Object3D {
  geometry;
  material;
  // GPU buffer handles — set by renderer
  _gpuBuffers = {};
  // WebGL buffer handles — set by renderer
  _glBuffers = {};
  constructor(geometry, material = new MeshBasicMaterial()) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
  clone(recursive = true) {
    const m = new _Mesh(this.geometry.clone(), this.material);
    m.position.copy(this.position);
    m.rotation.copy(this.rotation);
    m.scale.copy(this.scale);
    return m;
  }
};
var Camera = class extends Object3D {
  projectionMatrix = new Mat4();
  projectionMatrixInv = new Mat4();
  viewMatrix = new Mat4();
  near = 0.1;
  far = 1e3;
  updateProjectionMatrix() {
  }
  updateViewMatrix() {
    this.updateMatrixWorld();
    this.viewMatrix.copy(this.matrixWorld).invert();
  }
};
var PerspectiveCamera = class extends Camera {
  fov;
  aspect;
  constructor(fov = 60, aspect = 1, near = 0.1, far = 1e3) {
    super();
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far);
    this.projectionMatrixInv.copy(this.projectionMatrix).invert();
  }
  setAspect(aspect) {
    this.aspect = aspect;
    this.updateProjectionMatrix();
  }
};
var OrthographicCamera = class extends Camera {
  left;
  right;
  top;
  bottom;
  constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 1e3) {
    super();
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.near = near;
    this.far = far;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    this.projectionMatrix.makeOrthographic(this.left, this.right, this.top, this.bottom, this.near, this.far);
    this.projectionMatrixInv.copy(this.projectionMatrix).invert();
  }
};
var Scene = class extends Object3D {
  background = null;
  fog = null;
  constructor() {
    super();
    this.name = "Scene";
  }
  get lights() {
    const result = [];
    this.traverse((o) => {
      if (o instanceof Light) result.push(o);
    });
    return result;
  }
  get meshes() {
    const result = [];
    this.traverse((o) => {
      if (o instanceof Mesh) result.push(o);
    });
    return result;
  }
};
var _WGSL_COMMON = (
  /* wgsl */
  `
struct Uniforms {
    modelMatrix      : mat4x4<f32>,
    viewMatrix       : mat4x4<f32>,
    projMatrix       : mat4x4<f32>,
    normalMatrix     : mat4x4<f32>,
    cameraPos        : vec3<f32>,
    time             : f32,
    color            : vec4<f32>,
    emissive         : vec4<f32>,
    roughness        : f32,
    metalness        : f32,
    opacity          : f32,
    _pad             : f32,
};

struct LightData {
    position  : vec4<f32>,
    color     : vec4<f32>,
    direction : vec4<f32>,
    params    : vec4<f32>,  // x=intensity, y=type(0=ambient,1=dir,2=point,3=spot), z=range, w=spotAngle
};

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> lights : array<LightData>;
`
);
var _WGSL_VERTEX = (
  /* wgsl */
  `
${_WGSL_COMMON}

struct VertexIn {
    @location(0) position : vec3<f32>,
    @location(1) normal   : vec3<f32>,
    @location(2) uv       : vec2<f32>,
};

struct VertexOut {
    @builtin(position) clip_pos : vec4<f32>,
    @location(0) world_pos      : vec3<f32>,
    @location(1) world_normal   : vec3<f32>,
    @location(2) uv             : vec2<f32>,
};

@vertex
fn vs_main(in: VertexIn) -> VertexOut {
    var out : VertexOut;
    let world_pos   = u.modelMatrix * vec4<f32>(in.position, 1.0);
    out.clip_pos    = u.projMatrix * u.viewMatrix * world_pos;
    out.world_pos   = world_pos.xyz;
    out.world_normal= normalize((u.normalMatrix * vec4<f32>(in.normal, 0.0)).xyz);
    out.uv          = in.uv;
    return out;
}
`
);
var _WGSL_FRAGMENT_PBR = (
  /* wgsl */
  `
${_WGSL_COMMON}

struct FragIn {
    @location(0) world_pos    : vec3<f32>,
    @location(1) world_normal : vec3<f32>,
    @location(2) uv           : vec2<f32>,
};

const PI = 3.14159265359;

fn distributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
    let a  = roughness * roughness;
    let a2 = a * a;
    let NdH  = max(dot(N, H), 0.0);
    let denom = NdH*NdH*(a2-1.0)+1.0;
    return a2 / (PI * denom * denom);
}

fn geometrySchlick(NdV: f32, roughness: f32) -> f32 {
    let k = (roughness+1.0)*(roughness+1.0)/8.0;
    return NdV / (NdV*(1.0-k)+k);
}

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
    return F0 + (1.0-F0)*pow(clamp(1.0-cosTheta,0.0,1.0),5.0);
}

@fragment
fn fs_main(in: FragIn) -> @location(0) vec4<f32> {
    let N     = normalize(in.world_normal);
    let V     = normalize(u.cameraPos - in.world_pos);
    let albedo= u.color.rgb;
    let rough = clamp(u.roughness, 0.04, 1.0);
    let metal = u.metalness;

    var F0 = vec3<f32>(0.04);
    F0 = mix(F0, albedo, metal);

    var Lo = vec3<f32>(0.0);
    let numLights = i32(arrayLength(&lights));
    for (var i = 0; i < numLights; i++) {
        let light    = lights[i];
        let ltype    = i32(light.params.y);
        let lIntensity = light.params.x;
        var L        = vec3<f32>(0.0);
        var radiance = light.color.rgb * lIntensity;

        if (ltype == 0) {
            // Ambient
            Lo += albedo * radiance * 0.03;
            continue;
        } else if (ltype == 1) {
            L = normalize(-light.direction.xyz);
        } else {
            L = normalize(light.position.xyz - in.world_pos);
            let dist = length(light.position.xyz - in.world_pos);
            let atten = 1.0 / max(dist*dist, 0.0001);
            radiance *= atten;
        }

        let H     = normalize(V + L);
        let NdL   = max(dot(N, L), 0.0);
        let NdV   = max(dot(N, V), 0.0);

        let D  = distributionGGX(N, H, rough);
        let G  = geometrySchlick(NdV, rough) * geometrySchlick(NdL, rough);
        let F  = fresnelSchlick(max(dot(H,V),0.0), F0);

        let kD    = (vec3<f32>(1.0) - F) * (1.0 - metal);
        let spec  = D * G * F / max(4.0 * NdV * NdL, 0.001);
        Lo += (kD * albedo / PI + spec) * radiance * NdL;
    }

    Lo += u.emissive.rgb;
    let color = Lo / (Lo + vec3<f32>(1.0)); // Reinhard tonemapping
    return vec4<f32>(pow(color, vec3<f32>(1.0/2.2)), u.opacity);
}
`
);
var _WGSL_FRAGMENT_BASIC = (
  /* wgsl */
  `
${_WGSL_COMMON}

struct FragIn {
    @location(0) world_pos    : vec3<f32>,
    @location(1) world_normal : vec3<f32>,
    @location(2) uv           : vec2<f32>,
};

@fragment
fn fs_main(in: FragIn) -> @location(0) vec4<f32> {
    return vec4<f32>(u.color.rgb, u.opacity);
}
`
);
var _WGSL_FRAGMENT_LAMBERT = (
  /* wgsl */
  `
${_WGSL_COMMON}

struct FragIn {
    @location(0) world_pos    : vec3<f32>,
    @location(1) world_normal : vec3<f32>,
    @location(2) uv           : vec2<f32>,
};

@fragment
fn fs_main(in: FragIn) -> @location(0) vec4<f32> {
    let N = normalize(in.world_normal);
    var diffuse = vec3<f32>(0.0);
    let numLights = i32(arrayLength(&lights));
    for (var i = 0; i < numLights; i++) {
        let light = lights[i]; let ltype = i32(light.params.y);
        if (ltype == 0) { diffuse += light.color.rgb * light.params.x * 0.1; continue; }
        let L   = select(normalize(-light.direction.xyz), normalize(light.position.xyz - in.world_pos), ltype > 1);
        let NdL = max(dot(N, L), 0.0);
        diffuse += light.color.rgb * light.params.x * NdL;
    }
    return vec4<f32>(u.color.rgb * diffuse + u.emissive.rgb, u.opacity);
}
`
);
function _wgslFragForType(type) {
  switch (type) {
    case "pbr":
      return _WGSL_FRAGMENT_PBR;
    case "lambert":
      return _WGSL_FRAGMENT_LAMBERT;
    default:
      return _WGSL_FRAGMENT_BASIC;
  }
}
var _UNIFORM_SIZE = 256;
var _LIGHT_STRIDE = 64;
var _MAX_LIGHTS = 16;
var WebGPURenderer = class {
  canvas;
  #device = null;
  #context = null;
  #depthTexture = null;
  #lightBuffer = null;
  #bindGroupLayout = null;
  #pipelineCache = /* @__PURE__ */ new Map();
  #ready = false;
  constructor(canvas) {
    this.canvas = canvas;
  }
  async init() {
    if (!navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    this.#device = await adapter.requestDevice();
    this.#context = this.canvas.getContext("webgpu");
    if (!this.#context) return false;
    const fmt = navigator.gpu.getPreferredCanvasFormat();
    this.#context.configure({ device: this.#device, format: fmt, alphaMode: "premultiplied" });
    this.#bindGroupLayout = this.#device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: 1 | 2,
          buffer: { type: "uniform" }
        },
        {
          binding: 1,
          visibility: 2,
          buffer: { type: "read-only-storage" }
        }
      ]
    });
    this.#lightBuffer = this.#device.createBuffer({
      size: _LIGHT_STRIDE * _MAX_LIGHTS,
      usage: 128 | 8
    });
    this.#createDepthTexture();
    this.#ready = true;
    return true;
  }
  get ready() {
    return this.#ready;
  }
  #createDepthTexture() {
    this.#depthTexture?.destroy();
    this.#depthTexture = this.#device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: "depth24plus",
      usage: 16
    });
  }
  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.#ready) this.#createDepthTexture();
  }
  #getPipeline(mat) {
    const key = mat.type + (mat.wireframe ? "_wire" : "");
    if (this.#pipelineCache.has(key)) return this.#pipelineCache.get(key);
    const device = this.#device;
    const fmt = navigator.gpu.getPreferredCanvasFormat();
    const shaderModule = device.createShaderModule({
      code: _WGSL_VERTEX + _wgslFragForType(mat.type)
    });
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.#bindGroupLayout] }),
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
          { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] },
          { arrayStride: 8, attributes: [{ shaderLocation: 2, offset: 0, format: "float32x2" }] }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format: fmt, blend: {
          color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
        } }]
      },
      primitive: {
        topology: mat.wireframe ? "line-list" : "triangle-list",
        cullMode: mat.side === "both" ? "none" : mat.side === "back" ? "front" : "back"
      },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" }
    });
    this.#pipelineCache.set(key, pipeline);
    return pipeline;
  }
  #uploadMeshBuffers(mesh) {
    const device = this.#device;
    const geo = mesh.geometry;
    const b = mesh._gpuBuffers;
    const makeBuffer = (data, usage) => {
      const buf = device.createBuffer({
        size: data.byteLength,
        usage: usage | 8
        /* GPUBufferUsage.COPY_DST */
      });
      device.queue.writeBuffer(buf, 0, data);
      return buf;
    };
    if (geo.positions.length > 0 && !b.vertex)
      b.vertex = makeBuffer(
        geo.positions,
        32
        /* GPUBufferUsage.VERTEX */
      );
    if (geo.normals.length > 0 && !b.normal)
      b.normal = makeBuffer(
        geo.normals,
        32
        /* GPUBufferUsage.VERTEX */
      );
    if (geo.uvs.length > 0)
      b.uv = makeBuffer(
        geo.uvs,
        32
        /* GPUBufferUsage.VERTEX */
      );
    else
      b.uv = makeBuffer(
        new Float32Array(geo.vertexCount * 2),
        32
        /* GPUBufferUsage.VERTEX */
      );
    if (geo.indices.length > 0 && !b.index)
      b.index = makeBuffer(
        geo.indices,
        16
        /* GPUBufferUsage.INDEX */
      );
    if (!b.uniform)
      b.uniform = device.createBuffer({
        size: _UNIFORM_SIZE,
        usage: 64 | 8
        /* GPUBufferUsage.COPY_DST */
      });
  }
  #uploadUniforms(mesh, camera, time) {
    const device = this.#device;
    const mat = mesh.material;
    mesh.updateMatrixWorld();
    const normalMat = mesh.matrixWorld.clone().invert().transpose();
    const data = new Float32Array(_UNIFORM_SIZE / 4);
    let off = 0;
    data.set(mesh.matrixWorld.elements, off);
    off += 16;
    data.set(camera.viewMatrix.elements, off);
    off += 16;
    data.set(camera.projectionMatrix.elements, off);
    off += 16;
    data.set(normalMat.elements, off);
    off += 16;
    const cp = camera.getWorldPosition();
    data.set([cp.x, cp.y, cp.z, time], off);
    off += 4;
    data.set(mat.color.toArray(), off);
    off += 4;
    data.set(mat.emissive.toArray(), off);
    off += 4;
    data.set([mat.roughness, mat.metalness, mat.opacity, 0], off);
    device.queue.writeBuffer(mesh._gpuBuffers.uniform, 0, data);
  }
  #uploadLights(scene) {
    const device = this.#device;
    const data = new Float32Array(_LIGHT_STRIDE / 4 * _MAX_LIGHTS);
    let off = 0;
    const lights = scene.lights.slice(0, _MAX_LIGHTS);
    for (const light of lights) {
      const typeId = light.type === "ambient" ? 0 : light.type === "directional" ? 1 : light.type === "point" ? 2 : 3;
      if (light instanceof PointLight) data.set([light.position.x, light.position.y, light.position.z, 1], off);
      else data.set([0, 0, 0, 0], off);
      off += 4;
      data.set(light.color.toArray(), off);
      off += 4;
      if (light instanceof DirectionalLight) data.set([light.direction.x, light.direction.y, light.direction.z, 0], off);
      else data.set([0, -1, 0, 0], off);
      off += 4;
      data.set([light.intensity, typeId, 0, 0], off);
      off += 4;
    }
    device.queue.writeBuffer(this.#lightBuffer, 0, data);
  }
  render(scene, camera, time = 0) {
    if (!this.#ready || !this.#device || !this.#context) return;
    camera.updateViewMatrix();
    const device = this.#device;
    const colorView = this.#context.getCurrentTexture().createView();
    const depthView = this.#depthTexture.createView();
    this.#uploadLights(scene);
    const encoder = device.createCommandEncoder();
    const bgColor = scene.background?.toArray() ?? [0, 0, 0, 1];
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{ view: colorView, clearValue: { r: bgColor[0], g: bgColor[1], b: bgColor[2], a: bgColor[3] }, loadOp: "clear", storeOp: "store" }],
      depthStencilAttachment: { view: depthView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" }
    });
    for (const mesh of scene.meshes) {
      if (!mesh.visible) continue;
      this.#uploadMeshBuffers(mesh);
      this.#uploadUniforms(mesh, camera, time);
      const pipeline = this.#getPipeline(mesh.material);
      const bindGroup = device.createBindGroup({
        layout: this.#bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: mesh._gpuBuffers.uniform } },
          { binding: 1, resource: { buffer: this.#lightBuffer } }
        ]
      });
      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.setVertexBuffer(0, mesh._gpuBuffers.vertex);
      renderPass.setVertexBuffer(1, mesh._gpuBuffers.normal);
      renderPass.setVertexBuffer(2, mesh._gpuBuffers.uv);
      if (mesh._gpuBuffers.index && mesh.geometry.indexCount > 0) {
        renderPass.setIndexBuffer(mesh._gpuBuffers.index, "uint32");
        renderPass.drawIndexed(mesh.geometry.indexCount);
      } else {
        renderPass.draw(mesh.geometry.vertexCount);
      }
    }
    renderPass.end();
    device.queue.submit([encoder.finish()]);
  }
  dispose() {
    this.#depthTexture?.destroy();
    this.#lightBuffer?.destroy();
    this.#device?.destroy();
    this.#ready = false;
  }
};
var _GL_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNorm;
layout(location=2) in vec2 aUV;
uniform mat4 uModel, uView, uProj, uNormal;
out vec3 vWorldPos, vNormal;
out vec2 vUV;
void main() {
    vec4 wp = uModel * vec4(aPos,1.0);
    vWorldPos = wp.xyz;
    vNormal   = normalize((uNormal * vec4(aNorm,0.0)).xyz);
    vUV       = aUV;
    gl_Position = uProj * uView * wp;
}`;
var _GL_FS = `#version 300 es
precision highp float;
in vec3 vWorldPos, vNormal;
in vec2 vUV;
uniform vec4 uColor, uEmissive;
uniform vec3 uLightDir, uLightColor, uAmbient, uCamPos;
uniform float uRoughness, uMetalness, uOpacity;
out vec4 fragColor;
void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(-uLightDir);
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 H = normalize(L + V);
    float diff = max(dot(N,L),0.0);
    float spec = pow(max(dot(N,H),0.0), mix(4.0,128.0,1.0-uRoughness));
    vec3 col = uColor.rgb * (uAmbient + uLightColor * diff) + uLightColor * spec * (1.0-uRoughness) + uEmissive.rgb;
    fragColor = vec4(col, uOpacity);
}`;
var WebGL2Renderer = class {
  canvas;
  #gl = null;
  #program = null;
  #ready = false;
  constructor(canvas) {
    this.canvas = canvas;
  }
  init() {
    const gl = this.canvas.getContext("webgl2");
    if (!gl) return false;
    this.#gl = gl;
    const vs = this.#compileShader(gl.VERTEX_SHADER, _GL_VS);
    const fs = this.#compileShader(gl.FRAGMENT_SHADER, _GL_FS);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    this.#program = prog;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    this.#ready = true;
    return true;
  }
  get ready() {
    return this.#ready;
  }
  #compileShader(type, src) {
    const gl = this.#gl;
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  }
  render(scene, camera) {
    if (!this.#ready || !this.#gl || !this.#program) return;
    const gl = this.#gl, prog = this.#program;
    const bg = scene.background?.toArray() ?? [0, 0, 0, 1];
    gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(prog);
    camera.updateViewMatrix();
    const ul = (n) => gl.getUniformLocation(prog, n);
    const dir = scene.lights.find((l) => l instanceof DirectionalLight);
    const amb = scene.lights.find((l) => l instanceof AmbientLight);
    const lightDir = dir ? dir.direction.clone().normalize() : new Vec3(0, -1, 0);
    const lightColor = dir ? dir.color.toArray().slice(0, 3) : [1, 1, 1];
    const ambient = amb ? amb.color.toArray().slice(0, 3).map((v) => v * amb.intensity) : [0.1, 0.1, 0.1];
    const cp = camera.getWorldPosition();
    gl.uniform3fv(ul("uLightDir"), new Float32Array(lightDir.toArray()));
    gl.uniform3fv(ul("uLightColor"), new Float32Array(lightColor));
    gl.uniform3fv(ul("uAmbient"), new Float32Array(ambient));
    gl.uniform3fv(ul("uCamPos"), new Float32Array([cp.x, cp.y, cp.z]));
    gl.uniformMatrix4fv(ul("uView"), false, camera.viewMatrix.elements);
    gl.uniformMatrix4fv(ul("uProj"), false, camera.projectionMatrix.elements);
    for (const mesh of scene.meshes) {
      if (!mesh.visible) continue;
      mesh.updateMatrixWorld();
      const normalMat = mesh.matrixWorld.clone().invert().transpose();
      gl.uniformMatrix4fv(ul("uModel"), false, mesh.matrixWorld.elements);
      gl.uniformMatrix4fv(ul("uNormal"), false, normalMat.elements);
      const mat = mesh.material;
      gl.uniform4fv(ul("uColor"), mat.color.toFloat32());
      gl.uniform4fv(ul("uEmissive"), mat.emissive.toFloat32());
      gl.uniform1f(ul("uRoughness"), mat.roughness);
      gl.uniform1f(ul("uMetalness"), mat.metalness);
      gl.uniform1f(ul("uOpacity"), mat.opacity);
      const b = mesh._glBuffers;
      const geo = mesh.geometry;
      if (!b.vao) {
        b.vao = gl.createVertexArray();
        b.vertex = gl.createBuffer();
        b.normal = gl.createBuffer();
        b.uv = gl.createBuffer();
        if (geo.indices.length > 0) b.index = gl.createBuffer();
        gl.bindVertexArray(b.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.vertex);
        gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.normal);
        gl.bufferData(gl.ARRAY_BUFFER, geo.normals.length > 0 ? geo.normals : new Float32Array(geo.positions.length), gl.STATIC_DRAW);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(1);
        gl.bindBuffer(gl.ARRAY_BUFFER, b.uv);
        gl.bufferData(gl.ARRAY_BUFFER, geo.uvs.length > 0 ? geo.uvs : new Float32Array(geo.vertexCount * 2), gl.STATIC_DRAW);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(2);
        if (b.index) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.index);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
        }
        gl.bindVertexArray(null);
      }
      gl.bindVertexArray(b.vao);
      if (geo.indexCount > 0 && b.index) gl.drawElements(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_INT, 0);
      else gl.drawArrays(gl.TRIANGLES, 0, geo.vertexCount);
      gl.bindVertexArray(null);
    }
  }
  dispose() {
    if (this.#gl && this.#program) this.#gl.deleteProgram(this.#program);
    this.#ready = false;
  }
};
async function createRenderer(canvas) {
  const gpuRenderer = new WebGPURenderer(canvas);
  const gpuOk = await gpuRenderer.init();
  if (gpuOk) return gpuRenderer;
  const glRenderer = new WebGL2Renderer(canvas);
  const glOk = glRenderer.init();
  if (glOk) return glRenderer;
  throw new Error("Three: Neither WebGPU nor WebGL2 is available in this browser.");
}
var BSP_COPLANAR = 0;
var BSP_FRONT = 1;
var BSP_BACK = 2;
var BSP_SPANNING = 3;
var BSP_EPS = 1e-5;
function _bspPlaneFromVerts(verts) {
  const n = Vec3.cross(
    Vec3.sub(verts[1].pos, verts[0].pos),
    Vec3.sub(verts[2].pos, verts[0].pos)
  ).normalize();
  return { normal: n, w: n.dot(verts[0].pos) };
}
function _bspClassifyPoint(plane, p) {
  const d = plane.normal.dot(p) - plane.w;
  return d < -BSP_EPS ? BSP_BACK : d > BSP_EPS ? BSP_FRONT : BSP_COPLANAR;
}
function _bspSplitPolygon(plane, poly) {
  const front = [], back = [];
  const verts = poly.vertices, n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const vi = verts[i], vj = verts[j];
    const ti = _bspClassifyPoint(plane, vi.pos);
    const tj = _bspClassifyPoint(plane, vj.pos);
    if (ti !== BSP_BACK) front.push(vi);
    if (ti !== BSP_FRONT) back.push(vi);
    if ((ti | tj) === BSP_SPANNING) {
      const t = (plane.w - plane.normal.dot(vi.pos)) / plane.normal.dot(Vec3.sub(vj.pos, vi.pos));
      const ip = vi.pos.clone().lerp(vj.pos, t);
      const in_ = vi.normal.clone().lerp(vj.normal, t).normalize();
      const iuv = vi.uv.clone().add(vj.uv.clone().sub(vi.uv).scale(t));
      const iv = { pos: ip, normal: in_, uv: iuv };
      front.push(iv);
      back.push(iv);
    }
  }
  const toPolys = (vs) => vs.length >= 3 ? [{ vertices: vs, plane: _bspPlaneFromVerts(vs) }] : [];
  return { front: toPolys(front), back: toPolys(back) };
}
var BSPNode = class _BSPNode {
  plane = null;
  front = null;
  back = null;
  polygons = [];
  build(polys) {
    if (!polys.length) return;
    if (!this.plane) this.plane = polys[0].plane;
    const f = [], b = [];
    for (const p of polys) {
      const types = p.vertices.map((v) => _bspClassifyPoint(this.plane, v.pos));
      const type = types.reduce((a, t) => a | t, 0);
      if (type === BSP_COPLANAR) this.polygons.push(p);
      else if (type === BSP_FRONT) f.push(p);
      else if (type === BSP_BACK) b.push(p);
      else {
        const { front, back } = _bspSplitPolygon(this.plane, p);
        f.push(...front);
        b.push(...back);
      }
    }
    if (f.length) {
      this.front = new _BSPNode();
      this.front.build(f);
    }
    if (b.length) {
      this.back = new _BSPNode();
      this.back.build(b);
    }
  }
  allPolygons() {
    let p = [...this.polygons];
    if (this.front) p = p.concat(this.front.allPolygons());
    if (this.back) p = p.concat(this.back.allPolygons());
    return p;
  }
  clone() {
    const n = new _BSPNode();
    n.plane = this.plane ? { normal: this.plane.normal.clone(), w: this.plane.w } : null;
    n.front = this.front ? this.front.clone() : null;
    n.back = this.back ? this.back.clone() : null;
    n.polygons = this.polygons.map((p) => ({ vertices: p.vertices.map((v) => ({ pos: v.pos.clone(), normal: v.normal.clone(), uv: v.uv.clone() })), plane: { normal: p.plane.normal.clone(), w: p.plane.w } }));
    return n;
  }
  invert() {
    for (const p of this.polygons) {
      p.vertices.reverse();
      p.vertices.forEach((v) => v.normal.negate());
      p.plane.normal.negate();
      p.plane.w = -p.plane.w;
    }
    if (this.plane) {
      this.plane.normal.negate();
      this.plane.w = -this.plane.w;
    }
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    [this.front, this.back] = [this.back, this.front];
  }
  clipPolygons(polys) {
    if (!this.plane) return [...polys];
    let f = [], b = [];
    for (const p of polys) {
      const { front, back } = _bspSplitPolygon(this.plane, p);
      f.push(...front);
      b.push(...back);
    }
    if (this.front) f = this.front.clipPolygons(f);
    b = this.back ? this.back.clipPolygons(b) : [];
    return f.concat(b);
  }
  clipTo(bsp) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  }
};
function _geomToPolygons(mesh) {
  const geo = mesh.geometry;
  const pos = geo.positions, nrm = geo.normals, uvd = geo.uvs;
  const idx = geo.indices;
  const out = [];
  const makeVert = (i) => ({
    pos: new Vec3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMat4(mesh.matrixWorld),
    normal: new Vec3(nrm[i * 3] ?? 0, nrm[i * 3 + 1] ?? 0, nrm[i * 3 + 2] ?? 1),
    uv: new Vec2(uvd[i * 2] ?? 0, uvd[i * 2 + 1] ?? 0)
  });
  if (idx.length > 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const verts = [makeVert(idx[i]), makeVert(idx[i + 1]), makeVert(idx[i + 2])];
      out.push({ vertices: verts, plane: _bspPlaneFromVerts(verts) });
    }
  } else {
    for (let i = 0; i < pos.length / 3; i += 3) {
      const verts = [makeVert(i), makeVert(i + 1), makeVert(i + 2)];
      out.push({ vertices: verts, plane: _bspPlaneFromVerts(verts) });
    }
  }
  return out;
}
function _polygonsToGeom(polys) {
  const pos = [], nrm = [], uv = [], idx = [];
  let vi = 0;
  for (const p of polys) {
    const n = p.vertices.length;
    for (const v of p.vertices) {
      pos.push(v.pos.x, v.pos.y, v.pos.z);
      nrm.push(v.normal.x, v.normal.y, v.normal.z);
      uv.push(v.uv.x, v.uv.y);
    }
    for (let i = 1; i < n - 1; i++) idx.push(vi, vi + i, vi + i + 1);
    vi += n;
  }
  return new BufferGeometry().setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
}
var CSG = {
  /**
   * Boolean union — merges two meshes.
   * @example
   *   const result = CSG.union(meshA, meshB);
   */
  union(a, b) {
    a.updateMatrixWorld();
    b.updateMatrixWorld();
    const na = new BSPNode(), nb = new BSPNode();
    na.build(_geomToPolygons(a));
    nb.build(_geomToPolygons(b));
    na.clipTo(nb);
    nb.clipTo(na);
    nb.invert();
    nb.clipTo(na);
    nb.invert();
    na.build(nb.allPolygons());
    return new Mesh(_polygonsToGeom(na.allPolygons()), a.material);
  },
  /**
   * Boolean subtract — subtracts mesh b from mesh a.
   * @example
   *   const result = CSG.subtract(box, sphere);
   */
  subtract(a, b) {
    a.updateMatrixWorld();
    b.updateMatrixWorld();
    const na = new BSPNode(), nb = new BSPNode();
    na.build(_geomToPolygons(a));
    nb.build(_geomToPolygons(b));
    na.invert();
    na.clipTo(nb);
    nb.clipTo(na);
    nb.invert();
    nb.clipTo(na);
    nb.invert();
    na.build(nb.allPolygons());
    na.invert();
    return new Mesh(_polygonsToGeom(na.allPolygons()), a.material);
  },
  /**
   * Boolean intersect — keeps only the overlapping volume.
   * @example
   *   const result = CSG.intersect(meshA, meshB);
   */
  intersect(a, b) {
    a.updateMatrixWorld();
    b.updateMatrixWorld();
    const na = new BSPNode(), nb = new BSPNode();
    na.build(_geomToPolygons(a));
    nb.build(_geomToPolygons(b));
    na.invert();
    nb.clipTo(na);
    nb.invert();
    na.clipTo(nb);
    nb.clipTo(na);
    na.build(nb.allPolygons());
    na.invert();
    return new Mesh(_polygonsToGeom(na.allPolygons()), a.material);
  }
};
var SubdivisionModifier = {
  /**
   * Catmull-Clark subdivision surface.
   * Smooths a mesh by iterating subdivision steps.
   * @param mesh       - Source mesh
   * @param iterations - Subdivision steps (1-4, default: 1)
   */
  apply(mesh, iterations = 1) {
    let geo = mesh.geometry.clone();
    for (let iter = 0; iter < iterations; iter++) geo = _catmullClark(geo);
    return new Mesh(geo, mesh.material);
  }
};
function _catmullClark(geo) {
  const pos = geo.positions;
  const idx = geo.indices;
  const verts = geo.vertexCount;
  const faces = [];
  for (let i = 0; i < idx.length; i += 3) faces.push([idx[i], idx[i + 1], idx[i + 2]]);
  const newPos = [];
  const newIdx = [];
  const facePts = faces.map((f) => {
    const c = new Vec3();
    for (const vi of f) c.add(new Vec3(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]));
    return c.scale(1 / f.length);
  });
  const edgeMap = /* @__PURE__ */ new Map();
  const edgeKey = (a, b) => a < b ? `${a}_${b}` : `${b}_${a}`;
  const edgeAvg = (a, b, fi) => {
    const k = edgeKey(a, b);
    if (!edgeMap.has(k)) edgeMap.set(k, { mid: new Vec3(), faces: [] });
    const e = edgeMap.get(k);
    e.faces.push(fi);
    return k;
  };
  faces.forEach((f, fi) => {
    const n = f.length;
    for (let i = 0; i < n; i++) edgeAvg(f[i], f[(i + 1) % n], fi);
  });
  edgeMap.forEach((e, k) => {
    const [ai, bi] = k.split("_").map(Number);
    const a = new Vec3(pos[ai * 3], pos[ai * 3 + 1], pos[ai * 3 + 2]);
    const b = new Vec3(pos[bi * 3], pos[bi * 3 + 1], pos[bi * 3 + 2]);
    const fc = e.faces.length === 2 ? facePts[e.faces[0]].clone().add(facePts[e.faces[1]]).scale(0.5) : a.clone().add(b).scale(0.5);
    e.mid = a.clone().add(b).add(fc).scale(1 / 3);
  });
  const vFaces = Array.from({ length: verts }, () => []);
  const vEdgeMid = Array.from({ length: verts }, () => []);
  faces.forEach((f, fi) => {
    for (const vi of f) vFaces[vi].push(facePts[fi]);
  });
  edgeMap.forEach((e, k) => {
    const [ai, bi] = k.split("_").map(Number);
    vEdgeMid[ai].push(e.mid);
    vEdgeMid[bi].push(e.mid);
  });
  const newVerts = [];
  for (let i = 0; i < verts; i++) {
    const p = new Vec3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const n = vFaces[i].length;
    if (n === 0) {
      newVerts.push(p);
      continue;
    }
    const fp = vFaces[i].reduce((a, v) => a.add(v), new Vec3()).scale(1 / n);
    const ep = vEdgeMid[i].reduce((a, v) => a.add(v), new Vec3()).scale(1 / vEdgeMid[i].length);
    newVerts.push(fp.scale(1 / n).add(ep.scale(2 / n)).add(p.clone().scale((n - 3) / n)));
  }
  const allVerts = [...newVerts];
  const faceVtxIdx = facePts.map((fp) => {
    allVerts.push(fp);
    return allVerts.length - 1;
  });
  const edgeVtxIdx = /* @__PURE__ */ new Map();
  edgeMap.forEach((e, k) => {
    allVerts.push(e.mid);
    edgeVtxIdx.set(k, allVerts.length - 1);
  });
  const outPos = [];
  const outIdx = [];
  allVerts.forEach((v) => outPos.push(v.x, v.y, v.z));
  faces.forEach((f, fi) => {
    const n = f.length;
    const fp = faceVtxIdx[fi];
    for (let i = 0; i < n; i++) {
      const vi = f[i], vj = f[(i + 1) % n], vk = f[(i + n - 1) % n];
      const eij = edgeVtxIdx.get(edgeKey(vi, vj));
      const eki = edgeVtxIdx.get(edgeKey(vk, vi));
      outIdx.push(vi, eij, fp, eki);
    }
  });
  const tris = [];
  for (let i = 0; i < outIdx.length; i += 4)
    tris.push(outIdx[i], outIdx[i + 1], outIdx[i + 2], outIdx[i], outIdx[i + 2], outIdx[i + 3]);
  return new BufferGeometry().setPositions(outPos).setIndices(tris).computeNormals();
}
var DecimateModifier = {
  /**
   * Reduce vertex count by half-edge collapse.
   * @param mesh  - Source mesh
   * @param ratio - Target ratio of original vertex count (0–1, default: 0.5)
   */
  apply(mesh, ratio = 0.5) {
    const geo = mesh.geometry.clone();
    const pos = Array.from(geo.positions);
    const idx = Array.from(geo.indices);
    const target = Math.max(4, Math.floor(geo.vertexCount * ratio));
    const adj = new Array(geo.vertexCount).fill(null).map(() => /* @__PURE__ */ new Set());
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      adj[a].add(b);
      adj[a].add(c);
      adj[b].add(a);
      adj[b].add(c);
      adj[c].add(a);
      adj[c].add(b);
    }
    const removed = /* @__PURE__ */ new Set();
    let current = geo.vertexCount;
    while (current > target) {
      let best = Infinity, bestA = -1, bestB = -1;
      for (let i = 0; i < geo.vertexCount; i++) {
        if (removed.has(i)) continue;
        for (const j of adj[i]) {
          if (removed.has(j) || j <= i) continue;
          const dx = pos[i * 3] - pos[j * 3], dy = pos[i * 3 + 1] - pos[j * 3 + 1], dz = pos[i * 3 + 2] - pos[j * 3 + 2];
          const cost = dx * dx + dy * dy + dz * dz;
          if (cost < best) {
            best = cost;
            bestA = i;
            bestB = j;
          }
        }
      }
      if (bestA < 0) break;
      pos[bestA * 3] = (pos[bestA * 3] + pos[bestB * 3]) / 2;
      pos[bestA * 3 + 1] = (pos[bestA * 3 + 1] + pos[bestB * 3 + 1]) / 2;
      pos[bestA * 3 + 2] = (pos[bestA * 3 + 2] + pos[bestB * 3 + 2]) / 2;
      removed.add(bestB);
      for (let i = 0; i < idx.length; i++) if (idx[i] === bestB) idx[i] = bestA;
      current--;
    }
    const cleanIdx = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i], b = idx[i + 1], c = idx[i + 2];
      if (a !== b && b !== c && a !== c && !removed.has(a) && !removed.has(b) && !removed.has(c))
        cleanIdx.push(a, b, c);
    }
    return new Mesh(new BufferGeometry().setPositions(pos).setIndices(cleanIdx).computeNormals(), mesh.material);
  }
};
var MirrorModifier = {
  /**
   * Mirror geometry across a given axis.
   * @param mesh - Source mesh
   * @param axis - 'x' | 'y' | 'z' (default: 'x')
   */
  apply(mesh, axis = "x") {
    const geo = mesh.geometry;
    const origPos = Array.from(geo.positions);
    const origNrm = Array.from(geo.normals);
    const origIdx = Array.from(geo.indices);
    const offset = geo.vertexCount;
    const mirrorPos = origPos.slice();
    const mirrorNrm = origNrm.slice();
    const ax = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    for (let i = ax; i < mirrorPos.length; i += 3) mirrorPos[i] *= -1;
    for (let i = ax; i < mirrorNrm.length; i += 3) mirrorNrm[i] *= -1;
    const mirrorIdx = origIdx.map((i) => i + offset);
    for (let i = 0; i < mirrorIdx.length; i += 3) [mirrorIdx[i], mirrorIdx[i + 2]] = [mirrorIdx[i + 2], mirrorIdx[i]];
    const newPos = new Float32Array([...origPos, ...mirrorPos]);
    const newNrm = new Float32Array([...origNrm, ...mirrorNrm]);
    const newIdx = new Uint32Array([...origIdx, ...mirrorIdx]);
    return new Mesh(new BufferGeometry().setPositions(newPos).setNormals(newNrm).setIndices(newIdx), mesh.material);
  }
};
var ArrayModifier = {
  /**
   * Repeat geometry N times along an axis.
   * @param mesh   - Source mesh
   * @param count  - Number of copies (default: 3)
   * @param offset - Offset per copy as Vec3 (default: x+1 per step)
   */
  apply(mesh, count = 3, offset = new Vec3(1, 0, 0)) {
    const geo = mesh.geometry;
    const allPos = [];
    const allNrm = [];
    const allIdx = [];
    for (let c = 0; c < count; c++) {
      const dx = offset.x * c, dy = offset.y * c, dz = offset.z * c;
      const base = allPos.length / 3;
      for (let i = 0; i < geo.positions.length; i += 3) {
        allPos.push(geo.positions[i] + dx, geo.positions[i + 1] + dy, geo.positions[i + 2] + dz);
      }
      allNrm.push(...geo.normals);
      allIdx.push(...geo.indices.map((i) => i + base));
    }
    return new Mesh(new BufferGeometry().setPositions(allPos).setNormals(allNrm).setIndices(allIdx), mesh.material);
  }
};
var BendModifier = {
  /**
   * Bend geometry along the Y axis.
   * @param mesh  - Source mesh
   * @param angle - Bend angle in radians (default: π/4)
   */
  apply(mesh, angle = Math.PI / 4) {
    const geo = mesh.geometry.clone();
    const pos = geo.positions;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pos.length; i += 3) {
      if (pos[i] < minY) minY = pos[i];
      if (pos[i] > maxY) maxY = pos[i];
    }
    const span = maxY - minY || 1;
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1];
      const t = (y - minY) / span;
      const a = t * angle;
      const r = span / (angle || 1e-4);
      pos[i] = (r + pos[i]) * Math.sin(a) - r * Math.sin(0);
      pos[i + 1] = r - (r + pos[i + 2]) * Math.cos(a);
    }
    return new Mesh(geo.computeNormals(), mesh.material);
  }
};
var TwistModifier = {
  /**
   * Twist geometry around the Y axis.
   * @param mesh  - Source mesh
   * @param angle - Total twist angle in radians (default: π)
   */
  apply(mesh, angle = Math.PI) {
    const geo = mesh.geometry.clone();
    const pos = geo.positions;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pos.length; i += 3) {
      if (pos[i] < minY) minY = pos[i];
      if (pos[i] > maxY) maxY = pos[i];
    }
    const span = maxY - minY || 1;
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1];
      const t = (y - minY) / span;
      const a = t * angle;
      const x = pos[i], z = pos[i + 2];
      pos[i] = x * Math.cos(a) - z * Math.sin(a);
      pos[i + 2] = x * Math.sin(a) + z * Math.cos(a);
    }
    return new Mesh(geo.computeNormals(), mesh.material);
  }
};
var BevelModifier = {
  /**
   * Simple vertex bevel — offsets each vertex slightly inward.
   * For production-quality chamfering, use CSG.
   * @param mesh   - Source mesh
   * @param amount - Bevel distance (default: 0.05)
   */
  apply(mesh, amount = 0.05) {
    const geo = mesh.geometry.clone();
    const pos = geo.positions;
    const nrm = geo.normals;
    for (let i = 0; i < pos.length; i++) pos[i] -= nrm[i] * amount;
    return new Mesh(geo, mesh.material);
  }
};
var STLLoader = {
  /**
   * Parse STL (binary or ASCII) into a BufferGeometry.
   * @example
   *   const geo = STLLoader.parse(arrayBuffer);
   */
  parse(buf) {
    const u8 = new Uint8Array(buf);
    const isBinary = !_isAsciiSTL(u8);
    return isBinary ? _parseBinarySTL(buf) : _parseAsciiSTL(new TextDecoder().decode(u8));
  }
};
function _isAsciiSTL(u8) {
  const start = Math.min(256, u8.length);
  for (let i = 0; i < start; i++) if (u8[i] > 127) return false;
  const text = new TextDecoder().decode(u8.slice(0, start));
  return text.trimStart().startsWith("solid");
}
function _parseBinarySTL(buf) {
  const view = new DataView(buf);
  const count = view.getUint32(80, true);
  const pos = [], nrm = [];
  let off = 84;
  for (let i = 0; i < count; i++, off += 50) {
    const nx = view.getFloat32(off, true), ny = view.getFloat32(off + 4, true), nz = view.getFloat32(off + 8, true);
    for (let v = 0; v < 3; v++) {
      const o = off + 12 + v * 12;
      pos.push(view.getFloat32(o, true), view.getFloat32(o + 4, true), view.getFloat32(o + 8, true));
      nrm.push(nx, ny, nz);
    }
  }
  return new BufferGeometry().setPositions(pos).setNormals(nrm);
}
function _parseAsciiSTL(text) {
  const pos = [], nrm = [];
  const lines = text.split("\n");
  let cn = [0, 0, 0];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("facet normal")) {
      const [, , , nx, ny, nz] = t.split(/\s+/);
      cn = [parseFloat(nx), parseFloat(ny), parseFloat(nz)];
    } else if (t.startsWith("vertex")) {
      const [, x, y, z] = t.split(/\s+/);
      pos.push(parseFloat(x), parseFloat(y), parseFloat(z));
      nrm.push(...cn);
    }
  }
  return new BufferGeometry().setPositions(pos).setNormals(nrm);
}
var STLExporter = {
  /**
   * Export a mesh to binary STL.
   * @example
   *   const buf = STLExporter.toBinary(mesh);
   *   Docs.download(new DocsDocument('stl', buf), 'model.stl');
   */
  toBinary(mesh) {
    const geo = mesh.geometry;
    const idx = geo.indices;
    const pos = geo.positions;
    const nrm = geo.normals;
    const count = idx.length > 0 ? idx.length / 3 : pos.length / 9;
    const buf = new ArrayBuffer(84 + count * 50);
    const view = new DataView(buf);
    view.setUint32(80, count, true);
    let off = 84;
    const writeV = (i) => {
      view.setFloat32(off, pos[i * 3], true);
      view.setFloat32(off + 4, pos[i * 3 + 1], true);
      view.setFloat32(off + 8, pos[i * 3 + 2], true);
      off += 12;
    };
    const writeFace = (i0, i1, i2) => {
      view.setFloat32(off, nrm[i0 * 3] ?? 0, true);
      view.setFloat32(off + 4, nrm[i0 * 3 + 1] ?? 0, true);
      view.setFloat32(off + 8, nrm[i0 * 3 + 2] ?? 1, true);
      off += 12;
      writeV(i0);
      writeV(i1);
      writeV(i2);
      view.setUint16(off, 0, true);
      off += 2;
    };
    if (idx.length > 0) for (let i = 0; i < idx.length; i += 3) writeFace(idx[i], idx[i + 1], idx[i + 2]);
    else for (let i = 0; i < pos.length / 3; i += 3) writeFace(i, i + 1, i + 2);
    return buf;
  },
  toAscii(mesh) {
    const geo = mesh.geometry;
    const idx = geo.indices, pos = geo.positions, nrm = geo.normals;
    const lines = ["solid mesh"];
    const v = (i) => `${pos[i * 3]} ${pos[i * 3 + 1]} ${pos[i * 3 + 2]}`;
    const n = (i) => `${nrm[i * 3] ?? 0} ${nrm[i * 3 + 1] ?? 0} ${nrm[i * 3 + 2] ?? 1}`;
    const face = (i0, i1, i2) => `  facet normal ${n(i0)}
    outer loop
      vertex ${v(i0)}
      vertex ${v(i1)}
      vertex ${v(i2)}
    endloop
  endfacet`;
    if (idx.length > 0) for (let i = 0; i < idx.length; i += 3) lines.push(face(idx[i], idx[i + 1], idx[i + 2]));
    else for (let i = 0; i < pos.length / 3; i += 3) lines.push(face(i, i + 1, i + 2));
    lines.push("endsolid mesh");
    return lines.join("\n");
  }
};
var OBJLoader = {
  /**
   * Parse OBJ text into a BufferGeometry.
   */
  parse(text) {
    const vp = [], vn = [], vt = [];
    const pos = [], nrm = [], uv = [];
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (t.startsWith("v ")) {
        const [, x, y, z] = t.split(/\s+/);
        vp.push(parseFloat(x), parseFloat(y), parseFloat(z));
      }
      if (t.startsWith("vn ")) {
        const [, x, y, z] = t.split(/\s+/);
        vn.push(parseFloat(x), parseFloat(y), parseFloat(z));
      }
      if (t.startsWith("vt ")) {
        const [, u, v] = t.split(/\s+/);
        vt.push(parseFloat(u), parseFloat(v));
      }
      if (t.startsWith("f ")) {
        const parts = t.split(/\s+/).slice(1);
        for (let i = 1; i < parts.length - 1; i++) {
          for (const pi of [parts[0], parts[i], parts[i + 1]]) {
            const [vi, ti, ni] = pi.split("/").map((s) => s ? parseInt(s) - 1 : -1);
            pos.push(vp[vi * 3], vp[vi * 3 + 1], vp[vi * 3 + 2]);
            if (ni >= 0) nrm.push(vn[ni * 3], vn[ni * 3 + 1], vn[ni * 3 + 2]);
            if (ti >= 0) uv.push(vt[ti * 2], vt[ti * 2 + 1]);
          }
        }
      }
    }
    const geo = new BufferGeometry().setPositions(pos);
    if (nrm.length) geo.setNormals(nrm);
    else geo.computeNormals();
    if (uv.length) geo.setUVs(uv);
    return geo;
  }
};
var OBJExporter = {
  export(mesh, name = "mesh") {
    const geo = mesh.geometry;
    const pos = geo.positions, nrm = geo.normals, uvd = geo.uvs, idx = geo.indices;
    const lines = [`# AriannA Three export`, `o ${name}`];
    for (let i = 0; i < pos.length; i += 3) lines.push(`v ${pos[i]} ${pos[i + 1]} ${pos[i + 2]}`);
    for (let i = 0; i < nrm.length; i += 3) lines.push(`vn ${nrm[i]} ${nrm[i + 1]} ${nrm[i + 2]}`);
    for (let i = 0; i < uvd.length; i += 2) lines.push(`vt ${uvd[i]} ${uvd[i + 1]}`);
    const fi = (i) => `${i + 1}/${uvd.length > 0 ? i + 1 : ""}/${nrm.length > 0 ? i + 1 : ""}`;
    if (idx.length > 0) for (let i = 0; i < idx.length; i += 3) lines.push(`f ${fi(idx[i])} ${fi(idx[i + 1])} ${fi(idx[i + 2])}`);
    else for (let i = 0; i < pos.length / 3; i += 3) lines.push(`f ${fi(i)} ${fi(i + 1)} ${fi(i + 2)}`);
    return lines.join("\n");
  }
};
var GLTFExporter = {
  /**
   * Export a mesh or scene to GLB binary.
   * Outputs a valid glTF 2.0 binary container.
   */
  toGLB(mesh) {
    const geo = mesh.geometry;
    const pos = geo.positions;
    const idx = geo.indices;
    const nrm = geo.normals;
    const posBytes = pos.buffer.slice(pos.byteOffset, pos.byteOffset + pos.byteLength);
    const idxU32 = idx.length > 0 ? idx : new Uint32Array(Array.from({ length: pos.length / 3 }, (v, i) => i));
    const idxBytes = idxU32.buffer.slice(idxU32.byteOffset, idxU32.byteOffset + idxU32.byteLength);
    const nrmBytes = nrm.length > 0 ? nrm.buffer.slice(nrm.byteOffset, nrm.byteOffset + nrm.byteLength) : new ArrayBuffer(0);
    const bufView = [];
    let bOff = 0;
    const addBV = (buf, target) => {
      bufView.push({ buffer: 0, byteOffset: bOff, byteLength: buf.byteLength, ...target ? { target } : {} });
      bOff += buf.byteLength + (buf.byteLength % 4 ? 4 - buf.byteLength % 4 : 0);
      return bufView.length - 1;
    };
    const posView = addBV(posBytes, 34962);
    const idxView = addBV(idxBytes, 34963);
    const nrmView = nrmBytes.byteLength > 0 ? addBV(nrmBytes, 34962) : -1;
    const accessors = [
      {
        bufferView: posView,
        componentType: 5126,
        count: geo.vertexCount,
        type: "VEC3",
        min: [geo.boundingBox.min.x, geo.boundingBox.min.y, geo.boundingBox.min.z],
        max: [geo.boundingBox.max.x, geo.boundingBox.max.y, geo.boundingBox.max.z]
      },
      { bufferView: idxView, componentType: 5125, count: idxU32.length, type: "SCALAR" }
    ];
    if (nrmView >= 0) accessors.push({ bufferView: nrmView, componentType: 5126, count: geo.vertexCount, type: "VEC3" });
    const prim = { attributes: { POSITION: 0 }, indices: 1, mode: 4 };
    if (nrmView >= 0) prim.attributes["NORMAL"] = 2;
    const col = mesh.material.color;
    const json = {
      asset: { version: "2.0", generator: "AriannA Three" },
      bufferViews: bufView,
      accessors,
      meshes: [{ name: "mesh", primitives: [prim] }],
      nodes: [{ mesh: 0, name: "node" }],
      scenes: [{ nodes: [0] }],
      scene: 0,
      materials: [{ name: "mat", pbrMetallicRoughness: { baseColorFactor: col.toArray(), metallicFactor: mesh.material.metalness, roughnessFactor: mesh.material.roughness } }],
      buffers: [{ byteLength: bOff }]
    };
    const jsonStr = JSON.stringify(json);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const jsonPad = jsonBytes.length % 4 ? 4 - jsonBytes.length % 4 : 0;
    const allBufs = [posBytes, idxBytes];
    if (nrmBytes.byteLength > 0) allBufs.push(nrmBytes);
    const binLen = allBufs.reduce((s, b) => s + b.byteLength + (b.byteLength % 4 ? 4 - b.byteLength % 4 : 0), 0);
    const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + binLen;
    const out = new ArrayBuffer(total);
    const view = new DataView(out);
    const u8 = new Uint8Array(out);
    let off = 0;
    view.setUint32(0, 1179937895, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, total, true);
    off = 12;
    view.setUint32(off, jsonBytes.length + jsonPad, true);
    view.setUint32(off + 4, 1313821514, true);
    off += 8;
    u8.set(jsonBytes, off);
    off += jsonBytes.length;
    for (let i = 0; i < jsonPad; i++) u8[off++] = 32;
    view.setUint32(off, binLen, true);
    view.setUint32(off + 4, 5130562, true);
    off += 8;
    for (const b of allBufs) {
      const src = new Uint8Array(b);
      u8.set(src, off);
      off += src.length;
      const pad = src.length % 4 ? 4 - src.length % 4 : 0;
      for (let i = 0; i < pad; i++) u8[off++] = 0;
    }
    return out;
  }
};
var OrbitControls = class {
  camera;
  canvas;
  target = new Vec3();
  minDistance = 0.5;
  maxDistance = 100;
  minPolarAngle = 0;
  maxPolarAngle = Math.PI;
  enableDamping = true;
  dampingFactor = 0.05;
  enableZoom = true;
  enableRotate = true;
  enablePan = true;
  #spherical = { r: 5, theta: 0, phi: Math.PI / 4 };
  #isDragging = false;
  #isPanning = false;
  #lastX = 0;
  #lastY = 0;
  #dTheta = 0;
  #dPhi = 0;
  #dispose = [];
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.#init();
    this.#updateCamera();
  }
  #init() {
    const on = (type, fn) => {
      this.canvas.addEventListener(type, fn);
      this.#dispose.push(() => this.canvas.removeEventListener(type, fn));
    };
    const onW = (type, fn) => {
      window.addEventListener(type, fn);
      this.#dispose.push(() => window.removeEventListener(type, fn));
    };
    on("mousedown", (e) => {
      if (e.button === 0) {
        this.#isDragging = true;
        this.#isPanning = false;
      }
      if (e.button === 2) {
        this.#isPanning = true;
        this.#isDragging = false;
      }
      this.#lastX = e.clientX;
      this.#lastY = e.clientY;
    });
    onW("mouseup", () => {
      this.#isDragging = false;
      this.#isPanning = false;
    });
    onW("mousemove", (e) => {
      const dx = e.clientX - this.#lastX, dy = e.clientY - this.#lastY;
      this.#lastX = e.clientX;
      this.#lastY = e.clientY;
      if (this.#isDragging && this.enableRotate) {
        this.#dTheta -= dx * 0.01;
        this.#dPhi -= dy * 0.01;
      }
      if (this.#isPanning && this.enablePan) {
        this.target.x -= dx * 5e-3;
        this.target.y += dy * 5e-3;
      }
    });
    on("wheel", (e) => {
      if (!this.enableZoom) return;
      this.#spherical.r = Math.min(this.maxDistance, Math.max(this.minDistance, this.#spherical.r + e.deltaY * 0.01));
      this.#updateCamera();
    });
    on("contextmenu", (e) => e.preventDefault());
    let touches = [];
    on("touchstart", (e) => {
      touches = Array.from(e.touches);
    });
    on("touchmove", (e) => {
      if (e.touches.length === 1 && this.enableRotate) {
        const dx = e.touches[0].clientX - touches[0].clientX;
        const dy = e.touches[0].clientY - touches[0].clientY;
        this.#dTheta -= dx * 0.01;
        this.#dPhi -= dy * 0.01;
        touches = Array.from(e.touches);
      }
      if (e.touches.length === 2 && this.enableZoom) {
        const d0 = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
        const d1 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        this.#spherical.r = Math.min(this.maxDistance, Math.max(this.minDistance, this.#spherical.r * (d0 / d1)));
        touches = Array.from(e.touches);
      }
    });
  }
  update() {
    if (this.enableDamping) {
      this.#spherical.theta += this.#dTheta;
      this.#spherical.phi += this.#dPhi;
      this.#dTheta *= 1 - this.dampingFactor;
      this.#dPhi *= 1 - this.dampingFactor;
    } else {
      this.#spherical.theta += this.#dTheta;
      this.#dTheta = 0;
      this.#spherical.phi += this.#dPhi;
      this.#dPhi = 0;
    }
    this.#spherical.phi = Math.max(this.minPolarAngle + 0.01, Math.min(this.maxPolarAngle - 0.01, this.#spherical.phi));
    this.#updateCamera();
  }
  #updateCamera() {
    const { r, theta, phi } = this.#spherical;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    const st = Math.sin(theta), ct = Math.cos(theta);
    this.camera.position.set(
      this.target.x + r * sp * st,
      this.target.y + r * cp,
      this.target.z + r * sp * ct
    );
    this.camera.lookAt(this.target);
  }
  dispose() {
    this.#dispose.forEach((fn) => fn());
  }
};
var AnimationLoop = class {
  #rafId = 0;
  #running = false;
  #time = 0;
  #last = 0;
  onFrame;
  constructor(fn) {
    this.onFrame = fn;
  }
  start() {
    if (this.#running) return this;
    this.#running = true;
    this.#last = performance.now();
    const loop = (now) => {
      if (!this.#running) return;
      const dt = (now - this.#last) / 1e3;
      this.#last = now;
      this.#time += dt;
      this.onFrame(this.#time, dt);
      this.#rafId = requestAnimationFrame(loop);
    };
    this.#rafId = requestAnimationFrame(loop);
    return this;
  }
  stop() {
    this.#running = false;
    cancelAnimationFrame(this.#rafId);
    return this;
  }
  get running() {
    return this.#running;
  }
};
var Three = {
  // Scene graph
  Scene,
  Group,
  Mesh,
  Object3D,
  // Cameras
  PerspectiveCamera,
  OrthographicCamera,
  // Geometries
  BufferGeometry,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  PlaneGeometry,
  ConeGeometry,
  TorusGeometry,
  // Materials
  Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshPBRMaterial,
  WireframeMaterial,
  LineMaterial,
  // Lights
  AmbientLight,
  DirectionalLight,
  PointLight,
  SpotLight,
  // Math
  Vec2,
  Vec3,
  Vec4,
  Mat4,
  Quaternion: Quaternion2,
  Color,
  Box3,
  // Renderer
  createRenderer,
  WebGPURenderer,
  WebGL2Renderer,
  // Controls
  OrbitControls,
  AnimationLoop,
  // CSG
  CSG,
  // Modifiers
  SubdivisionModifier,
  DecimateModifier,
  MirrorModifier,
  ArrayModifier,
  BendModifier,
  TwistModifier,
  BevelModifier,
  // Import/Export
  STLLoader,
  STLExporter,
  OBJLoader,
  OBJExporter,
  GLTFExporter
};
if (typeof window !== "undefined")
  Object.defineProperty(window, "Three", {
    value: Three,
    writable: false,
    enumerable: false,
    configurable: false
  });
var Three_default = Three;

// additionals/Latex.ts
var GREEK = {
  alpha: "\u03B1",
  beta: "\u03B2",
  gamma: "\u03B3",
  delta: "\u03B4",
  epsilon: "\u03B5",
  zeta: "\u03B6",
  eta: "\u03B7",
  theta: "\u03B8",
  iota: "\u03B9",
  kappa: "\u03BA",
  lambda: "\u03BB",
  mu: "\u03BC",
  nu: "\u03BD",
  xi: "\u03BE",
  pi: "\u03C0",
  rho: "\u03C1",
  sigma: "\u03C3",
  tau: "\u03C4",
  upsilon: "\u03C5",
  phi: "\u03C6",
  chi: "\u03C7",
  psi: "\u03C8",
  omega: "\u03C9",
  Alpha: "\u0391",
  Beta: "\u0392",
  Gamma: "\u0393",
  Delta: "\u0394",
  Theta: "\u0398",
  Lambda: "\u039B",
  Pi: "\u03A0",
  Sigma: "\u03A3",
  Phi: "\u03A6",
  Psi: "\u03A8",
  Omega: "\u03A9"
};
var OPS = {
  "pm": "\xB1",
  "	imes": "\xD7",
  "div": "\xF7",
  "leq": "\u2264",
  "geq": "\u2265",
  "\neq": "\u2260",
  "approx": "\u2248",
  "infty": "\u221E",
  "partial": "\u2202",
  "\nabla": "\u2207",
  "\forall": "\u2200",
  "exists": "\u2203",
  "in": "\u2208",
  "\notin": "\u2209",
  "subset": "\u2282",
  "supset": "\u2283",
  "cup": "\u222A",
  "cap": "\u2229",
  "cdot": "\xB7",
  "ldots": "\u2026",
  "cdots": "\u22EF"
};
var Latex = {
  /** Convert LaTeX string to MathML string */
  toMathML(latex) {
    let s = latex.trim();
    for (const [cmd, char] of Object.entries(GREEK)) {
      s = s.replace(new RegExp(`\\${cmd}\b`, "g"), `<mi>${char}</mi>`);
    }
    for (const [cmd, char] of Object.entries(OPS)) {
      s = s.replace(new RegExp(cmd.replace(/\\/g, "\\\\"), "g"), `<mo>${char}</mo>`);
    }
    s = s.replace(/\frac\{([^}]+)\}\{([^}]+)\}/g, "<mfrac><mrow>$1</mrow><mrow>$2</mrow></mfrac>");
    s = s.replace(/\sqrt\{([^}]+)\}/g, "<msqrt><mrow>$1</mrow></msqrt>");
    s = s.replace(/\{([^}]+)\}\^\{([^}]+)\}/g, "<msup><mrow>$1</mrow><mrow>$2</mrow></msup>");
    s = s.replace(/(\w)\^(\w)/g, "<msup><mi>$1</mi><mi>$2</mi></msup>");
    s = s.replace(/\{([^}]+)\}_\{([^}]+)\}/g, "<msub><mrow>$1</mrow><mrow>$2</mrow></msub>");
    s = s.replace(/(\w)_(\w)/g, "<msub><mi>$1</mi><mi>$2</mi></msub>");
    s = s.replace(/\sum/g, "<mo>\u2211</mo>");
    s = s.replace(/\int/g, "<mo>\u222B</mo>");
    s = s.replace(/\prod/g, "<mo>\u220F</mo>");
    s = s.replace(/\lim/g, "<mo>lim</mo>");
    s = s.replace(/(\d+)/g, "<mn>$1</mn>");
    s = s.replace(/([a-zA-Z](?!>|<))/g, "<mi>$1</mi>");
    s = s.replace(/\{([^{}]*)\}/g, "$1");
    return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>${s}</mrow></math>`;
  },
  /** Render LaTeX into an HTML element */
  render(el, latex) {
    el.innerHTML = Latex.toMathML(latex);
  }
};
var LateX = {
  name: "LateX",
  version: "0.1.0",
  install(core) {
    try {
      Object.defineProperty(window, "Latex", { value: Latex, writable: false, enumerable: false, configurable: false });
    } catch {
    }
  }
};
var Latex_default = LateX;

// additionals/Animation.ts
var AnimationLoop2 = class {
  _elements = {};
  _frames = [];
  _frameRate;
  _duration;
  _id = false;
  _running = false;
  _callbacks = {
    onAnimation: (_frame) => {
    },
    onAnimationStart: (_frame) => {
    },
    onAnimationStop: () => {
    },
    onAnimationIteration: () => {
    }
  };
  constructor(opts = {}) {
    this._frameRate = opts.frameRate ?? 60;
    this._duration = 1 / this._frameRate;
  }
  // Original Golem callbacks
  get onAnimation() {
    return this._callbacks.onAnimation;
  }
  set onAnimation(fn) {
    this._callbacks.onAnimation = fn;
  }
  get onAnimationStart() {
    return this._callbacks.onAnimationStart;
  }
  set onAnimationStart(fn) {
    this._callbacks.onAnimationStart = fn;
  }
  get onAnimationStop() {
    return this._callbacks.onAnimationStop;
  }
  set onAnimationStop(fn) {
    this._callbacks.onAnimationStop = fn;
  }
  get onAnimationIteration() {
    return this._callbacks.onAnimationIteration;
  }
  set onAnimationIteration(fn) {
    this._callbacks.onAnimationIteration = fn;
  }
  get IsRunning() {
    return this._running;
  }
  get Frames() {
    return this._frames;
  }
  get FrameRate() {
    return this._frameRate;
  }
  // Original Golem Add/Remove element
  Add(id, el) {
    this._elements[id] = el;
    return this;
  }
  Remove(id) {
    delete this._elements[id];
    return this;
  }
  // Original Golem Start — migrated from IIFE function
  Start(_args) {
    if (this._running) return this;
    this._running = true;
    const animate = (_time) => {
      if (!this._running) return;
      const frameIndex = this._frames.length;
      const frame = {
        Name: `AriannA-Frame-${frameIndex}`,
        Duration: this._duration,
        Rate: this._frameRate,
        Index: frameIndex,
        Elements: this._elements,
        Keyframe: false
      };
      this._frames.push(frame);
      if (frameIndex === 0) {
        this._callbacks.onAnimationStart(frame);
      }
      this._callbacks.onAnimation(frame);
      if (frameIndex > 0 && frameIndex % this._frameRate === 0) {
        this._callbacks.onAnimationIteration();
      }
      this._id = requestAnimationFrame(animate);
    };
    this._id = requestAnimationFrame(animate);
    return this;
  }
  // Original Golem Stop — migrated
  Stop(id) {
    this._running = false;
    const cancelId = id !== void 0 ? typeof id === "string" ? parseInt(id) : id : this._id || 0;
    cancelAnimationFrame(cancelId);
    this._id = false;
    this._callbacks.onAnimationStop();
    return this;
  }
  Reset() {
    this._frames = [];
    return this;
  }
};
var Easing = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - --t * t * t * t,
  easeInExpo: (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  easeOutBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  easeOutElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
  }
};
var Tween = class {
  _from = {};
  _to = {};
  _target;
  _opts;
  _start = 0;
  _running = false;
  _raf = 0;
  _reps = 0;
  _forward = true;
  constructor(target, opts) {
    this._target = target;
    this._opts = opts;
    for (const [key, val] of Object.entries(opts)) {
      if (Array.isArray(val) && val.length === 2) {
        this._from[key] = val[0];
        this._to[key] = val[1];
        target[key] = val[0];
      }
    }
    setTimeout(() => this.play(), (opts.delay ?? 0) * 1e3);
  }
  play() {
    this._running = true;
    this._start = performance.now();
    this._tick();
    return this;
  }
  pause() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    return this;
  }
  stop() {
    this.pause();
    this._reps = 0;
    this._forward = true;
    return this;
  }
  _tick() {
    if (!this._running) return;
    const elapsed = (performance.now() - this._start) / 1e3;
    const t = Math.min(elapsed / this._opts.duration, 1);
    const easeFn = typeof this._opts.easing === "function" ? this._opts.easing : Easing[this._opts.easing ?? "linear"] ?? Easing.linear;
    const e = this._forward ? easeFn(t) : easeFn(1 - t);
    for (const key of Object.keys(this._from)) {
      this._target[key] = this._from[key] + (this._to[key] - this._from[key]) * e;
    }
    this._opts.onUpdate?.(t);
    if (t >= 1) {
      this._reps++;
      const maxReps = this._opts.repeat === "infinite" ? Infinity : (this._opts.repeat ?? 0) + 1;
      if (this._reps < maxReps) {
        if (this._opts.yoyo) this._forward = !this._forward;
        this._start = performance.now();
        this._raf = requestAnimationFrame(() => this._tick());
      } else {
        this._running = false;
        this._opts.onComplete?.();
      }
    } else {
      this._raf = requestAnimationFrame(() => this._tick());
    }
  }
};
var Spring = class {
  _pos;
  _vel = 0;
  _target;
  _opts;
  _cb;
  _running = false;
  _raf = 0;
  constructor(from, to, opts = {}, onUpdate) {
    this._pos = from;
    this._target = to;
    this._cb = onUpdate;
    this._opts = {
      stiffness: opts.stiffness ?? 150,
      damping: opts.damping ?? 20,
      mass: opts.mass ?? 1,
      precision: opts.precision ?? 1e-3
    };
    this.play();
  }
  setTarget(to) {
    this._target = to;
    if (!this._running) this.play();
    return this;
  }
  play() {
    this._running = true;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1e3, 0.064);
      last = now;
      const force = -this._opts.stiffness * (this._pos - this._target) - this._opts.damping * this._vel;
      this._vel += force / this._opts.mass * dt;
      this._pos += this._vel * dt;
      this._cb(this._pos);
      if (Math.abs(this._vel) < this._opts.precision && Math.abs(this._pos - this._target) < this._opts.precision) {
        this._pos = this._target;
        this._cb(this._pos);
        this._running = false;
      } else {
        this._raf = requestAnimationFrame(tick);
      }
    };
    this._raf = requestAnimationFrame(tick);
    return this;
  }
  pause() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    return this;
  }
};
var Timeline = class {
  _items = [];
  _duration = 0;
  add(tween, at) {
    const t = typeof at === "string" ? this._duration + parseFloat(at.slice(2)) : at;
    this._items.push({ tween, at: t });
    this._duration = Math.max(this._duration, t + tween._opts.duration);
    return this;
  }
  play() {
    const start = performance.now();
    this._items.forEach(({ tween, at }) => {
      setTimeout(() => tween.play(), at * 1e3);
    });
    return this;
  }
};
var Animation = {
  name: "Animation",
  version: "1.0.0",
  install(_core) {
    try {
      Object.assign(window, { AnimationLoop: AnimationLoop2, Easing, Tween, Spring, Timeline });
    } catch {
    }
  }
};
var Animation_default = Animation;

// additionals/Audio.ts
var AudioEngine = class {
  #ctx = null;
  #master = null;
  #compressor = null;
  get context() {
    if (!this.#ctx) {
      this.#ctx = new AudioContext();
      this.#master = this.#ctx.createGain();
      this.#compressor = this.#ctx.createDynamicsCompressor();
      this.#master.connect(this.#compressor);
      this.#compressor.connect(this.#ctx.destination);
    }
    return this.#ctx;
  }
  get master() {
    this.context;
    return this.#master;
  }
  get destination() {
    return this.master;
  }
  async resume() {
    if (this.#ctx?.state === "suspended") await this.#ctx.resume();
  }
  async suspend() {
    await this.#ctx?.suspend();
  }
  close() {
    this.#ctx?.close();
    this.#ctx = null;
  }
  get time() {
    return this.#ctx?.currentTime ?? 0;
  }
  set volume(v) {
    if (this.#master) this.#master.gain.value = Math.max(0, Math.min(1, v));
  }
  get volume() {
    return this.#master?.gain.value ?? 1;
  }
};
var _engine = new AudioEngine();
var AudioPlayer = class {
  #buf = null;
  #src = null;
  #gain;
  #engine;
  constructor(engine = _engine) {
    this.#engine = engine;
    this.#gain = engine.context.createGain();
    this.#gain.connect(engine.destination);
  }
  async load(src) {
    const ctx = this.#engine.context;
    let ab;
    if (src instanceof ArrayBuffer) {
      ab = src;
    } else if (src instanceof Blob) {
      ab = await src.arrayBuffer();
    } else {
      ab = await (await fetch(src)).arrayBuffer();
    }
    this.#buf = await ctx.decodeAudioData(ab);
    return this;
  }
  play(offset = 0, duration) {
    this.#engine.resume();
    this.stop();
    const ctx = this.#engine.context;
    this.#src = ctx.createBufferSource();
    this.#src.buffer = this.#buf;
    this.#src.connect(this.#gain);
    this.#src.start(0, offset, duration);
    return this;
  }
  stop() {
    try {
      this.#src?.stop();
    } catch {
    }
    this.#src = null;
    return this;
  }
  set volume(v) {
    this.#gain.gain.value = Math.max(0, v);
  }
  get volume() {
    return this.#gain.gain.value;
  }
  set loop(v) {
    if (this.#src) this.#src.loop = v;
  }
  set playbackRate(r) {
    if (this.#src) this.#src.playbackRate.value = r;
  }
  connect(node) {
    this.#gain.disconnect();
    this.#gain.connect(node);
    return this;
  }
  get buffer() {
    return this.#buf;
  }
  get duration() {
    return this.#buf?.duration ?? 0;
  }
};
var AudioRecorder = class {
  #stream = null;
  #recorder = null;
  #chunks = [];
  async start(constraints = { audio: true }) {
    this.#stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.#chunks = [];
    this.#recorder = new MediaRecorder(this.#stream);
    this.#recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.#chunks.push(e.data);
    };
    this.#recorder.start();
    return this;
  }
  async stop() {
    return new Promise((res) => {
      if (!this.#recorder) {
        res(new Blob());
        return;
      }
      this.#recorder.onstop = () => res(new Blob(this.#chunks, { type: "audio/webm" }));
      this.#recorder.stop();
      this.#stream?.getTracks().forEach((t) => t.stop());
    });
  }
};
var Oscillator = class {
  #osc = null;
  #gain;
  #engine;
  #type;
  #freq;
  constructor(freq = 440, type = "sine", engine = _engine) {
    this.#engine = engine;
    this.#type = type;
    this.#freq = freq;
    this.#gain = engine.context.createGain();
    this.#gain.connect(engine.destination);
  }
  start(volume = 0.5) {
    this.#engine.resume();
    this.stop();
    const ctx = this.#engine.context;
    this.#osc = ctx.createOscillator();
    this.#osc.type = this.#type;
    this.#osc.frequency.value = this.#freq;
    this.#gain.gain.value = volume;
    this.#osc.connect(this.#gain);
    this.#osc.start();
    return this;
  }
  stop() {
    try {
      this.#osc?.stop();
    } catch {
    }
    this.#osc = null;
    return this;
  }
  set frequency(f) {
    this.#freq = f;
    if (this.#osc) this.#osc.frequency.setValueAtTime(f, this.#engine.context.currentTime);
  }
  set volume(v) {
    this.#gain.gain.value = Math.max(0, v);
  }
  set detune(cents) {
    if (this.#osc) this.#osc.detune.value = cents;
  }
  connect(node) {
    this.#gain.disconnect();
    this.#gain.connect(node);
    return this;
  }
};
var NoiseGenerator = class {
  #script = null;
  #gain;
  #engine;
  #noiseType;
  #b0 = 0;
  #b1 = 0;
  #b2 = 0;
  #b3 = 0;
  #b4 = 0;
  #b5 = 0;
  #b6 = 0;
  #lastOut = 0;
  constructor(type = "white", engine = _engine) {
    this.#engine = engine;
    this.#noiseType = type;
    this.#gain = engine.context.createGain();
    this.#gain.connect(engine.destination);
  }
  start(volume = 0.1) {
    this.stop();
    const ctx = this.#engine.context;
    this.#script = ctx.createScriptProcessor(4096, 1, 1);
    this.#script.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < out.length; i++) {
        const white = Math.random() * 2 - 1;
        if (this.#noiseType === "white") {
          out[i] = white;
        } else if (this.#noiseType === "pink") {
          this.#b0 = 0.99886 * this.#b0 + white * 0.0555179;
          this.#b1 = 0.99332 * this.#b1 + white * 0.0750759;
          this.#b2 = 0.969 * this.#b2 + white * 0.153852;
          this.#b3 = 0.8665 * this.#b3 + white * 0.3104856;
          this.#b4 = 0.55 * this.#b4 + white * 0.5329522;
          this.#b5 = -0.7616 * this.#b5 - white * 0.016898;
          out[i] = (this.#b0 + this.#b1 + this.#b2 + this.#b3 + this.#b4 + this.#b5 + this.#b6 + white * 0.5362) * 0.11;
          this.#b6 = white * 0.115926;
        } else {
          out[i] = this.#lastOut = (this.#lastOut + 0.02 * white) / 1.02;
        }
      }
    };
    this.#gain.gain.value = volume;
    this.#script.connect(this.#gain);
    return this;
  }
  stop() {
    this.#script?.disconnect();
    this.#script = null;
    return this;
  }
  set volume(v) {
    this.#gain.gain.value = Math.max(0, v);
  }
};
var Reverb = class {
  #convolver;
  #wet;
  #dry;
  #output;
  constructor(engine = _engine, opts = {}) {
    const ctx = engine.context;
    const decay = opts.decay ?? 2;
    const sr = ctx.sampleRate, len = Math.round(decay * sr);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    this.#convolver = ctx.createConvolver();
    this.#convolver.buffer = buf;
    this.#wet = ctx.createGain();
    this.#dry = ctx.createGain();
    this.#output = ctx.createGain();
    this.#wet.gain.value = opts.wet ?? 0.3;
    this.#dry.gain.value = 1 - (opts.wet ?? 0.3);
    this.#convolver.connect(this.#wet);
    this.#wet.connect(this.#output);
    this.#dry.connect(this.#output);
  }
  get input() {
    return this.#dry;
  }
  get output() {
    return this.#output;
  }
  set wet(v) {
    this.#wet.gain.value = Math.max(0, Math.min(1, v));
    this.#dry.gain.value = 1 - v;
  }
};
var Delay = class {
  #node;
  #gain;
  #output;
  constructor(engine = _engine, opts = {}) {
    const ctx = engine.context;
    this.#node = ctx.createDelay(5);
    this.#node.delayTime.value = opts.time ?? 0.3;
    this.#gain = ctx.createGain();
    this.#gain.gain.value = opts.feedback ?? 0.4;
    this.#output = ctx.createGain();
    this.#node.connect(this.#gain);
    this.#gain.connect(this.#node);
    this.#node.connect(this.#output);
  }
  get input() {
    return this.#node;
  }
  get output() {
    return this.#output;
  }
  set time(t) {
    this.#node.delayTime.value = Math.max(0, Math.min(5, t));
  }
  set feedback(v) {
    this.#gain.gain.value = Math.max(0, Math.min(0.99, v));
  }
};
var Filter = class {
  #node;
  constructor(engine = _engine, opts = {}) {
    this.#node = engine.context.createBiquadFilter();
    this.#node.type = opts.type ?? "lowpass";
    this.#node.frequency.value = opts.freq ?? 1e3;
    this.#node.Q.value = opts.Q ?? 1;
    this.#node.gain.value = opts.gain ?? 0;
  }
  get node() {
    return this.#node;
  }
  set frequency(f) {
    this.#node.frequency.value = f;
  }
  set Q(v) {
    this.#node.Q.value = v;
  }
};
var Analyser = class {
  #node;
  #fftBuf;
  #timeBuf;
  constructor(engine = _engine, fftSize = 2048) {
    this.#node = engine.context.createAnalyser();
    this.#node.fftSize = fftSize;
    this.#fftBuf = new Float32Array(this.#node.frequencyBinCount);
    this.#timeBuf = new Float32Array(fftSize);
    engine.destination.connect(this.#node);
  }
  get node() {
    return this.#node;
  }
  getSpectrum() {
    this.#node.getFloatFrequencyData(this.#fftBuf);
    return this.#fftBuf;
  }
  getWaveform() {
    this.#node.getFloatTimeDomainData(this.#timeBuf);
    return this.#timeBuf;
  }
  getPeak() {
    return Math.max(...this.getWaveform().map(Math.abs));
  }
  getRMS() {
    const w = this.getWaveform();
    return Math.sqrt(w.reduce((a, v) => a + v * v, 0) / w.length);
  }
};
var Sequencer = class {
  #steps;
  #bpm;
  #interval = null;
  #step = 0;
  #callbacks = [];
  constructor(steps = 16, bpm = 120) {
    this.#steps = new Array(steps).fill(false);
    this.#bpm = bpm;
  }
  set(step, active) {
    this.#steps[step] = active;
    return this;
  }
  setPattern(pattern) {
    this.#steps = [...pattern];
    return this;
  }
  onStep(cb) {
    this.#callbacks.push(cb);
    return this;
  }
  set bpm(v) {
    this.#bpm = v;
    if (this.#interval) {
      this.stop();
      this.start();
    }
  }
  start() {
    this.stop();
    const ms = 60 / this.#bpm / 4 * 1e3;
    this.#interval = setInterval(() => {
      if (this.#steps[this.#step]) this.#callbacks.forEach((cb) => cb(this.#step, _engine.time));
      this.#step = (this.#step + 1) % this.#steps.length;
    }, ms);
    return this;
  }
  stop() {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
    this.#step = 0;
    return this;
  }
  get currentStep() {
    return this.#step;
  }
};
var MIDIEngine = class {
  #access = null;
  #handlers = [];
  async init() {
    if (!("requestMIDIAccess" in navigator)) return false;
    try {
      this.#access = await navigator.requestMIDIAccess({ sysex: false });
      this.#access.inputs.forEach((input) => {
        input.onmidimessage = (e) => this.#parse(e);
      });
      return true;
    } catch {
      return false;
    }
  }
  #parse(e) {
    const data_ = e.data ? Array.from(e.data) : [0, 0, 0];
    const [status, d1, d2] = data_;
    const type = status >> 4, ch = status & 15;
    const base = { channel: ch };
    let msg;
    if (type === 9 && d2 > 0) msg = { ...base, type: "noteOn", note: d1, velocity: d2 };
    else if (type === 9 || type === 8) msg = { ...base, type: "noteOff", note: d1 };
    else if (type === 11) msg = { ...base, type: "cc", control: d1, value: d2 };
    else return;
    this.#handlers.forEach((h) => h(msg));
  }
  on(handler) {
    this.#handlers.push(handler);
    return this;
  }
  noteToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }
  noteToName(note) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return `${names[note % 12]}${Math.floor(note / 12) - 1}`;
  }
  get inputs() {
    return this.#access?.inputs ?? null;
  }
};
var Audio = {
  engine: _engine,
  AudioEngine,
  AudioPlayer,
  AudioRecorder,
  Oscillator,
  NoiseGenerator,
  Reverb,
  Delay,
  Filter,
  Analyser,
  Sequencer,
  MIDIEngine
};
if (typeof window !== "undefined")
  Object.defineProperty(window, "Audio", { value: Audio, writable: false, enumerable: false, configurable: false });
var Audio_default = Audio;

// additionals/Video.ts
var ScreenCapture = class {
  #stream = null;
  #recorder = null;
  #chunks = [];
  #opts;
  constructor(opts = {}) {
    this.#opts = { width: 1920, height: 1080, frameRate: 30, audio: false, ...opts };
  }
  async start() {
    const constraints = {
      video: { width: this.#opts.width, height: this.#opts.height },
      audio: this.#opts.audio
    };
    this.#stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    this.#chunks = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    this.#recorder = new MediaRecorder(this.#stream, { mimeType });
    this.#recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.#chunks.push(e.data);
    };
    this.#recorder.start(100);
    return this;
  }
  async stop() {
    return new Promise((res) => {
      if (!this.#recorder) {
        res(new Blob());
        return;
      }
      this.#recorder.onstop = () => res(new Blob(this.#chunks, { type: "video/webm" }));
      this.#recorder.stop();
      this.#stream?.getTracks().forEach((t) => t.stop());
    });
  }
  get stream() {
    return this.#stream;
  }
};
var CameraCapture = class {
  #stream = null;
  #recorder = null;
  #chunks = [];
  #opts;
  constructor(opts = {}) {
    this.#opts = { width: 1280, height: 720, frameRate: 30, audio: true, ...opts };
  }
  async start() {
    this.#stream = await navigator.mediaDevices.getUserMedia({
      video: { width: this.#opts.width, height: this.#opts.height, frameRate: this.#opts.frameRate },
      audio: this.#opts.audio
    });
    this.#chunks = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    this.#recorder = new MediaRecorder(this.#stream, { mimeType });
    this.#recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.#chunks.push(e.data);
    };
    this.#recorder.start(100);
    return this;
  }
  async stop() {
    return new Promise((res) => {
      if (!this.#recorder) {
        res(new Blob());
        return;
      }
      this.#recorder.onstop = () => res(new Blob(this.#chunks, { type: "video/webm" }));
      this.#recorder.stop();
      this.#stream?.getTracks().forEach((t) => t.stop());
    });
  }
  mountPreview(container) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (el && this.#stream) {
      const v = document.createElement("video");
      v.srcObject = this.#stream;
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      v.style.cssText = "width:100%;height:auto;";
      el.appendChild(v);
    }
    return this;
  }
  get stream() {
    return this.#stream;
  }
};
var VideoPlayer = class {
  #el;
  constructor(container, opts = {}) {
    this.#el = document.createElement("video");
    this.#el.controls = opts.controls ?? true;
    this.#el.autoplay = opts.autoplay ?? false;
    this.#el.loop = opts.loop ?? false;
    this.#el.muted = opts.muted ?? false;
    this.#el.playsInline = true;
    if (opts.width) this.#el.style.width = `${opts.width}px`;
    if (opts.height) this.#el.style.height = `${opts.height}px`;
    const parent = typeof container === "string" ? document.querySelector(container) : container;
    parent?.appendChild(this.#el);
  }
  src(url) {
    this.#el.src = url instanceof Blob ? URL.createObjectURL(url) : url;
    return this;
  }
  play() {
    return this.#el.play();
  }
  pause() {
    this.#el.pause();
    return this;
  }
  seek(t) {
    this.#el.currentTime = t;
    return this;
  }
  on(event, handler) {
    this.#el.addEventListener(event, handler);
    return this;
  }
  get duration() {
    return this.#el.duration;
  }
  get currentTime() {
    return this.#el.currentTime;
  }
  get paused() {
    return this.#el.paused;
  }
  get element() {
    return this.#el;
  }
  /** Capture current frame as PNG Blob. */
  async captureFrame() {
    const canvas = document.createElement("canvas");
    canvas.width = this.#el.videoWidth;
    canvas.height = this.#el.videoHeight;
    canvas.getContext("2d")?.drawImage(this.#el, 0, 0);
    return new Promise((res) => canvas.toBlob((b) => res(b ?? new Blob()), "image/png"));
  }
};
var VideoCompositor = class {
  #canvas;
  #ctx;
  #layers = [];
  #rafId = 0;
  #time = 0;
  #running = false;
  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
  }
  addLayer(layer) {
    this.#layers.push(layer);
    return this;
  }
  clearLayers() {
    this.#layers = [];
    return this;
  }
  renderFrame(time) {
    const ctx = this.#ctx;
    const { width, height } = this.#canvas;
    ctx.clearRect(0, 0, width, height);
    for (const layer of this.#layers) {
      if (layer.startTime !== void 0 && time < layer.startTime) continue;
      if (layer.endTime !== void 0 && time > layer.endTime) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      const x = layer.x ?? 0, y = layer.y ?? 0, w = layer.width ?? width, h = layer.height ?? height;
      if (layer.type === "color" && layer.color) {
        ctx.fillStyle = layer.color;
        ctx.fillRect(x, y, w, h);
      } else if (layer.type === "image" && layer.source) {
        ctx.drawImage(layer.source, x, y, w, h);
      } else if (layer.type === "video" && layer.source) {
        ctx.drawImage(layer.source, x, y, w, h);
      } else if (layer.type === "text" && layer.text) {
        const s = layer.style ?? {};
        ctx.font = `${s.fontWeight ?? "normal"} ${s.fontSize ?? "24px"} ${s.fontFamily ?? "sans-serif"}`;
        ctx.fillStyle = s.color ?? "#ffffff";
        ctx.fillText(layer.text, x, y);
      }
      ctx.restore();
    }
    return this;
  }
  start() {
    if (this.#running) return this;
    this.#running = true;
    const loop = (ts) => {
      if (!this.#running) return;
      this.#time = ts / 1e3;
      this.renderFrame(this.#time);
      this.#rafId = requestAnimationFrame(loop);
    };
    this.#rafId = requestAnimationFrame(loop);
    return this;
  }
  stop() {
    this.#running = false;
    cancelAnimationFrame(this.#rafId);
    return this;
  }
  async record(duration, frameRate = 30) {
    const stream = this.#canvas.captureStream(frameRate);
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.start();
    await new Promise((res) => setTimeout(res, duration * 1e3));
    return new Promise((res) => {
      recorder.onstop = () => res(new Blob(chunks, { type: "video/webm" }));
      recorder.stop();
    });
  }
};
var GIFEncoder = class {
  #frames = [];
  addFrame(canvas, delay = 100) {
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.#frames.push({ data: data.data, delay, width: canvas.width, height: canvas.height });
    return this;
  }
  encode() {
    const { width, height } = this.#frames[0] ?? { width: 1, height: 1 };
    const parts = [];
    const push = (bytes) => bytes.forEach((b) => parts.push(b));
    push([71, 73, 70, 56, 57, 97]);
    push([width & 255, width >> 8 & 255, height & 255, height >> 8 & 255]);
    push([247, 0, 0]);
    for (let i = 0; i < 256; i++) push([i, i, i]);
    push([33, 255, 11, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1, 0, 0, 0]);
    for (const frame of this.#frames) {
      push([33, 249, 4, 0, frame.delay & 255, frame.delay >> 8 & 255, 0, 0]);
      push([44, 0, 0, 0, 0, frame.width & 255, frame.width >> 8 & 255, frame.height & 255, frame.height >> 8 & 255, 0]);
      const indices = new Uint8Array(frame.width * frame.height);
      for (let i = 0; i < indices.length; i++) {
        const j = i * 4;
        indices[i] = Math.round(0.299 * frame.data[j] + 0.587 * frame.data[j + 1] + 0.114 * frame.data[j + 2]);
      }
      const lzw = _lzwEncode(indices, 8);
      push([8]);
      for (let i = 0; i < lzw.length; i += 255) {
        const chunk = lzw.subarray(i, i + 255);
        push([chunk.length, ...chunk]);
      }
      push([0]);
    }
    push([59]);
    return new Uint8Array(parts);
  }
};
function _lzwEncode(data, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoi = clearCode + 1;
  const table = /* @__PURE__ */ new Map();
  let codeSize = minCodeSize + 1, nextCode = eoi + 1;
  const bits = [], output = [];
  let bitBuf = 0, bitLen = 0;
  const writeBit = (code) => {
    bitBuf |= code << bitLen;
    bitLen += codeSize;
    while (bitLen >= 8) {
      output.push(bitBuf & 255);
      bitBuf >>= 8;
      bitLen -= 8;
    }
  };
  for (let i = 0; i < 1 << minCodeSize; i++) table.set(String.fromCharCode(i), i);
  writeBit(clearCode);
  let buf = "";
  for (let i = 0; i < data.length; i++) {
    const c = String.fromCharCode(data[i]);
    const bc = buf + c;
    if (table.has(bc)) {
      buf = bc;
    } else {
      writeBit(table.get(buf));
      if (nextCode < 4096) {
        table.set(bc, nextCode++);
        if (nextCode > 1 << codeSize) codeSize = Math.min(codeSize + 1, 12);
      } else {
        writeBit(clearCode);
        table.clear();
        for (let j = 0; j < 1 << minCodeSize; j++) table.set(String.fromCharCode(j), j);
        codeSize = minCodeSize + 1;
        nextCode = eoi + 1;
      }
      buf = c;
    }
  }
  if (buf) writeBit(table.get(buf));
  writeBit(eoi);
  if (bitLen > 0) output.push(bitBuf & 255);
  return new Uint8Array(output);
}
var VideoUtils = {
  download(blob, filename = "recording.webm") {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e4);
  },
  blobToDataURL(blob) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });
  },
  async canvasToGIF(canvases, delay = 100) {
    const enc = new GIFEncoder();
    for (const c of canvases) enc.addFrame(c, delay);
    return new Blob([enc.encode().buffer], { type: "image/gif" });
  }
};
var Video = { ScreenCapture, CameraCapture, VideoPlayer, VideoCompositor, GIFEncoder, utils: VideoUtils };
if (typeof window !== "undefined")
  Object.defineProperty(window, "Video", { value: Video, writable: false, enumerable: false, configurable: false });
var Video_default = Video;

// additionals/Network.ts
var Network = {
  name: "AriannANetwork",
  version: "0.1.0",
  install(core, opts) {
    Object.defineProperty(window, "AriannANetwork", {
      value: AriannANetworkAPI,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
};
var AriannANetworkAPI = {
  // TODO: implement Fetch wrapper, WebSocket, SSE ...
};
var Network_default = Network;

// additionals/IO.ts
var FileIO = class {
  /** Open a file picker and return the selected File(s). */
  static async open(opts = {}) {
    if ("showOpenFilePicker" in window) {
      const handles = await window.showOpenFilePicker({
        multiple: opts.multiple ?? false,
        types: opts.filters
      });
      return Promise.all(handles.map((h) => h.getFile()));
    }
    return new Promise((res) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = opts.multiple ?? false;
      if (opts.accept) input.accept = opts.accept;
      input.onchange = () => res(Array.from(input.files ?? []));
      input.click();
    });
  }
  /** Read File/Blob as text. */
  static readText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsText(file);
    });
  }
  /** Read File/Blob as ArrayBuffer. */
  static readBinary(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsArrayBuffer(file);
    });
  }
  /** Read File/Blob as data URL. */
  static readDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  /** Download content as a file. */
  static download(content, filename, type = "application/octet-stream") {
    let blob;
    if (typeof content === "string") blob = new Blob([content], { type: "text/plain" });
    else if (content instanceof ArrayBuffer) blob = new Blob([content], { type });
    else blob = content;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  /** Setup drag-and-drop on an element. */
  static dropZone(el, onDrop, opts = {}) {
    const hl = opts.highlight ?? "rgba(228,12,136,0.08)";
    const orig = el.style.background;
    const over = (e) => {
      e.preventDefault();
      el.style.background = hl;
    };
    const leave = () => {
      el.style.background = orig;
    };
    const drop = (e) => {
      e.preventDefault();
      el.style.background = orig;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onDrop(files);
    };
    el.addEventListener("dragover", over);
    el.addEventListener("dragleave", leave);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", over);
      el.removeEventListener("dragleave", leave);
      el.removeEventListener("drop", drop);
    };
  }
};
var FSAccess = class {
  static isSupported() {
    return "showOpenFilePicker" in window;
  }
  static async readFile(filter) {
    const [handle] = await window.showOpenFilePicker({ types: filter });
    const file = await handle.getFile();
    return { name: file.name, text: () => file.text(), binary: () => file.arrayBuffer() };
  }
  static async writeFile(content, suggestedName = "file.txt", filter) {
    const handle = await window.showSaveFilePicker({ suggestedName, types: filter });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }
  static async openDirectory() {
    return window.showDirectoryPicker();
  }
};
var Http = class {
  #opts;
  constructor(opts = {}) {
    this.#opts = { baseURL: "", timeout: 3e4, retries: 0, retryDelay: 1e3, headers: {}, onRequest: () => {
    }, onResponse: () => {
    }, onError: () => {
    }, ...opts };
  }
  async #fetch(url, init = {}, retries = this.#opts.retries) {
    const fullURL = this.#opts.baseURL + url;
    const headers = { ...this.#opts.headers, ...init.headers ?? {} };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.#opts.timeout);
    const req = { ...init, headers, signal: ctrl.signal, url: fullURL };
    this.#opts.onRequest(req);
    try {
      const res = await fetch(fullURL, req);
      clearTimeout(timer);
      this.#opts.onResponse(res);
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, this.#opts.retryDelay));
        return this.#fetch(url, init, retries - 1);
      }
      this.#opts.onError(err);
      throw err;
    }
  }
  async get(url, opts) {
    return (await this.#fetch(url, { ...opts, method: "GET" })).json();
  }
  async post(url, body, opts) {
    return (await this.#fetch(url, { ...opts, method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })).json();
  }
  async put(url, body, opts) {
    return (await this.#fetch(url, { ...opts, method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })).json();
  }
  async del(url, opts) {
    return (await this.#fetch(url, { ...opts, method: "DELETE" })).json();
  }
  async blob(url) {
    return (await this.#fetch(url)).blob();
  }
  async buffer(url) {
    return (await this.#fetch(url)).arrayBuffer();
  }
  async text(url) {
    return (await this.#fetch(url)).text();
  }
};
var http = new Http();
var SSE = class {
  #source = null;
  #handlers = /* @__PURE__ */ new Map();
  connect(url, withCredentials = false) {
    this.disconnect();
    this.#source = new EventSource(url, { withCredentials });
    this.#source.onmessage = (e) => this.#emit("message", e.data);
    this.#source.onerror = (e) => this.#emit("error", e);
    this.#source.onopen = (e) => this.#emit("open", e);
    return this;
  }
  on(event, handler) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, []);
    this.#handlers.get(event).push(handler);
    this.#source?.addEventListener(event, (e) => handler(e.data));
    return this;
  }
  #emit(event, data) {
    this.#handlers.get(event)?.forEach((h) => h(data));
  }
  disconnect() {
    this.#source?.close();
    this.#source = null;
  }
  get readyState() {
    return this.#source?.readyState ?? -1;
  }
};
var WebSocketIO = class {
  #ws = null;
  #url;
  #queue = [];
  #handlers = /* @__PURE__ */ new Map();
  #reconnect;
  #reconnectMs;
  constructor(url, opts = {}) {
    this.#url = url;
    this.#reconnect = opts.reconnect ?? true;
    this.#reconnectMs = opts.reconnectMs ?? 3e3;
  }
  connect() {
    this.#ws = new WebSocket(this.#url);
    this.#ws.onopen = () => {
      this.#emit("open", null);
      this.#flush();
    };
    this.#ws.onmessage = (e) => {
      try {
        this.#emit("message", JSON.parse(e.data));
      } catch {
        this.#emit("message", e.data);
      }
    };
    this.#ws.onerror = (e) => this.#emit("error", e);
    this.#ws.onclose = (e) => {
      this.#emit("close", e);
      if (this.#reconnect) setTimeout(() => this.connect(), this.#reconnectMs);
    };
    return this;
  }
  send(data) {
    if (this.#ws?.readyState === 1) this.#ws.send(JSON.stringify(data));
    else this.#queue.push(data);
    return this;
  }
  #flush() {
    while (this.#queue.length) this.send(this.#queue.shift());
  }
  on(event, handler) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, []);
    this.#handlers.get(event).push(handler);
    return this;
  }
  #emit(event, data) {
    this.#handlers.get(event)?.forEach((h) => h(data));
  }
  close() {
    this.#reconnect = false;
    this.#ws?.close();
  }
  get readyState() {
    return this.#ws?.readyState ?? -1;
  }
};
var LocalStore = class {
  #key;
  #default;
  #data;
  #listeners = [];
  constructor(key, defaults) {
    this.#key = key;
    this.#default = defaults;
    const raw = localStorage.getItem(key);
    this.#data = raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
  }
  get(key) {
    return this.#data[key];
  }
  set(key, value) {
    this.#data = { ...this.#data, [key]: value };
    localStorage.setItem(this.#key, JSON.stringify(this.#data));
    this.#listeners.forEach((l) => l(this.#data));
    return this;
  }
  reset() {
    this.#data = { ...this.#default };
    localStorage.setItem(this.#key, JSON.stringify(this.#data));
    this.#listeners.forEach((l) => l(this.#data));
    return this;
  }
  subscribe(fn) {
    this.#listeners.push(fn);
    return () => {
      this.#listeners = this.#listeners.filter((l) => l !== fn);
    };
  }
  get all() {
    return { ...this.#data };
  }
  clear() {
    localStorage.removeItem(this.#key);
  }
};
var IDBIO = class {
  #name;
  #version;
  #stores;
  #db = null;
  constructor(name, stores, version2 = 1) {
    this.#name = name;
    this.#stores = stores;
    this.#version = version2;
  }
  async open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.#name, this.#version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const store of this.#stores) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      };
      req.onsuccess = (e) => {
        this.#db = e.target.result;
        res(this);
      };
      req.onerror = rej;
    });
  }
  async put(store, value) {
    return new Promise((res, rej) => {
      const tx = this.#db.transaction(store, "readwrite");
      tx.objectStore(store).put(value).onsuccess = () => res();
      tx.onerror = rej;
    });
  }
  async get(store, id) {
    return new Promise((res, rej) => {
      const req = this.#db.transaction(store, "readonly").objectStore(store).get(id);
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
  }
  async delete(store, id) {
    return new Promise((res, rej) => {
      const tx = this.#db.transaction(store, "readwrite");
      tx.objectStore(store).delete(id).onsuccess = () => res();
      tx.onerror = rej;
    });
  }
  async getAll(store) {
    return new Promise((res, rej) => {
      const req = this.#db.transaction(store, "readonly").objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
  }
  close() {
    this.#db?.close();
  }
};
var Clipboard = {
  async readText() {
    return navigator.clipboard.readText();
  },
  async writeText(text) {
    return navigator.clipboard.writeText(text);
  },
  async readImage() {
    const items = await navigator.clipboard.read();
    for (const item of items) for (const type of item.types) if (type.startsWith("image/")) return item.getType(type);
    return null;
  },
  async writeImage(blob) {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  }
};
var Share = {
  isSupported() {
    return "share" in navigator;
  },
  async share(data) {
    if (!Share.isSupported()) throw new Error("Web Share API not supported");
    return navigator.share(data);
  },
  canShareFiles() {
    return "canShare" in navigator;
  }
};
var IO = { FileIO, FSAccess, Http, http, SSE, WebSocketIO, LocalStore, IDBIO, Clipboard, Share };
if (typeof window !== "undefined")
  Object.defineProperty(window, "IO", { value: IO, writable: false, enumerable: false, configurable: false });
var IO_default = IO;

// components/core/Control.ts
var Control = class {
  /** Root DOM element. */
  el;
  _props = {};
  _bus = /* @__PURE__ */ new Map();
  _cleanup = [];
  _dirty = false;
  _raf = 0;
  constructor(container, tag, defaults = {}) {
    this.el = document.createElement(tag);
    this._props = { ...defaults };
    if (defaults.class) this.el.className = defaults.class;
    if (defaults.theme) this.el.dataset.theme = defaults.theme;
    if (defaults.tabIndex !== void 0) this.el.tabIndex = defaults.tabIndex;
    const parent = typeof container === "string" ? document.querySelector(container) : container;
    if (parent) parent.appendChild(this.el);
    Promise.resolve().then(() => this._flush());
  }
  // ── Props (React-like) ────────────────────────────────────────────────────
  _set(key, value) {
    this._props[key] = value;
    this._schedule();
  }
  _get(key, fallback) {
    return this._props[key] ?? fallback;
  }
  // ── Scheduling ────────────────────────────────────────────────────────────
  _schedule() {
    if (this._dirty) return;
    this._dirty = true;
    this._raf = requestAnimationFrame(() => this._flush());
  }
  _flush() {
    this._dirty = false;
    if (!this._destroyed) {
      this._build();
      this._mounted = true;
    }
  }
  _destroyed = false;
  // ── Lifecycle ─────────────────────────────────────────────────────────────
  /** Force an immediate re-render. */
  refresh() {
    this._build();
    return this;
  }
  /** Remove from DOM and clean up. Safe to call multiple times. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    this._cleanup.forEach((fn) => fn());
    this._cleanup.length = 0;
    this.el.parentElement?.removeChild(this.el);
  }
  // ── Events ────────────────────────────────────────────────────────────────
  on(type, cb) {
    if (!this._bus.has(type)) this._bus.set(type, /* @__PURE__ */ new Set());
    this._bus.get(type).add(cb);
    return this;
  }
  off(type, cb) {
    this._bus.get(type)?.delete(cb);
    return this;
  }
  _emit(type, detail, ev) {
    this._bus.get(type)?.forEach((cb) => cb(detail, ev));
  }
  // ── DOM helpers ───────────────────────────────────────────────────────────
  /** Create an element, optionally set class and append to parent. */
  _el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  /** Add a DOM listener that auto-removes on destroy(). */
  _on(target, type, cb, opts) {
    target.addEventListener(type, cb, opts);
    this._cleanup.push(
      () => target.removeEventListener(type, cb, opts)
    );
  }
  /** Register a cleanup callback. */
  _gc(fn) {
    this._cleanup.push(fn);
  }
  // ── State proxy ───────────────────────────────────────────────────────────
  /** Reactive state proxy — read/write props as plain object. */
  get _state() {
    return {
      State: this._props,
      Set: (k, v) => this._set(k, v)
    };
  }
  // ── Lifecycle flags ───────────────────────────────────────────────────────
  /** True after first _build() completes. */
  _mounted = false;
  // ── Fire (alias emit) ─────────────────────────────────────────────────────
  /** Alias of _emit — for Golem API compatibility. */
  _fire(type, detail, ev) {
    this._emit(type, detail, ev);
  }
  // ── Listen helper ─────────────────────────────────────────────────────────
  /** Add a typed DOM listener with auto-cleanup. */
  _listen(target, type, cb, opts) {
    target.addEventListener(type, cb, opts);
    this._cleanup.push(
      () => target.removeEventListener(type, cb, opts)
    );
  }
  // ── onDestroy ─────────────────────────────────────────────────────────────
  /** Register cleanup — alias of _gc. */
  _onDestroy(fn) {
    this._gc(fn);
  }
  // ── Public get<T> ─────────────────────────────────────────────────────────
  /** Read a prop by string key (public). */
  get(key, fallback) {
    return this._props[key] ?? fallback;
  }
};

// components/core/Theme.ts
var DARK = {
  "--ar-bg": "#0d0d0d",
  "--ar-bg2": "#161616",
  "--ar-bg3": "#1e1e1e",
  "--ar-bg4": "#252525",
  "--ar-border": "#2a2a2a",
  "--ar-border2": "#333",
  "--ar-text": "#e0e0e0",
  "--ar-muted": "#888",
  "--ar-dim": "#444",
  "--ar-primary": "#7eb8f7",
  "--ar-primary-text": "#000",
  "--ar-success": "#4caf50",
  "--ar-warning": "#ff9800",
  "--ar-danger": "#f44336",
  "--ar-info": "#4dd0e1",
  "--ar-radius": "5px",
  "--ar-radius-sm": "3px",
  "--ar-radius-lg": "10px",
  "--ar-shadow": "0 2px 8px rgba(0,0,0,.4)",
  "--ar-shadow-lg": "0 8px 32px rgba(0,0,0,.6)",
  "--ar-font": 'ui-monospace,"Cascadia Code",monospace',
  "--ar-font-mono": 'ui-monospace,"Cascadia Code",monospace',
  "--ar-font-size": "13px",
  "--ar-transition": ".14s ease"
};
var LIGHT = {
  "--ar-bg": "#ffffff",
  "--ar-bg2": "#f5f5f5",
  "--ar-bg3": "#eeeeee",
  "--ar-bg4": "#e0e0e0",
  "--ar-border": "#d0d0d0",
  "--ar-border2": "#bdbdbd",
  "--ar-text": "#1a1a1a",
  "--ar-muted": "#666",
  "--ar-dim": "#999",
  "--ar-primary": "#1565c0",
  "--ar-primary-text": "#ffffff",
  "--ar-success": "#2e7d32",
  "--ar-warning": "#e65100",
  "--ar-danger": "#c62828",
  "--ar-info": "#00838f",
  "--ar-radius": "5px",
  "--ar-radius-sm": "3px",
  "--ar-radius-lg": "10px",
  "--ar-shadow": "0 2px 8px rgba(0,0,0,.12)",
  "--ar-shadow-lg": "0 8px 32px rgba(0,0,0,.18)",
  "--ar-font": "system-ui,sans-serif",
  "--ar-font-mono": "ui-monospace,monospace",
  "--ar-font-size": "13px",
  "--ar-transition": ".14s ease"
};
var Theme = {
  dark: DARK,
  light: LIGHT,
  /**
   * Apply theme tokens to an element (default: document.documentElement).
   *
   * @example
   *   Theme.apply('dark');
   *   Theme.apply('light', document.querySelector('#panel'));
   */
  apply(mode, target = document.documentElement) {
    const tokens = mode === "light" ? LIGHT : mode === "auto" ? window.matchMedia("(prefers-color-scheme: light)").matches ? LIGHT : DARK : DARK;
    Object.entries(tokens).forEach(([k, v]) => target.style.setProperty(k, v ?? null));
    target.dataset.arTheme = mode;
  },
  /**
   * Extend / override specific tokens on a target element.
   *
   * @example
   *   Theme.extend({ '--ar-primary': '#ff6b6b', '--ar-radius': '8px' });
   */
  extend(tokens, target = document.documentElement) {
    Object.entries(tokens).forEach(([k, v]) => target.style.setProperty(k, v ?? null));
  },
  /**
   * Inject the shared base CSS required by all controls.
   * Call once at app startup.
   */
  inject() {
    if (document.getElementById("arianna-wip-base-css")) return;
    const s = document.createElement("style");
    s.id = "arianna-wip-base-css";
    s.textContent = `
*, *::before, *::after { box-sizing: border-box; }
.ar-ctrl { font-family: var(--ar-font); font-size: var(--ar-font-size); color: var(--ar-text); }
.ar-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--ar-bg3); border: 1px solid var(--ar-border); border-radius: var(--ar-radius);
  color: var(--ar-text); cursor: pointer; font: inherit; font-size: .82rem;
  padding: 5px 14px; transition: background var(--ar-transition), border-color var(--ar-transition);
  user-select: none; white-space: nowrap;
}
.ar-btn:hover:not(:disabled) { background: var(--ar-bg4); border-color: var(--ar-border2); }
.ar-btn--primary { background: var(--ar-primary); border-color: var(--ar-primary); color: var(--ar-primary-text); }
.ar-btn--primary:hover:not(:disabled) { filter: brightness(1.1); }
.ar-btn:disabled { opacity: .4; cursor: not-allowed; }
.ar-input {
  background: var(--ar-bg3); border: 1px solid var(--ar-border); border-radius: var(--ar-radius);
  color: var(--ar-text); font: inherit; font-size: .82rem; outline: none;
  padding: 5px 10px; transition: border-color var(--ar-transition); width: 100%;
}
.ar-input:focus { border-color: var(--ar-primary); }
.ar-input:disabled { opacity: .5; cursor: not-allowed; }
`;
    document.head.appendChild(s);
  }
};

// components/data/TreeView.ts
var TreeView = class extends Control {
  _roots = [];
  _map = /* @__PURE__ */ new Map();
  _focus = null;
  _q = "";
  _list;
  constructor(container = null, opts = {}) {
    super(container, "div", {
      selectable: "single",
      icons: true,
      badges: true,
      indent: 20,
      rowHeight: 32,
      keyboard: true,
      search: true,
      draggable: false,
      checkboxes: false,
      expandOnSelect: false,
      ...opts
    });
    this.el.className = `ar-tree${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("role", "tree");
    this.el.tabIndex = 0;
  }
  set nodes(v) {
    this._roots = [];
    this._map.clear();
    this._roots = v.map((n) => this._ns(n, null, 0));
    this._build();
  }
  get nodes() {
    return this._roots.map((s) => s.node);
  }
  expand(id) {
    const s = this._map.get(id);
    if (s && !s.expanded) this._expand(s);
  }
  collapse(id) {
    const s = this._map.get(id);
    if (s && s.expanded) this._collapse(s);
  }
  expandAll() {
    this._map.forEach((s) => {
      if (!s.expanded) this._expand(s);
    });
  }
  collapseAll() {
    this._map.forEach((s) => {
      if (s.expanded) this._collapse(s);
    });
  }
  select(id) {
    const s = this._map.get(id);
    if (!s || s.node.selectable === false) return;
    if (this._get("selectable", "single") === "single") this._clearSel();
    this._setSel(s, true);
  }
  deselect(id) {
    const s = this._map.get(id);
    if (s) this._setSel(s, false);
  }
  getSelected() {
    return [...this._map.values()].filter((s) => s.selected).map((s) => s.node);
  }
  check(id, v = true) {
    const s = this._map.get(id);
    if (s) this._setChecked(s, v);
  }
  getChecked() {
    return [...this._map.values()].filter((s) => s.checked).map((s) => s.node);
  }
  search(q) {
    this._q = q.toLowerCase().trim();
    this._applyFilter();
  }
  _build() {
    this.el.innerHTML = "";
    const opts = this._state.State;
    if (opts.search) {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "ar-tree__search";
      inp.placeholder = "Search\u2026";
      inp.value = this._q;
      inp.addEventListener("input", () => {
        this._q = inp.value.toLowerCase().trim();
        this._applyFilter();
      });
      this.el.appendChild(inp);
    }
    this._list = this._el("ul", "ar-tree__list", this.el);
    this._list.setAttribute("role", "group");
    this._roots.forEach((s) => this._renderNode(s, this._list));
    if (opts.keyboard) this._on(this.el, "keydown", (e) => this._onKey(e));
  }
  _renderNode(s, parent) {
    const opts = this._state.State;
    const hasChildren = (s.node.children?.length ?? 0) > 0 || s.node.lazy;
    const li = this._el("li", "ar-tree__node", parent);
    li.setAttribute("role", "treeitem");
    li.setAttribute("aria-expanded", String(s.expanded));
    li.setAttribute("aria-selected", String(s.selected));
    li.dataset.id = s.node.id;
    if (s.node.class) li.classList.add(...s.node.class.split(" "));
    s.el = li;
    const row = this._el("div", `ar-tree__row${s.selected ? " ar-tree__row--on" : ""}`, li);
    row.style.paddingLeft = s.depth * (opts.indent ?? 20) + 8 + "px";
    row.style.height = (opts.rowHeight ?? 32) + "px";
    const arrow = this._el("span", "ar-tree__arrow", row);
    if (hasChildren) {
      arrow.textContent = s.loading ? "\u27F3" : s.expanded ? "\u25BE" : "\u25B8";
      arrow.addEventListener("click", (e) => {
        e.stopPropagation();
        s.expanded ? this._collapse(s) : this._expand(s);
      });
    }
    if (opts.checkboxes) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "ar-tree__cb";
      cb.checked = s.checked;
      cb.addEventListener("change", () => this._setChecked(s, cb.checked));
      row.appendChild(cb);
    }
    if (opts.icons && s.node.icon) this._el("span", "ar-tree__icon", row).textContent = s.node.icon;
    this._el("span", "ar-tree__label", row).textContent = s.node.label;
    if (opts.badges && s.node.badge !== void 0) this._el("span", "ar-tree__badge", row).textContent = String(s.node.badge);
    if (s.node.selectable !== false) {
      row.addEventListener("click", (e) => {
        const mode = this._get("selectable", "single");
        if (mode === "none") return;
        if (mode === "single") this._clearSel();
        this._setSel(s, !s.selected);
        if (opts.expandOnSelect && hasChildren) s.expanded ? this._collapse(s) : this._expand(s);
        this._focus = s;
        this._emit("select", { node: s.node, selected: s.selected }, e);
      });
    }
    if (opts.draggable) this._drag(s, li, row);
    if (hasChildren) {
      const ul = this._el("ul", "ar-tree__children", li);
      ul.setAttribute("role", "group");
      ul.style.display = s.expanded ? "" : "none";
      if (s.expanded && s.loaded) s.children.forEach((c) => this._renderNode(c, ul));
    }
  }
  _expand(s) {
    if (s.node.lazy && !s.loaded) {
      s.loading = true;
      this._updateRow(s);
      let resolved = false;
      this._emit("load", { node: s.node, resolve: (children) => {
        if (resolved) return;
        resolved = true;
        s.children = children.map((c) => this._ns(c, s, s.depth + 1));
        s.node.children = children;
        s.loaded = true;
        s.loading = false;
        s.expanded = true;
        this._updateRow(s);
        this._emit("expand", { node: s.node });
      } });
      return;
    }
    s.expanded = true;
    this._updateRow(s);
    this._emit("expand", { node: s.node });
  }
  _collapse(s) {
    s.expanded = false;
    this._updateRow(s);
    this._emit("collapse", { node: s.node });
  }
  _updateRow(s) {
    if (!s.el) return;
    const li = s.el;
    const opts = this._state.State;
    const hasChildren = (s.node.children?.length ?? 0) > 0 || s.node.lazy;
    li.setAttribute("aria-expanded", String(s.expanded));
    const oldRow = li.querySelector(".ar-tree__row");
    if (oldRow) oldRow.remove();
    const row = this._el("div", `ar-tree__row${s.selected ? " ar-tree__row--on" : ""}`, li);
    row.style.paddingLeft = s.depth * (opts.indent ?? 20) + 8 + "px";
    row.style.height = (opts.rowHeight ?? 32) + "px";
    if (li.firstChild && li.firstChild !== row) li.insertBefore(row, li.firstChild);
    const arrow = this._el("span", "ar-tree__arrow", row);
    if (hasChildren) {
      arrow.textContent = s.loading ? "\u27F3" : s.expanded ? "\u25BE" : "\u25B8";
      arrow.addEventListener("click", (e) => {
        e.stopPropagation();
        s.expanded ? this._collapse(s) : this._expand(s);
      });
    }
    if (opts.icons && s.node.icon) this._el("span", "ar-tree__icon", row).textContent = s.node.icon;
    this._el("span", "ar-tree__label", row).textContent = s.node.label;
    if (opts.badges && s.node.badge !== void 0) this._el("span", "ar-tree__badge", row).textContent = String(s.node.badge);
    row.addEventListener("click", (e) => {
      if (s.node.selectable === false) return;
      const mode = this._get("selectable", "single");
      if (mode === "none") return;
      if (mode === "single") this._clearSel();
      this._setSel(s, !s.selected);
      this._emit("select", { node: s.node, selected: s.selected }, e);
    });
    let ul = li.querySelector(".ar-tree__children");
    if (!ul && hasChildren) {
      ul = this._el("ul", "ar-tree__children");
      ul.setAttribute("role", "group");
      li.appendChild(ul);
    }
    if (ul) {
      if (s.expanded) {
        ul.style.display = "";
        if (s.loaded && !ul.children.length) s.children.forEach((c) => this._renderNode(c, ul));
      } else ul.style.display = "none";
    }
  }
  _clearSel() {
    this._map.forEach((s) => {
      if (s.selected) this._setSel(s, false);
    });
  }
  _setSel(s, v) {
    s.selected = v;
    if (!s.el) return;
    const row = s.el.querySelector(".ar-tree__row");
    if (row) {
      if (v) row.classList.add("ar-tree__row--on");
      else row.classList.remove("ar-tree__row--on");
    }
    s.el.setAttribute("aria-selected", String(v));
  }
  _setChecked(s, v) {
    s.checked = s.node.checked = v;
    const cb = s.el?.querySelector(".ar-tree__cb");
    if (cb) cb.checked = v;
    this._emit("check", { node: s.node, checked: v });
  }
  _applyFilter() {
    const q = this._q;
    this._map.forEach((s) => {
      if (s.el) s.el.style.display = q ? s.node.label.toLowerCase().includes(q) ? "" : "none" : "";
    });
    if (q) this._map.forEach((s) => {
      if (s.node.label.toLowerCase().includes(q)) {
        let p = s.parent;
        while (p) {
          if (p.el) p.el.style.display = "";
          p = p.parent;
        }
      }
    });
  }
  _visible() {
    const out = [];
    const walk = (nodes) => {
      for (const s of nodes) {
        if (s.el?.style.display === "none") continue;
        out.push(s);
        if (s.expanded && s.children.length) walk(s.children);
      }
    };
    walk(this._roots);
    return out;
  }
  _onKey(e) {
    const vis = this._visible();
    const idx = this._focus ? vis.indexOf(this._focus) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = vis[idx + 1];
      if (n) {
        this._focus = n;
        n.el?.focus();
      }
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const n = vis[idx - 1];
      if (n) {
        this._focus = n;
        n.el?.focus();
      }
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (this._focus && !this._focus.expanded) this._expand(this._focus);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (this._focus?.expanded) this._collapse(this._focus);
      else if (this._focus?.parent) {
        this._focus = this._focus.parent;
        this._focus.el?.focus();
      }
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (this._focus) {
        const mode = this._get("selectable", "single");
        if (mode !== "none") {
          if (mode === "single") this._clearSel();
          this._setSel(this._focus, !this._focus.selected);
          this._emit("select", { node: this._focus.node, selected: this._focus.selected });
        }
      }
    }
  }
  _drag(s, li, row) {
    li.draggable = true;
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", s.node.id);
      li.classList.add("ar-tree__node--drag");
    });
    li.addEventListener("dragend", () => li.classList.remove("ar-tree__node--drag"));
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("ar-tree__row--drop");
    });
    row.addEventListener("dragleave", () => row.classList.remove("ar-tree__row--drop"));
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("ar-tree__row--drop");
      const src = e.dataTransfer?.getData("text/plain");
      if (src && src !== s.node.id) this._emit("drop", { sourceId: src, targetId: s.node.id });
    });
  }
  _ns(node, parent, depth) {
    const s = { node, expanded: node.expanded ?? false, selected: node.selected ?? false, checked: node.checked ?? false, loading: false, loaded: !node.lazy, depth, parent, children: [] };
    this._map.set(node.id, s);
    if (node.children) s.children = node.children.map((c) => this._ns(c, s, depth + 1));
    return s;
  }
};
var TreeViewCSS = `
.ar-tree{background:transparent;font-size:.82rem;outline:none;overflow-y:auto;user-select:none}
.ar-tree__search{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);box-sizing:border-box;color:var(--ar-text);font:inherit;font-size:.82rem;margin:4px 8px;outline:none;padding:4px 8px;width:calc(100% - 16px)}
.ar-tree__search:focus{border-color:var(--ar-primary)}
.ar-tree__list,.ar-tree__children{list-style:none;margin:0;padding:0}
.ar-tree__row{align-items:center;border-radius:4px;box-sizing:border-box;cursor:pointer;display:flex;gap:6px;transition:background var(--ar-transition)}
.ar-tree__row:hover{background:var(--ar-bg3)}
.ar-tree__row--on{background:var(--ar-primary)!important;color:var(--ar-primary-text)}
.ar-tree__arrow{color:var(--ar-muted);flex-shrink:0;font-size:.7rem;text-align:center;width:14px}
.ar-tree__icon{flex-shrink:0}
.ar-tree__label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ar-tree__badge{background:var(--ar-warning);border-radius:8px;color:#000;flex-shrink:0;font-size:.65rem;padding:1px 5px}
.ar-tree__node--drag{opacity:.4}
.ar-tree__row--drop{outline:2px dashed var(--ar-primary)}
`;

// components/data/Table.ts
var LRUCache = class {
  _map = /* @__PURE__ */ new Map();
  _cap;
  constructor(capacity) {
    this._cap = capacity;
  }
  get(key) {
    if (!this._map.has(key)) return void 0;
    const v = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, v);
    return v;
  }
  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._cap) this._map.delete(this._map.keys().next().value);
    this._map.set(key, value);
  }
  clear() {
    this._map.clear();
  }
};
var WORKER_SRC = `
self.onmessage = function(e) {
  const { rows, sort, filter, columnFilters, columns } = e.data;
  let result = rows.slice();

  // Global filter
  if (filter) {
    const q = filter.toLowerCase();
    result = result.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }

  // Column filters
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, val]) => {
      if (!val) return;
      const q = val.toLowerCase();
      result = result.filter(row => String(row[key] ?? '').toLowerCase().includes(q));
    });
  }

  // Sort
  if (sort && sort.key) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    result.sort((a: R, b: R) => {
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      if (av < bv) return -dir;
      if (av > bv) return  dir;
      return 0;
    });
  }

  self.postMessage({ rows: result, total: result.length });
};
`;
var Table = class extends Control {
  _expandedRows = /* @__PURE__ */ new Set();
  _renderRows() {
    this._renderBody();
  }
  _build() {
    this._renderBody();
  }
  /** Full client-side dataset. */
  _data = [];
  /** Currently visible rows (after sort+filter). */
  _rows = [];
  /** Total row count (for server-side). */
  _total = 0;
  /** Current page (1-indexed). */
  _page = 1;
  /** Current page size. */
  _pageSize;
  /** Current sort state. */
  _sort;
  /** Current global filter. */
  _filter = "";
  /** Current column filters. */
  _colFilters = {};
  /** Selected row indices (by row reference). */
  _selected = /* @__PURE__ */ new Set();
  /** Loading state. */
  _loading = false;
  /** Web Worker instance. */
  _worker;
  /** Pending worker resolve. */
  _workerResolve;
  /** LRU page cache. */
  _cache;
  /** Column resize state. */
  _resizeCol;
  /** DOM refs. */
  _dom = {};
  // ── Constructor ─────────────────────────────────────────────────────────────
  constructor(container = null, options) {
    super(container, "div", {
      paging: { pageSize: 25, sizes: [10, 25, 50, 100] },
      selectable: "none",
      checkboxes: false,
      worker: false,
      cache: false,
      cacheSize: 20,
      searchable: true,
      columnFilters: false,
      columnToggle: false,
      resizable: false,
      stickyHeader: true,
      info: true,
      exportCsv: false,
      emptyText: "No data",
      loadingText: "Loading\u2026",
      ...options
    });
    this.el.className = `arianna-table-wrap${options.class ? " " + options.class : ""}`;
    const paging = this.get("paging");
    this._pageSize = paging ? paging.pageSize ?? 25 : Infinity;
    this._page = paging ? paging.page ?? 1 : 1;
    if (this.get("worker") && !this.get("fetch")) {
      const blob = new Blob([WORKER_SRC], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      this._worker = new Worker(url);
      this._worker.onmessage = (e) => {
        if (this._workerResolve) {
          this._workerResolve(e.data.rows);
          this._total = e.data.total;
          this._workerResolve = void 0;
        }
      };
      this._onDestroy(() => {
        this._worker?.terminate();
        URL.revokeObjectURL(url);
      });
    }
    if (this.get("cache") && this.get("fetch")) {
      this._cache = new LRUCache(this.get("cacheSize") ?? 20);
    }
  }
  // ── Data ────────────────────────────────────────────────────────────────────
  /**
   * Load client-side data.
   * Triggers a re-render if mounted.
   *
   * @example
   *   table.load(myRows);
   */
  load(data) {
    this._data = data;
    this._total = data.length;
    this._page = 1;
    if (this._mounted) this._process().then(() => this._renderBody());
    return this;
  }
  /**
   * Append rows to client-side data.
   */
  append(rows) {
    this._data.push(...rows);
    this._total = this._data.length;
    if (this._mounted) this._process().then(() => this._renderBody());
    return this;
  }
  /**
   * Clear all data.
   */
  clear() {
    this._data = [];
    this._rows = [];
    this._total = 0;
    this._page = 1;
    if (this._mounted) this._renderBody();
    return this;
  }
  /**
   * Reload data — re-triggers fetch (server-side) or re-processes (client-side).
   */
  reload() {
    this._page = 1;
    if (this._mounted) this._load();
    return this;
  }
  /**
   * Invalidate the cache and reload.
   */
  invalidateCache() {
    this._cache?.clear();
    return this.reload();
  }
  // ── Selection ────────────────────────────────────────────────────────────────
  /**
   * Get all selected rows.
   */
  getSelected() {
    return [...this._selected];
  }
  /**
   * Clear selection.
   */
  clearSelection() {
    this._selected.clear();
    this._dom.tbody?.querySelectorAll("tr.selected").forEach((r) => r.classList.remove("selected"));
    return this;
  }
  // ── Export ───────────────────────────────────────────────────────────────────
  /**
   * Export current view to CSV and trigger download.
   */
  exportToCsv(filename = "export.csv") {
    const cols = this.get("columns") ?? [].filter((c) => c.visible !== false);
    const header = cols.map((c) => JSON.stringify(c.label)).join(",");
    const rowLines = this._rows.map(
      (row) => cols.map((c) => {
        const v = c.value ? c.value(row) : row[c.key];
        return JSON.stringify(String(v ?? ""));
      }).join(",")
    );
    const csv = [header, ...rowLines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  // ── Render ───────────────────────────────────────────────────────────────────
  _render() {
    this.el.innerHTML = "";
    const opts = this._state.State;
    this._dom.toolbar = this._el("div", "arianna-wip-table__toolbar", this.el);
    this._buildToolbar();
    const tableWrap = this._el("div", "arianna-wip-table__scroll", this.el);
    this._dom.table = document.createElement("table");
    this._dom.table.className = "arianna-wip-table";
    this._dom.table.setAttribute("role", "grid");
    tableWrap.appendChild(this._dom.table);
    this._dom.thead = this._dom.table.createTHead();
    this._dom.tbody = this._dom.table.createTBody();
    this._buildHeader();
    this._dom.empty = this._el("div", "arianna-wip-table__empty", this.el);
    this._dom.empty.textContent = opts.emptyText ?? "No data";
    this._dom.empty.style.display = "none";
    this._dom.spinner = this._el("div", "arianna-wip-table__spinner", this.el);
    this._dom.spinner.textContent = opts.loadingText ?? "Loading\u2026";
    this._dom.spinner.style.display = "none";
    this._dom.footer = this._el("div", "arianna-wip-table__footer", this.el);
    this._dom.info = this._el("span", "arianna-wip-table__info", this._dom.footer);
    this._dom.pager = this._el("div", "arianna-wip-table__pager", this._dom.footer);
    this._load();
  }
  _buildToolbar() {
    const opts = this._state.State;
    const tb = this._dom.toolbar;
    if (opts.searchable) {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Search\u2026";
      input.className = "arianna-wip-table__search";
      input.value = this._filter;
      this._listen(input, "input", () => {
        this._filter = input.value;
        this._page = 1;
        this._load();
      });
      tb.appendChild(input);
    }
    if (opts.exportCsv) {
      const btn = document.createElement("button");
      btn.className = "arianna-wip-table__btn";
      btn.textContent = "\u2193 CSV";
      btn.addEventListener("click", () => this.exportToCsv());
      tb.appendChild(btn);
    }
    if (opts.columnToggle) {
      const btn = document.createElement("button");
      btn.className = "arianna-wip-table__btn";
      btn.textContent = "\u229E Columns";
      btn.addEventListener("click", () => this._showColumnToggle(btn));
      tb.appendChild(btn);
    }
  }
  _buildHeader() {
    const opts = this._state.State;
    const tr = this._dom.thead.insertRow();
    tr.setAttribute("role", "row");
    if (opts.checkboxes && opts.selectable === "multi") {
      const th = document.createElement("th");
      th.className = "arianna-wip-table__th arianna-wip-table__th--check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.addEventListener("change", () => {
        if (cb.checked) this._rows.forEach((r) => this._selected.add(r));
        else this._selected.clear();
        this._renderBody();
      });
      th.appendChild(cb);
      tr.appendChild(th);
    }
    (opts.columns ?? []).filter((c) => c.visible !== false).forEach((col) => {
      const th = document.createElement("th");
      th.className = `arianna-table__th ${col.headerClass ?? ""}`;
      th.setAttribute("role", "columnheader");
      th.setAttribute("aria-sort", "none");
      th.style.width = col.width ? typeof col.width === "number" ? col.width + "px" : col.width : "";
      if (col.align) th.style.textAlign = col.align;
      const inner = this._el("div", "arianna-wip-table__th-inner", th);
      if (col.renderHeader) {
        const h = col.renderHeader(col);
        if (typeof h === "string") inner.innerHTML = h;
        else inner.appendChild(h);
      } else {
        inner.textContent = col.label;
      }
      if (col.sortable) {
        th.classList.add("arianna-wip-table__th--sortable");
        const arrow = this._el("span", "arianna-wip-table__sort-arrow", inner);
        arrow.textContent = this._sort?.key === col.key ? this._sort.dir === "asc" ? "\u2191" : "\u2193" : "\u2195";
        th.addEventListener("click", () => this._toggleSort(col));
      }
      if (opts.resizable && col.resizable !== false) {
        const handle = this._el("div", "arianna-wip-table__resize-handle", th);
        this._listen(handle, "mousedown", (e) => {
          this._resizeCol = {
            col,
            startX: e.clientX,
            startW: th.offsetWidth
          };
        });
      }
      if (opts.columnFilters && col.filterable) {
        const fi = document.createElement("input");
        fi.type = "text";
        fi.placeholder = "\u2026";
        fi.className = "arianna-wip-table__col-filter";
        fi.value = this._colFilters[col.key] ?? "";
        fi.addEventListener("input", () => {
          this._colFilters[col.key] = fi.value;
          this._page = 1;
          this._load();
        });
        fi.addEventListener("click", (e) => e.stopPropagation());
        th.appendChild(fi);
      }
      tr.appendChild(th);
    });
    this._listen(document, "mousemove", (e) => {
      if (!this._resizeCol) return;
      const dx = e.clientX - this._resizeCol.startX;
      const min = this._resizeCol.col.minWidth ?? 60;
      const w = Math.max(min, this._resizeCol.startW + dx);
      const idx = (opts.columns ?? []).findIndex((c) => c.key === this._resizeCol.col.key);
      const th = this._dom.thead.rows[0]?.cells[idx];
      if (th) th.style.width = w + "px";
      this._resizeCol.col.width = w;
    });
    this._listen(document, "mouseup", () => {
      this._resizeCol = void 0;
    });
  }
  _renderBody() {
    const opts = this._state.State;
    const tbody = this._dom.tbody;
    tbody.innerHTML = "";
    if (this._loading) {
      this._dom.spinner.style.display = "";
      this._dom.empty.style.display = "none";
      this._renderFooter();
      return;
    }
    this._dom.spinner.style.display = "none";
    if (!this._rows.length) {
      this._dom.empty.style.display = "";
      this._renderFooter();
      return;
    }
    this._dom.empty.style.display = "none";
    this._rows.forEach((row, ri) => {
      const tr = tbody.insertRow();
      tr.setAttribute("role", "row");
      if (this._selected.has(row)) tr.classList.add("selected");
      if (opts.expandable) {
        const td = tr.insertCell();
        td.className = "ar-table__td ar-table__td--exp";
        const btn = document.createElement("button");
        btn.className = "ar-table__exp-btn";
        const idx2 = ri;
        btn.innerHTML = this._expandedRows.has(idx2) ? "\u25BE" : "\u25B8";
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (this._expandedRows.has(idx2)) {
            this._expandedRows.delete(idx2);
            this._emit("collapse", { row, index: idx2 });
          } else {
            if (opts.expandSingle) this._expandedRows.clear();
            this._expandedRows.add(idx2);
            this._emit("expand", { row, index: idx2 });
          }
          this._renderRows();
          if (this._expandedRows.has(idx2) && opts.rowContent) {
            const detailRow = tbody.querySelector(`[data-exp-detail="${idx2}"]`);
            if (detailRow) {
              const cell = detailRow.querySelector("td");
              if (cell) {
                cell.innerHTML = '<span style="color:var(--ar-muted);font-size:.8rem">Loading\u2026</span>';
                const content = await opts.rowContent(row);
                if (typeof content === "string") cell.innerHTML = content;
                else {
                  cell.innerHTML = "";
                  cell.appendChild(content);
                }
              }
            }
          }
        });
        td.appendChild(btn);
      }
      tr.addEventListener("click", (e) => {
        const mode = opts.selectable;
        if (mode === "none") {
          opts.onRowClick?.(row, e);
          return;
        }
        if (mode === "single") {
          this._selected.clear();
        }
        if (this._selected.has(row)) this._selected.delete(row);
        else this._selected.add(row);
        this._renderBody();
        this._fire("select", { rows: this.getSelected(), row });
        opts.onRowClick?.(row, e);
      });
      if (opts.checkboxes && opts.selectable === "multi") {
        const td = tr.insertCell();
        td.className = "arianna-wip-table__td arianna-wip-table__td--check";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = this._selected.has(row);
        cb.addEventListener("change", (e) => {
          e.stopPropagation();
          if (cb.checked) this._selected.add(row);
          else this._selected.delete(row);
          if (cb.checked) tr.classList.add("selected");
          else tr.classList.remove("selected");
          this._fire("select", { rows: this.getSelected(), row });
        });
        td.appendChild(cb);
      }
      (opts.columns ?? []).filter((c) => c.visible !== false).forEach((col) => {
        const td = tr.insertCell();
        td.className = `arianna-table__td ${col.class ?? ""}`;
        td.setAttribute("role", "gridcell");
        if (col.align) td.style.textAlign = col.align;
        const v = col.value ? col.value(row) : row[col.key];
        if (col.render) {
          const r = col.render(v, row, col);
          if (typeof r === "string") td.innerHTML = r;
          else td.appendChild(r);
        } else {
          td.textContent = String(v ?? "");
        }
      });
    });
    this._renderFooter();
  }
  _renderFooter() {
    const opts = this._state.State;
    const paging = opts.paging;
    const info = this._dom.info;
    const pager = this._dom.pager;
    pager.innerHTML = "";
    if (opts.info) {
      if (paging) {
        const start2 = (this._page - 1) * this._pageSize + 1;
        const end2 = Math.min(this._page * this._pageSize, this._total);
        info.textContent = `${start2}\u2013${end2} of ${this._total}`;
      } else {
        info.textContent = `${this._total} rows`;
      }
    }
    if (!paging || this._total <= this._pageSize) return;
    const totalPages = Math.ceil(this._total / this._pageSize);
    if (paging.sizes && paging.sizes.length > 1) {
      const sel = document.createElement("select");
      sel.className = "arianna-wip-table__page-size";
      paging.sizes.forEach((s) => {
        const o = document.createElement("option");
        o.value = String(s);
        o.textContent = `${s} / page`;
        if (s === this._pageSize) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => {
        this._pageSize = Number(sel.value);
        this._page = 1;
        this._load();
      });
      pager.appendChild(sel);
    }
    this._pageBtn(pager, "\u2039", this._page > 1, () => {
      this._page--;
      this._load();
    });
    const half = 2;
    const start = Math.max(1, Math.min(this._page - half, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    for (let p = start; p <= end; p++) {
      this._pageBtn(
        pager,
        String(p),
        true,
        () => {
          this._page = p;
          this._load();
        },
        p === this._page
      );
    }
    this._pageBtn(pager, "\u203A", this._page < totalPages, () => {
      this._page++;
      this._load();
    });
    this._fire("page", { page: this._page, pageSize: this._pageSize, total: this._total });
  }
  _pageBtn(parent, label, enabled, onClick, active = false) {
    const btn = document.createElement("button");
    btn.className = `arianna-table__page-btn${active ? " active" : ""}`;
    btn.textContent = label;
    btn.disabled = !enabled;
    btn.addEventListener("click", onClick);
    parent.appendChild(btn);
  }
  // ── Data processing ──────────────────────────────────────────────────────────
  async _load() {
    const fetchFn = this.get("fetch");
    if (fetchFn) {
      await this._fetchRemote(fetchFn);
    } else {
      await this._processLocal();
    }
    this._renderBody();
  }
  async _fetchRemote(fetchFn) {
    const cacheKey = JSON.stringify({
      page: this._page,
      pageSize: this._pageSize,
      sort: this._sort,
      filter: this._filter,
      colFilters: this._colFilters
    });
    if (this._cache) {
      const cached = this._cache.get(cacheKey);
      if (cached) {
        this._rows = cached.rows;
        this._total = cached.total;
        return;
      }
    }
    this._loading = true;
    this._renderBody();
    try {
      const result = await fetchFn({
        page: this._page,
        pageSize: this._pageSize,
        sort: this._sort,
        filter: this._filter,
        filters: this._colFilters
      });
      this._rows = result.rows;
      this._total = result.total;
      this._cache?.set(cacheKey, result);
      this._fire("load", { rows: this._rows, total: this._total });
    } catch (err) {
      this._fire("error", { error: err });
    } finally {
      this._loading = false;
    }
  }
  async _processLocal() {
    const paging = this.get("paging");
    const opts = this._state.State;
    if (this._worker && this._worker) {
      await this._processWithWorker();
    } else {
      this._processSync();
    }
    if (paging) {
      const start = (this._page - 1) * this._pageSize;
      this._rows = this._rows.slice(start, start + this._pageSize);
    }
    this._fire("load", { rows: this._rows, total: this._total });
  }
  _processSync() {
    const opts = this._state.State;
    let rows = this._data.slice();
    if (this._filter) {
      const q = this._filter.toLowerCase();
      rows = rows.filter(
        (row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }
    Object.entries(this._colFilters).forEach(([key, val]) => {
      if (!val) return;
      const q = val.toLowerCase();
      rows = rows.filter((row) => String(row[key] ?? "").toLowerCase().includes(q));
    });
    if (this._sort) {
      const { key, dir } = this._sort;
      const col = (opts.columns ?? []).find((c) => c.key === key);
      const d = dir === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        if (col?.sort) return col.sort(a, b, dir);
        const av = col?.value ? col.value(a) : a[key] ?? "";
        const bv = col?.value ? col.value(b) : b[key] ?? "";
        return av < bv ? -d : av > bv ? d : 0;
      });
    }
    this._total = rows.length;
    this._rows = rows;
  }
  _processWithWorker() {
    return new Promise((resolve) => {
      this._workerResolve = (rows) => {
        this._rows = rows;
        resolve();
      };
      this._worker.postMessage({
        rows: this._data,
        sort: this._sort,
        filter: this._filter,
        columnFilters: this._colFilters,
        columns: this.get("columns") ?? [].map((c) => ({ key: c.key }))
      });
    });
  }
  // ── Sort ─────────────────────────────────────────────────────────────────────
  _toggleSort(col) {
    if (!this._sort || this._sort.key !== col.key) {
      this._sort = { key: col.key, dir: "asc" };
    } else if (this._sort.dir === "asc") {
      this._sort = { key: col.key, dir: "desc" };
    } else {
      this._sort = void 0;
    }
    this._page = 1;
    this._rebuildHeader();
    this._load();
    this._fire("sort", { column: col, sort: this._sort });
  }
  _rebuildHeader() {
    this._dom.thead.innerHTML = "";
    this._buildHeader();
  }
  // ── Column toggle ────────────────────────────────────────────────────────────
  _showColumnToggle(anchor) {
    const existing = document.querySelector(".arianna-wip-table__col-menu");
    if (existing) {
      existing.remove();
      return;
    }
    const menu = document.createElement("div");
    menu.className = "arianna-wip-table__col-menu";
    const rect = anchor.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = rect.bottom + 4 + "px";
    menu.style.left = rect.left + "px";
    this.get("columns") ?? [].forEach((col) => {
      const row = document.createElement("label");
      row.className = "arianna-wip-table__col-menu-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = col.visible !== false;
      cb.addEventListener("change", () => {
        col.visible = cb.checked;
        this._rebuildHeader();
        this._renderBody();
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(" " + col.label));
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
    const close = (e) => {
      if (!menu.contains(e.target) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 10);
  }
  // ── Process ──────────────────────────────────────────────────────────────────
  async _process() {
    return this._processLocal();
  }
};

// components/layout/Accordion.ts
function renderIcon(style, open) {
  switch (style) {
    case "chevron":
      return `<span class="arianna-acc-icon" style="display:inline-block;transition:transform .25s;transform:rotate(${open ? 90 : 0}deg);color:var(--muted,#888);font-size:.85em;">\u203A</span>`;
    case "plus":
      return `<span class="arianna-acc-icon" style="display:inline-block;font-size:1.1em;font-weight:400;color:var(--muted,#888);">${open ? "\u2212" : "+"}</span>`;
    case "arrow":
      return `<span class="arianna-acc-icon" style="display:inline-block;transition:transform .25s;transform:rotate(${open ? 90 : 0}deg);color:var(--muted,#888);">\u2192</span>`;
    case "none":
    default:
      return "";
  }
}
var _accCounter = 0;
var Accordion = class {
  // ── Private fields ────────────────────────────────────────────────────────────
  #id;
  #obs;
  #opts;
  #items;
  #open;
  #el;
  // ── Constructor ───────────────────────────────────────────────────────────────
  /**
   * Create an Accordion.
   *
   * @param opts - Accordion configuration options.
   *
   * @example
   *   const acc = new Accordion({
   *     items   : [{ id: 'a', title: 'Section A', content: '<p>Content</p>' }],
   *     multiple: false,
   *     icon    : 'chevron',
   *     animated: true,
   *   });
   *   acc.append('#sidebar');
   */
  constructor(opts = {}) {
    this.#id = `arianna-acc-${++_accCounter}`;
    this.#obs = new Observable();
    this.#opts = {
      items: opts.items ?? [],
      multiple: opts.multiple ?? false,
      animated: opts.animated ?? true,
      icon: opts.icon ?? "chevron",
      borderless: opts.borderless ?? false
    };
    this.#items = this.#opts.items.map((i) => ({ open: false, disabled: false, ...i }));
    this.#open = new Set(this.#items.filter((i) => i.open && !i.disabled).map((i) => i.id));
    if (!this.#opts.multiple && this.#open.size > 1) {
      const first = [...this.#open][0];
      this.#open.clear();
      this.#open.add(first);
    }
    this.#el = document.createElement("div");
    this.#el.id = this.#id;
    this.#el.className = "arianna-wip-accordion";
    this.#el.setAttribute("role", "tablist");
    this.#el.style.cssText = "display:flex;flex-direction:column;width:100%;";
    this.#render();
    this.#wireEvents();
  }
  // ── Public API ─────────────────────────────────────────────────────────────────
  /**
   * Return the root accordion `HTMLElement`.
   *
   * @example
   *   document.body.appendChild(acc.render());
   */
  render() {
    return this.#el;
  }
  /** Implicit coercion to `HTMLElement`. */
  valueOf() {
    return this.#el;
  }
  /**
   * Mount the accordion into a parent element.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.append('#sidebar');
   *   acc.append(containerReal);
   */
  append(parent) {
    const par = typeof parent === "string" ? document.querySelector(parent) : parent instanceof Element ? parent : parent.render();
    if (par) par.appendChild(this.#el);
    return this;
  }
  /**
   * Open a panel by id. In single mode, closes all other panels first.
   * Fluent — returns `this`.
   *
   * @param id - Panel identifier.
   *
   * @example
   *   acc.open('intro');
   */
  open(id) {
    const item = this.#find(id);
    if (!item || item.disabled || this.#open.has(id)) return this;
    if (!this.#opts.multiple) this.#open.clear();
    this.#open.add(id);
    this.#update(id);
    this.#fire("Accordion-Open", id, item);
    return this;
  }
  /**
   * Close a panel by id.
   * Fluent — returns `this`.
   *
   * @param id - Panel identifier.
   *
   * @example
   *   acc.close('intro');
   */
  close(id) {
    const item = this.#find(id);
    if (!item || item.disabled || !this.#open.has(id)) return this;
    this.#open.delete(id);
    this.#update(id);
    this.#fire("Accordion-Close", id, item);
    return this;
  }
  /**
   * Toggle a panel open/closed by id.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.toggle('api');
   */
  toggle(id) {
    return this.#open.has(id) ? this.close(id) : this.open(id);
  }
  /**
   * Open all panels (switches to multiple mode temporarily if needed).
   * Fluent — returns `this`.
   *
   * @example
   *   acc.openAll();
   */
  openAll() {
    this.#items.forEach((item) => {
      if (!item.disabled) this.#open.add(item.id);
    });
    this.#render();
    return this;
  }
  /**
   * Close all panels.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.closeAll();
   */
  closeAll() {
    this.#open.clear();
    this.#render();
    return this;
  }
  /**
   * Check whether a panel is currently open.
   *
   * @example
   *   acc.isOpen('intro')  // → true | false
   */
  isOpen(id) {
    return this.#open.has(id);
  }
  /**
   * Return all currently open panel ids.
   *
   * @example
   *   acc.openItems()  // → ['api', 'usage']
   */
  openItems() {
    return [...this.#open];
  }
  /**
   * Add a new panel.
   * Fluent — returns `this`.
   *
   * @param item  - Panel definition.
   * @param index - Insertion index. Default: append at end.
   *
   * @example
   *   acc.addItem({ id: 'new', title: 'New Section', content: '<p>Hi</p>' });
   *   acc.addItem({ id: 'top', title: 'First', content: '<p>Top</p>' }, 0);
   */
  addItem(item, index) {
    const full = { open: false, disabled: false, ...item };
    if (index !== void 0 && index >= 0 && index < this.#items.length)
      this.#items.splice(index, 0, full);
    else
      this.#items.push(full);
    if (full.open && !full.disabled) {
      if (!this.#opts.multiple) this.#open.clear();
      this.#open.add(full.id);
    }
    this.#render();
    this.#fire("Accordion-Add", item.id, full);
    return this;
  }
  /**
   * Remove a panel by id.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.removeItem('notes');
   */
  removeItem(id) {
    const idx = this.#items.findIndex((i) => i.id === id);
    if (idx < 0) return this;
    this.#items.splice(idx, 1);
    this.#open.delete(id);
    this.#render();
    this.#fire("Accordion-Remove", id);
    return this;
  }
  /**
   * Replace the body content of a panel.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.setContent('usage', '<p>Updated content.</p>');
   */
  setContent(id, html) {
    const item = this.#find(id);
    if (item) {
      item.content = html;
      this.#updateBody(id, html);
    }
    return this;
  }
  /**
   * Update the header title of a panel.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.setTitle('api', 'API Reference v2');
   */
  setTitle(id, html) {
    const item = this.#find(id);
    if (item) {
      item.title = html;
      this.#updateTitle(id, html);
    }
    return this;
  }
  /**
   * Enable a disabled panel (allows it to be toggled again).
   * Fluent — returns `this`.
   *
   * @example
   *   acc.enable('notes');
   */
  enable(id) {
    const item = this.#find(id);
    if (item) {
      item.disabled = false;
      this.#renderItem(id);
    }
    return this;
  }
  /**
   * Disable a panel — it can no longer be opened or closed by the user.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.disable('notes');
   */
  disable(id) {
    const item = this.#find(id);
    if (item) {
      item.disabled = true;
      this.#open.delete(id);
      this.#renderItem(id);
    }
    return this;
  }
  /**
   * Register a listener for Accordion events.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.on('Accordion-Open',  e => console.log(e.id, 'opened'));
   *   acc.on('Accordion-Close', e => console.log(e.id, 'closed'));
   */
  on(type, cb) {
    this.#obs.on(type, cb);
    return this;
  }
  /**
   * Remove an Accordion event listener.
   * Fluent — returns `this`.
   *
   * @example
   *   acc.off('Accordion-Open', handler);
   */
  off(type, cb) {
    this.#obs.off(type, cb);
    return this;
  }
  // ── Private helpers ────────────────────────────────────────────────────────────
  #find(id) {
    return this.#items.find((i) => i.id === id);
  }
  #fire(type, id, item) {
    this.#obs.fire({
      Type: type,
      id,
      item,
      open: this.#open.has(id),
      accordion: this
    });
  }
  #render() {
    this.#el.innerHTML = "";
    this.#items.forEach((item) => this.#el.appendChild(this.#buildPanel(item)));
  }
  #renderItem(id) {
    const item = this.#find(id);
    if (!item) return;
    const existing = this.#el.querySelector(`[data-acc-id="${id}"]`);
    if (existing) {
      const fresh = this.#buildPanel(item);
      existing.parentElement?.replaceChild(fresh, existing);
    }
  }
  #buildPanel(item) {
    const isOpen = this.#open.has(item.id);
    const isDisabled = !!item.disabled;
    const border = this.#opts.borderless ? "none" : "1px solid var(--border,#e0e0e0)";
    const animStyle = this.#opts.animated ? `max-height:${isOpen ? "2000px" : "0"};transition:max-height .3s ease;overflow:hidden;` : `display:${isOpen ? "block" : "none"};`;
    const panel = document.createElement("div");
    panel.className = "arianna-wip-acc-panel";
    panel.dataset.accId = item.id;
    panel.style.cssText = `border:${border};border-radius:6px;overflow:hidden;margin-bottom:4px;`;
    panel.innerHTML = `
      <button
        class="arianna-acc-header"
        data-acc-id="${item.id}"
        aria-expanded="${isOpen}"
        aria-disabled="${isDisabled}"
        role="tab"
        ${isDisabled ? "disabled" : ""}
        style="width:100%;background:var(--bg3,#f5f5f5);border:none;cursor:${isDisabled ? "not-allowed" : "pointer"};
               display:flex;align-items:center;justify-content:space-between;padding:12px 16px;
               font:inherit;font-size:.84rem;font-weight:600;color:${isDisabled ? "var(--muted,#aaa)" : "var(--text,#111)"};
               text-align:left;opacity:${isDisabled ? ".5" : "1"};"
      >
        <span class="arianna-acc-title">${item.title}</span>
        ${renderIcon(this.#opts.icon, isOpen)}
      </button>
      <div
        class="arianna-acc-body"
        data-acc-id="${item.id}"
        role="tabpanel"
        style="${animStyle}background:var(--bg2,#fafafa);"
      >
        <div style="padding:14px 16px;">${item.content}</div>
      </div>
    `;
    return panel;
  }
  #update(id) {
    const isOpen = this.#open.has(id);
    const header = this.#el.querySelector(`.arianna-acc-header[data-acc-id="${id}"]`);
    const body = this.#el.querySelector(`.arianna-acc-body[data-acc-id="${id}"]`);
    const icon = header?.querySelector(".arianna-wip-acc-icon");
    if (header) header.setAttribute("aria-expanded", String(isOpen));
    if (body) {
      if (this.#opts.animated) {
        body.style.maxHeight = isOpen ? "2000px" : "0";
      } else {
        body.style.display = isOpen ? "block" : "none";
      }
    }
    if (icon) {
      switch (this.#opts.icon) {
        case "chevron":
        case "arrow":
          icon.style.transform = `rotate(${isOpen ? 90 : 0}deg)`;
          break;
        case "plus":
          icon.textContent = isOpen ? "\u2212" : "+";
          break;
      }
    }
  }
  #updateBody(id, html) {
    const body = this.#el.querySelector(`.arianna-acc-body[data-acc-id="${id}"] > div`);
    if (body) body.innerHTML = html;
  }
  #updateTitle(id, html) {
    const title = this.#el.querySelector(`.arianna-acc-header[data-acc-id="${id}"] .arianna-acc-title`);
    if (title) title.innerHTML = html;
  }
  #wireEvents() {
    this.#el.addEventListener("click", (e) => {
      const btn = e.target.closest(".arianna-wip-acc-header");
      if (!btn) return;
      const id = btn.dataset.accId;
      if (!id) return;
      const item = this.#find(id);
      if (!item || item.disabled) return;
      this.toggle(id);
      this.#fire("Accordion-Toggle", id, item);
    });
    this.#el.addEventListener("keydown", (e) => {
      const ke = e;
      const btn = ke.target.closest(".arianna-wip-acc-header");
      if (!btn) return;
      const headers = Array.from(this.#el.querySelectorAll(".arianna-wip-acc-header:not([disabled])"));
      const idx = headers.indexOf(btn);
      let next = -1;
      if (ke.key === "ArrowDown") next = (idx + 1) % headers.length;
      if (ke.key === "ArrowUp") next = (idx - 1 + headers.length) % headers.length;
      if (ke.key === "Home") next = 0;
      if (ke.key === "End") next = headers.length - 1;
      if (next >= 0) {
        ke.preventDefault();
        headers[next].focus();
      }
    });
  }
};
if (typeof window !== "undefined")
  Object.defineProperty(window, "Accordion", {
    enumerable: true,
    configurable: false,
    writable: false,
    value: Accordion
  });

// components/layout/Card.ts
var Card = class extends Control {
  _title = "";
  _subtitle = "";
  _media = "";
  _content = "";
  _footer = "";
  constructor(container = null, opts = {}) {
    super(container, "div", { elevation: 1, variant: "outlined", ...opts });
    this.el.className = `ar-card ar-card--${opts.variant ?? "outlined"} ar-card--e${opts.elevation ?? 1}${opts.class ? " " + opts.class : ""}`;
  }
  set title(v) {
    this._title = v;
    this._set("title", v);
  }
  set subtitle(v) {
    this._subtitle = v;
    this._set("subtitle", v);
  }
  set media(v) {
    this._media = v;
    this._set("media", v);
  }
  set content(v) {
    this._content = v;
    this._set("content", v);
  }
  set footer(v) {
    this._footer = v;
    this._set("footer", v);
  }
  _build() {
    this.el.innerHTML = "";
    if (this._media) {
      const m = this._el("div", "ar-card__media", this.el);
      if (typeof this._media === "string") m.innerHTML = this._media;
      else m.appendChild(this._media);
    }
    if (this._title || this._subtitle) {
      const h = this._el("div", "ar-card__header", this.el);
      if (this._title) {
        const t = this._el("div", "ar-card__title", h);
        t.textContent = this._title;
      }
      if (this._subtitle) {
        const s = this._el("div", "ar-card__subtitle", h);
        s.textContent = this._subtitle;
      }
    }
    if (this._content) {
      const b = this._el("div", "ar-card__body", this.el);
      if (typeof this._content === "string") b.innerHTML = this._content;
      else b.appendChild(this._content);
    }
    if (this._footer) {
      const f = this._el("div", "ar-card__footer", this.el);
      if (typeof this._footer === "string") f.innerHTML = this._footer;
      else f.appendChild(this._footer);
    }
  }
};
var CardCSS = `
.ar-card{background:var(--ar-bg2);border-radius:var(--ar-radius-lg);overflow:hidden;display:flex;flex-direction:column}
.ar-card--outlined{border:1px solid var(--ar-border)}
.ar-card--filled{background:var(--ar-bg3)}
.ar-card--ghost{background:transparent}
.ar-card--e0{}
.ar-card--e1{box-shadow:0 1px 4px rgba(0,0,0,.2)}
.ar-card--e2{box-shadow:0 4px 16px rgba(0,0,0,.3)}
.ar-card--e3{box-shadow:0 8px 32px rgba(0,0,0,.4)}
.ar-card__media img{width:100%;display:block}
.ar-card__header{padding:14px 16px 4px}
.ar-card__title{font-weight:600;font-size:.95rem}
.ar-card__subtitle{color:var(--ar-muted);font-size:.78rem;margin-top:2px}
.ar-card__body{padding:12px 16px;flex:1}
.ar-card__footer{padding:10px 16px;border-top:1px solid var(--ar-border);display:flex;gap:8px;align-items:center}
`;

// components/layout/Drawer.ts
var Drawer = class extends Control {
  _content = "";
  _panel;
  constructor(opts = {}) {
    super(null, "div", { side: "left", width: 280, closeOnBackdrop: true, ...opts });
    document.body.appendChild(this.el);
    this.el.className = `ar-drawer ar-drawer--${opts.side ?? "left"}${opts.class ? " " + opts.class : ""}`;
    this.el.style.display = "none";
    const backdrop = this._el("div", "ar-drawer__backdrop", this.el);
    this._panel = this._el("div", "ar-drawer__panel", this.el);
    const side = opts.side ?? "left";
    if (side === "left" || side === "right") this._panel.style.width = (opts.width ?? 280) + "px";
    else this._panel.style.height = (opts.height ?? 240) + "px";
    backdrop.addEventListener("click", () => {
      if (this._get("closeOnBackdrop", true)) this.close();
    });
  }
  set content(v) {
    this._content = v;
    this._build();
  }
  open() {
    this.el.style.display = "";
    setTimeout(() => this.el.classList.add("ar-drawer--open"), 10);
    this._emit("open", {});
  }
  close() {
    this.el.classList.remove("ar-drawer--open");
    setTimeout(() => {
      this.el.style.display = "none";
      this._emit("close", {});
    }, 250);
  }
  _build() {
    this._panel.innerHTML = "";
    if (typeof this._content === "string") this._panel.innerHTML = this._content;
    else if (this._content) this._panel.appendChild(this._content);
  }
};
var DrawerCSS = `.ar-drawer{position:fixed;inset:0;z-index:900}.ar-drawer__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.5);opacity:0;transition:opacity .25s}.ar-drawer--open .ar-drawer__backdrop{opacity:1}.ar-drawer__panel{position:absolute;background:var(--ar-bg2);border:1px solid var(--ar-border);box-shadow:var(--ar-shadow-lg);overflow-y:auto;transition:transform .25s ease}.ar-drawer--left .ar-drawer__panel{left:0;top:0;bottom:0;transform:translateX(-100%)}.ar-drawer--right .ar-drawer__panel{right:0;top:0;bottom:0;transform:translateX(100%)}.ar-drawer--top .ar-drawer__panel{top:0;left:0;right:0;transform:translateY(-100%)}.ar-drawer--bottom .ar-drawer__panel{bottom:0;left:0;right:0;transform:translateY(100%)}.ar-drawer--open .ar-drawer__panel{transform:none}`;

// components/layout/Modal.ts
var Modal = class extends Control {
  _title = "";
  _content = "";
  _footer = "";
  _backdrop;
  _dialog;
  constructor(opts = {}) {
    super(null, "div", { size: "md", closeOnBackdrop: true, ...opts });
    document.body.appendChild(this.el);
    this.el.className = `ar-modal${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-modal", "true");
    this.el.style.display = "none";
    this._backdrop = this._el("div", "ar-modal__backdrop", this.el);
    this._dialog = this._el("div", `ar-modal__dialog ar-modal__dialog--${opts.size ?? "md"}`, this.el);
    this._backdrop.addEventListener("click", () => {
      if (this._get("closeOnBackdrop", true)) this.close();
    });
    this._on(document, "keydown", (e) => {
      if (e.key === "Escape" && this.el.style.display !== "none") this.close();
    });
  }
  set title(v) {
    this._title = v;
    this._build();
  }
  set content(v) {
    this._content = v;
    this._build();
  }
  set footer(v) {
    this._footer = v;
    this._build();
  }
  open() {
    this.el.style.display = "";
    document.body.style.overflow = "hidden";
    this._emit("open", {});
  }
  close() {
    this.el.style.display = "none";
    document.body.style.overflow = "";
    this._emit("close", {});
  }
  _build() {
    this._dialog.innerHTML = "";
    const h = this._el("div", "ar-modal__header", this._dialog);
    const t = this._el("div", "ar-modal__title", h);
    t.textContent = this._title;
    const x = this._el("button", "ar-modal__close", h);
    x.textContent = "\u2715";
    x.setAttribute("aria-label", "Close");
    x.addEventListener("click", () => this.close());
    const b = this._el("div", "ar-modal__body", this._dialog);
    if (typeof this._content === "string") b.innerHTML = this._content;
    else if (this._content) b.appendChild(this._content);
    if (this._footer) {
      const f = this._el("div", "ar-modal__footer", this._dialog);
      if (typeof this._footer === "string") f.innerHTML = this._footer;
      else f.appendChild(this._footer);
    }
  }
};
var ModalCSS = `
.ar-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center}
.ar-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(2px)}
.ar-modal__dialog{position:relative;background:var(--ar-bg2);border:1px solid var(--ar-border);border-radius:var(--ar-radius-lg);box-shadow:var(--ar-shadow-lg);display:flex;flex-direction:column;max-height:90vh;width:90vw;z-index:1;overflow:hidden}
.ar-modal__dialog--sm{max-width:360px}
.ar-modal__dialog--md{max-width:520px}
.ar-modal__dialog--lg{max-width:760px}
.ar-modal__dialog--xl{max-width:1020px}
.ar-modal__dialog--full{max-width:none;width:96vw;height:96vh}
.ar-modal__header{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--ar-border);flex-shrink:0}
.ar-modal__title{flex:1;font-weight:600}
.ar-modal__close{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:1rem;line-height:1;padding:2px 6px;border-radius:var(--ar-radius-sm)}
.ar-modal__close:hover{background:var(--ar-bg4)}
.ar-modal__body{flex:1;overflow-y:auto;padding:16px}
.ar-modal__footer{padding:12px 16px;border-top:1px solid var(--ar-border);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0}
`;

// components/layout/Panel.ts
var Panel = class extends Control {
  _title = "";
  _content = "";
  _toolbar = "";
  _collapsed = false;
  constructor(container = null, opts = {}) {
    super(container, "div", opts);
    this._collapsed = opts.collapsed ?? false;
    this.el.className = `ar-panel${opts.class ? " " + opts.class : ""}`;
  }
  set title(v) {
    this._title = v;
    this._build();
  }
  set content(v) {
    this._content = v;
    this._build();
  }
  set toolbar(v) {
    this._toolbar = v;
    this._build();
  }
  set collapsible(v) {
    this._set("collapsible", v);
  }
  get collapsed() {
    return this._collapsed;
  }
  toggle() {
    this._collapsed = !this._collapsed;
    this._emit("toggle", { collapsed: this._collapsed });
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    if (this._title || this._toolbar) {
      const h = this._el("div", "ar-panel__header", this.el);
      if (this._title) {
        const t = this._el("span", "ar-panel__title", h);
        t.textContent = this._title;
      }
      if (this._toolbar) {
        const tb = this._el("div", "ar-panel__toolbar", h);
        if (typeof this._toolbar === "string") tb.innerHTML = this._toolbar;
        else tb.appendChild(this._toolbar);
      }
      if (this._get("collapsible", false)) {
        const btn = this._el("button", "ar-panel__toggle", h);
        btn.textContent = this._collapsed ? "\u25B8" : "\u25BE";
        btn.addEventListener("click", () => this.toggle());
      }
    }
    if (!this._collapsed) {
      const b = this._el("div", "ar-panel__body", this.el);
      if (typeof this._content === "string") b.innerHTML = this._content;
      else if (this._content) b.appendChild(this._content);
    }
  }
};
var PanelCSS = `.ar-panel{background:var(--ar-bg2);border:1px solid var(--ar-border);border-radius:var(--ar-radius);overflow:hidden}.ar-panel__header{align-items:center;background:var(--ar-bg3);border-bottom:1px solid var(--ar-border);display:flex;gap:8px;padding:8px 14px}.ar-panel__title{flex:1;font-size:.85rem;font-weight:600}.ar-panel__toolbar{display:flex;gap:6px;align-items:center}.ar-panel__toggle{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.75rem;padding:2px}.ar-panel__body{padding:14px}`;

// components/layout/Splitter.ts
var Splitter = class extends Control {
  _paneA = null;
  _paneB = null;
  _ratio = 0.5;
  constructor(container = null, opts = {}) {
    super(container, "div", { direction: "horizontal", ratio: 0.5, minA: 60, minB: 60, ...opts });
    this._ratio = opts.ratio ?? 0.5;
    this.el.className = `ar-splitter ar-splitter--${opts.direction ?? "horizontal"}${opts.class ? " " + opts.class : ""}`;
  }
  set paneA(el) {
    this._paneA = el;
    this._build();
  }
  set paneB(el) {
    this._paneB = el;
    this._build();
  }
  set ratio(v) {
    this._ratio = Math.max(0.05, Math.min(0.95, v));
    this._build();
  }
  get ratio() {
    return this._ratio;
  }
  _build() {
    this.el.innerHTML = "";
    const isH = this._get("direction", "horizontal") === "horizontal";
    const paneA = this._el("div", "ar-splitter__pane ar-splitter__pane-a", this.el);
    const handle = this._el("div", "ar-splitter__handle", this.el);
    const paneB = this._el("div", "ar-splitter__pane ar-splitter__pane-b", this.el);
    if (this._paneA) paneA.appendChild(this._paneA);
    if (this._paneB) paneB.appendChild(this._paneB);
    const apply = () => {
      const r = this._ratio * 100;
      if (isH) {
        paneA.style.width = r + "%";
        paneB.style.width = 100 - r + "%";
      } else {
        paneA.style.height = r + "%";
        paneB.style.height = 100 - r + "%";
      }
    };
    apply();
    this._on(handle, "mousedown", (e) => {
      e.preventDefault();
      const rect = this.el.getBoundingClientRect();
      const minA = this._get("minA", 60);
      const minB = this._get("minB", 60);
      const move = (e2) => {
        const total = isH ? rect.width : rect.height;
        const offset = isH ? e2.clientX - rect.left : e2.clientY - rect.top;
        this._ratio = Math.max(minA / total, Math.min(1 - minB / total, offset / total));
        apply();
        this._emit("resize", { ratio: this._ratio });
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }
};
var SplitterCSS = `.ar-splitter{display:flex;width:100%;height:100%;overflow:hidden}.ar-splitter--vertical{flex-direction:column}.ar-splitter__pane{overflow:auto}.ar-splitter__handle{background:var(--ar-border);flex-shrink:0;transition:background var(--ar-transition)}.ar-splitter__handle:hover,.ar-splitter__handle:active{background:var(--ar-primary)}.ar-splitter--horizontal .ar-splitter__handle{cursor:col-resize;width:4px}.ar-splitter--vertical .ar-splitter__handle{cursor:row-resize;height:4px}`;

// components/layout/Tabs.ts
var Tabs = class extends Control {
  _items = [];
  _active = "";
  constructor(container = null, opts = {}) {
    super(container, "div", { variant: "line", ...opts });
    this.el.className = `ar-tabs ar-tabs--${opts.variant ?? "line"}${opts.class ? " " + opts.class : ""}`;
  }
  set items(v) {
    this._items = v;
    if (!this._active && v.length) this._active = v[0].id;
    this._set("items", v);
  }
  set active(id) {
    this._active = id;
    this._build();
  }
  get active() {
    return this._active;
  }
  _build() {
    this.el.innerHTML = "";
    const nav = this._el("div", "ar-tabs__nav", this.el);
    const body = this._el("div", "ar-tabs__body", this.el);
    this._items.forEach((item) => {
      const btn = this._el("button", `ar-tabs__tab${item.id === this._active ? " ar-tabs__tab--active" : ""}${item.disabled ? " ar-tabs__tab--disabled" : ""}`, nav);
      btn.disabled = !!item.disabled;
      if (item.icon) {
        const ic = this._el("span", "ar-tabs__icon", btn);
        ic.textContent = item.icon;
      }
      const l = this._el("span", "", btn);
      l.textContent = item.label;
      if (item.badge !== void 0) {
        const b = this._el("span", "ar-tabs__badge", btn);
        b.textContent = String(item.badge);
      }
      btn.addEventListener("click", () => {
        if (!item.disabled) {
          this._active = item.id;
          this._emit("change", { id: item.id });
          this._build();
        }
      });
      if (item.id === this._active) {
        const pane = this._el("div", "ar-tabs__pane", body);
        if (typeof item.content === "string") pane.innerHTML = item.content;
        else pane.appendChild(item.content);
      }
    });
  }
};
var TabsCSS = `.ar-tabs{display:flex;flex-direction:column}.ar-tabs__nav{display:flex;border-bottom:1px solid var(--ar-border);overflow-x:auto}.ar-tabs__tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--ar-muted);cursor:pointer;display:flex;align-items:center;gap:6px;font:inherit;font-size:.82rem;margin-bottom:-1px;padding:8px 16px;transition:color var(--ar-transition),border-color var(--ar-transition);white-space:nowrap;flex-shrink:0}.ar-tabs__tab:hover:not(:disabled){color:var(--ar-text)}.ar-tabs__tab--active{border-bottom-color:var(--ar-primary);color:var(--ar-primary)}.ar-tabs__tab--disabled{opacity:.4;cursor:not-allowed}.ar-tabs--pill .ar-tabs__nav{border-bottom:none;gap:4px;padding:4px}.ar-tabs--pill .ar-tabs__tab{border:1px solid transparent;border-bottom-width:1px;border-radius:var(--ar-radius);margin-bottom:0}.ar-tabs--pill .ar-tabs__tab--active{background:var(--ar-primary);border-color:var(--ar-primary);color:var(--ar-primary-text)}.ar-tabs__badge{background:var(--ar-warning);border-radius:8px;color:#000;font-size:.65rem;min-width:16px;padding:1px 4px;text-align:center}.ar-tabs__body{flex:1;padding:12px 0}.ar-tabs__pane{animation:ar-fadein .18s ease}@keyframes ar-fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`;

// components/navigation/Breadcrumb.ts
var Breadcrumb = class extends Control {
  _items = [];
  constructor(container = null, opts = {}) {
    super(container, "nav", opts);
    this.el.className = `ar-breadcrumb${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("aria-label", "Breadcrumb");
  }
  set items(v) {
    this._items = v;
    this._set("items", v);
  }
  _build() {
    this.el.innerHTML = "";
    const ol = this._el("ol", "ar-breadcrumb__list", this.el);
    const sep = this._get("separator", "/");
    this._items.forEach((item, i) => {
      const li = this._el("li", "ar-breadcrumb__item", ol);
      const isLast = i === this._items.length - 1;
      if (item.icon) {
        const ic = this._el("span", "ar-breadcrumb__icon", li);
        ic.textContent = item.icon;
      }
      if (isLast) {
        const s = this._el("span", "ar-breadcrumb__current", li);
        s.textContent = item.label;
        s.setAttribute("aria-current", "page");
      } else {
        const a = document.createElement("a");
        a.className = "ar-breadcrumb__link";
        a.textContent = item.label;
        if (item.href) a.href = item.href;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          this._emit("click", { item }, e);
        });
        li.appendChild(a);
        const s2 = this._el("span", "ar-breadcrumb__sep", li);
        s2.textContent = sep;
        s2.setAttribute("aria-hidden", "true");
      }
    });
  }
};
var BreadcrumbCSS = `.ar-breadcrumb__list{display:flex;flex-wrap:wrap;gap:2px;list-style:none;margin:0;padding:0}.ar-breadcrumb__item{align-items:center;display:flex;gap:4px;font-size:.82rem}.ar-breadcrumb__link{color:var(--ar-primary);text-decoration:none}.ar-breadcrumb__link:hover{text-decoration:underline}.ar-breadcrumb__current{color:var(--ar-muted)}.ar-breadcrumb__sep{color:var(--ar-dim);padding:0 2px}`;

// components/navigation/Header.ts
var Header = class extends Control {
  _title = "";
  _logo = "";
  _actions = "";
  constructor(container = null, opts = {}) {
    super(container, "header", opts);
    this.el.className = `ar-header${opts.sticky ? " ar-header--sticky" : ""}${opts.class ? " " + opts.class : ""}`;
  }
  set title(v) {
    this._title = v;
    this._build();
  }
  set logo(v) {
    this._logo = v;
    this._build();
  }
  set actions(v) {
    this._actions = v;
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    const inner = this._el("div", "ar-header__inner", this.el);
    if (this._logo) {
      const l = this._el("div", "ar-header__logo", inner);
      if (typeof this._logo === "string") l.innerHTML = this._logo;
      else l.appendChild(this._logo);
    }
    if (this._title) {
      const t = this._el("span", "ar-header__title", inner);
      t.textContent = this._title;
    }
    this._el("div", "ar-header__spacer", inner);
    if (this._actions) {
      const a = this._el("div", "ar-header__actions", inner);
      if (typeof this._actions === "string") a.innerHTML = this._actions;
      else a.appendChild(this._actions);
    }
  }
};
var HeaderCSS = `.ar-header{background:var(--ar-bg2);border-bottom:1px solid var(--ar-border)}.ar-header--sticky{position:sticky;top:0;z-index:100}.ar-header__inner{align-items:center;display:flex;gap:12px;height:52px;margin:0 auto;max-width:100%;padding:0 16px}.ar-header__logo{display:flex;align-items:center}.ar-header__title{font-size:.95rem;font-weight:700;white-space:nowrap}.ar-header__spacer{flex:1}.ar-header__actions{align-items:center;display:flex;gap:8px}`;

// components/navigation/Menu.ts
var Menu = class extends Control {
  _items = [];
  constructor() {
    super(null, "div");
    document.body.appendChild(this.el);
    this.el.className = "ar-menu";
    this.el.style.display = "none";
    this._on(document, "click", () => this.close());
    this._on(document, "keydown", (e) => {
      if (e.key === "Escape") this.close();
    });
  }
  set items(v) {
    this._items = v;
    this._set("items", v);
  }
  openAt(x, y) {
    this._build();
    this.el.style.display = "";
    const w = this.el.offsetWidth || 180;
    const h = this.el.offsetHeight || 200;
    this.el.style.left = (x + w > window.innerWidth ? window.innerWidth - w - 8 : x) + "px";
    this.el.style.top = (y + h > window.innerHeight ? window.innerHeight - h - 8 : y) + "px";
    this._emit("open", {});
  }
  openBelow(anchor) {
    const r = anchor.getBoundingClientRect();
    this.openAt(r.left, r.bottom + 4);
  }
  close() {
    this.el.style.display = "none";
    this._emit("close", {});
  }
  _build() {
    this.el.innerHTML = "";
    this._items.forEach((item) => {
      if (item.separator) {
        this._el("div", "ar-menu__sep", this.el);
        return;
      }
      const row = this._el("button", `ar-menu__item${item.disabled ? " ar-menu__item--disabled" : ""}${item.danger ? " ar-menu__item--danger" : ""}`, this.el);
      row.disabled = !!item.disabled;
      if (item.icon) {
        const ic = this._el("span", "ar-menu__icon", row);
        ic.textContent = item.icon;
      }
      const lbl = this._el("span", "ar-menu__label", row);
      lbl.textContent = item.label;
      if (item.shortcut) {
        const sc = this._el("span", "ar-menu__shortcut", row);
        sc.textContent = item.shortcut;
      }
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.disabled) {
          this._emit("select", { id: item.id, item });
          this.close();
        }
      });
    });
  }
};
var MenuCSS = `.ar-menu{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius-lg);box-shadow:var(--ar-shadow-lg);display:flex;flex-direction:column;min-width:180px;overflow:hidden;padding:4px 0;position:fixed;z-index:2000}.ar-menu__item{align-items:center;background:none;border:none;color:var(--ar-text);cursor:pointer;display:flex;font:inherit;font-size:.82rem;gap:8px;padding:7px 14px;text-align:left;width:100%;transition:background var(--ar-transition)}.ar-menu__item:hover:not(:disabled){background:var(--ar-bg4)}.ar-menu__item--danger{color:var(--ar-danger)}.ar-menu__item--disabled{opacity:.4;cursor:not-allowed}.ar-menu__label{flex:1}.ar-menu__shortcut{color:var(--ar-muted);font-size:.72rem}.ar-menu__icon{width:16px;text-align:center;flex-shrink:0}.ar-menu__sep{background:var(--ar-border);height:1px;margin:4px 0}`;

// components/navigation/NavRail.ts
var NavRail = class extends Control {
  _items = [];
  _active = "";
  constructor(container = null, opts = {}) {
    super(container, "nav", opts);
    this.el.className = `ar-navrail${opts.collapsed ? " ar-navrail--collapsed" : ""}${opts.class ? " " + opts.class : ""}`;
  }
  set items(v) {
    this._items = v;
    this._set("items", v);
  }
  set active(id) {
    this._active = id;
    this._build();
  }
  get active() {
    return this._active;
  }
  toggle() {
    const c = !this._get("collapsed", false);
    this._set("collapsed", c);
    this.el.classList.toggle("ar-navrail--collapsed", c);
  }
  _build() {
    this.el.innerHTML = "";
    const btn = this._el("button", "ar-navrail__toggle", this.el);
    btn.textContent = this._get("collapsed", false) ? "\u25B8" : "\u25C2";
    btn.addEventListener("click", () => this.toggle());
    this._items.forEach((item) => {
      const el = this._el("button", `ar-navrail__item${item.id === this._active ? " ar-navrail__item--active" : ""}`, this.el);
      const ic = this._el("span", "ar-navrail__icon", el);
      ic.textContent = item.icon;
      const lbl = this._el("span", "ar-navrail__label", el);
      lbl.textContent = item.label;
      if (item.badge !== void 0) {
        const b = this._el("span", "ar-navrail__badge", el);
        b.textContent = String(item.badge);
      }
      el.addEventListener("click", () => {
        this._active = item.id;
        this._build();
        this._emit("select", { id: item.id, item });
      });
    });
  }
};
var NavRailCSS = `.ar-navrail{display:flex;flex-direction:column;gap:2px;padding:8px 6px;width:220px;transition:width var(--ar-transition)}.ar-navrail--collapsed{width:56px}.ar-navrail__toggle{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.75rem;padding:6px;text-align:right}.ar-navrail__item{align-items:center;background:none;border:none;border-radius:var(--ar-radius);color:var(--ar-muted);cursor:pointer;display:flex;gap:10px;font:inherit;font-size:.83rem;padding:9px 10px;text-align:left;transition:background var(--ar-transition),color var(--ar-transition);white-space:nowrap;width:100%;overflow:hidden}.ar-navrail__item:hover{background:var(--ar-bg3);color:var(--ar-text)}.ar-navrail__item--active{background:rgba(126,184,247,.12);color:var(--ar-primary);font-weight:600}.ar-navrail__icon{flex-shrink:0;font-size:1.1rem;width:20px;text-align:center}.ar-navrail__label{flex:1}.ar-navrail--collapsed .ar-navrail__label{display:none}.ar-navrail__badge{background:var(--ar-danger);border-radius:8px;color:#fff;font-size:.65rem;padding:1px 5px}`;

// components/navigation/Pagination.ts
var Pagination = class extends Control {
  _page = 1;
  constructor(container = null, opts = {}) {
    super(container, "nav", { total: 0, pageSize: 10, page: 1, siblings: 1, ...opts });
    this._page = opts.page ?? 1;
    this.el.className = `ar-pagination${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("aria-label", "Pagination");
  }
  set total(v) {
    this._set("total", v);
  }
  set pageSize(v) {
    this._set("pageSize", v);
  }
  set page(v) {
    this._page = v;
    this._build();
  }
  get page() {
    return this._page;
  }
  get totalPages() {
    return Math.ceil(this._get("total", 0) / this._get("pageSize", 10));
  }
  _go(p) {
    const tp = this.totalPages;
    if (p < 1 || p > tp) return;
    this._page = p;
    this._build();
    this._emit("change", { page: p, totalPages: tp });
  }
  _btn(label, page, disabled, active = false) {
    const b = this._el("button", `ar-pagination__btn${active ? " ar-pagination__btn--active" : ""}`, this.el);
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener("click", () => this._go(page));
    return b;
  }
  _build() {
    this.el.innerHTML = "";
    const tp = this.totalPages;
    if (tp <= 1) return;
    const sib = this._get("siblings", 1);
    this._btn("\u2039", this._page - 1, this._page <= 1);
    const start = Math.max(1, this._page - sib);
    const end = Math.min(tp, this._page + sib);
    if (start > 1) {
      this._btn("1", 1, false);
      if (start > 2) {
        const d = this._el("span", "ar-pagination__dots", this.el);
        d.textContent = "\u2026";
      }
    }
    for (let p = start; p <= end; p++) this._btn(String(p), p, false, p === this._page);
    if (end < tp) {
      if (end < tp - 1) {
        const d = this._el("span", "ar-pagination__dots", this.el);
        d.textContent = "\u2026";
      }
      this._btn(String(tp), tp, false);
    }
    this._btn("\u203A", this._page + 1, this._page >= tp);
  }
};
var PaginationCSS = `.ar-pagination{display:flex;align-items:center;gap:4px}.ar-pagination__btn{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);color:var(--ar-text);cursor:pointer;font:inherit;font-size:.82rem;min-width:32px;padding:4px 8px;transition:border-color var(--ar-transition)}.ar-pagination__btn:hover:not(:disabled){border-color:var(--ar-primary)}.ar-pagination__btn--active{background:var(--ar-primary);border-color:var(--ar-primary);color:var(--ar-primary-text)}.ar-pagination__btn:disabled{opacity:.4;cursor:not-allowed}.ar-pagination__dots{color:var(--ar-muted);padding:0 4px}`;

// components/navigation/Stepper.ts
var Stepper = class extends Control {
  _steps = [];
  _current = 0;
  _completed = /* @__PURE__ */ new Set();
  constructor(container = null, opts = {}) {
    super(container, "div", opts);
    this.el.className = `ar-stepper ar-stepper--${opts.variant ?? "horizontal"}${opts.class ? " " + opts.class : ""}`;
  }
  set steps(v) {
    this._steps = v;
    this._set("steps", v);
  }
  set current(n) {
    this._current = n;
    this._build();
  }
  get current() {
    return this._current;
  }
  next() {
    if (this._current < this._steps.length - 1) {
      this._completed.add(this._current);
      this._current++;
      this._build();
      this._emit("change", { step: this._current });
    }
  }
  prev() {
    if (this._current > 0) {
      this._current--;
      this._build();
      this._emit("change", { step: this._current });
    }
  }
  complete(n = this._current) {
    this._completed.add(n);
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    this._steps.forEach((label, i) => {
      const isDone = this._completed.has(i);
      const isActive = i === this._current;
      const isPending = i > this._current && !isDone;
      const step = this._el("div", `ar-stepper__step${isActive ? " ar-stepper__step--active" : ""}${isDone ? " ar-stepper__step--done" : ""}${isPending ? " ar-stepper__step--pending" : ""}`, this.el);
      const dot = this._el("div", "ar-stepper__dot", step);
      dot.textContent = isDone ? "\u2713" : String(i + 1);
      const lbl = this._el("div", "ar-stepper__label", step);
      lbl.textContent = label;
      if (i < this._steps.length - 1) this._el("div", "ar-stepper__line", this.el);
    });
  }
};
var StepperCSS = `.ar-stepper{display:flex;align-items:flex-start}.ar-stepper--vertical{flex-direction:column}.ar-stepper__step{align-items:center;display:flex;flex-direction:column;gap:4px;min-width:64px;text-align:center}.ar-stepper__dot{align-items:center;background:var(--ar-bg4);border:2px solid var(--ar-border);border-radius:50%;color:var(--ar-muted);display:flex;font-size:.7rem;font-weight:600;height:28px;justify-content:center;width:28px;transition:all var(--ar-transition)}.ar-stepper__step--active .ar-stepper__dot{background:var(--ar-primary);border-color:var(--ar-primary);color:var(--ar-primary-text)}.ar-stepper__step--done .ar-stepper__dot{background:var(--ar-success);border-color:var(--ar-success);color:#fff}.ar-stepper__label{font-size:.72rem;color:var(--ar-muted)}.ar-stepper__step--active .ar-stepper__label{color:var(--ar-text);font-weight:600}.ar-stepper__line{flex:1;height:2px;background:var(--ar-border);margin-top:-14px;align-self:flex-start;margin-left:-32px;margin-right:-32px}`;

// components/inputs/Button.ts
var Button = class extends Control {
  _label = "";
  _loading = false;
  constructor(container = null, opts = {}) {
    super(container, "button", { variant: "default", size: "md", ...opts });
    this.el.type = "button";
    this.el.className = `ar-btn ar-btn--${opts.variant ?? "default"} ar-btn--${opts.size ?? "md"}${opts.class ? " " + opts.class : ""}`;
    this.el.addEventListener("click", (e) => {
      if (!this.el.disabled && !this._loading) this._emit("click", {}, e);
    });
  }
  set label(v) {
    this._label = v;
    this._build();
  }
  get label() {
    return this._label;
  }
  set loading(v) {
    this._loading = v;
    this.el.disabled = v;
    this._build();
  }
  set disabled(v) {
    this.el.disabled = v;
  }
  get disabled() {
    return this.el.disabled;
  }
  _build() {
    this.el.innerHTML = "";
    if (this._loading) {
      this._el("span", "ar-btn__spinner", this.el).textContent = "\u27F3";
    } else {
      const icon = this._get("icon", "");
      if (icon) this._el("span", "ar-btn__icon", this.el).textContent = icon;
    }
    if (this._label) this._el("span", "", this.el).textContent = this._label;
    if (!this._loading) {
      const ir = this._get("iconRight", "");
      if (ir) this._el("span", "ar-btn__icon", this.el).textContent = ir;
    }
  }
};
var ButtonCSS = `.ar-btn{align-items:center;border-radius:var(--ar-radius);cursor:pointer;display:inline-flex;font:inherit;gap:6px;justify-content:center;transition:all var(--ar-transition);user-select:none;white-space:nowrap}.ar-btn--default{background:var(--ar-bg3);border:1px solid var(--ar-border);color:var(--ar-text)}.ar-btn--default:hover:not(:disabled){background:var(--ar-bg4);border-color:var(--ar-border2)}.ar-btn--primary{background:var(--ar-primary);border:1px solid var(--ar-primary);color:var(--ar-primary-text)}.ar-btn--primary:hover:not(:disabled){filter:brightness(1.1)}.ar-btn--danger{background:var(--ar-danger);border:1px solid var(--ar-danger);color:#fff}.ar-btn--danger:hover:not(:disabled){filter:brightness(1.1)}.ar-btn--ghost{background:transparent;border:1px solid transparent;color:var(--ar-text)}.ar-btn--ghost:hover:not(:disabled){background:var(--ar-bg3)}.ar-btn--link{background:transparent;border:none;color:var(--ar-primary);padding-left:0;padding-right:0}.ar-btn--sm{font-size:.75rem;padding:3px 10px}.ar-btn--md{font-size:.82rem;padding:5px 14px}.ar-btn--lg{font-size:.9rem;padding:8px 20px}.ar-btn:disabled{cursor:not-allowed;opacity:.45}.ar-btn__spinner{animation:ar-spin .7s linear infinite;display:inline-block}@keyframes ar-spin{to{transform:rotate(360deg)}}`;

// components/inputs/Checkbox.ts
var Checkbox = class extends Control {
  _checked = false;
  _indeterminate = false;
  _input;
  constructor(container = null, opts = {}) {
    super(container, "label", opts);
    this.el.className = `ar-checkbox${opts.class ? " " + opts.class : ""}`;
  }
  set checked(v) {
    this._checked = v;
    if (this._input) this._input.checked = v;
  }
  get checked() {
    return this._input?.checked ?? this._checked;
  }
  set indeterminate(v) {
    this._indeterminate = v;
    if (this._input) this._input.indeterminate = v;
  }
  set disabled(v) {
    if (this._input) this._input.disabled = v;
  }
  _build() {
    this.el.innerHTML = "";
    this._input = document.createElement("input");
    this._input.type = "checkbox";
    this._input.className = "ar-checkbox__input";
    this._input.checked = this._checked;
    this._input.disabled = this._get("disabled", false);
    this._input.indeterminate = this._indeterminate;
    this._input.addEventListener("change", () => {
      this._checked = this._input.checked;
      this._emit("change", { checked: this._checked });
    });
    this.el.appendChild(this._input);
    this._el("span", "ar-checkbox__box", this.el);
    const lbl = this._get("label", "");
    if (lbl) this._el("span", "ar-checkbox__label", this.el).textContent = lbl;
  }
};
var CheckboxCSS = `.ar-checkbox{align-items:center;cursor:pointer;display:inline-flex;gap:8px;user-select:none}.ar-checkbox__input{height:0;opacity:0;position:absolute;width:0}.ar-checkbox__box{align-items:center;background:var(--ar-bg3);border:1.5px solid var(--ar-border);border-radius:3px;display:flex;flex-shrink:0;height:16px;justify-content:center;transition:all var(--ar-transition);width:16px}.ar-checkbox__input:checked+.ar-checkbox__box,.ar-checkbox__input:indeterminate+.ar-checkbox__box{background:var(--ar-primary);border-color:var(--ar-primary)}.ar-checkbox__input:checked+.ar-checkbox__box::after{color:#000;content:'\u2713';font-size:.7rem;font-weight:700}.ar-checkbox__input:indeterminate+.ar-checkbox__box::after{background:#000;content:'';height:2px;width:8px}.ar-checkbox__label{font-size:.82rem}`;

// components/inputs/Chip.ts
var Chip = class extends Control {
  _options = [];
  _selected = /* @__PURE__ */ new Set();
  constructor(container = null, opts = {}) {
    super(container, "div", { multiple: true, removable: false, ...opts });
    this.el.className = `ar-chip-group${opts.class ? " " + opts.class : ""}`;
  }
  set options(v) {
    this._options = v;
    this._set("options", v);
  }
  set selected(v) {
    this._selected = new Set(v);
    this._build();
  }
  get selected() {
    return [...this._selected];
  }
  _build() {
    this.el.innerHTML = "";
    this._options.forEach((opt) => {
      const isOn = this._selected.has(opt);
      const chip = this._el("button", `ar-chip${isOn ? " ar-chip--on" : ""}`, this.el);
      chip.textContent = opt;
      chip.addEventListener("click", () => {
        if (isOn) this._selected.delete(opt);
        else {
          if (!this._get("multiple", true)) this._selected.clear();
          this._selected.add(opt);
        }
        this._emit("change", { selected: this.selected });
        this._build();
      });
      if (this._get("removable", false) && isOn) {
        const x = this._el("span", "ar-chip__remove", chip);
        x.textContent = " \u2715";
        x.addEventListener("click", (e) => {
          e.stopPropagation();
          this._selected.delete(opt);
          this._emit("change", { selected: this.selected });
          this._build();
        });
      }
    });
  }
};
var ChipCSS = `.ar-chip-group{display:flex;flex-wrap:wrap;gap:6px}.ar-chip{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:16px;color:var(--ar-text);cursor:pointer;font:inherit;font-size:.78rem;padding:4px 12px;transition:all var(--ar-transition);user-select:none}.ar-chip:hover{border-color:var(--ar-primary);color:var(--ar-primary)}.ar-chip--on{background:rgba(126,184,247,.15);border-color:var(--ar-primary);color:var(--ar-primary)}.ar-chip__remove{cursor:pointer;opacity:.7}`;

// components/inputs/ColorPicker.ts
var ColorPicker = class extends Control {
  _value = "#000000";
  _input;
  constructor(container = null, opts = {}) {
    super(container, "div", opts);
    this.el.className = `ar-colorpicker${opts.class ? " " + opts.class : ""}`;
  }
  set value(v) {
    this._value = v;
    if (this._input) this._input.value = v;
    this._updatePreview();
  }
  get value() {
    return this._input?.value ?? this._value;
  }
  _updatePreview() {
    const sw = this.el.querySelector(".ar-colorpicker__swatch");
    if (sw) sw.style.background = this.value;
    const hex = this.el.querySelector(".ar-colorpicker__hex");
    if (hex) hex.textContent = this.value.toUpperCase();
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("div", "ar-colorpicker__label", this.el).textContent = lbl;
    const row = this._el("div", "ar-colorpicker__row", this.el);
    const swatch = this._el("div", "ar-colorpicker__swatch", row);
    swatch.style.background = this._value;
    this._input = document.createElement("input");
    this._input.type = "color";
    this._input.className = "ar-colorpicker__input";
    this._input.value = this._value;
    this._input.disabled = this._get("disabled", false);
    this._input.addEventListener("input", () => {
      this._value = this._input.value;
      this._updatePreview();
      this._emit("input", { value: this._value });
    });
    this._input.addEventListener("change", () => this._emit("change", { value: this._input.value }));
    swatch.appendChild(this._input);
    this._el("span", "ar-colorpicker__hex", row).textContent = this._value.toUpperCase();
    const presets = this._get("presets", []);
    if (presets.length) {
      const wrap = this._el("div", "ar-colorpicker__presets", this.el);
      presets.forEach((c) => {
        const p = this._el("button", "ar-colorpicker__preset", wrap);
        p.style.background = c;
        p.title = c;
        p.addEventListener("click", () => {
          this._value = c;
          if (this._input) this._input.value = c;
          this._updatePreview();
          this._emit("change", { value: c });
        });
      });
    }
  }
};
var ColorPickerCSS = `.ar-colorpicker{display:flex;flex-direction:column;gap:6px}.ar-colorpicker__label{color:var(--ar-muted);font-size:.78rem;font-weight:500}.ar-colorpicker__row{align-items:center;display:flex;gap:10px}.ar-colorpicker__swatch{border:2px solid var(--ar-border);border-radius:var(--ar-radius);cursor:pointer;height:32px;overflow:hidden;position:relative;width:44px}.ar-colorpicker__input{cursor:pointer;height:150%;left:-25%;opacity:0;position:absolute;top:-25%;width:150%}.ar-colorpicker__hex{font-size:.82rem;font-variant-numeric:tabular-nums;color:var(--ar-muted)}.ar-colorpicker__presets{display:flex;flex-wrap:wrap;gap:4px}.ar-colorpicker__preset{border:2px solid transparent;border-radius:50%;cursor:pointer;height:20px;width:20px;transition:border-color var(--ar-transition)}.ar-colorpicker__preset:hover{border-color:var(--ar-text)}`;

// components/inputs/DatePicker.ts
var DatePicker = class extends Control {
  _value = "";
  _open = false;
  _view = /* @__PURE__ */ new Date();
  constructor(container = null, opts = {}) {
    super(container, "div", opts);
    this.el.className = `ar-datepicker${opts.class ? " " + opts.class : ""}`;
    this._on(document, "click", (e) => {
      if (!this.el.contains(e.target)) {
        this._open = false;
        this._build();
      }
    });
  }
  set value(v) {
    this._value = v;
    if (v) this._view = /* @__PURE__ */ new Date(v + "T12:00:00");
    this._build();
  }
  get value() {
    return this._value;
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("div", "ar-datepicker__label", this.el).textContent = lbl;
    const trigger = this._el("div", "ar-datepicker__trigger", this.el);
    const lv = this._el("span", "ar-datepicker__value", trigger);
    lv.textContent = this._value || "Select date\u2026";
    if (!this._value) lv.classList.add("ar-datepicker__placeholder");
    this._el("span", "ar-datepicker__icon", trigger).textContent = "\u{1F4C5}";
    if (!this._get("disabled", false)) trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this._open = !this._open;
      this._build();
    });
    if (this._open) this._buildCalendar();
  }
  _buildCalendar() {
    const cal = this._el("div", "ar-datepicker__calendar", this.el);
    const y = this._view.getFullYear();
    const m = this._view.getMonth();
    const header = this._el("div", "ar-datepicker__cal-header", cal);
    const prev = this._el("button", "ar-datepicker__nav", header);
    prev.textContent = "\u2039";
    prev.addEventListener("click", (e) => {
      e.stopPropagation();
      this._view = new Date(y, m - 1, 1);
      this._build();
    });
    this._el("span", "ar-datepicker__cal-title", header).textContent = this._view.toLocaleString("default", { month: "long", year: "numeric" });
    const next = this._el("button", "ar-datepicker__nav", header);
    next.textContent = "\u203A";
    next.addEventListener("click", (e) => {
      e.stopPropagation();
      this._view = new Date(y, m + 1, 1);
      this._build();
    });
    const grid = this._el("div", "ar-datepicker__grid", cal);
    ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach((d) => {
      this._el("div", "ar-datepicker__day-name", grid).textContent = d;
    });
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    for (let i = 0; i < firstDay; i++) this._el("div", "ar-datepicker__day ar-datepicker__day--empty", grid);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const btn = this._el("button", `ar-datepicker__day${dateStr === this._value ? " ar-datepicker__day--selected" : ""}${dateStr === today ? " ar-datepicker__day--today" : ""}`, grid);
      btn.textContent = String(d);
      const min = this._get("min", "");
      const max = this._get("max", "");
      if (min && dateStr < min || max && dateStr > max) {
        btn.disabled = true;
        btn.classList.add("ar-datepicker__day--disabled");
      } else btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._value = dateStr;
        this._open = false;
        this._emit("change", { value: dateStr, date: /* @__PURE__ */ new Date(dateStr + "T12:00:00") });
        this._build();
      });
    }
  }
};
var DatePickerCSS = `.ar-datepicker{position:relative;user-select:none}.ar-datepicker__label{color:var(--ar-muted);font-size:.78rem;font-weight:500;margin-bottom:4px}.ar-datepicker__trigger{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);cursor:pointer;display:flex;gap:8px;padding:6px 10px;transition:border-color var(--ar-transition)}.ar-datepicker__trigger:hover{border-color:var(--ar-border2)}.ar-datepicker__value{flex:1;font-size:.82rem}.ar-datepicker__placeholder{color:var(--ar-muted)}.ar-datepicker__calendar{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius-lg);box-shadow:var(--ar-shadow-lg);left:0;min-width:264px;padding:10px;position:absolute;top:calc(100% + 4px);z-index:500}.ar-datepicker__cal-header{align-items:center;display:flex;justify-content:space-between;margin-bottom:8px}.ar-datepicker__nav{background:none;border:none;color:var(--ar-text);cursor:pointer;font-size:1rem;padding:4px 8px;border-radius:var(--ar-radius-sm)}.ar-datepicker__nav:hover{background:var(--ar-bg4)}.ar-datepicker__cal-title{font-size:.85rem;font-weight:600}.ar-datepicker__grid{display:grid;gap:2px;grid-template-columns:repeat(7,1fr)}.ar-datepicker__day-name{color:var(--ar-muted);font-size:.68rem;font-weight:600;padding:4px;text-align:center}.ar-datepicker__day{background:none;border:none;border-radius:var(--ar-radius-sm);color:var(--ar-text);cursor:pointer;font:inherit;font-size:.78rem;padding:5px 2px;text-align:center;transition:background var(--ar-transition)}.ar-datepicker__day:hover:not(:disabled){background:var(--ar-bg4)}.ar-datepicker__day--selected{background:var(--ar-primary)!important;color:var(--ar-primary-text)}.ar-datepicker__day--today{border:1px solid var(--ar-primary);color:var(--ar-primary)}.ar-datepicker__day--today.ar-datepicker__day--selected{color:var(--ar-primary-text)}.ar-datepicker__day--disabled{color:var(--ar-dim);cursor:not-allowed}.ar-datepicker__day--empty{visibility:hidden}`;

// components/inputs/Dropdown.ts
var Dropdown = class extends Control {
  _options = [];
  _value = "";
  _open = false;
  _filter = "";
  constructor(container = null, opts = {}) {
    super(container, "div", { placeholder: "Select\u2026", searchable: false, clearable: false, ...opts });
    this.el.className = `ar-dropdown${opts.class ? " " + opts.class : ""}`;
    this._on(document, "click", (e) => {
      if (!this.el.contains(e.target)) this._closeList();
    });
  }
  set options(v) {
    this._options = v;
    this._set("options", v);
  }
  set value(v) {
    this._value = v;
    this._build();
  }
  get value() {
    return this._value;
  }
  get selectedOption() {
    return this._options.find((o) => o.value === this._value);
  }
  _closeList() {
    this._open = false;
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    const sel = this.selectedOption;
    const trigger = this._el("div", "ar-dropdown__trigger", this.el);
    if (sel?.icon) this._el("span", "ar-dropdown__icon", trigger).textContent = sel.icon;
    const lbl = this._el("span", "ar-dropdown__value", trigger);
    lbl.textContent = sel?.label ?? this._get("placeholder", "Select\u2026");
    if (!sel) lbl.classList.add("ar-dropdown__placeholder");
    if (this._get("clearable", false) && sel) {
      const x = this._el("button", "ar-dropdown__clear", trigger);
      x.textContent = "\u2715";
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        this._value = "";
        this._emit("change", { value: "", option: null });
        this._build();
      });
    }
    this._el("span", "ar-dropdown__arrow", trigger).textContent = this._open ? "\u25BE" : "\u25B8";
    if (!this._get("disabled", false)) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        this._open = !this._open;
        this._build();
      });
    }
    if (this._open) {
      const list = this._el("div", "ar-dropdown__list", this.el);
      if (this._get("searchable", false)) {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "ar-dropdown__search";
        inp.placeholder = "Search\u2026";
        inp.value = this._filter;
        inp.addEventListener("input", () => {
          this._filter = inp.value;
          this._renderOptions(list);
        });
        inp.addEventListener("click", (e) => e.stopPropagation());
        list.appendChild(inp);
        setTimeout(() => inp.focus(), 0);
      }
      this._renderOptions(list);
    }
  }
  _renderOptions(list) {
    list.querySelectorAll(".ar-dropdown__option").forEach((e) => e.remove());
    const q = this._filter.toLowerCase();
    const filtered = q ? this._options.filter((o) => o.label.toLowerCase().includes(q)) : this._options;
    filtered.forEach((opt) => {
      const row = this._el("div", `ar-dropdown__option${opt.value === this._value ? " ar-dropdown__option--active" : ""}${opt.disabled ? " ar-dropdown__option--disabled" : ""}`, list);
      if (opt.icon) this._el("span", "", row).textContent = opt.icon;
      this._el("span", "", row).textContent = opt.label;
      if (!opt.disabled) row.addEventListener("click", (e) => {
        e.stopPropagation();
        this._value = opt.value;
        this._filter = "";
        this._open = false;
        this._emit("change", { value: opt.value, option: opt });
        this._build();
      });
    });
  }
};
var DropdownCSS = `.ar-dropdown{position:relative;user-select:none}.ar-dropdown__trigger{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);cursor:pointer;display:flex;gap:6px;padding:6px 10px;transition:border-color var(--ar-transition)}.ar-dropdown__trigger:hover{border-color:var(--ar-border2)}.ar-dropdown__value{flex:1;font-size:.82rem}.ar-dropdown__placeholder{color:var(--ar-muted)}.ar-dropdown__arrow{color:var(--ar-muted);font-size:.7rem}.ar-dropdown__clear{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.8rem;line-height:1;padding:0}.ar-dropdown__list{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);box-shadow:var(--ar-shadow-lg);left:0;max-height:240px;overflow-y:auto;padding:4px 0;position:absolute;right:0;top:calc(100% + 4px);z-index:500}.ar-dropdown__search{border:none;border-bottom:1px solid var(--ar-border);color:var(--ar-text);display:block;font:inherit;font-size:.82rem;outline:none;padding:7px 12px;width:100%;background:transparent}.ar-dropdown__option{align-items:center;cursor:pointer;display:flex;font-size:.82rem;gap:6px;padding:7px 12px;transition:background var(--ar-transition)}.ar-dropdown__option:hover{background:var(--ar-bg4)}.ar-dropdown__option--active{color:var(--ar-primary);font-weight:500}.ar-dropdown__option--disabled{opacity:.4;cursor:not-allowed}`;

// components/inputs/FileUpload.ts
var FileUpload = class extends Control {
  _files = [];
  _dragging = false;
  constructor(container = null, opts = {}) {
    super(container, "div", opts);
    this.el.className = `ar-fileupload${opts.class ? " " + opts.class : ""}`;
  }
  get files() {
    return this._files;
  }
  clear() {
    this._files = [];
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    const zone = this._el("div", `ar-fileupload__zone${this._dragging ? " ar-fileupload__zone--over" : ""}`, this.el);
    this._el("div", "ar-fileupload__icon", zone).textContent = "\u{1F4C1}";
    const lbl = this._get("label", "Drop files here or click to browse");
    this._el("div", "ar-fileupload__label", zone).textContent = lbl;
    const hint = this._get("hint", "");
    if (hint) this._el("div", "ar-fileupload__hint", zone).textContent = hint;
    const input = document.createElement("input");
    input.type = "file";
    input.className = "ar-fileupload__input";
    const accept = this._get("accept", "");
    if (accept) input.accept = accept;
    input.multiple = this._get("multiple", false);
    input.disabled = this._get("disabled", false);
    input.addEventListener("change", () => {
      if (input.files) {
        this._files = Array.from(input.files);
        this._emit("change", { files: this._files });
        this._build();
      }
    });
    zone.appendChild(input);
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this._dragging = true;
      zone.classList.add("ar-fileupload__zone--over");
    });
    zone.addEventListener("dragleave", () => {
      this._dragging = false;
      zone.classList.remove("ar-fileupload__zone--over");
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      this._dragging = false;
      zone.classList.remove("ar-fileupload__zone--over");
      if (e.dataTransfer?.files) {
        this._files = Array.from(e.dataTransfer.files);
        this._emit("change", { files: this._files });
        this._build();
      }
    });
    if (this._files.length) {
      const list = this._el("ul", "ar-fileupload__list", this.el);
      this._files.forEach((f) => {
        const li = this._el("li", "ar-fileupload__file", list);
        li.textContent = `${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
      });
    }
  }
};
var FileUploadCSS = `.ar-fileupload{display:flex;flex-direction:column;gap:8px}.ar-fileupload__zone{align-items:center;border:2px dashed var(--ar-border);border-radius:var(--ar-radius-lg);cursor:pointer;display:flex;flex-direction:column;gap:6px;padding:28px 16px;position:relative;text-align:center;transition:border-color var(--ar-transition),background var(--ar-transition)}.ar-fileupload__zone:hover,.ar-fileupload__zone--over{border-color:var(--ar-primary);background:rgba(126,184,247,.04)}.ar-fileupload__icon{font-size:2rem}.ar-fileupload__label{font-size:.83rem}.ar-fileupload__hint{color:var(--ar-muted);font-size:.74rem}.ar-fileupload__input{cursor:pointer;height:100%;left:0;opacity:0;position:absolute;top:0;width:100%}.ar-fileupload__list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}.ar-fileupload__file{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius-sm);font-size:.78rem;padding:4px 10px}`;

// components/inputs/Radio.ts
var Radio = class extends Control {
  _options = [];
  _value = "";
  _name = "ar-radio-" + Math.random().toString(36).slice(2, 7);
  constructor(container = null, opts = {}) {
    super(container, "div", { direction: "column", ...opts });
    this.el.className = `ar-radio-group${opts.class ? " " + opts.class : ""}`;
  }
  set options(v) {
    this._options = v;
    this._set("options", v);
  }
  set value(v) {
    this._value = v;
    this._build();
  }
  get value() {
    return this._value;
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("div", "ar-radio-group__label", this.el).textContent = lbl;
    const wrap = this._el("div", `ar-radio-group__items ar-radio-group__items--${this._get("direction", "column")}`, this.el);
    this._options.forEach((opt) => {
      const label = this._el("label", `ar-radio${opt.disabled ? " ar-radio--disabled" : ""}`, wrap);
      const input = document.createElement("input");
      input.type = "radio";
      input.className = "ar-radio__input";
      input.name = this._name;
      input.value = opt.value;
      input.checked = opt.value === this._value;
      input.disabled = !!opt.disabled;
      input.addEventListener("change", () => {
        if (input.checked) {
          this._value = opt.value;
          this._emit("change", { value: opt.value });
        }
      });
      label.appendChild(input);
      this._el("span", "ar-radio__circle", label);
      this._el("span", "ar-radio__label", label).textContent = opt.label;
    });
  }
};
var RadioCSS = `.ar-radio-group__label{color:var(--ar-muted);font-size:.78rem;font-weight:500;margin-bottom:6px}.ar-radio-group__items{display:flex;gap:8px}.ar-radio-group__items--column{flex-direction:column}.ar-radio{align-items:center;cursor:pointer;display:inline-flex;gap:8px;user-select:none}.ar-radio__input{height:0;opacity:0;position:absolute;width:0}.ar-radio__circle{background:var(--ar-bg3);border:1.5px solid var(--ar-border);border-radius:50%;flex-shrink:0;height:16px;position:relative;transition:all var(--ar-transition);width:16px}.ar-radio__input:checked+.ar-radio__circle{border-color:var(--ar-primary)}.ar-radio__input:checked+.ar-radio__circle::after{background:var(--ar-primary);border-radius:50%;content:'';height:8px;left:3px;position:absolute;top:3px;width:8px}.ar-radio__label{font-size:.82rem}.ar-radio--disabled{opacity:.5;cursor:not-allowed}`;

// components/inputs/RangeSlider.ts
var RangeSlider = class extends Control {
  _value = 0;
  _input;
  constructor(container = null, opts = {}) {
    super(container, "div", { min: 0, max: 100, step: 1, showValue: true, ...opts });
    this.el.className = `ar-slider${opts.class ? " " + opts.class : ""}`;
  }
  set value(v) {
    this._value = v;
    if (this._input) this._input.value = String(v);
  }
  get value() {
    return Number(this._input?.value ?? this._value);
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("div", "ar-slider__label", this.el).textContent = lbl;
    const wrap = this._el("div", "ar-slider__wrap", this.el);
    this._input = document.createElement("input");
    this._input.type = "range";
    this._input.className = "ar-slider__input";
    this._input.min = String(this._get("min", 0));
    this._input.max = String(this._get("max", 100));
    this._input.step = String(this._get("step", 1));
    this._input.value = String(this._value);
    this._input.disabled = this._get("disabled", false);
    const val = this._get("showValue", true) ? this._el("span", "ar-slider__value", wrap) : null;
    if (val) val.textContent = String(this._value);
    this._input.addEventListener("input", () => {
      this._value = Number(this._input.value);
      if (val) val.textContent = String(this._value);
      this._emit("input", { value: this._value });
    });
    this._input.addEventListener("change", () => this._emit("change", { value: this.value }));
    wrap.insertBefore(this._input, val ?? null);
  }
};
var RangeSliderCSS = `.ar-slider{display:flex;flex-direction:column;gap:4px}.ar-slider__label{color:var(--ar-muted);font-size:.78rem}.ar-slider__wrap{align-items:center;display:flex;gap:10px}.ar-slider__input{accent-color:var(--ar-primary);flex:1;cursor:pointer}.ar-slider__value{color:var(--ar-primary);font-size:.82rem;font-weight:600;min-width:32px;text-align:right}`;

// components/inputs/Rating.ts
var Rating = class extends Control {
  _value = 0;
  _hover = 0;
  constructor(container = null, opts = {}) {
    super(container, "div", { max: 5, icon: "\u2605", emptyIcon: "\u2606", ...opts });
    this.el.className = `ar-rating${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("role", "slider");
  }
  set value(v) {
    this._value = v;
    this._build();
  }
  get value() {
    return this._value;
  }
  _build() {
    this.el.innerHTML = "";
    const max = this._get("max", 5);
    const ro = this._get("readonly", false);
    const icon = this._get("icon", "\u2605");
    const empty = this._get("emptyIcon", "\u2606");
    for (let i = 1; i <= max; i++) {
      const filled = i <= (this._hover || this._value);
      const star = this._el("span", `ar-rating__star${filled ? " ar-rating__star--filled" : ""}`, this.el);
      star.textContent = filled ? icon : empty;
      if (!ro) {
        star.addEventListener("click", () => {
          this._value = i;
          this._emit("change", { value: i });
          this._build();
        });
        star.addEventListener("mouseenter", () => {
          this._hover = i;
          this._build();
        });
        star.addEventListener("mouseleave", () => {
          this._hover = 0;
          this._build();
        });
      }
    }
  }
};
var RatingCSS = `.ar-rating{display:inline-flex;gap:2px}.ar-rating__star{color:var(--ar-dim);cursor:pointer;font-size:1.3rem;transition:color var(--ar-transition),transform var(--ar-transition)}.ar-rating__star--filled{color:var(--ar-warning)}.ar-rating__star:hover{transform:scale(1.15)}`;

// components/inputs/SearchBar.ts
var SearchBar = class extends Control {
  _value = "";
  _timer = 0;
  _input;
  constructor(container = null, opts = {}) {
    super(container, "div", { placeholder: "Search\u2026", debounce: 300, ...opts });
    this.el.className = `ar-searchbar${opts.class ? " " + opts.class : ""}`;
  }
  set value(v) {
    this._value = v;
    if (this._input) this._input.value = v;
  }
  get value() {
    return this._input?.value ?? this._value;
  }
  focus() {
    this._input?.focus();
  }
  clear() {
    this._value = "";
    if (this._input) this._input.value = "";
    this._emit("search", { value: "" });
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    this._el("span", "ar-searchbar__icon", this.el).textContent = "\u{1F50D}";
    this._input = document.createElement("input");
    this._input.type = "text";
    this._input.className = "ar-searchbar__input";
    this._input.placeholder = this._get("placeholder", "Search\u2026");
    this._input.value = this._value;
    const clear = this._el("button", "ar-searchbar__clear", this.el);
    clear.textContent = "\u2715";
    clear.style.visibility = this._value ? "visible" : "hidden";
    this._input.addEventListener("input", () => {
      const v = this._input.value;
      clear.style.visibility = v ? "visible" : "hidden";
      clearTimeout(this._timer);
      this._timer = window.setTimeout(() => {
        this._value = v;
        this._emit("search", { value: v });
      }, this._get("debounce", 300));
    });
    clear.addEventListener("click", () => {
      this._input.value = "";
      this._value = "";
      clear.style.visibility = "hidden";
      this._emit("search", { value: "" });
      this._input.focus();
    });
    this.el.insertBefore(this._input, clear);
  }
};
var SearchBarCSS = `.ar-searchbar{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:20px;display:flex;gap:6px;padding:5px 12px;transition:border-color var(--ar-transition)}.ar-searchbar:focus-within{border-color:var(--ar-primary)}.ar-searchbar__icon{color:var(--ar-muted);flex-shrink:0}.ar-searchbar__input{background:none;border:none;color:var(--ar-text);flex:1;font:inherit;font-size:.82rem;min-width:0;outline:none}.ar-searchbar__clear{background:none;border:none;color:var(--ar-muted);cursor:pointer;flex-shrink:0;font-size:.8rem;line-height:1;padding:0}`;

// components/inputs/Switch.ts
var Switch = class extends Control {
  _checked = false;
  _input;
  constructor(container = null, opts = {}) {
    super(container, "label", opts);
    this.el.className = `ar-switch${opts.labelPosition === "left" ? " ar-switch--label-left" : ""}${opts.class ? " " + opts.class : ""}`;
  }
  set checked(v) {
    this._checked = v;
    if (this._input) this._input.checked = v;
  }
  get checked() {
    return this._input?.checked ?? this._checked;
  }
  set disabled(v) {
    if (this._input) this._input.disabled = v;
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    const pos = this._get("labelPosition", "right");
    if (lbl && pos === "left") this._el("span", "ar-switch__label", this.el).textContent = lbl;
    this._input = document.createElement("input");
    this._input.type = "checkbox";
    this._input.className = "ar-switch__input";
    this._input.checked = this._checked;
    this._input.disabled = this._get("disabled", false);
    this._input.addEventListener("change", () => {
      this._checked = this._input.checked;
      this._emit("change", { checked: this._checked });
    });
    this.el.appendChild(this._input);
    this._el("span", "ar-switch__track", this.el);
    if (lbl && pos !== "left") this._el("span", "ar-switch__label", this.el).textContent = lbl;
  }
};
var SwitchCSS = `.ar-switch{align-items:center;cursor:pointer;display:inline-flex;gap:8px;user-select:none}.ar-switch--label-left{flex-direction:row-reverse}.ar-switch__input{height:0;opacity:0;position:absolute;width:0}.ar-switch__track{background:var(--ar-bg4);border-radius:12px;flex-shrink:0;height:22px;position:relative;transition:background var(--ar-transition);width:40px}.ar-switch__track::after{background:#fff;border-radius:50%;content:'';height:16px;left:3px;position:absolute;top:3px;transition:transform var(--ar-transition);width:16px}.ar-switch__input:checked+.ar-switch__track{background:var(--ar-primary)}.ar-switch__input:checked+.ar-switch__track::after{transform:translateX(18px)}.ar-switch__label{font-size:.82rem}`;

// components/inputs/TextField.ts
var TextField = class extends Control {
  _value = "";
  _error = "";
  _input;
  constructor(container = null, opts = {}) {
    super(container, "div", { type: "text", ...opts });
    this.el.className = `ar-textfield${opts.class ? " " + opts.class : ""}`;
  }
  set value(v) {
    this._value = v;
    if (this._input) this._input.value = v;
  }
  get value() {
    return this._input?.value ?? this._value;
  }
  set error(v) {
    this._error = v;
    this.el.classList.toggle("ar-textfield--error", !!v);
    const e = this.el.querySelector(".ar-textfield__error");
    if (e) e.textContent = v;
    else this._build();
  }
  set disabled(v) {
    if (this._input) this._input.disabled = v;
  }
  focus() {
    this._input?.focus();
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("label", "ar-textfield__label", this.el).textContent = lbl;
    const wrap = this._el("div", "ar-textfield__wrap", this.el);
    const pfx = this._get("prefix", "");
    if (pfx) this._el("span", "ar-textfield__prefix", wrap).textContent = pfx;
    this._input = document.createElement("input");
    this._input.className = "ar-textfield__input";
    this._input.type = this._get("type", "text");
    this._input.placeholder = this._get("placeholder", "");
    this._input.value = this._value;
    this._input.readOnly = this._get("readonly", false);
    this._input.disabled = this._get("disabled", false);
    const ml = this._get("maxlength", 0);
    if (ml) this._input.maxLength = ml;
    this._input.addEventListener("input", () => {
      this._value = this._input.value;
      this._emit("input", { value: this._value });
    });
    this._input.addEventListener("change", () => this._emit("change", { value: this._input.value }));
    wrap.appendChild(this._input);
    const sfx = this._get("suffix", "");
    if (sfx) this._el("span", "ar-textfield__suffix", wrap).textContent = sfx;
    const hint = this._get("hint", "");
    if (hint) this._el("div", "ar-textfield__hint", this.el).textContent = hint;
    if (this._error) this._el("div", "ar-textfield__error", this.el).textContent = this._error;
  }
};
var TextFieldCSS = `.ar-textfield{display:flex;flex-direction:column;gap:4px}.ar-textfield__label{color:var(--ar-muted);font-size:.78rem;font-weight:500}.ar-textfield__wrap{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);display:flex;transition:border-color var(--ar-transition)}.ar-textfield__wrap:focus-within{border-color:var(--ar-primary)}.ar-textfield--error .ar-textfield__wrap{border-color:var(--ar-danger)}.ar-textfield__input{background:none;border:none;color:var(--ar-text);flex:1;font:inherit;font-size:.82rem;outline:none;padding:6px 10px}.ar-textfield__prefix,.ar-textfield__suffix{color:var(--ar-muted);font-size:.82rem;padding:0 8px;flex-shrink:0}.ar-textfield__hint{color:var(--ar-muted);font-size:.74rem}.ar-textfield__error{color:var(--ar-danger);font-size:.74rem}`;

// components/inputs/TimePicker.ts
var TimePicker = class extends Control {
  _value = "";
  _input;
  constructor(container = null, opts = {}) {
    super(container, "div", { seconds: false, ...opts });
    this.el.className = `ar-timepicker${opts.class ? " " + opts.class : ""}`;
  }
  set value(v) {
    this._value = v;
    if (this._input) this._input.value = v;
  }
  get value() {
    return this._input?.value ?? this._value;
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("div", "ar-timepicker__label", this.el).textContent = lbl;
    const wrap = this._el("div", "ar-timepicker__wrap", this.el);
    this._el("span", "ar-timepicker__icon", wrap).textContent = "\u{1F550}";
    this._input = document.createElement("input");
    this._input.type = "time";
    this._input.className = "ar-timepicker__input";
    this._input.value = this._value;
    this._input.disabled = this._get("disabled", false);
    if (this._get("seconds", false)) this._input.step = "1";
    const min = this._get("min", "");
    if (min) this._input.min = min;
    const max = this._get("max", "");
    if (max) this._input.max = max;
    this._input.addEventListener("change", () => {
      this._value = this._input.value;
      this._emit("change", { value: this._value });
    });
    wrap.appendChild(this._input);
  }
};
var TimePickerCSS = `.ar-timepicker{display:flex;flex-direction:column;gap:4px}.ar-timepicker__label{color:var(--ar-muted);font-size:.78rem;font-weight:500}.ar-timepicker__wrap{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);display:flex;gap:8px;padding:5px 10px;transition:border-color var(--ar-transition)}.ar-timepicker__wrap:focus-within{border-color:var(--ar-primary)}.ar-timepicker__icon{flex-shrink:0}.ar-timepicker__input{background:none;border:none;color:var(--ar-text);font:inherit;font-size:.82rem;outline:none}`;

// components/display/Avatar.ts
var Avatar = class extends Control {
  _src = "";
  _name = "";
  _icon = "";
  constructor(container = null, opts = {}) {
    super(container, "div", { size: 36, shape: "circle", ...opts });
    const s = opts.size ?? 36;
    this.el.className = `ar-avatar ar-avatar--${opts.shape ?? "circle"}${opts.class ? " " + opts.class : ""}`;
    this.el.style.cssText += `;width:${s}px;height:${s}px;font-size:${Math.round(s * 0.38)}px`;
  }
  set src(v) {
    this._src = v;
    this._build();
  }
  set name(v) {
    this._name = v;
    this._build();
  }
  set icon(v) {
    this._icon = v;
    this._build();
  }
  set status(v) {
    this._set("status", v);
    this._build();
  }
  _initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }
  _build() {
    this.el.innerHTML = "";
    if (this._src) {
      const img = document.createElement("img");
      img.src = this._src;
      img.alt = this._name;
      img.className = "ar-avatar__img";
      this.el.appendChild(img);
    } else if (this._name) this._el("span", "ar-avatar__initials", this.el).textContent = this._initials(this._name);
    else if (this._icon) this._el("span", "ar-avatar__icon", this.el).textContent = this._icon;
    const s = this._get("status", "");
    if (s) this._el("span", `ar-avatar__status ar-avatar__status--${s}`, this.el);
  }
};
var AvatarCSS = `.ar-avatar{align-items:center;background:var(--ar-bg4);display:inline-flex;flex-shrink:0;font-weight:600;justify-content:center;overflow:hidden;position:relative}.ar-avatar--circle{border-radius:50%}.ar-avatar--square{border-radius:0}.ar-avatar--rounded{border-radius:var(--ar-radius)}.ar-avatar__img{height:100%;object-fit:cover;width:100%}.ar-avatar__status{border:2px solid var(--ar-bg);border-radius:50%;bottom:1px;height:10px;position:absolute;right:1px;width:10px}.ar-avatar__status--online{background:var(--ar-success)}.ar-avatar__status--offline{background:var(--ar-dim)}.ar-avatar__status--busy{background:var(--ar-danger)}.ar-avatar__status--away{background:var(--ar-warning)}`;

// components/display/Badge.ts
var Badge = class extends Control {
  _label = "";
  constructor(container = null, opts = {}) {
    super(container, "span", opts);
    this.el.className = `ar-badge ar-badge--${opts.variant ?? "default"}${opts.dot ? " ar-badge--dot" : ""}${opts.class ? " " + opts.class : ""}`;
  }
  set label(v) {
    this._label = v;
    this._build();
  }
  get label() {
    return this._label;
  }
  _build() {
    if (!this._get("dot", false)) this.el.textContent = this._label;
  }
};
var BadgeCSS = `.ar-badge{border-radius:10px;display:inline-flex;align-items:center;font-size:.72rem;font-weight:600;padding:2px 8px;white-space:nowrap}.ar-badge--default{background:var(--ar-bg4);color:var(--ar-text)}.ar-badge--primary{background:var(--ar-primary);color:var(--ar-primary-text)}.ar-badge--success{background:var(--ar-success);color:#fff}.ar-badge--warning{background:var(--ar-warning);color:#000}.ar-badge--danger{background:var(--ar-danger);color:#fff}.ar-badge--info{background:var(--ar-info);color:#000}.ar-badge--dot{border-radius:50%;height:8px;min-width:8px;padding:0;width:8px}`;

// components/display/Banner.ts
var Banner = class extends Control {
  _message = "";
  _action = "";
  constructor(container = null, opts = {}) {
    super(container, "div", { variant: "default", dismissible: true, ...opts });
    this.el.className = `ar-banner ar-banner--${opts.variant ?? "default"}${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("role", "alert");
  }
  set message(v) {
    this._message = v;
    this._build();
  }
  set action(v) {
    this._action = v;
    this._build();
  }
  dismiss() {
    this.el.style.display = "none";
    this._emit("dismiss", {});
  }
  _build() {
    this.el.innerHTML = "";
    const icon = this._get("icon", "");
    if (icon) this._el("span", "ar-banner__icon", this.el).textContent = icon;
    this._el("span", "ar-banner__msg", this.el).textContent = this._message;
    if (this._action) {
      const btn = this._el("button", "ar-banner__action", this.el);
      btn.textContent = this._action;
      btn.addEventListener("click", () => this._emit("action", {}));
    }
    if (this._get("dismissible", true)) {
      const x = this._el("button", "ar-banner__close", this.el);
      x.textContent = "\u2715";
      x.addEventListener("click", () => this.dismiss());
    }
  }
};
var BannerCSS = `.ar-banner{align-items:center;display:flex;gap:10px;padding:10px 16px;font-size:.83rem}.ar-banner--default{background:var(--ar-bg3);border-bottom:1px solid var(--ar-border)}.ar-banner--info{background:rgba(77,208,225,.12);border-bottom:1px solid var(--ar-info)}.ar-banner--success{background:rgba(76,175,80,.12);border-bottom:1px solid var(--ar-success)}.ar-banner--warning{background:rgba(255,152,0,.12);border-bottom:1px solid var(--ar-warning)}.ar-banner--danger{background:rgba(244,67,54,.12);border-bottom:1px solid var(--ar-danger)}.ar-banner__msg{flex:1}.ar-banner__action{background:none;border:none;color:var(--ar-primary);cursor:pointer;font:inherit;font-size:.78rem;font-weight:600;text-decoration:underline}.ar-banner__close{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.85rem;margin-left:auto}.ar-banner__icon{flex-shrink:0}`;

// components/display/Divider.ts
var Divider = class extends Control {
  constructor(container = null, opts = {}) {
    super(container, "div", { orientation: "horizontal", variant: "solid", ...opts });
    this.el.className = `ar-divider ar-divider--${opts.orientation ?? "horizontal"} ar-divider--${opts.variant ?? "solid"}${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("role", "separator");
  }
  set label(v) {
    this._set("label", v);
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    this._el("span", "ar-divider__line", this.el);
    if (lbl) this._el("span", "ar-divider__label", this.el).textContent = lbl;
    if (lbl) this._el("span", "ar-divider__line", this.el);
  }
};
var DividerCSS = `.ar-divider{display:flex;align-items:center;gap:10px}.ar-divider--horizontal{width:100%}.ar-divider--vertical{align-self:stretch;flex-direction:column;width:auto}.ar-divider__line{border-top:1px solid var(--ar-border);flex:1}.ar-divider--vertical .ar-divider__line{border-top:none;border-left:1px solid var(--ar-border);flex:1}.ar-divider--dashed .ar-divider__line{border-style:dashed}.ar-divider--dotted .ar-divider__line{border-style:dotted}.ar-divider__label{color:var(--ar-muted);font-size:.78rem;white-space:nowrap}`;

// components/display/Icon.ts
var Icon = class extends Control {
  _src = "";
  constructor(container = null, opts = {}) {
    super(container, "span", opts);
    this.el.className = `ar-icon${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("aria-hidden", "true");
    if (opts.size) {
      this.el.style.fontSize = opts.size + "px";
      this.el.style.width = opts.size + "px";
      this.el.style.height = opts.size + "px";
    }
    if (opts.color) this.el.style.color = opts.color;
  }
  set src(v) {
    this._src = v;
    this._build();
  }
  get src() {
    return this._src;
  }
  _build() {
    if (this._src.trimStart().startsWith("<")) this.el.innerHTML = this._src;
    else this.el.textContent = this._src;
  }
};
var IconCSS = `.ar-icon{align-items:center;display:inline-flex;flex-shrink:0;justify-content:center;line-height:1}.ar-icon svg{height:1em;width:1em}`;

// components/display/List.ts
var List = class extends Control {
  _items = [];
  _selected = /* @__PURE__ */ new Set();
  constructor(container = null, opts = {}) {
    super(container, "ul", opts);
    this.el.className = `ar-list${opts.dense ? " ar-list--dense" : ""}${opts.divided ? " ar-list--divided" : ""}${opts.class ? " " + opts.class : ""}`;
    this.el.setAttribute("role", opts.selectable ? "listbox" : "list");
  }
  set items(v) {
    this._items = v;
    this._set("items", v);
  }
  get selected() {
    return this._selected;
  }
  clearSelection() {
    this._selected.clear();
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    this._items.forEach((item) => {
      const isOn = this._selected.has(item.id);
      const li = this._el("li", `ar-list__item${isOn ? " ar-list__item--selected" : ""}${item.disabled ? " ar-list__item--disabled" : ""}`, this.el);
      li.setAttribute("role", this._get("selectable", false) ? "option" : "listitem");
      if (item.icon) this._el("span", "ar-list__icon", li).textContent = item.icon;
      const body = this._el("div", "ar-list__body", li);
      this._el("div", "ar-list__label", body).textContent = item.label;
      if (item.subtitle) this._el("div", "ar-list__subtitle", body).textContent = item.subtitle;
      if (item.badge !== void 0) this._el("span", "ar-list__badge", li).textContent = String(item.badge);
      if (item.meta) this._el("span", "ar-list__meta", li).textContent = item.meta;
      if (this._get("selectable", false) && !item.disabled) {
        li.style.cursor = "pointer";
        li.addEventListener("click", () => {
          if (!this._get("multiselect", false)) this._selected.clear();
          if (isOn) this._selected.delete(item.id);
          else this._selected.add(item.id);
          this._build();
          this._emit("select", { item, selected: [...this._selected] });
        });
      }
    });
  }
};
var ListCSS = `.ar-list{list-style:none;margin:0;padding:0}.ar-list--divided .ar-list__item:not(:last-child){border-bottom:1px solid var(--ar-border)}.ar-list__item{align-items:center;display:flex;gap:10px;padding:10px 12px;transition:background var(--ar-transition)}.ar-list--dense .ar-list__item{padding:6px 12px}.ar-list__item:hover:not(.ar-list__item--disabled){background:var(--ar-bg3)}.ar-list__item--selected{background:rgba(126,184,247,.1)}.ar-list__item--disabled{opacity:.45}.ar-list__icon{flex-shrink:0;font-size:1rem}.ar-list__body{flex:1;min-width:0}.ar-list__label{font-size:.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ar-list__subtitle{color:var(--ar-muted);font-size:.74rem;margin-top:1px}.ar-list__badge{background:var(--ar-primary);border-radius:10px;color:var(--ar-primary-text);font-size:.66rem;font-weight:600;padding:1px 6px}.ar-list__meta{color:var(--ar-muted);font-size:.74rem;white-space:nowrap}`;

// components/display/ProgressBar.ts
var ProgressBar = class extends Control {
  _value = 0;
  _indeterminate = false;
  _bar;
  constructor(container = null, opts = {}) {
    super(container, "div", { variant: "default", height: 6, showValue: false, ...opts });
    this.el.className = `ar-progress${opts.class ? " " + opts.class : ""}`;
  }
  set value(v) {
    this._value = Math.max(0, Math.min(100, v));
    this._indeterminate = false;
    if (this._bar) {
      this._bar.style.width = this._value + "%";
      this._bar.classList.remove("ar-progress__bar--indeterminate");
    }
    const lv = this.el.querySelector(".ar-progress__value");
    if (lv) lv.textContent = this._value + "%";
  }
  get value() {
    return this._value;
  }
  set indeterminate(v) {
    this._indeterminate = v;
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    const sv = this._get("showValue", false);
    if (lbl || sv) {
      const row = this._el("div", "ar-progress__header", this.el);
      if (lbl) this._el("span", "ar-progress__label", row).textContent = lbl;
      if (sv) this._el("span", "ar-progress__value", row).textContent = this._value + "%";
    }
    const track = this._el("div", "ar-progress__track", this.el);
    track.style.height = this._get("height", 6) + "px";
    this._bar = this._el("div", `ar-progress__bar ar-progress__bar--${this._get("variant", "default")}${this._indeterminate ? " ar-progress__bar--indeterminate" : ""}`, track);
    this._bar.style.width = this._indeterminate ? "40%" : this._value + "%";
    this._bar.setAttribute("role", "progressbar");
    this._bar.setAttribute("aria-valuenow", String(this._value));
  }
};
var ProgressBarCSS = `.ar-progress{display:flex;flex-direction:column;gap:4px}.ar-progress__header{display:flex;justify-content:space-between;font-size:.78rem}.ar-progress__label{color:var(--ar-muted)}.ar-progress__value{font-weight:500}.ar-progress__track{background:var(--ar-bg4);border-radius:99px;overflow:hidden;width:100%}.ar-progress__bar{border-radius:99px;height:100%;transition:width .3s ease}.ar-progress__bar--default{background:var(--ar-primary)}.ar-progress__bar--success{background:var(--ar-success)}.ar-progress__bar--warning{background:var(--ar-warning)}.ar-progress__bar--danger{background:var(--ar-danger)}.ar-progress__bar--indeterminate{animation:ar-progress-slide 1.4s infinite ease-in-out;width:40%!important}@keyframes ar-progress-slide{0%{transform:translateX(-150%)}100%{transform:translateX(400%)}}`;

// components/display/ProgressCircular.ts
var ProgressCircular = class extends Control {
  _value = 0;
  _indeterminate = false;
  constructor(container = null, opts = {}) {
    super(container, "div", { size: 48, strokeWidth: 4, showValue: false, variant: "default", ...opts });
    this.el.className = `ar-progress-circ${opts.class ? " " + opts.class : ""}`;
  }
  set value(v) {
    this._value = Math.max(0, Math.min(100, v));
    this._indeterminate = false;
    this._build();
  }
  get value() {
    return this._value;
  }
  set indeterminate(v) {
    this._indeterminate = v;
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    const size = this._get("size", 48);
    const sw = this._get("strokeWidth", 4);
    const r = (size - sw) / 2;
    const circ = 2 * Math.PI * r;
    const dash = this._indeterminate ? circ * 0.75 : circ * this._value / 100;
    const variantColors = { default: "var(--ar-primary)", success: "var(--ar-success)", warning: "var(--ar-warning)", danger: "var(--ar-danger)" };
    const color = variantColors[this._get("variant", "default")] ?? "var(--ar-primary)";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.style.width = size + "px";
    svg.style.height = size + "px";
    if (this._indeterminate) svg.classList.add("ar-progress-circ__spin");
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bg.setAttribute("cx", String(size / 2));
    bg.setAttribute("cy", String(size / 2));
    bg.setAttribute("r", String(r));
    bg.setAttribute("fill", "none");
    bg.setAttribute("stroke", "var(--ar-bg4)");
    bg.setAttribute("stroke-width", String(sw));
    svg.appendChild(bg);
    const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    arc.setAttribute("cx", String(size / 2));
    arc.setAttribute("cy", String(size / 2));
    arc.setAttribute("r", String(r));
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", color);
    arc.setAttribute("stroke-width", String(sw));
    arc.setAttribute("stroke-linecap", "round");
    arc.setAttribute("stroke-dasharray", `${dash} ${circ - dash}`);
    arc.setAttribute("stroke-dashoffset", String(circ * 0.25));
    arc.style.transition = "stroke-dasharray .3s ease";
    svg.appendChild(arc);
    this.el.appendChild(svg);
    if (this._get("showValue", false) && !this._indeterminate) {
      const lbl = this._el("div", "ar-progress-circ__label", this.el);
      lbl.textContent = this._value + "%";
      lbl.style.fontSize = Math.round(size * 0.22) + "px";
    }
  }
};
var ProgressCircularCSS = `.ar-progress-circ{display:inline-flex;flex-direction:column;align-items:center;gap:4px;position:relative}.ar-progress-circ__label{color:var(--ar-text);font-weight:600;font-variant-numeric:tabular-nums}.ar-progress-circ__spin{animation:ar-circ-spin 1s linear infinite}@keyframes ar-circ-spin{to{transform:rotate(360deg)}}`;

// components/display/Skeleton.ts
var Skeleton = class extends Control {
  constructor(container = null, opts = {}) {
    super(container, "div", { variant: "text", lines: 3, ...opts });
    this.el.className = `ar-skeleton${opts.class ? " " + opts.class : ""}`;
  }
  _build() {
    this.el.innerHTML = "";
    const v = this._get("variant", "text");
    const w = this._get("width", "");
    const h = this._get("height", "");
    if (v === "circle") {
      const c = this._el("div", "ar-skeleton__circle", this.el);
      if (w) {
        c.style.width = w;
        c.style.height = h || w;
      }
      return;
    }
    if (v === "rect") {
      const r = this._el("div", "ar-skeleton__rect", this.el);
      if (w) r.style.width = w;
      if (h) r.style.height = h;
      return;
    }
    if (v === "card") {
      this._el("div", "ar-skeleton__rect", this.el).style.height = "160px";
      for (let i = 0; i < 3; i++) this._el("div", "ar-skeleton__line", this.el);
      return;
    }
    if (this._get("avatar", false)) {
      const row = this._el("div", "ar-skeleton__row", this.el);
      this._el("div", "ar-skeleton__circle", row);
      const lines = this._el("div", "ar-skeleton__lines", row);
      for (let i = 0; i < 2; i++) {
        const l = this._el("div", "ar-skeleton__line", lines);
        if (i === 1) l.style.width = "60%";
      }
      return;
    }
    const n = this._get("lines", 3);
    for (let i = 0; i < n; i++) {
      const l = this._el("div", "ar-skeleton__line", this.el);
      if (i === n - 1) l.style.width = "60%";
    }
  }
};
var SkeletonCSS = `.ar-skeleton{display:flex;flex-direction:column;gap:8px}.ar-skeleton__row{display:flex;align-items:center;gap:12px}.ar-skeleton__lines{flex:1;display:flex;flex-direction:column;gap:6px}.ar-skeleton__line,.ar-skeleton__rect,.ar-skeleton__circle{animation:ar-shimmer 1.5s infinite ease-in-out;background:linear-gradient(90deg,var(--ar-bg3) 25%,var(--ar-bg4) 50%,var(--ar-bg3) 75%);background-size:200% 100%;border-radius:var(--ar-radius)}.ar-skeleton__line{height:12px;width:100%}.ar-skeleton__rect{height:80px;width:100%}.ar-skeleton__circle{border-radius:50%;flex-shrink:0;height:40px;width:40px}@keyframes ar-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;

// components/display/Snackbar.ts
function getContainer(pos) {
  const id = "ar-snack-" + pos;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = "ar-snackbar-container ar-snackbar-container--" + pos;
    document.body.appendChild(el);
  }
  return el;
}
var Snackbar = class _Snackbar extends Control {
  _timer = 0;
  constructor(opts = {}) {
    super(getContainer(opts.position ?? "bottom-center"), "div", { duration: 4e3, variant: "default", position: "bottom-center", ...opts });
    this.el.className = `ar-snackbar ar-snackbar--${opts.variant ?? "default"}${opts.class ? " " + opts.class : ""}`;
    this.el.style.display = "none";
  }
  set message(v) {
    this._set("message", v);
  }
  show() {
    this.el.style.display = "";
    setTimeout(() => this.el.classList.add("ar-snackbar--on"), 10);
    const dur = this._get("duration", 4e3);
    if (dur > 0) this._timer = window.setTimeout(() => this.hide(), dur);
    this._emit("show", {});
  }
  hide() {
    clearTimeout(this._timer);
    this.el.classList.remove("ar-snackbar--on");
    setTimeout(() => {
      this.el.style.display = "none";
      this._emit("hide", {});
    }, 280);
  }
  _build() {
    this.el.innerHTML = "";
    const msg = this._el("span", "ar-snackbar__msg", this.el);
    msg.textContent = this._get("message", "");
    const action = this._get("action", "");
    if (action) {
      const btn = this._el("button", "ar-snackbar__action", this.el);
      btn.textContent = action;
      btn.addEventListener("click", () => {
        this._emit("action", {});
        this.hide();
      });
    }
    const x = this._el("button", "ar-snackbar__close", this.el);
    x.textContent = "\u2715";
    x.addEventListener("click", () => this.hide());
  }
  static show(message, opts = {}) {
    const sb = new _Snackbar({ message, ...opts });
    sb.show();
    return sb;
  }
};
var SnackbarCSS = `.ar-snackbar-container{display:flex;flex-direction:column;gap:8px;pointer-events:none;position:fixed;z-index:5000;padding:12px;max-width:400px}.ar-snackbar-container--top-left{top:0;left:0}.ar-snackbar-container--top-center{top:0;left:50%;transform:translateX(-50%)}.ar-snackbar-container--top-right{top:0;right:0}.ar-snackbar-container--bottom-left{bottom:0;left:0}.ar-snackbar-container--bottom-center{bottom:0;left:50%;transform:translateX(-50%)}.ar-snackbar-container--bottom-right{bottom:0;right:0}.ar-snackbar{align-items:center;border-radius:var(--ar-radius);box-shadow:var(--ar-shadow-lg);display:flex;gap:10px;opacity:0;padding:10px 14px;pointer-events:all;transform:translateY(6px);transition:opacity .25s,transform .25s;min-width:220px}.ar-snackbar--on{opacity:1;transform:none}.ar-snackbar--default{background:var(--ar-bg4);border:1px solid var(--ar-border)}.ar-snackbar--success{background:var(--ar-success);color:#fff}.ar-snackbar--warning{background:var(--ar-warning);color:#000}.ar-snackbar--danger{background:var(--ar-danger);color:#fff}.ar-snackbar--info{background:var(--ar-info);color:#000}.ar-snackbar__msg{flex:1;font-size:.82rem}.ar-snackbar__action{background:none;border:none;color:inherit;cursor:pointer;font:inherit;font-size:.78rem;font-weight:600;text-decoration:underline}.ar-snackbar__close{background:none;border:none;color:inherit;cursor:pointer;font-size:.8rem;opacity:.7;padding:0}`;

// components/display/Tag.ts
var Tag = class extends Control {
  _items = [];
  constructor(container = null, opts = {}) {
    super(container, "div", { removable: false, ...opts });
    this.el.className = `ar-tag-group${opts.class ? " " + opts.class : ""}`;
  }
  set items(v) {
    this._items = v;
    this._set("items", v);
  }
  get items() {
    return this._items;
  }
  add(item) {
    this._items.push(item);
    this._build();
  }
  remove(item) {
    this._items = this._items.filter((i) => i !== item);
    this._build();
  }
  _build() {
    this.el.innerHTML = "";
    this._items.forEach((item) => {
      const tag = this._el("span", "ar-tag", this.el);
      tag.textContent = item;
      if (this._get("removable", false)) {
        const x = this._el("button", "ar-tag__remove", tag);
        x.textContent = "\u2715";
        x.setAttribute("aria-label", "Remove");
        x.addEventListener("click", () => {
          this.remove(item);
          this._emit("remove", { item });
        });
      }
    });
  }
};
var TagCSS = `.ar-tag-group{display:flex;flex-wrap:wrap;gap:6px}.ar-tag{align-items:center;background:var(--ar-bg4);border:1px solid var(--ar-border);border-radius:var(--ar-radius-sm);color:var(--ar-text);display:inline-flex;font-size:.75rem;gap:4px;padding:2px 8px}.ar-tag__remove{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.7rem;line-height:1;padding:0}.ar-tag__remove:hover{color:var(--ar-danger)}`;

// components/display/Tooltip.ts
var Tooltip = class _Tooltip extends Control {
  _tip;
  _timer = 0;
  constructor(container = null, opts = {}) {
    super(container, "div", { position: "top", delay: 180, ...opts });
    this.el.className = `ar-tooltip-host${opts.class ? " " + opts.class : ""}`;
    this._tip = this._el("div", `ar-tooltip ar-tooltip--${opts.position ?? "top"}`, document.body);
    if (opts.text) this._tip.textContent = opts.text;
    this._on(this.el, "mouseenter", () => {
      clearTimeout(this._timer);
      this._timer = window.setTimeout(() => {
        this._place();
        this._tip.classList.add("ar-tooltip--on");
      }, this._get("delay", 180));
    });
    this._on(this.el, "mouseleave", () => {
      clearTimeout(this._timer);
      this._tip.classList.remove("ar-tooltip--on");
    });
    this._gc(() => this._tip.remove());
  }
  set text(v) {
    this._tip.textContent = v;
  }
  get text() {
    return this._tip.textContent ?? "";
  }
  _place() {
    const r = this.el.getBoundingClientRect();
    const pos = this._get("position", "top");
    const tw = this._tip.offsetWidth || 120;
    const th = this._tip.offsetHeight || 28;
    this._tip.style.left = r.left + r.width / 2 - tw / 2 + "px";
    this._tip.style.top = pos === "bottom" ? r.bottom + 6 + "px" : r.top - th - 6 + "px";
    if (pos === "left") {
      this._tip.style.left = r.left - tw - 6 + "px";
      this._tip.style.top = r.top + r.height / 2 - th / 2 + "px";
    }
    if (pos === "right") {
      this._tip.style.left = r.right + 6 + "px";
      this._tip.style.top = r.top + r.height / 2 - th / 2 + "px";
    }
  }
  _build() {
    if (this._tip) this._tip.textContent = this._get("text", "");
  }
  static attach(el, text, opts = {}) {
    const host = document.createElement("div");
    host.style.display = "contents";
    el.parentElement?.insertBefore(host, el);
    host.appendChild(el);
    return new _Tooltip(host, { text, ...opts });
  }
};
var TooltipCSS = `.ar-tooltip-host{display:contents}.ar-tooltip{background:var(--ar-bg4);border:1px solid var(--ar-border);border-radius:var(--ar-radius-sm);box-shadow:var(--ar-shadow);color:var(--ar-text);font-size:.74rem;max-width:220px;opacity:0;padding:4px 8px;pointer-events:none;position:fixed;transition:opacity .14s;white-space:pre-wrap;z-index:9000}.ar-tooltip--on{opacity:1}`;

// components/charts/BarChart.ts
var BarChart = class extends Control {
  _data = [];
  constructor(container = null, opts = {}) {
    super(container, "div", { height: 220, color: "var(--ar-primary)", showValues: true, ...opts });
    this.el.className = `ar-chart ar-barchart${opts.class ? " " + opts.class : ""}`;
  }
  set data(v) {
    this._data = v;
    this._set("data", v);
  }
  get data() {
    return this._data;
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("div", "ar-chart__title", this.el).textContent = lbl;
    if (!this._data.length) {
      this._el("div", "ar-chart__empty", this.el).textContent = "No data";
      return;
    }
    const h = this._get("height", 220);
    const color = this._get("color", "var(--ar-primary)");
    const sv = this._get("showValues", true);
    const max = Math.max(...this._data.map((d) => d.value));
    const W = this._data.length * 60;
    const padB = 24;
    const padT = 20;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${h}`);
    svg.style.width = "100%";
    svg.style.height = h + "px";
    svg.style.overflow = "visible";
    this._data.forEach((d, i) => {
      const barH = max ? d.value / max * (h - padT - padB) : 0;
      const x = i * 60 + 8;
      const bW = 44;
      const y = h - padB - barH;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(bW));
      rect.setAttribute("height", String(barH));
      rect.setAttribute("fill", d.color ?? color);
      rect.setAttribute("rx", "3");
      rect.style.cursor = "pointer";
      rect.addEventListener("click", () => this._emit("click", { bar: d }));
      svg.appendChild(rect);
      const tLbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tLbl.setAttribute("x", String(x + bW / 2));
      tLbl.setAttribute("y", String(h - 6));
      tLbl.setAttribute("text-anchor", "middle");
      tLbl.setAttribute("fill", "var(--ar-muted)");
      tLbl.setAttribute("font-size", "10");
      tLbl.textContent = d.label;
      svg.appendChild(tLbl);
      if (sv && barH > 12) {
        const tVal = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tVal.setAttribute("x", String(x + bW / 2));
        tVal.setAttribute("y", String(y - 4));
        tVal.setAttribute("text-anchor", "middle");
        tVal.setAttribute("fill", "var(--ar-text)");
        tVal.setAttribute("font-size", "10");
        tVal.textContent = String(d.value);
        svg.appendChild(tVal);
      }
    });
    this.el.appendChild(svg);
  }
};
var BarChartCSS = `.ar-chart{display:flex;flex-direction:column;gap:6px}.ar-chart__title{color:var(--ar-muted);font-size:.78rem;font-weight:500}.ar-chart__empty{color:var(--ar-dim);font-size:.8rem;padding:20px;text-align:center}`;

// components/charts/LineChart.ts
var LineChart = class extends Control {
  _data = [];
  constructor(container = null, opts = {}) {
    super(container, "div", { height: 180, color: "var(--ar-primary)", area: true, showDots: true, smooth: true, ...opts });
    this.el.className = `ar-chart ar-linechart${opts.class ? " " + opts.class : ""}`;
  }
  set data(v) {
    this._data = v;
    this._set("data", v);
  }
  get data() {
    return this._data;
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("div", "ar-chart__title", this.el).textContent = lbl;
    if (this._data.length < 2) {
      this._el("div", "ar-chart__empty", this.el).textContent = "No data";
      return;
    }
    const h = this._get("height", 180);
    const W = 400;
    const pad = 22;
    const max = Math.max(...this._data.map((d2) => d2.value)) || 1;
    const pts = this._data.map((_, i) => ({
      x: pad + i * (W - 2 * pad) / (this._data.length - 1),
      y: pad + (1 - this._data[i].value / max) * (h - 2 * pad)
    }));
    const color = this._get("color", "var(--ar-primary)");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${h}`);
    svg.style.width = "100%";
    svg.style.height = h + "px";
    const smooth = this._get("smooth", true);
    const d = smooth ? "M " + pts.map((p, i) => {
      if (!i) return `${p.x},${p.y}`;
      const prev = pts[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `C ${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
    }).join(" ") : "M " + pts.map((p) => `${p.x},${p.y}`).join(" L ");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    if (this._get("area", true)) {
      const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
      area.setAttribute("d", d + ` L ${pts[pts.length - 1].x},${h - pad} L ${pts[0].x},${h - pad} Z`);
      area.setAttribute("fill", color);
      area.setAttribute("fill-opacity", "0.1");
      svg.appendChild(area);
    }
    if (this._get("showDots", true)) pts.forEach((p) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", String(p.x));
      c.setAttribute("cy", String(p.y));
      c.setAttribute("r", "3");
      c.setAttribute("fill", color);
      svg.appendChild(c);
    });
    const step = Math.max(1, Math.ceil(this._data.length / 6));
    this._data.forEach((dp, i) => {
      if (i % step !== 0 && i !== this._data.length - 1) return;
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(pts[i].x));
      t.setAttribute("y", String(h - 4));
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "9");
      t.setAttribute("fill", "var(--ar-muted)");
      t.textContent = dp.label;
      svg.appendChild(t);
    });
    this.el.appendChild(svg);
  }
};
var LineChartCSS = `.ar-linechart{}`;

// components/charts/PieChart.ts
var PIE_COLORS = ["#7eb8f7", "#4caf50", "#ff9800", "#f44336", "#4dd0e1", "#b39ddb", "#ff7043", "#a5d6a7"];
var PieChart = class extends Control {
  _data = [];
  constructor(container = null, opts = {}) {
    super(container, "div", { size: 180, donut: true, legend: true, ...opts });
    this.el.className = `ar-chart ar-piechart${opts.class ? " " + opts.class : ""}`;
  }
  set data(v) {
    this._data = v;
    this._set("data", v);
  }
  get data() {
    return this._data;
  }
  _build() {
    this.el.innerHTML = "";
    const lbl = this._get("label", "");
    if (lbl) this._el("div", "ar-chart__title", this.el).textContent = lbl;
    if (!this._data.length) {
      this._el("div", "ar-chart__empty", this.el).textContent = "No data";
      return;
    }
    const size = this._get("size", 180);
    const R = size / 2;
    const r = this._get("donut", true) ? R * 0.55 : 0;
    const total = this._data.reduce((s, d) => s + d.value, 0);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.style.width = size + "px";
    svg.style.height = size + "px";
    let angle = -Math.PI / 2;
    this._data.forEach((d, i) => {
      const slice = d.value / total * Math.PI * 2;
      const x1 = R + R * Math.cos(angle);
      const y1 = R + R * Math.sin(angle);
      const x2 = R + R * Math.cos(angle + slice);
      const y2 = R + R * Math.sin(angle + slice);
      const ix1 = R + r * Math.cos(angle);
      const iy1 = R + r * Math.sin(angle);
      const ix2 = R + r * Math.cos(angle + slice);
      const iy2 = R + r * Math.sin(angle + slice);
      const large = slice > Math.PI ? 1 : 0;
      const color = d.color ?? PIE_COLORS[i % PIE_COLORS.length];
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", r > 0 ? `M ${ix1} ${iy1} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z` : `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`);
      path.setAttribute("fill", color);
      path.style.cursor = "pointer";
      path.style.transition = "opacity .15s";
      path.addEventListener("mouseenter", () => path.style.opacity = "0.8");
      path.addEventListener("mouseleave", () => path.style.opacity = "1");
      path.addEventListener("click", () => this._emit("click", { slice: d }));
      svg.appendChild(path);
      angle += slice;
    });
    const wrap = this._el("div", "ar-piechart__wrap", this.el);
    wrap.appendChild(svg);
    if (this._get("legend", true)) {
      const leg = this._el("div", "ar-piechart__legend", this.el);
      this._data.forEach((d, i) => {
        const row = this._el("div", "ar-piechart__legend-row", leg);
        const dot = this._el("span", "ar-piechart__legend-dot", row);
        dot.style.background = d.color ?? PIE_COLORS[i % PIE_COLORS.length];
        this._el("span", "ar-piechart__legend-label", row).textContent = d.label;
        this._el("span", "ar-piechart__legend-value", row).textContent = Math.round(d.value / total * 100) + "%";
      });
    }
  }
};
var PieChartCSS = `.ar-piechart__wrap{display:flex;justify-content:center}.ar-piechart__legend{display:flex;flex-direction:column;gap:5px;margin-top:10px}.ar-piechart__legend-row{align-items:center;display:flex;gap:6px;font-size:.78rem}.ar-piechart__legend-dot{border-radius:50%;flex-shrink:0;height:10px;width:10px}.ar-piechart__legend-label{flex:1}.ar-piechart__legend-value{color:var(--ar-muted)}`;

// components/index.ts
function injectAllCSS() {
  if (document.getElementById("arianna-wip-controls-css")) return;
  const modules = [
    { AccordionCSS: null }
    // populated at runtime via dynamic import or direct usage
  ];
  console.warn("[AriannA] injectAllCSS: call Theme.inject() for base styles, then import and inject individual *CSS consts as needed.");
}
export {
  Accordion,
  Three_default as AriannA3D,
  Animation_default as AriannAAnimation,
  Audio_default as AriannAAudio,
  Geometry_default as AriannAGeometry,
  IO_default as AriannAIO,
  Latex_default as AriannALatex,
  Math_default as AriannAMath,
  Network_default as AriannANetwork,
  SSR_default as AriannASSR,
  AriannATemplate,
  Video_default as AriannAVideo,
  Workers_default as AriannAWorkers,
  Avatar,
  AvatarCSS,
  Badge,
  BadgeCSS,
  Banner,
  BannerCSS,
  BarChart,
  BarChartCSS,
  Breadcrumb,
  BreadcrumbCSS,
  Button,
  ButtonCSS,
  Card,
  CardCSS,
  Checkbox,
  CheckboxCSS,
  Chip,
  ChipCSS,
  ColorPicker,
  ColorPickerCSS,
  Component_default as Component,
  Context_default as Context,
  Control,
  Core_default as Core,
  CssState,
  DatePicker,
  DatePickerCSS,
  Directive_default as Directive,
  Divider,
  DividerCSS,
  Drawer,
  DrawerCSS,
  Dropdown,
  DropdownCSS,
  FileUpload,
  FileUploadCSS,
  Header,
  HeaderCSS,
  Icon,
  IconCSS,
  LineChart,
  LineChartCSS,
  List,
  ListCSS,
  Menu,
  MenuCSS,
  Modal,
  ModalCSS,
  Namespace_default as Namespace,
  NavRail,
  NavRailCSS,
  Observable,
  Pagination,
  PaginationCSS,
  Panel,
  PanelCSS,
  PieChart,
  PieChartCSS,
  ProgressBar,
  ProgressBarCSS,
  ProgressCircular,
  ProgressCircularCSS,
  Radio,
  RadioCSS,
  RangeSlider,
  RangeSliderCSS,
  Rating,
  RatingCSS,
  Real_default as Real,
  Rule,
  SSR_default as SSR,
  SearchBar,
  SearchBarCSS,
  Stylesheet_default as Sheet,
  Skeleton,
  SkeletonCSS,
  Snackbar,
  SnackbarCSS,
  Splitter,
  SplitterCSS,
  State_default as State,
  Stepper,
  StepperCSS,
  Switch,
  SwitchCSS,
  Table,
  Tabs,
  TabsCSS,
  Tag,
  TagCSS,
  TextField,
  TextFieldCSS,
  Theme,
  TimePicker,
  TimePickerCSS,
  Tooltip,
  TooltipCSS,
  TreeView,
  TreeViewCSS,
  Virtual_default as Virtual,
  Virtual_default as VirtualNode,
  WorkerPool,
  Workers,
  batch,
  computed,
  effect,
  injectAllCSS,
  signal,
  signalMono,
  sinkClass,
  sinkText,
  untrack,
  uuid2 as uuid
};
/**
 * @module    SSR
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2026
 * @license   MIT / Commercial (dual license)
 *
 * Copyright (c) 2012-2026 Riccardo Angeli
 * MIT License — see AriannA.ts for full text.
 *
 * Server-side rendering for AriannA.
 * Works in Node.js, Deno, Bun, and Rust (via Axum + Workers bridge).
 *
 * ── FEATURES ──────────────────────────────────────────────────────────────────
 *
 *   renderToString   — synchronous VirtualNode tree → HTML string
 *   renderToStream   — streaming HTML via async generator (chunked for Axum)
 *   hydrate          — attach live AriannA state to server-rendered HTML
 *   Island           — mark selective subtrees for client hydration only
 *   escapeHtml       — XSS-safe attribute/text escaping (exported utility)
 *
 * ── INTEGRATION ───────────────────────────────────────────────────────────────
 *
 *   Node.js (Express/Fastify):
 *     import { renderToString } from './SSR.ts';
 *     app.get('/', (req, res) => res.send(renderToString(appNode)));
 *
 *   Bun / Deno:
 *     import { renderToStream } from './SSR.ts';
 *     return new Response(readableFromAsyncGen(renderToStream(appNode)));
 *
 *   Rust / Axum (via Workers bridge):
 *     Workers pool runs SSR.ts in parallel; Axum streams the chunks.
 *     See Workers.ts → WorkerPool for the bridge pattern.
 *
 *   Browser (hydration):
 *     import { hydrate } from './SSR.ts';
 *     hydrate(appNode, document.getElementById('app'), appState);
 *
 * ── ISLAND ARCHITECTURE ───────────────────────────────────────────────────────
 *
 *   Islands = only some parts of the page are interactive.
 *   Static parts are rendered server-side and never hydrated.
 *   Interactive parts (islands) are hydrated client-side.
 *
 *   Usage:
 *     const page = Virtual('div', {},
 *       Island.static(headerNode),           // SSR only, no client JS
 *       Island.interactive(counterNode, id), // hydrated on client
 *     );
 *
 * ── PERFORMANCE NOTES ─────────────────────────────────────────────────────────
 *
 *   renderToString:  ~2-5ms for 1000-node trees (no DOM API calls — pure string concat)
 *   renderToStream:  first byte < 1ms — chunks emitted as nodes are processed
 *   hydrate:         O(n) walk, uses data-arianna-wip-id for node matching
 */
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
/**
 * @module    Math
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * Migrated and extended from Golem.Math (2012-2018).
 * Every class and function from the original is preserved.
 * New additions: Vector2/3/4, Quaternion, Matrix4, LinearFunction,
 * QuadraticFunction, Complex, Statistics.
 * Dedicated with love to Arianna. ♡
 *
 * @example
 *   import { Math, MathConstants, Fraction, Vector3 } from "./Math.ts";
 *   Core.use(Math);
 *
 *   // Original Golem API
 *   const f = new Fraction(3, 4);
 *   f.Sum(new Fraction(1, 4)).toString();  // "1/1"
 *
 *   // New AriannA API
 *   const v = new Vector3(1, 2, 3);
 *   const m = Matrix4.perspective(Math.PI/4, 16/9, 0.1, 1000);
 */
/**
 * @module    Geometry
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * Migrated and extended from Golem.Geometry (2012-2018).
 *
 * ── Original Golem classes preserved ──────────────────────────────────────────
 *
 *   Angle     — full unit system: Radians, Degrees, Turns, Quadrants,
 *               Grads, Mils, Sextants, Points, BinaryDegrees, Hours,
 *               Minutes, Seconds + all trig values
 *   Rotation  — 3D rotation with Psi/Theta/Phi (Euler angles)
 *   Size      — Width/Height/Depth
 *   Point     — X/Y/Z coordinate
 *   Vector    — N-dimensional vector (Sum, Subtract, Dot, Cross, Normalize)
 *   Vector2d  → now exported as Vector2 (see Math.ts)
 *   Vector3d  → now exported as Vector3 (see Math.ts)
 *   Matrix    — full NxN matrix with LUP, QR, EigenValues, EigenVectors
 *   Transform — CSS/3D transform (Translate, Scale, Rotate, Skew, Reflect)
 *   Shapes    — Rectangle, Line, Curve, Path, Triangle, Circle, Plane, Polygon
 *   Solids    — Frustum, TetraHedron, Pyramid, Box, Sphere, Octahedron,
 *               Torus, ChamferBox, Cylinder, Tube
 *
 * ── New additions ─────────────────────────────────────────────────────────────
 *
 *   AABB      — Axis-Aligned Bounding Box (collision detection)
 *   Ray       — Ray casting (mouse picking, raycasting)
 *   Plane3D   — Infinite plane in 3D space
 *   BVH       — Bounding Volume Hierarchy (TODO: Phase 3)
 *   CSG       — Constructive Solid Geometry (TODO: Phase 3, manifold WASM)
 *
 * @example
 *   import { Geometry, Angle, Matrix, Shapes, AABB, Ray } from "./Geometry.ts";
 *   Core.use(Geometry);
 *
 *   // Original Golem API preserved
 *   const a = new Angle(Math.PI / 4, "Radians");
 *   console.log(a.Degrees);   // → 45
 *   console.log(a.Sine);      // → 0.7071...
 *
 *   const m = Matrix.identity(4);
 *   m.Determinant();          // → 1
 *
 *   // New
 *   const box = new AABB(new Vector3(-1,-1,-1), new Vector3(1,1,1));
 *   const ray = new Ray(new Vector3(0,5,0), new Vector3(0,-1,0));
 *   console.log(ray.intersectAABB(box)); // → { hit: true, t: 4 }
 */
/**
 * @module    Three
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * AriannA Three — WebGPU 3D renderer + scene graph + modifiers.
 * Zero dependencies. Pure TypeScript.
 *
 * ── RENDERER ─────────────────────────────────────────────────────────────────
 *   WebGPU primary  (Chrome 113+, Safari 18+, Edge 113+)
 *   WebGL2 fallback (disposable — will be removed when WebGPU is universal)
 *
 * ── SCENE GRAPH ──────────────────────────────────────────────────────────────
 *   Scene → Object3D → Mesh | Light | Camera | Group
 *   Every node: position / rotation / scale / matrix / children
 *
 * ── GEOMETRIES ───────────────────────────────────────────────────────────────
 *   BoxGeometry / SphereGeometry / CylinderGeometry / PlaneGeometry
 *   ConeGeometry / TorusGeometry / BufferGeometry (custom)
 *
 * ── MATERIALS ────────────────────────────────────────────────────────────────
 *   MeshBasicMaterial / MeshLambertMaterial / MeshPhongMaterial
 *   MeshPBRMaterial / WireframeMaterial / LineMaterial
 *
 * ── LIGHTS ───────────────────────────────────────────────────────────────────
 *   AmbientLight / DirectionalLight / PointLight / SpotLight
 *
 * ── CAMERAS ──────────────────────────────────────────────────────────────────
 *   PerspectiveCamera / OrthographicCamera
 *
 * ── MODIFIERS (pure JS BSP/geometry) ─────────────────────────────────────────
 *   CSG.union / CSG.subtract / CSG.intersect  (BSP tree)
 *   SubdivisionModifier  (Catmull-Clark)
 *   BevelModifier        (edge bevel)
 *   DecimateModifier     (vertex collapse)
 *   MirrorModifier       (axis mirror)
 *   ArrayModifier        (repeat along axis)
 *   BendModifier / TwistModifier
 *
 * ── IMPORT / EXPORT ──────────────────────────────────────────────────────────
 *   STL  (binary + ASCII) read/write
 *   OBJ  read/write
 *   glTF / GLB  read/write
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *   const renderer = await Three.createRenderer(canvas);
 *   const scene    = new Three.Scene();
 *   const camera   = new Three.PerspectiveCamera(60, canvas.width / canvas.height);
 *   camera.position.set(0, 1, 5);
 *
 *   const geo  = new Three.BoxGeometry(1, 1, 1);
 *   const mat  = new Three.MeshPBRMaterial({ color: '#e40c88' });
 *   const mesh = new Three.Mesh(geo, mat);
 *   scene.add(mesh);
 *
 *   renderer.render(scene, camera);
 *
 * @example
 *   // CSG — subtract a sphere from a box
 *   const box    = new Three.Mesh(new Three.BoxGeometry(2,2,2));
 *   const sphere = new Three.Mesh(new Three.SphereGeometry(1.2));
 *   const result = Three.CSG.subtract(box, sphere);
 *   scene.add(result);
 */
/**
 * @module    Animation
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * Migrated and extended from Golem CSS Animation system (2012-2018).
 *
 * ── Original Golem Animation system ──────────────────────────────────────────
 *
 *   The original was an IIFE (Immediately Invoked Function Expression) that:
 *   - Maintained a requestAnimationFrame loop at 60fps
 *   - Tracked _animationElements (map of elements being animated)
 *   - Maintained _animationFrames (array of frame snapshots)
 *   - Had _animationFrameRate (default 60fps)
 *   - Exposed Start(AnimationEventArguments) / Stop(Id) functions
 *   - Fired 4 callbacks:
 *       onAnimation          — every frame
 *       onAnimationStart     — when animation begins
 *       onAnimationStop      — when animation ends
 *       onAnimationIteration — on each iteration/loop
 *
 *   All of this is preserved in the AnimationLoop class below.
 *
 * ── Extensions (new in AriannA 1.0) ──────────────────────────────────────────
 *
 *   Tween    — value interpolation with 12 easing functions
 *   Spring   — physics-based animation (stiffness/damping/mass)
 *   Timeline — sequence/parallel composition of tweens
 *   Keyframe — CSS keyframe equivalent
 *
 * @example
 *   import { Animation, AnimationLoop, Tween, Spring } from "./Animation.ts";
 *   Core.use(Animation);
 *
 *   // Original Golem API preserved
 *   const loop = new AnimationLoop({ frameRate: 60 });
 *   loop.onAnimation = (frame) => { myEl.style.left = frame.Index + "px"; };
 *   loop.Start();
 *   setTimeout(() => loop.Stop(), 3000);
 *
 *   // New Tween API
 *   new Tween(el.style, {
 *     opacity : [0, 1],
 *     duration: 0.6,
 *     easing  : "easeOutCubic",
 *   });
 *
 *   // Spring
 *   const spring = new Spring(0, 100, { stiffness: 200, damping: 20 }, v => {
 *     el.style.transform = `translateX(${v}px)`;
 *   });
 */
/**
 * @module    Audio
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. Audio — Web Audio API engine with MIDI, sequencer, effects.
 * Zero dependencies.
 *
 * ── CORE ──────────────────────────────────────────────────────────────────────
 *   AudioEngine   — AudioContext wrapper, master chain, context lifecycle
 *
 * ── PLAYBACK ──────────────────────────────────────────────────────────────────
 *   AudioPlayer   — load + play audio files / ArrayBuffer
 *   AudioRecorder — microphone capture via MediaRecorder
 *
 * ── SYNTHESIS ────────────────────────────────────────────────────────────────
 *   Oscillator    — waveform generator (sine/square/sawtooth/triangle/custom)
 *   Sampler       — sample player with pitch shifting
 *   NoiseGenerator— white/pink/brown noise
 *
 * ── EFFECTS ──────────────────────────────────────────────────────────────────
 *   Reverb / Delay / Compressor / Filter / EQ / Distortion / Panner / Chorus
 *
 * ── ANALYSIS ─────────────────────────────────────────────────────────────────
 *   Analyser     — FFT spectrum, waveform, peak/RMS
 *
 * ── SEQUENCER ────────────────────────────────────────────────────────────────
 *   Sequencer    — step sequencer, BPM clock, pattern scheduling
 *
 * ── MIDI ─────────────────────────────────────────────────────────────────────
 *   MIDIEngine   — Web MIDI API, note on/off, CC, clock
 */
/**
 * @module    Video
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. Video — browser video capture, playback, and composition.
 * Zero dependencies.
 *
 * ── CAPTURE ───────────────────────────────────────────────────────────────────
 *   ScreenCapture  — getDisplayMedia recording
 *   CameraCapture  — getUserMedia recording
 *   MediaRecorder  — record to Blob (webm/mp4)
 *
 * ── PLAYBACK ──────────────────────────────────────────────────────────────────
 *   VideoPlayer    — fluent <video> wrapper
 *   VideoSprite    — sprite sheet frame animation
 *
 * ── COMPOSITION ──────────────────────────────────────────────────────────────
 *   VideoCompositor — Canvas2D multi-layer renderer
 *   TextOverlay     — text track rendering
 *   Timeline        — time-based layer sequencer
 *
 * ── EXPORT ────────────────────────────────────────────────────────────────────
 *   .toGIF()   — animated GIF via Canvas2D + LZW
 *   .download() — trigger Blob download
 */
/**
 * @module    AriannANetwork
 * @author    Riccardo Angeli
 * @version   0.1.0
 * @copyright Riccardo Angeli 2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * HTTP, WebSocket, SSE, GraphQL helpers
 *
 * Includes: Fetch wrapper, WebSocket, SSE, GraphQL client, REST builder, Retry/timeout
 * Weight:   ~14KB gzipped
 * Deps:     none
 *
 * @example
 *   import AriannA from "../core/index.ts";
 *   import { Network } from "./Network.ts";
 *
 *   Core.use(Network);
 *
 * Usage:
 *   // After Core.use(Network), all classes are available globally
 *   // and integrate with Real, State, Observable automatically
 */
/**
 * @module    IO
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. IO — File I/O, network, storage, clipboard, drag & drop.
 * Zero dependencies.
 *
 * ── FILE ──────────────────────────────────────────────────────────────────────
 *   FileIO     — File API, drag-drop, download helpers
 *   FSAccess   — File System Access API (read/write files & directories)
 *
 * ── NETWORK ──────────────────────────────────────────────────────────────────
 *   Http       — Fetch wrapper with retries, timeout, interceptors
 *   SSE        — Server-Sent Events reactive wrapper
 *   WebSocketIO— WebSocket wrapper with reconnect + message queue
 *
 * ── STORAGE ──────────────────────────────────────────────────────────────────
 *   LocalStore — localStorage reactive wrapper
 *   IndexedDB  — IndexedDB promise-based wrapper
 *
 * ── CLIPBOARD ────────────────────────────────────────────────────────────────
 *   Clipboard  — read/write text, images, rich content
 *
 * ── SHARE ────────────────────────────────────────────────────────────────────
 *   Share      — Web Share API wrapper
 */
