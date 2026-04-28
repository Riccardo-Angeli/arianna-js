/**
 * @module    components/finance/AlertBadge
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * Price alert indicator badge — pure HTML.
 */

export type AlertLevel = 'neutral' | 'info' | 'warning' | 'danger';

export class AlertBadge {
    #el: HTMLElement;

    constructor(container: string | HTMLElement) {
        this.#el = typeof container === 'string' ? document.querySelector(container) as HTMLElement ?? document.body : container;
    }

    render(text: string, level: AlertLevel = 'neutral', sublabel?: string): this {
        const colors: Record<AlertLevel, [string, string]> = {
            neutral : ['#2a2e39', '#787b86'],
            info    : ['#1e3a5f', '#7b9ef9'],
            warning : ['#3d2e00', '#f4c842'],
            danger  : ['#3d0000', '#ef5350'],
        };
        const [bg, fg] = colors[level];
        this.#el.innerHTML = `<div style="display:inline-flex;align-items:center;gap:6px;background:${bg};border-radius:4px;padding:4px 10px;font-family:sans-serif">
<span style="color:${fg};font-size:13px;font-weight:600">${text}</span>
${sublabel ? `<span style="color:#787b86;font-size:11px">${sublabel}</span>` : ''}
</div>`;
        return this;
    }
}
