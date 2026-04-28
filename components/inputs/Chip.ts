/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Chip
 * Selectable chip / tag for filters or selections.
 * @example
 *   const chips = new Chip('#root');
 *   chips.options = ['React', 'Vue', 'Angular', 'AriannA'];
 *   chips.selected = ['AriannA'];
 *   chips.on('change', ({ selected }) => console.log(selected));
 */
import { Control } from '../core/Control.ts';
export interface ChipOptions { multiple?: boolean; removable?: boolean; class?: string; }
export class Chip extends Control<ChipOptions> {
  private _options : string[] = [];
  private _selected = new Set<string>();
  constructor(container: string | HTMLElement | null = null, opts: ChipOptions = {}) {
    super(container, 'div', { multiple: true, removable: false, ...opts });
    this.el.className = `ar-chip-group${opts.class?' '+opts.class:''}`;
  }
  set options(v: string[])  { this._options = v; this._set('options' as never, v as never); }
  set selected(v: string[]) { this._selected = new Set(v); this._build(); }
  get selected()            { return [...this._selected]; }
  protected _build() {
    this.el.innerHTML = '';
    this._options.forEach(opt => {
      const isOn = this._selected.has(opt);
      const chip = this._el('button', `ar-chip${isOn?' ar-chip--on':''}`, this.el) as HTMLButtonElement;
      chip.textContent = opt;
      chip.addEventListener('click', () => {
        if (isOn) this._selected.delete(opt);
        else { if (!this._get('multiple', true)) this._selected.clear(); this._selected.add(opt); }
        this._emit('change', { selected: this.selected }); this._build();
      });
      if (this._get('removable', false) && isOn) {
        const x = this._el('span', 'ar-chip__remove', chip); x.textContent = ' ✕';
        x.addEventListener('click', e => { e.stopPropagation(); this._selected.delete(opt); this._emit('change', { selected: this.selected }); this._build(); });
      }
    });
  }
}
export const ChipCSS = `.ar-chip-group{display:flex;flex-wrap:wrap;gap:6px}.ar-chip{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:16px;color:var(--ar-text);cursor:pointer;font:inherit;font-size:.78rem;padding:4px 12px;transition:all var(--ar-transition);user-select:none}.ar-chip:hover{border-color:var(--ar-primary);color:var(--ar-primary)}.ar-chip--on{background:rgba(126,184,247,.15);border-color:var(--ar-primary);color:var(--ar-primary)}.ar-chip__remove{cursor:pointer;opacity:.7}`;
