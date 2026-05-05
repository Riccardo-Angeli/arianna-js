/**
 * @module    Stylesheet
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 *
 * Sheet — manages a CSSStyleSheet with a clean, observable API.
 *
 * Constructor overloads:
 *   new Sheet()                  — empty sheet, auto-creates <style>
 *   new Sheet(sheetInstance)     — clone from another Sheet
 *   new Sheet(cssStyleSheet)     — wrap existing CSSStyleSheet
 *   new Sheet(cssRuleList)       — from CSSRuleList
 *   new Sheet(htmlLinkElement)   — link to external stylesheet
 *   new Sheet(rulesArray)        — from Array<CSSRule | Rule>
 *   new Sheet(cssString)         — parse CSS text
 *   new Sheet(objectSyntax)      — object literal rule definitions
 *   new Sheet(url: string)       — fetch + parse an existing stylesheet URL
 *                                  (mirrors the legacy library: SheetES5("http://..."))
 *
 * Static API:
 *   Sheet.Sheets      → all Sheet instances
 *   Sheet.Links       → all <link> elements
 *   Sheet.Paths       → all href strings
 *   Sheet.ToString(s) → serialize source to CSS string
 *   Sheet.Parse(text) → CSSStyleSheet from text
 *   Sheet.ToArray(t)  → CSSRule[] from text
 *   Sheet.Less(text)  → parse Less/Stylus-style text to CSS string
 *                        (mirrors the legacy library: SheetES5.Less(text))
 *
 * Instance API:
 *   // Getters / Setters
 *   .Index    .Length    .Loading   .Loaded    .State
 *   .Name     .Text      .Link      .Sheet     .Rules
 *   .Object   .Observable
 *
 *   // CRUD methods (all return `this` — chainable)
 *   .parse(text | object | CSSStyleSheet | Rule[])
 *   .getIndex(rule | selector)
 *   .contains(rules)
 *   .get(rules)            — also accepts '@keyframes Name' selector
 *   .Get(rules)            — the legacy library alias for .get()
 *   .set(rule, value)
 *   .insert(rules, index)  — the legacy library: sheet.Insert(rule, idx)
 *   .add(rules)            — the legacy library: sheet.Add(rule1, rule2)
 *   .unshift(rules)
 *   .remove(rules)
 *   .shift(n)
 *   .pop(n)
 *   .clear()
 *
 * @example
 *   const sheet = new Sheet('.my-btn { background: dodgerblue; color: white }');
 *   sheet.add('.my-btn:hover { background: crimson }');
 *   sheet.set('.my-btn', { color: 'yellow' });
 *   sheet.on('Sheet-Changed', e => console.log(e));
 *
 * @example
 *   // the legacy library SheetES5 pattern — fetch existing stylesheet
 *   const sheet2 = new Sheet('http://localhost:8080/styles/legacy');
 *   sheet2.on('Sheet-Loaded', () => {
 *     console.log(sheet2.Get('@keyframes spin').Selector);
 *   });
 *
 * @example
 *   // Less/Stylus parser
 *   const css = Sheet.Less(`
 *     .box
 *       background: red
 *       .inner
 *         color: white
 *   `);
 */

import Observable from '../additionals/Observable.ts';
import { Rule } from './Rule.ts';
import type { RuleDefinition, CSSProperties } from './Rule.ts';
import { parseLess } from '../additionals/Less.ts';
import { parseSass } from '../additionals/Sass.ts';
import { parseScss } from '../additionals/Scss.ts';
import { parseStylus } from '../additionals/Stylus.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SheetInput =
    | Sheet
    | CSSStyleSheet
    | CSSRuleList
    | HTMLLinkElement
    | CSSRule[]
    | Rule[]
    | Rule
    | RuleDefinition
    | string
    | SheetObjectDef;

export interface SheetObjectDef
{
    [name: string]: RuleDefinition | CSSProperties;
}

export type SheetRule = Rule | CSSRule | string;

// ── Normalizers ───────────────────────────────────────────────────────────────

function toKebab(s: string): string
{
    return s.replace(/([A-Z])/g, c => `-${c.toLowerCase()}`);
}

function toCamel(s: string): string
{
    return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}


/**
 * Coerce any supported input (Rule | RuleDefinition | string CSS | CSSRule
 * | Sheet | array of any of the above) into a flat array of Rule instances.
 *
 * This is the workhorse used by `Sheet.add`, `Sheet.insert`, `Sheet.unshift`
 * — all of which now accept a fully variadic, mixed-type argument list.
 */
function _toRules(inputs: unknown[]): Rule[]
{
    const out: Rule[] = [];
    for (const item of inputs.flat(2 as 1))
    {
        if (item === null || item === undefined) continue;
        if (item instanceof Rule)               { out.push(item); continue; }
        if (item instanceof Sheet)              { out.push(...item.Rules); continue; }
        if (typeof item === 'string')           { out.push(...Rule.Parse(item)); continue; }
        if (typeof item === 'object')
        {
            // CSSRule (browser native) — has cssText
            if (typeof CSSRule !== 'undefined' && item instanceof CSSRule)
            { out.push(new Rule(item)); continue; }
            // RuleDefinition object literal
            if ('Selector' in (item as Record<string, unknown>)
                || 'Contents' in (item as Record<string, unknown>)
                || 'Content'  in (item as Record<string, unknown>)
                || 'Body'     in (item as Record<string, unknown>)
                || 'Rule'     in (item as Record<string, unknown>))
            {
                out.push(new Rule(item as RuleDefinition));
                continue;
            }
        }
        // Otherwise — silently skip (unknown shape)
    }
    return out;
}

// ── Sheet.Events — the legacy library-style named event slots ──────────────────────────────

/**
 * Detail payload shared by all Sheet.Events.* listeners.
 *
 * Mirrors the rich payload from the legacy library's event system, ensuring the legacy
 * 22-example corpus (and especially the legacy library-Navigation-Css-Sheet.html) sees
 * exactly the field names it expects.
 */
export interface SheetEventDetail
{
    /** All Sheet instances tracked by Sheet.Sheets at this moment. */
    Sheets       : Sheet[];
    /** The Sheet emitting the event. */
    Sheet        : Sheet;
    /** The owning <link> element (or null). */
    Link         : HTMLLinkElement | null;
    /** href of Link, when present. */
    Path         : string;
    /** The Events object on the Sheet. */
    Events       : SheetEventsBag;
    /** Method that triggered the event ('add', 'insert', 'remove', 'parse', ...). */
    Name         : string;
    /** Original arguments passed to that method. */
    Arguments    : unknown[];
    /** Reason hint for Changing/Changed. */
    Reason?      : string;
    /** Diff map: keys → new values. Populated for Changing/Changed. */
    Changing?    : Record<string, unknown>;
    Changed?     : Record<string, unknown>;
    /** Rules being added (Adding/BeforeRulesAdd/AfterRulesAdd). */
    AddingRules? : Rule[];
    /** Rules already added so far in the current batch. */
    AddedRules?  : Rule[];
    /** Single rule being processed in Adding/Added. */
    AddingRule?  : Rule;
    AddedRule?   : Rule;
}

/**
 * Type of every listener slot exposed via `sheet.Events.OnX`.
 * Listeners receive the rich {@link SheetEventDetail} object directly.
 */
export type SheetEventListener = (e: SheetEventDetail) => void;

/**
 * The 6 the legacy library-style named event slots, all initially null.
 * Assigning a function to any slot subscribes that listener via Observable.
 *
 * Mapping to the underlying Observable event names:
 *   OnSheetChanging       → 'change-before'
 *   OnSheetChanged        → 'change-after'
 *   OnBeforeSheetRulesAdd → 'rules-add-before'
 *   OnSheetRuleAdding     → 'rule-adding'
 *   OnSheetRuleAdded      → 'rule-added'
 *   OnAfterSheetRulesAdd  → 'rules-add-after'
 */
export interface SheetEventsBag
{
    OnSheetChanging       : SheetEventListener | null;
    OnSheetChanged        : SheetEventListener | null;
    OnBeforeSheetRulesAdd : SheetEventListener | null;
    OnSheetRuleAdding     : SheetEventListener | null;
    OnSheetRuleAdded      : SheetEventListener | null;
    OnAfterSheetRulesAdd  : SheetEventListener | null;
}

const SHEET_EVENT_SLOTS: ReadonlyArray<keyof SheetEventsBag> = [
    'OnSheetChanging',
    'OnSheetChanged',
    'OnBeforeSheetRulesAdd',
    'OnSheetRuleAdding',
    'OnSheetRuleAdded',
    'OnAfterSheetRulesAdd',
];

const SHEET_EVENT_NAME_MAP: Readonly<Record<keyof SheetEventsBag, string>> = {
    OnSheetChanging       : 'change-before',
    OnSheetChanged        : 'change-after',
    OnBeforeSheetRulesAdd : 'rules-add-before',
    OnSheetRuleAdding     : 'rule-adding',
    OnSheetRuleAdded      : 'rule-added',
    OnAfterSheetRulesAdd  : 'rules-add-after',
};

/**
 * Build the Events bag for a Sheet instance. Each slot is a getter/setter
 * that stores an internal Observable subscription. Assigning `null` removes
 * the previous listener; assigning a function replaces it.
 */
function _makeSheetEvents(host: Sheet, ensureObs: () => Observable): SheetEventsBag
{
    const stored: Record<string, SheetEventListener | null> = {};
    const cleanups: Record<string, (() => void) | null> = {};

    const bag = {} as SheetEventsBag;

    for (const slot of SHEET_EVENT_SLOTS)
    {
        Object.defineProperty(bag, slot, {
            enumerable  : true,
            configurable: false,
            get(): SheetEventListener | null { return stored[slot] ?? null; },
            set(v: SheetEventListener | null)
            {
                // Remove previous subscription
                cleanups[slot]?.();
                cleanups[slot] = null;
                stored[slot]   = v;

                if (typeof v !== 'function') return;

                const eventName = SHEET_EVENT_NAME_MAP[slot];
                const obs = ensureObs();
                const wrapper = (e: { Type: string; Detail?: SheetEventDetail; [k: string]: unknown }) =>
                {
                    // The detail may live on .Detail (legacy emit) or on the event itself
                    const detail = (e.Detail ?? e) as SheetEventDetail;
                    // Ensure full Sheet/Sheets/Link/Path/Events fields are populated even
                    // if the emitter forgot to set them.
                    detail.Sheet  ??= host;
                    detail.Sheets ??= Sheet.Sheets;
                    detail.Link   ??= host.Link;
                    detail.Path   ??= host.Link?.href ?? '';
                    detail.Events ??= host.Events;
                    v(detail);
                };
                obs.on(eventName, wrapper);
                cleanups[slot] = () => obs.off(eventName, wrapper);
            },
        });
    }

    return bag;
}

// ── Sheet class ───────────────────────────────────────────────────────────────

export class Sheet
{

    // ── Private fields ─────────────────────────────────────────────────────────
    #head    : HTMLHeadElement | HTMLElement;
    #link    : HTMLLinkElement | null = null;
    #sheet   : CSSStyleSheet  | null = null;
    #rules   : Rule[]                = [];
    #loaded  : boolean               = false;
    #loading : boolean               = true;
    #state   : string                = 'Loading';
    #index   : number                = -1;
    #name    : string                = '';
    #obs     : Observable | null     = null;
    #events  : SheetEventsBag;

    // ── Constructor ─────────────────────────────────────────────────────────────

    constructor(...args: SheetInput[])
    {
        this.#head = document.head ?? document.documentElement;
        this.#events = _makeSheetEvents(this, () =>
        {
            if (!this.#obs) this.#obs = new Observable(this);
            return this.#obs;
        });

        // Multi-arg variadic constructor: convert all to Rule[]
        let input: SheetInput | undefined;
        if (args.length === 0) input = undefined;
        else if (args.length === 1) input = args[0];
        else
        {
            // Multiple arguments → coerce all into Rule[]
            input = _toRules(args as unknown[]);
        }

        if (input !== undefined)
        {
            if (typeof input === 'string')
            {
                // Detect URL (starts with http/https//) vs CSS text
                if (/^https?:\/\/|^\/\//.test(input.trim()))
                {
                    this.#loadUrl(input.trim());
                } else {
                    this.#parseText(input);
                }
            } else if (typeof input === 'object') {
                if (input instanceof Sheet)
                {
                    this.#sheet = input.Sheet;
                    this.#rules = input.#rules.map(r => r.clone());
                } else if (input instanceof CSSStyleSheet)
                {
                    this.#sheet = input;
                } else if (input instanceof CSSRuleList)
                {
                    this.#rules = Array.from(input).map(r => new Rule(r));
                } else if (input instanceof HTMLLinkElement)
                {
                    this.#link = input;
                } else if (input instanceof Rule)
                {
                    this.#rules = [input];
                } else if (Array.isArray(input))
                {
                    this.#rules = _toRules(input);
                } else
                {
                    // Distinguish RuleDefinition vs SheetObjectDef:
                    //   RuleDef has Selector/Contents/Content/Body/Rule top-level
                    const obj = input as Record<string, unknown>;
                    if ('Selector' in obj || 'Contents' in obj
                        || 'Content' in obj || 'Body' in obj || 'Rule' in obj)
                    {
                        this.#rules = [new Rule(obj as unknown as RuleDefinition)];
                    } else {
                        this.#parseObject(input as SheetObjectDef);
                    }
                }
            }
        }

        if (!this.#link)
        {
            this.#link      = document.createElement('link') as HTMLLinkElement;
            this.#link.type = 'text/css';
            this.#link.rel  = 'stylesheet';
        }

        if (!this.#link.href)
        {
            const blob      = new Blob([''], { type: 'text/css' });
            this.#link.href = URL.createObjectURL(blob);
            this.#head.appendChild(this.#link);
        }

        if (!this.#sheet)
        {
            const style = document.createElement('style');
            this.#head.appendChild(style);
            this.#sheet = style.sheet!;
        }

        if (this.#rules.length) this.#flushRules();

        this.#loaded  = true;
        this.#loading = false;
        this.#state   = 'Loaded';
        this.#index   = Array.from(document.styleSheets).indexOf(this.#sheet!);
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    #parseText(text: string): void
    {
        const style = document.createElement('style');
        style.textContent = text;
        this.#head.appendChild(style);
        if (style.sheet)
            this.#rules = Array.from(style.sheet.cssRules).map(r => new Rule(r));
        this.#head.removeChild(style);
    }

    #parseObject(obj: SheetObjectDef): void
    {
        for (const [, def] of Object.entries(obj))
        {
            const d = def as RuleDefinition;
            if (d.Selector || d.Contents || d.Content || d.Rule || d.Body)
            {
                this.#rules.push(new Rule(d));
            } else
            {
                for (const [sel, props] of Object.entries(obj))
                {
                    if (typeof props === 'object' && !('Selector' in props))
                        this.#rules.push(new Rule(sel, props as CSSProperties));
                }
                break;
            }
        }
    }

    /**
     * Fetch an external stylesheet URL and parse its rules.
     * Fires 'Sheet-Loaded' on completion, 'Sheet-Error' on failure.
     */
    #loadUrl(url: string): void
    {
        this.#loading = true;
        this.#loaded  = false;
        this.#state   = 'Loading';

        fetch(url)
            .then(r => r.text())
            .then(text => {
                this.#parseText(text);
                this.#loaded  = true;
                this.#loading = false;
                this.#state   = 'Loaded';
                this.#flushRules();
                this.#emit('change-after', { Name: 'load', Reason: 'load', Changed: { url } });
            })
            .catch(err => {
                this.#state   = 'Error';
                this.#loading = false;
                this.#emit('change-after', { Name: 'error', Reason: 'error', Changed: { url, error: String(err) } });
            });
    }

    #flushRules(): void
    {
        if (!this.#sheet) return;
        while (this.#sheet.cssRules.length)
            this.#sheet.deleteRule(0);
        this.#rules.forEach((r, i) => {
            try { this.#sheet!.insertRule(r.Text, i); }
            catch (e) { console.warn(`Sheet: could not insert rule "${r.Selector}":`, e); }
        });
    }

    /**
     * Internal: fire a Sheet-level event through the underlying Observable.
     * Preserves the legacy the legacy library payload fields (Sheets, Sheet, Link, Path,
     * Events, Name, Arguments, Reason, Changing/Changed, AddingRules, ...).
     * Unused fields are still set to sensible defaults so listeners can rely
     * on their presence.
     */
    #emit(type: string, partial: Partial<SheetEventDetail> & { Name?: string; Arguments?: unknown[] }): void
    {
        if (!this.#obs) return;
        const detail: SheetEventDetail = {
            Sheets    : Sheet.Sheets,
            Sheet     : this,
            Link      : this.#link,
            Path      : this.#link?.href ?? '',
            Events    : this.#events,
            Name      : partial.Name ?? type,
            Arguments : partial.Arguments ?? [],
            ...partial,
        };
        this.#obs.fire({ Type: type, ...detail } as unknown as { Type: string; [k: string]: unknown });
    }

    // ── Static API ───────────────────────────────────────────────────────────────

    static get Sheets(): Sheet[]
    {
        return Array.from(document.styleSheets).map(s => new Sheet(s));
    }

    static get Links(): HTMLLinkElement[]
    {
        return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    }

    static get Paths(): string[]
    {
        return Sheet.Links.map(l => l.href).filter(Boolean);
    }

    static ToString(source: SheetInput | Rule[]): string
    {
        if (typeof source === 'string') return source;
        if (Array.isArray(source))
            return source.map(r => r instanceof Rule ? r.Text : (r as CSSRule).cssText).join('\n');
        if (source instanceof Sheet)
            return source.#rules.map(r => r.Text).join('\n');
        if (source instanceof CSSStyleSheet)
            return Array.from(source.cssRules).map(r => r.cssText).join('\n');
        return '';
    }

    static Parse(text: string): CSSStyleSheet | null
    {
        const style = document.createElement('style');
        style.textContent = text;
        document.head.appendChild(style);
        const sheet = style.sheet;
        document.head.removeChild(style);
        return sheet;
    }

    static ToArray(text: string): CSSRule[]
    {
        const s = Sheet.Parse(text);
        return s ? Array.from(s.cssRules) : [];
    }

    /**
     * Parse Less/Stylus-style indented CSS to a standard CSS string.
     * Mirrors the legacy library's SheetES5.Less(text).
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
    static Less(text: string): string   { return parseLess(text); }
    static Sass(text: string): string   { return parseSass(text); }
    static Scss(text: string): string   { return parseScss(text); }
    static Stylus(text: string): string { return parseStylus(text); }

    // ── Getters ────────────────────────────────────────────────────────────────

    get Index(): number   { return this.#index; }
    get Length(): number  { return this.#rules.length; }
    get Loading(): boolean { return this.#loading; }
    get Loaded(): boolean  { return this.#loaded; }
    get State(): string    { return this.#state; }

    get Object(): Record<string, string>
    {
        const out: Record<string, string> = {};
        if (!this.#sheet) return out;
        try
        {
            for (const rule of Array.from(this.#sheet.cssRules))
            {
                if (rule instanceof CSSStyleRule)
                {
                    const decl = rule.style;
                    for (let i = 0; i < decl.length; i++)
                    {
                        const prop = decl[i] ?? '';
                        if (prop) out[toCamel(prop)] = decl.getPropertyValue(prop).trim();
                    }
                }
            }
        } catch { /* cross-origin — skip */ }
        return out;
    }

    get Name(): string { return this.#name; }
    set Name(v: string) { this.#name = v; }

    /** Full serialized CSS text of all rules. */
    get Text(): string { return this.#rules.map(r => r.Text).join('\n'); }
    set Text(v: string) { this.parse(v); }

    get Link(): HTMLLinkElement | null { return this.#link; }
    set Link(v: HTMLLinkElement | string | null)
    {
        if (typeof v === 'string') {
            this.#link      = document.createElement('link') as HTMLLinkElement;
            this.#link.rel  = 'stylesheet';
            this.#link.href = v;
            this.#head.appendChild(this.#link);
        } else
        {
            this.#link = v;
        }
    }

    get Sheet(): CSSStyleSheet | null { return this.#sheet; }
    set Sheet(v: CSSStyleSheet | null)
    {
        if (v instanceof CSSStyleSheet)
        {
            this.#sheet = v;
            this.#rules = Array.from(v.cssRules).map(r => new Rule(r));
        }
    }

    get Rules(): Rule[] { return [...this.#rules]; }
    set Rules(v: Rule[] | CSSRuleList | string)
    {
        if (typeof v === 'string') { this.add(v); return; }
        if (v instanceof CSSRuleList)
        {
            Array.from(v).forEach(r => this.add(new Rule(r)));
            return;
        }
        v.forEach(r => this.add(r));
    }

    /** Underlying Observable. Created lazily on first access or first event subscription. */
    get Observable(): Observable
    {
        if (!this.#obs) this.#obs = new Observable(this);
        return this.#obs;
    }
    set Observable(v: Observable | boolean)
    {
        if (v === true)  { this.#obs = new Observable(this); return; }
        if (v === false) { this.#obs = null; return; }
        if (v instanceof Observable) this.#obs = v;
    }

    /**
     * the legacy library-style Events bag: assign listener functions to named slots.
     *
     * @example
     *   sheet.Events.OnSheetChanging = e => console.log('changing', e.Reason);
     *   sheet.Events.OnSheetChanged  = e => console.log('changed',  e.Changed);
     */
    get Events(): SheetEventsBag { return this.#events; }

    /**
     * Direct subscription on the internal Observable using AriannA event names.
     * Useful when you want event names not exposed via the Events bag.
     */
    on(types: string, cb: (e: object) => void): this
    {
        if (!this.#obs) this.#obs = new Observable(this);
        this.#obs.on(types, cb);
        return this;
    }

    // ── CRUD methods ──────────────────────────────────────────────────────────

    parse(input: SheetInput): this
    {
        this.#rules = [];

        if (typeof input === 'string') {
            if (/^https?:\/\/|^\/\//.test(input.trim()))
                this.#loadUrl(input.trim());
            else
                this.#parseText(input);
        } else if (input instanceof CSSStyleSheet)
        {
            this.#rules = Array.from(input.cssRules).map(r => new Rule(r));
            this.#sheet = input;
        } else if (input instanceof CSSRuleList)
        {
            this.#rules = Array.from(input).map(r => new Rule(r));
        } else if (Array.isArray(input))
        {
            this.#rules = input.map(r => r instanceof Rule ? r : new Rule(r as CSSRule));
        } else if (typeof input === 'object' && input !== null) {
            if (input instanceof Sheet)
                this.#rules = input.#rules.map(r => r.clone());
            else
                this.#parseObject(input as SheetObjectDef);
        }

        this.#flushRules();
        this.#emit('change-after', { Name: 'parse', Reason: 'parse' });
        return this;
    }

    getIndex(rule: SheetRule): number
    {
        const selector = typeof rule === 'string'
            ? rule.trim()
            : rule instanceof Rule
                ? rule.Selector.trim()
                : (rule as CSSStyleRule).selectorText?.trim() ?? '';

        return this.#rules.findIndex(r =>
            r.Selector.trim().replace(/\s+/g, '') === selector.replace(/\s+/g, ''));
    }

    contains(...rules: SheetRule[]): boolean
    {
        return rules.every(r => this.getIndex(r) >= 0);
    }

    /**
     * Get one or more rules by selector string, Rule instance, or CSSRule.
     * Also accepts @-rule selectors: sheet.get('@keyframes spin')
     * Mirrors the legacy library: sheet.Get('@keyframes Settete')
     */
    get(...rules: SheetRule[]): Rule | Rule[] | undefined
    {
        if (rules.length === 1)
        {
            const rule0 = rules[0];
            if (rule0 === undefined) return undefined;
            const i = this.getIndex(rule0);
            return i >= 0 ? this.#rules[i] : undefined;
        }
        return rules.map(r => {
            const i = this.getIndex(r);
            return i >= 0 ? this.#rules[i] : undefined;
        }).filter(Boolean) as Rule[];
    }

    /**
     * the legacy library alias for .get() — mirrors sheet.Get('@keyframes Settete').
     */
    Get(...rules: SheetRule[]): Rule | Rule[] | undefined
    {
        return this.get(...rules);
    }

    set(rule: SheetRule, value: CSSProperties | string): this
    {
        const i = this.getIndex(rule);
        if (i < 0) return this;

        const r = this.#rules[i];
        if (!r) return this;
        if (typeof value === 'string')
            r.replace(value);
        else
            r.merge(value);

        this.#flushRules();
        this.#emit('change-after', { Name: 'set', Reason: 'set', Changed: { index: i, rule: r } });
        return this;
    }

    /**
     * Insert one or more rules (or another Sheet's rules) at a position.
     *
     * Variadic and mixed-type, same as {@link Sheet.add}. The last numeric
     * argument (if any) is the index. If absent, defaults to the index given
     * as second argument (legacy 2-arg signature) or the end.
     *
     * Emits the same 5-event sequence as `add`, with Name='insert'.
     *
     * @example
     *   sheet.Insert(sheet2);                // merge another Sheet at end
     *   sheet.Insert(css3, 1);               // insert single at index 1
     *   sheet.Insert(css3, rule5, 1);        // insert two at index 1
     *   sheet.Insert(rule1, ruleDef, 0);     // mixed types, head insert
     */
    insert(...args: unknown[]): this
    {
        const last   = args[args.length - 1];
        const hasIdx = typeof last === 'number';
        const idx    = hasIdx ? (last as number) : this.#rules.length;
        const src    = hasIdx ? args.slice(0, -1) : args;

        const newRules = _toRules(src);
        if (newRules.length === 0) return this;

        return this.#bulkInsert(newRules, idx, args, 'insert');
    }

    /** the legacy library alias: sheet.Insert(rule, idx) */
    Insert(...args: unknown[]): this
    {
        return this.insert(...args);
    }

    /**
     * Add one or more rules (or whole Sheets) to this sheet.
     *
     * Accepts any combination of: Rule, RuleDefinition object, raw CSS string,
     * native CSSRule, another Sheet (its rules are inlined). A trailing numeric
     * argument is treated as an insertion index (the legacy library-compatible).
     *
     * Emits, in order:
     *   1. 'rules-add-before' (single event, AddingRules = all incoming rules)
     *   2. 'rule-adding'      (per rule, AddingRule + AddingRules + AddedRules)
     *   3. 'rule-added'       (per rule)
     *   4. 'rules-add-after'  (single event, AddedRules = full set)
     *   5. 'change-after'     (single, Name: 'add')
     *
     * @example
     *   sheet.Add(css1, css2);                   // legacy 2-rule add
     *   sheet.Add(rule1, rule2, rule3);          // variadic
     *   sheet.Add(sheet2);                       // merge another Sheet
     *   sheet.Add(rule1, ruleDefObj, ".x { y: 1 }");  // mixed types
     *   sheet.Add(rule1, rule2, 5);              // insert at index 5
     */
    add(...args: unknown[]): this
    {
        const last   = args[args.length - 1];
        const hasIdx = typeof last === 'number';
        const idx    = hasIdx ? (last as number) : undefined;
        const src    = hasIdx ? args.slice(0, -1) : args;

        const newRules = _toRules(src);
        if (newRules.length === 0) return this;

        return this.#bulkInsert(newRules, idx, args, 'add');
    }

    /**
     * Internal bulk insertion used by `add` / `insert` / `unshift`.
     * Centralises the 5-event emission pattern and `splice`/`push` logic.
     */
    #bulkInsert(newRules: Rule[], idx: number | undefined, originalArgs: unknown[], name: string): this
    {
        const addingRules = newRules.slice();
        const addedRules : Rule[] = [];

        // Phase 1 — global "before" event
        this.#emit('rules-add-before', {
            Name: name, Arguments: originalArgs,
            AddingRules: addingRules, AddedRules: addedRules,
        });

        // Determine target index
        const at = (typeof idx === 'number' && idx >= 0 && idx <= this.#rules.length)
            ? idx : this.#rules.length;

        for (let i = 0; i < newRules.length; i++)
        {
            const rule = newRules[i]!;

            // Phase 2 — per-rule "adding"
            this.#emit('rule-adding', {
                Name: name, Arguments: originalArgs,
                AddingRules: addingRules, AddedRules: addedRules.slice(),
                AddingRule: rule,
            });

            // Insert
            this.#rules.splice(at + i, 0, rule);
            addedRules.push(rule);

            // Phase 3 — per-rule "added"
            this.#emit('rule-added', {
                Name: name, Arguments: originalArgs,
                AddingRules: addingRules, AddedRules: addedRules.slice(),
                AddedRule: rule,
            });
        }

        // Phase 4 — global "after"
        this.#emit('rules-add-after', {
            Name: name, Arguments: originalArgs, AddedRules: addedRules,
        });

        this.#flushRules();

        // Phase 5 — generic change-after
        this.#emit('change-after', {
            Name: name, Reason: name, Arguments: originalArgs,
            Changed: { count: addedRules.length, at },
        });

        return this;
    }

    /** the legacy library alias: sheet.Add(rule1, rule2) */
    Add(...args: unknown[]): this
    {
        return this.add(...args);
    }

    /**
     * Add rules at the beginning of the sheet.
     * Accepts any input that {@link Sheet.add} does.
     */
    unshift(...rules: unknown[]): this
    {
        const newRules = _toRules(rules);
        if (newRules.length === 0) return this;
        return this.#bulkInsert(newRules, 0, rules, 'unshift');
    }

    remove(...rules: (SheetRule | number)[]): this
    {
        for (const r of rules)
        {
            const i = typeof r === 'number' ? r : this.getIndex(r);
            if (i >= 0) this.#rules.splice(i, 1);
        }
        this.#flushRules();
        this.#emit('change-after', { Name: 'remove', Reason: 'remove' });
        return this;
    }

    shift(n = 1): this
    {
        this.#rules.splice(0, n);
        this.#flushRules();
        this.#emit('change-after', { Name: 'shift', Reason: 'shift', Changed: { count: n } });
        return this;
    }

    pop(n = 1): this
    {
        this.#rules.splice(this.#rules.length - n, n);
        this.#flushRules();
        this.#emit('change-after', { Name: 'pop', Reason: 'pop', Changed: { count: n } });
        return this;
    }

    clear(): this
    {
        this.#rules = [];
        this.#flushRules();
        this.#emit('change-after', { Name: 'clear', Reason: 'clear' });
        return this;
    }

    toString(): string { return this.Text; }
}

// ── Window registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
{
    // Sheet
    Object.defineProperty(window, 'Sheet', {
        enumerable: true, configurable: false, writable: false, value: Sheet,
    });

    /**
     * SheetES5 — the legacy library legacy factory function.
     * Called as: SheetES5()  or  SheetES5("http://...")
     * Also has SheetES5.Less(text) static method.
     *
     * @example
     *   var sheet  = new SheetES5();
     *   var sheet2 = SheetES5("http://localhost:8080/styles/legacy");
     *   sheet2.Get('@keyframes Settete').Selector;
     *   SheetES5.Less(lessText);
     */
    function SheetES5(url?: string): Sheet
    {
        return url ? new Sheet(url) : new Sheet();
    }
    SheetES5.Less = (text: string): string => Sheet.Less(text);

    if (!('SheetES5' in window))
        Object.defineProperty(window, 'SheetES5', {
            enumerable: true, configurable: true, writable: true, value: SheetES5,
        });
}

export default Sheet;
