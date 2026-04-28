/**
 * @module    Table
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * High-performance data table for AriannA.
 * Single component — configure via options to enable/disable any feature.
 *
 * ── Features ──────────────────────────────────────────────────────────────────
 *   - Column sorting (single / multi)
 *   - Global search + per-column filtering
 *   - Client-side pagination (optional)
 *   - Server-side / async data loading
 *   - Web Worker offloading for sort+filter on large datasets (optional)
 *   - LRU cache for remote pages (optional)
 *   - Sticky header
 *   - Row selection (single / multi / checkbox)
 *   - Column resizing
 *   - Column visibility toggle
 *   - Custom cell renderers
 *   - Export to CSV
 *   - AriannA Observable events
 *   - Keyboard navigation
 *   - Accessible (ARIA grid)
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 * @example
 *   // Client-side, full-featured
 *   import { Table } from 'arianna-wip/controls';
 *
 *   const table = new Table('#container', {
 *     columns: [
 *       { key: 'name',   label: 'Name',   sortable: true, width: 200 },
 *       { key: 'email',  label: 'Email',  sortable: true },
 *       { key: 'status', label: 'Status', render: (v) => `<span class="badge">${v}</span>` },
 *     ],
 *     paging    : { pageSize: 25, sizes: [10, 25, 50, 100] },
 *     selectable: 'multi',
 *     worker    : true,   // offload sort+filter to Web Worker
 *     cache     : true,   // LRU cache for remote pages
 *   });
 *
 *   table.load(myData);
 *   table.mount();
 *
 *   table.on('select', e => console.log(e.detail.rows));
 *   table.on('sort',   e => console.log(e.detail.column, e.detail.direction));
 *   table.on('page',   e => console.log(e.detail.page));
 *
 * @example
 *   // Server-side / async
 *   const table = new Table('#container', {
 *     columns: [...],
 *     paging : { pageSize: 20 },
 *     fetch  : async ({ page, pageSize, sort, filter }) => {
 *       const res = await api.get('/data', { page, pageSize, sort, filter });
 *       return { rows: res.data, total: res.total };
 *     },
 *   });
 *   table.mount();
 *
 * @example
 *   // Lightweight — no paging, no worker, no cache
 *   const table = new Table('#container', {
 *     columns  : [...],
 *     paging   : false,
 *     worker   : false,
 *     cache    : false,
 *     selectable: 'none',
 *   });
 *   table.load(myData).mount();
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Column definition. */
export interface TableColumn<R = Row> {
  /** Property key in the row object. */
  key      : string;
  /** Display header label. */
  label    : string;
  /** Column width (px or CSS value). @default 'auto' */
  width?   : number | string;
  /** Min column width in px. @default 60 */
  minWidth?: number;
  /** Whether this column can be sorted. @default false */
  sortable?: boolean;
  /** Whether this column can be filtered. @default false */
  filterable?: boolean;
  /** Whether this column is visible. @default true */
  visible? : boolean;
  /** Whether this column can be resized. @default true */
  resizable?: boolean;
  /** Text alignment. @default 'left' */
  align?   : 'left' | 'center' | 'right';
  /**
   * Custom cell renderer.
   * Return an HTML string or a DOM node.
   *
   * @example
   *   render: (value, row) => `<strong>${value}</strong>`
   */
  render?  : (value: unknown, row: R, col: TableColumn<R>) => string | Node;
  /**
   * Custom header renderer.
   */
  renderHeader?: (col: TableColumn<R>) => string | Node;
  /** Value accessor (override default key lookup). */
  value?   : (row: R) => unknown;
  /** Sort comparator (custom sort). */
  sort?    : (a: R, b: R, dir: SortDir) => number;
  /** CSS class(es) applied to cells in this column. */
  class?   : string;
  /** CSS class(es) applied to the header cell. */
  headerClass?: string;
}

/** A generic row — any plain object. */
export type Row = Record<string, unknown>;

/** Sort direction. */
export type SortDir = 'asc' | 'desc';

/** Active sort state. */
export interface SortState {
  key : string;
  dir : SortDir;
}

/** Pagination arianna-wip-config. */
export interface PagingConfig {
  /** Rows per page. @default 25 */
  pageSize  : number;
  /** Available page size options. @default [10, 25, 50, 100] */
  sizes?    : number[];
  /** Current page (1-indexed). @default 1 */
  page?     : number;
}

/** Fetch function for server-side data. */
export type FetchFn<R = Row> = (params: FetchParams) => Promise<FetchResult<R>>;

/** Parameters passed to the fetch function. */
export interface FetchParams {
  page     : number;
  pageSize : number;
  sort?    : SortState;
  filter?  : string;
  filters? : Record<string, string>;
}

/** Expected return from fetch function. */
export interface FetchResult<R = Row> {
  rows  : R[];
  total : number;
}

/** Table options. */
export interface TableOptions<R = Row> extends CtrlOptions {
  class?        : string;
  expandable?   : boolean;
  expandSingle? : boolean;
  rowContent?   : (row: R) => Promise<string | HTMLElement>;
  /** Column definitions. Required. */
  columns     : TableColumn<R>[];
  /**
   * Pagination arianna-wip-config, or false to disable.
   * @default { pageSize: 25, sizes: [10, 25, 50, 100] }
   */
  paging?     : PagingConfig | false;
  /**
   * Row selection mode.
   * @default 'none'
   */
  selectable? : 'none' | 'single' | 'multi';
  /** Show row checkboxes (multi selection). @default false */
  checkboxes? : boolean;
  /**
   * Async data fetcher for server-side mode.
   * If provided, `load()` is ignored for paged data.
   */
  fetch?      : FetchFn<R>;
  /**
   * Offload sort+filter to a Web Worker.
   * Has no effect in server-side (fetch) mode.
   * @default false
   */
  worker?     : boolean;
  /**
   * Enable LRU cache for remote pages.
   * Only meaningful in server-side (fetch) mode.
   * @default false
   */
  cache?      : boolean;
  /** LRU cache capacity (number of pages). @default 20 */
  cacheSize?  : number;
  /** Show global search bar. @default true */
  searchable? : boolean;
  /** Show column filter inputs. @default false */
  columnFilters? : boolean;
  /** Show column visibility toggle button. @default false */
  columnToggle?  : boolean;
  /** Enable column resizing. @default false */
  resizable?  : boolean;
  /** Sticky header. @default true */
  stickyHeader? : boolean;
  /** Show row count / total arianna-wip-info. @default true */
  info?       : boolean;
  /** Enable CSV export button. @default false */
  exportCsv?  : boolean;
  /** Placeholder shown when no rows match. @default 'No data' */
  emptyText?  : string;
  /** Loading text. @default 'Loading…' */
  loadingText?: string;
  /** Row click callback shorthand. */
  onRowClick? : (row: R, e: MouseEvent) => void;
}

// ── LRU Cache ─────────────────────────────────────────────────────────────────

class LRUCache<K, V> {
  private _map  = new Map<K, V>();
  private _cap  : number;
  constructor(capacity: number) { this._cap = capacity; }
  get(key: K): V | undefined {
    if (!this._map.has(key)) return undefined;
    const v = this._map.get(key)!;
    this._map.delete(key); this._map.set(key, v);
    return v;
  }
  set(key: K, value: V): void {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._cap) this._map.delete(this._map.keys().next().value!);
    this._map.set(key, value);
  }
  clear(): void { this._map.clear(); }
}

// ── Worker source ─────────────────────────────────────────────────────────────

/**
 * Worker script source (inlined as a Blob URL).
 * Handles sort + filter off the main thread.
 */
const WORKER_SRC = `
self.onmessage = function(e) {
  const { rows, sort, filter, columnFilters, columns } = e.data;
  let result = rows.slice();

  // Global filter
  if (filter) {
    const q = filter.toLowerCase();
    result = result.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }

  // Column filters
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, val]) => {
      if (!val) return;
      const q = val.toLowerCase();
      result = result.filter(row => String(row[key] ?? '').toLowerCase().includes(q));
    });
  }

  // Sort
  if (sort && sort.key) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    result.sort((a: R, b: R) => {
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      if (av < bv) return -dir;
      if (av > bv) return  dir;
      return 0;
    });
  }

  self.postMessage({ rows: result, total: result.length });
};
`;

// ── Table ──────────────────────────────────────────────────────────────────────

/**
 * Table — data grid with optional paging, worker, and cache.
 */
export class Table<R extends Row = Row> extends Control<TableOptions<R>> {

  protected _expandedRows = new Set<number>();
  protected _renderRows(): void { this._renderBody(); }
  protected _build(): void { this._renderBody(); }
  /** Full client-side dataset. */
  private _data        : R[]    = [];
  /** Currently visible rows (after sort+filter). */
  private _rows        : R[]    = [];
  /** Total row count (for server-side). */
  private _total       = 0;
  /** Current page (1-indexed). */
  private _page        = 1;
  /** Current page size. */
  private _pageSize    : number;
  /** Current sort state. */
  private _sort?       : SortState;
  /** Current global filter. */
  private _filter      = '';
  /** Current column filters. */
  private _colFilters  : Record<string, string> = {};
  /** Selected row indices (by row reference). */
  private _selected    = new Set<R>();
  /** Loading state. */
  private _loading     = false;
  /** Web Worker instance. */
  private _worker?     : Worker;
  /** Pending worker resolve. */
  private _workerResolve?: (rows: R[]) => void;
  /** LRU page cache. */
  private _cache?      : LRUCache<string, FetchResult<R>>;
  /** Column resize state. */
  private _resizeCol?  : { col: TableColumn<R>; startX: number; startW: number };
  /** DOM refs. */
  private _dom         = {} as {
    toolbar   : HTMLElement;
    table     : HTMLTableElement;
    thead     : HTMLTableSectionElement;
    tbody     : HTMLTableSectionElement;
    footer    : HTMLElement;
    info      : HTMLElement;
    pager     : HTMLElement;
    empty     : HTMLElement;
    spinner   : HTMLElement;
  };

  // ── Constructor ─────────────────────────────────────────────────────────────

  constructor(
    container : string | HTMLElement | null = null,
    options   : TableOptions<R>,
  ) {
    super(container, 'div', {
      paging       : { pageSize: 25, sizes: [10, 25, 50, 100] },
      selectable   : 'none',
      checkboxes   : false,
      worker       : false,
      cache        : false,
      cacheSize    : 20,
      searchable   : true,
      columnFilters: false,
      columnToggle : false,
      resizable    : false,
      stickyHeader : true,
      info         : true,
      exportCsv    : false,
      emptyText    : 'No data',
      loadingText  : 'Loading…',
      ...options,
    });

    this.el.className = `arianna-table-wrap${options.class ? ' '+options.class : ''}`;

    const paging = this.get('paging') as TableOptions<R>['paging'] | undefined;
    this._pageSize = paging ? (paging.pageSize ?? 25) : Infinity;
    this._page     = paging ? (paging.page    ?? 1)  : 1;

    // Init Web Worker
    if (this.get('worker') && !this.get('fetch')) {
      const blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
      const url  = URL.createObjectURL(blob);
      this._worker = new Worker(url);
      this._worker.onmessage = (e: MessageEvent) => {
        if (this._workerResolve) {
          this._workerResolve(e.data.rows as R[]);
          this._total = e.data.total;
          this._workerResolve = undefined;
        }
      };
      this._onDestroy(() => { this._worker?.terminate(); URL.revokeObjectURL(url); });
    }

    // Init cache
    if (this.get('cache') && this.get('fetch')) {
      this._cache = new LRUCache<string, FetchResult<R>>(this.get('cacheSize') ?? 20);
    }
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  /**
   * Load client-side data.
   * Triggers a re-render if mounted.
   *
   * @example
   *   table.load(myRows);
   */
  load(data: R[]): this {
    this._data  = data;
    this._total = data.length;
    this._page  = 1;
    if (this._mounted) this._process().then(() => this._renderBody());
    return this;
  }

  /**
   * Append rows to client-side data.
   */
  append(rows: R[]): this {
    this._data.push(...rows);
    this._total = this._data.length;
    if (this._mounted) this._process().then(() => this._renderBody());
    return this;
  }

  /**
   * Clear all data.
   */
  clear(): this {
    this._data = []; this._rows = []; this._total = 0; this._page = 1;
    if (this._mounted) this._renderBody();
    return this;
  }

  /**
   * Reload data — re-triggers fetch (server-side) or re-processes (client-side).
   */
  reload(): this {
    this._page = 1;
    if (this._mounted) this._load();
    return this;
  }

  /**
   * Invalidate the cache and reload.
   */
  invalidateCache(): this {
    this._cache?.clear();
    return this.reload();
  }

  // ── Selection ────────────────────────────────────────────────────────────────

  /**
   * Get all selected rows.
   */
  getSelected(): R[] { return [...this._selected]; }

  /**
   * Clear selection.
   */
  clearSelection(): this {
    this._selected.clear();
    this._dom.tbody?.querySelectorAll('tr.selected')
      .forEach(r => r.classList.remove('selected'));
    return this;
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  /**
   * Export current view to CSV and trigger download.
   */
  exportToCsv(filename = 'export.csv'): void {
    const cols = this.get<TableColumn<R>[]>('columns') ?? [].filter((c: TableColumn<R>) => c.visible !== false);
    const header = cols.map((c: TableColumn<R>) => JSON.stringify(c.label)).join(',');
    const rowLines = this._rows.map(row =>
      cols.map((c: TableColumn<R>) => {
        const v = c.value ? c.value(row) : row[c.key];
        return JSON.stringify(String(v ?? ''));
      }).join(',')
    );
    const csv  = [header, ...rowLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  protected _render(): void {
    this.el.innerHTML = '';
    const opts = this._state.State;

    // Toolbar
    this._dom.toolbar = this._el('div', 'arianna-wip-table__toolbar', this.el);
    this._buildToolbar();

    // Table
    const tableWrap = this._el('div', 'arianna-wip-table__scroll', this.el);
    this._dom.table = document.createElement('table');
    this._dom.table.className = 'arianna-wip-table';
    this._dom.table.setAttribute('role', 'grid');
    tableWrap.appendChild(this._dom.table);

    this._dom.thead = this._dom.table.createTHead();
    this._dom.tbody = this._dom.table.createTBody();
    this._buildHeader();

    // Empty state
    this._dom.empty = this._el('div', 'arianna-wip-table__empty', this.el);
    this._dom.empty.textContent = opts.emptyText ?? 'No data';
    this._dom.empty.style.display = 'none';

    // Spinner
    this._dom.spinner = this._el('div', 'arianna-wip-table__spinner', this.el);
    this._dom.spinner.textContent = opts.loadingText ?? 'Loading…';
    this._dom.spinner.style.display = 'none';

    // Footer
    this._dom.footer = this._el('div', 'arianna-wip-table__footer', this.el);
    this._dom.info   = this._el('span', 'arianna-wip-table__info',  this._dom.footer);
    this._dom.pager  = this._el('div',  'arianna-wip-table__pager', this._dom.footer);

    this._load();
  }

  private _buildToolbar(): void {
    const opts = this._state.State;
    const tb   = this._dom.toolbar;

    if (opts.searchable) {
      const input = document.createElement('input');
      input.type        = 'text';
      input.placeholder = 'Search…';
      input.className   = 'arianna-wip-table__search';
      input.value       = this._filter;
      this._listen(input as unknown as HTMLElement, 'input', () => {
        this._filter = input.value;
        this._page   = 1;
        this._load();
      });
      tb.appendChild(input);
    }

    if (opts.exportCsv) {
      const btn = document.createElement('button');
      btn.className   = 'arianna-wip-table__btn';
      btn.textContent = '↓ CSV';
      btn.addEventListener('click', () => this.exportToCsv());
      tb.appendChild(btn);
    }

    if (opts.columnToggle) {
      const btn = document.createElement('button');
      btn.className   = 'arianna-wip-table__btn';
      btn.textContent = '⊞ Columns';
      btn.addEventListener('click', () => this._showColumnToggle(btn));
      tb.appendChild(btn);
    }
  }

  private _buildHeader(): void {
    const opts = this._state.State;
    const tr   = this._dom.thead.insertRow();
    tr.setAttribute('role', 'row');

    if (opts.checkboxes && opts.selectable === 'multi') {
      const th  = document.createElement('th');
      th.className = 'arianna-wip-table__th arianna-wip-table__th--check';
      const cb  = document.createElement('input');
      cb.type   = 'checkbox';
      cb.addEventListener('change', () => {
        if (cb.checked) this._rows.forEach(r => this._selected.add(r));
        else            this._selected.clear();
        this._renderBody();
      });
      th.appendChild(cb);
      tr.appendChild(th);
    }

    (opts.columns ?? [])
      .filter((c: TableColumn<R>) => c.visible !== false)
      .forEach((col: TableColumn<R>) => {
        const th = document.createElement('th');
        th.className   = `arianna-table__th ${col.headerClass ?? ''}`;
        th.setAttribute('role', 'columnheader');
        th.setAttribute('aria-sort', 'none');
        th.style.width = col.width ? (typeof col.width === 'number' ? col.width+'px' : col.width) : '';
        if (col.align) th.style.textAlign = col.align;

        const inner = this._el('div', 'arianna-wip-table__th-inner', th);

        if (col.renderHeader) {
          const h = col.renderHeader(col);
          if (typeof h === 'string') inner.innerHTML = h;
          else inner.appendChild(h);
        } else {
          inner.textContent = col.label;
        }

        if (col.sortable) {
          th.classList.add('arianna-wip-table__th--sortable');
          const arrow = this._el('span', 'arianna-wip-table__sort-arrow', inner);
          arrow.textContent = this._sort?.key === col.key
            ? (this._sort.dir === 'asc' ? '↑' : '↓') : '↕';
          th.addEventListener('click', () => this._toggleSort(col));
        }

        if (opts.resizable && col.resizable !== false) {
          const handle = this._el('div', 'arianna-wip-table__resize-handle', th);
          this._listen(handle as unknown as HTMLElement, 'mousedown', e => {
            this._resizeCol = {
              col,
              startX : (e as MouseEvent).clientX,
              startW : th.offsetWidth,
            };
          });
        }

        if (opts.columnFilters && col.filterable) {
          const fi = document.createElement('input');
          fi.type        = 'text';
          fi.placeholder = '…';
          fi.className   = 'arianna-wip-table__col-filter';
          fi.value       = this._colFilters[col.key] ?? '';
          fi.addEventListener('input', () => {
            this._colFilters[col.key] = fi.value;
            this._page = 1;
            this._load();
          });
          fi.addEventListener('click', e => e.stopPropagation());
          th.appendChild(fi);
        }

        tr.appendChild(th);
      });

    // Column resize mousemove/mouseup on document
    this._listen(document as unknown as HTMLElement, 'mousemove', e => {
      if (!this._resizeCol) return;
      const dx  = (e as MouseEvent).clientX - this._resizeCol.startX;
      const min = this._resizeCol.col.minWidth ?? 60;
      const w   = Math.max(min, this._resizeCol.startW + dx);
      const idx = (opts.columns ?? []).findIndex(c => c.key === this._resizeCol!.col.key);
      const th  = this._dom.thead.rows[0]?.cells[idx];
      if (th) th.style.width = w + 'px';
      this._resizeCol.col.width = w;
    });
    this._listen(document as unknown as HTMLElement, 'mouseup', () => {
      this._resizeCol = undefined;
    });
  }

  private _renderBody(): void {
    const opts   = this._state.State;
    const tbody  = this._dom.tbody;
    tbody.innerHTML = '';

    if (this._loading) {
      this._dom.spinner.style.display = '';
      this._dom.empty.style.display   = 'none';
      this._renderFooter();
      return;
    }
    this._dom.spinner.style.display = 'none';

    if (!this._rows.length) {
      this._dom.empty.style.display = '';
      this._renderFooter();
      return;
    }
    this._dom.empty.style.display = 'none';

    this._rows.forEach((row, ri) => {
      const tr = tbody.insertRow();
      tr.setAttribute('role', 'row');
      if (this._selected.has(row)) tr.classList.add('selected');

      // Click
      // Expand toggle cell
      if (opts.expandable) {
        const td = tr.insertCell(); td.className = 'ar-table__td ar-table__td--exp';
        const btn = document.createElement('button'); btn.className = 'ar-table__exp-btn';
        const idx2 = ri;
        btn.innerHTML = this._expandedRows.has(idx2) ? '▾' : '▸';
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (this._expandedRows.has(idx2)) {
            this._expandedRows.delete(idx2);
            this._emit('collapse', { row, index: idx2 });
          } else {
            if (opts.expandSingle) this._expandedRows.clear();
            this._expandedRows.add(idx2);
            this._emit('expand', { row, index: idx2 });
          }
          this._renderRows();
          // If expanded, render async content
          if (this._expandedRows.has(idx2) && opts.rowContent) {
            const detailRow = tbody.querySelector(`[data-exp-detail="${idx2}"]`);
            if (detailRow) {
              const cell = detailRow.querySelector('td');
              if (cell) {
                cell.innerHTML = '<span style="color:var(--ar-muted);font-size:.8rem">Loading…</span>';
                const content = await opts.rowContent(row);
                if (typeof content === 'string') cell.innerHTML = content;
                else { cell.innerHTML = ''; cell.appendChild(content); }
              }
            }
          }
        });
        td.appendChild(btn);
      }
            tr.addEventListener('click', e => {
        const mode = opts.selectable;
        if (mode === 'none') {
          opts.onRowClick?.(row, e as MouseEvent);
          return;
        }
        if (mode === 'single') { this._selected.clear(); }
        if (this._selected.has(row)) this._selected.delete(row);
        else                         this._selected.add(row);
        this._renderBody();
        this._fire('select', { rows: this.getSelected(), row });
        opts.onRowClick?.(row, e as MouseEvent);
      });

      // Checkbox
      if (opts.checkboxes && opts.selectable === 'multi') {
        const td = tr.insertCell();
        td.className = 'arianna-wip-table__td arianna-wip-table__td--check';
        const cb = document.createElement('input');
        cb.type    = 'checkbox';
        cb.checked = this._selected.has(row);
        cb.addEventListener('change', e => {
          e.stopPropagation();
          if (cb.checked) this._selected.add(row);
          else            this._selected.delete(row);
          if (cb.checked) tr.classList.add('selected');
          else            tr.classList.remove('selected');
          this._fire('select', { rows: this.getSelected(), row });
        });
        td.appendChild(cb);
      }

      (opts.columns ?? [])
        .filter((c: TableColumn<R>) => c.visible !== false)
        .forEach((col: TableColumn<R>) => {
          const td  = tr.insertCell();
          td.className = `arianna-table__td ${col.class ?? ''}`;
          td.setAttribute('role', 'gridcell');
          if (col.align) td.style.textAlign = col.align;

          const v = col.value ? col.value(row) : row[col.key];
          if (col.render) {
            const r = col.render(v, row, col);
            if (typeof r === 'string') td.innerHTML = r;
            else td.appendChild(r);
          } else {
            td.textContent = String(v ?? '');
          }
        });
    });

    this._renderFooter();
  }

  private _renderFooter(): void {
    const opts   = this._state.State;
    const paging = opts.paging;
    const info   = this._dom.info;
    const pager  = this._dom.pager;
    pager.innerHTML = '';

    // Info text
    if (opts.info) {
      if (paging) {
        const start = (this._page - 1) * this._pageSize + 1;
        const end   = Math.min(this._page * this._pageSize, this._total);
        info.textContent = `${start}–${end} of ${this._total}`;
      } else {
        info.textContent = `${this._total} rows`;
      }
    }

    if (!paging || this._total <= this._pageSize) return;

    const totalPages = Math.ceil(this._total / this._pageSize);

    // Page size selector
    if (paging.sizes && paging.sizes.length > 1) {
      const sel = document.createElement('select');
      sel.className = 'arianna-wip-table__page-size';
      paging.sizes.forEach(s => {
        const o = document.createElement('option');
        o.value = String(s); o.textContent = `${s} / page`;
        if (s === this._pageSize) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => {
        this._pageSize = Number(sel.value);
        this._page     = 1;
        this._load();
      });
      pager.appendChild(sel);
    }

    // Prev
    this._pageBtn(pager, '‹', this._page > 1, () => { this._page--; this._load(); });

    // Page numbers (window of 5)
    const half  = 2;
    const start = Math.max(1, Math.min(this._page - half, totalPages - 4));
    const end   = Math.min(totalPages, start + 4);
    for (let p = start; p <= end; p++) {
      this._pageBtn(pager, String(p), true, () => { this._page = p; this._load(); },
        p === this._page);
    }

    // Next
    this._pageBtn(pager, '›', this._page < totalPages, () => { this._page++; this._load(); });

    this._fire('page', { page: this._page, pageSize: this._pageSize, total: this._total });
  }

  private _pageBtn(
    parent  : HTMLElement,
    label   : string,
    enabled : boolean,
    onClick : () => void,
    active  = false,
  ): void {
    const btn = document.createElement('button');
    btn.className   = `arianna-table__page-btn${active ? ' active' : ''}`;
    btn.textContent = label;
    btn.disabled    = !enabled;
    btn.addEventListener('click', onClick);
    parent.appendChild(btn);
  }

  // ── Data processing ──────────────────────────────────────────────────────────

  private async _load(): Promise<void> {
    const fetchFn = this.get<FetchFn<R> | undefined>('fetch');

    if (fetchFn) {
      await this._fetchRemote(fetchFn);
    } else {
      await this._processLocal();
    }

    this._renderBody();
  }

  private async _fetchRemote(fetchFn: FetchFn<R>): Promise<void> {
    const cacheKey = JSON.stringify({
      page       : this._page,
      pageSize   : this._pageSize,
      sort       : this._sort,
      filter     : this._filter,
      colFilters : this._colFilters,
    });

    if (this._cache) {
      const cached = this._cache.get(cacheKey);
      if (cached) {
        this._rows  = cached.rows;
        this._total = cached.total;
        return;
      }
    }

    this._loading = true;
    this._renderBody();

    try {
      const result = await fetchFn({
        page       : this._page,
        pageSize   : this._pageSize,
        sort       : this._sort,
        filter     : this._filter,
        filters    : this._colFilters,
      });

      this._rows  = result.rows;
      this._total = result.total;
      this._cache?.set(cacheKey, result);
      this._fire('load', { rows: this._rows, total: this._total });
    } catch (err) {
      this._fire('error', { error: err });
    } finally {
      this._loading = false;
    }
  }

  private async _processLocal(): Promise<void> {
    const paging  = this.get('paging');
    const opts    = this._state.State;

    if (this._worker && this._worker) {
      await this._processWithWorker();
    } else {
      this._processSync();
    }

    // Paginate
    if (paging) {
      const start = (this._page - 1) * this._pageSize;
      this._rows  = this._rows.slice(start, start + this._pageSize);
    }

    this._fire('load', { rows: this._rows, total: this._total });
  }

  private _processSync(): void {
    const opts = this._state.State;
    let   rows = this._data.slice();

    // Global filter
    if (this._filter) {
      const q = this._filter.toLowerCase();
      rows = rows.filter(row =>
        Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
      );
    }

    // Column filters
    Object.entries(this._colFilters).forEach(([key, val]) => {
      if (!val) return;
      const q = val.toLowerCase();
      rows = rows.filter(row => String(row[key] ?? '').toLowerCase().includes(q));
    });

    // Sort
    if (this._sort) {
      const { key, dir } = this._sort;
      const col = (opts.columns ?? []).find((c: TableColumn<R>) => c.key === key);
      const d   = dir === 'asc' ? 1 : -1;
      rows.sort((a: R, b: R) => {
        if (col?.sort) return col.sort(a, b, dir);
        const av = (col?.value ? col.value(a) : a[key] ?? '') as string | number;
        const bv = (col?.value ? col.value(b) : b[key] ?? '') as string | number;
        return av < bv ? -d : av > bv ? d : 0;
      });
    }

    this._total = rows.length;
    this._rows  = rows;
  }

  private _processWithWorker(): Promise<void> {
    return new Promise<void>(resolve => {
      this._workerResolve = (rows: R[]) => {
        this._rows = rows;
        resolve();
      };
      this._worker!.postMessage({
        rows          : this._data,
        sort          : this._sort,
        filter        : this._filter,
        columnFilters : this._colFilters,
        columns       : this.get<TableColumn<R>[]>('columns') ?? [].map((c: TableColumn<R>) => ({ key: c.key })),
      });
    });
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────

  private _toggleSort(col: TableColumn<R>): void {
    if (!this._sort || this._sort.key !== col.key) {
      this._sort = { key: col.key, dir: 'asc' };
    } else if (this._sort.dir === 'asc') {
      this._sort = { key: col.key, dir: 'desc' };
    } else {
      this._sort = undefined;
    }
    this._page = 1;
    this._rebuildHeader();
    this._load();
    this._fire('sort', { column: col, sort: this._sort });
  }

  private _rebuildHeader(): void {
    this._dom.thead.innerHTML = '';
    this._buildHeader();
  }

  // ── Column toggle ────────────────────────────────────────────────────────────

  private _showColumnToggle(anchor: HTMLElement): void {
    const existing = document.querySelector('.arianna-wip-table__col-menu');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.className = 'arianna-wip-table__col-menu';
    const rect = anchor.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top      = rect.bottom + 4 + 'px';
    menu.style.left     = rect.left   + 'px';

    this.get<TableColumn<R>[]>('columns') ?? [].forEach((col: TableColumn<R>) => {
      const row = document.createElement('label');
      row.className = 'arianna-wip-table__col-menu-row';
      const cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.checked = col.visible !== false;
      cb.addEventListener('change', () => {
        col.visible = cb.checked;
        this._rebuildHeader();
        this._renderBody();
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(' ' + col.label));
      menu.appendChild(row);
    });

    document.body.appendChild(menu);
    const close = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 10);
  }

  // ── Process ──────────────────────────────────────────────────────────────────

  private async _process(): Promise<void> {
    return this._processLocal();
  }
}

// ── Default CSS ────────────────────────────────────────────────────────────────

/**
 * Inject default Table styles.
 *
 * @example
 *   import { injectTableStyles } from 'arianna-wip/controls/Table';
 *   injectTableStyles();
 */
export function injectTableStyles(): void {
  if (document.getElementById('arianna-wip-table-styles')) return;
  const style = document.createElement('style');
  style.id = 'arianna-wip-table-styles';
  style.textContent = `
.arianna-table-wrap {
  --tbl-bg        : var(--bg2, #161616);
  --tbl-border    : var(--b, #2a2a2a);
  --tbl-head-bg   : var(--bg3, #1e1e1e);
  --tbl-row-hover : rgba(255,255,255,.04);
  --tbl-sel       : rgba(126,184,247,.15);
  --tbl-sel-border: #7eb8f7;
  --tbl-text      : var(--text, #e0e0e0);
  --tbl-muted     : var(--muted, #888);
  --tbl-radius    : 6px;

  display       : flex;
  flex-direction: column;
  background    : var(--tbl-bg);
  border        : 1px solid var(--tbl-border);
  border-radius : var(--tbl-radius);
  overflow      : hidden;
  font-size     : .82rem;
  color         : var(--tbl-text);
}
.arianna-table__toolbar {
  display    : flex;
  align-items: center;
  gap        : 8px;
  padding    : 8px 12px;
  border-bottom: 1px solid var(--tbl-border);
  background : var(--tbl-head-bg);
}
.arianna-table__search, .arianna-table__col-filter {
  background: rgba(255,255,255,.06); border: 1px solid var(--tbl-border);
  border-radius: 4px; color: inherit; font-size: .82rem;
  padding: 4px 8px; outline: none; flex: 1;
}
.arianna-table__search:focus, .arianna-table__col-filter:focus {
  border-color: var(--tbl-sel-border);
}
.arianna-table__btn {
  background: rgba(255,255,255,.06); border: 1px solid var(--tbl-border);
  border-radius: 4px; color: inherit; cursor: pointer; font-size: .78rem;
  padding: 4px 10px; white-space: nowrap;
}
.arianna-table__btn:hover { background: rgba(255,255,255,.1); }
.arianna-table__scroll { overflow-x: auto; flex: 1; }
.arianna-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
}
.arianna-table__th {
  background : var(--tbl-head-bg);
  border-bottom: 2px solid var(--tbl-border);
  padding    : 8px 12px;
  text-align : left;
  font-weight: 600;
  font-size  : .78rem;
  color      : var(--tbl-muted);
  white-space: nowrap;
  position   : sticky;
  top        : 0;
  z-index    : 1;
  user-select: none;
}
.arianna-table__th-inner { display: flex; align-items: center; gap: 4px; }
.arianna-table__th--sortable { cursor: pointer; }
.arianna-table__th--sortable:hover { color: var(--tbl-text); }
.arianna-table__sort-arrow { font-size: .7rem; opacity: .5; }
.arianna-table__resize-handle {
  position: absolute; right: 0; top: 0; bottom: 0;
  width: 4px; cursor: col-resize;
}
.arianna-table__td {
  padding: 8px 12px; border-bottom: 1px solid var(--tbl-border);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
tbody tr:hover .arianna-table__td { background: var(--tbl-row-hover); }
tbody tr.selected .arianna-table__td {
  background: var(--tbl-sel);
  border-left: 2px solid var(--tbl-sel-border);
}
.arianna-table__th--check, .arianna-table__td--check { width: 36px; text-align: center; }
.arianna-table__footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px; border-top: 1px solid var(--tbl-border);
  background: var(--tbl-head-bg); flex-shrink: 0;
}
.arianna-table__info { color: var(--tbl-muted); font-size: .78rem; }
.arianna-table__pager { display: flex; align-items: center; gap: 4px; }
.arianna-table__page-btn {
  background: transparent; border: 1px solid var(--tbl-border);
  border-radius: 3px; color: inherit; cursor: pointer;
  font-size: .78rem; min-width: 28px; padding: 2px 6px;
}
.arianna-table__page-btn:hover:not(:disabled) { border-color: var(--tbl-sel-border); }
.arianna-table__page-btn.active {
  background: var(--tbl-sel-border); color: #000; border-color: var(--tbl-sel-border);
}
.arianna-table__page-btn:disabled { opacity: .35; cursor: default; }
.arianna-table__page-size {
  background: rgba(255,255,255,.06); border: 1px solid var(--tbl-border);
  border-radius: 3px; color: inherit; font-size: .78rem; padding: 2px 4px;
}
.arianna-table__empty, .arianna-table__spinner {
  text-align: center; padding: 40px 20px; color: var(--tbl-muted);
}
.arianna-table__col-menu {
  background: var(--tbl-head-bg); border: 1px solid var(--tbl-border);
  border-radius: 5px; box-shadow: 0 8px 24px rgba(0,0,0,.4);
  min-width: 160px; padding: 8px 0; z-index: 9999;
}
.arianna-table__col-menu-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 14px; cursor: pointer; font-size: .82rem;
}
.arianna-table__col-menu-row:hover { background: var(--tbl-row-hover); }
`;
  document.head.appendChild(style);
}
