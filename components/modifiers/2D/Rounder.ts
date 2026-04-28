/**
 * @module    components/modifiers/2D/Rounder
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Border-radius drag control.
 */

import { Modifier2D, type ModInput } from './Base.ts';

export interface RounderOptions {
    r?          : number;
    max?        : number;
    handleColor?: string;
    corners?    : ('tl'|'tr'|'bl'|'br')[];
}

export type RounderCallback = (el: HTMLElement, radius: number) => void;

export class Rounder extends Modifier2D {
    #opts     : Required<RounderOptions>;
    #radii    : Map<HTMLElement, number> = new Map();
    #callbacks: RounderCallback[] = [];

    constructor(input: ModInput, opts: RounderOptions = {}) {
        super(input);
        this.#opts = { r: 0, max: 100, handleColor: '#e40c88', corners: ['tl','tr','bl','br'], ...opts };
    }

    protected _applyTo(el: HTMLElement): void {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        const r0 = this.#opts.r;
        this.#radii.set(el, r0);
        el.style.borderRadius = `${r0}px`;

        const h = document.createElement('div');
        h.style.cssText = `position:absolute;top:4px;left:4px;width:10px;height:10px;background:${this.#opts.handleColor};border-radius:50%;cursor:pointer;z-index:9999;`;
        h.title = 'Drag to round corners';
        el.appendChild(h);

        let startX = 0, r = r0;
        const onDown = (e: MouseEvent) => {
            if (!this.enabled) return;
            e.preventDefault();
            startX = e.clientX; r = this.#radii.get(el) ?? 0;

            const onMove = (ev: MouseEvent) => {
                const newR = Math.max(0, Math.min(this.#opts.max, r + (ev.clientX - startX) / 2));
                this.#radii.set(el, newR);
                el.style.borderRadius = `${newR}px`;
                this.#callbacks.forEach(cb => cb(el, newR));
            };
            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        };
        h.addEventListener('mousedown', onDown);
        this.cleanups.push(() => { h.removeEventListener('mousedown', onDown); h.remove(); });
    }

    setRadius(el: HTMLElement, r: number): this { this.#radii.set(el, r); el.style.borderRadius = `${r}px`; return this; }
    getRadius(el: HTMLElement): number { return this.#radii.get(el) ?? 0; }
    onRound(cb: RounderCallback): this { this.#callbacks.push(cb); return this; }
}
