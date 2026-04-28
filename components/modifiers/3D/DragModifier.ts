/**
 * @module    components/modifiers/3D/DragModifier
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Mouse drag to move a mesh in world space on a chosen plane.
 */

import { Modifier3D, type MeshLike, type CameraLike, type Vec3Like } from './_base.ts';

export type DragCallback3D = (mesh: MeshLike, pos: Vec3Like) => void;

export class DragModifier extends Modifier3D {
    #canvas   : HTMLCanvasElement;
    #plane    : 'xy' | 'xz' | 'yz';
    #callbacks: DragCallback3D[] = [];

    constructor(mesh: MeshLike, canvas: HTMLCanvasElement, _camera: CameraLike, plane: 'xy' | 'xz' | 'yz' = 'xz') {
        super(mesh);
        this.#canvas = canvas;
        this.#plane  = plane;
        this.#setup();
    }

    apply(): this { return this; }

    #setup(): void {
        let dragging = false, startMX = 0, startMY = 0;
        let startPos = { ...this.mesh.position };
        const scale  = 0.01;

        const onDown = (e: MouseEvent) => {
            if (!this.enabled) return;
            dragging = true; startMX = e.clientX; startMY = e.clientY;
            startPos = { ...this.mesh.position };
        };
        const onMove = (e: MouseEvent) => {
            if (!dragging || !this.enabled) return;
            const dx = (e.clientX - startMX) * scale, dy = (e.clientY - startMY) * scale;
            if      (this.#plane === 'xz') { this.mesh.position.x = startPos.x + dx; this.mesh.position.z = startPos.z + dy; }
            else if (this.#plane === 'xy') { this.mesh.position.x = startPos.x + dx; this.mesh.position.y = startPos.y - dy; }
            else                           { this.mesh.position.y = startPos.y - dy; this.mesh.position.z = startPos.z + dx; }
            this.#callbacks.forEach(cb => cb(this.mesh, { ...this.mesh.position }));
        };
        const onUp = () => { dragging = false; };

        this.#canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup',   onUp);
        this.cleanups.push(() => {
            this.#canvas.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup',   onUp);
        });
    }

    onDrag(cb: DragCallback3D): this { this.#callbacks.push(cb); return this; }
}
