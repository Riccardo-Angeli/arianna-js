/**
 * @module    components/modifiers/3D/InflateModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Expand geometry along vertex normals.
 */

import { Modifier3D, _cloneGeom, _recomputeNormals, _vAdd, _vScale, _v3, type MeshLike } from './_base.ts';

export class InflateModifier extends Modifier3D {
    #amount: number;

    constructor(mesh: MeshLike, amount = 0.1) { super(mesh); this.#amount = amount; }

    apply(): this {
        if (!this.enabled) return this;
        const g = _cloneGeom(this.mesh.geometry);
        _recomputeNormals(g);
        g.vertices = g.vertices.map((v, i) => _vAdd(v, _vScale(g.normals[i] ?? _v3(0, 1, 0), this.#amount)));
        _recomputeNormals(g);
        this.mesh.geometry = g;
        return this;
    }
}
