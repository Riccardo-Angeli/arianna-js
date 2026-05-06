/**
 * @module    components/tracking/FedExTracker
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * FedEx shipment tracker. FedEx tracking numbers come in three lengths,
 * all numeric:
 *   • 12 digits — domestic Express
 *   • 15 digits — Ground / SmartPost
 *   • 20 digits — older systems & some international services
 *
 * Brand: FedEx purple #4d148c + orange #ff6600 (the famous "hidden arrow"
 * logo isn't representable inline; we use the wordmark).
 *
 * @example
 *   import { FedExTracker } from 'ariannajs/components/tracking';
 *
 *   const t = new FedExTracker('#track', { trackingNumber: '123456789012' });
 */

import { Tracker, type CarrierConfig, type TrackerOptions } from './Tracker.ts';

const FEDEX: CarrierConfig = {
    id        : 'fedex',
    name      : 'FedEx',
    color     : '#4d148c',
    publicUrl : 'https://www.fedex.com/fedextrack/?trknbr={n}',
    pattern   : /^(\d{12}|\d{15}|\d{20})$/,
    logo      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 22" aria-hidden="true">
<text x="0"  y="17" font-family="Arial Black,Arial,sans-serif" font-size="17" font-weight="900" fill="#4d148c">Fed</text>
<text x="36" y="17" font-family="Arial Black,Arial,sans-serif" font-size="17" font-weight="900" fill="#ff6600">Ex</text>
</svg>`,
};

export class FedExTracker extends Tracker
{
    constructor(container: string | HTMLElement | null, opts: TrackerOptions)
    {
        super(container, opts);
    }
    protected _carrier(): CarrierConfig { return FEDEX; }
}
