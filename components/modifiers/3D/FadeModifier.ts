/**
 * @module    components/modifiers/3D/FadeModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Distance-based opacity fade — hides mesh beyond a far threshold.
 */

import { Modifier3D, _vLen, _vSub, type MeshLike, type CameraLike } from './_base.ts';

export class FadeModifier extends Modifier3D {
    #near  : number;
    #far   : number;
    #onFade: ((mesh: MeshLike, opacity: number) => void) | null = null;

    constructor(mesh: MeshLike, near = 10, far = 50) {
        super(mesh);
        this.#near = near;
        this.#far  = far;
    }

    apply(): this { return this; }

    update(camera: CameraLike): this {
        if (!this.enabled) return this;
        const d       = _vLen(_vSub(this.mesh.position, camera.position));
        const opacity = 1 - Math.max(0, Math.min(1, (d - this.#near) / (this.#far - this.#near)));
        this.mesh.visible = opacity > 0.01;
        this.#onFade?.(this.mesh, opacity);
        return this;
    }

    onFade(cb: (mesh: MeshLike, opacity: number) => void): this { this.#onFade = cb; return this; }
}
