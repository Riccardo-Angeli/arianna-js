/**
 * @module    components/modifiers/2D/Rotator
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Drag-to-rotate handle with optional angle snap.
 */

import { Modifier2D, type ModInput } from './Base.ts';

export interface RotatorOptions {
    handleOffset?: number;
    handleColor? : string;
    handleSize?  : number;
    snap?        : number; // degrees (0 = no snap)
}

export type RotatorCallback = (el: HTMLElement, angle: number) => void;

export class Rotator extends Modifier2D {
    #opts     : Required<RotatorOptions>;
    #angles   : Map<HTMLElement, number> = new Map();
    #callbacks: RotatorCallback[] = [];

    constructor(input: ModInput, opts: RotatorOptions = {}) {
        super(input);
        this.#opts = { handleOffset: 24, handleColor: '#e40c88', handleSize: 10, snap: 0, ...opts };
    }

    protected _applyTo(el: HTMLElement): void {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        this.#angles.set(el, 0);

        const { handleSize: hs, handleColor: hc, handleOffset: ho } = this.#opts;

        const line = document.createElement('div');
        line.style.cssText = `position:absolute;top:-${ho}px;left:50%;width:1px;height:${ho}px;background:${hc};transform-origin:bottom;pointer-events:none;`;
        el.appendChild(line);

        const h = document.createElement('div');
        h.style.cssText = `position:absolute;top:-${ho + hs}px;left:50%;transform:translateX(-50%);width:${hs}px;height:${hs}px;background:${hc};border-radius:50%;cursor:grab;z-index:9999;`;
        el.appendChild(h);

        const onDown = (e: MouseEvent) => {
            if (!this.enabled) return;
            e.preventDefault();
            const rect       = el.getBoundingClientRect();
            const cx         = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const startAngle = this.#angles.get(el) ?? 0;
            const startMouse = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;

            const onMove = (ev: MouseEvent) => {
                let angle = startAngle + (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI - startMouse);
                if (this.#opts.snap > 0) angle = Math.round(angle / this.#opts.snap) * this.#opts.snap;
                this.#angles.set(el, angle);
                el.style.transform = `rotate(${angle}deg)`;
                this.#callbacks.forEach(cb => cb(el, angle));
            };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        };
        h.addEventListener('mousedown', onDown);
        this.cleanups.push(() => { h.removeEventListener('mousedown', onDown); h.remove(); line.remove(); });
    }

    getAngle(el: HTMLElement): number { return this.#angles.get(el) ?? 0; }
    setAngle(el: HTMLElement, angle: number): this { this.#angles.set(el, angle); el.style.transform = `rotate(${angle}deg)`; return this; }
    onRotate(cb: RotatorCallback): this { this.#callbacks.push(cb); return this; }
}
