/**
 * @internal Shared base for A.r.i.a.n.n.A. 2D Modifiers.
 */

type ModTarget = HTMLElement | { render(): Element } | string;
export type ModInput = ModTarget | ModTarget[];

export function _resolveTargets(input: ModInput): HTMLElement[] {
    const inputs = Array.isArray(input) ? input : [input];
    const result: HTMLElement[] = [];
    for (const t of inputs) {
        if (typeof t === 'string') {
            document.querySelectorAll<HTMLElement>(t).forEach(el => result.push(el));
        } else if (t instanceof HTMLElement) {
            result.push(t);
        } else if (typeof (t as { render(): Element }).render === 'function') {
            const el = (t as { render(): Element }).render();
            if (el instanceof HTMLElement) result.push(el);
        }
    }
    return result;
}

export abstract class Modifier2D {
    protected elements : HTMLElement[] = [];
    protected enabled  = true;
    protected cleanups : (() => void)[] = [];

    constructor(input: ModInput) {
        this.elements = _resolveTargets(input);
        for (const el of this.elements) this._applyTo(el);
    }

    protected abstract _applyTo(el: HTMLElement): void;

    enable(): this  { this.enabled = true;  return this; }
    disable(): this { this.enabled = false; return this; }

    destroy(): void {
        this.cleanups.forEach(fn => fn());
        this.cleanups = [];
    }
}
