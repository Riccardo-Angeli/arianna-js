/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module TreeView
 * Hierarchical tree control.
 *
 * @example
 *   const tree = new TreeView('#sidebar', { selectable: 'single' });
 *   tree.nodes = [
 *     { id: '1', label: 'Root', children: [
 *       { id: '1.1', label: 'Child A', icon: '📄' },
 *       { id: '1.2', label: 'Child B', lazy: true },
 *     ]},
 *   ];
 *   tree.on('select',  ({ node }) => console.log(node));
 *   tree.on('expand',  ({ node }) => console.log(node));
 *   tree.on('load',    ({ node, resolve }) => fetchChildren(node).then(resolve));
 *   tree.on('drop',    ({ sourceId, targetId }) => move(sourceId, targetId));
 */
import { Control } from '../core/Control.ts';

export interface TreeNode {
  id         : string;
  label      : string;
  icon?      : string;
  badge?     : string | number;
  children?  : TreeNode[];
  lazy?      : boolean;
  expanded?  : boolean;
  selected?  : boolean;
  checked?   : boolean;
  selectable?: boolean;
  data?      : unknown;
  class?     : string;
}

export interface TreeViewOptions {
  selectable?    : 'none' | 'single' | 'multi';
  checkboxes?    : boolean;
  icons?         : boolean;
  badges?        : boolean;
  indent?        : number;
  rowHeight?     : number;
  draggable?     : boolean;
  keyboard?      : boolean;
  expandOnSelect?: boolean;
  search?        : boolean;
  class?         : string;
}

interface NS {
  node     : TreeNode;
  expanded : boolean;
  selected : boolean;
  checked  : boolean;
  loading  : boolean;
  loaded   : boolean;
  depth    : number;
  parent   : NS | null;
  children : NS[];
  el?      : HTMLElement;
}

export class TreeView extends Control<TreeViewOptions> {
  private _roots : NS[]          = [];
  private _map   = new Map<string, NS>();
  private _focus : NS | null     = null;
  private _q     = '';
  private _list! : HTMLElement;

  constructor(container: string | HTMLElement | null = null, opts: TreeViewOptions = {}) {
    super(container, 'div', {
      selectable: 'single', icons: true, badges: true,
      indent: 20, rowHeight: 32, keyboard: true, search: true,
      draggable: false, checkboxes: false, expandOnSelect: false, ...opts
    });
    this.el.className = `ar-tree${opts.class?' '+opts.class:''}`;
    this.el.setAttribute('role', 'tree'); this.el.tabIndex = 0;
  }

  set nodes(v: TreeNode[]) { this._roots = []; this._map.clear(); this._roots = v.map(n => this._ns(n, null, 0)); this._build(); }
  get nodes()              { return this._roots.map(s => s.node); }

  expand(id: string)   { const s = this._map.get(id); if (s && !s.expanded) this._expand(s); }
  collapse(id: string) { const s = this._map.get(id); if (s &&  s.expanded) this._collapse(s); }
  expandAll()          { this._map.forEach(s => { if (!s.expanded) this._expand(s); }); }
  collapseAll()        { this._map.forEach(s => { if ( s.expanded) this._collapse(s); }); }

  select(id: string) {
    const s = this._map.get(id); if (!s || s.node.selectable === false) return;
    if (this._get('selectable', 'single') === 'single') this._clearSel();
    this._setSel(s, true);
  }
  deselect(id: string) { const s = this._map.get(id); if (s) this._setSel(s, false); }
  getSelected()        { return [...this._map.values()].filter(s => s.selected).map(s => s.node); }

  check(id: string, v = true) { const s = this._map.get(id); if (s) this._setChecked(s, v); }
  getChecked()                { return [...this._map.values()].filter(s => s.checked).map(s => s.node); }

  search(q: string) { this._q = q.toLowerCase().trim(); this._applyFilter(); }

  protected _build() {
    this.el.innerHTML = '';
    const opts = this._state.State;
    if (opts.search) {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'ar-tree__search'; inp.placeholder = 'Search…'; inp.value = this._q;
      inp.addEventListener('input', () => { this._q = inp.value.toLowerCase().trim(); this._applyFilter(); });
      this.el.appendChild(inp);
    }
    this._list = this._el('ul', 'ar-tree__list', this.el);
    this._list.setAttribute('role', 'group');
    this._roots.forEach(s => this._renderNode(s, this._list));
    if (opts.keyboard) this._on(this.el, 'keydown', (e: KeyboardEvent) => this._onKey(e));
  }

  private _renderNode(s: NS, parent: HTMLElement) {
    const opts = this._state.State;
    const hasChildren = (s.node.children?.length ?? 0) > 0 || s.node.lazy;
    const li = this._el('li', 'ar-tree__node', parent);
    li.setAttribute('role', 'treeitem'); li.setAttribute('aria-expanded', String(s.expanded)); li.setAttribute('aria-selected', String(s.selected));
    li.dataset.id = s.node.id; if (s.node.class) li.classList.add(...s.node.class.split(' '));
    s.el = li;

    const row = this._el('div', `ar-tree__row${s.selected?' ar-tree__row--on':''}`, li);
    row.style.paddingLeft = (s.depth * (opts.indent ?? 20) + 8) + 'px';
    row.style.height      = (opts.rowHeight ?? 32) + 'px';

    const arrow = this._el('span', 'ar-tree__arrow', row);
    if (hasChildren) {
      arrow.textContent = s.loading ? '⟳' : s.expanded ? '▾' : '▸';
      arrow.addEventListener('click', e => { e.stopPropagation(); s.expanded ? this._collapse(s) : this._expand(s); });
    }
    if (opts.checkboxes) {
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'ar-tree__cb'; cb.checked = s.checked;
      cb.addEventListener('change', () => this._setChecked(s, cb.checked)); row.appendChild(cb);
    }
    if (opts.icons && s.node.icon) this._el('span', 'ar-tree__icon', row).textContent = s.node.icon;
    this._el('span', 'ar-tree__label', row).textContent = s.node.label;
    if (opts.badges && s.node.badge !== undefined) this._el('span', 'ar-tree__badge', row).textContent = String(s.node.badge);

    if (s.node.selectable !== false) {
      row.addEventListener('click', e => {
        const mode = this._get('selectable', 'single') as string;
        if (mode === 'none') return;
        if (mode === 'single') this._clearSel();
        this._setSel(s, !s.selected);
        if (opts.expandOnSelect && hasChildren) s.expanded ? this._collapse(s) : this._expand(s);
        this._focus = s; this._emit('select', { node: s.node, selected: s.selected }, e as Event);
      });
    }
    if (opts.draggable) this._drag(s, li, row);

    if (hasChildren) {
      const ul = this._el('ul', 'ar-tree__children', li); ul.setAttribute('role', 'group');
      ul.style.display = s.expanded ? '' : 'none';
      if (s.expanded && s.loaded) s.children.forEach(c => this._renderNode(c, ul));
    }
  }

  private _expand(s: NS) {
    if (s.node.lazy && !s.loaded) {
      s.loading = true; this._updateRow(s);
      let resolved = false;
      this._emit('load', { node: s.node, resolve: (children: TreeNode[]) => {
        if (resolved) return; resolved = true;
        s.children = children.map(c => this._ns(c, s, s.depth + 1));
        s.node.children = children; s.loaded = true; s.loading = false; s.expanded = true;
        this._updateRow(s); this._emit('expand', { node: s.node });
      }});
      return;
    }
    s.expanded = true; this._updateRow(s); this._emit('expand', { node: s.node });
  }

  private _collapse(s: NS) { s.expanded = false; this._updateRow(s); this._emit('collapse', { node: s.node }); }

  private _updateRow(s: NS) {
    if (!s.el) return;
    const li = s.el; const opts = this._state.State;
    const hasChildren = (s.node.children?.length ?? 0) > 0 || s.node.lazy;
    li.setAttribute('aria-expanded', String(s.expanded));
    const oldRow = li.querySelector('.ar-tree__row'); if (oldRow) oldRow.remove();
    const row = this._el('div', `ar-tree__row${s.selected?' ar-tree__row--on':''}`, li);
    row.style.paddingLeft = (s.depth * (opts.indent ?? 20) + 8) + 'px';
    row.style.height = (opts.rowHeight ?? 32) + 'px';
    if (li.firstChild && li.firstChild !== row) li.insertBefore(row, li.firstChild);
    const arrow = this._el('span', 'ar-tree__arrow', row);
    if (hasChildren) { arrow.textContent = s.loading ? '⟳' : s.expanded ? '▾' : '▸'; arrow.addEventListener('click', e => { e.stopPropagation(); s.expanded ? this._collapse(s) : this._expand(s); }); }
    if (opts.icons && s.node.icon) this._el('span', 'ar-tree__icon', row).textContent = s.node.icon;
    this._el('span', 'ar-tree__label', row).textContent = s.node.label;
    if (opts.badges && s.node.badge !== undefined) this._el('span', 'ar-tree__badge', row).textContent = String(s.node.badge);
    row.addEventListener('click', e => { if (s.node.selectable === false) return; const mode = this._get('selectable', 'single') as string; if (mode === 'none') return; if (mode === 'single') this._clearSel(); this._setSel(s, !s.selected); this._emit('select', { node: s.node, selected: s.selected }, e as Event); });
    let ul = li.querySelector<HTMLElement>('.ar-tree__children');
    if (!ul && hasChildren) { ul = this._el('ul', 'ar-tree__children') as HTMLElement; ul.setAttribute('role','group'); li.appendChild(ul); }
    if (ul) { if (s.expanded) { ul.style.display = ''; if (s.loaded && !ul.children.length) s.children.forEach(c => this._renderNode(c, ul!)); } else ul.style.display = 'none'; }
  }

  private _clearSel() { this._map.forEach(s => { if (s.selected) this._setSel(s, false); }); }
  private _setSel(s: NS, v: boolean) {
    s.selected = v; if (!s.el) return;
    const row = s.el.querySelector<HTMLElement>('.ar-tree__row');
    if (row) { if (v) row.classList.add('ar-tree__row--on'); else row.classList.remove('ar-tree__row--on'); }
    s.el.setAttribute('aria-selected', String(v));
  }
  private _setChecked(s: NS, v: boolean) { s.checked = s.node.checked = v; const cb = s.el?.querySelector<HTMLInputElement>('.ar-tree__cb'); if (cb) cb.checked = v; this._emit('check', { node: s.node, checked: v }); }

  private _applyFilter() {
    const q = this._q;
    this._map.forEach(s => { if (s.el) (s.el as HTMLElement).style.display = q ? (s.node.label.toLowerCase().includes(q) ? '' : 'none') : ''; });
    if (q) this._map.forEach(s => { if (s.node.label.toLowerCase().includes(q)) { let p = s.parent; while (p) { if (p.el) (p.el as HTMLElement).style.display = ''; p = p.parent; } } });
  }

  private _visible(): NS[] {
    const out: NS[] = [];
    const walk = (nodes: NS[]) => { for (const s of nodes) { if (s.el?.style.display === 'none') continue; out.push(s); if (s.expanded && s.children.length) walk(s.children); } };
    walk(this._roots); return out;
  }

  private _onKey(e: KeyboardEvent) {
    const vis = this._visible(); const idx = this._focus ? vis.indexOf(this._focus) : -1;
    if (e.key === 'ArrowDown') { e.preventDefault(); const n = vis[idx+1]; if (n) { this._focus = n; n.el?.focus(); } }
    if (e.key === 'ArrowUp')   { e.preventDefault(); const n = vis[idx-1]; if (n) { this._focus = n; n.el?.focus(); } }
    if (e.key === 'ArrowRight'){ e.preventDefault(); if (this._focus && !this._focus.expanded) this._expand(this._focus); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (this._focus?.expanded) this._collapse(this._focus); else if (this._focus?.parent) { this._focus = this._focus.parent; this._focus.el?.focus(); } }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (this._focus) { const mode = this._get('selectable','single') as string; if (mode !== 'none') { if (mode === 'single') this._clearSel(); this._setSel(this._focus, !this._focus.selected); this._emit('select', { node: this._focus.node, selected: this._focus.selected }); } } }
  }

  private _drag(s: NS, li: HTMLElement, row: HTMLElement) {
    li.draggable = true;
    li.addEventListener('dragstart', e => { e.dataTransfer?.setData('text/plain', s.node.id); li.classList.add('ar-tree__node--drag'); });
    li.addEventListener('dragend',   () => li.classList.remove('ar-tree__node--drag'));
    row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('ar-tree__row--drop'); });
    row.addEventListener('dragleave',() => row.classList.remove('ar-tree__row--drop'));
    row.addEventListener('drop', e  => { e.preventDefault(); row.classList.remove('ar-tree__row--drop'); const src = e.dataTransfer?.getData('text/plain'); if (src && src !== s.node.id) this._emit('drop', { sourceId: src, targetId: s.node.id }); });
  }

  private _ns(node: TreeNode, parent: NS | null, depth: number): NS {
    const s: NS = { node, expanded: node.expanded ?? false, selected: node.selected ?? false, checked: node.checked ?? false, loading: false, loaded: !node.lazy, depth, parent, children: [] };
    this._map.set(node.id, s);
    if (node.children) s.children = node.children.map(c => this._ns(c, s, depth + 1));
    return s;
  }
}

export const TreeViewCSS = `
.ar-tree{background:transparent;font-size:.82rem;outline:none;overflow-y:auto;user-select:none}
.ar-tree__search{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);box-sizing:border-box;color:var(--ar-text);font:inherit;font-size:.82rem;margin:4px 8px;outline:none;padding:4px 8px;width:calc(100% - 16px)}
.ar-tree__search:focus{border-color:var(--ar-primary)}
.ar-tree__list,.ar-tree__children{list-style:none;margin:0;padding:0}
.ar-tree__row{align-items:center;border-radius:4px;box-sizing:border-box;cursor:pointer;display:flex;gap:6px;transition:background var(--ar-transition)}
.ar-tree__row:hover{background:var(--ar-bg3)}
.ar-tree__row--on{background:var(--ar-primary)!important;color:var(--ar-primary-text)}
.ar-tree__arrow{color:var(--ar-muted);flex-shrink:0;font-size:.7rem;text-align:center;width:14px}
.ar-tree__icon{flex-shrink:0}
.ar-tree__label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ar-tree__badge{background:var(--ar-warning);border-radius:8px;color:#000;flex-shrink:0;font-size:.65rem;padding:1px 5px}
.ar-tree__node--drag{opacity:.4}
.ar-tree__row--drop{outline:2px dashed var(--ar-primary)}
`;
