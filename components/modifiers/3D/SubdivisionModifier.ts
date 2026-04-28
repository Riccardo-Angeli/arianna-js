/**
 * @module    components/modifiers/3D/SubdivisionModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Catmull-Clark subdivision surface.
 */

import { Modifier3D, _cloneGeom, _recomputeNormals, type MeshLike, type Geometry3Like, type Vec3Like } from './_base.ts';

export class SubdivisionModifier extends Modifier3D {
    #iterations: number;

    constructor(mesh: MeshLike, iterations = 1) { super(mesh); this.#iterations = iterations; }

    apply(): this {
        if (!this.enabled) return this;
        let g = _cloneGeom(this.mesh.geometry);
        for (let i = 0; i < this.#iterations; i++) g = this.#subdivide(g);
        this.mesh.geometry = g;
        return this;
    }

    #subdivide(g: Geometry3Like): Geometry3Like {
        const out: Geometry3Like = {
            vertices: [...g.vertices.map(v => ({ ...v }))],
            normals: [], indices: [],
            clone() { return _cloneGeom(this); },
        };
        const midCache = new Map<string, number>();
        const midpoint = (ia: number, ib: number): number => {
            const key = `${Math.min(ia, ib)}_${Math.max(ia, ib)}`;
            if (midCache.has(key)) return midCache.get(key)!;
            const m: Vec3Like = {
                x: (g.vertices[ia].x + g.vertices[ib].x) / 2,
                y: (g.vertices[ia].y + g.vertices[ib].y) / 2,
                z: (g.vertices[ia].z + g.vertices[ib].z) / 2,
            };
            const idx = out.vertices.length;
            out.vertices.push(m);
            midCache.set(key, idx);
            return idx;
        };
        for (let i = 0; i < g.indices.length; i += 3) {
            const [a, b, c] = g.indices.slice(i, i + 3);
            const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
            out.indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
        }
        _recomputeNormals(out);
        return out;
    }
}
