/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

import { Control } from '../core/Control.ts';
export interface StepperOptions { variant?: 'horizontal'|'vertical'; class?: string; }
export class Stepper extends Control<StepperOptions> {
  private _steps: string[] = [];
  private _current   = 0;
  private _completed = new Set<number>();
  constructor(container: string | HTMLElement | null = null, opts: StepperOptions = {}) {
    super(container, 'div', opts);
    this.el.className = `ar-stepper ar-stepper--${opts.variant??'horizontal'}${opts.class?' '+opts.class:''}`;
  }
  set steps(v: string[]) { this._steps = v; this._set('steps' as never, v as never); }
  set current(n: number) { this._current = n; this._build(); }
  get current()          { return this._current; }
  next() { if (this._current < this._steps.length - 1) { this._completed.add(this._current); this._current++; this._build(); this._emit('change', { step: this._current }); } }
  prev() { if (this._current > 0) { this._current--; this._build(); this._emit('change', { step: this._current }); } }
  complete(n = this._current) { this._completed.add(n); this._build(); }
  protected _build() {
    this.el.innerHTML = '';
    this._steps.forEach((label, i) => {
      const isDone    = this._completed.has(i);
      const isActive  = i === this._current;
      const isPending = i > this._current && !isDone;
      const step = this._el('div', `ar-stepper__step${isActive?' ar-stepper__step--active':''}${isDone?' ar-stepper__step--done':''}${isPending?' ar-stepper__step--pending':''}`, this.el);
      const dot  = this._el('div', 'ar-stepper__dot', step);
      dot.textContent = isDone ? '✓' : String(i + 1);
      const lbl = this._el('div', 'ar-stepper__label', step); lbl.textContent = label;
      if (i < this._steps.length - 1) this._el('div', 'ar-stepper__line', this.el);
    });
  }
}
export const StepperCSS = `.ar-stepper{display:flex;align-items:flex-start}.ar-stepper--vertical{flex-direction:column}.ar-stepper__step{align-items:center;display:flex;flex-direction:column;gap:4px;min-width:64px;text-align:center}.ar-stepper__dot{align-items:center;background:var(--ar-bg4);border:2px solid var(--ar-border);border-radius:50%;color:var(--ar-muted);display:flex;font-size:.7rem;font-weight:600;height:28px;justify-content:center;width:28px;transition:all var(--ar-transition)}.ar-stepper__step--active .ar-stepper__dot{background:var(--ar-primary);border-color:var(--ar-primary);color:var(--ar-primary-text)}.ar-stepper__step--done .ar-stepper__dot{background:var(--ar-success);border-color:var(--ar-success);color:#fff}.ar-stepper__label{font-size:.72rem;color:var(--ar-muted)}.ar-stepper__step--active .ar-stepper__label{color:var(--ar-text);font-weight:600}.ar-stepper__line{flex:1;height:2px;background:var(--ar-border);margin-top:-14px;align-self:flex-start;margin-left:-32px;margin-right:-32px}`;
