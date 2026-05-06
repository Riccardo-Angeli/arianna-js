/**
 * @module    LayersPanel
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026 All Rights Reserved
 *
 * Photoshop / Illustrator-style layers panel for SVG documents and any
 * hierarchical scene graph. Provides:
 *
 *   • Hierarchical tree of layers and groups (arbitrary depth)
 *   • Visibility toggle per layer (eye icon)
 *   • Lock toggle per layer (padlock)
 *   • Inline rename (double-click)
 *   • Add / delete / duplicate / group / ungroup
 *   • Reorder via drag & drop (within parent or across groups)
 *   • Single + multi-selection (shift-click range, cmd/ctrl-click toggle)
 *   • Thumbnails (optional — caller-supplied via `thumbnail` field)
 *   • Active layer indicator (thicker outline)
 *
 *   ─────────────────
 *   👁 🔒 ▼ Background
 *   👁 🔒   ▶ Group A
 *   👁 🔒     • Path 1
 *   👁 🔒     • Path 2
 *   👁 🔒 • Image
 *   ─────────────────
 *
 * The component owns the *tree* (its own data model) and emits structural
 * events on every change. Consumers map the tree to their own scene (SVG,
 * Canvas, etc.) by listening to `change` and walking `getTree()`.
 *
 * @example
 *   import { LayersPanel } from 'ariannajs/components/gfx2d';
 *
 *   const lp = new LayersPanel('#layers');
 *   lp.addLayer({ name: 'Background' });
 *   const g = lp.addGroup({ name: 'Logo' });
 *   lp.addLayer({ name: 'Path 1', parentId: g.id });
 *   lp.addLayer({ name: 'Path 2', parentId: g.id });
 *
 *   lp.on('change',    e => syncSvgFromTree(lp.getTree(), e));
 *   lp.on('select',    e => highlightInCanvas(e.ids));
 *   lp.on('reorder',   e => reorderSvgChildren(e.movedId, e.newParentId, e.newIndex));
 *
 *   // External code can drive selection back into the panel
 *   lp.select(['layer-3']);
 */

import { Control, type CtrlOptions } from '../../core/Control.ts';

// ── Data model ───────────────────────────────────────────────────────────────

export type LayerKind = 'layer' | 'group';

export interface LayerNode {
    id        : string;
    kind      : LayerKind;
    name      : string;
    visible   : boolean;
    locked    : boolean;
    expanded  : boolean;            // groups only
    /** Optional caller-supplied data URL for the thumbnail. */
    thumbnail?: string;
    /** For groups: ordered children. Undefined for plain layers. */
    children? : LayerNode[];
}

export interface LayersPanelOptions extends CtrlOptions {
    /** Initial tree. Default empty. */
    tree?       : LayerNode[];
    /** Show thumbnails column. Default false. */
    thumbnails? : boolean;
    /** Header title. Default 'Layers'. */
    title?      : string;
    /** Disable add/delete/duplicate/group/ungroup buttons. Default false. */
    readonly?   : boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export class LayersPanel extends Control<LayersPanelOptions>
{
    private _tree     : LayerNode[] = [];
    private _selected : Set<string> = new Set();
    private _active?  : string;                 // anchor for shift-range selection
    private _nextId   = 1;

    // DOM
    private _elList!   : HTMLElement;
    private _elFooter? : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: LayersPanelOptions = {})
    {
        super(container, 'div', {
            tree       : [],
            thumbnails : false,
            title      : 'Layers',
            readonly   : false,
            ...opts,
        });

        this.el.className = `ar-layers${opts.class ? ' ' + opts.class : ''}`;
        this._tree = this._cloneTree(this._get<LayerNode[]>('tree', []));
        this._injectStyles();
        this._build();
        this._render();
    }

    // ── Public API: tree ops ───────────────────────────────────────────────

    /** Returns a deep clone of the current tree (safe to mutate). */
    getTree(): LayerNode[] { return this._cloneTree(this._tree); }

    /** Replace the whole tree. */
    setTree(tree: LayerNode[]): this
    {
        this._tree = this._cloneTree(tree);
        this._render();
        this._emitChange({ kind: 'set-tree' });
        return this;
    }

    /** Add a new layer. If `parentId` is given, appends inside that group. */
    addLayer(opts: Partial<LayerNode> & { parentId?: string } = {}): LayerNode
    {
        const node: LayerNode = this._mkNode('layer', opts);
        this._insertNode(node, opts.parentId);
        this._render();
        this._emitChange({ kind: 'add', node });
        return node;
    }

    /** Add a new (initially empty) group. */
    addGroup(opts: Partial<LayerNode> & { parentId?: string } = {}): LayerNode
    {
        const node: LayerNode = this._mkNode('group', opts);
        node.children = [];
        node.expanded = opts.expanded ?? true;
        this._insertNode(node, opts.parentId);
        this._render();
        this._emitChange({ kind: 'add', node });
        return node;
    }

    /** Remove a node by id (removes group's children too). */
    remove(id: string): this
    {
        const removed = this._removeFromTree(id);
        if (removed)
        {
            this._selected.delete(id);
            this._render();
            this._emitChange({ kind: 'remove', id });
        }
        return this;
    }

    /** Remove all currently selected nodes. */
    removeSelected(): this
    {
        const ids = [...this._selected];
        for (const id of ids) this._removeFromTree(id);
        this._selected.clear();
        this._render();
        this._emitChange({ kind: 'remove-many', ids });
        return this;
    }

    /** Duplicate a node (and its children if it's a group). */
    duplicate(id: string): LayerNode | null
    {
        const found = this._findWithParent(id);
        if (!found) return null;
        const clone = this._cloneNode(found.node);
        clone.id = this._mkId();
        clone.name = found.node.name + ' copy';
        // re-id all children of the clone
        if (clone.children) this._reidRecursive(clone.children);
        const arr = found.parent ? found.parent.children! : this._tree;
        arr.splice(found.index + 1, 0, clone);
        this._render();
        this._emitChange({ kind: 'duplicate', id, newNode: clone });
        return clone;
    }

    /** Group the selected nodes into a new group at the position of the first. */
    groupSelected(): LayerNode | null
    {
        const ids = [...this._selected];
        if (ids.length === 0) return null;

        const nodes: LayerNode[] = [];
        let firstParent: LayerNode | null = null;
        let firstIndex = Infinity;

        // Detach all selected nodes; remember insertion point
        for (const id of ids)
        {
            const f = this._findWithParent(id);
            if (!f) continue;
            const arr = f.parent ? f.parent.children! : this._tree;
            if (firstIndex === Infinity || (f.parent === firstParent && f.index < firstIndex))
            {
                firstParent = f.parent;
                firstIndex = f.index;
            }
            arr.splice(f.index, 1);
            nodes.push(f.node);
        }
        if (!nodes.length) return null;

        const grp: LayerNode = this._mkNode('group', { name: 'Group' });
        grp.children = nodes;
        grp.expanded = true;

        const target = firstParent ? firstParent.children! : this._tree;
        target.splice(Math.min(firstIndex, target.length), 0, grp);

        this._selected.clear();
        this._selected.add(grp.id);
        this._render();
        this._emitChange({ kind: 'group', groupId: grp.id, ids });
        return grp;
    }

    /** Ungroup a group: move children up one level. */
    ungroup(id: string): this
    {
        const f = this._findWithParent(id);
        if (!f || f.node.kind !== 'group' || !f.node.children) return this;
        const target = f.parent ? f.parent.children! : this._tree;
        target.splice(f.index, 1, ...f.node.children);
        this._selected.delete(id);
        this._render();
        this._emitChange({ kind: 'ungroup', id });
        return this;
    }

    /** Set visibility (eye toggle). Cascades to children when on a group. */
    setVisible(id: string, visible: boolean): this
    {
        const f = this._findWithParent(id);
        if (!f) return this;
        f.node.visible = visible;
        this._render();
        this._emitChange({ kind: 'visibility', id, visible });
        return this;
    }

    /** Set lock (padlock toggle). */
    setLocked(id: string, locked: boolean): this
    {
        const f = this._findWithParent(id);
        if (!f) return this;
        f.node.locked = locked;
        this._render();
        this._emitChange({ kind: 'lock', id, locked });
        return this;
    }

    /** Rename a node. */
    rename(id: string, name: string): this
    {
        const f = this._findWithParent(id);
        if (!f) return this;
        f.node.name = name;
        this._render();
        this._emitChange({ kind: 'rename', id, name });
        return this;
    }

    /** Toggle expand/collapse for a group. */
    toggleExpand(id: string): this
    {
        const f = this._findWithParent(id);
        if (!f || f.node.kind !== 'group') return this;
        f.node.expanded = !f.node.expanded;
        this._render();
        return this;
    }

    /** Replace selection. Pass [] to clear. */
    select(ids: string[]): this
    {
        this._selected = new Set(ids);
        if (ids.length > 0) this._active = ids[ids.length - 1];
        this._render();
        this._emit('select', { ids: [...this._selected] });
        return this;
    }

    /** Currently selected ids. */
    getSelection(): string[] { return [...this._selected]; }

    /**
     * Move a node into another parent at a given index. Used by drag-and-drop
     * but also exposed publicly so consumers can re-order programmatically.
     */
    move(id: string, newParentId: string | null, newIndex: number): this
    {
        const f = this._findWithParent(id);
        if (!f) return this;

        // Don't allow moving into self or own descendants
        if (newParentId)
        {
            if (id === newParentId) return this;
            if (this._isDescendant(newParentId, id)) return this;
        }

        const fromArr = f.parent ? f.parent.children! : this._tree;
        fromArr.splice(f.index, 1);

        const toParent = newParentId ? this._findWithParent(newParentId)?.node : null;
        const toArr = toParent && toParent.children ? toParent.children : this._tree;
        const clamped = Math.max(0, Math.min(newIndex, toArr.length));
        toArr.splice(clamped, 0, f.node);

        this._render();
        this._emitChange({ kind: 'reorder', movedId: id, newParentId, newIndex: clamped });
        this._emit('reorder', { movedId: id, newParentId, newIndex: clamped });
        return this;
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    private _mkId(): string { return `lp-${this._nextId++}`; }

    private _mkNode(kind: LayerKind, opts: Partial<LayerNode> = {}): LayerNode
    {
        return {
            id      : opts.id      ?? this._mkId(),
            kind,
            name    : opts.name    ?? (kind === 'group' ? 'Group' : 'Layer'),
            visible : opts.visible ?? true,
            locked  : opts.locked  ?? false,
            expanded: opts.expanded ?? true,
            thumbnail: opts.thumbnail,
        };
    }

    private _insertNode(node: LayerNode, parentId?: string): void
    {
        if (!parentId) { this._tree.push(node); return; }
        const f = this._findWithParent(parentId);
        if (f && f.node.kind === 'group')
        {
            f.node.children = f.node.children || [];
            f.node.children.push(node);
        }
        else
        {
            this._tree.push(node);
        }
    }

    private _removeFromTree(id: string): boolean
    {
        const f = this._findWithParent(id);
        if (!f) return false;
        const arr = f.parent ? f.parent.children! : this._tree;
        arr.splice(f.index, 1);
        return true;
    }

    /**
     * Walk the tree finding a node by id. Returns the node, its parent (null
     * if at root), and its index within the parent's children array.
     */
    private _findWithParent(id: string): { node: LayerNode; parent: LayerNode | null; index: number } | null
    {
        const search = (arr: LayerNode[], parent: LayerNode | null): ReturnType<LayersPanel['_findWithParent']> => {
            for (let i = 0; i < arr.length; i++)
            {
                const n = arr[i]!;
                if (n.id === id) return { node: n, parent, index: i };
                if (n.children)
                {
                    const r = search(n.children, n);
                    if (r) return r;
                }
            }
            return null;
        };
        return search(this._tree, null);
    }

    /** Is `descendantId` inside the subtree rooted at `ancestorId`? */
    private _isDescendant(descendantId: string, ancestorId: string): boolean
    {
        const f = this._findWithParent(ancestorId);
        if (!f || !f.node.children) return false;
        const walk = (arr: LayerNode[]): boolean => {
            for (const n of arr)
            {
                if (n.id === descendantId) return true;
                if (n.children && walk(n.children)) return true;
            }
            return false;
        };
        return walk(f.node.children);
    }

    private _cloneNode(n: LayerNode): LayerNode
    {
        const out: LayerNode = { ...n };
        if (n.children) out.children = n.children.map(c => this._cloneNode(c));
        return out;
    }

    private _cloneTree(tree: LayerNode[]): LayerNode[] { return tree.map(n => this._cloneNode(n)); }

    private _reidRecursive(arr: LayerNode[]): void
    {
        for (const n of arr)
        {
            n.id = this._mkId();
            if (n.children) this._reidRecursive(n.children);
        }
    }

    private _emitChange(detail: Record<string, unknown>): void
    {
        this._emit('change', detail);
    }

    /** Flat list of nodes in display order (for shift-range selection). */
    private _flatten(): LayerNode[]
    {
        const out: LayerNode[] = [];
        const walk = (arr: LayerNode[]): void => {
            for (const n of arr)
            {
                out.push(n);
                if (n.kind === 'group' && n.expanded && n.children) walk(n.children);
            }
        };
        walk(this._tree);
        return out;
    }

    // ── Build + render ─────────────────────────────────────────────────────

    protected _build(): void
    {
        const title = this._get<string>('title', 'Layers');
        const ro    = this._get<boolean>('readonly', false);

        this.el.innerHTML = `
<div class="ar-layers__head">
  <span class="ar-layers__title">${escapeHtml(title)}</span>
</div>
<div class="ar-layers__list" data-r="list"></div>
${ro ? '' : `
<div class="ar-layers__footer" data-r="footer">
  <button class="ar-layers__btn" data-act="add-layer"     title="Add layer">+ Layer</button>
  <button class="ar-layers__btn" data-act="add-group"     title="Add group">+ Group</button>
  <button class="ar-layers__btn" data-act="duplicate"     title="Duplicate">⎘</button>
  <button class="ar-layers__btn" data-act="group"         title="Group selected">⊞</button>
  <button class="ar-layers__btn" data-act="ungroup"       title="Ungroup">⊟</button>
  <button class="ar-layers__btn ar-layers__btn--danger" data-act="delete" title="Delete">×</button>
</div>`}`;

        this._elList = this.el.querySelector<HTMLElement>('[data-r="list"]')!;
        if (!ro)
        {
            this._elFooter = this.el.querySelector<HTMLElement>('[data-r="footer"]')!;
            this._elFooter.querySelector('[data-act="add-layer"]')!.addEventListener('click', () => this.addLayer());
            this._elFooter.querySelector('[data-act="add-group"]')!.addEventListener('click', () => this.addGroup());
            this._elFooter.querySelector('[data-act="duplicate"]')!.addEventListener('click', () => {
                for (const id of this._selected) this.duplicate(id);
            });
            this._elFooter.querySelector('[data-act="group"]')!  .addEventListener('click', () => this.groupSelected());
            this._elFooter.querySelector('[data-act="ungroup"]')!.addEventListener('click', () => {
                for (const id of this._selected) this.ungroup(id);
            });
            this._elFooter.querySelector('[data-act="delete"]')! .addEventListener('click', () => this.removeSelected());
        }
    }

    private _render(): void
    {
        this._elList.innerHTML = '';
        this._renderArr(this._tree, 0);
    }

    private _renderArr(arr: LayerNode[], depth: number): void
    {
        const showThumbs = this._get<boolean>('thumbnails', false);
        for (const n of arr)
        {
            const row = document.createElement('div');
            row.className = 'ar-layers__row' + (this._selected.has(n.id) ? ' ar-layers__row--selected' : '');
            row.dataset.id = n.id;
            row.draggable = true;
            row.style.paddingLeft = (8 + depth * 14) + 'px';

            const eye = `<span class="ar-layers__icon ar-layers__eye${n.visible ? '' : ' off'}" data-act="vis" title="Toggle visibility">${n.visible ? '👁' : '⊘'}</span>`;
            const lock = `<span class="ar-layers__icon ar-layers__lock${n.locked ? ' on' : ''}" data-act="lock" title="Toggle lock">${n.locked ? '🔒' : '🔓'}</span>`;
            const chevron = n.kind === 'group'
                ? `<span class="ar-layers__chev" data-act="exp">${n.expanded ? '▼' : '▶'}</span>`
                : `<span class="ar-layers__chev ar-layers__chev--leaf">•</span>`;
            const thumb = showThumbs && n.thumbnail
                ? `<img class="ar-layers__thumb" src="${n.thumbnail}" alt="">`
                : '';
            const name = `<span class="ar-layers__name" data-act="name">${escapeHtml(n.name)}</span>`;

            row.innerHTML = eye + lock + chevron + thumb + name;
            this._wireRow(row, n);
            this._elList.appendChild(row);

            if (n.kind === 'group' && n.expanded && n.children)
            {
                this._renderArr(n.children, depth + 1);
            }
        }
    }

    private _wireRow(row: HTMLElement, n: LayerNode): void
    {
        // Click handlers for icons
        row.querySelector('[data-act="vis"]')?.addEventListener('click', e => {
            e.stopPropagation();
            this.setVisible(n.id, !n.visible);
        });
        row.querySelector('[data-act="lock"]')?.addEventListener('click', e => {
            e.stopPropagation();
            this.setLocked(n.id, !n.locked);
        });
        row.querySelector('[data-act="exp"]')?.addEventListener('click', e => {
            e.stopPropagation();
            this.toggleExpand(n.id);
        });

        // Click on row → select
        row.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-act]') && target.dataset.act !== 'name') return;
            this._handleRowClick(n.id, e);
        });

        // Double-click name → inline rename
        const nameEl = row.querySelector<HTMLElement>('[data-act="name"]')!;
        nameEl.addEventListener('dblclick', e => {
            e.stopPropagation();
            this._startRename(nameEl, n);
        });

        // Drag & drop reorder
        row.addEventListener('dragstart', e => {
            e.dataTransfer?.setData('text/plain', n.id);
            row.classList.add('ar-layers__row--dragging');
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('ar-layers__row--dragging');
            this._elList.querySelectorAll('.ar-layers__row--drop-before, .ar-layers__row--drop-after, .ar-layers__row--drop-into')
                .forEach(el => el.classList.remove(
                    'ar-layers__row--drop-before',
                    'ar-layers__row--drop-after',
                    'ar-layers__row--drop-into',
                ));
        });
        row.addEventListener('dragover', e => {
            e.preventDefault();
            const rect = row.getBoundingClientRect();
            const y = e.clientY - rect.top;
            row.classList.remove('ar-layers__row--drop-before', 'ar-layers__row--drop-after', 'ar-layers__row--drop-into');
            // Top third → before, bottom third → after, middle → into (only for groups)
            if (n.kind === 'group' && y > rect.height * 0.33 && y < rect.height * 0.66)
                row.classList.add('ar-layers__row--drop-into');
            else if (y < rect.height / 2)
                row.classList.add('ar-layers__row--drop-before');
            else
                row.classList.add('ar-layers__row--drop-after');
        });
        row.addEventListener('drop', e => {
            e.preventDefault();
            const draggedId = e.dataTransfer?.getData('text/plain');
            if (!draggedId || draggedId === n.id) return;

            const intoGroup = row.classList.contains('ar-layers__row--drop-into');
            const before    = row.classList.contains('ar-layers__row--drop-before');

            if (intoGroup && n.kind === 'group')
            {
                const len = n.children?.length ?? 0;
                this.move(draggedId, n.id, len);
            }
            else
            {
                const f = this._findWithParent(n.id);
                if (!f) return;
                const newParentId = f.parent ? f.parent.id : null;
                this.move(draggedId, newParentId, before ? f.index : f.index + 1);
            }
        });
    }

    private _handleRowClick(id: string, e: MouseEvent): void
    {
        if (e.shiftKey && this._active)
        {
            // Range select
            const flat = this._flatten().map(n => n.id);
            const a = flat.indexOf(this._active);
            const b = flat.indexOf(id);
            if (a !== -1 && b !== -1)
            {
                const [lo, hi] = a < b ? [a, b] : [b, a];
                this._selected = new Set(flat.slice(lo, hi + 1));
            }
        }
        else if (e.metaKey || e.ctrlKey)
        {
            // Toggle
            if (this._selected.has(id)) this._selected.delete(id);
            else                        this._selected.add(id);
            this._active = id;
        }
        else
        {
            this._selected = new Set([id]);
            this._active = id;
        }
        this._render();
        this._emit('select', { ids: [...this._selected] });
    }

    private _startRename(span: HTMLElement, n: LayerNode): void
    {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = n.name;
        inp.className = 'ar-layers__rename-inp';
        span.replaceWith(inp);
        inp.focus();
        inp.select();
        const finish = (commit: boolean) => {
            if (commit) this.rename(n.id, inp.value.trim() || n.name);
            else this._render();
        };
        inp.addEventListener('blur',    () => finish(true));
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') { finish(true); }
            else if (e.key === 'Escape') { finish(false); }
        });
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-layers-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-layers-styles';
        s.textContent = `
.ar-layers { display:flex; flex-direction:column; background:#1e1e1e; border:1px solid #333; border-radius:6px; color:#d4d4d4; font:12px -apple-system,system-ui,sans-serif; min-width:240px; user-select:none; }
.ar-layers__head { display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid #333; }
.ar-layers__title { font:600 12px sans-serif; letter-spacing:.04em; text-transform:uppercase; color:#e40c88; }
.ar-layers__list { flex:1; overflow:auto; max-height:400px; }
.ar-layers__row { display:flex; align-items:center; gap:6px; padding:4px 8px; cursor:pointer; border-left:2px solid transparent; }
.ar-layers__row:hover { background:#2a2a2a; }
.ar-layers__row--selected { background:rgba(228,12,136,0.2); border-left-color:#e40c88; }
.ar-layers__row--dragging { opacity:0.5; }
.ar-layers__row--drop-before { box-shadow:inset 0 2px 0 #e40c88; }
.ar-layers__row--drop-after  { box-shadow:inset 0 -2px 0 #e40c88; }
.ar-layers__row--drop-into   { background:rgba(228,12,136,0.35); }
.ar-layers__icon { font-size:13px; width:16px; text-align:center; cursor:pointer; opacity:.85; }
.ar-layers__icon:hover { opacity:1; }
.ar-layers__eye.off { opacity:.35; }
.ar-layers__lock.on { color:#eab308; }
.ar-layers__chev { width:14px; text-align:center; font-size:9px; color:#888; cursor:pointer; }
.ar-layers__chev--leaf { color:#444; cursor:default; }
.ar-layers__thumb { width:24px; height:24px; object-fit:cover; border-radius:2px; flex-shrink:0; }
.ar-layers__name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ar-layers__rename-inp { flex:1; background:#0d0d0d; border:1px solid #e40c88; color:#fff; padding:1px 4px; font:12px sans-serif; border-radius:2px; }
.ar-layers__footer { display:flex; gap:4px; padding:6px; border-top:1px solid #333; flex-wrap:wrap; }
.ar-layers__btn { background:transparent; border:1px solid #444; color:#d4d4d4; padding:3px 8px; font:11px sans-serif; border-radius:3px; cursor:pointer; }
.ar-layers__btn:hover { background:#2a2a2a; }
.ar-layers__btn--danger:hover { background:#dc2626; border-color:#dc2626; color:#fff; }
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
