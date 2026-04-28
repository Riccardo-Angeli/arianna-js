/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module Tag
 * Removable tag / label.
 * @example
 *   const tags = new Tag('#root');
 *   tags.items = ['TypeScript', 'AriannA', 'Rust'];
 *   tags.on('remove', ({ item }) => console.log('removed', item));
 */
import { Control } from '../core/Control.ts';
export interface TagOptions { removable?: boolean; class?: string; }
export class Tag extends Control<TagOptions> {
  private _items: string[] = [];
  constructor(container: string | HTMLElement | null = null, opts: TagOptions = {}) {
    super(container, 'div', { removable: false, ...opts });
    this.el.className = `ar-tag-group${opts.class?' '+opts.class:''}`;
  }
  set items(v: string[])    { this._items = v; this._set('items' as never, v as never); }
  get items()               { return this._items; }
  add(item: string)         { this._items.push(item); this._build(); }
  remove(item: string)      { this._items = this._items.filter(i => i !== item); this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    this._items.forEach(item => {
      const tag = this._el('span', 'ar-tag', this.el);
      tag.textContent = item;
      if (this._get('removable', false)) {
        const x = this._el('button', 'ar-tag__remove', tag) as HTMLButtonElement;
        x.textContent = '✕'; x.setAttribute('aria-label', 'Remove');
        x.addEventListener('click', () => { this.remove(item); this._emit('remove', { item }); });
      }
    });
  }
}
export const TagCSS = `.ar-tag-group{display:flex;flex-wrap:wrap;gap:6px}.ar-tag{align-items:center;background:var(--ar-bg4);border:1px solid var(--ar-border);border-radius:var(--ar-radius-sm);color:var(--ar-text);display:inline-flex;font-size:.75rem;gap:4px;padding:2px 8px}.ar-tag__remove{background:none;border:none;color:var(--ar-muted);cursor:pointer;font-size:.7rem;line-height:1;padding:0}.ar-tag__remove:hover{color:var(--ar-danger)}`;
