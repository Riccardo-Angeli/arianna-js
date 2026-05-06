/**
 * @module    components/tracking/BRTTracker
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * BRT shipment tracker. BRT (ex Bartolini, rebranded 2018) is the largest
 * Italian-domestic courier, dominant for B2C e-commerce in Italy. Tracking
 * numbers are 10–12 digit numeric "spedizione" numbers (the legacy
 * "Numero Spedizione" / "Numero Lettera di Vettura").
 *
 * Public tracking URL pattern uses BRT's VAS (Valore Aggiunto Spedizioni)
 * portal. The widget links to the public form pre-filled.
 *
 * Brand color: BRT red #e3000b.
 *
 * @example
 *   import { BRTTracker } from 'ariannajs/components/tracking';
 *
 *   const t = new BRTTracker('#track', { trackingNumber: '12345678901' });
 */

import { Tracker, type CarrierConfig, type TrackerOptions } from './Tracker.ts';

const BRT: CarrierConfig = {
    id        : 'brt',
    name      : 'BRT',
    color     : '#e3000b',
    publicUrl : 'https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.htm&Nspediz={n}',
    pattern   : /^\d{10,12}$/,
    logo      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 22" aria-hidden="true">
<rect width="64" height="22" rx="3" fill="#e3000b"/>
<text x="32" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="900" fill="#fff" letter-spacing="1">BRT</text>
</svg>`,
};

export class BRTTracker extends Tracker
{
    constructor(container: string | HTMLElement | null, opts: TrackerOptions)
    {
        super(container, opts);
    }
    protected _carrier(): CarrierConfig { return BRT; }
}
