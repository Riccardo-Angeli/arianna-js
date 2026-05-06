/**
 * @module    components/tracking/DHLTracker
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * DHL shipment tracker. Renders the shared timeline UI from `Tracker.ts`
 * with DHL-specific branding (red #d40511 + yellow #ffcc00) and links out
 * to the official DHL public tracking portal.
 *
 * DHL tracking number formats are heterogeneous across services:
 *   • Express AWB        : 10 or 11 digits
 *   • eCommerce / Parcel : 10–39 chars, alphanumeric
 *   • DHL Global Forwarding (sea/air): 3-letter prefix + 7 digits
 *
 * The default regex accepts the common cases. Override `pattern` if you
 * only handle a specific DHL service.
 *
 * @example
 *   import { DHLTracker } from 'ariannajs/components/tracking';
 *
 *   const t = new DHLTracker('#track', { trackingNumber: '1234567890' });
 *   t.setEvents(await api.fetchDhlEvents('1234567890'));
 */

import { Tracker, type CarrierConfig, type TrackerOptions } from './Tracker.ts';

const DHL: CarrierConfig = {
    id        : 'dhl',
    name      : 'DHL',
    color     : '#d40511',
    publicUrl : 'https://www.dhl.com/it-it/home/tracciamento.html?tracking-id={n}',
    pattern   : /^(\d{10,11}|[A-Z]{3}\d{7})$/i,
    logo      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 22" aria-hidden="true">
<rect width="64" height="22" fill="#ffcc00"/>
<text x="32" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="900" fill="#d40511" letter-spacing="1">DHL</text>
</svg>`,
};

export class DHLTracker extends Tracker
{
    constructor(container: string | HTMLElement | null, opts: TrackerOptions)
    {
        super(container, opts);
    }
    protected _carrier(): CarrierConfig { return DHL; }
}
