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
 *                                  (mirrors Golem: SheetES5("http://..."))
 *
 * Static API:
 *   Sheet.Sheets      → all Sheet instances
 *   Sheet.Links       → all <link> elements
 *   Sheet.Paths       → all href strings
 *   Sheet.ToString(s) → serialize source to CSS string
 *   Sheet.Parse(text) → CSSStyleSheet from text
 *   Sheet.ToArray(t)  → CSSRule[] from text
 *   Sheet.Less(text)  → parse Less/Stylus-style text to CSS string
 *                        (mirrors Golem: SheetES5.Less(text))
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
 *   .Get(rules)            — Golem alias for .get()
 *   .set(rule, value)
 *   .insert(rules, index)  — Golem: sheet.Insert(rule, idx)
 *   .add(rules)            — Golem: sheet.Add(rule1, rule2)
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
 *   // Golem SheetES5 pattern — fetch existing stylesheet
 *   const sheet2 = new Sheet('http://localhost:8080/styles/golem');
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

import Observable from './Observable.ts';
import { Rule } from './Rule.ts';
import type { RuleDefinition, CSSProperties } from './Rule.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SheetInput =
    | Sheet
    | CSSStyleSheet
    | CSSRuleList
    | HTMLLinkElement
    | CSSRule[]
    | Rule[]
    | Rule
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

// ── Less / Stylus parser ──────────────────────────────────────────────────────

/**
 * Minimal indentation-based CSS parser (Less/Stylus subset).
 * Supports:
 *   - Indented nesting → flat CSS with concatenated selectors
 *   - Variable declarations: @primary: red  /  $primary = red  /  $primary: red
 *   - Variable substitution in values
 *   - Single-line comments (//)
 *   - Standard @-rules pass through unchanged
 *
 * This is intentionally simple — it handles the patterns present in the
 * Golem-Css-Less.html and Golem-Css-Stylus.html examples without requiring
 * an external parser library.
 */
function parseLess(source: string): string
{
    // 1 — strip single-line comments
    const lines = source.replace(/\/\/[^\n]*/g, '').split('\n');

    // 2 — collect variables
    const vars: Record<string, string> = {};
    const cleanLines = lines.map(line => {
        const m = /^\s*[@$]([\w-]+)\s*[:=]\s*(.+)$/.exec(line ?? '');
        // FIX: m[1] and m[2] possibly undefined with noUncheckedIndexedAccess
        if (m && m[1] && m[2]) { vars[m[1]] = m[2].trim(); return null; }
        return line;
    }).filter(l => l !== null) as string[];

    // 3 — substitute variables
    const substituted = cleanLines.map(line => {
        return line.replace(/[@$]([\w-]+)/g, (_, name: string) => vars[name] ?? `@${name}`);
    });

    // 4 — parse indentation tree → flat CSS
    return buildCss(substituted, 0, []).css;
}

function getIndent(line: string): number
{
    const m = /^(\s*)/.exec(line);
    // FIX: m[1] possibly undefined
    return m ? (m[1]?.length ?? 0) : 0;
}

function buildCss(
    lines : string[],
    start : number,
    parentSelectors: string[],
): { css: string; end: number }
{
    let out   = '';
    let i     = start;
    let decls : string[] = [];

    function flushDecls(selectors: string[])
    {
        if (!decls.length) return;
        const sel = selectors.join(', ');
        out += `${sel} { ${decls.join('; ')}; }\n`;
        decls = [];
    }

    // FIX: lines[start] possibly undefined
    const baseIndent = start < lines.length ? getIndent(lines[start] ?? '') : 0;

    while (i < lines.length)
    {
        // FIX: lines[i] possibly undefined
        const raw = lines[i] ?? '';
        const trimmed = raw.trim();

        if (!trimmed) { i++; continue; }

        const indent = getIndent(raw);

        if (indent < baseIndent && i > start) break;

        // FIX: lines[i + 1] possibly undefined
        const nextLine = lines[i + 1];
        const nextIndent = (i + 1 < lines.length && nextLine && nextLine.trim())
            ? getIndent(nextLine)
            : 0;

        if (trimmed.endsWith('{'))
        {
            flushDecls(parentSelectors.length ? parentSelectors : [trimmed.slice(0, -1).trim()]);
            out += raw + '\n';
            i++;
            let depth = 1;
            while (i < lines.length && depth > 0)
            {
                // FIX: l possibly undefined
                const l = lines[i] ?? '';
                out += l + '\n';
                depth += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
                i++;
            }
            continue;
        }

        if (nextIndent > indent && !trimmed.includes(':'))
        {
            flushDecls(parentSelectors.length ? parentSelectors : []);
            const selectors = parentSelectors.length
                ? parentSelectors.map(p => `${p} ${trimmed}`)
                : [trimmed];
            const child = buildCss(lines, i + 1, selectors);
            out  += child.css;
            i     = child.end;
            continue;
        }

        // Declaration line: prop: value  or  prop value (Stylus)
        if (trimmed.includes(':') || (trimmed.includes(' ') && !trimmed.startsWith('@')))
        {
            // Normalize: replace first space separator to : if no colon
            const decl = trimmed.includes(':')
                ? trimmed.replace(/:\s*/, ': ')
                : trimmed.replace(/\s+/, ': ');
            decls.push(decl.replace(/;$/, ''));
        } else if (trimmed.startsWith('@'))
        {
            // @-rule — pass through
            flushDecls(parentSelectors.length ? parentSelectors : []);
            out += trimmed + '\n';
        }

        i++;
    }

    flushDecls(parentSelectors.length ? parentSelectors : []);
    return { css: out, end: i };
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
    #obs     : Observable | false    = false;

    // ── Constructor ─────────────────────────────────────────────────────────────

    constructor(...args: SheetInput[])
    {
        this.#head = document.head ?? document.documentElement;

        const input: SheetInput | undefined =
            args.length === 0    ? undefined :
            args.length === 1    ? args[0] :
            /* multiple args */    args.filter(a => a instanceof Rule) as Rule[];

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
                    this.#rules = input.map(r =>
                        r instanceof Rule ? r : new Rule(r as CSSRule)
                    );
                } else
                {
                    this.#parseObject(input as SheetObjectDef);
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
                this.#emit('Sheet-Loaded', { url });
            })
            .catch(err => {
                this.#state   = 'Error';
                this.#loading = false;
                this.#emit('Sheet-Error', { url, error: err });
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

    #emit(type: string, detail: unknown): void
    {
        if (this.#obs instanceof Observable)
            this.#obs.fire({ Type: type, Sheet: this, Detail: detail });
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
    static Less(text: string): string
    {
        return parseLess(text);
    }

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

    get Observable(): Observable | false { return this.#obs; }
    set Observable(v: Observable | boolean)
    {
        if (v === true)  { this.#obs = new Observable(this); return; }
        if (v === false) { this.#obs = false; return; }
        if (v instanceof Observable) this.#obs = v;
    }

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
        this.#emit('Sheet-Changed', { action: 'parse' });
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
     * Mirrors Golem: sheet.Get('@keyframes Settete')
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
     * Golem alias for .get() — mirrors sheet.Get('@keyframes Settete').
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
        this.#emit('Sheet-Changed', { action: 'set', index: i, rule: r });
        return this;
    }

    insert(rules: SheetRule | SheetRule[], index: number): this
    {
        const arr = Array.isArray(rules) ? rules : [rules];
        const newRules = arr.map(r =>
            r instanceof Rule ? r :
            typeof r === 'string' ? Rule.Parse(r)[0] :
            new Rule(r as CSSRule)
        ).filter(Boolean) as Rule[];

        this.#rules.splice(index, 0, ...newRules);
        this.#flushRules();
        this.#emit('Sheet-Changed', { action: 'insert', index, count: newRules.length });
        return this;
    }

    /** Golem alias: sheet.Insert(rule, idx) */
    Insert(rules: SheetRule | SheetRule[], index: number): this
    {
        return this.insert(rules, index);
    }

    add(...args: (SheetRule | SheetRule[] | number)[]): this
    {
        const last   = args[args.length - 1];
        const hasIdx = typeof last === 'number';
        const idx    = hasIdx ? (last as number) : undefined;
        const src    = (hasIdx ? args.slice(0, -1) : args) as (SheetRule | SheetRule[])[];

        const flat = src.flat() as SheetRule[];
        const newRules = flat.map(r =>
            r instanceof Rule ? r :
            typeof r === 'string' ? (Rule.Parse(r)[0] ?? null) :
            new Rule(r as CSSRule)
        ).filter(Boolean) as Rule[];

        if (hasIdx && idx! >= 0 && idx! <= this.#rules.length)
            this.#rules.splice(idx!, 0, ...newRules);
        else
            this.#rules.push(...newRules);

        this.#flushRules();
        this.#emit('Sheet-Changed', { action: 'add', count: newRules.length });
        return this;
    }

    /** Golem alias: sheet.Add(rule1, rule2) */
    Add(...args: (SheetRule | SheetRule[] | number)[]): this
    {
        return this.add(...args);
    }

    unshift(...rules: (SheetRule | SheetRule[])[]): this
    {
        return this.insert(rules.flat() as SheetRule[], 0);
    }

    remove(...rules: (SheetRule | number)[]): this
    {
        for (const r of rules)
        {
            const i = typeof r === 'number' ? r : this.getIndex(r);
            if (i >= 0) this.#rules.splice(i, 1);
        }
        this.#flushRules();
        this.#emit('Sheet-Changed', { action: 'remove' });
        return this;
    }

    shift(n = 1): this
    {
        this.#rules.splice(0, n);
        this.#flushRules();
        this.#emit('Sheet-Changed', { action: 'shift', count: n });
        return this;
    }

    pop(n = 1): this
    {
        this.#rules.splice(this.#rules.length - n, n);
        this.#flushRules();
        this.#emit('Sheet-Changed', { action: 'pop', count: n });
        return this;
    }

    clear(): this
    {
        this.#rules = [];
        this.#flushRules();
        this.#emit('Sheet-Changed', { action: 'clear' });
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
     * SheetES5 — Golem legacy factory function.
     * Called as: SheetES5()  or  SheetES5("http://...")
     * Also has SheetES5.Less(text) static method.
     *
     * @example
     *   var sheet  = new SheetES5();
     *   var sheet2 = SheetES5("http://localhost:8080/styles/golem");
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
