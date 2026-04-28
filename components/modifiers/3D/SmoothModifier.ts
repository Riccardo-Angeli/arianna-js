/**
 * @module    components/modifiers/3D/SmoothModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Laplacian smoothing — iteratively average vertices toward their neighbors.
 */

import { Modifier3D, _cloneGeom, _recomputeNormals, _vAdd, _vScale, _vLerp, type MeshLike } from './_base.ts';

export class SmoothModifier extends Modifier3D {
    #iterations: number;
    #factor    : number;

    constructor(mesh: MeshLike, iterations = 3, factor = 0.5) {
        super(mesh);
        this.#iterations = iterations;
        this.#factor     = factor;
    }

    apply(): this {
        if (!this.enabled) return this;
        const g   = _cloneGeom(this.mesh.geometry);
        const adj = g.vertices.map(() => new Set<number>());
        for (let i = 0; i < g.indices.length; i += 3) {
            const [a, b, c] = g.indices.slice(i, i + 3);
            adj[a].add(b); adj[a].add(c);
            adj[b].add(a); adj[b].add(c);
            adj[c].add(a); adj[c].add(b);
        }
        for (let iter = 0; iter < this.#iterations; iter++) {
            g.vertices = g.vertices.map((v, i) => {
                const ns = Array.from(adj[i]);
                if (!ns.length) return v;
                const avg = _vScale(ns.reduce((s, ni) => _vAdd(s, g.vertices[ni]), { x: 0, y: 0, z: 0 }), 1 / ns.length);
                return _vLerp(v, avg, this.#factor);
            });
        }
        _recomputeNormals(g);
        this.mesh.geometry = g;
        return this;
    }
}
