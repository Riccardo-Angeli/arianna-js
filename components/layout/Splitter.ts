/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
export interface SplitterOptions { direction?: 'horizontal'|'vertical'; ratio?: number; minA?: number; minB?: number; class?: string; }
export class Splitter extends Control<SplitterOptions> {
  private _paneA: HTMLElement|null = null;
  private _paneB: HTMLElement|null = null;
  private _ratio = 0.5;
  constructor(container: string | HTMLElement | null = null, opts: SplitterOptions = {}) {
    super(container, 'div', { direction: 'horizontal', ratio: 0.5, minA: 60, minB: 60, ...opts });
    this._ratio = opts.ratio ?? 0.5;
    this.el.className = `ar-splitter ar-splitter--${opts.direction??'horizontal'}${opts.class?' '+opts.class:''}`;
  }
  set paneA(el: HTMLElement) { this._paneA = el; this._build(); }
  set paneB(el: HTMLElement) { this._paneB = el; this._build(); }
  set ratio(v: number)       { this._ratio = Math.max(0.05, Math.min(0.95, v)); this._build(); }
  get ratio()                { return this._ratio; }
  protected _build() {
    this.el.innerHTML = '';
    const isH    = (this._get('direction', 'horizontal') as string) === 'horizontal';
    const paneA  = this._el('div', 'ar-splitter__pane ar-splitter__pane-a', this.el);
    const handle = this._el('div', 'ar-splitter__handle', this.el);
    const paneB  = this._el('div', 'ar-splitter__pane ar-splitter__pane-b', this.el);
    if (this._paneA) paneA.appendChild(this._paneA);
    if (this._paneB) paneB.appendChild(this._paneB);
    const apply = () => {
      const r = this._ratio * 100;
      if (isH) { paneA.style.width = r+'%'; paneB.style.width = (100-r)+'%'; }
      else      { paneA.style.height = r+'%'; paneB.style.height = (100-r)+'%'; }
    };
    apply();
    this._on(handle, 'mousedown', (e: MouseEvent) => {
      e.preventDefault();
      const rect = this.el.getBoundingClientRect();
      const minA = this._get('minA', 60) as number;
      const minB = this._get('minB', 60) as number;
      const move = (e2: MouseEvent) => {
        const total  = isH ? rect.width : rect.height;
        const offset = isH ? e2.clientX - rect.left : e2.clientY - rect.top;
        this._ratio  = Math.max(minA/total, Math.min(1 - minB/total, offset/total));
        apply(); this._emit('resize', { ratio: this._ratio });
      };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }
}
export const SplitterCSS = `.ar-splitter{display:flex;width:100%;height:100%;overflow:hidden}.ar-splitter--vertical{flex-direction:column}.ar-splitter__pane{overflow:auto}.ar-splitter__handle{background:var(--ar-border);flex-shrink:0;transition:background var(--ar-transition)}.ar-splitter__handle:hover,.ar-splitter__handle:active{background:var(--ar-primary)}.ar-splitter--horizontal .ar-splitter__handle{cursor:col-resize;width:4px}.ar-splitter--vertical .ar-splitter__handle{cursor:row-resize;height:4px}`;
