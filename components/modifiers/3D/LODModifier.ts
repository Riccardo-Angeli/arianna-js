/**
 * @module    components/modifiers/3D/LODModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Level-of-detail — swap geometry based on camera distance.
 */

import { Modifier3D, _vLen, _vSub, type MeshLike, type CameraLike, type Geometry3Like } from './_base.ts';

export interface LODLevel { distance: number; geometry: Geometry3Like; }

export class LODModifier extends Modifier3D {
    #levels : LODLevel[];
    #current: number = -1;

    constructor(mesh: MeshLike, levels: LODLevel[]) {
        super(mesh);
        this.#levels = levels.sort((a, b) => a.distance - b.distance);
    }

    apply(): this { return this; }

    update(camera: CameraLike): this {
        if (!this.enabled) return this;
        const d    = _vLen(_vSub(this.mesh.position, camera.position));
        let   best = this.#levels.length - 1;
        for (let i = 0; i < this.#levels.length; i++) {
            if (d <= this.#levels[i].distance) { best = i; break; }
        }
        if (best !== this.#current) {
            this.#current = best;
            this.mesh.geometry = this.#levels[best].geometry;
        }
        return this;
    }
}
