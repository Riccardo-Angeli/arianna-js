/**
 * @module    components/shipments
 *
 * Shipment trackers — a shared `Tracker` base, four carrier-specific
 * subclasses (DHL, UPS, FedEx, BRT) and a multi-carrier auto-detect
 * widget that picks the right one from a tracking number.
 */

export { Tracker }       from './Tracker.ts';
export type {
    TrackerOptions, TrackingEvent, TrackingEventKind, CarrierConfig,
} from './Tracker.ts';

export { DHLTracker }    from './DHLTracker.ts';
export { UPSTracker }    from './UPSTracker.ts';
export { FedExTracker }  from './FedExTracker.ts';
export { BRTTracker }    from './BRTTracker.ts';

export { TrackingMulti } from './TrackingMulti.ts';
export type { TrackingMultiOptions, CarrierId } from './TrackingMulti.ts';
