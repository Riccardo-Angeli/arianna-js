/**
 * @module    additionals/Colors
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * AriannA Colors addon — pure colour-space conversion library shared by
 * every colour-picker and gradient-editor component. Single module, zero
 * dependencies, all pure functions. Sits alongside the other AriannA
 * addons (Three, Two, AI, Finance, Video, Audio, IO) and provides the
 * mathematics layer the components in `components/graphics/colors/`
 * assemble into UI.
 *
 * Supported spaces:
 *
 *   • RGB     — sRGB linearised through the standard companding curve.
 *   • HEX     — `#rgb` / `#rrggbb` / `#rrggbbaa` parsing & formatting.
 *   • HSL     — derived from sRGB.
 *   • HSV     — derived from sRGB.
 *   • CMYK    — naive CMYK from sRGB (suitable for screen mock-ups; for
 *               print accuracy you must round-trip through ICC profiles —
 *               not in scope here).
 *   • CIELUV  — D65 illuminant, CIE 1976 L*u*v* polar form (Lch_uv).
 *   • OKLCH   — Björn Ottosson's 2020 OKLab in cylindrical (L, C, h).
 *   • Cube    — 256-step uniform RGB cube indexed by R*65536 + G*256 + B,
 *               useful for palette quantisation / lookup tables.
 *
 * All functions are stateless and side-effect-free. Inputs are clamped /
 * normalised at every public entry point so callers can pass typed user
 * input without worrying about ranges.
 *
 * @example
 *   import { parseHex, rgbToOklch, oklchToRgb, formatCss } from 'ariannajs/additionals/Colors';
 *
 *   const rgb   = parseHex('#e40c88')!;
 *   const oklch = rgbToOklch(rgb);            // { L, C, h, a? }
 *   const back  = oklchToRgb(oklch);          // approximate round-trip
 *   const css   = formatCss('oklch', oklch);  // "oklch(...)"
 */

// ── Common types ────────────────────────────────────────────────────────────

export interface RGB    { r: number; g: number; b: number;            a?: number; }
export interface HSL    { h: number; s: number; l: number;            a?: number; }
export interface HSV    { h: number; s: number; v: number;            a?: number; }
export interface CMYK   { c: number; m: number; y: number; k: number; a?: number; }
export interface CIELUV { L: number; C: number; h: number;            a?: number; }
export interface OKLCH  { L: number; C: number; h: number;            a?: number; }

export interface AnyColor { r?: number; g?: number; b?: number; a?: number;
                            h?: number; s?: number; l?: number; v?: number;
                            c?: number; m?: number; y?: number; k?: number;
                            L?: number; C?: number; }

// ── Clamping helpers ────────────────────────────────────────────────────────

const clamp   = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const clamp01 = (n: number) => clamp(n, 0, 1);
const wrap360 = (n: number) => ((n % 360) + 360) % 360;

// ── HEX ─────────────────────────────────────────────────────────────────────

/**
 * Parse a hex colour. Accepts `#rgb`, `#rrggbb`, `#rrggbbaa`, with or
 * without the leading `#`, in any case. Returns null on parse failure.
 */
export function parseHex(hex: string): RGB | null
{
    let s = hex.trim().replace(/^#/, '');
    if (s.length === 3)       s = s.split('').map(c => c + c).join('');
    if (s.length !== 6 && s.length !== 8) return null;
    if (!/^[0-9a-fA-F]+$/.test(s)) return null;
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
}

/** Format an RGB triplet (0-255) as `#rrggbb`. Alpha appended when < 1. */
export function rgbToHex({ r, g, b, a }: RGB): string
{
    const rr = clamp(Math.round(r), 0, 255).toString(16).padStart(2, '0');
    const gg = clamp(Math.round(g), 0, 255).toString(16).padStart(2, '0');
    const bb = clamp(Math.round(b), 0, 255).toString(16).padStart(2, '0');
    if (a !== undefined && a < 1)
    {
        const aa = clamp(Math.round(a * 255), 0, 255).toString(16).padStart(2, '0');
        return `#${rr}${gg}${bb}${aa}`;
    }
    return `#${rr}${gg}${bb}`;
}

// ── RGB ↔ HSL ───────────────────────────────────────────────────────────────

/** RGB(0-255) → HSL(h:0-360, s:0-100, l:0-100). */
export function rgbToHsl({ r, g, b, a }: RGB): HSL
{
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min)
    {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max)
        {
            case R: h = ((G - B) / d + (G < B ? 6 : 0)); break;
            case G: h = ((B - R) / d + 2); break;
            case B: h = ((R - G) / d + 4); break;
        }
        h *= 60;
    }
    return { h: wrap360(h), s: s * 100, l: l * 100, a };
}

/** HSL → RGB. */
export function hslToRgb({ h, s, l, a }: HSL): RGB
{
    const H = wrap360(h) / 360;
    const S = clamp01(s / 100);
    const L = clamp01(l / 100);
    if (S === 0)
    {
        const v = Math.round(L * 255);
        return { r: v, g: v, b: v, a };
    }
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
    const p = 2 * L - q;
    const conv = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return {
        r: Math.round(conv(H + 1 / 3) * 255),
        g: Math.round(conv(H)         * 255),
        b: Math.round(conv(H - 1 / 3) * 255),
        a,
    };
}

// ── RGB ↔ HSV ───────────────────────────────────────────────────────────────

/** RGB → HSV(h:0-360, s:0-100, v:0-100). */
export function rgbToHsv({ r, g, b, a }: RGB): HSV
{
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    if (d !== 0)
    {
        switch (max)
        {
            case R: h = ((G - B) / d + (G < B ? 6 : 0)); break;
            case G: h = ((B - R) / d + 2); break;
            case B: h = ((R - G) / d + 4); break;
        }
        h *= 60;
    }
    return { h: wrap360(h), s: s * 100, v: max * 100, a };
}

/** HSV → RGB. */
export function hsvToRgb({ h, s, v, a }: HSV): RGB
{
    const H = wrap360(h) / 60;
    const S = clamp01(s / 100);
    const V = clamp01(v / 100);
    const i = Math.floor(H);
    const f = H - i;
    const p = V * (1 - S);
    const q = V * (1 - S * f);
    const t = V * (1 - S * (1 - f));
    let R = 0, G = 0, B = 0;
    switch (i % 6)
    {
        case 0: R = V; G = t; B = p; break;
        case 1: R = q; G = V; B = p; break;
        case 2: R = p; G = V; B = t; break;
        case 3: R = p; G = q; B = V; break;
        case 4: R = t; G = p; B = V; break;
        case 5: R = V; G = p; B = q; break;
    }
    return { r: Math.round(R * 255), g: Math.round(G * 255), b: Math.round(B * 255), a };
}

// ── RGB ↔ CMYK ──────────────────────────────────────────────────────────────

/** RGB → CMYK (each channel 0-100). Naive sRGB → device CMY conversion. */
export function rgbToCmyk({ r, g, b, a }: RGB): CMYK
{
    const R = clamp01(r / 255), G = clamp01(g / 255), B = clamp01(b / 255);
    const k = 1 - Math.max(R, G, B);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100, a };
    const c = (1 - R - k) / (1 - k);
    const m = (1 - G - k) / (1 - k);
    const y = (1 - B - k) / (1 - k);
    return { c: c * 100, m: m * 100, y: y * 100, k: k * 100, a };
}

/** CMYK → RGB. */
export function cmykToRgb({ c, m, y, k, a }: CMYK): RGB
{
    const C = clamp01(c / 100), M = clamp01(m / 100), Y = clamp01(y / 100), K = clamp01(k / 100);
    const r = 255 * (1 - C) * (1 - K);
    const g = 255 * (1 - M) * (1 - K);
    const b = 255 * (1 - Y) * (1 - K);
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
}

// ── RGB ↔ Linear-sRGB (the gateway to perceptual spaces) ───────────────────

const srgbToLinear = (v: number): number =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const linearToSrgb = (v: number): number =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

interface XYZ { X: number; Y: number; Z: number; a?: number; }

/** sRGB → CIE XYZ (D65). */
function rgbToXyz({ r, g, b, a }: RGB): XYZ
{
    const R = srgbToLinear(r / 255);
    const G = srgbToLinear(g / 255);
    const B = srgbToLinear(b / 255);
    return {
        X: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
        Y: R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
        Z: R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
        a,
    };
}

/** CIE XYZ → sRGB. */
function xyzToRgb({ X, Y, Z, a }: XYZ): RGB
{
    const R =  X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314;
    const G = -X * 0.9692660 + Y * 1.8760108 + Z * 0.0415560;
    const B =  X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252;
    return {
        r: Math.round(clamp01(linearToSrgb(R)) * 255),
        g: Math.round(clamp01(linearToSrgb(G)) * 255),
        b: Math.round(clamp01(linearToSrgb(B)) * 255),
        a,
    };
}

// ── RGB ↔ CIELUV (1976, L*u*v* in cylindrical Lch form) ────────────────────

// D65 reference white
const D65 = { X: 0.95047, Y: 1.00000, Z: 1.08883 };
const U_REF = (4 * D65.X) / (D65.X + 15 * D65.Y + 3 * D65.Z);
const V_REF = (9 * D65.Y) / (D65.X + 15 * D65.Y + 3 * D65.Z);

/** RGB → CIELUV polar (L:0-100, C:0+, h:0-360). */
export function rgbToCieluv(rgb: RGB): CIELUV
{
    const xyz = rgbToXyz(rgb);
    const { X, Y, Z, a } = xyz;
    const denom = X + 15 * Y + 3 * Z;
    const u_ = denom === 0 ? 0 : (4 * X) / denom;
    const v_ = denom === 0 ? 0 : (9 * Y) / denom;

    const Yr = Y / D65.Y;
    const L = Yr > 0.008856 ? 116 * Math.cbrt(Yr) - 16 : 903.3 * Yr;
    const u = 13 * L * (u_ - U_REF);
    const v = 13 * L * (v_ - V_REF);

    const C = Math.sqrt(u * u + v * v);
    const h = wrap360(Math.atan2(v, u) * 180 / Math.PI);
    return { L, C, h, a };
}

/** CIELUV polar → RGB. */
export function cieluvToRgb({ L, C, h, a }: CIELUV): RGB
{
    const hr = (wrap360(h) * Math.PI) / 180;
    const u = C * Math.cos(hr);
    const v = C * Math.sin(hr);

    const Y = L > 8 ? D65.Y * Math.pow((L + 16) / 116, 3) : D65.Y * L / 903.3;
    const u_ = U_REF + u / (13 * L);
    const v_ = V_REF + v / (13 * L);
    const X = L === 0 ? 0 : Y * (9 * u_) / (4 * v_);
    const Z = L === 0 ? 0 : Y * (12 - 3 * u_ - 20 * v_) / (4 * v_);

    return xyzToRgb({ X, Y, Z, a });
}

// ── RGB ↔ OKLCH (Björn Ottosson, 2020) ──────────────────────────────────────

/** sRGB(0-255) → OKLCH (L:0-1, C:0+, h:0-360). */
export function rgbToOklch({ r, g, b, a }: RGB): OKLCH
{
    const R = srgbToLinear(r / 255);
    const G = srgbToLinear(g / 255);
    const B = srgbToLinear(b / 255);

    // Linear sRGB → LMS (Ottosson 2020 matrix)
    const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
    const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
    const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    const L  = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const aa = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

    const C = Math.sqrt(aa * aa + bb * bb);
    const h = wrap360(Math.atan2(bb, aa) * 180 / Math.PI);
    return { L, C, h, a };
}

/** OKLCH → sRGB. */
export function oklchToRgb({ L, C, h, a }: OKLCH): RGB
{
    const hr = (wrap360(h) * Math.PI) / 180;
    const aa = C * Math.cos(hr);
    const bb = C * Math.sin(hr);

    const l_ = L + 0.3963377774 * aa + 0.2158037573 * bb;
    const m_ = L - 0.1055613458 * aa - 0.0638541728 * bb;
    const s_ = L - 0.0894841775 * aa - 1.2914855480 * bb;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const R =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    return {
        r: Math.round(clamp01(linearToSrgb(R)) * 255),
        g: Math.round(clamp01(linearToSrgb(G)) * 255),
        b: Math.round(clamp01(linearToSrgb(B)) * 255),
        a,
    };
}

// ── RGB Cube ────────────────────────────────────────────────────────────────

/** Pack an RGB triplet into a 24-bit cube index. */
export function rgbToCube({ r, g, b }: RGB): number
{
    return (clamp(Math.round(r), 0, 255) << 16) |
           (clamp(Math.round(g), 0, 255) << 8)  |
            clamp(Math.round(b), 0, 255);
}

/** Unpack a 24-bit cube index back to RGB. */
export function cubeToRgb(i: number): RGB
{
    return {
        r: (i >> 16) & 0xff,
        g: (i >> 8)  & 0xff,
        b:  i        & 0xff,
    };
}

// ── Convenience: format any space as a CSS string ──────────────────────────

/** Produce a CSS-ready colour string for any space. Falls back to hex for unsupported. */
export function formatCss(space: 'rgb' | 'hsl' | 'hsv' | 'cmyk' | 'cieluv' | 'oklch' | 'hex',
                          color: AnyColor): string
{
    switch (space)
    {
        case 'rgb' : {
            const c = color as RGB;
            return c.a !== undefined && c.a < 1
                ? `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`
                : `rgb(${c.r}, ${c.g}, ${c.b})`;
        }
        case 'hsl' : {
            const c = color as HSL;
            return c.a !== undefined && c.a < 1
                ? `hsla(${c.h.toFixed(0)}, ${c.s.toFixed(1)}%, ${c.l.toFixed(1)}%, ${c.a})`
                : `hsl(${c.h.toFixed(0)}, ${c.s.toFixed(1)}%, ${c.l.toFixed(1)}%)`;
        }
        case 'hsv' :    return formatCss('hex', hsvToRgb(color as HSV));
        case 'cmyk':    return formatCss('hex', cmykToRgb(color as CMYK));
        case 'cieluv': {
            const c = color as CIELUV;
            return `lch(${c.L.toFixed(1)}% ${c.C.toFixed(1)} ${c.h.toFixed(0)})`;
        }
        case 'oklch': {
            const c = color as OKLCH;
            return `oklch(${(c.L * 100).toFixed(1)}% ${c.C.toFixed(3)} ${c.h.toFixed(0)})`;
        }
        case 'hex' : return rgbToHex(color as RGB);
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const Colors = {
    // HEX
    parseHex, rgbToHex,
    // HSL ⇄ RGB
    rgbToHsl, hslToRgb,
    // HSV ⇄ RGB
    rgbToHsv, hsvToRgb,
    // CMYK ⇄ RGB
    rgbToCmyk, cmykToRgb,
    // CIELUV ⇄ RGB
    rgbToCieluv, cieluvToRgb,
    // OKLCH ⇄ RGB
    rgbToOklch, oklchToRgb,
    // Cube ⇄ RGB
    rgbToCube, cubeToRgb,
    // CSS formatter
    formatCss,
};

// ── Global registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Colors', {
        value       : Colors,
        writable    : false,
        enumerable  : false,
        configurable: false,
    });

export default Colors;
