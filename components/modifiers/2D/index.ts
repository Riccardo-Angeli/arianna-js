/**
 * @module    components/modifiers/2D
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. 2D Modifiers — barrel export.
 *
 * Import individually for tree-shaking:
 *   import { Resizer } from '.../components/modifiers/2D/Resizer.ts';
 *
 * Or use the bundle:
 *   import { Modifiers2D } from '.../components/modifiers/2D/index.ts';
 */

export { Resizer }   from './Resizer.ts';
export type { ResizerOptions, ResizerCallback }   from './Resizer.ts';

export { Rotator }   from './Rotator.ts';
export type { RotatorOptions, RotatorCallback }   from './Rotator.ts';

export { Skewer }    from './Skewer.ts';
export type { SkewerOptions, SkewerCallback }     from './Skewer.ts';

export { Rounder }   from './Rounder.ts';
export type { RounderOptions, RounderCallback }   from './Rounder.ts';

export { Reflector } from './Reflector.ts';
export type { ReflectorOptions }                  from './Reflector.ts';

// ── Base (for extension) ──────────────────────────────────────────────────────
export { Modifier2D, _resolveTargets } from './Base.ts';
export type { ModInput }               from './Base.ts';

// ── Convenience bundle ────────────────────────────────────────────────────────

import { Resizer }   from './Resizer.ts';
import { Rotator }   from './Rotator.ts';
import { Skewer }    from './Skewer.ts';
import { Rounder }   from './Rounder.ts';
import { Reflector } from './Reflector.ts';

export const Modifiers2D = { Resizer, Rotator, Skewer, Rounder, Reflector };
export default Modifiers2D;
