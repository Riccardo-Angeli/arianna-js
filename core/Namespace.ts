/**
 * @module    Namespace
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Registers all built-in AriannA namespaces into `Core.Namespaces`.
 * Import this module **after** Core and **before** Real/Virtual/Component.
 *
 * ── BUILT-IN NAMESPACES ───────────────────────────────────────────────────────
 *
 *   html    → http://www.w3.org/1999/xhtml         (56 interfaces, 118 tags)
 *   svg     → http://www.w3.org/2000/svg            (34 interfaces)
 *   mathML  → http://www.w3.org/1998/Math/MathML   (29 elements)
 *   x3d     → http://www.web3d.org/specifications/x3d-namespace
 *
 * ── SVG CONSTRUCTORS ─────────────────────────────────────────────────────────
 *
 * All SVG elements are created via `document.createElementNS` internally.
 * They are fully accessible through Real and Virtual:
 *
 *   new Real('svg')     // SVGSVGElement
 *   new Real('circle')  // SVGCircleElement
 *   new Real('path')    // SVGPathElement
 *   Virtual.Create('svg', { viewBox: '0 0 100 100' },
 *     Virtual.Create('circle', { cx: '50', cy: '50', r: '40', fill: 'blue' })
 *   )
 *
 * ── CUSTOM NAMESPACE ─────────────────────────────────────────────────────────
 *
 *   import { RegisterNamespace } from './Namespace.ts';
 *
 *   RegisterNamespace('myNS', {
 *     name     : 'myNS',
 *     schema   : 'https://example.com/ns',
 *     state    : 'enabled',
 *     enabled  : true,
 *     disabled : false,
 *     base     : HTMLElement,
 *     types    : {
 *       standard : { interfaces: {}, tags: {} },
 *       custom   : { interfaces: {}, tags: {} },
 *     },
 *     functions: {
 *       create : (tag) => document.createElementNS('https://example.com/ns', String(tag)),
 *       patch  : htmlFunctions.patch,   // reuse HTML patcher
 *     },
 *     documentation: { w3c: 'https://example.com/spec' },
 *   });
 *
 *   // Elements are then created via:
 *   new Real('my-element')           // resolved via Core.GetDescriptor → myNS
 *   Virtual.Create('my-element', {}) // same lookup
 *
 * @example
 *   // Import to trigger registration (side-effect import)
 *   import './Namespace.ts';
 *   console.log(Core.Namespaces.html.types.standard.interfaces.HTMLDivElement);
 *
 * @example
 *   // Register a custom namespace
 *   import { RegisterNamespace } from './Namespace.ts';
 *   RegisterNamespace('latex', {
 *     name: 'latex', schema: 'http://latex.example.com/ns',
 *     state: 'enabled', enabled: true, disabled: false,
 *     base: HTMLElement,
 *     types: { standard: { interfaces: {}, tags: {} }, custom: { interfaces: {}, tags: {} } },
 *     functions: {
 *       create: (tag) => document.createElement(String(tag)),
 *       patch:  () => {},
 *     },
 *   });
 */

import Core, {
    type NamespaceDescriptor,
    type NamespaceFunctions,
    type TypeDescriptor,
} from './Core.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal standard type descriptor stub. */
function iface(name: string, tags: string[]): TypeDescriptor
{
    return {
        Name        : name,
        Tags        : tags,
        Namespace   : null as unknown as NamespaceDescriptor, // filled during init
        Constructor : null,
        Interface   : null,
        Prototype   : null,
        Supported   : false,
        Defined     : false,
        Declaration : 'FUNCTION',
        Type        : 'STANDARD',
        Standard    : true,
        Custom      : false,
        Style       : {},
    };
}

// ── HTML patch / create ───────────────────────────────────────────────────────

const htmlFunctions: NamespaceFunctions = {
    create(tag)
    {
        let t = tag;
        if (typeof t === 'function') {
            const d = Core.GetDescriptor(t);
            t = d ? d.Tags[0] : undefined as unknown as string;
        }
        if (typeof t === 'string') return document.createElement(t.toLowerCase());
        return false;
    },

    patch(constructorName: string)
    {
        const win = window as unknown as Record<string, unknown>;
        const iface = win[constructorName] as (new () => Element) | undefined;
        if (!iface || typeof iface !== 'function') return;

        const name   = iface.name;
        const create = htmlFunctions.create;

        // Wrap the native constructor so it works both as new X() and as Real(X)
        const wrapped = function (this: Element)
        {
            const p = (this.constructor as { prototype: object }).prototype;
            return Object.setPrototypeOf(
                create(this.constructor as new () => Element) as Element,
                p,
            );
        };

        Object.defineProperty(wrapped, 'name', { value: name });
        wrapped.prototype             = iface.prototype;
        wrapped.prototype.constructor = wrapped;
        win[name]                     = wrapped;
    },
};

// ── HTML namespace ────────────────────────────────────────────────────────────

const htmlInterfaces: Record<string, TypeDescriptor> = {
    HTMLElement              : iface('HTMLElement',              ['address','article','footer','header','section','nav','dd','dt','figcaption','figure','main','abbr','b','bdi','bdo','cite','code','dfn','em','i','mark','rt','rtc','ruby','s','samp','small','strong','sub','sup','u','var','wbr','area','noscript','noembed','plaintext','strike','tt','summary','acronym','basefont','big','center']),
    HTMLUnknownElement       : iface('HTMLUnknownElement',       ['isindex','spacer','menuitem','decorator','applet','blink','keygen']),
    HTMLHtmlElement          : iface('HTMLHtmlElement',          ['html']),
    HTMLHeadElement          : iface('HTMLHeadElement',          ['head']),
    HTMLBaseElement          : iface('HTMLBaseElement',          ['base']),
    HTMLLinkElement          : iface('HTMLLinkElement',          ['link']),
    HTMLMetaElement          : iface('HTMLMetaElement',          ['meta']),
    HTMLStyleElement         : iface('HTMLStyleElement',         ['style']),
    HTMLTitleElement         : iface('HTMLTitleElement',         ['title']),
    HTMLPreElement           : iface('HTMLPreElement',           ['pre','listing','xmp']),
    HTMLHeadingElement       : iface('HTMLHeadingElement',       ['h1','h2','h3','h4','h5','h6']),
    HTMLDivElement           : iface('HTMLDivElement',           ['div']),
    HTMLDListElement         : iface('HTMLDListElement',         ['dl']),
    HTMLHRElement            : iface('HTMLHRElement',            ['hr']),
    HTMLLIElement            : iface('HTMLLIElement',            ['li']),
    HTMLOListElement         : iface('HTMLOListElement',         ['ol']),
    HTMLParagraphElement     : iface('HTMLParagraphElement',     ['p']),
    HTMLUListElement         : iface('HTMLUListElement',         ['ul']),
    HTMLAnchorElement        : iface('HTMLAnchorElement',        ['a']),
    HTMLBRElement            : iface('HTMLBRElement',            ['br']),
    HTMLSpanElement          : iface('HTMLSpanElement',          ['span']),
    HTMLAudioElement         : iface('HTMLAudioElement',         ['audio']),
    HTMLImageElement         : iface('HTMLImageElement',         ['img']),
    HTMLVideoElement         : iface('HTMLVideoElement',         ['video']),
    HTMLCanvasElement        : iface('HTMLCanvasElement',        ['canvas']),
    HTMLIFrameElement        : iface('HTMLIFrameElement',        ['iframe']),
    HTMLScriptElement        : iface('HTMLScriptElement',        ['script']),
    HTMLInputElement         : iface('HTMLInputElement',         ['input']),
    HTMLButtonElement        : iface('HTMLButtonElement',        ['button']),
    HTMLTextAreaElement      : iface('HTMLTextAreaElement',      ['textarea']),
    HTMLSelectElement        : iface('HTMLSelectElement',        ['select']),
    HTMLOptionElement        : iface('HTMLOptionElement',        ['option']),
    HTMLFormElement          : iface('HTMLFormElement',          ['form']),
    HTMLFieldSetElement      : iface('HTMLFieldSetElement',      ['fieldset']),
    HTMLLabelElement         : iface('HTMLLabelElement',         ['label']),
    HTMLTableElement         : iface('HTMLTableElement',         ['table']),
    HTMLTableRowElement      : iface('HTMLTableRowElement',      ['tr']),
    HTMLTableCellElement     : iface('HTMLTableCellElement',     ['td','th']),
    HTMLTableSectionElement  : iface('HTMLTableSectionElement',  ['tbody','thead','tfoot']),
    HTMLTableColElement      : iface('HTMLTableColElement',      ['col','colgroup']),
    HTMLTableCaptionElement  : iface('HTMLTableCaptionElement',  ['caption']),
    HTMLProgressElement      : iface('HTMLProgressElement',      ['progress']),
    HTMLDataListElement      : iface('HTMLDataListElement',      ['datalist']),
    HTMLOptGroupElement      : iface('HTMLOptGroupElement',      ['optgroup']),
    HTMLMapElement           : iface('HTMLMapElement',           ['map']),
    HTMLTrackElement         : iface('HTMLTrackElement',         ['track']),
    HTMLSourceElement        : iface('HTMLSourceElement',        ['source']),
    HTMLEmbedElement         : iface('HTMLEmbedElement',         ['embed']),
    HTMLObjectElement        : iface('HTMLObjectElement',        ['object']),
    HTMLParamElement         : iface('HTMLParamElement',         ['param']),
    HTMLModElement           : iface('HTMLModElement',           ['ins','del']),
    HTMLQuoteElement         : iface('HTMLQuoteElement',         ['blockquote','q']),
    HTMLMenuElement          : iface('HTMLMenuElement',          ['menu']),
    HTMLDialogElement        : iface('HTMLDialogElement',        ['dialog']),
    HTMLTemplateElement      : iface('HTMLTemplateElement',      ['template']),
    HTMLSlotElement          : iface('HTMLSlotElement',          ['slot']),
};

const htmlNS: NamespaceDescriptor = {
    name          : 'html',
    schema        : 'http://www.w3.org/1999/xhtml',
    state         : 'enabled',
    enabled       : true,
    disabled      : false,
    base          : HTMLElement,
    tags          : {},
    types         :
    {
        standard : { interfaces: htmlInterfaces, tags: {} },
        custom   : { interfaces: {}, tags: {} },
    },
    functions     : htmlFunctions,
    documentation : { w3c: 'https://html.spec.whatwg.org/' },
};

// ── SVG namespace ─────────────────────────────────────────────────────────────

const svgFunctions: NamespaceFunctions = {
    create(tag)
    {
        let t = tag;
        if (typeof t === 'function') {
            const d = Core.GetDescriptor(t);
            t = d ? d.Tags[0] : undefined as unknown as string;
        }
        if (typeof t === 'string')
            return document.createElementNS('http://www.w3.org/2000/svg', t.toLowerCase()) as unknown as Element;
        return false;
    },
    patch: htmlFunctions.patch, // reuse HTML patcher
};

const svgInterfaces: Record<string, TypeDescriptor> = {
    SVGSVGElement            : iface('SVGSVGElement',            ['svg']),
    SVGGElement              : iface('SVGGElement',              ['g']),
    SVGPathElement           : iface('SVGPathElement',           ['path']),
    SVGRectElement           : iface('SVGRectElement',           ['rect']),
    SVGCircleElement         : iface('SVGCircleElement',         ['circle']),
    SVGEllipseElement        : iface('SVGEllipseElement',        ['ellipse']),
    SVGLineElement           : iface('SVGLineElement',           ['line']),
    SVGPolylineElement       : iface('SVGPolylineElement',       ['polyline']),
    SVGPolygonElement        : iface('SVGPolygonElement',        ['polygon']),
    SVGTextElement           : iface('SVGTextElement',           ['text']),
    SVGTSpanElement          : iface('SVGTSpanElement',          ['tspan']),
    SVGImageElement          : iface('SVGImageElement',          ['image']),
    SVGUseElement            : iface('SVGUseElement',            ['use']),
    SVGDefsElement           : iface('SVGDefsElement',           ['defs']),
    SVGSymbolElement         : iface('SVGSymbolElement',         ['symbol']),
    SVGMarkerElement         : iface('SVGMarkerElement',         ['marker']),
    SVGLinearGradientElement : iface('SVGLinearGradientElement', ['lineargradient']),
    SVGRadialGradientElement : iface('SVGRadialGradientElement', ['radialgradient']),
    SVGStopElement           : iface('SVGStopElement',           ['stop']),
    SVGClipPathElement       : iface('SVGClipPathElement',       ['clippath']),
    SVGMaskElement           : iface('SVGMaskElement',           ['mask']),
    SVGFilterElement         : iface('SVGFilterElement',         ['filter']),
    SVGAnimateElement        : iface('SVGAnimateElement',        ['animate']),
    SVGAnimateMotionElement  : iface('SVGAnimateMotionElement',  ['animatemotion']),
    SVGAnimateTransformElement: iface('SVGAnimateTransformElement',['animatetransform']),
    SVGSetElement            : iface('SVGSetElement',            ['set']),
    SVGViewElement           : iface('SVGViewElement',           ['view']),
    SVGScriptElement         : iface('SVGScriptElement',         ['script']),
    SVGStyleElement          : iface('SVGStyleElement',          ['style']),
    SVGTitleElement          : iface('SVGTitleElement',          ['title']),
    SVGDescElement           : iface('SVGDescElement',           ['desc']),
    SVGMetadataElement       : iface('SVGMetadataElement',       ['metadata']),
    SVGForeignObjectElement  : iface('SVGForeignObjectElement',  ['foreignobject']),
    SVGSwitchElement         : iface('SVGSwitchElement',         ['switch']),
};

const svgNS: NamespaceDescriptor = {
    name          : 'svg',
    schema        : 'http://www.w3.org/2000/svg',
    state         : 'enabled',
    enabled       : true,
    disabled      : false,
    base          : SVGElement,
    tags          : {},
    types         :
    {
        standard : { interfaces: svgInterfaces, tags: {} },
        custom   : { interfaces: {}, tags: {} },
    },
    functions     : svgFunctions,
    documentation : { w3c: 'https://www.w3.org/TR/SVG2/' },
};

// ── MathML namespace ──────────────────────────────────────────────────────────

const mathMLNS: NamespaceDescriptor = {
    name          : 'mathML',
    schema        : 'http://www.w3.org/1998/Math/MathML',
    state         : 'enabled',
    enabled       : true,
    disabled      : false,
    base          : typeof MathMLElement !== 'undefined' ? MathMLElement : HTMLElement,
    tags          : {},
    types         :
    {
        standard :
        {
            interfaces :
            {
                MathMLElement : iface('MathMLElement', ['math','mi','mo','mn','ms','mspace','mtext','mfrac','msqrt','mroot','mstyle','merror','mpadded','mphantom','mrow','mfenced','menclose','msub','msup','msubsup','munder','mover','munderover','mmultiscripts','mtable','mtr','mtd','mlabeledtr','maction']),
            },
            tags : {},
        },
        custom  : { interfaces: {}, tags: {} },
    },
    functions :
    {
        create(tag)
        {
            const t = typeof tag === 'string' ? tag : undefined;
            if (!t) return false;
            return document.createElementNS(
                'http://www.w3.org/1998/Math/MathML', t.toLowerCase()
            ) as unknown as Element;
        },
        patch: htmlFunctions.patch,
    },
    documentation : { w3c: 'https://www.w3.org/TR/MathML3/' },
};

// ── X3D namespace ─────────────────────────────────────────────────────────────

const x3dNS: NamespaceDescriptor = {
    name          : 'x3d',
    schema        : 'http://www.web3d.org/specifications/x3d-namespace',
    state         : 'enabled',
    enabled       : true,
    disabled      : false,
    base          : HTMLElement,
    tags          : {},
    types         :
    {
        standard : { interfaces: {}, tags: {} },
        custom   : { interfaces: {}, tags: {} },
    },
    functions :
    {
        create(tag)
        {
            const t = typeof tag === 'string' ? tag : undefined;
            if (!t) return false;
            return document.createElementNS(
                'http://www.web3d.org/specifications/x3d-namespace', t
            ) as unknown as Element;
        },
        patch: htmlFunctions.patch,
    },
    documentation : { w3c: 'https://www.web3d.org/specifications/x3d-4.0/' },
};

// ── Init: register all namespaces + patch standard interfaces ─────────────────

function initNamespace(ns: NamespaceDescriptor): void
{
    const std = ns.types.standard;

    for (const key of Object.keys(std.interfaces))
    {
        const d = std.interfaces[key];

        // Back-fill Namespace reference (circular — set after object creation)
        d.Namespace = ns;

        // Patch the native constructor so it can be used as a Real constructor
        if (ns.functions.patch) ns.functions.patch(key);

        // Resolve native window globals
        const win = window as unknown as Record<string, unknown>;
        d.Supported   = Boolean(win[key]);
        d.Defined     = true;
        d.Constructor = (win[key] as (new () => Element)) ?? null;
        d.Interface   = (win[key] as (new () => Element)) ?? null;
        d.Prototype   = d.Supported
            ? (win[key] as { prototype: object }).prototype
            : null;

        // Build tag index
        for (const tag of d.Tags)
        {
            std.tags[tag]  = d;
            ns.tags[tag]   = d;
            // Ensure Name is set on the tag entry (defensive)
            std.tags[tag].Name = tag;
        }
    }
}

// Register and initialize
Core.RegisterNamespace('html',   htmlNS);
Core.RegisterNamespace('svg',    svgNS);
Core.RegisterNamespace('mathML', mathMLNS);
Core.RegisterNamespace('x3d',    x3dNS);

for (const key of Object.keys(Core.Namespaces))
{
    initNamespace(Core.Namespaces[key]);
}

/**
 * Register a fully custom namespace at runtime.
 *
 * After registration, elements in this namespace are resolved automatically by
 * `Real`, `Virtual.Create`, and `Core.GetDescriptor`. Pairs well with the
 * `arianna-wip.arianna-wip-config.ts` `namespaces.custom` arianna-wip-config block.
 *
 * @param key - Short namespace identifier (e.g. `'myNS'`, `'latex'`, `'x3d-ext'`).
 * @param ns  - Namespace descriptor. `tags` is optional — auto-built from `types.standard.interfaces`.
 *
 * @example
 *   // Minimal custom element namespace
 *   import { RegisterNamespace } from './Namespace.ts';
 *
 *   RegisterNamespace('myUI', {
 *     name     : 'myUI',
 *     schema   : 'https://myui.example.com',
 *     state    : 'enabled',
 *     enabled  : true,
 *     disabled : false,
 *     base     : HTMLElement,
 *     types    : {
 *       standard : { interfaces: {}, tags: {} },
 *       custom   : { interfaces: {}, tags: {} },
 *     },
 *     functions: {
 *       create: (tag) => document.createElement(String(tag)),
 *       patch:  () => {},
 *     },
 *   });
 *   // Elements now resolvable via Real('myui-button'), Virtual.Create('myui-button')
 *
 * @example
 *   // SVG extension namespace (createElementNS)
 *   RegisterNamespace('svgExt', {
 *     name: 'svgExt', schema: 'http://mycompany.com/svg-ext',
 *     state: 'enabled', enabled: true, disabled: false,
 *     base: SVGElement,
 *     types: { standard: { interfaces: {}, tags: {} }, custom: { interfaces: {}, tags: {} } },
 *     functions: {
 *       create: (tag) => document.createElementNS('http://mycompany.com/svg-ext', String(tag)),
 *       patch:  () => {},
 *     },
 *   });
 */
export function RegisterNamespace(
    key : string,
    ns  : Omit<NamespaceDescriptor, 'tags'> & { tags?: Record<string, TypeDescriptor> },
): void
{
    const full: NamespaceDescriptor = { tags: {}, ...ns } as NamespaceDescriptor;
    Core.RegisterNamespace(key, full);
    initNamespace(full);
}

export default Core.Namespaces;
