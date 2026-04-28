/**
 * @module    Directive
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Performant like SolidJS, reactive like Vue, pleasant like AriannA itself.
 * Lightweight DOM directives — no virtual DOM overhead.
 *
 * ── RUNTIME DIRECTIVES ───────────────────────────────────────────────────────
 *
 *   Directive.if(el, condition, then?, else?)
 *     Conditionally show/hide content. Returns an update() function.
 *
 *   Directive.for(el, items, renderFn)
 *     Render a list from an array. Returns an update() function.
 *
 *   Directive.foreach(el, object, renderFn)
 *     Render an object's key/value pairs. Returns update().
 *     Matches: <ol foreach="var planet in object">
 *
 *   Directive.while(el, condition, renderFn)
 *     Render while a condition is truthy.
 *
 *   Directive.switch(el, value, cases)
 *     Render the matching case from a map of value → content.
 *
 *   Directive.bind(el, prop, source)
 *     One-way bind: element[prop] ← source(). Re-evaluates on source change.
 *
 *   Directive.show(el, condition)
 *     Toggle display without removing from DOM.
 *
 *   Directive.model(input, state, key)
 *     Two-way binding between an input and a State property.
 *
 *   Directive.on(el, type, handler, opts?)
 *     Thin wrapper over addEventListener — mirrors v-on / @event syntax.
 *
 *   Directive.template(el, data?)
 *     Process {{ expression }} template literals in el's innerHTML.
 *     Matches Golem's {{ planet }} / {{ object[planet] }} / {{ Level1A.Level2A }} syntax.
 *
 *   Directive.bootstrap(root?)
 *     Scan the DOM for directive attributes and apply automatically.
 *     Processes: a-if, a-for, a-foreach, a-while, a-switch, a-bind, a-show, a-model, a-on.
 *
 * ── HTML ATTRIBUTE DIRECTIVES (via bootstrap) ─────────────────────────────────
 *   <div a-if="condition"></div>
 *   <ol  a-foreach="var item in items"><li>{{ item }}</li></ol>
 *   <ul  a-for="item in items"><li>{{ item }}</li></ul>
 *   <div a-show="condition"></div>
 *   <input a-model="state.key">
 *   <button a-on="click:handler">
 *   <div a-bind="textContent:expr"></div>
 *   <div a-switch="value">
 *     <div a-case="v1">Case 1</div>
 *     <div a-case="v2">Case 2</div>
 *   </div>
 *
 * ── TYPESCRIPT DECORATORS ─────────────────────────────────────────────────────
 *   @Component({ tag, template, style })   — defines a Custom Element
 *   @Prop()                                — reactive property
 *   @Watch('propName')                     — watch a prop for changes
 *   @Emit('event-name')                    — fires CustomEvent on return
 *   @Ref(selector?)                        — wires property to DOM element
 *
 * @example
 *   // Conditional
 *   const update = Directive.if(el, () => user.loggedIn, loginPanel, logoutPanel);
 *   // Later: update() re-evaluates
 *
 * @example
 *   // List rendering
 *   const update = Directive.for(list, () => items, (item, i) =>
 *     `<li data-i="${i}">${item.name}</li>`);
 *
 * @example
 *   // Foreach (object iteration — matches Golem's foreach="var planet in object")
 *   const update = Directive.foreach(ol, () => planets, (key, value) =>
 *     `<li>${key}: ${value}</li>`);
 *
 * @example
 *   // Template literals (matches Golem's {{ expr }} syntax)
 *   var example = 'EXAMPLE'; var literals = 'LITERALS';
 *   Directive.template(div, { example, literals });
 *   // Replaces {{ example }} → 'EXAMPLE', {{ literals }} → 'LITERALS'
 *
 * @example
 *   // Two-way model binding
 *   const state = new State({ name: 'AriannA' });
 *   Directive.model(input, state, 'name');
 *   // input.value ↔ state.State.name
 *
 * @example
 *   // Bootstrap — auto-process directive attributes
 *   Directive.bootstrap(document.body);
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type Condition    = boolean | (() => boolean);
type ContentArg   = string | Element | DocumentFragment | null | undefined;
type RenderFn<T>  = (item: T, index: number) => string | Element;
type ObjRenderFn  = (key: string, value: unknown, index: number) => string | Element;
type UpdateFn     = () => void;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _resolve(condition: Condition): boolean
{
    return typeof condition === 'function' ? condition() : Boolean(condition);
}

function _toNode(content: ContentArg): Node | null
{
    if (!content) return null;
    if (content instanceof Element || content instanceof DocumentFragment) return content;
    if (typeof content === 'string') {
        const t = document.createElement('template');
        t.innerHTML = content;
        return t.content.cloneNode(true);
    }
    return null;
}

function _resolveParent(parent: Element | string): Element | null
{
    if (typeof parent === 'string') return document.querySelector(parent);
    return parent;
}

// ── Directive ─────────────────────────────────────────────────────────────────

export const Directive = Object.freeze(
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
    if(
        parent    : Element | string,
        condition : Condition,
        then_?    : ContentArg,
        else_?    : ContentArg,
    ): UpdateFn
    {
        const par    = _resolveParent(parent);
        if (!par) return () => {};
        const anchor = document.createComment(' a:if ');
        par.appendChild(anchor);
        let current: Node | Node[] | null = null;

        function update(): void
        {
            const val = _resolve(condition);
            const src = val ? then_ : else_;

            // Remove current nodes
            if (current)
            {
                if (Array.isArray(current))
                    current.forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
                else if ((current as Node).parentNode)
                    (current as Node).parentNode!.removeChild(current as Node);
                current = null;
            }

            if (src)
            {
                const next = _toNode(src);
                if (next)
                {
                    // Collect real nodes before inserting (DocumentFragment empties on insert)
                    const nodes = next.nodeType === 11
                        ? Array.from((next as DocumentFragment).childNodes)
                        : [next];
                    anchor.parentNode!.insertBefore(next, anchor);
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
    for<T>(
        parent   : Element | string,
        items    : T[] | (() => T[]),
        renderFn : RenderFn<T>,
    ): UpdateFn
    {
        const par = _resolveParent(parent);
        if (!par) return () => {};
        const anchor = document.createComment(' a:for ');
        par.appendChild(anchor);
        const rendered: Node[] = [];

        function update(): void
        {
            rendered.forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
            rendered.length = 0;
            const list = typeof items === 'function' ? items() : items;
            const frag = document.createDocumentFragment();
            list.forEach((item, i) => {
                const node = _toNode(renderFn(item, i) as ContentArg);
                if (node) { frag.appendChild(node); rendered.push(node); }
            });
            anchor.parentNode!.insertBefore(frag, anchor);
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
    foreach(
        parent   : Element | string,
        obj      : Record<string, unknown> | (() => Record<string, unknown>),
        renderFn : ObjRenderFn,
    ): UpdateFn
    {
        const par = _resolveParent(parent);
        if (!par) return () => {};
        const anchor = document.createComment(' a:foreach ');
        par.appendChild(anchor);
        const rendered: Node[] = [];

        function update(): void
        {
            rendered.forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
            rendered.length = 0;
            const source = typeof obj === 'function' ? obj() : obj;
            const frag   = document.createDocumentFragment();
            Object.entries(source).forEach(([key, value], i) => {
                const node = _toNode(renderFn(key, value, i) as ContentArg);
                if (node) { frag.appendChild(node); rendered.push(node); }
            });
            anchor.parentNode!.insertBefore(frag, anchor);
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
    while(
        parent    : Element | string,
        condition : () => boolean,
        renderFn  : (iteration: number) => string | Element,
    ): UpdateFn
    {
        const par = _resolveParent(parent);
        if (!par) return () => {};
        const anchor = document.createComment(' a:while ');
        par.appendChild(anchor);
        const rendered: Node[] = [];

        function update(): void
        {
            rendered.forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
            rendered.length = 0;
            const frag = document.createDocumentFragment();
            let i = 0;
            const MAX = 10000;
            while (condition() && i < MAX)
            {
                const node = _toNode(renderFn(i) as ContentArg);
                if (node) { frag.appendChild(node); rendered.push(node); }
                i++;
            }
            anchor.parentNode!.insertBefore(frag, anchor);
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
    switch(
        parent : Element | string,
        value  : unknown | (() => unknown),
        cases  : Record<string, ContentArg>,
    ): UpdateFn
    {
        const par    = _resolveParent(parent);
        if (!par) return () => {};
        const anchor = document.createComment(' a:switch ');
        par.appendChild(anchor);
        let current: Node | Node[] | null = null;

        function update(): void
        {
            const val = typeof value === 'function' ? value() : value;
            const src = cases[String(val)] ?? cases['default'] ?? null;

            if (current)
            {
                if (Array.isArray(current))
                    current.forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
                else if ((current as Node).parentNode)
                    (current as Node).parentNode!.removeChild(current as Node);
                current = null;
            }

            if (src)
            {
                const next = _toNode(src);
                if (next)
                {
                    const nodes = next.nodeType === 11
                        ? Array.from((next as DocumentFragment).childNodes) : [next];
                    anchor.parentNode!.insertBefore(next, anchor);
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
    bind(
        el     : Element,
        prop   : string,
        source : unknown | (() => unknown),
    ): UpdateFn
    {
        function update(): void
        {
            const val = typeof source === 'function' ? source() : source;
            (el as unknown as Record<string, unknown>)[prop] = val;
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
    show(el: HTMLElement, condition: Condition): UpdateFn
    {
        function update(): void
        {
            el.style.display = _resolve(condition) ? '' : 'none';
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
    model(
        input : HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
        state : { State: Record<string, unknown>; on(t: string, cb: (e: unknown) => void): void },
        key   : string,
    ): void
    {
        // DOM → State
        input.addEventListener('input', () => {
            state.State[key] = input.value;
        });
        // State → DOM
        state.on('State-Changed', () => {
            const v = String(state.State[key] ?? '');
            if (input.value !== v) input.value = v;
        });
        // Initial sync
        input.value = String(state.State[key] ?? '');
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
    on(
        el      : Element | string,
        types   : string,
        handler : EventListener,
        opts?   : AddEventListenerOptions,
    ): void
    {
        const target = typeof el === 'string' ? document.querySelector(el) : el;
        if (!target) return;
        types.split(/\s+|,|\|/g).filter(Boolean).forEach(t =>
            target.addEventListener(t, handler, opts));
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
    template(el: Element, data?: Record<string, unknown>): void
    {
        const ctx = data ?? (typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {});

        function resolve(expr: string): string
        {
            expr = expr.trim();
            try
            {
                // Simple dot/bracket path resolution — no eval
                const parts = expr.split(/\.|\[['"]?|['"]?\]/g).filter(Boolean);
                let val: unknown = ctx;
                for (const part of parts)
                {
                    if (val == null) return '';
                    val = (val as Record<string, unknown>)[part];
                }
                return val != null ? String(val) : '';
            } catch
            {
                return '';
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
    bootstrap(
        root    : Element = document.body,
        context : Record<string, unknown> = {},
    ): void
    {
        const ctx = { ...(typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : {}), ...context };

        function evalExpr(expr: string): unknown
        {
            try
            {
                // Safe-ish expression eval using Function with explicit context keys
                const keys = Object.keys(ctx);
                const vals = Object.values(ctx);
                return new Function(...keys, `return (${expr})`)(...vals);
            } catch { return undefined; }
        }

        // Process {{ }} template literals on all text nodes
        root.querySelectorAll('[a-template],[data-template]').forEach(el => {
            Directive.template(el, ctx);
        });

        // a-if
        root.querySelectorAll('[a-if]').forEach(el => {
            const expr = el.getAttribute('a-if') ?? 'false';
            Directive.if(el.parentElement ?? root, () => Boolean(evalExpr(expr)), el as Element);
        });

        // a-show
        root.querySelectorAll('[a-show]').forEach(el => {
            const expr = el.getAttribute('a-show') ?? 'false';
            Directive.show(el as HTMLElement, () => Boolean(evalExpr(expr)));
        });

        // a-model
        root.querySelectorAll('[a-model]').forEach(el => {
            const path = el.getAttribute('a-model') ?? '';
            const [stateKey, propKey] = path.split('.');
            const state = ctx[stateKey] as { State: Record<string, unknown>; on(t: string, cb: (e: unknown) => void): void };
            if (state && propKey) Directive.model(el as HTMLInputElement, state, propKey);
        });

        // a-on
        root.querySelectorAll('[a-on]').forEach(el => {
            const spec = el.getAttribute('a-on') ?? '';
            const [type, fnName] = spec.split(':').map(s => s.trim());
            if (type && fnName)
            {
                const handler = ctx[fnName];
                if (typeof handler === 'function')
                    Directive.on(el, type, handler as EventListener);
            }
        });

        // a-bind
        root.querySelectorAll('[a-bind]').forEach(el => {
            const spec = el.getAttribute('a-bind') ?? '';
            const [prop, expr] = spec.split(':').map(s => s.trim());
            if (prop && expr) Directive.bind(el, prop, () => evalExpr(expr));
        });
    },

});

// ── TypeScript Decorators ──────────────────────────────────────────────────────

/** Metadata for @Component decorator. */
export interface ComponentMeta
{
    /** Custom element tag name (must contain a hyphen). */
    tag      : string;
    /** HTML template string for the component's shadow or light DOM. */
    template?: string;
    /** CSS string for the component's styles. */
    style?   : string;
    /** Shadow DOM mode ('open' | 'closed'). Default: 'open'. */
    shadow?  : 'open' | 'closed' | false;
}

/**
 * Class decorator — defines and registers a Custom Element.
 *
 * @example
 *   @Component({ tag: 'my-button', template: '<button><slot></slot></button>' })
 *   class MyButton extends HTMLElement {
 *     connectedCallback() { this.#render(); }
 *   }
 */
export function Component(meta: ComponentMeta)
{
    return function <T extends typeof HTMLElement>(Base: T): T
    {
        // Inject template + style into connectedCallback
        const _connected = (Base.prototype as unknown as { connectedCallback?: () => void }).connectedCallback;

        (Base.prototype as unknown as { connectedCallback: unknown }).connectedCallback = function connectedCallback(this: HTMLElement)
        {
            if (meta.shadow !== false && !this.shadowRoot)
            {
                const root = this.attachShadow({ mode: meta.shadow ?? 'open' });
                if (meta.style)    { const s = document.createElement('style'); s.textContent = meta.style; root.appendChild(s); }
                if (meta.template) { const t = document.createElement('template'); t.innerHTML = meta.template; root.appendChild(t.content.cloneNode(true)); }
            } else if (meta.template && !this.children.length)
            {
                this.innerHTML = meta.template;
            }
            if (_connected) _connected.call(this);
        };

        if (!customElements.get(meta.tag))
            customElements.define(meta.tag, Base);

        return Base;
    };
}

/**
 * Property decorator — marks a class property as reactive.
 * When the property changes, the component's update() method is called if present.
 *
 * @example
 *   @Component({ tag: 'my-count' })
 *   class MyCount extends HTMLElement {
 *     @Prop() count = 0;
 *   }
 */
export function Prop()
{
    return function (target: object, key: string): void
    {
        const storage = new WeakMap<object, unknown>();
        Object.defineProperty(target, key, {
            get(this: object) { return storage.get(this); },
            set(this: object & { update?: () => void }, v: unknown)
            {
                if (storage.get(this) === v) return;
                storage.set(this, v);
                if (typeof this.update === 'function') this.update();
            },
            configurable: true, enumerable: true,
        });
    };
}

/**
 * Method decorator — called when a named prop changes.
 *
 * @example
 *   @Watch('count')
 *   onCountChange(newVal: number, oldVal: number) {
 *     console.log(`count: ${oldVal} → ${newVal}`);
 *   }
 */
export function Watch(propName: string)
{
    return function (_target: object, _key: string, descriptor: PropertyDescriptor)
    {
        const original = descriptor.value as (nv: unknown, ov: unknown) => void;
        descriptor.value = function (this: object, nv: unknown, ov: unknown)
        {
            if ((this as Record<string, unknown>)[propName] !== nv)
                original.call(this, nv, ov);
        };
        return descriptor;
    };
}

/**
 * Method decorator — wraps the return value in a CustomEvent and dispatches it.
 *
 * @example
 *   @Emit('my-submit')
 *   handleSubmit() { return { data: this.formData }; }
 *   // Dispatches: new CustomEvent('my-submit', { detail: { data: ... } })
 */
export function Emit(eventName: string)
{
    return function (_target: object, _key: string, descriptor: PropertyDescriptor)
    {
        const original = descriptor.value as (...args: unknown[]) => unknown;
        descriptor.value = function (this: HTMLElement, ...args: unknown[])
        {
            const result = original.apply(this, args);
            this.dispatchEvent(new CustomEvent(eventName, { detail: result, bubbles: true, composed: true }));
            return result;
        };
        return descriptor;
    };
}

/**
 * Property decorator — wires a class property to a DOM element via selector.
 * The element is resolved lazily on first access.
 *
 * @example
 *   @Ref('#my-input') inputEl!: HTMLInputElement;
 *   @Ref()           nameRef!: HTMLElement;  // uses property name as id
 */
export function Ref(selector?: string)
{
    return function (target: object, key: string): void
    {
        const sel = selector ?? `#${key}`;
        Object.defineProperty(target, key, {
            get(this: HTMLElement)
            {
                return (this.shadowRoot ?? this).querySelector(sel);
            },
            configurable: true, enumerable: true,
        });
    };
}

// ── Window registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Directive', {
        enumerable: true, configurable: false, writable: false, value: Directive,
    });

export default Directive;
