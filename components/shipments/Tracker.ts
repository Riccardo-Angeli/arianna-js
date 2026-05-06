/**
 * @module    components/tracking/Tracker
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Carrier-agnostic shipment-tracker base widget. Renders a unified timeline
 * of `TrackingEvent`s with status icon, location, timestamp, and a final
 * "Track on <carrier> →" button that opens the carrier's own tracking page
 * in a new tab. The 4 carrier-specific subclasses (DHL, UPS, FedEx, BRT)
 * configure brand colours, logos, the public tracking URL pattern, and a
 * regex for tracking-number validation; everything else is shared.
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ DHL · 1234567890                            │
 *   ├─────────────────────────────────────────────┤
 *   │ ● Delivered — Roma, IT — 06 May, 14:22       │
 *   │ │                                            │
 *   │ ● Out for delivery — Roma, IT — 06 May, 09:11│
 *   │ │                                            │
 *   │ ○ Arrived at hub — Milano, IT — 05 May, 23:14│
 *   │ │                                            │
 *   │ ○ In transit — DE → IT — 05 May, 06:00       │
 *   │ │                                            │
 *   │ ○ Picked up — Berlin, DE — 04 May, 18:30     │
 *   ├─────────────────────────────────────────────┤
 *   │       [ Track on DHL → ]                     │
 *   └─────────────────────────────────────────────┘
 *
 * IMPORTANT — API access: live carrier APIs require server-side credentials
 * (DHL Tracking API key, UPS OAuth, FedEx API client, BRT auth) that must
 * NEVER ship to the browser. The widget therefore expects the merchant
 * server to fetch, normalise, and feed it the events. As an escape hatch,
 * the widget can also operate in pure "link" mode where no events are
 * displayed and only the public tracking URL is exposed.
 *
 * @example
 *   import { DHLTracker } from 'ariannajs/components/tracking';
 *
 *   const t = new DHLTracker('#track', { trackingNumber: '1234567890' });
 *
 *   // Server fetched the events server-side; pass them in:
 *   t.setEvents([
 *       { kind: 'delivered',    location: 'Roma, IT',    at: Date.now() },
 *       { kind: 'out-delivery', location: 'Roma, IT',    at: Date.now() - 18000000 },
 *       { kind: 'arrived',      location: 'Milano, IT',  at: Date.now() - 50000000 },
 *   ]);
 *
 *   t.on('open-portal', e => analytics.track('tracker_external_open', { carrier: 'dhl' }));
 */

import { Control, type CtrlOptions } from '../core/Control.ts';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Normalised event kinds — every carrier's raw status text is mapped onto
 * one of these by the merchant's server. The widget knows how to colour /
 * icon each kind consistently across carriers.
 */
export type TrackingEventKind =
    | 'created'         // shipment label printed
    | 'picked-up'       // courier collected from sender
    | 'in-transit'      // travelling between hubs
    | 'arrived'         // arrived at a hub
    | 'customs'         // held at customs
    | 'out-delivery'    // out for delivery on local vehicle
    | 'delivered'       // delivered to recipient
    | 'failed'          // failed delivery attempt (returns next day, redirect, etc.)
    | 'returned'        // returned to sender
    | 'exception'       // generic problem (lost, damaged, address issue, …)
    | 'unknown';

export interface TrackingEvent
{
    kind     : TrackingEventKind;
    /** Free-form raw status text from the carrier (shown next to the kind label). */
    raw?     : string;
    /** Human-readable location string. */
    location?: string;
    /** Unix ms. */
    at       : number;
}

export interface CarrierConfig
{
    /** Carrier id (lowercase). */
    id          : string;
    /** Display name. */
    name        : string;
    /** Public tracking URL pattern. `{n}` is replaced with the tracking number. */
    publicUrl   : string;
    /** Brand colour. */
    color       : string;
    /** SVG logo (inline). */
    logo        : string;
    /** Regex that validates a tracking number for this carrier. */
    pattern?    : RegExp;
}

export interface TrackerOptions extends CtrlOptions
{
    trackingNumber : string;
    /** Initial events. May be empty; populate later via `setEvents`. */
    events?        : TrackingEvent[];
    /** Locale. Default browser default. */
    locale?        : string;
    /** Show the "Track on <carrier> →" button. Default true. */
    showPortalLink?: boolean;
    /** Open the portal link in a new tab. Default true. */
    openInNewTab?  : boolean;
}

// ── Base component ──────────────────────────────────────────────────────────

/**
 * Abstract base. Subclasses provide a `_carrier()` method returning their
 * `CarrierConfig`. Everything else is reused.
 */
export abstract class Tracker<O extends TrackerOptions = TrackerOptions> extends Control<O>
{
    private _events : TrackingEvent[] = [];
    private _elList!   : HTMLElement;
    private _elHeader! : HTMLElement;
    private _elFooter! : HTMLElement;

    constructor(container: string | HTMLElement | null, opts: O)
    {
        super(container, 'div', {
            showPortalLink: true,
            openInNewTab  : true,
            ...opts,
        });

        this.el.className = `ar-trk ar-trk--${this._carrier().id}${opts.class ? ' ' + opts.class : ''}`;
        this._events = (opts.events ?? []).slice();
        this._injectSharedStyles();
        this._build();
    }

    /** Subclasses provide their CarrierConfig. */
    protected abstract _carrier(): CarrierConfig;

    // ── Public API ─────────────────────────────────────────────────────────

    /** Replace the events list. Most-recent-first ordering is enforced. */
    setEvents(events: TrackingEvent[]): this
    {
        this._events = events.slice().sort((a, b) => b.at - a.at);
        this._renderTimeline();
        this._emit('events', { events: this._events.slice() });
        return this;
    }

    /** Append a single event (maintains sort order). */
    addEvent(e: TrackingEvent): this { return this.setEvents([...this._events, e]); }

    /** Current events (deep cloned). */
    getEvents(): TrackingEvent[] { return this._events.map(e => ({ ...e })); }

    /** The latest event, or null. */
    getLatest(): TrackingEvent | null { return this._events[0] ?? null; }

    /** The carrier-specific public URL for the current tracking number. */
    getPortalUrl(): string
    {
        const n = encodeURIComponent(this._get<string>('trackingNumber', ''));
        return this._carrier().publicUrl.replace('{n}', n);
    }

    /** Open the carrier portal. */
    openPortal(): this
    {
        const url = this.getPortalUrl();
        this._emit('open-portal', { url });
        if (this._get<boolean>('openInNewTab', true)) window.open(url, '_blank', 'noopener');
        else                                          window.location.href = url;
        return this;
    }

    /**
     * Validate the configured tracking number against the carrier's pattern.
     * Returns null if valid, or an error message.
     */
    validate(): string | null
    {
        const n = (this._get<string>('trackingNumber', '') || '').trim();
        if (!n) return 'tracking number missing';
        const p = this._carrier().pattern;
        if (p && !p.test(n)) return `does not look like a ${this._carrier().name} tracking number`;
        return null;
    }

    // ── Internal build / render ────────────────────────────────────────────

    protected _build(): void
    {
        const c = this._carrier();
        this.el.innerHTML = `
<div class="ar-trk__header" data-r="header"></div>
<div class="ar-trk__list"   data-r="list"></div>
<div class="ar-trk__footer" data-r="footer"></div>`;
        this._elHeader = this.el.querySelector<HTMLElement>('[data-r="header"]')!;
        this._elList   = this.el.querySelector<HTMLElement>('[data-r="list"]')!;
        this._elFooter = this.el.querySelector<HTMLElement>('[data-r="footer"]')!;

        // Header
        this._elHeader.style.borderLeft = `4px solid ${c.color}`;
        this._elHeader.innerHTML = `
<span class="ar-trk__logo">${c.logo}</span>
<span class="ar-trk__carrier">${escapeHtml(c.name)}</span>
<span class="ar-trk__number">${escapeHtml(this._get<string>('trackingNumber', ''))}</span>`;

        this._renderTimeline();

        // Footer
        if (this._get<boolean>('showPortalLink', true))
        {
            this._elFooter.innerHTML = `<button class="ar-trk__portal" data-r="portal" type="button">Track on ${escapeHtml(c.name)} →</button>`;
            this._elFooter.querySelector<HTMLButtonElement>('[data-r="portal"]')?.addEventListener('click', () => this.openPortal());
        }
    }

    private _renderTimeline(): void
    {
        if (!this._events.length)
        {
            this._elList.innerHTML = `<div class="ar-trk__empty">No tracking updates yet.</div>`;
            return;
        }

        const locale = this._get<string>('locale', '') || undefined;
        const html = this._events.map((e, i) => {
            const top = i === 0;
            return `
<div class="ar-trk__row${top ? ' ar-trk__row--top' : ''} ar-trk__row--${e.kind}">
  <div class="ar-trk__dot"></div>
  <div class="ar-trk__body">
    <div class="ar-trk__kind">${escapeHtml(EVENT_LABEL[e.kind] ?? e.kind)}</div>
    ${e.raw ? `<div class="ar-trk__raw">${escapeHtml(e.raw)}</div>` : ''}
    <div class="ar-trk__meta">
      ${e.location ? `<span class="ar-trk__loc">${escapeHtml(e.location)}</span>` : ''}
      <span class="ar-trk__time">${formatTime(e.at, locale)}</span>
    </div>
  </div>
</div>`;
        }).join('');
        this._elList.innerHTML = html;
    }

    private _injectSharedStyles(): void
    {
        if (document.getElementById('ar-trk-styles')) return;
        const s = document.createElement('style');
        s.id = 'ar-trk-styles';
        s.textContent = `
.ar-trk { display:flex; flex-direction:column; max-width:520px; background:#1e1e1e; border:1px solid #333; border-radius:8px; color:#d4d4d4; font:13px -apple-system,system-ui,sans-serif; overflow:hidden; }
.ar-trk__header { display:flex; align-items:center; gap:10px; padding:12px 16px; background:#252525; border-bottom:1px solid #333; }
.ar-trk__logo svg { display:block; height:20px; width:auto; }
.ar-trk__carrier { font:600 14px sans-serif; flex:1; }
.ar-trk__number  { font:12px ui-monospace,monospace; color:#888; }
.ar-trk__list { padding:12px 16px; max-height:340px; overflow-y:auto; }
.ar-trk__empty { padding:30px 0; text-align:center; color:#666; font-size:12px; }
.ar-trk__row { display:flex; gap:12px; padding-bottom:12px; position:relative; }
.ar-trk__row:not(:last-child)::before { content:''; position:absolute; left:5px; top:14px; bottom:0; width:2px; background:#333; }
.ar-trk__dot { width:12px; height:12px; border-radius:50%; background:#333; flex-shrink:0; margin-top:2px; z-index:1; border:2px solid #1e1e1e; }
.ar-trk__row--top .ar-trk__dot { background:#22c55e; box-shadow:0 0 6px rgba(34,197,94,0.6); }
.ar-trk__row--exception .ar-trk__dot, .ar-trk__row--failed .ar-trk__dot { background:#dc2626; }
.ar-trk__row--customs .ar-trk__dot, .ar-trk__row--returned .ar-trk__dot { background:#eab308; }
.ar-trk__body { flex:1; min-width:0; }
.ar-trk__kind { font:600 13px sans-serif; }
.ar-trk__raw { font:12px sans-serif; color:#888; margin:1px 0; }
.ar-trk__meta { display:flex; gap:8px; font:11px sans-serif; color:#888; margin-top:2px; }
.ar-trk__loc::after  { content:'·'; margin-left:8px; }
.ar-trk__footer { padding:10px 16px; background:#181818; border-top:1px solid #333; }
.ar-trk__portal { width:100%; background:transparent; border:1px solid #444; color:#d4d4d4; padding:8px 14px; font:600 12px sans-serif; border-radius:4px; cursor:pointer; transition:all .12s; }
.ar-trk__portal:hover { background:#2a2a2a; border-color:#666; }
`;
        document.head.appendChild(s);
    }
}

// ── Shared label table ──────────────────────────────────────────────────────

const EVENT_LABEL: Record<TrackingEventKind, string> = {
    'created':      'Label created',
    'picked-up':    'Picked up',
    'in-transit':   'In transit',
    'arrived':      'Arrived at hub',
    'customs':      'Customs clearance',
    'out-delivery': 'Out for delivery',
    'delivered':    'Delivered',
    'failed':       'Delivery attempt failed',
    'returned':     'Returned to sender',
    'exception':    'Exception',
    'unknown':      'Update',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(at: number, locale?: string): string
{
    const d = new Date(at);
    const date = d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${date}, ${time}`;
}

function escapeHtml(s: string): string
{
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    } as Record<string, string>)[c]!);
}

// Re-export the helper so subclasses (and the multi-tracker) can reuse it
export { escapeHtml as _escapeHtml };
