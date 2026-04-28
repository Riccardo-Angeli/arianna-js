/**
 * @module    components/modifiers/3D/BillboardModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Always face the camera — optional per-axis lock.
 */

import { Modifier3D, _vNorm, _vSub, type MeshLike, type CameraLike } from './_base.ts';

export class BillboardModifier extends Modifier3D {
    #lockX: boolean;
    #lockY: boolean;
    #lockZ: boolean;

    constructor(mesh: MeshLike, opts: { lockX?: boolean; lockY?: boolean; lockZ?: boolean } = {}) {
        super(mesh);
        this.#lockX = opts.lockX ?? false;
        this.#lockY = opts.lockY ?? false;
        this.#lockZ = opts.lockZ ?? false;
    }

    apply(): this { return this; }

    update(camera: CameraLike): this {
        if (!this.enabled) return this;
        const dir = _vNorm(_vSub(camera.position, this.mesh.position));
        if (!this.#lockY) this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        if (!this.#lockX) this.mesh.rotation.x = -Math.asin(dir.y);
        return this;
    }
}
