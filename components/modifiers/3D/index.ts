/**
 * @module    components/modifiers/3D
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. 3D Modifiers — barrel export.
 *
 * Import individually for tree-shaking:
 *   import { SubdivisionModifier } from '.../components/modifiers/3D/SubdivisionModifier.ts';
 *
 * Or use the bundle:
 *   import { Modifiers3D } from '.../components/modifiers/3D/index.ts';
 */

// ── Geometry ──────────────────────────────────────────────────────────────────
export { SubdivisionModifier } from './SubdivisionModifier.ts';
export { DecimateModifier }    from './DecimateModifier.ts';
export { BevelModifier }       from './BevelModifier.ts';
export { MirrorModifier }      from './MirrorModifier.ts';
export type { MirrorAxis }     from './MirrorModifier.ts';
export { ArrayModifier }       from './ArrayModifier.ts';
export type { ArrayModifierOptions } from './ArrayModifier.ts';
export { BendModifier }        from './BendModifier.ts';
export { TwistModifier }       from './TwistModifier.ts';
export { WaveModifier }        from './WaveModifier.ts';
export type { WaveModifierOptions }  from './WaveModifier.ts';
export { InflateModifier }     from './InflateModifier.ts';
export { SmoothModifier }      from './SmoothModifier.ts';

// ── Transform / Scene ─────────────────────────────────────────────────────────
export { DragModifier }        from './DragModifier.ts';
export type { DragCallback3D } from './DragModifier.ts';
export { SnapModifier }        from './SnapModifier.ts';
export { LODModifier }         from './LODModifier.ts';
export type { LODLevel }       from './LODModifier.ts';
export { FadeModifier }        from './FadeModifier.ts';
export { BillboardModifier }   from './BillboardModifier.ts';

// ── Base (for extension) ──────────────────────────────────────────────────────
export { Modifier3D, _cloneGeom, _recomputeNormals, _v3, _vAdd, _vSub, _vScale, _vLen, _vNorm, _vCross, _vLerp } from './_base.ts';
export type { MeshLike, Geometry3Like, Vec3Like, SceneLike, CameraLike } from './_base.ts';

// ── Convenience bundle ────────────────────────────────────────────────────────

import { SubdivisionModifier } from './SubdivisionModifier.ts';
import { DecimateModifier }    from './DecimateModifier.ts';
import { BevelModifier }       from './BevelModifier.ts';
import { MirrorModifier }      from './MirrorModifier.ts';
import { ArrayModifier }       from './ArrayModifier.ts';
import { BendModifier }        from './BendModifier.ts';
import { TwistModifier }       from './TwistModifier.ts';
import { WaveModifier }        from './WaveModifier.ts';
import { InflateModifier }     from './InflateModifier.ts';
import { SmoothModifier }      from './SmoothModifier.ts';
import { DragModifier }        from './DragModifier.ts';
import { SnapModifier }        from './SnapModifier.ts';
import { LODModifier }         from './LODModifier.ts';
import { FadeModifier }        from './FadeModifier.ts';
import { BillboardModifier }   from './BillboardModifier.ts';

export const Modifiers3D = {
    SubdivisionModifier, DecimateModifier, BevelModifier,
    MirrorModifier, ArrayModifier, BendModifier, TwistModifier,
    WaveModifier, InflateModifier, SmoothModifier,
    DragModifier, SnapModifier, LODModifier, FadeModifier, BillboardModifier,
};
export default Modifiers3D;
