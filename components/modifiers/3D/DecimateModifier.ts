/**
 * @module    components/modifiers/3D/DecimateModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Greedy triangle decimation — reduces polygon count by a target ratio.
 */

import { Modifier3D, _cloneGeom, _recomputeNormals, type MeshLike } from './_base.ts';

export class DecimateModifier extends Modifier3D {
    #ratio: number;

    constructor(mesh: MeshLike, ratio = 0.5) { super(mesh); this.#ratio = Math.max(0.01, Math.min(1, ratio)); }

    apply(): this {
        if (!this.enabled) return this;
        const g    = _cloneGeom(this.mesh.geometry);
        const step = Math.max(1, Math.floor((g.indices.length / 3) / Math.max(1, Math.floor(g.indices.length / 3 * this.#ratio))));
        const newIdx: number[] = [];
        for (let i = 0; i < g.indices.length; i += 3 * step) newIdx.push(...g.indices.slice(i, i + 3));
        g.indices = newIdx;
        _recomputeNormals(g);
        this.mesh.geometry = g;
        return this;
    }
}
