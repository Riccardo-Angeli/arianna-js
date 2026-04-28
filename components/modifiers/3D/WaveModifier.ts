/**
 * @module    components/modifiers/3D/WaveModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Sinusoidal displacement along an axis.
 */

import { Modifier3D, _cloneGeom, _recomputeNormals, type MeshLike } from './_base.ts';

export interface WaveModifierOptions {
    amplitude?: number;
    frequency?: number;
    axis?     : 'x' | 'y' | 'z';
    direction?: 'x' | 'z';
    time?     : number;
}

export class WaveModifier extends Modifier3D {
    #opts: Required<WaveModifierOptions>;

    constructor(mesh: MeshLike, opts: WaveModifierOptions = {}) {
        super(mesh);
        this.#opts = { amplitude: 0.2, frequency: 2, axis: 'y', direction: 'x', time: 0, ...opts };
    }

    apply(time?: number): this {
        if (!this.enabled) return this;
        const g  = _cloneGeom(this.mesh.geometry);
        const { amplitude, frequency, axis, direction } = this.#opts;
        const t  = time ?? this.#opts.time;
        g.vertices = g.vertices.map(v => {
            const disp = amplitude * Math.sin(frequency * (direction === 'x' ? v.x : v.z) + t);
            const out  = { ...v };
            if (axis === 'y') out.y += disp;
            else if (axis === 'x') out.x += disp;
            else out.z += disp;
            return out;
        });
        _recomputeNormals(g);
        this.mesh.geometry = g;
        return this;
    }
}
