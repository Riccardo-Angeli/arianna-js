/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Dropdown
 * @example
 *   const dd = new Dropdown('#root', { placeholder: 'Choose country' });
 *   dd.options = [{ value: 'it', label: 'Italy' }, { value: 'ch', label: 'Switzerland' }];
 *   dd.value = 'ch';
 *   dd.on('change', ({ value }) => console.log(value));
 */
import { Control } from '../core/Control.ts';
export interface DropdownOption { value: string; label: string; icon?: string; disabled?: boolean; }
export interface DropdownOptions { placeholder?: string; searchable?: boolean; clearable?: boolean; disabled?: boolean; class?: string; }
export class Dropdown extends Control<DropdownOptions> {
  private _options: DropdownOption[] = [];
  private _value  = '';
  private _open   = false;
  private _filter = '';
  constructor(container: string | HTMLElement | null = null, opts: DropdownOptions = {}) {
    super(container, 'div', { placeholder: 'Select…', searchable: false, clearable: false, ...opts });
    this.el.className = `ar-dropdown${opts.class?' '+opts.class:''}`;
    this._on(document as unknown as HTMLElement, 'click', (e: MouseEvent) => { if (!this.el.contains(e.target as Node)) this._closeList(); });
  }
  set options(v: DropdownOption[]) { this._options = v; this._set('options' as never, v as never); }
  set value(v: string)             { this._value = v; this._build(); }
  get value()                      { return this._value; }
  get selectedOption()             { return this._options.find(o => o.value === this._value); }
  private _closeList()             { this._open = false; this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    const sel     = this.selectedOption;
    const trigger = this._el('div', 'ar-dropdown__trigger', this.el);
    if (sel?.icon) this._el('span', 'ar-dropdown__icon', trigger).textContent = sel.icon;
    const lbl = this._el('span', 'ar-dropdown__value', trigger);
    lbl.textContent = sel?.label ?? this._get('placeholder', 'Select…') as string;
    if (!sel) lbl.classList.add('ar-dropdown__placeholder');
    if (this._get('clearable', false) && sel) {
      const x = this._el('button', 'ar-dropdown__clear', trigger) as HTMLButtonElement;
      x.textContent = '✕';
      x.addEventListener('click', e => { e.stopPropagation(); this._value = ''; this._emit('change', { value: '', option: null }); this._build(); });
    }
    this._el('span', 'ar-dropdown__arrow', trigger).textContent = this._open ? '▾' : '▸';
    if (!this._get('disabled', false)) {
      trigger.addEventListener('click', e => { e.stopPropagation(); this._open = !this._open; this._build(); });
    }
    if (this._open) {
      const list = this._el('div', 'ar-dropdown__list', this.el);
      if (this._get('searchable', false)) {
        const inp = document.createElement('input');
        inp.type = 'text'; inp.className = 'ar-dropdown__search'; inp.placeholder = 'Search…'; inp.value = this._filter;
        inp.addEventListener('input', () => { this._filter = inp.value; this._renderOptions(list); });
        inp.addEventListener('click', e => e.stopPropagation());
        list.appendChild(inp); setTimeout(() => inp.focus(), 0);
      }
      this._renderOptions(list);
    }
  }
  private _renderOptions(list: HTMLElement) {
    list.querySelectorAll('.ar-dropdown__option').forEach(e => e.remove());
    const q = this._filter.toLowerCase();
    const filtered = q ? this._options.filter(o => o.label.toLowerCase().includes(q)) : this._options;
    filtered.forEach(opt => {
      const row = this._el('div', `ar-dropdown__option${opt.value===this._value?' ar-dropdown__option--active':''}${opt.disabled?' ar-dropdown__option--disabled':''}`, list);
      if (opt.icon) this._el('span', '', row).textContent = opt.icon;
      this._el('span', '', row).textContent = opt.label;
      if (!opt.disabled) row.addEventListener('click', e => { e.stopPropagation(); this._value = opt.value; this._filter = ''; this._open = false; this._emit('change', { value: opt.value, option: opt }); this._build(); });
    });
  }
}
export const DropdownCSS = `.ar-dropdown{position:relative;user-select:none}.ar-dropdown__trigger{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);cursor:pointer;display:flex;gap:6px;padding:6px 10px;transition:border-color var(--ar-transition)}.ar-dropdown__trigger:hover{border-color:var(--ar-border2)}.ar-dropdown__value{flex:1;font-size:.82rem}.ar-dropdown__placeholder{color:var(--ar-muted)}.ar-dropdown__arrow{color:var(--ar-muted);font-size:.7rem}.ar-dropdown__clear{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.8rem;line-height:1;padding:0}.ar-dropdown__list{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);box-shadow:var(--ar-shadow-lg);left:0;max-height:240px;overflow-y:auto;padding:4px 0;position:absolute;right:0;top:calc(100% + 4px);z-index:500}.ar-dropdown__search{border:none;border-bottom:1px solid var(--ar-border);color:var(--ar-text);display:block;font:inherit;font-size:.82rem;outline:none;padding:7px 12px;width:100%;background:transparent}.ar-dropdown__option{align-items:center;cursor:pointer;display:flex;font-size:.82rem;gap:6px;padding:7px 12px;transition:background var(--ar-transition)}.ar-dropdown__option:hover{background:var(--ar-bg4)}.ar-dropdown__option--active{color:var(--ar-primary);font-weight:500}.ar-dropdown__option--disabled{opacity:.4;cursor:not-allowed}`;
