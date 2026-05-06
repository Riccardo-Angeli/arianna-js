/**
 * @module    PaletteMaterials
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Material browser + property editor. Two modes side-by-side:
 *
 *   ┌──────────┬──────────────────────┐
 *   │ Library  │ Properties           │
 *   ├──────────┼──────────────────────┤
 *   │ ▣ Metal  │ Name [Brushed Steel] │
 *   │ ▣ Plast. │ Type [PBR Standard ▾]│
 *   │ ▣ Wood   │ Albedo  [#888888]    │
 *   │ ▣ Glass  │ Metalness    [0.85]  │
 *   │ + New    │ Roughness    [0.30]  │
 *   │          │ Emissive     [#000]  │
 *   │          │ Alpha        [1.00]  │
 *   │          │ Map: ───────────     │
 *   │          │   Albedo  [pick] ⊘   │
 *   │          │   Normal  [pick] ⊘   │
 *   │          │   Rough.  [pick] ⊘   │
 *   └──────────┴──────────────────────┘
 *
 * Built-in templates: Metal, Plastic, Wood, Glass, Emissive, Fabric, Stone.
 * The component is renderer-agnostic — emits `apply` events with the full
 * material spec; consumer (Three.js / WebGPU) maps to its real material.
 *
 * @example
 *   import { PaletteMaterials } from 'ariannajs/components/gfx3d';
 *
 *   const pm = new PaletteMaterials('#materials');
 *   pm.on('apply',  e => mesh.setMaterial(e.material));
 *   pm.on('change', e => mesh.updateMaterial(e.material));
 *
 *   const mat = pm.addMaterial({ name: 'Custom Brass', albedo: '#cd9b1d', metalness: 0.95 });
 *   pm.select(mat.id);
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export type MaterialKind = 'pbr-standard' | 'pbr-clearcoat' | 'unlit' | 'toon';

export interface MaterialSpec {
    id        : string;
    name      : string;
    kind      : MaterialKind;
    albedo    : string;        // hex
    metalness : number;        // 0..1
    roughness : number;        // 0..1
    emissive  : string;        // hex
    emissiveIntensity : number;
    alpha     : number;        // 0..1
    /** Optional texture map URLs; renderer interprets. */
    maps : {
        albedo?    : string;
        normal?    : string;
        roughness? : string;
        metalness? : string;
        emissive?  : string;
    };
}

export interface PaletteMaterialsOptions extends CtrlOptions {
    /** Initial library. */
    library? : MaterialSpec[];
    /** Pre-selected material id. */
    selected? : string;
    /** Title. Default 'Materials'. */
    title? : string;
}

// ── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Array<Omit<MaterialSpec, 'id'>> = [
    { name: 'Metal',    kind: 'pbr-standard', albedo: '#8a8a8a', metalness: 0.9,  roughness: 0.25, emissive: '#000', emissiveIntensity: 0, alpha: 1, maps: {} },
    { name: 'Plastic',  kind: 'pbr-standard', albedo: '#3b82f6', metalness: 0.05, roughness: 0.5,  emissive: '#000', emissiveIntensity: 0, alpha: 1, maps: {} },
    { name: 'Wood',     kind: 'pbr-standard', albedo: '#8b5a2b', metalness: 0.0,  roughness: 0.85, emissive: '#000', emissiveIntensity: 0, alpha: 1, maps: {} },
    { name: 'Glass',    kind: 'pbr-clearcoat', albedo: '#ffffff', metalness: 0.0, roughness: 0.05, emissive: '#000', emissiveIntensity: 0, alpha: 0.3, maps: {} },
    { name: 'Emissive', kind: 'unlit',        albedo: '#e40c88', metalness: 0.0,  roughness: 1.0,  emissive: '#e40c88', emissiveIntensity: 2.0, alpha: 1, maps: {} },
    { name: 'Fabric',   kind: 'pbr-standard', albedo: '#dc2626', metalness: 0.0,  roughness: 0.95, emissive: '#000', emissiveIntensity: 0, alpha: 1, maps: {} },
    { name: 'Stone',    kind: 'pbr-standard', albedo: '#525252', metalness: 0.0,  roughness: 0.8,  emissive: '#000', emissiveIntensity: 0, alpha: 1, maps: {} },
];

// ── Component ────────────────────────────────────────────────────────────────

export class PaletteMaterials extends Control<PaletteMaterialsOptions>
{
    private _library : MaterialSpec[] = [];
    private _selected: string | null  = null;
    private _nextId  = 1;

    private _elList!  : HTMLElement;
    private _elProps! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: PaletteMaterialsOptions = {})
    {
        super(container, 'div', { library: [], title: 'Materials', ...opts });
        this.el.className = `ar-palmat${opts.class ? ' ' + opts.class : ''}`;

        const lib = opts.library;
        if (lib === undefined)
        {
            // Not specified → seed with built-in templates so the panel isn't empty
            for (const t of TEMPLATES) this._library.push({ ...t, id: this._mkId(), maps: { ...t.maps } });
        }
        else
        {
            // Explicitly provided (even if empty) → respect caller
            this._library = lib.map(m => ({ ...m, maps: { ...m.maps } }));
        }

        this._injectStyles();
        this._build();

        const initSel = this._get<string>('selected', '');
        this.select(initSel || this._library[0]?.id || null);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Library (deep-cloned). */
    getLibrary(): MaterialSpec[] { return this._library.map(m => ({ ...m, maps: { ...m.maps } })); }

    /** Currently selected material (deep-cloned), or null. */
    getSelected(): MaterialSpec | null
    {
        if (!this._selected) return null;
        const m = this._library.find(x => x.id === this._selected);
        return m ? { ...m, maps: { ...m.maps } } : null;
    }

    /** Select a material by id, or pass null to deselect. */
    select(id: string | null): this
    {
        this._selected = id;
        this._renderList();
        this._renderProps();
        const m = this.getSelected();
        if (m) this._emit('apply', { id: m.id, material: m });
        return this;
    }

    /** Add a new material to the library (returns the created spec). */
    addMaterial(partial: Partial<MaterialSpec> = {}): MaterialSpec
    {
        const m: MaterialSpec = {
            id        : this._mkId(),
            name      : partial.name ?? 'New Material',
            kind      : partial.kind ?? 'pbr-standard',
            albedo    : partial.albedo ?? '#888888',
            metalness : partial.metalness ?? 0,
            roughness : partial.roughness ?? 0.5,
            emissive  : partial.emissive ?? '#000000',
            emissiveIntensity: partial.emissiveIntensity ?? 0,
            alpha     : partial.alpha ?? 1,
            maps      : { ...(partial.maps ?? {}) },
        };
        this._library.push(m);
        this._renderList();
        this._emit('add', { id: m.id, material: m });
        return m;
    }

    /** Update properties of an existing material. */
    updateMaterial(id: string, patch: Partial<MaterialSpec>): this
    {
        const i = this._library.findIndex(m => m.id === id);
        if (i < 0) return this;
        const cur = this._library[i]!;
        const updated: MaterialSpec = {
            ...cur, ...patch,
            maps: { ...cur.maps, ...(patch.maps ?? {}) },
        };
        this._library[i] = updated;
        this._renderList();
        if (this._selected === id) this._renderProps();
        this._emit('change', { id, material: updated });
        return this;
    }

    /** Remove a material. If it was selected, selection is cleared. */
    removeMaterial(id: string): this
    {
        const i = this._library.findIndex(m => m.id === id);
        if (i < 0) return this;
        this._library.splice(i, 1);
        if (this._selected === id) this._selected = null;
        this._renderList();
        this._renderProps();
        this._emit('remove', { id });
        return this;
    }

    /** All built-in template names — useful for "From template" dropdowns. */
    static getTemplates(): ReadonlyArray<Omit<MaterialSpec, 'id'>>
    {
        return TEMPLATES.map(t => ({ ...t, maps: { ...t.maps } }));
    }

    // ── Internal ───────────────────────────────────────────────────────────

    private _mkId(): string { return `mat-${this._nextId++}`; }

    protected _build(): void
    {
        this.el.innerHTML = `
<div class="ar-palmat__head">
  <span class="ar-palmat__title">${escapeHtml(this._get<string>('title', 'Materials'))}</span>
</div>
<div class="ar-palmat__body">
  <div class="ar-palmat__library" data-r="library"></div>
  <div class="ar-palmat__props"   data-r="props"></div>
</div>
<div class="ar-palmat__footer">
  <button class="ar-palmat__btn" data-act="new">+ New</button>
  <button class="ar-palmat__btn ar-palmat__btn--danger" data-act="remove">× Delete</button>
</div>
`;
        this._elList  = this.el.querySelector<HTMLElement>('[data-r="library"]')!;
        this._elProps = this.el.querySelector<HTMLElement>('[data-r="props"]')!;

        this.el.querySelector('[data-act="new"]')?.addEventListener('click',
            () => { const m = this.addMaterial(); this.select(m.id); });
        this.el.querySelector('[data-act="remove"]')?.addEventListener('click',
            () => { if (this._selected) this.removeMaterial(this._selected); });

        this._renderList();
    }

    private _renderList(): void
    {
        this._elList.innerHTML = '';
        for (const m of this._library)
        {
            const item = document.createElement('div');
            item.className = 'ar-palmat__item' + (m.id === this._selected ? ' ar-palmat__item--selected' : '');
            item.dataset.id = m.id;
            item.innerHTML = `
<div class="ar-palmat__swatch" style="background:${m.albedo}"></div>
<span class="ar-palmat__item-name">${escapeHtml(m.name)}</span>
`;
            item.addEventListener('click', () => this.select(m.id));
            this._elList.appendChild(item);
        }
    }

    private _renderProps(): void
    {
        const m = this._selected ? this._library.find(x => x.id === this._selected) : null;
        if (!m)
        {
            this._elProps.innerHTML = `<div class="ar-palmat__empty">No material selected</div>`;
            return;
        }

        this._elProps.innerHTML = `
<div class="ar-palmat__prop">
  <label>Name</label>
  <input data-prop="name"  type="text"   value="${escapeHtml(m.name)}">
</div>
<div class="ar-palmat__prop">
  <label>Type</label>
  <select data-prop="kind">
    <option value="pbr-standard"${m.kind==='pbr-standard'?' selected':''}>PBR Standard</option>
    <option value="pbr-clearcoat"${m.kind==='pbr-clearcoat'?' selected':''}>PBR Clearcoat</option>
    <option value="unlit"${m.kind==='unlit'?' selected':''}>Unlit</option>
    <option value="toon"${m.kind==='toon'?' selected':''}>Toon</option>
  </select>
</div>
<div class="ar-palmat__prop">
  <label>Albedo</label>
  <input data-prop="albedo"   type="color"  value="${m.albedo}">
</div>
<div class="ar-palmat__prop">
  <label>Metalness</label>
  <input data-prop="metalness" type="number" min="0" max="1" step="0.01" value="${m.metalness}">
</div>
<div class="ar-palmat__prop">
  <label>Roughness</label>
  <input data-prop="roughness" type="number" min="0" max="1" step="0.01" value="${m.roughness}">
</div>
<div class="ar-palmat__prop">
  <label>Emissive</label>
  <input data-prop="emissive"  type="color"  value="${m.emissive}">
</div>
<div class="ar-palmat__prop">
  <label>Em.Intensity</label>
  <input data-prop="emissiveIntensity" type="number" min="0" max="10" step="0.1" value="${m.emissiveIntensity}">
</div>
<div class="ar-palmat__prop">
  <label>Alpha</label>
  <input data-prop="alpha" type="number" min="0" max="1" step="0.01" value="${m.alpha}">
</div>
<div class="ar-palmat__sep">Texture maps</div>
${this._mapField('Albedo',    'albedo',    m.maps.albedo)}
${this._mapField('Normal',    'normal',    m.maps.normal)}
${this._mapField('Roughness', 'roughness', m.maps.roughness)}
${this._mapField('Metalness', 'metalness', m.maps.metalness)}
${this._mapField('Emissive',  'emissive',  m.maps.emissive)}
`;

        // Wire scalar inputs
        const props: Array<keyof MaterialSpec> = ['name','kind','albedo','metalness','roughness','emissive','emissiveIntensity','alpha'];
        for (const p of props)
        {
            const inp = this._elProps.querySelector<HTMLInputElement>(`[data-prop="${p}"]`);
            if (!inp) continue;
            inp.addEventListener('change', () => {
                const raw = inp.value;
                const v: unknown = inp.type === 'number' ? parseFloat(raw) || 0 : raw;
                this.updateMaterial(m.id, { [p]: v } as Partial<MaterialSpec>);
            });
        }
        // Wire map inputs
        for (const k of ['albedo','normal','roughness','metalness','emissive'] as const)
        {
            const inp = this._elProps.querySelector<HTMLInputElement>(`[data-map="${k}"]`);
            if (!inp) continue;
            inp.addEventListener('change', () => {
                const newMaps = { ...m.maps, [k]: inp.value };
                this.updateMaterial(m.id, { maps: newMaps });
            });
            const clear = this._elProps.querySelector<HTMLButtonElement>(`[data-map-clear="${k}"]`);
            clear?.addEventListener('click', () => {
                const newMaps = { ...m.maps, [k]: undefined };
                this.updateMaterial(m.id, { maps: newMaps });
            });
        }
    }

    private _mapField(label: string, key: string, value: string | undefined): string
    {
        return `
<div class="ar-palmat__prop ar-palmat__prop--map">
  <label>${escapeHtml(label)}</label>
  <input data-map="${key}" type="text" placeholder="(no map)" value="${escapeHtml(value || '')}">
  <button class="ar-palmat__map-clear" data-map-clear="${key}" title="Clear">⊘</button>
</div>`;
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-palmat-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-palmat-styles';
        s.textContent = `
.ar-palmat { display:flex; flex-direction:column; min-width:480px; background:#1e1e1e; border:1px solid #333; border-radius:6px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; user-select:none; }
.ar-palmat__head { padding:8px 12px; border-bottom:1px solid #333; }
.ar-palmat__title { font:600 12px sans-serif; color:#e40c88; letter-spacing:.04em; text-transform:uppercase; }
.ar-palmat__body { display:flex; flex:1; min-height:300px; max-height:520px; }
.ar-palmat__library { width:160px; border-right:1px solid #333; overflow:auto; padding:4px; display:flex; flex-direction:column; gap:2px; }
.ar-palmat__item { display:flex; align-items:center; gap:8px; padding:4px 8px; cursor:pointer; border-radius:3px; }
.ar-palmat__item:hover { background:#2a2a2a; }
.ar-palmat__item--selected { background:rgba(228,12,136,0.2); border-left:2px solid #e40c88; }
.ar-palmat__swatch { width:24px; height:24px; border-radius:3px; border:1px solid #444; flex-shrink:0; }
.ar-palmat__item-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ar-palmat__props { flex:1; overflow:auto; padding:8px; display:flex; flex-direction:column; gap:6px; }
.ar-palmat__prop { display:flex; align-items:center; gap:8px; }
.ar-palmat__prop label { width:90px; font:10px ui-monospace,monospace; color:#888; flex-shrink:0; }
.ar-palmat__prop input, .ar-palmat__prop select { flex:1; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:3px 6px; font:11px ui-monospace,monospace; border-radius:2px; }
.ar-palmat__prop input[type="color"] { width:40px; flex:none; padding:0; cursor:pointer; height:22px; }
.ar-palmat__prop--map input { font:10px ui-monospace,monospace; }
.ar-palmat__map-clear { background:transparent; border:1px solid #444; color:#888; padding:2px 6px; font-size:11px; cursor:pointer; border-radius:2px; flex:none; }
.ar-palmat__map-clear:hover { background:#dc2626; border-color:#dc2626; color:#fff; }
.ar-palmat__sep { font:10px sans-serif; color:#888; text-transform:uppercase; padding-top:8px; padding-bottom:2px; border-top:1px solid #333; margin-top:4px; }
.ar-palmat__empty { padding:20px; text-align:center; color:#666; }
.ar-palmat__footer { padding:6px; border-top:1px solid #333; display:flex; gap:4px; }
.ar-palmat__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:4px 10px; font:11px sans-serif; border-radius:3px; cursor:pointer; }
.ar-palmat__btn:hover { background:#2a2a2a; }
.ar-palmat__btn--danger:hover { background:#dc2626; border-color:#dc2626; color:#fff; }
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
