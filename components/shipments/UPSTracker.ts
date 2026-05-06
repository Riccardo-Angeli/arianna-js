/**
 * @module    components/tracking/UPSTracker
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * UPS shipment tracker. UPS tracking numbers are very recognisable: they
 * almost always start with `1Z` followed by 16 alphanumeric characters
 * (account + service + package digits + check digit). Brand color is
 * UPS Brown #644117.
 *
 *   1Z  + 6 chars (shipper) + 2 chars (service) + 7 chars (package) + 1 (check)
 *   = 18 chars total, "1Z" prefix
 *
 * @example
 *   import { UPSTracker } from 'ariannajs/components/tracking';
 *
 *   const t = new UPSTracker('#track', { trackingNumber: '1Z999AA10123456784' });
 */

import { Tracker, type CarrierConfig, type TrackerOptions } from './Tracker.ts';

const UPS: CarrierConfig = {
    id        : 'ups',
    name      : 'UPS',
    color     : '#644117',
    publicUrl : 'https://www.ups.com/track?tracknum={n}',
    pattern   : /^1Z[0-9A-Z]{16}$/i,
    logo      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 22" aria-hidden="true">
<rect width="64" height="22" rx="3" fill="#644117"/>
<text x="32" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="900" fill="#ffcc00" letter-spacing="1">UPS</text>
</svg>`,
};

export class UPSTracker extends Tracker
{
    constructor(container: string | HTMLElement | null, opts: TrackerOptions)
    {
        super(container, opts);
    }
    protected _carrier(): CarrierConfig { return UPS; }
}
