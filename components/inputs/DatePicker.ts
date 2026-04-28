/**
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 */

/**
 * @module DatePicker
 * @example
 *   const dp = new DatePicker('#root', { label: 'Start date' });
 *   dp.value = '2026-04-08';
 *   dp.on('change', ({ value }) => console.log(value));
 */
import { Control } from '../core/Control.ts';
export interface DatePickerOptions { label?: string; min?: string; max?: string; disabled?: boolean; class?: string; }
export class DatePicker extends Control<DatePickerOptions> {
  private _value = '';
  private _open  = false;
  private _view  = new Date();
  constructor(container: string | HTMLElement | null = null, opts: DatePickerOptions = {}) {
    super(container, 'div', opts);
    this.el.className = `ar-datepicker${opts.class?' '+opts.class:''}`;
    this._on(document as unknown as HTMLElement, 'click', (e: MouseEvent) => { if (!this.el.contains(e.target as Node)) { this._open = false; this._build(); } });
  }
  set value(v: string) { this._value = v; if (v) this._view = new Date(v + 'T12:00:00'); this._build(); }
  get value()          { return this._value; }
  protected _build() {
    this.el.innerHTML = '';
    const lbl = this._get('label', '') as string; if (lbl) this._el('div', 'ar-datepicker__label', this.el).textContent = lbl;
    const trigger = this._el('div', 'ar-datepicker__trigger', this.el);
    const lv = this._el('span', 'ar-datepicker__value', trigger); lv.textContent = this._value || 'Select date…';
    if (!this._value) lv.classList.add('ar-datepicker__placeholder');
    this._el('span', 'ar-datepicker__icon', trigger).textContent = '📅';
    if (!this._get('disabled', false)) trigger.addEventListener('click', e => { e.stopPropagation(); this._open = !this._open; this._build(); });
    if (this._open) this._buildCalendar();
  }
  private _buildCalendar() {
    const cal = this._el('div', 'ar-datepicker__calendar', this.el);
    const y = this._view.getFullYear(); const m = this._view.getMonth();
    const header = this._el('div', 'ar-datepicker__cal-header', cal);
    const prev = this._el('button', 'ar-datepicker__nav', header) as HTMLButtonElement;
    prev.textContent = '‹'; prev.addEventListener('click', e => { e.stopPropagation(); this._view = new Date(y, m - 1, 1); this._build(); });
    this._el('span', 'ar-datepicker__cal-title', header).textContent = this._view.toLocaleString('default', { month: 'long', year: 'numeric' });
    const next = this._el('button', 'ar-datepicker__nav', header) as HTMLButtonElement;
    next.textContent = '›'; next.addEventListener('click', e => { e.stopPropagation(); this._view = new Date(y, m + 1, 1); this._build(); });
    const grid = this._el('div', 'ar-datepicker__grid', cal);
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => { this._el('div', 'ar-datepicker__day-name', grid).textContent = d; });
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < firstDay; i++) this._el('div', 'ar-datepicker__day ar-datepicker__day--empty', grid);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const btn = this._el('button', `ar-datepicker__day${dateStr===this._value?' ar-datepicker__day--selected':''}${dateStr===today?' ar-datepicker__day--today':''}`, grid) as HTMLButtonElement;
      btn.textContent = String(d);
      const min = this._get('min', '') as string; const max = this._get('max', '') as string;
      if ((min && dateStr < min) || (max && dateStr > max)) { btn.disabled = true; btn.classList.add('ar-datepicker__day--disabled'); }
      else btn.addEventListener('click', e => { e.stopPropagation(); this._value = dateStr; this._open = false; this._emit('change', { value: dateStr, date: new Date(dateStr+'T12:00:00') }); this._build(); });
    }
  }
}
export const DatePickerCSS = `.ar-datepicker{position:relative;user-select:none}.ar-datepicker__label{color:var(--ar-muted);font-size:.78rem;font-weight:500;margin-bottom:4px}.ar-datepicker__trigger{align-items:center;background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius);cursor:pointer;display:flex;gap:8px;padding:6px 10px;transition:border-color var(--ar-transition)}.ar-datepicker__trigger:hover{border-color:var(--ar-border2)}.ar-datepicker__value{flex:1;font-size:.82rem}.ar-datepicker__placeholder{color:var(--ar-muted)}.ar-datepicker__calendar{background:var(--ar-bg3);border:1px solid var(--ar-border);border-radius:var(--ar-radius-lg);box-shadow:var(--ar-shadow-lg);left:0;min-width:264px;padding:10px;position:absolute;top:calc(100% + 4px);z-index:500}.ar-datepicker__cal-header{align-items:center;display:flex;justify-content:space-between;margin-bottom:8px}.ar-datepicker__nav{background:none;border:none;color:var(--ar-text);cursor:pointer;font-size:1rem;padding:4px 8px;border-radius:var(--ar-radius-sm)}.ar-datepicker__nav:hover{background:var(--ar-bg4)}.ar-datepicker__cal-title{font-size:.85rem;font-weight:600}.ar-datepicker__grid{display:grid;gap:2px;grid-template-columns:repeat(7,1fr)}.ar-datepicker__day-name{color:var(--ar-muted);font-size:.68rem;font-weight:600;padding:4px;text-align:center}.ar-datepicker__day{background:none;border:none;border-radius:var(--ar-radius-sm);color:var(--ar-text);cursor:pointer;font:inherit;font-size:.78rem;padding:5px 2px;text-align:center;transition:background var(--ar-transition)}.ar-datepicker__day:hover:not(:disabled){background:var(--ar-bg4)}.ar-datepicker__day--selected{background:var(--ar-primary)!important;color:var(--ar-primary-text)}.ar-datepicker__day--today{border:1px solid var(--ar-primary);color:var(--ar-primary)}.ar-datepicker__day--today.ar-datepicker__day--selected{color:var(--ar-primary-text)}.ar-datepicker__day--disabled{color:var(--ar-dim);cursor:not-allowed}.ar-datepicker__day--empty{visibility:hidden}`;
