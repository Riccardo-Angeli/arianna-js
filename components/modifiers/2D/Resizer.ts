/**
 * @module    components/modifiers/2D/Resizer
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * 8-direction resize handles on any HTML element.
 */

import { Modifier2D, type ModInput } from './_base.ts';

export interface ResizerOptions {
    minWidth?   : number;
    minHeight?  : number;
    maxWidth?   : number;
    maxHeight?  : number;
    handles?    : ('n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw')[];
    handleSize? : number;
    handleColor?: string;
}

export type ResizerCallback = (el: HTMLElement, w: number, h: number) => void;

function _handlePos(dir: string, hs: number): string {
    const h = hs / 2;
    const map: Record<string, string> = {
        n:  `top:-${h}px;left:50%;transform:translateX(-50%);cursor:n-resize;`,
        s:  `bottom:-${h}px;left:50%;transform:translateX(-50%);cursor:s-resize;`,
        e:  `right:-${h}px;top:50%;transform:translateY(-50%);cursor:e-resize;`,
        w:  `left:-${h}px;top:50%;transform:translateY(-50%);cursor:w-resize;`,
        ne: `top:-${h}px;right:-${h}px;cursor:ne-resize;`,
        nw: `top:-${h}px;left:-${h}px;cursor:nw-resize;`,
        se: `bottom:-${h}px;right:-${h}px;cursor:se-resize;`,
        sw: `bottom:-${h}px;left:-${h}px;cursor:sw-resize;`,
    };
    return map[dir] ?? '';
}

export class Resizer extends Modifier2D {
    #opts     : Required<ResizerOptions>;
    #callbacks: ResizerCallback[] = [];

    constructor(input: ModInput, opts: ResizerOptions = {}) {
        super(input);
        this.#opts = {
            minWidth: 40, minHeight: 40, maxWidth: 9999, maxHeight: 9999,
            handles: ['n','s','e','w','ne','nw','se','sw'],
            handleSize: 8, handleColor: '#e40c88', ...opts,
        };
    }

    protected _applyTo(el: HTMLElement): void {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        const { handleSize: hs, handleColor: hc } = this.#opts;

        for (const dir of this.#opts.handles) {
            const h = document.createElement('div');
            h.dataset['resizeDir'] = dir;
            h.style.cssText = `position:absolute;width:${hs}px;height:${hs}px;background:${hc};border-radius:50%;z-index:9999;` + _handlePos(dir, hs);
            el.appendChild(h);

            let startX = 0, startY = 0, startW = 0, startH = 0, startT = 0, startL = 0;
            const onDown = (e: MouseEvent) => {
                if (!this.enabled) return;
                e.preventDefault();
                startX = e.clientX; startY = e.clientY;
                startW = el.offsetWidth; startH = el.offsetHeight;
                startT = el.offsetTop;   startL = el.offsetLeft;
                const onMove = (ev: MouseEvent) => {
                    const dx = ev.clientX - startX, dy = ev.clientY - startY;
                    let w = startW, ht = startH, l = startL, t = startT;
                    if (dir.includes('e'))  w  = Math.min(this.#opts.maxWidth,  Math.max(this.#opts.minWidth,  startW + dx));
                    if (dir.includes('s'))  ht = Math.min(this.#opts.maxHeight, Math.max(this.#opts.minHeight, startH + dy));
                    if (dir.includes('w')) { w  = Math.min(this.#opts.maxWidth,  Math.max(this.#opts.minWidth,  startW - dx)); l = startL + (startW - w); }
                    if (dir.includes('n')) { ht = Math.min(this.#opts.maxHeight, Math.max(this.#opts.minHeight, startH - dy)); t = startT + (startH - ht); }
                    el.style.width = `${w}px`; el.style.height = `${ht}px`;
                    el.style.left  = `${l}px`; el.style.top    = `${t}px`;
                    this.#callbacks.forEach(cb => cb(el, w, ht));
                };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup',   onUp);
            };
            h.addEventListener('mousedown', onDown);
            this.cleanups.push(() => { h.removeEventListener('mousedown', onDown); h.remove(); });
        }
    }

    onResize(cb: ResizerCallback): this { this.#callbacks.push(cb); return this; }
}
