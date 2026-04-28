/**
 * @module    components/modifiers/2D/Skewer
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * skewX / skewY via drag handle.
 */

import { Modifier2D, type ModInput } from './_base.ts';

export interface SkewerOptions {
    axis?       : 'x' | 'y' | 'both';
    maxAngle?   : number;
    handleColor?: string;
}

export type SkewerCallback = (el: HTMLElement, skewX: number, skewY: number) => void;

export class Skewer extends Modifier2D {
    #opts     : Required<SkewerOptions>;
    #skews    : Map<HTMLElement, [number, number]> = new Map();
    #callbacks: SkewerCallback[] = [];

    constructor(input: ModInput, opts: SkewerOptions = {}) {
        super(input);
        this.#opts = { axis: 'both', maxAngle: 45, handleColor: '#e40c88', ...opts };
    }

    protected _applyTo(el: HTMLElement): void {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        this.#skews.set(el, [0, 0]);

        const h = document.createElement('div');
        h.style.cssText = `position:absolute;bottom:-10px;right:-10px;width:10px;height:10px;background:${this.#opts.handleColor};border-radius:50%;cursor:crosshair;z-index:9999;`;
        el.appendChild(h);

        let startX = 0, startY = 0;
        const onDown = (e: MouseEvent) => {
            if (!this.enabled) return;
            e.preventDefault();
            startX = e.clientX; startY = e.clientY;
            const [sx0, sy0] = this.#skews.get(el) ?? [0, 0];
            const max = this.#opts.maxAngle;

            const onMove = (ev: MouseEvent) => {
                const dx = (ev.clientX - startX) / 4, dy = (ev.clientY - startY) / 4;
                const skewX = this.#opts.axis !== 'y' ? Math.max(-max, Math.min(max, sx0 + dx)) : sx0;
                const skewY = this.#opts.axis !== 'x' ? Math.max(-max, Math.min(max, sy0 + dy)) : sy0;
                this.#skews.set(el, [skewX, skewY]);
                el.style.transform = `skew(${skewX}deg,${skewY}deg)`;
                this.#callbacks.forEach(cb => cb(el, skewX, skewY));
            };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        };
        h.addEventListener('mousedown', onDown);
        this.cleanups.push(() => { h.removeEventListener('mousedown', onDown); h.remove(); });
    }

    onSkew(cb: SkewerCallback): this { this.#callbacks.push(cb); return this; }
    reset(el: HTMLElement): this { this.#skews.set(el, [0, 0]); el.style.transform = ''; return this; }
}
