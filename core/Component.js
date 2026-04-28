"use strict";
/**
 * @module    Component
 * @author    Riccardo Angeli
 * @version   1.2.0
 * @copyright Riccardo Angeli 2012-2026
 *
 * Component — dual-mode AriannA component system.
 * Dedicated with love to Arianna. ♡
 *
 * Fine-grain Signal+Sink — same fluent API as Real and Virtual.
 *
 *   .text(getter)     → reactive TextNode Sink
 *   .attr(name, g)    → Attribute Sink
 *   .cls(name, g)     → Class Sink
 *   .prop(name, g)    → Property Sink
 *   .style(prop, g)   → Style Sink
 *   .bind(g, s?)      → Two-way binding
 *   .destroy()        → deregister all Effects
 *
 * @Prop() uses signal() internally — every prop becomes a Signal.
 * @Watch and Effects reading that prop react granularly without
 * re-rendering the entire component.
 *
 * @example
 *   const title = signal('hello');
 *   new Component('h1')
 *     .text(() => title.get())
 *     .append(document.body);
 *   title.set('world');   // only the TextNode updates
 *
 * @example
 *   @ComponentDecorator({ tag: 'my-card' })
 *   class MyCard extends HTMLElement {
 *     @Prop() name = '';
 *     @Ref()  nameEl!: HTMLSpanElement;
 *
 *     @Watch('name')
 *     onName(next: string) {
 *       if (this.nameEl) this.nameEl.textContent = next;
 *     }
 *   }
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentClass = exports.PropSignal = exports.Component = void 0;
exports.ComponentDecorator = ComponentDecorator;
exports.Prop = Prop;
exports.Watch = Watch;
exports.Emit = Emit;
exports.Ref = Ref;
var Real_ts_1 = require("./Real.ts");
var Virtual_ts_1 = require("./Virtual.ts");
var Core_ts_1 = require("./Core.ts");
var Observable_ts_1 = require("./Observable.ts");
// ── Component class ────────────────────────────────────────────────────────────
var Component = /** @class */ (function () {
    function Component(arg0, arg1) {
        var children = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            children[_i - 2] = arguments[_i];
        }
        var _a;
        _Component_delegate.set(this, void 0);
        var opts = (arg1 !== null && arg1 !== void 0 ? arg1 : {});
        var mode = (_a = opts.mode) !== null && _a !== void 0 ? _a : 'real';
        var attrs = __assign({}, opts);
        delete attrs['mode'];
        this.mode = mode;
        if (mode === 'virtual') {
            // FIX: VirtualNode is a class — always use `new`, never call directly
            __classPrivateFieldSet(this, _Component_delegate, arg0 instanceof Virtual_ts_1.VirtualNode
                ? arg0
                : new (Virtual_ts_1.VirtualNode.bind.apply(Virtual_ts_1.VirtualNode, __spreadArray([void 0, arg0,
                    attrs], children, false)))(), "f");
        }
        else {
            __classPrivateFieldSet(this, _Component_delegate, arg0 instanceof Virtual_ts_1.VirtualNode
                ? new Real_ts_1.default(arg0.render())
                : new (Real_ts_1.default.bind.apply(Real_ts_1.default, __spreadArray([void 0, arg0, attrs], children, false)))(), "f");
        }
        Component.Instances.push(this);
    }
    // ── Core API ──────────────────────────────────────────────────────────────
    Component.prototype.render = function () { return __classPrivateFieldGet(this, _Component_delegate, "f").render(); };
    Component.prototype.valueOf = function () { return this.render(); };
    Component.prototype.log = function (v) { __classPrivateFieldGet(this, _Component_delegate, "f").log(v); return this; };
    Component.prototype.on = function (type, cb, opts) { __classPrivateFieldGet(this, _Component_delegate, "f").on(type, cb, opts); return this; };
    Component.prototype.off = function (type, cb, opts) { __classPrivateFieldGet(this, _Component_delegate, "f").off(type, cb, opts); return this; };
    Component.prototype.fire = function (type, init) { __classPrivateFieldGet(this, _Component_delegate, "f").fire(type, init); return this; };
    Component.prototype.append = function (parent) {
        var target = parent instanceof Component ? parent.render() : parent;
        __classPrivateFieldGet(this, _Component_delegate, "f").append(target);
        return this;
    };
    Component.prototype.add = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var normalized = args.map(function (a) { return a instanceof Component ? a.render() : a; });
        (_a = __classPrivateFieldGet(this, _Component_delegate, "f")).add.apply(_a, normalized);
        return this;
    };
    Component.prototype.unshift = function () {
        var nodes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            nodes[_i] = arguments[_i];
        }
        return this.add.apply(this, __spreadArray(__spreadArray([], nodes, false), [0], false));
    };
    Component.prototype.push = function () {
        var nodes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            nodes[_i] = arguments[_i];
        }
        return this.add.apply(this, nodes);
    };
    Component.prototype.remove = function () {
        var _a;
        var targets = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            targets[_i] = arguments[_i];
        }
        var normalized = targets.map(function (t) { return t instanceof Component ? t.render() : t; });
        (_a = __classPrivateFieldGet(this, _Component_delegate, "f")).remove.apply(_a, normalized);
        return this;
    };
    Component.prototype.shift = function (n) {
        if (n === void 0) { n = 1; }
        __classPrivateFieldGet(this, _Component_delegate, "f").shift(n);
        return this;
    };
    Component.prototype.pop = function (n) {
        if (n === void 0) { n = 1; }
        __classPrivateFieldGet(this, _Component_delegate, "f").pop(n);
        return this;
    };
    Component.prototype.get = function (name) { var _a; return (_a = __classPrivateFieldGet(this, _Component_delegate, "f").get(name)) !== null && _a !== void 0 ? _a : undefined; };
    Component.prototype.set = function (name, value) { __classPrivateFieldGet(this, _Component_delegate, "f").set(name, value); return this; };
    Component.prototype.show = function () { __classPrivateFieldGet(this, _Component_delegate, "f").show(); return this; };
    Component.prototype.hide = function () { __classPrivateFieldGet(this, _Component_delegate, "f").hide(); return this; };
    /**
     * Returns true if the rendered element contains all given nodes.
     * FIX: implemented directly on the DOM element — Real/VirtualNode
     * do not expose a .contains() method.
     */
    Component.prototype.contains = function () {
        var nodes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            nodes[_i] = arguments[_i];
        }
        var root = this.render();
        return nodes.every(function (n) {
            if (n instanceof Component)
                return root.contains(n.render());
            if (n instanceof Virtual_ts_1.VirtualNode)
                return root.contains(n.render());
            if (n instanceof Element)
                return root.contains(n);
            if (typeof n === 'string')
                return !!root.querySelector(n);
            return false;
        });
    };
    Component.prototype.css = function (prop, value) {
        var el = this.render();
        // FIX: double-cast via `unknown` to satisfy TS2352
        if (el instanceof HTMLElement)
            el.style[prop] = value;
        return this;
    };
    // ── Fine-grain Signal+Sink API ─────────────────────────────────────────────
    Component.prototype.text = function (getter) { __classPrivateFieldGet(this, _Component_delegate, "f").text(getter); return this; };
    Component.prototype.attr = function (name, getter) { __classPrivateFieldGet(this, _Component_delegate, "f").attr(name, getter); return this; };
    Component.prototype.cls = function (name, getter) { __classPrivateFieldGet(this, _Component_delegate, "f").cls(name, getter); return this; };
    Component.prototype.prop = function (name, getter) { __classPrivateFieldGet(this, _Component_delegate, "f").prop(name, getter); return this; };
    Component.prototype.style = function (prop, getter) { __classPrivateFieldGet(this, _Component_delegate, "f").style(prop, getter); return this; };
    Component.prototype.bind = function (getter, setter) { __classPrivateFieldGet(this, _Component_delegate, "f").bind(getter, setter); return this; };
    Component.prototype.destroy = function () { __classPrivateFieldGet(this, _Component_delegate, "f").destroy(); return this; };
    // ── Static API ────────────────────────────────────────────────────────────
    Component.Define = function (tag, ctor, base, style) {
        if (base === void 0) { base = HTMLElement; }
        if (style === void 0) { style = {}; }
        return Core_ts_1.default.Define(tag, ctor, base, style);
    };
    Object.defineProperty(Component, "Namespaces", {
        get: function () { return Core_ts_1.default.Namespaces; },
        enumerable: false,
        configurable: true
    });
    var _Component_delegate;
    _Component_delegate = new WeakMap();
    Component.Instances = [];
    return Component;
}());
exports.Component = Component;
exports.ComponentClass = Component;
// ── Callable factory ──────────────────────────────────────────────────────────
// Allows both `new Component(...)` and `Component(...)` call patterns
// without relying on Reflect.construct (which requires ES2015+ lib).
function _cFactory(arg0, arg1) {
    var rest = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        rest[_i - 2] = arguments[_i];
    }
    return new (Component.bind.apply(Component, __spreadArray([void 0, arg0, arg1], rest, false)))();
}
Object.defineProperties(_cFactory, {
    prototype: { value: Component.prototype, writable: false },
    name: { value: 'Component' },
});
// ── Decorator: @ComponentDecorator({ tag, mode? }) ────────────────────────────
// FIX: was named `ComponentDecorator` locally but exported as `Component`,
// causing TS2323 (redeclare) and TS2484 (export conflict).
// Now exported under its real name `ComponentDecorator`.
function ComponentDecorator(opts) {
    return function (ctor) {
        Core_ts_1.default.Define(opts.tag, ctor, HTMLElement);
        return ctor;
    };
}
// ── Decorator: @Prop() ────────────────────────────────────────────────────────
/**
 * Reactive property backed by a Signal.
 *
 * Each prop becomes an internal Signal<T>.
 * Effects and @Watch handlers reading this prop react granularly.
 * Dispatches 'prop-change' CustomEvent for external observers.
 *
 * @example
 *   @Prop() count = 0;
 */
function Prop() {
    return function (target, key) {
        var sigKey = "__sig_".concat(key, "__");
        Object.defineProperty(target, key, {
            get: function () {
                if (!this[sigKey])
                    this[sigKey] = (0, Observable_ts_1.signal)(undefined);
                return this[sigKey].get();
            },
            set: function (v) {
                var _this = this;
                if (!this[sigKey])
                    this[sigKey] = (0, Observable_ts_1.signal)(undefined);
                var sig = this[sigKey];
                var prev = sig.peek();
                if (Object.is(prev, v))
                    return;
                sig.set(v);
                var watchKey = "__watch_".concat(key, "__");
                var watchers = this[watchKey];
                if (Array.isArray(watchers))
                    watchers
                        .forEach(function (fn) { return fn.call(_this, v, prev); });
                if (typeof this.render === 'function') {
                    var html = this.render();
                    if (this._root)
                        this._root.innerHTML = html;
                    else if (typeof html === 'string')
                        this.innerHTML = html;
                    _resolveRefs(this);
                }
                this.dispatchEvent(new CustomEvent('prop-change', {
                    detail: { key: key, value: v, prev: prev }, bubbles: true,
                }));
            },
            enumerable: true,
            configurable: true,
        });
    };
}
/**
 * Access the raw Signal of a @Prop for fine-grain Effect wiring.
 *
 * @example
 *   const sig = PropSignal.of(this, 'name');
 *   effect(() => { nameNode.nodeValue = sig.get(); });
 */
exports.PropSignal = {
    of: function (instance, key) {
        return instance["__sig_".concat(key, "__")];
    },
};
// ── Decorator: @Watch(key) ────────────────────────────────────────────────────
function Watch(key) {
    return function (target, _methodKey, descriptor) {
        var original = descriptor.value;
        var watchKey = "__watch_".concat(key, "__");
        var proto = target;
        if (!proto[watchKey])
            proto[watchKey] = [];
        proto[watchKey].push(function (next, prev) {
            original.call(this, next, prev);
        });
        return descriptor;
    };
}
// ── Decorator: @Emit(event?) ──────────────────────────────────────────────────
function Emit(eventName) {
    return function (target, methodKey, descriptor) {
        var original = descriptor.value;
        descriptor.value = function () {
            var _this = this;
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            var result = original.apply(this, args);
            var name = eventName !== null && eventName !== void 0 ? eventName : methodKey;
            // FIX: type the Promise.then callback explicitly (TS7044)
            if (result instanceof Promise)
                void result.then(function (v) {
                    return _this.dispatchEvent(new CustomEvent(name, { detail: v, bubbles: true }));
                });
            else
                this.dispatchEvent(new CustomEvent(name, { detail: result, bubbles: true }));
            return result;
        };
        return descriptor;
    };
}
// ── Decorator: @Ref() ─────────────────────────────────────────────────────────
function Ref() {
    return function (target, key) {
        Object.defineProperty(target, key, {
            get: function () { var _a; return (_a = this.querySelector("[data-ref=\"".concat(key, "\"]"))) !== null && _a !== void 0 ? _a : null; },
            enumerable: true,
            configurable: true,
        });
    };
}
// ── Internal helpers ──────────────────────────────────────────────────────────
function _resolveRefs(el) {
    el.querySelectorAll('[data-ref]').forEach(function (ref) {
        var key = ref.getAttribute('data-ref');
        if (key && key in el)
            el[key] = ref;
    });
}
// ── Window registration ───────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'Component', {
        value: _cFactory,
        writable: false,
        enumerable: false,
        configurable: false,
    });
}
exports.default = Component;
