/**
 * @module    components/modifiers/3D/SnapModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Snap position and rotation to a grid.
 */

import { Modifier3D, type MeshLike } from './_base.ts';

export class SnapModifier extends Modifier3D {
    #posGrid: number;
    #rotGrid: number; // radians

    constructor(mesh: MeshLike, posGrid = 0.5, rotGridDeg = 15) {
        super(mesh);
        this.#posGrid = posGrid;
        this.#rotGrid = rotGridDeg * Math.PI / 180;
    }

    apply(): this {
        if (!this.enabled) return this;
        const s = this.#posGrid, r = this.#rotGrid;
        this.mesh.position.x = Math.round(this.mesh.position.x / s) * s;
        this.mesh.position.y = Math.round(this.mesh.position.y / s) * s;
        this.mesh.position.z = Math.round(this.mesh.position.z / s) * s;
        this.mesh.rotation.x = Math.round(this.mesh.rotation.x / r) * r;
        this.mesh.rotation.y = Math.round(this.mesh.rotation.y / r) * r;
        this.mesh.rotation.z = Math.round(this.mesh.rotation.z / r) * r;
        return this;
    }
}
