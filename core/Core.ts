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
     * Prefer `Observable.On` for full listener tracking and registry.
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
