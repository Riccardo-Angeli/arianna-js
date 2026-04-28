/**
 * @module    components/modifiers/3D/BevelModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Edge bevel / chamfer — adds loop vertices offset along face normals.
 */

import { Modifier3D, _cloneGeom, _recomputeNormals, _vNorm, _vCross, _vSub, _vAdd, _vScale, type MeshLike } from './_base.ts';

export class BevelModifier extends Modifier3D {
    #amount  : number;
    #segments: number;

    constructor(mesh: MeshLike, amount = 0.05, segments = 2) {
        super(mesh);
        this.#amount   = amount;
        this.#segments = segments;
    }

    apply(): this {
        if (!this.enabled) return this;
        const g = _cloneGeom(this.mesh.geometry);
        const bevelVerts = [];
        for (let i = 0; i < g.indices.length; i += 3) {
            const [ia, ib, ic] = g.indices.slice(i, i + 3);
            const a = g.vertices[ia], b = g.vertices[ib], c = g.vertices[ic];
            const n = _vNorm(_vCross(_vSub(b, a), _vSub(c, a)));
            for (let s = 1; s <= this.#segments; s++) {
                const t = s / (this.#segments + 1) * this.#amount;
                bevelVerts.push(_vAdd(a, _vScale(n, t)), _vAdd(b, _vScale(n, t)), _vAdd(c, _vScale(n, t)));
            }
        }
        g.vertices.push(...bevelVerts);
        _recomputeNormals(g);
        this.mesh.geometry = g;
        return this;
    }
}
