/**
 * @module    jsx-runtime
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 *
 * AriannA JSX runtime — dual-mode factory.
 * Dedicated with love to Arianna. ♡
 *
 * ── Modes ─────────────────────────────────────────────────────────────────────
 *   dom-render: real    → every JSX node → new Real(...)          (default)
 *   dom-render: virtual → every JSX node → Virtual.Create(...)
 *
 * ── Per-file pragma ───────────────────────────────────────────────────────────
 *   /* @dom-render: virtual *\/   at top of file → Virtual mode
 *   /* @dom-render: real    *\/   at top of file → Real mode (explicit)
 *
 * ── tsconfig.json ─────────────────────────────────────────────────────────────
 *   {
 *     "compilerOptions": {
 *       "jsx"             : "react-jsx",
 *       "jsxImportSource" : "arianna"
 *     }
 *   }
 *
 * ── arianna.config.ts ─────────────────────────────────────────────────────────
 *   export default defineConfig({
 *     jsx: { runtime: 'real' }   // or 'virtual'
 *   });
 *
 * ── Event prop syntax ─────────────────────────────────────────────────────────
 *   Both runtimes accept two equivalent syntaxes for event listeners:
 *
 *   $click={fn}       prefix $ → always an event listener
 *   onClick={fn}      prefix on + uppercase → event listener (camelCase strip)
 *
 *   In case of collision, $ takes precedence.
 *   Everything else is treated as a plain attribute / .set() call.
 *
 * @example
 *   // Real mode (default)
 *   const btn = <button class="primary" onClick={fn}>Click</button>;
 *   // → new Real('button').set('class','primary').on('click',fn).add('Click')
 *
 * @example
 *   // Virtual mode
 *   const circle = <circle cx="20" cy="20" r="18" $click={fn} />;
 *   // → Virtual.Create('circle', { cx:'20', cy:'20', r:'18' }).on('click',fn)
 *
 * @example
 *   // Fragment
 *   const frag = <><span>A</span><span>B</span></>;
 *   // real:    → DocumentFragment with two spans
 *   // virtual: → AriannAFragment (array wrapper VirtualNode)
 *
 * @example
 *   // Custom element
 *   const card = <MyCard title="Hello" $click={fn} />;
 *   // → new Real('my-card').set('title','Hello').on('click',fn)
 *   //   (tag resolved via Core.GetDescriptor(MyCard))
 *
 * @example
 *   // In a .tsx file — Real mode (default)
 *   import { Real } from 'arianna';
 *
 *   function App() {
 *     return (
 *       <div id="app">
 *         <h1 class="title">AriannA</h1>
 *         <button onClick={() => alert('hi')}>Click</button>
 *       </div>
 *     );
 *   }
 *
 * @example
 *   // In a .tsx file — Virtual mode (pragma at top)
 *   \/* @dom-render: virtual *\/
 *   import { Virtual } from 'arianna';
 *
 *   function SVGIcon() {
 *     return (
 *       <svg width="40" height="40" viewBox="0 0 40 40">
 *         <circle cx="20" cy="20" r="18" fill="dodgerblue" $click={fn} />
 *       </svg>
 *     );
 *   }
 */

import Real                     from '../Real.ts';
import Virtual, { VirtualNode } from '../Virtual.ts';
import Core                     from '../Core.ts';
import type { VAttrs }          from '../Virtual.ts';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Props passed to a JSX element. */
export type JSXProps = Record<string, unknown> & {
    children?: JSXNode | JSXNode[];
};

/**
 * A node returned by h() — either a Real instance, a VirtualNode,
 * a Fragment, a primitive, or null/undefined (both are silently skipped).
 */
export type JSXNode =
    | Real
    | VirtualNode
    | AriannAFragment
    | string
    | number
    | boolean
    | null
    | undefined;

/** A fragment in Virtual mode — wraps children without a real DOM tag. */
export interface AriannAFragment
{
    readonly __arianna_fragment : true;
    readonly children           : JSXNode[];
}

/** Intrinsic element map — all HTML/SVG tags are valid JSX elements. */
export interface IntrinsicElements
{
    [tag: string]: JSXProps;
}

// ── Runtime mode ──────────────────────────────────────────────────────────────

/** Runtime mode — controlled by arianna.config.ts or a per-file pragma. */
export type JSXRuntime = 'real' | 'virtual';

// ── Internal helpers ──────────────────────────────────────────────────────────

const EVENT_DOLLAR = /^\$/;         // $click, $mouseenter
const EVENT_ON     = /^on([A-Z])/;  // onClick, onMouseenter
const FRAGMENT_TAG = Symbol('AriannAFragment');

/**
 * Determine whether a prop name encodes an event listener.
 * Returns the lowercase event type string, or `null` for plain attributes.
 *
 * @param key - Prop name to inspect.
 * @internal
 */
function resolveEventType(key: string): string | null
{
    if (EVENT_DOLLAR.test(key)) return key.slice(1).toLowerCase();
    const m = EVENT_ON.exec(key);
    if (m) return (m[1].toLowerCase() + key.slice(m[0].length)).toLowerCase();
    return null;
}

/**
 * Resolve a JSX type to a lowercase tag string.
 *
 * - `string`         → used as-is (`'div'`, `'my-card'`)
 * - `function/class` → looked up in `Core.GetDescriptor` → `Tags[0]`
 * - fallback         → kebab-case of the constructor name
 *
 * @param type - JSX element type.
 * @internal
 */
function resolveTag(type: string | (new (...a: unknown[]) => unknown)): string
{
    if (typeof type === 'string') return type;

    const d = Core.GetDescriptor(type as never);
    if (d && d.Tags?.length) return d.Tags[0];

    // Fallback: convert PascalCase class/function name to kebab-case
    const name = (type as { name?: string }).name ?? 'div';
    return name
        .replace(/([A-Z])/g, (c, i) => (i > 0 ? '-' : '') + c.toLowerCase())
        .replace(/^-/, '');
}

/**
 * Flatten a mixed children array — handles nested arrays, AriannAFragments,
 * and plain primitives. Filters `null`, `undefined`, and `false`.
 *
 * @param children - Raw children array from JSX props or positional args.
 * @internal
 */
function flattenChildren(children: unknown[]): JSXNode[]
{
    const out: JSXNode[] = [];

    for (const c of children)
    {
        if (c === null || c === undefined || c === false) continue;

        if (Array.isArray(c))
        {
            out.push(...flattenChildren(c));
        }
        else if (typeof c === 'object' && (c as AriannAFragment).__arianna_fragment)
        {
            out.push(...flattenChildren((c as AriannAFragment).children));
        }
        else
        {
            out.push(c as JSXNode);
        }
    }

    return out;
}

// ── Real-mode factory ──────────────────────────────────────────────────────────

/**
 * Create a `Real` instance from JSX.
 *
 * - Props → `.set()` for attributes, `.on()` for events (`$x` or `onX`).
 * - `$` event props take precedence over `on`-prefix duplicates.
 * - Children → `.add()` for strings/nodes.
 *
 * @param type  - Tag string or component constructor.
 * @param props - Merged props object (attributes + events + children).
 * @param args  - Additional positional children.
 * @internal
 */
function hReal(
    type    : string | (new (...a: unknown[]) => unknown),
    props   : JSXProps | null,
    ...args : unknown[]
): Real | AriannAFragment | DocumentFragment
{
    // ── Fragment ───────────────────────────────────────────────────────────────
    if ((type as unknown) === FRAGMENT_TAG || type === '')
    {
        const frag = document.createDocumentFragment();

        for (const child of flattenChildren(args))
        {
            if      (child instanceof Real)   frag.appendChild(child.render());
            else if (child instanceof Node)   frag.appendChild(child);
            else if (typeof child === 'string' || typeof child === 'number')
                frag.appendChild(document.createTextNode(String(child)));
        }

        return frag as unknown as AriannAFragment;
    }

    // ── Element ────────────────────────────────────────────────────────────────
    const tag    = resolveTag(type);
    const r      = new Real(tag);
    const events = new Map<string, EventListener>();
    const attrs  = new Map<string, string>();

    // $ props first — they take precedence over on-prefix duplicates
    const entries     = Object.entries(props ?? {});
    const dollarFirst = [
        ...entries.filter(([k]) =>  EVENT_DOLLAR.test(k)),
        ...entries.filter(([k]) => !EVENT_DOLLAR.test(k)),
    ];

    for (const [key, val] of dollarFirst)
    {
        if (key === 'children') continue;

        const evType = resolveEventType(key);
        if (evType)
        {
            if (!events.has(evType))
                events.set(evType, val as EventListener);
        }
        else
        {
            attrs.set(key, val == null ? '' : String(val));
        }
    }

    // Apply attributes then events
    for (const [k, v] of attrs)   r.set(k, v);
    for (const [t, fn] of events) r.on(t, fn);

    // Apply children
    const kids = flattenChildren([
        ...(props?.children !== undefined ? [props.children] : []),
        ...args,
    ]);

    for (const child of kids)
    {
        if      (child instanceof Real)        r.add(child.render());
        else if (child instanceof VirtualNode) r.add(child.render());
        else if (child instanceof Node)        r.add(child);
        else if (typeof child === 'string' || typeof child === 'number')
            r.add(String(child));
    }

    return r;
}

// ── Virtual-mode factory ───────────────────────────────────────────────────────

/**
 * Create a `VirtualNode` from JSX.
 *
 * - Attributes → plain `VAttrs` object passed to `Virtual.Create()`.
 * - Events (`$x` / `onX`) → registered via `.on()` after node creation.
 * - Children → `VirtualNode` children or text strings.
 *
 * @param type  - Tag string or component constructor.
 * @param props - Merged props object (attributes + events + children).
 * @param args  - Additional positional children.
 * @internal
 */
function hVirtual(
    type    : string | (new (...a: unknown[]) => unknown),
    props   : JSXProps | null,
    ...args : unknown[]
): VirtualNode | AriannAFragment
{
    // ── Fragment ───────────────────────────────────────────────────────────────
    if ((type as unknown) === FRAGMENT_TAG || type === '')
    {
        return {
            __arianna_fragment : true,
            children           : flattenChildren(args),
        } as AriannAFragment;
    }

    // ── Element ────────────────────────────────────────────────────────────────
    const tag        = resolveTag(type);
    const vAttrs     : VAttrs                           = {};
    const events     = new Map<string, (e: Event) => void>();

    // $ props first — they take precedence over on-prefix duplicates
    const entries     = Object.entries(props ?? {});
    const dollarFirst = [
        ...entries.filter(([k]) =>  EVENT_DOLLAR.test(k)),
        ...entries.filter(([k]) => !EVENT_DOLLAR.test(k)),
    ];

    for (const [key, val] of dollarFirst)
    {
        if (key === 'children') continue;

        const evType = resolveEventType(key);
        if (evType)
        {
            if (!events.has(evType))
                events.set(evType, val as (e: Event) => void);
        }
        else
        {
            vAttrs[key] = val as string | number | boolean | null;
        }
    }

    // Build children list
    const kids = flattenChildren([
        ...(props?.children !== undefined ? [props.children] : []),
        ...args,
    ]);

    const vChildren = kids.map(child =>
    {
        if      (child instanceof VirtualNode)                        return child;
        if      (child instanceof Real)                               return child.render();  // bridge Real → DOM
        if      (typeof child === 'string' || typeof child === 'number') return String(child);
        return String(child);
    });

    const node = new VirtualNode(tag, vAttrs as Record<string,string>, ...(vChildren as never[])) as VirtualNode;

    // Register event listeners — fired via Observable when node is mounted
    for (const [evType, fn] of events) node.on(evType, fn as never);

    return node;
}

// ── Global default runtime ────────────────────────────────────────────────────

/**
 * Global default JSX runtime mode.
 * Can be overridden per-file via the `@dom-render` pragma,
 * or set globally in `arianna.config.ts`.
 *
 * @internal
 */
let _defaultRuntime: JSXRuntime = 'real';

/**
 * Set the global default JSX runtime.
 * Called by the AriannA bundler or `arianna.config.ts` at build time.
 *
 * @param mode - Runtime mode: `'real'` or `'virtual'`.
 *
 * @example
 *   // arianna.config.ts
 *   setDefaultRuntime('virtual');
 */
export function setDefaultRuntime(mode: JSXRuntime): void
{
    _defaultRuntime = mode;
}

/**
 * Get the current global default JSX runtime.
 *
 * @returns The active runtime mode.
 */
export function getDefaultRuntime(): JSXRuntime
{
    return _defaultRuntime;
}

// ── h() — public JSX factory ───────────────────────────────────────────────────

/**
 * AriannA JSX element factory.
 *
 * TypeScript / esbuild call this for every JSX element.
 * The runtime (`real` | `virtual`) is determined by:
 *   1. Per-call `_runtime` prop (internal — set by the build transform).
 *   2. Global default set via `setDefaultRuntime()`.
 *
 * @param type  - Tag string (`'div'`) or component constructor (`MyCard`).
 * @param props - Props object — attributes + events (`$x` / `onX`) + children.
 * @param args  - Additional positional children.
 *
 * @example
 *   // Implicit real mode
 *   const el = h('div', { class: 'box' }, 'Hello');
 *
 * @example
 *   // Explicit virtual mode via internal prop
 *   const el = h('div', { class: 'box', _runtime: 'virtual' }, 'Hello');
 */
export function h(
    type    : string | (new (...a: unknown[]) => unknown),
    props   : JSXProps | null,
    ...args : unknown[]
): JSXNode
{
    const mode: JSXRuntime =
        (props as { _runtime?: JSXRuntime } | null)?._runtime ?? _defaultRuntime;

    // Strip internal prop before forwarding to mode factories
    if (props && '_runtime' in props)
    {
        const { _runtime: _, ...rest } = props as { _runtime?: JSXRuntime } & JSXProps;
        props = rest;
    }

    return (mode === 'virtual'
        ? hVirtual(type, props, ...args)
        : hReal(type, props, ...args)) as unknown as JSXNode;
}

// ── Fragment ───────────────────────────────────────────────────────────────────

/**
 * JSX Fragment symbol — `<>...</>` syntax.
 *
 * - Real mode    → `DocumentFragment`
 * - Virtual mode → `AriannAFragment` (array wrapper)
 */
export const Fragment = FRAGMENT_TAG as unknown as string;

// ── react-jsx compat exports ───────────────────────────────────────────────────

/**
 * `jsx()` — called by the TypeScript compiler for single-child elements.
 * Alias of `h()` — provided for `react-jsx` compatibility.
 */
export const jsx = h;

/**
 * `jsxs()` — called by the TypeScript compiler for multi-child elements.
 * Alias of `h()` — provided for `react-jsx` compatibility.
 */
export const jsxs = h;

/**
 * `jsxDEV()` — called in development builds with extra source-location info.
 * Drops the extra debug arguments and delegates to `h()`.
 *
 * @param type      - Tag string or constructor.
 * @param props     - Props object.
 * @param _key      - React-compat key (unused).
 * @param _isStatic - React-compat static flag (unused).
 * @param _source   - Babel source-location object (unused).
 * @param _self     - Babel self reference (unused).
 */
export function jsxDEV(
    type       : string | (new (...a: unknown[]) => unknown),
    props      : JSXProps | null,
    _key?      : string,
    _isStatic? : boolean,
    _source?   : unknown,
    _self?     : unknown,
): JSXNode
{
    return h(type, props);
}

// ── Window registration ────────────────────────────────────────────────────────

if (typeof window !== 'undefined')
{
    Object.defineProperty(window, 'AriannAJSX', {
        value       : { h, jsx, jsxs, jsxDEV, Fragment, setDefaultRuntime, getDefaultRuntime },
        writable    : false,
        enumerable  : true,
        configurable: false,
    });
}

// ── Default export ─────────────────────────────────────────────────────────────

export default { h, jsx, jsxs, jsxDEV, Fragment, setDefaultRuntime, getDefaultRuntime };
