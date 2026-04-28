/**
 * @internal Shared helpers for A.r.i.a.n.n.A. Finance Components.
 */

export function _svg(tag: string, attrs: Record<string, string | number>, inner = ''): string {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return inner ? `<${tag} ${a}>${inner}</${tag}>` : `<${tag} ${a}/>`;
}

export function _fmt(n: number, dec = 2): string { return n.toFixed(dec); }
export function _fmtK(n: number): string {
    return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
}
