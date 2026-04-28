/**
 * @module    Rule
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Models a single CSS rule — from simple selectors to all CSS @-rules.
 * Observable: fires Rule-Changed on any mutation.
 *
 * ── CONSTRUCTOR OVERLOADS ─────────────────────────────────────────────────────
 *   new Rule('.selector', 'color: red')
 *   new Rule('.selector', { color: 'red', fontSize: '14px' })
 *   new Rule({ Selector: '.selector', Contents: { color: 'red' } })
 *   new Rule({ Selector: '.selector', Rule: 'color: red' })   // legacy alias
 *   new Rule(cssRuleInstance)
 *   new Rule('.selector')                                       // empty
 *
 * ── OBJECT-SELECTOR FORM (Golem structured @-rules) ─────────────────────────
 *   new Rule({ Selector: { Type: '@charset', Value: 'utf-8' } })
 *   new Rule({ Selector: { Type: '@keyframes', Name: 'spin' }, Contents: { From: {...}, To: {...} } })
 *   new Rule({ Selector: { Type: '@media', Media: 'screen', And: { MinHeight: '600px' } }, Rules: { ... } })
 *   new Rule({ Selector: { Type: '@supports', Not: { display: 'grid' } }, Rules: { ... } })
 *   new Rule({ Selector: { Type: '@import', Url: 'url(...)', Media: 'screen', And: {...} }, Rules: { ... } })
 *   new Rule({ Selector: { Type: '@document', Url: '...', Prefix: '...', Domain: '...', Regex: '...' }, Rules: { ... } })
 *   new Rule({ Selector: { Type: '@namespace', Prefix: 'svg|a', Url: 'url(...)' } })
 *   new Rule({ Selector: { Type: '@page', Name: 'myPage', Right: true }, Contents: { color: 'red', TopLeft: { background: 'blue' } } })
 *   new Rule({ Selector: { Type: '@counter-style', Name: 'myStyle' }, Contents: { System: 'cyclic', Symbols: '...' } })
 *   new Rule({ Selector: { Type: '@font-face' }, Contents: { FontFamily: '...', Source: '...' } })
 *   new Rule({ Selector: { Type: '@viewport' }, Contents: { Width: '300px' } })
 *
 * ── NESTED RULES (Rules map) ─────────────────────────────────────────────────
 *   Rules: { RuleName: { Selector, Rule/Contents }, ... }
 *   Rendered as child rules inside the @-rule block.
 *
 * ── STATIC METHODS ───────────────────────────────────────────────────────────
 *   Rule.Parse(cssText)               → Rule[]
 *   Rule.From(cssRule)                → Rule
 *   Rule.GetSelector(def)             → string   (Golem Css.GetSelector)
 *   Rule.GetType(def)                 → string   (Golem Css.GetType)
 *   Rule.GetContents(def)             → object   (Golem Css.GetContents)
 *   Rule.GetText(def)                 → string   (Golem Css.GetText)
 *   Rule.GetObject(cssText)           → object   (Golem Css.GetObject)
 *
 * ── CSS.STATE ────────────────────────────────────────────────────────────────
 *   new CssState(el, 'MouseDown', existingCss, { background: 'yellow' }, action?, '@Keyframes Name', frames?)
 */

import type { AriannAEvent } from './Observable.ts';
import { uuid } from './Observable.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CSSProperties = Record<string, string>;

/**
 * Object-literal rule definition accepted by the constructor.
 * Supports legacy Golem field aliases: Contents / Content / Body / Rule.
 * Property keys may be PascalCase (Width) or camelCase (width).
 */
export interface RuleDefinition
{
    Selector  : string | SelectorObject;
    Contents? : string | CSSProperties | Record<string, unknown>;
    Content?  : string | CSSProperties | Record<string, unknown>;
    Body?     : string | CSSProperties | Record<string, unknown>;
    Rule?     : string | CSSProperties | Record<string, unknown>;
    Rules?    : Record<string, RuleDefinition | CSSProperties>;
}

/**
 * Structured object selector used in Golem Css examples.
 * Type is the @-rule keyword; other keys are rule-specific.
 */
export interface SelectorObject
{
    Type    : string;
    Name?   : string;
    Value?  : string;
    Media?  : string;
    Url?    : string;
    Prefix? : string;
    Domain? : string;
    Regex?  : string;
    Right?  : boolean;
    Left?   : boolean;
    And?    : Record<string, unknown>;
    Or?     : Record<string, unknown>;
    Not?    : Record<string, unknown>;
    [key: string]: unknown;
}

export interface RuleEvent extends AriannAEvent
{
    Rule     : Rule;
    Property : { Name: string; Old: unknown; New: unknown };
}

// ── @page margin-box pseudo-element names ─────────────────────────────────────

const PAGE_MARGIN_BOXES = new Set([
    'TopLeftCorner', 'TopLeft', 'TopCenter', 'TopRight', 'TopRightCorner',
    'BottomLeftCorner', 'BottomLeft', 'BottomCenter', 'BottomRight', 'BottomRightCorner',
    'LeftTop', 'LeftMiddle', 'LeftBottom',
    'RightTop', 'RightMiddle', 'RightBottom',
]);

// ── CSS normalizers ───────────────────────────────────────────────────────────

function toKebab(s: string): string
{
    return s.replace(/([A-Z])/g, c => `-${c.toLowerCase()}`);
}

function toCamel(s: string): string
{
    const lc = s.charAt(0).toLowerCase() + s.slice(1);
    return lc.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function trimVal(v: string): string { return v.trim().replace(/;$/, ''); }

function parseDeclarations(text: string): CSSProperties
{
    const props: CSSProperties = {};
    text.split(';').forEach(decl => {
        const colon = decl.indexOf(':');
        if (colon < 0) return;
        const key = toCamel(decl.slice(0, colon).trim());
        const val = trimVal(decl.slice(colon + 1));
        if (key && val) props[key] = val;
    });
    return props;
}

function serializeDeclarations(props: CSSProperties): string
{
    return Object.entries(props)
        .map(([k, v]) => `${toKebab(k)}: ${v}`)
        .join('; ');
}

function normaliseProps(raw: CSSProperties): CSSProperties
{
    const out: CSSProperties = {};
    for (const [k, v] of Object.entries(raw))
        out[toCamel(k)] = String(v).trim();
    return out;
}

// ── Media / Supports condition builder ───────────────────────────────────────

function buildMediaCondition(obj: Record<string, unknown>): string
{
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj))
    {
        const lk = k.toLowerCase();
        if (lk === 'or')
        {
            parts.push(`, ${buildMediaCondition(v as Record<string, unknown>)}`);
        } else if (lk === 'and')
        {
            parts.push(` and ${buildMediaCondition(v as Record<string, unknown>)}`);
        } else if (lk === 'not')
        {
            parts.push(` not (${buildMediaCondition(v as Record<string, unknown>)})`);
        } else
        {
            // e.g. MinHeight → min-height
            const prop = toKebab(k).toLowerCase();
            parts.push(`(${prop}: ${v})`);
        }
    }
    return parts.join('');
}

// ── Object-selector → CSS selector string ────────────────────────────────────

function buildSelector(sel: SelectorObject): string
{
    const type = sel.Type.toLowerCase().trim();

    if (type === '@charset')
        return `@charset "${(sel.Value ?? 'UTF-8').replace(/["']/g, '')}"`;

    if (type === '@namespace')
    {
        const prefix = sel.Prefix ? `${sel.Prefix} ` : '';
        return `@namespace ${prefix}${sel.Url ?? ''}`;
    }

    if (type === '@import')
    {
        const url = sel.Url ?? '';
        const media = sel.Media ? ` ${sel.Media}` : '';
        const cond  = sel.And ? buildMediaCondition(sel.And as Record<string, unknown>) : '';
        return `@import ${url}${media}${cond}`;
    }

    if (type === '@media')
    {
        const media = sel.Media ? ` ${sel.Media}` : '';
        const cond  = sel.And ? buildMediaCondition(sel.And as Record<string, unknown>) : '';
        return `@media${media}${cond}`;
    }

    if (type === '@supports')
    {
        const parts: string[] = [];
        if (sel.Not)
            parts.push(`not (${buildMediaCondition(sel.Not as Record<string, unknown>)})`);
        for (const [k, v] of Object.entries(sel))
        {
            const lk = k.toLowerCase();
            if (['type', 'not'].includes(lk)) continue;
            if (lk === 'or')
                parts.push(`, ${buildMediaCondition(v as Record<string, unknown>)}`);
            else if (lk === 'and')
                parts.push(` and ${buildMediaCondition(v as Record<string, unknown>)}`);
            else
                parts.push(`(${toKebab(k).toLowerCase()}: ${v})`);
        }
        return `@supports ${parts.join(' ')}`;
    }

    if (type === '@document')
    {
        const conditions: string[] = [];
        if (sel.Url)    conditions.push(`url("${sel.Url}")`);
        if (sel.Prefix) conditions.push(`url-prefix("${sel.Prefix}")`);
        if (sel.Domain) conditions.push(`domain("${sel.Domain}")`);
        if (sel.Regex)  conditions.push(`regexp("${sel.Regex}")`);
        return `@document ${conditions.join(', ')}`;
    }

    if (type === '@page')
    {
        const name  = sel.Name  ? ` ${sel.Name}` : '';
        const right = sel.Right ? ' :right' : '';
        const left  = sel.Left  ? ' :left'  : '';
        return `@page${name}${right}${left}`;
    }

    if (type === '@keyframes')
        return `@keyframes ${sel.Name ?? ''}`;

    if (type === '@counter-style')
        return `@counter-style ${sel.Name ?? ''}`;

    if (type === '@font-face')  return '@font-face';
    if (type === '@viewport')   return '@viewport';

    // fallback — unknown @-rule
    return sel.Type;
}

// ── @keyframes frame builder ─────────────────────────────────────────────────

function buildKeyframesText(name: string, contents: Record<string, unknown>): string
{
    const frames: string[] = [];
    for (const [key, val] of Object.entries(contents))
    {
        const lk = key.toLowerCase();
        let position: string;
        let style: CSSProperties;

        if (lk === 'from') {
            position = 'from';
            style    = normaliseProps(val as CSSProperties);
        } else if (lk === 'to') {
            position = 'to';
            style    = normaliseProps(val as CSSProperties);
        } else {
            // { Position: '33%', Style: { ... } }
            const frame = val as { Position?: string; Style?: CSSProperties; [k: string]: unknown };
            position = frame.Position ?? key;
            style    = frame.Style ? normaliseProps(frame.Style) : {};
        }
        const decls = serializeDeclarations(style);
        frames.push(`  ${position} { ${decls}${decls ? ';' : ''} }`);
    }
    return `@keyframes ${name} {\n${frames.join('\n')}\n}`;
}

// ── @page with margin-boxes builder ──────────────────────────────────────────

function buildPageText(selector: string, contents: Record<string, unknown>): string
{
    const mainDecls: CSSProperties = {};
    const marginBoxes: string[] = [];

    for (const [k, v] of Object.entries(contents))
    {
        if (PAGE_MARGIN_BOXES.has(k))
        {
            // margin-box pseudo-element → @top-left-corner { ... }
            const boxSelector = toKebab(k).toLowerCase(); // TopLeftCorner → top-left-corner
            const props = normaliseProps(v as CSSProperties);
            const decls = serializeDeclarations(props);
            marginBoxes.push(`  @${boxSelector} { ${decls}${decls ? ';' : ''} }`);
        } else
        {
            mainDecls[toCamel(k)] = String(v).trim();
        }
    }

    const main = serializeDeclarations(mainDecls);
    const inner = [
        main ? `  ${main};` : '',
        ...marginBoxes,
    ].filter(Boolean).join('\n');

    return `${selector} {\n${inner}\n}`;
}

// ── Nested Rules builder ──────────────────────────────────────────────────────

function buildNestedRules(rulesMap: Record<string, RuleDefinition | CSSProperties>): string
{
    return Object.values(rulesMap).map(def =>
    {
        const r = new Rule(def as RuleDefinition);
        return '  ' + r.Text.replace(/\n/g, '\n  ');
    }).join('\n');
}

// ── Rule ──────────────────────────────────────────────────────────────────────

export class Rule
{

    readonly #id       : string;
    #selector          : string;
    #properties        : CSSProperties;
    #children          : Rule[]         = [];
    #rawContents       : Record<string, unknown> | null = null;
    #selectorObj       : SelectorObject | null = null;
    readonly #events   = new Map<string, Set<(e: RuleEvent) => void>>();

    // ── Constructor overloads ─────────────────────────────────────────────────

    constructor(selector: string, contents?: string | CSSProperties);
    constructor(definition: RuleDefinition);
    constructor(cssRule: CSSRule);
    constructor(
        arg0: string | RuleDefinition | CSSRule,
        arg1?: string | CSSProperties,
    )
    {
        this.#id = uuid();

        if (arg0 instanceof CSSRule)
        {
            const text = arg0.cssText;
            const m    = /^([^{]+)\{([\s\S]*)\}/.exec(text);
            this.#selector   = m?.[1]?.trim() ?? '';
            this.#properties = parseDeclarations(m?.[2] ?? '');

        } else if (typeof arg0 === 'string') {
            this.#selector = arg0;
            if (!arg1)                         this.#properties = {};
            else if (typeof arg1 === 'string') this.#properties = parseDeclarations(arg1);
            else                               this.#properties = normaliseProps(arg1);

        } else
        {
            // Object literal form
            const def  = arg0 as RuleDefinition;
            const rawSel = def.Selector;

            if (rawSel && typeof rawSel === 'object')
            {
                // Structured object selector
                this.#selectorObj = rawSel as SelectorObject;
                this.#selector    = buildSelector(this.#selectorObj);
            } else {
                this.#selector = (rawSel as string) ?? '';
            }

            const body = def.Contents ?? def.Content ?? def.Body ?? def.Rule ?? {};
            if (typeof body === 'string')
            {
                this.#properties = parseDeclarations(body);
            } else
            {
                const bodyObj = body as Record<string, unknown>;
                const type = this.#selectorObj?.Type?.toLowerCase() ?? '';

                if (type === '@keyframes')
                {
                    // Contents holds frames, not CSS properties
                    this.#rawContents = bodyObj;
                    this.#properties  = {};
                } else if (type === '@page')
                {
                    this.#rawContents = bodyObj;
                    this.#properties  = {};
                } else
                {
                    this.#properties = normaliseProps(bodyObj as CSSProperties);
                }
            }

            // Build child rules from Rules map
            if (def.Rules)
                this.#children = Object.values(def.Rules)
                    .map(d => new Rule(d as RuleDefinition));
        }

        // Default
        this.#properties ??= {};
    }

    // ── Identity ──────────────────────────────────────────────────────────────

    get Id(): string { return this.#id; }

    // ── Selector ──────────────────────────────────────────────────────────────

    get Selector(): string { return this.#selector; }
    set Selector(v: string)
    {
        const old = this.#selector; this.#selector = v;
        this.#emit('Selector', old, v);
    }

    // ── Type (convenience getter) ─────────────────────────────────────────────

    /** The @-rule keyword, e.g. '@media', '@keyframes', or '' for style rules. */
    get Type(): string
    {
        const m = /^(@[\w-]+)/.exec(this.#selector.trim());
        return m?.[1] ?? '';
    }

    // ── Children ──────────────────────────────────────────────────────────────

    /** Nested child Rules (for @media, @supports, @document, @import). */
    get Children(): Rule[]         { return [...this.#children]; }
    set Children(v: Rule[])        { this.#children = v; }

    // ── Properties ───────────────────────────────────────────────────────────

    get Properties(): Readonly<CSSProperties> { return { ...this.#properties }; }

    get(name: string): string | undefined
    {
        return this.#properties[toCamel(name)];
    }

    set(name: string, value: string): this
    {
        const key = toCamel(name);
        const old = this.#properties[key];
        if (old === value) return this;
        this.#properties[key] = trimVal(value);
        this.#emit(key, old, value);
        return this;
    }

    remove(name: string): this
    {
        const key = toCamel(name);
        const old = this.#properties[key];
        if (old === undefined) return this;
        delete this.#properties[key];
        this.#emit(key, old, undefined);
        return this;
    }

    merge(props: CSSProperties): this
    {
        for (const [k, v] of Object.entries(props)) this.set(k, v);
        return this;
    }

    replace(props: CSSProperties | string): this
    {
        const old = { ...this.#properties };
        this.#properties = typeof props === 'string'
            ? parseDeclarations(props)
            : normaliseProps(props);
        this.#emit('*', old, this.#properties);
        return this;
    }

    has(name: string): boolean { return toCamel(name) in this.#properties; }

    // ── Serialization ─────────────────────────────────────────────────────────

    /**
     * Full CSS rule text ready to insert into a stylesheet.
     * Handles: standard rules, @keyframes with frames, @page with margin-boxes,
     * nested rules (@media/@supports/@document/@import with child rules).
     */
    get Text(): string
    {
        const type = this.Type.toLowerCase();

        // @charset, @namespace, @import (without nested rules)
        if (type === '@charset' || type === '@namespace')
            return `${this.#selector};`;

        // @keyframes — render frames from rawContents
        if (type === '@keyframes' && this.#rawContents)
        {
            const name = this.#selectorObj?.Name ?? this.#selector.replace('@keyframes', '').trim();
            return buildKeyframesText(name, this.#rawContents);
        }

        // @page — render margin-boxes from rawContents
        if (type === '@page' && this.#rawContents)
            return buildPageText(this.#selector, this.#rawContents);

        // Rules with nested children
        if (this.#children.length > 0)
        {
            const inner = this.#children.map(c => '  ' + c.Text.replace(/\n/g, '\n  ')).join('\n');
            return `${this.#selector} {\n${inner}\n}`;
        }

        // Standard rule
        const decls = serializeDeclarations(this.#properties);
        return `${this.#selector} { ${decls}${decls ? ';' : ''} }`;
    }

    get cssText(): string { return this.Text; }
    toString(): string    { return this.Text; }

    // ── Pub/sub ───────────────────────────────────────────────────────────────

    on(types: string, cb: (e: RuleEvent) => void): this
    {
        types.split(/\s+|,|\|/g).filter(Boolean).forEach(t => {
            const b = this.#events.get(t) ?? new Set();
            b.add(cb); this.#events.set(t, b);
        });
        return this;
    }

    off(type: string, cb: (e: RuleEvent) => void): this
    {
        this.#events.get(type)?.forEach(l => l === cb && this.#events.get(type)!.delete(l));
        return this;
    }

    fire(event: RuleEvent): this
    {
        if (!event?.Type) return this;
        this.#events.get(event.Type)?.forEach(l => l(event));
        return this;
    }

    #emit(name: string, old: unknown, nv: unknown): void
    {
        const ev: RuleEvent = {
            Type: `Rule-${name}-Changed`, Rule: this, Property: { Name: name, Old: old, New: nv },
        };
        this.fire(ev);
        ev.Type = 'Rule-Changed';
        this.fire(ev);
    }

    // ── Comparison ────────────────────────────────────────────────────────────

    matches(other: Rule | string | CSSRule): boolean
    {
        if (typeof other === 'string')  return this.#selector.trim() === other.trim();
        if (other instanceof CSSRule)   return this.#selector.trim() === (other as CSSStyleRule).selectorText?.trim();
        return this.#selector.trim() === other.Selector.trim();
    }

    clone(): Rule
    {
        const r = new Rule(this.#selector, { ...this.#properties });
        r.#children    = this.#children.map(c => c.clone());
        r.#rawContents = this.#rawContents ? { ...this.#rawContents } : null;
        r.#selectorObj = this.#selectorObj ? { ...this.#selectorObj } : null;
        return r;
    }

    // ── Static helpers ────────────────────────────────────────────────────────

    /**
     * Parse a CSS text string into Rule instances via browser parser.
     */
    static Parse(text: string): Rule[]
    {
        const style = document.createElement('style');
        style.textContent = text;
        document.head.appendChild(style);
        const rules = Array.from(style.sheet?.cssRules ?? []).map(r => new Rule(r));
        document.head.removeChild(style);
        return rules;
    }

    static From(cssRule: CSSRule): Rule { return new Rule(cssRule); }

    // ── Golem static API ──────────────────────────────────────────────────────

    /**
     * Return the selector string from a RuleDefinition.
     * Mirrors Golem's Css.GetSelector().
     *
     * @example
     *   Rule.GetSelector({ Selector: { Type: '@media', Media: 'screen' } })
     *   // '@media screen'
     */
    static GetSelector(def: RuleDefinition): string
    {
        const sel = def.Selector;
        if (!sel) return '';
        if (typeof sel === 'string') return sel;
        return buildSelector(sel as SelectorObject);
    }

    /**
     * Return the @-rule type keyword from a RuleDefinition.
     * Mirrors Golem's Css.GetType().
     *
     * @example
     *   Rule.GetType({ Selector: { Type: '@keyframes', Name: 'spin' } })
     *   // '@keyframes'
     */
    static GetType(def: RuleDefinition): string
    {
        const sel = def.Selector;
        if (!sel) return '';
        if (typeof sel === 'string')
        {
            const m = /^(@[\w-]+)/.exec(sel.trim());
            return m?.[1] ?? '';
        }
        return (sel as SelectorObject).Type ?? '';
    }

    /**
     * Return the contents/properties object from a RuleDefinition.
     * Mirrors Golem's Css.GetContents().
     */
    static GetContents(def: RuleDefinition): Record<string, unknown>
    {
        const body = def.Contents ?? def.Content ?? def.Body ?? def.Rule ?? {};
        if (typeof body === 'string') return parseDeclarations(body) as Record<string, unknown>;
        return body as Record<string, unknown>;
    }

    /**
     * Serialize a RuleDefinition to its CSS text string.
     * Mirrors Golem's Css.GetText().
     */
    static GetText(def: RuleDefinition): string
    {
        return new Rule(def).Text;
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
    static GetObject(cssText: string): Record<string, unknown>
    {
        if (!cssText?.trim()) return {};

        const result: Record<string, unknown> = {};
        const style = document.createElement('style');
        style.textContent = cssText;
        document.head.appendChild(style);

        try
        {
            const rules = Array.from(style.sheet?.cssRules ?? []);
            for (const rule of rules)
            {
                if (rule instanceof CSSStyleRule)
                {
                    const decls: Record<string, string> = {};
                    for (let i = 0; i < rule.style.length; i++)
                    {
                        const p = rule.style[i] ?? '';
                        if (p) decls[toCamel(p)] = rule.style.getPropertyValue(p).trim();
                    }
                    result[rule.selectorText] = decls;
                } else if (rule instanceof CSSKeyframesRule)
                {
                    const frames: Record<string, unknown> = {};
                    Array.from(rule.cssRules).forEach((fr) => {
                        const kf = fr as CSSKeyframeRule;
                        const decls: Record<string, string> = {};
                        for (let i = 0; i < kf.style.length; i++)
                        {
                            const p = kf.style[i] ?? '';
                            if (p) decls[toCamel(p)] = kf.style.getPropertyValue(p).trim();
                        }
                        frames[kf.keyText] = decls;
                    });
                    result[`@keyframes ${rule.name}`] = frames;
                } else if (rule instanceof CSSMediaRule)
                {
                    const inner: Record<string, unknown> = {};
                    Array.from(rule.cssRules).forEach(r => {
                        if (r instanceof CSSStyleRule)
                        {
                            const d: Record<string, string> = {};
                            for (let i = 0; i < (r as CSSStyleRule).style.length; i++)
                            {
                                const p = (r as CSSStyleRule).style[i] ?? '';
                                if (p) d[toCamel(p)] = (r as CSSStyleRule).style.getPropertyValue(p).trim();
                            }
                            inner[(r as CSSStyleRule).selectorText] = d;
                        }
                    });
                    const mediaKey = rule.conditionText
                        ? `@media ${rule.conditionText}`
                        : (rule.cssText.split('{')[0] ?? '').trim();
                    result[mediaKey] = inner;
                } else if (rule instanceof CSSSupportsRule)
                {
                    const inner: Record<string, unknown> = {};
                    Array.from(rule.cssRules).forEach(r => {
                        const obj = Rule.GetObject(r.cssText);
                        Object.assign(inner, obj);
                    });
                    result[`@supports ${rule.conditionText}`] = inner;
                } else if (rule instanceof CSSFontFaceRule)
                {
                    const d: Record<string, string> = {};
                    for (let i = 0; i < rule.style.length; i++)
                    {
                        const p = rule.style[i] ?? '';
                        if (p) d[toCamel(p)] = rule.style.getPropertyValue(p).trim();
                    }
                    result['@font-face'] = d;
                } else if (rule instanceof CSSImportRule)
                {
                    result[`@import ${rule.href}`] = { href: rule.href, media: rule.media?.mediaText ?? '' };
                } else if (rule instanceof CSSNamespaceRule)
                {
                    result['@namespace'] = { prefix: rule.prefix, namespaceURI: rule.namespaceURI };
                } else if (rule instanceof CSSPageRule)
                {
                    const d: Record<string, string> = {};
                    for (let i = 0; i < rule.style.length; i++)
                    {
                        const p = rule.style[i] ?? '';
                        if (p) d[toCamel(p)] = rule.style.getPropertyValue(p).trim();
                    }
                    result[`@page ${rule.selectorText}`.trim()] = d;
                } else
                {
                    const m = /^([^{]+)\{([\s\S]*)\}/.exec(rule.cssText);
                    if (m)
                    {
                        const key = m[1]?.trim();
                        const val = m[2];
                        if (key && val !== undefined) result[key] = parseDeclarations(val);
                    }
                }
            }
        } finally
        {
            document.head.removeChild(style);
        }

        return result;
    }
}

// ── CssState ──────────────────────────────────────────────────────────────────

/**
 * Binds a DOM element to a CSS state triggered by a DOM event.
 * Mirrors Golem's Css.State constructor.
 *
 * @example
 *   const state = new CssState(
 *     buttonEl,
 *     'MouseDown',
 *     existingCssRule,
 *     { background: 'yellow', animation: 'Boh 2s' },
 *     (event) => console.log('clicked'),
 *     '@Keyframes Boh',
 *     { From: { background: 'yellow' }, To: { background: 'red' } }
 *   );
 */
export class CssState
{
    #element     : Element;
    #eventName   : string;
    #baseRule    : Rule;
    #stateProps  : CSSProperties;
    #keyframes   : Rule | null = null;
    action       : ((e: Event) => void) | null;

    constructor(
        element    : Element,
        eventName  : string,
        baseRule   : Rule,
        stateProps : CSSProperties,
        action?    : ((e: Event) => void) | null,
        keyframeSelector?: string,
        keyframeContents?: Record<string, unknown>,
    )
    {
        this.#element    = element;
        this.#eventName  = eventName.toLowerCase().replace(/^mouse/, 'mouse');
        this.#baseRule   = baseRule;
        this.#stateProps = normaliseProps(stateProps);
        this.action      = action ?? null;

        if (keyframeSelector && keyframeContents)
        {
            const name = keyframeSelector.replace(/@[Kk]eyframes\s+/, '').trim();
            this.#keyframes = new Rule({
                Selector : { Type: '@keyframes', Name: name },
                Contents : keyframeContents as Record<string, unknown>,
            });
            // Inject keyframes into document
            const style = document.createElement('style');
            style.textContent = this.#keyframes.Text;
            document.head.appendChild(style);
        }

        // Map Golem-style event names to DOM event names
        const domEvent = this.#mapEvent(eventName);
        element.addEventListener(domEvent, (e) =>
        {
            this.#baseRule.merge(this.#stateProps);
            this.action?.(e);
        });
    }

    #mapEvent(name: string): string
    {
        const map: Record<string, string> = {
            'mousedown'  : 'mousedown',
            'mouseup'    : 'mouseup',
            'mouseout'   : 'mouseout',
            'mouseover'  : 'mouseover',
            'mousemove'  : 'mousemove',
            'mouseenter' : 'mouseenter',
            'mouseleave' : 'mouseleave',
            'click'      : 'click',
            'focus'      : 'focus',
            'blur'       : 'blur',
        };
        return map[name.toLowerCase()] ?? name.toLowerCase();
    }

    get Keyframes(): Rule | null { return this.#keyframes; }
}

// ── Window registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
{
    Object.defineProperty(window, 'Rule', {
        enumerable: true, configurable: false, writable: false, value: Rule,
    });

    // Css namespace — mirrors Golem's static Css.GetSelector / GetType / etc.
    const CssNamespace = {
        GetSelector : (def: RuleDefinition) => Rule.GetSelector(def),
        GetType     : (def: RuleDefinition) => Rule.GetType(def),
        GetContents : (def: RuleDefinition) => Rule.GetContents(def),
        GetText     : (def: RuleDefinition) => Rule.GetText(def),
        GetObject   : (cssText: string)     => Rule.GetObject(cssText),
        State       : CssState,
    };

    // Register as window.Css if not already defined
    if (!('Css' in window))
        Object.defineProperty(window, 'Css', {
            enumerable: true, configurable: true, writable: true, value: CssNamespace,
        });
}

export { CssState as State };
export default Rule;
