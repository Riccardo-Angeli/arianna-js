/**
 * @module    components/modifiers/2D/Reflector
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Flip / mirror buttons with animated CSS transform.
 */

import { Modifier2D, type ModInput } from './Base.ts';

export interface ReflectorOptions {
    axis?       : 'x' | 'y' | 'both';
    handleColor?: string;
    animate?    : boolean;
}

export class Reflector extends Modifier2D {
    #opts  : Required<ReflectorOptions>;
    #state : Map<HTMLElement, { x: boolean; y: boolean }> = new Map();

    constructor(input: ModInput, opts: ReflectorOptions = {}) {
        super(input);
        this.#opts = { axis: 'x', handleColor: '#e40c88', animate: true, ...opts };
    }

    protected _applyTo(el: HTMLElement): void {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        this.#state.set(el, { x: false, y: false });
        if (this.#opts.animate) el.style.transition = 'transform 0.2s ease';

        if (this.#opts.axis === 'x' || this.#opts.axis === 'both') {
            const hx = this.#makeBtn(el, 'H', 'right:-28px;top:50%;transform:translateY(-50%);');
            hx.addEventListener('click', () => { const s = this.#state.get(el)!; s.x = !s.x; this.#applyTransform(el); });
            this.cleanups.push(() => hx.remove());
        }
        if (this.#opts.axis === 'y' || this.#opts.axis === 'both') {
            const hy = this.#makeBtn(el, 'V', 'top:-28px;left:50%;transform:translateX(-50%);');
            hy.addEventListener('click', () => { const s = this.#state.get(el)!; s.y = !s.y; this.#applyTransform(el); });
            this.cleanups.push(() => hy.remove());
        }
    }

    #makeBtn(el: HTMLElement, label: string, pos: string): HTMLElement {
        const h       = document.createElement('button');
        h.textContent = label;
        h.style.cssText = `position:absolute;${pos}background:${this.#opts.handleColor};color:#fff;border:none;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:10px;font-weight:700;z-index:9999;`;
        el.appendChild(h);
        return h;
    }

    #applyTransform(el: HTMLElement): void {
        const s  = this.#state.get(el) ?? { x: false, y: false };
        el.style.transform = `scale(${s.x ? -1 : 1},${s.y ? -1 : 1})`;
    }

    flipX(el: HTMLElement): this { const s = this.#state.get(el); if (s) { s.x = !s.x; this.#applyTransform(el); } return this; }
    flipY(el: HTMLElement): this { const s = this.#state.get(el); if (s) { s.y = !s.y; this.#applyTransform(el); } return this; }
    reset(el: HTMLElement): this { this.#state.set(el, { x: false, y: false }); el.style.transform = ''; return this; }
}
