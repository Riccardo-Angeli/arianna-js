/**
 * @module    jsx.d.ts
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 *
 * Global JSX type declarations for AriannA.
 * Dedicated with love to Arianna. ♡
 *
 * Place this file anywhere TypeScript can see it (or include it in tsconfig.json).
 * It enables full type-checking of JSX elements — all HTML/SVG tags are valid,
 * and event props (`$x` / `onX`) are typed as `EventListener`.
 *
 * ── tsconfig.json ─────────────────────────────────────────────────────────────
 *   {
 *     "compilerOptions": {
 *       "jsx"             : "react-jsx",
 *       "jsxImportSource" : "arianna"
 *     },
 *     "include": ["src/**\/*", "arianna.jsx.d.ts"]
 *   }
 */

import type { JSXNode, JSXProps } from './jsx-runtime.ts';
import type Real                  from './Real.ts';
import type { VirtualNode }       from './Virtual.ts';

// ── Event prop helpers ─────────────────────────────────────────────────────────

/** A valid event handler — either a raw `EventListener` or a typed `(e: Event) => void`. */
type EventProp = EventListener | ((e: Event) => void);

/** All possible event prop keys — `$eventname` and `onEventName`. */
type EventProps =
    { [K in `$${string}`]?              : EventProp }
  & { [K in `on${Capitalize<string>}`]? : EventProp };

/** Base props shared by every JSX element. */
interface BaseProps extends EventProps
{
    children?  : JSXNode | JSXNode[];
    key?       : string | number;
    ref?       : ((el: Element) => void) | { current: Element | null };
    /** @internal Set by the build transform to override runtime per-element. */
    _runtime?  : 'real' | 'virtual';
}

/** Generic element props — any string attribute is valid. */
type ElementProps = BaseProps & { [attr: string]: unknown };

// ── HTML element prop sets ─────────────────────────────────────────────────────

interface HTMLCommonProps extends BaseProps
{
    id?              : string;
    class?           : string;
    className?       : string;                          // alias for class
    style?           : string | Partial<CSSStyleDeclaration>;
    title?           : string;
    lang?            : string;
    dir?             : 'ltr' | 'rtl' | 'auto';
    hidden?          : boolean | string;
    tabindex?        : number | string;
    accesskey?       : string;
    draggable?       : boolean | string;
    contenteditable? : boolean | string;
    spellcheck?      : boolean | string;
    translate?       : 'yes' | 'no';
    'aria-label'?    : string;
    'aria-hidden'?   : boolean | string;
    'aria-role'?     : string;
    role?            : string;
    [data: `data-${string}`]: string | undefined;
}

interface AnchorProps extends HTMLCommonProps
{
    href?     : string;
    target?   : '_blank' | '_self' | '_parent' | '_top' | string;
    rel?      : string;
    download? : string | boolean;
    type?     : string;
}

interface ButtonProps extends HTMLCommonProps
{
    type?     : 'button' | 'submit' | 'reset';
    disabled? : boolean | string;
    name?     : string;
    value?    : string;
    form?     : string;
}

interface InputProps extends HTMLCommonProps
{
    type?         : string;
    value?        : string | number;
    placeholder?  : string;
    disabled?     : boolean | string;
    readonly?     : boolean | string;
    required?     : boolean | string;
    checked?      : boolean | string;
    min?          : string | number;
    max?          : string | number;
    step?         : string | number;
    minlength?    : number | string;
    maxlength?    : number | string;
    pattern?      : string;
    name?         : string;
    form?         : string;
    autocomplete? : string;
    autofocus?    : boolean | string;
    multiple?     : boolean | string;
    accept?       : string;
}

interface TextareaProps extends HTMLCommonProps
{
    rows?         : number | string;
    cols?         : number | string;
    placeholder?  : string;
    disabled?     : boolean | string;
    readonly?     : boolean | string;
    required?     : boolean | string;
    name?         : string;
    maxlength?    : number | string;
    minlength?    : number | string;
    autofocus?    : boolean | string;
    wrap?         : 'hard' | 'soft' | 'off';
}

interface SelectProps extends HTMLCommonProps
{
    multiple? : boolean | string;
    disabled? : boolean | string;
    required? : boolean | string;
    name?     : string;
    size?     : number | string;
    form?     : string;
}

interface ImgProps extends HTMLCommonProps
{
    src?      : string;
    alt?      : string;
    width?    : number | string;
    height?   : number | string;
    loading?  : 'lazy' | 'eager' | 'auto';
    decoding? : 'async' | 'sync' | 'auto';
    srcset?   : string;
    sizes?    : string;
}

interface FormProps extends HTMLCommonProps
{
    action?       : string;
    method?       : 'get' | 'post' | 'dialog';
    enctype?      : string;
    target?       : string;
    novalidate?   : boolean | string;
    autocomplete? : string;
    name?         : string;
}

interface LabelProps extends HTMLCommonProps
{
    for?     : string;
    htmlFor? : string;   // alias
    form?    : string;
}

interface LinkProps extends HTMLCommonProps
{
    href?        : string;
    rel?         : string;
    type?        : string;
    media?       : string;
    as?          : string;
    crossorigin? : string;
}

interface MetaProps extends HTMLCommonProps
{
    name?         : string;
    content?      : string;
    charset?      : string;
    'http-equiv'? : string;
}

interface ScriptProps extends HTMLCommonProps
{
    src?         : string;
    type?        : string;
    async?       : boolean | string;
    defer?       : boolean | string;
    nomodule?    : boolean | string;
    crossorigin? : string;
}

interface TableProps extends HTMLCommonProps
{
    border?      : string;
    cellpadding? : string;
    cellspacing? : string;
    summary?     : string;
}

interface TdThProps extends HTMLCommonProps
{
    colspan? : number | string;
    rowspan? : number | string;
    headers? : string;
    scope?   : 'row' | 'col' | 'rowgroup' | 'colgroup';
}

interface VideoAudioProps extends HTMLCommonProps
{
    src?      : string;
    controls? : boolean | string;
    autoplay? : boolean | string;
    loop?     : boolean | string;
    muted?    : boolean | string;
    preload?  : 'none' | 'metadata' | 'auto';
    poster?   : string;
    width?    : number | string;
    height?   : number | string;
}

interface IFrameProps extends HTMLCommonProps
{
    src?             : string;
    srcdoc?          : string;
    name?            : string;
    width?           : number | string;
    height?          : number | string;
    allowfullscreen? : boolean | string;
    loading?         : 'lazy' | 'eager';
    sandbox?         : string;
}

interface ProgressProps extends HTMLCommonProps
{
    value? : number | string;
    max?   : number | string;
}

interface DetailsProps extends HTMLCommonProps
{
    open?: boolean | string;
}

interface DialogProps extends HTMLCommonProps
{
    open?: boolean | string;
}

// ── SVG element prop sets ──────────────────────────────────────────────────────

interface SVGCommonProps extends BaseProps
{
    id?                        : string;
    class?                     : string;
    style?                     : string | Partial<CSSStyleDeclaration>;
    fill?                      : string;
    stroke?                    : string;
    'stroke-width'?            : number | string;
    'stroke-linecap'?          : 'butt' | 'round' | 'square';
    'stroke-linejoin'?         : 'miter' | 'round' | 'bevel';
    opacity?                   : number | string;
    transform?                 : string;
    'clip-path'?               : string;
    filter?                    : string;
    mask?                      : string;
    'font-size'?               : number | string;
    'font-family'?             : string;
    'text-anchor'?             : 'start' | 'middle' | 'end';
    visibility?                : string;
    display?                   : string;
    [attr: string]             : unknown;
}

interface SVGProps extends SVGCommonProps
{
    xmlns?   : string;
    width?   : number | string;
    height?  : number | string;
    viewBox? : string;
    version? : string;
}

interface CircleProps extends SVGCommonProps
{
    cx? : number | string;
    cy? : number | string;
    r?  : number | string;
}

interface RectProps extends SVGCommonProps
{
    x?      : number | string;
    y?      : number | string;
    width?  : number | string;
    height? : number | string;
    rx?     : number | string;
    ry?     : number | string;
}

interface EllipseProps extends SVGCommonProps
{
    cx? : number | string;
    cy? : number | string;
    rx? : number | string;
    ry? : number | string;
}

interface LineProps extends SVGCommonProps
{
    x1? : number | string;
    y1? : number | string;
    x2? : number | string;
    y2? : number | string;
}

interface PathProps extends SVGCommonProps
{
    d?           : string;
    'fill-rule'? : 'nonzero' | 'evenodd';
    'clip-rule'? : 'nonzero' | 'evenodd';
}

interface PolyProps extends SVGCommonProps
{
    points? : string;
}

interface TextSVGProps extends SVGCommonProps
{
    x?      : number | string;
    y?      : number | string;
    dx?     : number | string;
    dy?     : number | string;
    rotate? : number | string;
}

interface UseProps extends SVGCommonProps
{
    href?         : string;
    'xlink:href'? : string;
    x?            : number | string;
    y?            : number | string;
    width?        : number | string;
    height?       : number | string;
}

interface GradientProps extends SVGCommonProps
{
    gradientUnits?     : 'userSpaceOnUse' | 'objectBoundingBox';
    gradientTransform? : string;
    x1?                : number | string;
    y1?                : number | string;
    x2?                : number | string;
    y2?                : number | string;
    cx?                : number | string;
    cy?                : number | string;
    r?                 : number | string;
    fx?                : number | string;
    fy?                : number | string;
    spreadMethod?      : 'pad' | 'reflect' | 'repeat';
}

interface StopProps extends SVGCommonProps
{
    offset?         : number | string;
    'stop-color'?   : string;
    'stop-opacity'? : number | string;
}

interface ClipPathProps extends SVGCommonProps
{
    clipPathUnits? : 'userSpaceOnUse' | 'objectBoundingBox';
}

interface MarkerProps extends SVGCommonProps
{
    markerWidth?  : number | string;
    markerHeight? : number | string;
    refX?         : number | string;
    refY?         : number | string;
    orient?       : string;
    markerUnits?  : 'strokeWidth' | 'userSpaceOnUse';
}

interface PatternProps extends SVGCommonProps
{
    patternUnits?     : 'userSpaceOnUse' | 'objectBoundingBox';
    patternTransform? : string;
    x?                : number | string;
    y?                : number | string;
    width?            : number | string;
    height?           : number | string;
}

interface ImageSVGProps extends SVGCommonProps
{
    href?   : string;
    x?      : number | string;
    y?      : number | string;
    width?  : number | string;
    height? : number | string;
    preserveAspectRatio? : string;
}

interface ForeignObjectProps extends SVGCommonProps
{
    x?      : number | string;
    y?      : number | string;
    width?  : number | string;
    height? : number | string;
}

interface SymbolProps extends SVGCommonProps
{
    viewBox?             : string;
    preserveAspectRatio? : string;
}

interface FilterProps extends SVGCommonProps
{
    x?                                : number | string;
    y?                                : number | string;
    width?                            : number | string;
    height?                           : number | string;
    filterUnits?                      : string;
    primitiveUnits?                   : string;
    color?                            : string;
    'color-interpolation-filters'?    : string;
}

// ── Global JSX namespace ───────────────────────────────────────────────────────

declare global
{
    namespace JSX
    {
        /** The return type of `h()` / `jsx()` / `jsxs()`. */
        type Element = JSXNode;

        /** Props that all elements accept. */
        interface ElementAttributesProperty  { props: object; }

        /** Where children live inside props. */
        interface ElementChildrenAttribute   { children: JSXNode | JSXNode[]; }

        /**
         * All intrinsic HTML + SVG element types with their prop sets.
         * Custom elements (hyphenated string tags) fall through to `ElementProps`.
         */
        interface IntrinsicElements
        {
            // ── HTML structural ────────────────────────────────────────────────
            html        : HTMLCommonProps;
            head        : HTMLCommonProps;
            body        : HTMLCommonProps;
            header      : HTMLCommonProps;
            footer      : HTMLCommonProps;
            main        : HTMLCommonProps;
            nav         : HTMLCommonProps;
            aside       : HTMLCommonProps;
            section     : HTMLCommonProps;
            article     : HTMLCommonProps;
            div         : HTMLCommonProps;
            span        : HTMLCommonProps;
            p           : HTMLCommonProps;
            h1          : HTMLCommonProps;
            h2          : HTMLCommonProps;
            h3          : HTMLCommonProps;
            h4          : HTMLCommonProps;
            h5          : HTMLCommonProps;
            h6          : HTMLCommonProps;

            // ── HTML interactive ───────────────────────────────────────────────
            a           : AnchorProps;
            button      : ButtonProps;
            input       : InputProps;
            textarea    : TextareaProps;
            select      : SelectProps;
            option      : HTMLCommonProps & { value?: string; selected?: boolean | string; disabled?: boolean | string; };
            optgroup    : HTMLCommonProps & { label?: string; disabled?: boolean | string; };
            form        : FormProps;
            label       : LabelProps;
            fieldset    : HTMLCommonProps & { disabled?: boolean | string; form?: string; name?: string; };
            legend      : HTMLCommonProps;
            details     : DetailsProps;
            summary     : HTMLCommonProps;
            dialog      : DialogProps;

            // ── HTML media / embed ─────────────────────────────────────────────
            img         : ImgProps;
            video       : VideoAudioProps;
            audio       : VideoAudioProps;
            source      : HTMLCommonProps & { src?: string; type?: string; srcset?: string; media?: string; };
            track       : HTMLCommonProps & { src?: string; kind?: string; srclang?: string; label?: string; default?: boolean | string; };
            iframe      : IFrameProps;
            canvas      : HTMLCommonProps & { width?: number | string; height?: number | string; };
            picture     : HTMLCommonProps;
            figure      : HTMLCommonProps;
            figcaption  : HTMLCommonProps;
            embed       : HTMLCommonProps & { src?: string; type?: string; width?: number | string; height?: number | string; };
            object      : HTMLCommonProps & { data?: string; type?: string; name?: string; width?: number | string; height?: number | string; };

            // ── HTML table ─────────────────────────────────────────────────────
            table       : TableProps;
            thead       : HTMLCommonProps;
            tbody       : HTMLCommonProps;
            tfoot       : HTMLCommonProps;
            tr          : HTMLCommonProps;
            th          : TdThProps;
            td          : TdThProps;
            col         : HTMLCommonProps & { span?: number | string; width?: number | string; };
            colgroup    : HTMLCommonProps & { span?: number | string; };
            caption     : HTMLCommonProps;

            // ── HTML lists ─────────────────────────────────────────────────────
            ul          : HTMLCommonProps;
            ol          : HTMLCommonProps & { start?: number | string; reversed?: boolean | string; type?: string; };
            li          : HTMLCommonProps & { value?: number | string; };
            dl          : HTMLCommonProps;
            dt          : HTMLCommonProps;
            dd          : HTMLCommonProps;

            // ── HTML text ──────────────────────────────────────────────────────
            strong      : HTMLCommonProps;
            em          : HTMLCommonProps;
            b           : HTMLCommonProps;
            i           : HTMLCommonProps;
            u           : HTMLCommonProps;
            s           : HTMLCommonProps;
            small       : HTMLCommonProps;
            mark        : HTMLCommonProps;
            del         : HTMLCommonProps;
            ins         : HTMLCommonProps;
            sub         : HTMLCommonProps;
            sup         : HTMLCommonProps;
            code        : HTMLCommonProps;
            pre         : HTMLCommonProps;
            kbd         : HTMLCommonProps;
            samp        : HTMLCommonProps;
            var         : HTMLCommonProps;
            cite        : HTMLCommonProps;
            q           : HTMLCommonProps & { cite?: string; };
            abbr        : HTMLCommonProps & { title?: string; };
            time        : HTMLCommonProps & { datetime?: string; };
            data        : HTMLCommonProps & { value?: string; };
            address     : HTMLCommonProps;
            blockquote  : HTMLCommonProps & { cite?: string; };

            // ── HTML misc ──────────────────────────────────────────────────────
            hr          : HTMLCommonProps;
            br          : HTMLCommonProps;
            wbr         : HTMLCommonProps;
            slot        : HTMLCommonProps & { name?: string; };
            template    : HTMLCommonProps;
            noscript    : HTMLCommonProps;
            script      : ScriptProps;
            style       : HTMLCommonProps & { media?: string; type?: string; };
            link        : LinkProps;
            meta        : MetaProps;
            title       : HTMLCommonProps;
            base        : HTMLCommonProps & { href?: string; target?: string; };
            progress    : ProgressProps;
            meter       : HTMLCommonProps & { value?: number | string; min?: number | string; max?: number | string; low?: number | string; high?: number | string; optimum?: number | string; };
            menu        : HTMLCommonProps;
            output      : HTMLCommonProps & { for?: string; form?: string; name?: string; };
            datalist    : HTMLCommonProps;
            search      : HTMLCommonProps;

            // ── SVG ────────────────────────────────────────────────────────────
            svg                     : SVGProps;
            g                       : SVGCommonProps;
            circle                  : CircleProps;
            ellipse                 : EllipseProps;
            rect                    : RectProps;
            line                    : LineProps;
            polyline                : PolyProps;
            polygon                 : PolyProps;
            path                    : PathProps;
            text                    : TextSVGProps;
            tspan                   : TextSVGProps;
            use                     : UseProps;
            defs                    : SVGCommonProps;
            symbol                  : SymbolProps;
            marker                  : MarkerProps;
            pattern                 : PatternProps;
            clipPath                : ClipPathProps;
            mask                    : SVGCommonProps;
            image                   : ImageSVGProps;
            foreignObject           : ForeignObjectProps;
            linearGradient          : GradientProps;
            radialGradient          : GradientProps;
            stop                    : StopProps;
            filter                  : FilterProps;
            feBlend                 : SVGCommonProps;
            feColorMatrix           : SVGCommonProps;
            feComponentTransfer     : SVGCommonProps;
            feComposite             : SVGCommonProps;
            feConvolveMatrix        : SVGCommonProps;
            feDiffuseLighting       : SVGCommonProps;
            feDisplacementMap       : SVGCommonProps;
            feDropShadow            : SVGCommonProps;
            feFlood                 : SVGCommonProps;
            feFuncA                 : SVGCommonProps;
            feFuncB                 : SVGCommonProps;
            feFuncG                 : SVGCommonProps;
            feFuncR                 : SVGCommonProps;
            feGaussianBlur          : SVGCommonProps;
            feImage                 : SVGCommonProps;
            feMerge                 : SVGCommonProps;
            feMergeNode             : SVGCommonProps;
            feMorphology            : SVGCommonProps;
            feOffset                : SVGCommonProps;
            fePointLight            : SVGCommonProps;
            feSpecularLighting      : SVGCommonProps;
            feSpotLight             : SVGCommonProps;
            feTile                  : SVGCommonProps;
            feTurbulence            : SVGCommonProps;
            animate                 : SVGCommonProps;
            animateMotion           : SVGCommonProps;
            animateTransform        : SVGCommonProps;
            set                     : SVGCommonProps;
            desc                    : SVGCommonProps;
            metadata                : SVGCommonProps;
            textPath                : SVGCommonProps & { href?: string; startOffset?: number | string; method?: string; spacing?: string; };
            switch                  : SVGCommonProps;
            view                    : SVGCommonProps;
            cursor                  : SVGCommonProps;

            // ── Custom elements (hyphenated tags) ──────────────────────────────
            // Any string tag not listed above falls through to ElementProps.
            [customTag: string]     : ElementProps;
        }
    }
}
