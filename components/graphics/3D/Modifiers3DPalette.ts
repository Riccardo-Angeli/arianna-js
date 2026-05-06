/**
 * @module    PaletteModifiers3D
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Blender-style modifier-stack panel for 3D objects. Lists the currently
 * applied modifiers on a target object plus an "+ Add modifier" picker.
 *
 *   ┌─────────────────────────┐
 *   │ Modifiers               │
 *   ├─────────────────────────┤
 *   │ ▼ 🔁 Array               × │
 *   │   count       [ 5 ]      │
 *   │   offset      [ 1.0 ]    │
 *   ├─────────────────────────┤
 *   │ ▼ 🌀 Twist                × │
 *   │   angle       [ 90° ]    │
 *   ├─────────────────────────┤
 *   │ + Add modifier        ▾ │
 *   └─────────────────────────┘
 *
 * The panel is renderer-agnostic. It presents the catalogue, the stack, and
 * fires events; consumer code (Three.js / Wires / Daedalus) listens and
 * applies the actual mesh transformations.
 *
 * Built-in catalogue mirrors the 15 modifiers in `components/modifiers/3D/`:
 * Array, Bend, Bevel, Billboard, Decimate, Drag, Fade, Inflate, LOD, Mirror,
 * Smooth, Snap, Subdivision, Twist, Wave.
 *
 * @example
 *   import { PaletteModifiers3D } from 'ariannajs/components/gfx3d';
 *
 *   const pm = new PaletteModifiers3D('#mods');
 *   pm.on('add',     e => mesh.applyModifier(e.kind, e.params));
 *   pm.on('remove',  e => mesh.removeModifier(e.id));
 *   pm.on('update',  e => mesh.updateModifier(e.id, e.params));
 *   pm.on('reorder', e => mesh.reorderModifierStack(e.fromIndex, e.toIndex));
 *
 *   pm.addModifier('array', { count: 5, offset: 1.0 });
 *   pm.addModifier('twist', { angle: 90 });
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Catalogue ────────────────────────────────────────────────────────────────

export type ModifierKind =
    | 'array' | 'bend' | 'bevel' | 'billboard' | 'decimate' | 'drag'
    | 'fade'  | 'inflate' | 'lod' | 'mirror' | 'smooth' | 'snap'
    | 'subdivision' | 'twist' | 'wave';

interface ParamSpec {
    key   : string;
    label : string;
    type  : 'number' | 'angle' | 'enum' | 'boolean' | 'vec3';
    min?  : number;
    max?  : number;
    step? : number;
    options? : string[];
    /** Default value when the modifier is added. */
    default : unknown;
}

interface ModSpec {
    kind  : ModifierKind;
    label : string;
    icon  : string;
    params: ParamSpec[];
}

const CATALOGUE: ModSpec[] = [
    { kind: 'array',     label: 'Array',     icon: '🔁',
      params: [
          { key: 'count',  label: 'Count',  type: 'number', min: 1, max: 100, step: 1, default: 3 },
          { key: 'offset', label: 'Offset', type: 'number', min: 0, max: 100, step: 0.1, default: 1 },
          { key: 'axis',   label: 'Axis',   type: 'enum', options: ['X', 'Y', 'Z'], default: 'X' },
      ] },
    { kind: 'bend',      label: 'Bend',      icon: '↩',
      params: [
          { key: 'angle', label: 'Angle', type: 'angle',  min: -360, max: 360, step: 1, default: 90 },
          { key: 'axis',  label: 'Axis',  type: 'enum',   options: ['X', 'Y', 'Z'], default: 'Y' },
      ] },
    { kind: 'bevel',     label: 'Bevel',     icon: '◆',
      params: [
          { key: 'width',     label: 'Width',     type: 'number', min: 0, max: 1, step: 0.01, default: 0.05 },
          { key: 'segments',  label: 'Segments',  type: 'number', min: 1, max: 16, step: 1,   default: 2 },
      ] },
    { kind: 'billboard', label: 'Billboard', icon: '🪧',
      params: [
          { key: 'lockY', label: 'Lock Y', type: 'boolean', default: false },
      ] },
    { kind: 'decimate',  label: 'Decimate',  icon: '▽',
      params: [
          { key: 'ratio', label: 'Ratio', type: 'number', min: 0.01, max: 1, step: 0.01, default: 0.5 },
      ] },
    { kind: 'drag',      label: 'Drag',      icon: '🌬',
      params: [
          { key: 'damping', label: 'Damping', type: 'number', min: 0, max: 1, step: 0.01, default: 0.1 },
      ] },
    { kind: 'fade',      label: 'Fade',      icon: '◐',
      params: [
          { key: 'distance', label: 'Distance', type: 'number', min: 0, max: 1000, step: 1, default: 50 },
      ] },
    { kind: 'inflate',   label: 'Inflate',   icon: '🎈',
      params: [
          { key: 'amount', label: 'Amount', type: 'number', min: -1, max: 1, step: 0.01, default: 0.1 },
      ] },
    { kind: 'lod',       label: 'LOD',       icon: '🔍',
      params: [
          { key: 'levels',   label: 'Levels',   type: 'number', min: 1, max: 8, step: 1, default: 3 },
          { key: 'distance', label: 'Distance', type: 'number', min: 1, max: 1000, step: 1, default: 100 },
      ] },
    { kind: 'mirror',    label: 'Mirror',    icon: '⟷',
      params: [
          { key: 'axis',  label: 'Axis',  type: 'enum',    options: ['X', 'Y', 'Z'], default: 'X' },
          { key: 'merge', label: 'Merge', type: 'boolean', default: true },
      ] },
    { kind: 'smooth',    label: 'Smooth',    icon: '◎',
      params: [
          { key: 'iterations', label: 'Iter',  type: 'number', min: 1, max: 16, step: 1, default: 1 },
          { key: 'factor',     label: 'Factor', type: 'number', min: 0, max: 1, step: 0.05, default: 0.5 },
      ] },
    { kind: 'snap',      label: 'Snap',      icon: '🔗',
      params: [
          { key: 'distance', label: 'Distance', type: 'number', min: 0.001, max: 10, step: 0.001, default: 0.01 },
      ] },
    { kind: 'subdivision', label: 'Subdivision', icon: '⊞',
      params: [
          { key: 'levels', label: 'Levels', type: 'number', min: 1, max: 6, step: 1, default: 2 },
      ] },
    { kind: 'twist',     label: 'Twist',     icon: '🌀',
      params: [
          { key: 'angle', label: 'Angle', type: 'angle', min: -720, max: 720, step: 1, default: 180 },
          { key: 'axis',  label: 'Axis',  type: 'enum',  options: ['X','Y','Z'], default: 'Y' },
      ] },
    { kind: 'wave',      label: 'Wave',      icon: '〰',
      params: [
          { key: 'amplitude', label: 'Amp',  type: 'number', min: 0, max: 1, step: 0.01, default: 0.1 },
          { key: 'frequency', label: 'Freq', type: 'number', min: 0, max: 20, step: 0.1, default: 1 },
      ] },
];

// ── Stack item ───────────────────────────────────────────────────────────────

export interface StackItem {
    id     : string;
    kind   : ModifierKind;
    enabled: boolean;
    params : Record<string, unknown>;
    expanded: boolean;
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface PaletteModifiers3DOptions extends CtrlOptions {
    /** Initial stack. */
    stack? : StackItem[];
    /** Title. Default 'Modifiers'. */
    title? : string;
}

// ── Component ────────────────────────────────────────────────────────────────

export class PaletteModifiers3D extends Control<PaletteModifiers3DOptions>
{
    private _stack  : StackItem[] = [];
    private _nextId = 1;

    private _elList!  : HTMLElement;
    private _elFooter!: HTMLElement;

    constructor(container: string | HTMLElement | null, opts: PaletteModifiers3DOptions = {})
    {
        super(container, 'div', { stack: [], title: 'Modifiers', ...opts });
        this.el.className = `ar-palmod${opts.class ? ' ' + opts.class : ''}`;
        this._stack = (this._get<StackItem[]>('stack', []) || []).map(s => ({ ...s, params: { ...s.params } }));
        this._injectStyles();
        this._build();
        this._renderStack();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Get current stack (deep cloned). */
    getStack(): StackItem[] { return this._stack.map(s => ({ ...s, params: { ...s.params } })); }

    /** Add a modifier to the bottom of the stack. */
    addModifier(kind: ModifierKind, params: Record<string, unknown> = {}): StackItem
    {
        const spec = CATALOGUE.find(c => c.kind === kind);
        if (!spec) throw new Error(`unknown modifier kind: ${kind}`);

        const defaults: Record<string, unknown> = {};
        for (const p of spec.params) defaults[p.key] = p.default;

        const item: StackItem = {
            id      : `mod-${this._nextId++}`,
            kind,
            enabled : true,
            params  : { ...defaults, ...params },
            expanded: true,
        };
        this._stack.push(item);
        this._renderStack();
        this._emit('add', { id: item.id, kind, params: item.params, index: this._stack.length - 1 });
        return item;
    }

    /** Remove a modifier by id. */
    removeModifier(id: string): this
    {
        const i = this._stack.findIndex(s => s.id === id);
        if (i < 0) return this;
        this._stack.splice(i, 1);
        this._renderStack();
        this._emit('remove', { id, index: i });
        return this;
    }

    /** Update a modifier's params. */
    updateParams(id: string, patch: Record<string, unknown>): this
    {
        const item = this._stack.find(s => s.id === id);
        if (!item) return this;
        item.params = { ...item.params, ...patch };
        this._renderStack();
        this._emit('update', { id, params: item.params });
        return this;
    }

    /** Toggle enabled flag (consumer can hide effect without removing item). */
    setEnabled(id: string, enabled: boolean): this
    {
        const item = this._stack.find(s => s.id === id);
        if (!item) return this;
        item.enabled = enabled;
        this._renderStack();
        this._emit('toggle', { id, enabled });
        return this;
    }

    /** Reorder a modifier within the stack. */
    reorder(id: string, toIndex: number): this
    {
        const i = this._stack.findIndex(s => s.id === id);
        if (i < 0) return this;
        const [item] = this._stack.splice(i, 1);
        const clamped = Math.max(0, Math.min(toIndex, this._stack.length));
        this._stack.splice(clamped, 0, item!);
        this._renderStack();
        this._emit('reorder', { id, fromIndex: i, toIndex: clamped });
        return this;
    }

    /** Catalogue of all available modifiers. */
    static getCatalogue(): ReadonlyArray<{ kind: ModifierKind; label: string; icon: string }>
    {
        return CATALOGUE.map(c => ({ kind: c.kind, label: c.label, icon: c.icon }));
    }

    // ── Build + render ─────────────────────────────────────────────────────

    protected _build(): void
    {
        this.el.innerHTML = `
<div class="ar-palmod__head">
  <span class="ar-palmod__title">${escapeHtml(this._get<string>('title', 'Modifiers'))}</span>
</div>
<div class="ar-palmod__list" data-r="list"></div>
<div class="ar-palmod__footer" data-r="footer">
  <select class="ar-palmod__sel" data-r="sel">
    <option value="">+ Add modifier</option>
    ${CATALOGUE.map(c => `<option value="${c.kind}">${c.icon} ${c.label}</option>`).join('')}
  </select>
</div>`;
        this._elList   = this.el.querySelector<HTMLElement>('[data-r="list"]')!;
        this._elFooter = this.el.querySelector<HTMLElement>('[data-r="footer"]')!;

        const sel = this._elFooter.querySelector<HTMLSelectElement>('[data-r="sel"]')!;
        sel.addEventListener('change', () => {
            if (!sel.value) return;
            this.addModifier(sel.value as ModifierKind);
            sel.value = '';
        });
    }

    private _renderStack(): void
    {
        this._elList.innerHTML = '';
        for (const item of this._stack)
        {
            const spec = CATALOGUE.find(c => c.kind === item.kind)!;
            const card = document.createElement('div');
            card.className = 'ar-palmod__card' + (item.enabled ? '' : ' ar-palmod__card--off');
            card.dataset.id = item.id;

            const head = document.createElement('div');
            head.className = 'ar-palmod__card-head';
            head.innerHTML = `
<span class="ar-palmod__chev" data-act="exp">${item.expanded ? '▼' : '▶'}</span>
<span class="ar-palmod__icon">${escapeHtml(spec.icon)}</span>
<span class="ar-palmod__name">${escapeHtml(spec.label)}</span>
<span class="ar-palmod__spacer"></span>
<button class="ar-palmod__btn" data-act="vis" title="Toggle">${item.enabled ? '👁' : '⊘'}</button>
<button class="ar-palmod__btn" data-act="up"  title="Move up">▲</button>
<button class="ar-palmod__btn" data-act="dn"  title="Move down">▼</button>
<button class="ar-palmod__btn ar-palmod__btn--danger" data-act="rm" title="Remove">×</button>
`;
            card.appendChild(head);

            // Params body (only if expanded)
            if (item.expanded)
            {
                const body = document.createElement('div');
                body.className = 'ar-palmod__card-body';
                for (const p of spec.params)
                {
                    body.appendChild(this._buildParamRow(item, p));
                }
                card.appendChild(body);
            }

            this._wireCard(card, item);
            this._elList.appendChild(card);
        }
    }

    private _buildParamRow(item: StackItem, p: ParamSpec): HTMLElement
    {
        const row = document.createElement('div');
        row.className = 'ar-palmod__row';
        const lbl = document.createElement('label');
        lbl.className = 'ar-palmod__lbl';
        lbl.textContent = p.label;
        row.appendChild(lbl);

        let inp: HTMLElement;
        const cur = item.params[p.key];

        if (p.type === 'enum')
        {
            const sel = document.createElement('select');
            sel.className = 'ar-palmod__inp';
            for (const o of p.options || []) {
                const opt = document.createElement('option');
                opt.value = o; opt.textContent = o;
                if (cur === o) opt.selected = true;
                sel.appendChild(opt);
            }
            sel.addEventListener('change', () => this.updateParams(item.id, { [p.key]: sel.value }));
            inp = sel;
        }
        else if (p.type === 'boolean')
        {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!cur;
            cb.addEventListener('change', () => this.updateParams(item.id, { [p.key]: cb.checked }));
            inp = cb;
        }
        else
        {
            const n = document.createElement('input');
            n.type = 'number';
            n.className = 'ar-palmod__inp';
            n.value = String(cur ?? 0);
            if (p.min !== undefined)  n.min  = String(p.min);
            if (p.max !== undefined)  n.max  = String(p.max);
            if (p.step !== undefined) n.step = String(p.step);
            n.addEventListener('change', () => this.updateParams(item.id, { [p.key]: parseFloat(n.value) || 0 }));
            inp = n;
        }
        row.appendChild(inp);
        return row;
    }

    private _wireCard(card: HTMLElement, item: StackItem): void
    {
        card.querySelector('[data-act="exp"]')?.addEventListener('click', () => {
            item.expanded = !item.expanded;
            this._renderStack();
        });
        card.querySelector('[data-act="vis"]')?.addEventListener('click', () => {
            this.setEnabled(item.id, !item.enabled);
        });
        card.querySelector('[data-act="rm"]')?.addEventListener('click', () => {
            this.removeModifier(item.id);
        });
        card.querySelector('[data-act="up"]')?.addEventListener('click', () => {
            const i = this._stack.findIndex(s => s.id === item.id);
            if (i > 0) this.reorder(item.id, i - 1);
        });
        card.querySelector('[data-act="dn"]')?.addEventListener('click', () => {
            const i = this._stack.findIndex(s => s.id === item.id);
            if (i < this._stack.length - 1) this.reorder(item.id, i + 1);
        });
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-palmod-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-palmod-styles';
        s.textContent = `
.ar-palmod { display:flex; flex-direction:column; min-width:280px; background:#1e1e1e; border:1px solid #333; border-radius:6px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; user-select:none; }
.ar-palmod__head { padding:8px 12px; border-bottom:1px solid #333; }
.ar-palmod__title { font:600 12px sans-serif; color:#e40c88; letter-spacing:.04em; text-transform:uppercase; }
.ar-palmod__list { flex:1; overflow:auto; max-height:480px; padding:4px; display:flex; flex-direction:column; gap:4px; }
.ar-palmod__card { background:#252525; border:1px solid #333; border-radius:4px; }
.ar-palmod__card--off { opacity:0.5; }
.ar-palmod__card-head { display:flex; align-items:center; gap:6px; padding:6px 8px; border-bottom:1px solid #333; }
.ar-palmod__card:not(:has(.ar-palmod__card-body)) > .ar-palmod__card-head { border-bottom:0; }
.ar-palmod__chev { font-size:9px; color:#888; cursor:pointer; width:12px; }
.ar-palmod__icon { font-size:14px; }
.ar-palmod__name { font:600 12px sans-serif; }
.ar-palmod__spacer { flex:1; }
.ar-palmod__btn { background:transparent; border:0; color:#888; cursor:pointer; padding:2px 6px; font-size:12px; border-radius:2px; }
.ar-palmod__btn:hover { background:#333; color:#fff; }
.ar-palmod__btn--danger:hover { background:#dc2626; color:#fff; }
.ar-palmod__card-body { padding:6px 8px; display:flex; flex-direction:column; gap:4px; }
.ar-palmod__row { display:flex; align-items:center; gap:8px; }
.ar-palmod__lbl { min-width:60px; font:10px ui-monospace,monospace; color:#888; }
.ar-palmod__inp { flex:1; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:3px 6px; font:11px ui-monospace,monospace; border-radius:2px; }
.ar-palmod__footer { padding:8px; border-top:1px solid #333; }
.ar-palmod__sel { width:100%; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:5px 8px; font:11px sans-serif; border-radius:3px; cursor:pointer; }
.ar-palmod__sel:hover { border-color:#e40c88; }
`;
        document.head.appendChild(s);
    }
}

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}
