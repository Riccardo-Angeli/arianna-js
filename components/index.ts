/**
 * @module    components
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * AriannA components — public package barrel. Each sub-namespace is
 * also independently importable from its own sub-path:
 *
 *   import { Chat }              from 'arianna/components/composite';
 *   import { ColorPickerWheel }  from 'arianna/components/graphics/colors';
 *   import { PaymentGateway }    from 'arianna/components/payments';
 *   import { TrackingMulti }     from 'arianna/components/shipments';
 *
 * Sub-path imports keep the bundle small. The barrel below is the
 * convenient "import everything" entry point — best for tooling and
 * Composer-style scenarios where tree-shaking covers the cost.
 */

export * from './audio/index.ts';
export * from './video/index.ts';
export * from './composite/index.ts';
export * from './graphics/2D/index.ts';
export * from './graphics/3D/index.ts';
export * from './graphics/colors/index.ts';
export * from './payments/index.ts';
export * from './shipments/index.ts';
