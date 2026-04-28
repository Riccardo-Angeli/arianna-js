/**
 * @module    components/modifiers/3D/BendModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Bend geometry along an axis by a given angle (radians).
 */

import { Modifier3D, _cloneGeom, _recomputeNormals, type MeshLike } from './_base.ts';

export class BendModifier extends Modifier3D {
    #angle: number;
    #axis : 'x' | 'y' | 'z';

    constructor(mesh: MeshLike, angle: number, axis: 'x' | 'y' | 'z' = 'y') {
        super(mesh);
        this.#angle = angle;
        this.#axis  = axis;
    }

    apply(): this {
        if (!this.enabled) return this;
        const g    = _cloneGeom(this.mesh.geometry);
        const vals = g.vertices.map(v => this.#axis === 'y' ? v.y : this.#axis === 'x' ? v.x : v.z);
        const vmin = Math.min(...vals), range = (Math.max(...vals) - vmin) || 1;
        g.vertices = g.vertices.map(v => {
            const t = ((this.#axis === 'y' ? v.y : this.#axis === 'x' ? v.x : v.z) - vmin) / range;
            const θ = t * this.#angle, c = Math.cos(θ), s = Math.sin(θ);
            if (this.#axis === 'y') return { x: c * v.x - s * v.z, y: v.y, z: s * v.x + c * v.z };
            if (this.#axis === 'x') return { x: v.x, y: c * v.y - s * v.z, z: s * v.y + c * v.z };
            return { x: c * v.x - s * v.y, y: s * v.x + c * v.y, z: v.z };
        });
        _recomputeNormals(g);
        this.mesh.geometry = g;
        return this;
    }
}
