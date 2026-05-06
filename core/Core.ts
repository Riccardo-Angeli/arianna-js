/**
 * @module    Core
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 *
 * The zero-dependency kernel of AriannA.
 * Loaded first. All other modules depend on this.
 *
 * Responsibilities:
 *   - UUID generation
 *   - Prototype chain introspection
 *   - Immutable property descriptor scopes (Scopes)
 *   - Global namespace registry (html / svg / mathML / x3d / custom)
 *   - DOM MutationObserver (custom element lifecycle)
 *   - Static DOM event bus (Events.On / Off / Fire)
 *   - Type descriptor registry (GetDescriptor / Define)
 *   - SetDescriptors — freezes modules after init
 *   - version — SemVer version object (major / minor / patch / string)
 *   - use(plugin) — lazy plugin registration, idempotent
 *   - plugins() — list of installed plugin names
 *
 * Design notes for future contributors:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Core ← Namespace ← Real ← Virtual ← Component            │
 *   │        ↑           ↑                                        │
 *   │       Observable  State                                     │
 *   │        ↑                                                    │
 *   │       Sheet ← Rule                                          │
 *   │        ↑                                                    │
 *   │       Stylesheet                                            │
 *   │        ↑                                                    │
 *   │       Context ← Directive                                   │
 *   └─────────────────────────────────────────────────────────────┘
 *
 *   Core intentionally has NO import statements.
 *   If you need to add a utility here, ask: "could this live in
 *   a module that imports Core instead?" If yes, put it there.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Property descriptor scopes used across all AriannA modules. */
export interface Scope
{
    configurable : boolean;
    enumerable   : boolean;
    writable     : boolean;
}

/** Shape of a type descriptor stored in the namespace registry. */
export interface TypeDescriptor
{
    Name        : string;
    Tags        : string[];
    Namespace   : NamespaceDescriptor;
    Constructor : (new (...args: unknown[]) => Element) | null;
    Interface   : (new (...args: unknown[]) => Element) | null;
    Prototype   : object | null;
    Supported   : boolean;
    Defined     : boolean;
    Declaration : 'FUNCTION' | 'CLASS' | 'CUSTOM';
    Type        : 'STANDARD' | 'CUSTOM';
    Standard    : boolean;
    Custom      : boolean;
    Style       : Record<string, string>;
    Update?     : (element: Element) => void;
}

/** Namespace functions for creating / patching elements. */
export interface NamespaceFunctions
{
    create : (tag: string | (new () => Element)) => Element | false;
    patch  : (constructor: string) => void;
}

/** Full namespace descriptor (html / svg / mathML / x3d / custom). */
export interface NamespaceDescriptor
{
    name          : string;
    schema        : string;
    state         : 'enabled' | 'disabled';
    enabled       : boolean;
    disabled      : boolean;
    base          : (new (...args: unknown[]) => Element) | null;
    tags          : Record<string, TypeDescriptor>;
    types         :
    {
        standard : { interfaces: Record<string, TypeDescriptor>; tags: Record<string, TypeDescriptor> };
        custom   : { interfaces: Record<string, TypeDescriptor>; tags: Record<string, TypeDescriptor> };
    };
    functions     : Partial<NamespaceFunctions>;
    documentation : { w3c: string };
}

/** MutationObserver event detail shape. */
export interface NodeLifecycleDetail
{
    node       : Node;
    descriptor : TypeDescriptor | false;
    state      : { loading: boolean; loaded: boolean; name: string };
}

// ── UUID ──────────────────────────────────────────────────────────────────────

/**
 * Generates a UUID v4-style identifier.
 * Used as a unique key for listeners, nodes, and instances.
 *
 * @example
 *   Core.Uuid  // "a3f1bc-7d2-e94-f05-8c2b3a1d"
 */
export function uuid(): string
{
    const b: string[] = [];
    for (let i = 0; i < 9; i++)
        b.push((Math.floor(1 + Math.random() * 0x10000)).toString(16).slice(1));
    return `${b[1]}${b[2]}-${b[3]}-${b[4]}-${b[5]}-${b[6]}${b[7]}${b[8]}`;
}

// ── Version ───────────────────────────────────────────────────────────────────

/**
 * AriannA framework version.
 * Follows SemVer: MAJOR.MINOR.PATCH
 *
 * Modules can check this to guard against API incompatibilities:
 *   if (Core.version.major < 1) throw new Error('AriannA ≥ 1.0 required');
 *
 * @example
 *   Core.version.string   // "1.0.0"
 *   Core.version.major    // 1
 *   Core.version.minor    // 0
 *   Core.version.patch    // 0
 */
export const version = Object.freeze(
{
    major  : 1,
    minor  : 0,
    patch  : 0,
    get string() { return `${this.major}.${this.minor}.${this.patch}`; },
});

// ── Scopes ────────────────────────────────────────────────────────────────────

/**
 * Reusable Object.defineProperty descriptor templates.
 * Use these instead of writing { configurable, enumerable, writable } inline.
 *
 * @example
 *   Object.defineProperty(obj, 'key', { ...Core.Scopes.Readonly, value: 42 });
 */
export const Scopes: Readonly<Record<string, Scope>> = Object.freeze(
{
    Private      : { configurable: false, enumerable: false, writable: false },
    Readonly     : { configurable: false, enumerable: true,  writable: false },
    Writable     : { configurable: false, enumerable: true,  writable: true  },
    Configurable : { configurable: true,  enumerable: true,  writable: false },
});

// ── Prototype chain ───────────────────────────────────────────────────────────

/**
 * Returns the complete prototype chain of an object or constructor as an
 * array of constructor names — useful for debugging and type introspection.
 *
 * @example
 *   Core.GetPrototypeChain(document.createElement('input'))
 *   // → ["HTMLInputElement","HTMLElement","Element","Node","EventTarget","Object"]
 */
export function GetPrototypeChain(obj: object | (new () => object)): string[]
{
    const chain: string[] = [];
    let proto: object | null =
        typeof obj === 'function'
            ? (obj as { prototype: object }).prototype
            : Object.getPrototypeOf(obj);

    while (proto !== null)
    {
        const ctor = (proto as { constructor?: { name?: string } }).constructor;
        if (ctor?.name) chain.push(ctor.name);
        proto = Object.getPrototypeOf(proto);
    }
    return chain;
}

// ── SetDescriptors ────────────────────────────────────────────────────────────

/**
 * Applies a property descriptor scope to all own properties of an object,
 * optionally recursing into nested objects.
 *
 * Called at the end of each module's IIFE to freeze the public API.
 * This is the mechanism that makes `Real.Define`, `Core.Events` etc.
 * immutable after initialization.
 *
 * @param target  - Object to freeze
 * @param scope   - Descriptor scope (typically Scopes.Readonly)
 * @param recurse - Whether to recurse into nested plain objects
 *
 * @example
 *   Core.SetDescriptors(MyModule, Core.Scopes.Readonly, true);
 */
export function SetDescriptors(
    target  : Record<string, unknown>,
    scope   : Scope,
    recurse = false,
): void
{
    const d: PropertyDescriptor = { ...scope };
    for (const key of Object.keys(target))
    {
        d.value = target[key];
        try
        {
            Object.defineProperty(target, key, d);
        } catch { /* already frozen — skip */ }
        if (recurse && target[key] && typeof target[key] === 'object'
                && !Array.isArray(target[key]))
                {
            SetDescriptors(
                target[key] as Record<string, unknown>,
                scope,
                true,
            );
        }
    }
}

// ── Namespace registry ────────────────────────────────────────────────────────
// Populated by Namespace.ts at load time.
// Real, Virtual, Component all read from here — NOT from Real.Namespaces.

export const Namespaces: Record<string, NamespaceDescriptor> = {};

/**
 * Register a new namespace (e.g. html, svg, mathML, x3d, custom).
 * Called by Namespace.ts — not called directly by user code.
 *
 * @example
 *   Core.RegisterNamespace('svg', { name:'svg', schema:'http://www.w3.org/2000/svg', ... });
 */
export function RegisterNamespace(key: string, ns: NamespaceDescriptor): void
{
    if (Namespaces[key])
    {
        console.warn(`Core.RegisterNamespace: '${key}' already registered — skipping.`);
        return;
    }
    Namespaces[key] = ns;
}

// ── Type descriptor registry ──────────────────────────────────────────────────

/**
 * Look up a type descriptor by tag name, constructor name, or Node instance.
 * Searches all registered namespaces (standard + custom).
 *
 * Returns false if not found.
 *
 * @example
 *   Core.GetDescriptor('input')         // HTML standard descriptor
 *   Core.GetDescriptor(HTMLInputElement) // same, via constructor
 *   Core.GetDescriptor(myElement)        // same, via Node instance
 *   Core.GetDescriptor('my-widget')      // custom element descriptor
 */
export function GetDescriptor(
    obj: string | (new (...args: unknown[]) => Element) | Node | object,
): TypeDescriptor | false
{
    if (!obj) return false;

    let key: string;
    const t = typeof obj;

    if (t === 'string') {
        key = (obj as string).toLowerCase();
    } else if (t === 'function') {
        key = (obj as { name: string }).name.toLowerCase();
    } else if (obj instanceof Node)
    {
        key = obj.nodeName.toLowerCase();
    } else
    {
        // Plain object — look for a Tag property
        const o = obj as Record<string, unknown>;
        const tagKey = Object.keys(o).find(k => k.toUpperCase() === 'TAG');
        if (!tagKey) return false;
        key = String(o[tagKey]).toLowerCase();
    }

    for (const nsKey of Object.keys(Namespaces))
    {
        const ns  = Namespaces[nsKey];
        const std = ns.types.standard;
        const cst = ns.types.custom;

        // Fast path: exact key match.
        // Tags are always lowercase; interface keys are PascalCase.
        const found =
            std.tags[key]        ??
            std.interfaces[key]  ??
            cst.tags[key]        ??
            cst.interfaces[key];

        if (found) return found;

        // Slow path — only for constructor lookups.
        // When `obj` is a function, `key` is obj.name.toLowerCase() (e.g. "htmldivelement")
        // but interface keys are PascalCase ("HTMLDivElement"), so we scan:
        //   1. lowercase name match
        //   2. direct Constructor / Interface reference match (most reliable)
        if (typeof obj === 'function') {
            for (const k of Object.keys(std.interfaces))
            {
                const d = std.interfaces[k];
                if (k.toLowerCase() === key || d.Constructor === obj || d.Interface === obj) return d;
            }
            for (const k of Object.keys(cst.interfaces))
            {
                const d = cst.interfaces[k];
                if (k.toLowerCase() === key || d.Constructor === obj || d.Interface === obj) return d;
            }
        }
    }
    return false;
}

/**
 * Register a custom element type descriptor in the appropriate namespace.
 *
 * Works with ALL namespaces: html, svg, mathML, x3d, and custom.
 * Never throws — mirrors the original Real.js approach of scanning all
 * registered namespaces to find the right one from the base constructor,
 * with a silent html-namespace fallback when nothing matches.
 *
 * @param tag         - Hyphenated custom element tag (e.g. 'my-button', 'my-icon')
 * @param constructor - Class or function constructor
 * @param base        - Interface to extend (default: HTMLElement).
 *                      Can be any registered constructor: HTMLDivElement,
 *                      SVGSVGElement, SVGPathElement, MathMLElement, etc.
 * @param style       - Optional default CSS properties object
 *
 * @example
 *   // HTML custom element
 *   Core.Define('my-button', MyButton, HTMLButtonElement, { background: 'blue' });
 *
 *   // SVG custom element — pass any SVG interface as base
 *   Core.Define('my-icon', MyIcon, SVGSVGElement);
 *
 *   // MathML custom element
 *   Core.Define('my-formula', MyFormula, MathMLElement);
 */
export function Define(
    tag         : string,
    constructor : new (...args: unknown[]) => Element,
    base        : new (...args: unknown[]) => Element = HTMLElement,
    style       : Record<string, string> = {},
): TypeDescriptor | false
{
    const ct = tag.toLowerCase();

    // Already registered? Return existing descriptor (idempotent).
    const existing = GetDescriptor(ct);
    if (existing)
    {
        console.warn(`Core.Define: '${ct}' already registered.`);
        return existing;
    }

    // ── Locate the correct namespace ───────────────────────────────────────────
    //
    // Strategy (mirrors original Real.js Define logic):
    //   1. Try GetDescriptor(base) — fast path for known tag/interface names
    //   2. Scan all NS: check if ns.base === base (catches SVGElement, MathMLElement)
    //   3. Scan all NS interfaces for matching Constructor or Interface reference
    //   4. Fallback to html namespace — never throws, always succeeds
    //
    let ns: NamespaceDescriptor | null = null;

    const baseDsc = GetDescriptor(base);
    if (baseDsc && baseDsc.Namespace)
    {
        ns = baseDsc.Namespace;
    } else
    {
        for (const nsKey of Object.keys(Namespaces))
        {
            const candidate = Namespaces[nsKey];

            // Direct match on the namespace base class (e.g. SVGElement, MathMLElement)
            if (candidate.base === base)
            {
                ns = candidate;
                break;
            }

            // Match via standard interface Constructor or Interface reference
            for (const k of Object.keys(candidate.types.standard.interfaces))
            {
                const d = candidate.types.standard.interfaces[k];
                if (d.Constructor === base || d.Interface === base)
                {
                    ns = candidate;
                    break;
                }
            }
            if (ns) break;
        }
    }

    // Fallback: html namespace (safe default — never throws)
    if (!ns)
    {
        ns = Namespaces['html'] ?? Object.values(Namespaces)[0];
        console.warn(`Core.Define: base '${base.name}' not found in any registered namespace — defaulting to html.`);
    }

    const isClass = /^class[\s{]/.test(constructor.toString());

    const descriptor: TypeDescriptor = {
        Name        : constructor.name,
        Tags        : [ct],
        Namespace   : ns,
        Constructor : constructor,
        Interface   : base,
        Prototype   : constructor.prototype,
        Supported   : true,
        Defined     : true,
        Declaration : isClass ? 'CLASS' : 'FUNCTION',
        Type        : 'CUSTOM',
        Standard    : false,
        Custom      : true,
        Style       : style,
        Update      : (el: Element) => {
            // Insert base.prototype into constructor's chain first
            Object.setPrototypeOf(constructor.prototype, base.prototype);
            // Then give element that chain
            Object.setPrototypeOf(el, constructor.prototype);

            if (isClass)
            {
                // Class constructors cannot be invoked with .call()/.apply().
                // Solution mirrors original Real.js: extract the constructor body
                // and re-run it as a plain function bound to el.
                // This applies inline styles and textContent without needing new/super().
                try
                {
                    const src = constructor.toString();
                    const m   = src.match(/constructor\s*\(\s*\)\s*\{([\s\S]*?)\}(?=\s*\})/);
                    if (m)
                    {
                        // eslint-disable-next-line no-new-func
                        const fn = new Function(`return function(){${m[1]}}`)() as (this: Element) => void;
                        fn.call(el);
                    }
                } catch (_) { /* silent */ }
            } else
            {
                // ES5 function constructors — call directly with el as `this`
                (constructor as unknown as (this: Element) => void).call(el);
            }
        },
    };

    ns.types.custom.interfaces[constructor.name] = descriptor;
    ns.types.custom.tags[ct]                     = descriptor;

    // Notify other modules (Observer, Component, etc.)
    document.dispatchEvent(new CustomEvent('arianna-wip:defined', {
        detail: { tag: ct, descriptor },
    }));

    return descriptor;
}

// ── DOM Events static bus ─────────────────────────────────────────────────────

/**
 * Static DOM event utilities — thin wrappers around addEventListener /
 * removeEventListener / dispatchEvent with multi-target and multi-type support.
 *
 * These are the synchronous DOM event helpers.
 * For the AriannA pub/sub bus, use Observable.
 *
 * @example
 *   Core.Events.On(element, 'click', handler);
 *   Core.Events.On('.btn', 'click mouseenter', handler);
 *   Core.Events.Fire(element, 'click', { bubbles: true });
 *   Core.Events.Off(element, 'click', handler);
 */
export const Events = Object.freeze(
{

    /**
     * Add a DOM event listener to one or more targets.
     * Prefer `Observable.On` for full listener shipments and registry.
     * @example
     *   Core.Events.On(element, 'click', handler);
     *   Core.Events.On('.btn', 'click mouseenter', handler, { passive: true });
     */
    On(
        target   : EventTarget | string | EventTarget[],
        types    : string,
        callback : EventListener,
        options? : AddEventListenerOptions,
    ): void
    {
        _resolveTargets(target).forEach(el =>
            _splitTypes(types).forEach(t => el.addEventListener(t, callback, options)));
    },

    /**
     * Remove a DOM event listener from one or more targets.
     * @example
     *   Core.Events.Off(element, 'click', handler);
     */
    Off(
        target   : EventTarget | string | EventTarget[],
        types    : string,
        callback : EventListener,
        options? : boolean | EventListenerOptions,
    ): void
    {
        _resolveTargets(target).forEach(el =>
            _splitTypes(types).forEach(t => el.removeEventListener(t, callback, options)));
    },

    /**
     * Dispatch a CustomEvent on one or more targets.
     * @example
     *   Core.Events.Fire(button, 'click', { detail: { value: 42 } });
     */
    Fire(
        target  : EventTarget | string | EventTarget[],
        type    : string,
        init?   : CustomEventInit,
    ): void
    {
        const ev = new CustomEvent(type, { bubbles: true, composed: true, ...init });
        _resolveTargets(target).forEach(el => el.dispatchEvent(ev));
    },
});

function _resolveTargets(t: EventTarget | string | EventTarget[]): EventTarget[]
{
    if (typeof t === 'string')
        return Array.from(document.querySelectorAll<Element>(t)) as EventTarget[];
    return Array.isArray(t) ? t : [t];
}

function _splitTypes(s: string): string[]
{
    return s.split(/\s+|,|\|/g).filter(Boolean);
}

// ── MutationObserver — custom element lifecycle ───────────────────────────────

/**
 * The global DOM watcher.
 * Fires 'arianna-wip:nodeadding' / 'arianna-wip:nodeadded' / 'arianna-wip:noderemoved'
 * on the document, and calls descriptor.Update() on custom elements
 * when they are inserted into the DOM.
 *
 * Initialized automatically when Core is imported.
 * Can be stopped via Core.Observer.disconnect().
 *
 * @example
 *   document.addEventListener('arianna-wip:nodeadded', e => console.log(e.detail));
 */
export const Observer = new MutationObserver((mutations: MutationRecord[]) => {
    for (const m of mutations)
    {
        // Attribute change → dispatch {tagname}-change event on the element
        if (m.type === 'attributes' && m.target instanceof Element) {
            const attr = m.target.attributes.getNamedItem(m.attributeName ?? '');
            if (attr)
            {
                const evName = /^(\w+)/.exec(attr.name)?.[1]?.toLowerCase() ?? attr.name;
                m.target.dispatchEvent(new CustomEvent(`${evName}-change`, {
                    detail: { element: m.target, attribute: attr },
                }));
            }
        }

        // Child list change → lifecycle events + Update() for custom elements
        if (m.type === 'childList') {
            for (const node of Array.from(m.addedNodes))
            {
                const d = node instanceof Element ? GetDescriptor(node) : false;
                const detail: NodeLifecycleDetail = {
                    node, descriptor: d, state: { loading: true, loaded: false, name: 'Loading' },
                };

                if (node instanceof Element)
                    node.dispatchEvent(new CustomEvent('arianna-wip:nodeadding', { detail }));

                if (d && d.Custom && d.Constructor && d.Update)
                    d.Update(node as Element);

                detail.state = { loading: false, loaded: true, name: 'Loaded' };
                document.dispatchEvent(new CustomEvent('arianna-wip:nodeadded', { detail }));
            }

            for (const node of Array.from(m.removedNodes))
            {
                const d = node instanceof Element ? GetDescriptor(node) : false;
                document.dispatchEvent(new CustomEvent('arianna-wip:noderemoved', {
                    detail: { node, descriptor: d },
                }));
            }
        }
    }
});

// Start observing as soon as Core is imported.
// Only start if we are in a browser context.
if (typeof document !== 'undefined') {
    Observer.observe(document.documentElement, {
        childList         : true,
        subtree           : true,
        attributes        : true,
        attributeOldValue : true,
    });
}

// ── Plugin system ─────────────────────────────────────────────────────────────

/**
 * Shape of an AriannA plugin.
 *
 * A plugin is any object (or class instance) that exposes an `install` method.
 * `install` receives the Core singleton and the options passed to `Core.use()`.
 *
 * Plugins are idempotent: installing the same plugin twice is a no-op.
 *
 * @example
 *   // Define a plugin
 *   const RouterPlugin = {
 *     name: 'router',
 *     install(core, opts) {
 *       core.Namespaces;                       // access namespace registry
 *       core.Events.On(window, 'popstate', opts.handler);
 *       Object.defineProperty(window, 'Router', { value: opts.routes });
 *     }
 *   };
 *
 *   // Register it
 *   Core.use(RouterPlugin, { handler: myHandler, routes: myRoutes });
 *
 *   // Core.plugins lists all installed plugin names
 *   Core.plugins  // ['router']
 */
export interface CorePlugin
{
    /** Unique name used to prevent double-installation. */
    name    : string;
    /** Called once when the plugin is first installed. */
    install : (core: typeof _coreApi, options?: Record<string, unknown>) => void;
}

// Internal installed-plugin registry
const _installedPlugins = new Set<string>();

/**
 * Install a plugin into Core.
 * Idempotent — calling twice with the same plugin name is silently ignored.
 *
 * @example
 *   Core.use(MyPlugin);
 *   Core.use(MyPlugin, { option: 'value' });
 */
export function use(
    plugin  : CorePlugin,
    options : Record<string, unknown> = {},
): void
{
    if (_installedPlugins.has(plugin.name))
    {
        console.warn(`Core.use: plugin '${plugin.name}' is already installed.`);
        return;
    }
    plugin.install(_coreApi, options);
    _installedPlugins.add(plugin.name);
}

/**
 * Returns the names of all currently installed plugins.
 *
 * @example
 *   Core.plugins   // ['router', 'i18n']
 */
export function plugins(): string[]
{
    return Array.from(_installedPlugins);
}

// ── Helpers — generic object/value utilities ─────────────────────────────────

/**
 * Type tag accepted by `Is`. Either a JS primitive type tag, a special tag
 * 'class' that matches ES class syntax, or a constructor function for
 * `instanceof` checks.
 */
export type IsType =
    | 'string' | 'number' | 'boolean' | 'symbol'
    | 'function' | 'object' | 'class'
    | (new (...args: never[]) => unknown);

/**
 * Checks whether the first argument satisfies all the given type tags.
 *
 * Supports JS primitive type tags ('string', 'number', ...), the special
 * 'class' tag (which matches only true ES class declarations), and
 * constructor functions for instanceof checks.
 *
 * @example
 *   Core.Is(42, 'number')                  // true
 *   Core.Is(class A {}, 'class')           // true
 *   Core.Is(function A() {}, 'class')      // false
 *   Core.Is(new Date(), Date)              // true
 *   Core.Is(arr, 'object', Array)          // true
 */
export function Is(value: unknown, ...types: IsType[]): boolean
{
    if (value === null || value === undefined || types.length === 0) return false;

    const native = new Set(['string', 'number', 'boolean', 'symbol', 'function', 'object']);

    for (const t of types)
    {
        if (typeof t === 'string')
        {
            if (t === 'class')
            {
                if (typeof value !== 'function' || !/^class\b/.test(Function.prototype.toString.call(value))) return false;
            }
            else if (native.has(t))
            {
                if (typeof value !== t) return false;
            }
        }
        else if (typeof t === 'function')
        {
            if (!(value instanceof t)) return false;
        }
    }
    return true;
}

/**
 * Deep equality across primitives, plain objects, arrays, regex, dates,
 * and class instances (by enumerable own property shape).
 *
 * Pass either two or more arguments (`Equals(a, b, c)`), or a single array
 * (`Equals([a, b, c])`).
 *
 * @example
 *   Core.Equals({a:1}, {a:1})            // true
 *   Core.Equals([1,2,3], [1,2,3])        // true
 *   Core.Equals(new Date(0), new Date(0))// true
 */
export function Equals(...args: unknown[]): boolean
{
    let elements = args;
    if (args.length === 1 && Array.isArray(args[0])) elements = args[0] as unknown[];
    if (elements.length < 2) return true;

    for (let i = elements.length - 1; i > 0; i--)
    {
        const x = elements[i];
        const y = elements[i - 1];
        if (Object.is(x, y)) continue;

        if ((x === null || x === undefined) && (y === null || y === undefined)) continue;
        if (x === null || y === null || x === undefined || y === undefined) return false;

        const tx = typeof x, ty = typeof y;
        if (tx !== ty) return false;

        if (tx === 'object')
        {
            if (x instanceof Date && y instanceof Date)
            {
                if (x.getTime() !== y.getTime()) return false;
                continue;
            }
            if (x instanceof RegExp && y instanceof RegExp)
            {
                if (x.toString() !== y.toString()) return false;
                continue;
            }
            if (Array.isArray(x) || Array.isArray(y))
            {
                if (!Array.isArray(x) || !Array.isArray(y)) return false;
                if (x.length !== y.length) return false;
                for (let k = 0; k < x.length; k++) if (!Equals(x[k], y[k])) return false;
                continue;
            }

            const xo = x as Record<string, unknown>;
            const yo = y as Record<string, unknown>;
            const xk = Object.keys(xo);
            const yk = Object.keys(yo);
            if (xk.length !== yk.length) return false;
            for (const k of xk)
            {
                if (!Object.prototype.hasOwnProperty.call(yo, k)) return false;
                if (!Equals(xo[k], yo[k])) return false;
            }
            continue;
        }

        if (tx === 'function')
        {
            if ((x as () => unknown).toString() !== (y as () => unknown).toString()) return false;
            continue;
        }

        return false;
    }
    return true;
}

/**
 * Returns true when an object has no own enumerable properties.
 * Non-objects always return true.
 *
 * @example
 *   Core.Empty({})           // true
 *   Core.Empty({a: 1})       // false
 *   Core.Empty([])           // true
 */
export function Empty(value: unknown): boolean
{
    if (value === null || value === undefined || typeof value !== 'object') return true;
    for (const _ in value as object) return false;
    return true;
}

/**
 * Checks if `target` has all the specified members.
 *
 * For HTMLElement, members are checked against attributes.
 * For other objects, members are checked against own properties.
 *
 * @example
 *   Core.Has(obj, 'name', 'value')           // checks both keys
 *   Core.Has(divElement, 'data-id')          // checks attribute
 */
export function Has(target: object | null | undefined, ...members: string[]): boolean
{
    if (!target || typeof target !== 'object') return false;
    if (members.length === 0) return true;
    const isElement = typeof HTMLElement !== 'undefined' && target instanceof HTMLElement;

    for (const m of members)
    {
        if (isElement)
        {
            if ((target as HTMLElement).getAttribute(m) === null) return false;
        }
        else
        {
            if (!(m in (target as Record<string, unknown>))) return false;
        }
    }
    return true;
}

/**
 * Deep-clone a value. Handles primitives, Date, Array, plain Object, and
 * Node (via `cloneNode(true)`). Functions are cloned via `new Function`.
 *
 * @example
 *   const clone = Core.Clone({a: 1, b: [2,3]});
 */
export function Clone<T>(value: T): T
{
    if (value === null || value === undefined) return value;

    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean' || t === 'symbol' || t === 'bigint') return value;

    if (t === 'function')
    {
        const fn = value as unknown as () => unknown;
        const out = new Function('return ' + fn.toString())() as () => unknown;
        const fnRec = fn as unknown as Record<string, unknown>;
        const outRec = out as unknown as Record<string, unknown>;
        for (const k of Object.keys(fnRec)) outRec[k] = fnRec[k];
        return out as unknown as T;
    }

    if (typeof Node !== 'undefined' && value instanceof Node)
    {
        return value.cloneNode(true) as unknown as T;
    }

    if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
    if (value instanceof RegExp) return new RegExp(value.source, value.flags) as unknown as T;

    if (Array.isArray(value))
    {
        return value.map(v => Clone(v)) as unknown as T;
    }

    if (t === 'object')
    {
        const obj = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(obj)) out[k] = Clone(obj[k]);
        return out as unknown as T;
    }

    return value;
}

/**
 * Mixes own enumerable properties from sources into target.
 *
 * Special-cases ES classes: when a source is a class (per `Is(s, 'class')`),
 * its prototype methods (excluding `constructor`) are copied onto
 * `target.prototype`, and a fresh instance's own keys are mirrored on
 * `target.prototype.__proto__`. This preserves the legacy AriannA pattern
 * for adding mixin classes to constructors.
 *
 * Returns the mutated target.
 *
 * @example
 *   Core.Assign(myObj, {a: 1}, {b: 2});                    // {a:1, b:2}
 *   Core.Assign(MyClass, MixinClass);                      // mixin install
 */
export function Assign<T extends object>(target: T, ...sources: unknown[]): T
{
    if (target === null || target === undefined) throw new TypeError('Cannot convert first argument to object');
    const to = Object(target) as Record<string, unknown>;

    for (const source of sources)
    {
        if (source === null || source === undefined) continue;

        if (typeof source === 'function' && Is(source, 'class'))
        {
            const ctor = source as new () => object;
            const targetCtor = target as unknown as { prototype?: Record<string, unknown> };
            if (!targetCtor.prototype) continue;

            for (const k of Object.getOwnPropertyNames(ctor.prototype))
            {
                if (k !== 'constructor')
                {
                    targetCtor.prototype[k] = (ctor.prototype as Record<string, unknown>)[k];
                }
            }

            try
            {
                const instance = new ctor() as Record<string, unknown>;
                const proto = Object.getPrototypeOf(targetCtor.prototype) as Record<string, unknown> | null;
                if (proto)
                {
                    for (const k of Object.getOwnPropertyNames(instance))
                    {
                        if (k !== 'constructor') proto[k] = instance[k];
                    }
                }
            }
            catch { /* class with required ctor args — skip instance copy */ }
            continue;
        }

        const src = Object(source) as Record<string, unknown>;
        for (const k of Object.keys(src))
        {
            const desc = Object.getOwnPropertyDescriptor(src, k);
            if (desc?.enumerable) to[k] = src[k];
        }
    }
    return target;
}

/**
 * Replaces an Element's outerHTML preserving its currently-attached event
 * listeners (when `Core.Events.GetListeners` is available).
 *
 * Note: replacement parses the input HTML; only single-root replacements
 * are supported. Returns the new node, or undefined if input was invalid.
 *
 * @example
 *   const next = Core.Replace(divEl, '<section>new</section>');
 */
export function Replace(target: Node | null | undefined, replacement: string | Node | null | undefined): Node | undefined
{
    if (!target || !(target instanceof Node) || !target.parentNode) return undefined;
    if (replacement === null || replacement === undefined) return undefined;

    let next: Node | null = null;
    if (typeof replacement === 'string')
    {
        const tpl = document.createElement('template');
        tpl.innerHTML = replacement;
        next = tpl.content.firstElementChild ?? tpl.content.firstChild;
    }
    else if (replacement instanceof Node)
    {
        next = replacement;
    }
    if (!next) return undefined;

    if (next.parentNode) next.parentNode.removeChild(next);
    target.parentNode.replaceChild(next, target);
    return next;
}

// ── Extends — runtime class extension utility ────────────────────────────────

/**
 * Mixin-style class extension: sets `Sub` to extend `Super` at runtime,
 * preserving `Sub`'s own prototype methods. Variadic: `Extends(A, B, C, D)`
 * makes A extend B, B extend C, C extend D in left-to-right pairs.
 *
 * Useful when classes are constructed dynamically and `extends` keyword
 * cannot be used. SSR-safe: bails out gracefully on non-class inputs.
 *
 * @example
 *   class A {}
 *   class B { foo() {} }
 *   Core.Extends(A, B);
 *   const a = new A();
 *   a.foo();                  // inherited from B
 *
 *   // Chain:
 *   Core.Extends(A, B, C);    // A -> B -> C
 */
export function Extends(...classes: unknown[]): unknown
{
    if (classes.length < 2) return classes[0];

    for (let i = 0; i < classes.length - 1; i++)
    {
        const Sub = classes[i];
        const Super = classes[i + 1];

        if (typeof Sub !== 'function' || typeof Super !== 'function') continue;
        const SubF = Sub as unknown as { prototype: object };
        const SuperF = Super as unknown as { prototype: object };
        if (!SubF.prototype || !SuperF.prototype) continue;

        try
        {
            Object.setPrototypeOf(SubF.prototype, SuperF.prototype);
            Object.setPrototypeOf(SubF, SuperF);
        }
        catch { /* native built-ins may resist — skip */ }
    }
    return classes[0];
}

// ── Property — enhanced property descriptor ──────────────────────────────────

/**
 * Type marker for runtime validation in `Property`.
 * Either a built-in tag, or a custom predicate that returns true if the
 * value is acceptable.
 */
export type PropertyType =
    | 'string' | 'number' | 'boolean' | 'integer'
    | 'function' | 'object' | 'array' | 'any'
    | ((v: unknown) => boolean);

/**
 * Sync target for `bind` (two-way) or `bound` (one-way mirror).
 * - attribute(s) — DOM attribute(s) on the host element (or host.element)
 * - property/properties — sibling JS properties on the host object
 */
export interface BindSpec
{
    attribute?  : string;
    attributes? : string[];
    property?   : string;
    properties? : string[];
}

/**
 * Event emission settings for a Property.
 * Defaults: private internal EventTarget, cancelable changing, no propagation.
 */
export interface ObservableSpec
{
    target?         : EventTarget | null;
    propagation?    : boolean;
    cancelable?     : boolean;
    changingEvent?  : string;
    changedEvent?   : string;
}

/**
 * Constructor options for `Property`.
 *
 * @example
 *   new Core.Property('volume', {
 *     initial: 0, type: 'number',
 *     validate: v => v >= -120 && v <= 24,
 *     transform: v => Math.round(v * 10) / 10,
 *     bind: { attribute: 'data-volume' },
 *   }).install(host);
 */
export interface PropertyOptions
{
    initial?      : unknown;
    enumerable?   : boolean;
    configurable? : boolean;
    type?         : PropertyType;
    validate?     : (v: unknown) => boolean;
    transform?    : (v: unknown) => unknown;
    bind?         : BindSpec;
    bound?        : BindSpec;
    observable?   : ObservableSpec;
    silent?       : boolean;
}

export interface PropertyChangingDetail
{
    name     : string;
    oldValue : unknown;
    newValue : unknown;
    /** Set this in a listener to override the value being committed. */
    override?: unknown;
}

export interface PropertyChangedDetail
{
    name     : string;
    oldValue : unknown;
    newValue : unknown;
    bind     : BindSpec | undefined;
    bound    : BindSpec | undefined;
}

function _propertyMatchesType(v: unknown, t: PropertyType): boolean
{
    if (typeof t === 'function') return t(v);
    switch (t)
    {
        case 'string'   : return typeof v === 'string';
        case 'number'   : return typeof v === 'number' && !Number.isNaN(v);
        case 'integer'  : return typeof v === 'number' && Number.isInteger(v);
        case 'boolean'  : return typeof v === 'boolean';
        case 'function' : return typeof v === 'function';
        case 'object'   : return typeof v === 'object' && v !== null && !Array.isArray(v);
        case 'array'    : return Array.isArray(v);
        case 'any'      : return true;
    }
}

/**
 * Resolve the DOM element associated with a host object, if any.
 * Accepts an HTMLElement directly, or any Real-like wrapper that
 * exposes `.element` returning an HTMLElement.
 *
 * SSR-safe: returns null in environments without `HTMLElement`.
 */
function _propertyResolveDomElement(host: object): HTMLElement | null
{
    if (typeof HTMLElement === 'undefined') return null;
    if (host instanceof HTMLElement) return host;
    const wrapper = host as { element?: unknown };
    if (wrapper.element instanceof HTMLElement) return wrapper.element;
    return null;
}

/**
 * `Property` — enhanced JavaScript property descriptor.
 *
 * Wraps `Object.defineProperty` and adds:
 *   - runtime `type` validation (built-in tags + custom predicates)
 *   - `transform` to normalise incoming values
 *   - `bind` / `bound` two-way / one-way sync to attributes and sibling
 *     properties on the host (or its `.element` if it's a Real-like)
 *   - cancelable `${name}Changing` event (preventDefault aborts the set;
 *     listeners may override via `event.detail.override`)
 *   - post-set `${name}Changed` event with rich detail
 *
 * Install on a host with `descriptor.install(host)`. Reading host[name]
 * returns the current value; writing host[name] = x routes through all
 * the layers above.
 *
 * The class is the registry for runtime state (current value, listeners,
 * installed hosts), so multiple installs of the same Property mirror the
 * same value across hosts.
 *
 * @example
 *   const vol = new Core.Property('volume', {
 *       initial: 50,
 *       type: 'number',
 *       validate: v => v >= 0 && v <= 100,
 *       bind: { attribute: 'data-volume' },
 *   });
 *   vol.install(strip).onChanged(d => console.log('vol →', d.newValue));
 *   strip.volume = 80;     // event fired, attribute updated
 *   strip.volume = 999;    // rejected by validator, no event
 */
export class Property<T = unknown>
{
    public  readonly name : string;
    public  readonly opts : Readonly<PropertyOptions>;
    private _value        : T;
    private _hosts        : Set<object> = new Set();
    private _eventTarget  : EventTarget;
    private _changingEvt  : string;
    private _changedEvt   : string;
    private _silent       : boolean;

    constructor(name: string, options: PropertyOptions = {})
    {
        this.name         = name;
        this.opts         = Object.freeze({ ...options });
        this._value       = options.initial as T;
        this._silent      = options.silent ?? false;
        const obs         = options.observable ?? {};
        this._eventTarget = obs.target ?? new EventTarget();
        this._changingEvt = obs.changingEvent ?? `${name}Changing`;
        this._changedEvt  = obs.changedEvent  ?? `${name}Changed`;
    }

    /** Direct read of the current value. */
    get(): T { return this._value; }

    /**
     * Direct write through transform → type check → validate → changing event
     * → commit → sync → changed event. Returns true if applied, false if
     * rejected (by type/validator/listener preventDefault).
     */
    set(value: T): boolean
    {
        const opts = this.opts;
        const old  = this._value;

        let next: T = value;
        if (opts.transform) next = opts.transform(next) as T;

        if (opts.type !== undefined && !_propertyMatchesType(next, opts.type)) return false;
        if (opts.validate && !opts.validate(next))                             return false;
        if (Object.is(old, next))                                              return true;

        if (!this._silent)
        {
            const detail: PropertyChangingDetail =
                { name: this.name, oldValue: old, newValue: next };
            const cancelable = opts.observable?.cancelable ?? true;
            const ev = new CustomEvent(this._changingEvt, {
                detail, cancelable,
                bubbles: opts.observable?.propagation ?? false,
            });
            const ok = this._eventTarget.dispatchEvent(ev);
            if (!ok && cancelable) return false;
            if (detail.override !== undefined) next = detail.override as T;
        }

        this._value = next;

        for (const host of this._hosts) this._sync(host, next);

        if (!this._silent)
        {
            const detail: PropertyChangedDetail = {
                name: this.name, oldValue: old, newValue: next,
                bind: opts.bind, bound: opts.bound,
            };
            const ev = new CustomEvent(this._changedEvt, {
                detail, cancelable: false,
                bubbles: opts.observable?.propagation ?? false,
            });
            this._eventTarget.dispatchEvent(ev);
        }
        return true;
    }

    /**
     * Install this Property as a real getter/setter on `host` via
     * `Object.defineProperty`. Multiple hosts share the same value.
     * Returns `this` for chaining.
     */
    install(host: object): this
    {
        const self = this;
        Object.defineProperty(host, this.name, {
            enumerable  : this.opts.enumerable   ?? true,
            configurable: this.opts.configurable ?? true,
            get(): T { return self._value; },
            set(v: T): void { self.set(v); },
        });
        this._hosts.add(host);
        this._sync(host, this._value);
        return this;
    }

    /** Subscribe to the cancelable changing event. Chainable. */
    onChanging(cb: (detail: PropertyChangingDetail, ev: Event) => void): this
    {
        this._eventTarget.addEventListener(this._changingEvt, ((ev: Event) =>
        {
            cb((ev as CustomEvent<PropertyChangingDetail>).detail, ev);
        }) as EventListener);
        return this;
    }

    /** Subscribe to the post-set changed event. Chainable. */
    onChanged(cb: (detail: PropertyChangedDetail, ev: Event) => void): this
    {
        this._eventTarget.addEventListener(this._changedEvt, ((ev: Event) =>
        {
            cb((ev as CustomEvent<PropertyChangedDetail>).detail, ev);
        }) as EventListener);
        return this;
    }

    /** The internal EventTarget — for advanced subscription patterns. */
    get target(): EventTarget { return this._eventTarget; }

    private _sync(host: object, value: T): void
    {
        const dom = _propertyResolveDomElement(host);

        const apply = (spec: BindSpec | undefined) =>
        {
            if (!spec) return;

            if (dom)
            {
                const attrs: string[] = [];
                if (spec.attribute)  attrs.push(spec.attribute);
                if (spec.attributes) attrs.push(...spec.attributes);
                for (const a of attrs)
                {
                    const str = value === null || value === undefined ? '' : String(value);
                    if (dom.getAttribute(a) !== str) dom.setAttribute(a, str);
                }
            }

            const props: string[] = [];
            if (spec.property)   props.push(spec.property);
            if (spec.properties) props.push(...spec.properties);
            for (const p of props)
            {
                const cur = (host as Record<string, unknown>)[p];
                if (!Object.is(cur, value))
                {
                    (host as Record<string, unknown>)[p] = value;
                }
            }
        };
        apply(this.opts.bind);
        apply(this.opts.bound);
    }
}

// Forward declaration — _coreApi is assigned after the const block below.
// eslint-disable-next-line prefer-const
let _coreApi: ReturnType<typeof _buildCore>;

function _buildCore()
{
    return {
        version,
        Uuid             : uuid,
        GetPrototypeChain,
        SetDescriptors,
        Scopes,
        Namespaces,
        RegisterNamespace,
        GetDescriptor,
        Define,
        Events,
        Observer,
        Property,
        // Helpers
        Is,
        Equals,
        Empty,
        Has,
        Clone,
        Assign,
        Replace,
        Extends,
        use,
        plugins,
        Root: typeof document !== 'undefined' ? document.documentElement : null,
    } as const;
}

// ── Core public API object ────────────────────────────────────────────────────

/**
 * The Core singleton — frozen after creation.
 *
 * Usage:
 *   import Core from './Core.ts';
 *   Core.GetDescriptor('div');
 *   Core.Define('my-btn', MyBtn, HTMLButtonElement);
 *   Core.Events.On(el, 'click', handler);
 *   Core.use(MyPlugin, { option: true });
 *   Core.version.string   // "1.0.0"
 *
 *   // Enhanced property descriptors:
 *   const vol = new Core.Property('volume', { type: 'number', initial: 50 });
 *   vol.install(myObject);
 *
 * Or (browser global):
 *   window.Core.version.string
 *   window.Core.plugins()   // ['router', ...]
 */
const Core = Object.freeze(_buildCore());

// Wire the forward reference so plugins installed during `use()` get the
// fully-frozen Core object, not a partially-constructed one.
_coreApi = Core;

// ── Window registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'Core', {
        enumerable: true, configurable: false, writable: false, value: Core,
    });
}

export default Core;
