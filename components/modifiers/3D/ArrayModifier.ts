/**
 * @module    components/modifiers/3D/ArrayModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Linear or radial instance array of a mesh.
 */

import { Modifier3D, _v3, type MeshLike, type SceneLike, type Vec3Like } from './_base.ts';

export interface ArrayModifierOptions {
    count       : number;
    type?       : 'linear' | 'radial';
    offset?     : Vec3Like;
    radius?     : number;
    axis?       : 'x' | 'y' | 'z';
    scene?      : SceneLike;
    meshFactory?: () => MeshLike;
}

export class ArrayModifier extends Modifier3D {
    #opts  : Required<ArrayModifierOptions>;
    #copies: MeshLike[] = [];

    constructor(mesh: MeshLike, opts: ArrayModifierOptions) {
        super(mesh);
        this.#opts = {
            type       : 'linear',
            offset     : _v3(1, 0, 0),
            radius     : 2,
            axis       : 'y',
            scene      : { children: [], add() {}, remove() {} },
            meshFactory: () => mesh,
            ...opts,
        };
    }

    apply(): this {
        if (!this.enabled) return this;
        this.#copies.forEach(c => this.#opts.scene.remove(c));
        this.#copies = [];
        const { count, type, offset, radius, axis } = this.#opts;
        for (let i = 1; i < count; i++) {
            const copy = this.#opts.meshFactory();
            if (type === 'linear') {
                copy.position.x = this.mesh.position.x + offset.x * i;
                copy.position.y = this.mesh.position.y + offset.y * i;
                copy.position.z = this.mesh.position.z + offset.z * i;
            } else {
                const angle = (2 * Math.PI * i) / count;
                if (axis === 'y') { copy.position.x = this.mesh.position.x + Math.cos(angle) * radius; copy.position.z = this.mesh.position.z + Math.sin(angle) * radius; copy.position.y = this.mesh.position.y; }
                else if (axis === 'x') { copy.position.y = this.mesh.position.y + Math.cos(angle) * radius; copy.position.z = this.mesh.position.z + Math.sin(angle) * radius; copy.position.x = this.mesh.position.x; }
                else { copy.position.x = this.mesh.position.x + Math.cos(angle) * radius; copy.position.y = this.mesh.position.y + Math.sin(angle) * radius; copy.position.z = this.mesh.position.z; }
            }
            this.#opts.scene.add(copy);
            this.#copies.push(copy);
        }
        return this;
    }

    destroy(): void { this.#copies.forEach(c => this.#opts.scene.remove(c)); this.#copies = []; super.destroy(); }
}
