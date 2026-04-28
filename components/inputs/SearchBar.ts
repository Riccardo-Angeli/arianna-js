/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module SearchBar
 * @example
 *   const sb = new SearchBar('#root', { placeholder: 'Search…', debounce: 300 });
 *   sb.on('search', ({ value }) => fetchResults(value));
 */
import { Control } from '../core/Control.ts';
export interface SearchBarOptions { placeholder?: string; debounce?: number; class?: string; }
export class SearchBar extends Control<SearchBarOptions> {
  private _value = '';
  private _timer = 0;
  private _input!: HTMLInputElement;
  constructor(container: string | HTMLElement | null = null, opts: SearchBarOptions = {}) {
    super(container, 'div', { placeholder: 'Search…', debounce: 300, ...opts });
    this.el.className = `ar-searchbar${opts.class?' '+opts.class:''}`;
  }
  set value(v: string) { this._value = v; if (this._input) this._input.value = v; }
  get value()          { return this._input?.value ?? this._value; }
  focus()              { this._input?.focus(); }
  clear()              { this._value = ''; if (this._input) this._input.value = ''; this._emit('search', { value: '' }); this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    this._el('span', 'ar-searchbar__icon', this.el).textContent = '🔍';
    this._input = document.createElement('input');
    this._input.type = 'text'; this._input.className = 'ar-searchbar__input';
    this._input.placeholder = this._get('placeholder', 'Search…') as string;
    this._input.value = this._value;
    const clear = this._el('button', 'ar-searchbar__clear', this.el) as HTMLButtonElement;
    clear.textContent = '✕'; clear.style.visibility = this._value ? 'visible' : 'hidden';
    this._input.addEventListener('input', () => {
      const v = this._input.value; clear.style.visibility = v ? 'visible' : 'hidden';
      clearTimeout(this._timer);
      this._timer = window.setTimeout(() => { this._value = v; this._emit('search', { value: v }); }, this._get('debounce', 300) as number);
    });
    clear.addEventListener('click', () => { this._input.value = ''; this._value = ''; clear.style.visibility = 'hidden'; this._emit('search', { value: '' }); this._input.focus(); });
    this.el.insertBefore(this._input, clear);
  }
}
export const SearchBarCSS = `.ar-searchbar{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:20px;display:flex;gap:6px;padding:5px 12px;transition:border-color var(--ar-transition)}.ar-searchbar:focus-within{border-color:var(--ar-primary)}.ar-searchbar__icon{color:var(--ar-muted);flex-shrink:0}.ar-searchbar__input{background:none;border:none;color:var(--ar-text);flex:1;font:inherit;font-size:.82rem;min-width:0;outline:none}.ar-searchbar__clear{background:none;border:none;color:var(--ar-muted);cursor:pointer;flex-shrink:0;font-size:.8rem;line-height:1;padding:0}`;
