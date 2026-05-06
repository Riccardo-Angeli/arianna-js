/**
 * @module    components/tracking/TrackingMulti
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Multi-carrier shipment tracker. Given a tracking number, it auto-detects
 * the most likely carrier by matching against each carrier's regex and
 * mounts the corresponding subcomponent. If multiple carriers match (which
 * happens with ambiguous numeric formats), it presents a small picker.
 *
 *   ┌──────────────────────────────────────┐
 *   │ Tracking number                      │
 *   │ [123456789012345        ] [Track]    │
 *   ├──────────────────────────────────────┤
 *   │ ⚠ Multiple carriers match this number│
 *   │   ◯ FedEx   ◯ DHL                   │
 *   ├──────────────────────────────────────┤
 *   │  …mounted DHLTracker / FedExTracker… │
 *   └──────────────────────────────────────┘
 *
 * Programmatic API: `setNumber(n)`, `setCarrier(id)`, `getCarrier()`,
 * `setEvents(events)`, `getActive()`. Events from the active subcomponent
 * bubble up through this widget tagged with the carrier id.
 *
 * @example
 *   import { TrackingMulti } from 'ariannajs/components/tracking';
 *
 *   const t = new TrackingMulti('#tracker');
 *   t.setNumber('1Z999AA10123456784');     // → auto-detected as UPS
 *   t.on('detected', e => console.log('Carrier:', e.carrier));
 *   t.setEvents(await api.fetchEvents(t.getCarrier(), t.getNumber()));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';
import { type CarrierConfig, type TrackingEvent, type TrackerOptions, Tracker } from './Tracker.ts';
import { DHLTracker   } from './DHLTracker.ts';
import { UPSTracker   } from './UPSTracker.ts';
import { FedExTracker } from './FedExTracker.ts';
import { BRTTracker   } from './BRTTracker.ts';

// ── Types ────────────────────────────────────────────────────────────────────

export type CarrierId = 'dhl' | 'ups' | 'fedex' | 'brt';

interface CarrierEntry
{
    id      : CarrierId;
    name    : string;
    pattern : RegExp;
    factory : (mount: HTMLElement, opts: TrackerOptions) => Tracker;
}

const CARRIERS: CarrierEntry[] = [
    { id: 'ups',   name: 'UPS',   pattern: /^1Z[0-9A-Z]{16}$/i,         factory: (m, o) => new UPSTracker(m, o)   },
    { id: 'fedex', name: 'FedEx', pattern: /^(\d{12}|\d{15}|\d{20})$/,  factory: (m, o) => new FedExTracker(m, o) },
    { id: 'dhl',   name: 'DHL',   pattern: /^(\d{10,11}|[A-Z]{3}\d{7})$/i, factory: (m, o) => new DHLTracker(m, o) },
    { id: 'brt',   name: 'BRT',   pattern: /^\d{10,12}$/,               factory: (m, o) => new BRTTracker(m, o)   },
];

export interface TrackingMultiOptions extends CtrlOptions
{
    trackingNumber? : string;
    /** Force a specific carrier instead of auto-detecting. */
    carrier?        : CarrierId;
    /** Show the input + button. Default true. Set false if your app supplies the number programmatically. */
    showInput?      : boolean;
    /** Locale. */
    locale?         : string;
    /** Initial events to display once a carrier is selected. */
    events?         : TrackingEvent[];
}

// ── Component ────────────────────────────────────────────────────────────────

export class TrackingMulti extends Control<TrackingMultiOptions>
{
    private _number   : string = '';
    private _carrier  : CarrierId | null = null;
    private _events   : TrackingEvent[] = [];
    private _active   : Tracker | null = null;

    private _elInput!  : HTMLInputElement;
    private _elBtn!    : HTMLButtonElement;
    private _elPicker! : HTMLElement;
    private _elMount!  : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: TrackingMultiOptions = {})
    {
        super(container, 'div', { showInput: true, ...opts });

        this.el.className = `ar-trk-multi${opts.class ? ' ' + opts.class : ''}`;
        this._number  = opts.trackingNumber ?? '';
        this._carrier = opts.carrier ?? null;
        this._events  = opts.events ?? [];
        this._injectStyles();
        this._build();

        if (this._number)
        {
            if (this._carrier) this._mount(this._carrier);
            else               this._autoDetect();
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /** Currently-detected (or forced) carrier id, or null. */
    getCarrier(): CarrierId | null { return this._carrier; }

    /** Current tracking number. */
    getNumber(): string { return this._number; }

    /** Active sub-Tracker instance, or null. */
    getActive(): Tracker | null { return this._active; }

    /**
     * Set / change the tracking number. Triggers auto-detection unless
     * `carrier` was forced via the constructor or `setCarrier`.
     */
    setNumber(n: string): this
    {
        this._number = n.trim();
        if (this._elInput) this._elInput.value = this._number;
        if (!this._number)
        {
            this._unmount();
            return this;
        }
        if (this._carrier) this._mount(this._carrier);
        else               this._autoDetect();
        return this;
    }

    /** Force a specific carrier (skips auto-detection). */
    setCarrier(id: CarrierId): this
    {
        this._carrier = id;
        if (this._number) this._mount(id);
        return this;
    }

    /**
     * Forward events to the active subcomponent. If no carrier is mounted
     * yet, the events are buffered and applied when one becomes active.
     */
    setEvents(events: TrackingEvent[]): this
    {
        this._events = events.slice();
        if (this._active) this._active.setEvents(this._events);
        return this;
    }

    /** Carriers whose pattern matches the current tracking number. */
    getCandidates(): CarrierId[]
    {
        if (!this._number) return [];
        return CARRIERS.filter(c => c.pattern.test(this._number)).map(c => c.id);
    }

    // ── Internal ───────────────────────────────────────────────────────────

    protected _build(): void
    {
        const showInput = this._get<boolean>('showInput', true);
        this.el.innerHTML = `
${showInput ? `
<div class="ar-trk-multi__head">
  <input class="ar-trk-multi__inp" data-r="inp" type="text" placeholder="Tracking number">
  <button class="ar-trk-multi__btn" data-r="btn" type="button">Track</button>
</div>` : ''}
<div class="ar-trk-multi__picker" data-r="picker" style="display:none"></div>
<div class="ar-trk-multi__mount"  data-r="mount"></div>`;

        if (showInput)
        {
            this._elInput = this.el.querySelector<HTMLInputElement>('[data-r="inp"]')!;
            this._elBtn   = this.el.querySelector<HTMLButtonElement>('[data-r="btn"]')!;
            this._elInput.value = this._number;
            this._elInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.setNumber(this._elInput.value);
            });
            this._elBtn.addEventListener('click', () => this.setNumber(this._elInput.value));
        }

        this._elPicker = this.el.querySelector<HTMLElement>('[data-r="picker"]')!;
        this._elMount  = this.el.querySelector<HTMLElement>('[data-r="mount"]')!;
    }

    private _autoDetect(): void
    {
        const candidates = this.getCandidates();
        if (candidates.length === 0)
        {
            this._showPicker(`No known carrier matches this format.`, [], null);
            this._unmount();
            this._emit('not-recognised', { number: this._number });
            return;
        }
        if (candidates.length === 1)
        {
            this._hidePicker();
            this._mount(candidates[0]!);
            this._emit('detected', { carrier: candidates[0], number: this._number });
            return;
        }

        // Ambiguous — present a picker and pick the first as default
        this._showPicker(`This number could be from multiple carriers — pick one:`, candidates, candidates[0]!);
        this._mount(candidates[0]!);
        this._emit('ambiguous', { carriers: candidates, number: this._number });
    }

    private _showPicker(label: string, candidates: CarrierId[], selected: CarrierId | null): void
    {
        this._elPicker.style.display = '';
        this._elPicker.innerHTML = `
<div class="ar-trk-multi__picker-label">${escapeHtml(label)}</div>
${candidates.length ? `<div class="ar-trk-multi__picker-row">
  ${candidates.map(id => {
      const c = CARRIERS.find(x => x.id === id)!;
      const sel = id === selected;
      return `<label class="ar-trk-multi__picker-opt${sel ? ' ar-trk-multi__picker-opt--sel' : ''}">
        <input type="radio" name="ar-trk-pick" data-pick="${id}"${sel ? ' checked' : ''}>
        <span>${escapeHtml(c.name)}</span>
      </label>`;
  }).join('')}
</div>` : ''}`;

        this._elPicker.querySelectorAll<HTMLInputElement>('[data-pick]').forEach(r => {
            r.addEventListener('change', () => {
                if (!r.checked) return;
                const id = r.dataset.pick as CarrierId;
                this._mount(id);
                // Update visual selection
                this._elPicker.querySelectorAll('.ar-trk-multi__picker-opt').forEach(el =>
                    el.classList.toggle('ar-trk-multi__picker-opt--sel', el.contains(r)));
                this._emit('select', { carrier: id, number: this._number });
            });
        });
    }

    private _hidePicker(): void
    {
        this._elPicker.style.display = 'none';
        this._elPicker.innerHTML = '';
    }

    private _mount(id: CarrierId): void
    {
        if (this._active && this._carrier === id) return;     // already mounted right one
        this._unmount();

        const entry = CARRIERS.find(c => c.id === id);
        if (!entry) return;

        this._carrier = id;
        const inner = document.createElement('div');
        this._elMount.appendChild(inner);
        this._active = entry.factory(inner, {
            trackingNumber: this._number,
            events        : this._events,
            locale        : this._get<string>('locale', '') || undefined,
        });

        // Bubble events up tagged with the carrier
        for (const evt of ['events', 'open-portal'])
        {
            this._active.on(evt, (data: unknown) =>
                this._emit(evt, { carrier: id, ...(data as Record<string, unknown>) }));
        }
    }

    private _unmount(): void
    {
        this._elMount.innerHTML = '';
        this._active = null;
    }

    private _injectStyles(): void
    {
        if (document.getElementById('ar-trk-multi-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-trk-multi-styles';
        s.textContent = `
.ar-trk-multi { display:flex; flex-direction:column; gap:10px; max-width:520px; font:13px -apple-system,system-ui,sans-serif; }
.ar-trk-multi__head { display:flex; gap:6px; }
.ar-trk-multi__inp  { flex:1; background:#0d0d0d; border:1px solid #333; color:#d4d4d4; padding:9px 12px; font:13px ui-monospace,monospace; border-radius:4px; }
.ar-trk-multi__inp:focus { outline:none; border-color:#e40c88; }
.ar-trk-multi__btn  { background:#e40c88; color:#fff; border:0; padding:9px 18px; font:600 13px sans-serif; border-radius:4px; cursor:pointer; }
.ar-trk-multi__btn:hover { background:#c30b75; }
.ar-trk-multi__picker { padding:10px 12px; background:#252525; border:1px solid #444; border-radius:4px; }
.ar-trk-multi__picker-label { font:12px sans-serif; color:#eab308; margin-bottom:6px; }
.ar-trk-multi__picker-row { display:flex; flex-wrap:wrap; gap:8px; }
.ar-trk-multi__picker-opt { display:inline-flex; gap:6px; align-items:center; padding:4px 10px; background:#1e1e1e; border:1px solid #444; border-radius:14px; cursor:pointer; font:12px sans-serif; }
.ar-trk-multi__picker-opt:hover { border-color:#666; }
.ar-trk-multi__picker-opt--sel { border-color:#e40c88; background:rgba(228,12,136,0.15); }
.ar-trk-multi__picker-opt input { margin:0; }
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
