/**
 * @module    Two
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. Two — 2D vector graphics engine.
 * Zero dependencies. Pure TypeScript.
 *
 * ── RENDERERS ─────────────────────────────────────────────────────────────────
 *   SVGRenderer    — live SVG DOM, resolution-independent, CSS-animatable
 *   CanvasRenderer — Canvas2D, high-performance raster, pixel-perfect
 *   Auto-select via Two.createRenderer(canvas | 'svg' | 'canvas')
 *
 * ── SCENE GRAPH ──────────────────────────────────────────────────────────────
 *   Stage → Shape2D → Path | Circle | Rect | Ellipse | Line | Polygon
 *                           Text | Group2D | Image2D
 *
 * ── STYLE ────────────────────────────────────────────────────────────────────
 *   Fill / Stroke / Gradient (linear + radial) / Pattern / Shadow
 *
 * ── TRANSFORMS ───────────────────────────────────────────────────────────────
 *   translate / rotate / scale / skewX / skewY / matrix (Mat3)
 *
 * ── ANIMATION ────────────────────────────────────────────────────────────────
 *   Tween — property interpolation (linear / ease / spring)
 *   Timeline — sequenced tweens with delay / repeat / yoyo
 *
 * ── EXPORT ───────────────────────────────────────────────────────────────────
 *   .toSVG()    → SVG string
 *   .toPNG()    → Promise<Blob>  (via OffscreenCanvas)
 *   .toPDF()    → Blob           (via minimal PDF engine)
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *   const two   = Two.createRenderer('#canvas', { mode: 'svg', width: 800, height: 600 });
 *   const stage = two.stage;
 *
 *   const circle = new Two.Circle({ cx: 200, cy: 200, r: 80, fill: '#e40c88' });
 *   stage.add(circle);
 *   two.render();
 *
 *   // Animate
 *   new Two.Tween(circle, { r: 120 }, 600).easing('easeInOut').start();
 *   two.loop();
 */

// ── Math ──────────────────────────────────────────────────────────────────────

export class Vec2D
{
    constructor(public x = 0, public y = 0) {}
    set(x: number, y: number): this { this.x = x; this.y = y; return this; }
    clone(): Vec2D { return new Vec2D(this.x, this.y); }
    add(v: Vec2D): this { this.x += v.x; this.y += v.y; return this; }
    sub(v: Vec2D): this { this.x -= v.x; this.y -= v.y; return this; }
    scale(s: number): this { this.x *= s; this.y *= s; return this; }
    length(): number { return Math.sqrt(this.x ** 2 + this.y ** 2); }
    normalize(): this { const l = this.length() || 1; return this.scale(1 / l); }
    dot(v: Vec2D): number { return this.x * v.x + this.y * v.y; }
    angle(): number { return Math.atan2(this.y, this.x); }
    rotate(a: number): this {
        const c = Math.cos(a), s = Math.sin(a);
        const x = this.x, y = this.y;
        this.x = x * c - y * s;
        this.y = x * s + y * c;
        return this;
    }
    lerp(v: Vec2D, t: number): this {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }
    distanceTo(v: Vec2D): number { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2); }
    toArray(): [number, number] { return [this.x, this.y]; }
    static from(a: [number, number]): Vec2D { return new Vec2D(a[0], a[1]); }
    static add(a: Vec2D, b: Vec2D): Vec2D { return a.clone().add(b); }
    static sub(a: Vec2D, b: Vec2D): Vec2D { return a.clone().sub(b); }
}

/** 3×3 matrix for 2D transforms (column-major). */
export class Mat3
{
    // [a, b, 0]
    // [c, d, 0]
    // [tx,ty,1]
    e: Float32Array;

    constructor() { this.e = new Float32Array(9); this.identity(); }

    identity(): this {
        const e = this.e; e.fill(0);
        e[0] = e[4] = e[8] = 1;
        return this;
    }

    clone(): Mat3 { const m = new Mat3(); m.e.set(this.e); return m; }
    copy(m: Mat3): this { this.e.set(m.e); return this; }

    multiply(m: Mat3): this {
        const a = this.e, b = m.e, r = new Float32Array(9);
        for (let i = 0; i < 3; i++)
            for (let j = 0; j < 3; j++) {
                let s = 0;
                for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j];
                r[i * 3 + j] = s;
            }
        this.e.set(r); return this;
    }

    translate(tx: number, ty: number): this {
        const m = new Mat3();
        m.e[6] = tx; m.e[7] = ty;
        return this.multiply(m);
    }

    rotate(angle: number): this {
        const c = Math.cos(angle), s = Math.sin(angle);
        const m = new Mat3();
        m.e[0] =  c; m.e[1] = s;
        m.e[3] = -s; m.e[4] = c;
        return this.multiply(m);
    }

    scale(sx: number, sy = sx): this {
        const m = new Mat3();
        m.e[0] = sx; m.e[4] = sy;
        return this.multiply(m);
    }

    skewX(angle: number): this {
        const m = new Mat3(); m.e[3] = Math.tan(angle);
        return this.multiply(m);
    }

    skewY(angle: number): this {
        const m = new Mat3(); m.e[1] = Math.tan(angle);
        return this.multiply(m);
    }

    applyToPoint(x: number, y: number): [number, number] {
        const e = this.e;
        return [e[0]*x + e[3]*y + e[6], e[1]*x + e[4]*y + e[7]];
    }

    toCSSMatrix(): string {
        const e = this.e;
        return `matrix(${e[0]},${e[1]},${e[3]},${e[4]},${e[6]},${e[7]})`;
    }

    toSVGTransform(): string { return `matrix(${Array.from(this.e).slice(0, 6).join(' ')})`; }
    invert(): this {
        const e = this.e;
        const det = e[0]*(e[4]*e[8]-e[5]*e[7]) - e[1]*(e[3]*e[8]-e[5]*e[6]) + e[2]*(e[3]*e[7]-e[4]*e[6]);
        if (Math.abs(det) < 1e-10) return this;
        const inv = 1/det;
        const r = new Float32Array(9);
        r[0]= (e[4]*e[8]-e[5]*e[7])*inv; r[1]=-(e[1]*e[8]-e[2]*e[7])*inv; r[2]= (e[1]*e[5]-e[2]*e[4])*inv;
        r[3]=-(e[3]*e[8]-e[5]*e[6])*inv; r[4]= (e[0]*e[8]-e[2]*e[6])*inv; r[5]=-(e[0]*e[5]-e[2]*e[3])*inv;
        r[6]= (e[3]*e[7]-e[4]*e[6])*inv; r[7]=-(e[0]*e[7]-e[1]*e[6])*inv; r[8]= (e[0]*e[4]-e[1]*e[3])*inv;
        this.e.set(r); return this;
    }
}

export class BBox2D
{
    minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
    expandBy(x: number, y: number): this {
        this.minX = Math.min(this.minX, x); this.minY = Math.min(this.minY, y);
        this.maxX = Math.max(this.maxX, x); this.maxY = Math.max(this.maxY, y);
        return this;
    }
    get width():  number { return this.maxX - this.minX; }
    get height(): number { return this.maxY - this.minY; }
    get cx():     number { return (this.minX + this.maxX) / 2; }
    get cy():     number { return (this.minY + this.maxY) / 2; }
    contains(x: number, y: number): boolean {
        return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
    }
}

// ── Style types ───────────────────────────────────────────────────────────────

export interface LinearGradient {
    type: 'linear';
    x1: number; y1: number; x2: number; y2: number;
    stops: { offset: number; color: string; opacity?: number }[];
}

export interface RadialGradient {
    type: 'radial';
    cx: number; cy: number; r: number;
    fx?: number; fy?: number;
    stops: { offset: number; color: string; opacity?: number }[];
}

export type GradientDef = LinearGradient | RadialGradient;

export interface ShadowStyle {
    offsetX: number;
    offsetY: number;
    blur:    number;
    color:   string;
}

export interface Style2D {
    fill?            : string | GradientDef | 'none';
    stroke?          : string | 'none';
    strokeWidth?     : number;
    strokeDasharray? : number[];
    strokeDashoffset?: number;
    strokeLinecap?   : 'butt' | 'round' | 'square';
    strokeLinejoin?  : 'miter' | 'round' | 'bevel';
    strokeMiterlimit?: number;
    fillOpacity?     : number;
    strokeOpacity?   : number;
    opacity?         : number;
    shadow?          : ShadowStyle;
    filter?          : string;
    blendMode?       : GlobalCompositeOperation;
}

// ── Scene graph base ──────────────────────────────────────────────────────────

let _id2d = 0;

export class Shape2D
{
    readonly id     = ++_id2d;
    visible         = true;
    style           : Style2D = {};
    transform       = new Mat3();
    parent          : Group2D | Stage2D | null = null;
    userData        : Record<string, unknown> = {};

    // local transform components
    private _tx     = 0;
    private _ty     = 0;
    private _rot    = 0;
    private _sx     = 1;
    private _sy     = 1;
    private _dirty  = true;

    get x(): number { return this._tx; }
    get y(): number { return this._ty; }

    translate(tx: number, ty: number): this { this._tx += tx; this._ty += ty; this._dirty = true; return this; }
    moveTo(x: number, y: number): this { this._tx = x; this._ty = y; this._dirty = true; return this; }

    rotate(angle: number): this { this._rot += angle; this._dirty = true; return this; }
    rotateTo(angle: number): this { this._rot = angle; this._dirty = true; return this; }

    scale(sx: number, sy = sx): this { this._sx *= sx; this._sy *= sy; this._dirty = true; return this; }
    scaleTo(sx: number, sy = sx): this { this._sx = sx; this._sy = sy; this._dirty = true; return this; }

    fill(color: string | GradientDef): this { this.style.fill = color; return this; }
    stroke(color: string, width?: number): this { this.style.stroke = color; if (width !== undefined) this.style.strokeWidth = width; return this; }
    opacity(v: number): this { this.style.opacity = v; return this; }
    shadow(x: number, y: number, blur: number, color: string): this { this.style.shadow = { offsetX: x, offsetY: y, blur, color }; return this; }

    show(): this { this.visible = true; return this; }
    hide(): this { this.visible = false; return this; }

    updateTransform(): this {
        if (!this._dirty) return this;
        this.transform.identity()
            .translate(this._tx, this._ty)
            .rotate(this._rot)
            .scale(this._sx, this._sy);
        this._dirty = false;
        return this;
    }

    getWorldTransform(): Mat3 {
        this.updateTransform();
        if (!this.parent) return this.transform.clone();
        return this.parent.getWorldTransform().multiply(this.transform);
    }

    getBBox(): BBox2D { return new BBox2D(); }

    // SVG serialization — implemented by subclasses
    toSVGElement(defs: SVGDefsAccum): string { return ''; }

    // Canvas draw — implemented by subclasses
    drawCanvas(ctx: CanvasRenderingContext2D): void {}

    clone(): Shape2D { return new Shape2D(); }

    on(event: string, handler: (e: Event, shape: Shape2D) => void): this {
        _eventMap.set(this.id + ':' + event, handler as EventCallback);
        return this;
    }
    off(event: string): this { _eventMap.delete(this.id + ':' + event); return this; }
    fire(event: string, e: Event): void { (_eventMap.get(this.id + ':' + event) as EventCallback | undefined)?.(e, this); }
}

type EventCallback = (e: Event, shape: Shape2D) => void;
const _eventMap = new Map<string, EventCallback>();

// SVG defs accumulator (gradients, filters, patterns)
class SVGDefsAccum {
    private items: string[] = [];
    private ids   = new Map<string, string>();

    add(key: string, svg: string): string {
        if (this.ids.has(key)) return this.ids.get(key)!;
        const id = `d${_id2d++}`;
        this.ids.set(key, id);
        this.items.push(svg.replace('__ID__', id));
        return id;
    }

    render(): string { return this.items.join('\n'); }
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function _styleAttrs(s: Style2D, defs: SVGDefsAccum): string {
    const parts: string[] = [];
    if (s.fill === 'none') parts.push('fill="none"');
    else if (typeof s.fill === 'string') parts.push(`fill="${s.fill}"`);
    else if (s.fill && typeof s.fill === 'object') parts.push(`fill="url(#${_gradientDef(s.fill, defs)})" `);
    else parts.push('fill="black"');

    if (s.stroke === 'none') parts.push('stroke="none"');
    else if (s.stroke) parts.push(`stroke="${s.stroke}"`);
    if (s.strokeWidth)      parts.push(`stroke-width="${s.strokeWidth}"`);
    if (s.strokeDasharray)  parts.push(`stroke-dasharray="${s.strokeDasharray.join(' ')}"`);
    if (s.strokeLinecap)    parts.push(`stroke-linecap="${s.strokeLinecap}"`);
    if (s.strokeLinejoin)   parts.push(`stroke-linejoin="${s.strokeLinejoin}"`);
    if (s.opacity !== undefined) parts.push(`opacity="${s.opacity}"`);
    if (s.fillOpacity !== undefined) parts.push(`fill-opacity="${s.fillOpacity}"`);
    if (s.strokeOpacity !== undefined) parts.push(`stroke-opacity="${s.strokeOpacity}"`);
    if (s.filter) parts.push(`filter="${s.filter}"`);
    return parts.join(' ');
}

function _gradientDef(g: GradientDef, defs: SVGDefsAccum): string {
    const key  = JSON.stringify(g);
    const stops = g.stops.map(s => `<stop offset="${s.offset}" stop-color="${s.color}" ${s.opacity !== undefined ? `stop-opacity="${s.opacity}"` : ''}/>`).join('');
    if (g.type === 'linear') {
        return defs.add(key, `<linearGradient id="__ID__" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`);
    } else {
        return defs.add(key, `<radialGradient id="__ID__" cx="${g.cx}" cy="${g.cy}" r="${g.r}" ${g.fx !== undefined ? `fx="${g.fx}"` : ''} ${g.fy !== undefined ? `fy="${g.fy}"` : ''} gradientUnits="userSpaceOnUse">${stops}</radialGradient>`);
    }
}

function _applyCanvasStyle(ctx: CanvasRenderingContext2D, s: Style2D, canvas: HTMLCanvasElement): void {
    ctx.globalAlpha = s.opacity ?? 1;
    if (s.blendMode) ctx.globalCompositeOperation = s.blendMode;
    if (s.shadow) {
        ctx.shadowOffsetX = s.shadow.offsetX;
        ctx.shadowOffsetY = s.shadow.offsetY;
        ctx.shadowBlur    = s.shadow.blur;
        ctx.shadowColor   = s.shadow.color;
    } else {
        ctx.shadowColor = 'transparent';
    }
    if (s.fill && s.fill !== 'none') {
        if (typeof s.fill === 'string') {
            ctx.fillStyle = s.fill;
        } else {
            const g = s.fill as GradientDef;
            if (g.type === 'linear') {
                const grad = ctx.createLinearGradient(g.x1, g.y1, g.x2, g.y2);
                g.stops.forEach(st => grad.addColorStop(st.offset, st.color));
                ctx.fillStyle = grad;
            } else {
                const grad = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.r);
                g.stops.forEach(st => grad.addColorStop(st.offset, st.color));
                ctx.fillStyle = grad;
            }
        }
    } else ctx.fillStyle = 'transparent';

    if (s.stroke && s.stroke !== 'none') ctx.strokeStyle = s.stroke;
    ctx.lineWidth   = s.strokeWidth  ?? 1;
    ctx.lineCap     = s.strokeLinecap  ?? 'butt';
    ctx.lineJoin    = s.strokeLinejoin ?? 'miter';
    if (s.strokeDasharray) ctx.setLineDash(s.strokeDasharray);
    else ctx.setLineDash([]);
    if (s.strokeDashoffset !== undefined) ctx.lineDashOffset = s.strokeDashoffset;
}

// ── Group2D ───────────────────────────────────────────────────────────────────

export class Group2D extends Shape2D
{
    children: Shape2D[] = [];

    add(...shapes: Shape2D[]): this {
        for (const s of shapes) { s.parent = this; this.children.push(s); }
        return this;
    }

    remove(shape: Shape2D): this {
        const i = this.children.indexOf(shape);
        if (i >= 0) { this.children.splice(i, 1); shape.parent = null; }
        return this;
    }

    clear(): this { this.children.forEach(c => { c.parent = null; }); this.children = []; return this; }

    toSVGElement(defs: SVGDefsAccum): string {
        this.updateTransform();
        const inner = this.children.map(c => c.toSVGElement(defs)).join('\n');
        return `<g transform="${this.transform.toCSSMatrix()}" opacity="${this.style.opacity ?? 1}">\n${inner}\n</g>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        if (this.style.opacity !== undefined) ctx.globalAlpha *= this.style.opacity;
        for (const c of this.children) c.drawCanvas(ctx);
        ctx.restore();
    }

    getBBox(): BBox2D {
        const box = new BBox2D();
        for (const c of this.children) {
            const b = c.getBBox();
            box.expandBy(b.minX, b.minY).expandBy(b.maxX, b.maxY);
        }
        return box;
    }

    clone(): Group2D {
        const g = new Group2D();
        g.style = { ...this.style };
        g.children = this.children.map(c => { const nc = c.clone(); nc.parent = g; return nc; });
        return g;
    }
}

// ── Stage2D ───────────────────────────────────────────────────────────────────

export class Stage2D extends Group2D
{
    width  : number;
    height : number;
    background: string | null = null;

    constructor(w = 800, h = 600) { super(); this.width = w; this.height = h; }

    getWorldTransform(): Mat3 { this.updateTransform(); return this.transform.clone(); }
}

// ── Shapes ────────────────────────────────────────────────────────────────────

export interface CircleOptions   { cx?: number; cy?: number; r?: number; style?: Style2D; }
export interface RectOptions     { x?: number; y?: number; width?: number; height?: number; rx?: number; ry?: number; style?: Style2D; }
export interface EllipseOptions  { cx?: number; cy?: number; rx?: number; ry?: number; style?: Style2D; }
export interface LineOptions     { x1?: number; y1?: number; x2?: number; y2?: number; style?: Style2D; }
export interface PolygonOptions  { points?: [number, number][]; closed?: boolean; style?: Style2D; }
export interface PathOptions     { d?: string; style?: Style2D; }
export interface TextOptions     { text?: string; x?: number; y?: number; fontSize?: number; fontFamily?: string; fontWeight?: string; textAnchor?: 'start' | 'middle' | 'end'; dominantBaseline?: string; style?: Style2D; }
export interface ImageOptions    { href?: string; x?: number; y?: number; width?: number; height?: number; style?: Style2D; }

export class Circle extends Shape2D
{
    cx: number; cy: number; r: number;

    constructor(opts: CircleOptions = {}) {
        super();
        this.cx = opts.cx ?? 0; this.cy = opts.cy ?? 0; this.r = opts.r ?? 50;
        if (opts.style) this.style = { ...opts.style };
    }

    getBBox(): BBox2D { return new BBox2D().expandBy(this.cx-this.r, this.cy-this.r).expandBy(this.cx+this.r, this.cy+this.r); }

    toSVGElement(defs: SVGDefsAccum): string {
        if (!this.visible) return '';
        this.updateTransform();
        return `<circle cx="${this.cx}" cy="${this.cy}" r="${this.r}" ${_styleAttrs(this.style, defs)} transform="${this.transform.toCSSMatrix()}"/>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        _applyCanvasStyle(ctx, this.style, ctx.canvas);
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.r, 0, Math.PI * 2);
        if (this.style.fill && this.style.fill !== 'none') ctx.fill();
        if (this.style.stroke && this.style.stroke !== 'none') ctx.stroke();
        ctx.restore();
    }

    clone(): Circle { const c = new Circle({ cx: this.cx, cy: this.cy, r: this.r, style: { ...this.style } }); return c; }
}

export class Rect extends Shape2D
{
    left: number; top: number; width: number; height: number; rx: number; ry: number;

    constructor(opts: RectOptions = {}) {
        super();
        this.left = opts.x ?? 0; this.top = opts.y ?? 0;
        this.width = opts.width ?? 100; this.height = opts.height ?? 60;
        this.rx = opts.rx ?? 0; this.ry = opts.ry ?? 0;
        if (opts.style) this.style = { ...opts.style };
    }

    getBBox(): BBox2D { return new BBox2D().expandBy(this.left, this.top).expandBy(this.left+this.width, this.top+this.height); }

    toSVGElement(defs: SVGDefsAccum): string {
        if (!this.visible) return '';
        this.updateTransform();
        return `<rect x="${this.left}" y="${this.top}" width="${this.width}" height="${this.height}" rx="${this.rx}" ry="${this.ry}" ${_styleAttrs(this.style, defs)} transform="${this.transform.toCSSMatrix()}"/>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        _applyCanvasStyle(ctx, this.style, ctx.canvas);
        ctx.beginPath();
        if (this.rx > 0 || this.ry > 0) {
            const rx = this.rx, ry = this.ry || rx;
            ctx.moveTo(this.left + rx, this.top);
            ctx.lineTo(this.left + this.width - rx, this.top);
            ctx.quadraticCurveTo(this.left + this.width, this.top, this.left + this.width, this.top + ry);
            ctx.lineTo(this.left + this.width, this.top + this.height - ry);
            ctx.quadraticCurveTo(this.left + this.width, this.top + this.height, this.left + this.width - rx, this.top + this.height);
            ctx.lineTo(this.left + rx, this.top + this.height);
            ctx.quadraticCurveTo(this.left, this.top + this.height, this.left, this.top + this.height - ry);
            ctx.lineTo(this.left, this.top + ry);
            ctx.quadraticCurveTo(this.left, this.top, this.left + rx, this.top);
        } else {
            ctx.rect(this.left, this.top, this.width, this.height);
        }
        if (this.style.fill && this.style.fill !== 'none') ctx.fill();
        if (this.style.stroke && this.style.stroke !== 'none') ctx.stroke();
        ctx.restore();
    }

    clone(): Rect { return new Rect({ x: this.left, y: this.top, width: this.width, height: this.height, rx: this.rx, ry: this.ry, style: { ...this.style } }); }
}

export class Ellipse extends Shape2D
{
    cx: number; cy: number; rx: number; ry: number;

    constructor(opts: EllipseOptions = {}) {
        super();
        this.cx = opts.cx ?? 0; this.cy = opts.cy ?? 0;
        this.rx = opts.rx ?? 60; this.ry = opts.ry ?? 40;
        if (opts.style) this.style = { ...opts.style };
    }

    getBBox(): BBox2D { return new BBox2D().expandBy(this.cx-this.rx, this.cy-this.ry).expandBy(this.cx+this.rx, this.cy+this.ry); }

    toSVGElement(defs: SVGDefsAccum): string {
        if (!this.visible) return '';
        this.updateTransform();
        return `<ellipse cx="${this.cx}" cy="${this.cy}" rx="${this.rx}" ry="${this.ry}" ${_styleAttrs(this.style, defs)} transform="${this.transform.toCSSMatrix()}"/>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        _applyCanvasStyle(ctx, this.style, ctx.canvas);
        ctx.beginPath();
        ctx.ellipse(this.cx, this.cy, this.rx, this.ry, 0, 0, Math.PI * 2);
        if (this.style.fill && this.style.fill !== 'none') ctx.fill();
        if (this.style.stroke && this.style.stroke !== 'none') ctx.stroke();
        ctx.restore();
    }

    clone(): Ellipse { return new Ellipse({ cx: this.cx, cy: this.cy, rx: this.rx, ry: this.ry, style: { ...this.style } }); }
}

export class Line extends Shape2D
{
    x1: number; y1: number; x2: number; y2: number;

    constructor(opts: LineOptions = {}) {
        super();
        this.x1 = opts.x1 ?? 0; this.y1 = opts.y1 ?? 0;
        this.x2 = opts.x2 ?? 100; this.y2 = opts.y2 ?? 0;
        if (opts.style) this.style = { ...opts.style };
    }

    getBBox(): BBox2D {
        return new BBox2D()
            .expandBy(Math.min(this.x1,this.x2), Math.min(this.y1,this.y2))
            .expandBy(Math.max(this.x1,this.x2), Math.max(this.y1,this.y2));
    }

    toSVGElement(defs: SVGDefsAccum): string {
        if (!this.visible) return '';
        this.updateTransform();
        return `<line x1="${this.x1}" y1="${this.y1}" x2="${this.x2}" y2="${this.y2}" ${_styleAttrs(this.style, defs)} transform="${this.transform.toCSSMatrix()}"/>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        _applyCanvasStyle(ctx, this.style, ctx.canvas);
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
        ctx.restore();
    }

    clone(): Line { return new Line({ x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2, style: { ...this.style } }); }
}

export class Polygon extends Shape2D
{
    points : [number, number][];
    closed : boolean;

    constructor(opts: PolygonOptions = {}) {
        super();
        this.points = opts.points ?? [];
        this.closed = opts.closed ?? true;
        if (opts.style) this.style = { ...opts.style };
    }

    getBBox(): BBox2D {
        const box = new BBox2D();
        for (const [x, y] of this.points) box.expandBy(x, y);
        return box;
    }

    toSVGElement(defs: SVGDefsAccum): string {
        if (!this.visible || !this.points.length) return '';
        this.updateTransform();
        const pts = this.points.map(([x,y]) => `${x},${y}`).join(' ');
        const tag = this.closed ? 'polygon' : 'polyline';
        return `<${tag} points="${pts}" ${_styleAttrs(this.style, defs)} transform="${this.transform.toCSSMatrix()}"/>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible || !this.points.length) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        _applyCanvasStyle(ctx, this.style, ctx.canvas);
        ctx.beginPath();
        ctx.moveTo(this.points[0][0], this.points[0][1]);
        for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i][0], this.points[i][1]);
        if (this.closed) ctx.closePath();
        if (this.style.fill && this.style.fill !== 'none') ctx.fill();
        if (this.style.stroke && this.style.stroke !== 'none') ctx.stroke();
        ctx.restore();
    }

    clone(): Polygon { return new Polygon({ points: this.points.map(p => [...p] as [number,number]), closed: this.closed, style: { ...this.style } }); }
}

export class Path extends Shape2D
{
    d: string;

    constructor(opts: PathOptions = {}) {
        super();
        this.d = opts.d ?? '';
        if (opts.style) this.style = { ...opts.style };
    }

    toSVGElement(defs: SVGDefsAccum): string {
        if (!this.visible) return '';
        this.updateTransform();
        return `<path d="${this.d}" ${_styleAttrs(this.style, defs)} transform="${this.transform.toCSSMatrix()}"/>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible || !this.d) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        _applyCanvasStyle(ctx, this.style, ctx.canvas);
        const p2d = new Path2D(this.d);
        if (this.style.fill && this.style.fill !== 'none') ctx.fill(p2d);
        if (this.style.stroke && this.style.stroke !== 'none') ctx.stroke(p2d);
        ctx.restore();
    }

    getBBox(): BBox2D { return new BBox2D(); }
    clone(): Path { return new Path({ d: this.d, style: { ...this.style } }); }
}

export class Text2D extends Shape2D
{
    text           : string;
    tx             : number;
    ty             : number;
    fontSize       : number;
    fontFamily     : string;
    fontWeight     : string;
    textAnchor     : 'start' | 'middle' | 'end';
    dominantBaseline: string;

    constructor(opts: TextOptions = {}) {
        super();
        this.text             = opts.text      ?? '';
        this.tx               = opts.x         ?? 0;
        this.ty               = opts.y         ?? 0;
        this.fontSize         = opts.fontSize  ?? 16;
        this.fontFamily       = opts.fontFamily ?? 'sans-serif';
        this.fontWeight       = opts.fontWeight ?? 'normal';
        this.textAnchor       = opts.textAnchor ?? 'start';
        this.dominantBaseline = opts.dominantBaseline ?? 'auto';
        if (opts.style) this.style = { ...opts.style };
    }

    toSVGElement(defs: SVGDefsAccum): string {
        if (!this.visible) return '';
        this.updateTransform();
        const fill = typeof this.style.fill === 'string' ? this.style.fill : '#000';
        return `<text x="${this.tx}" y="${this.ty}" font-size="${this.fontSize}" font-family="${this.fontFamily}" font-weight="${this.fontWeight}" text-anchor="${this.textAnchor}" dominant-baseline="${this.dominantBaseline}" fill="${fill}" opacity="${this.style.opacity ?? 1}" transform="${this.transform.toCSSMatrix()}">${_escXml2(this.text)}</text>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        _applyCanvasStyle(ctx, this.style, ctx.canvas);
        ctx.font        = `${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
        ctx.textAlign   = this.textAnchor === 'middle' ? 'center' : this.textAnchor === 'end' ? 'right' : 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(this.text, this.tx, this.ty);
        if (this.style.stroke && this.style.stroke !== 'none') ctx.strokeText(this.text, this.tx, this.ty);
        ctx.restore();
    }

    getBBox(): BBox2D { return new BBox2D().expandBy(this.tx, this.ty - this.fontSize).expandBy(this.tx + this.text.length * this.fontSize * 0.6, this.ty); }
    clone(): Text2D { return new Text2D({ text: this.text, x: this.tx, y: this.ty, fontSize: this.fontSize, fontFamily: this.fontFamily, fontWeight: this.fontWeight, textAnchor: this.textAnchor, style: { ...this.style } }); }
}

export class Image2D extends Shape2D
{
    href   : string;
    ix     : number;
    iy     : number;
    iw     : number;
    ih     : number;
    #img   : HTMLImageElement | null = null;

    constructor(opts: ImageOptions = {}) {
        super();
        this.href = opts.href ?? '';
        this.ix   = opts.x      ?? 0; this.iy = opts.y      ?? 0;
        this.iw   = opts.width  ?? 0; this.ih = opts.height ?? 0;
        if (opts.style) this.style = { ...opts.style };
    }

    load(): Promise<this> {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload  = () => { this.#img = img; if (!this.iw) this.iw = img.naturalWidth; if (!this.ih) this.ih = img.naturalHeight; res(this); };
            img.onerror = rej;
            img.src     = this.href;
        });
    }

    toSVGElement(defs: SVGDefsAccum): string {
        if (!this.visible) return '';
        this.updateTransform();
        return `<image href="${this.href}" x="${this.ix}" y="${this.iy}" width="${this.iw}" height="${this.ih}" transform="${this.transform.toCSSMatrix()}" opacity="${this.style.opacity ?? 1}"/>`;
    }

    drawCanvas(ctx: CanvasRenderingContext2D): void {
        if (!this.visible || !this.#img) return;
        this.updateTransform();
        ctx.save();
        const e = this.transform.e;
        ctx.transform(e[0], e[1], e[3], e[4], e[6], e[7]);
        if (this.style.opacity !== undefined) ctx.globalAlpha = this.style.opacity;
        ctx.drawImage(this.#img, this.ix, this.iy, this.iw, this.ih);
        ctx.restore();
    }

    clone(): Image2D { return new Image2D({ href: this.href, x: this.ix, y: this.iy, width: this.iw, height: this.ih, style: { ...this.style } }); }
}

function _escXml2(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Renderers ─────────────────────────────────────────────────────────────────

export interface RendererOptions {
    width?      : number;
    height?     : number;
    background? : string;
    pixelRatio? : number;
    antialias?  : boolean;
}

export class SVGRenderer
{
    readonly stage : Stage2D;
    #svg           : SVGSVGElement | null = null;
    #container     : Element | null       = null;
    width          : number;
    height         : number;
    background     : string;

    constructor(opts: RendererOptions = {})
    {
        this.width      = opts.width      ?? 800;
        this.height     = opts.height     ?? 600;
        this.background = opts.background ?? 'transparent';
        this.stage      = new Stage2D(this.width, this.height);
    }

    mount(target: string | Element): this
    {
        const el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return this;
        this.#container = el;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
        svg.setAttribute('width',   String(this.width));
        svg.setAttribute('height',  String(this.height));
        svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
        svg.style.background = this.background;
        el.appendChild(svg);
        this.#svg = svg;

        // Pointer event delegation
        svg.addEventListener('click',     e => this.#hitTest(e, 'click'));
        svg.addEventListener('mousemove', e => this.#hitTest(e, 'mousemove'));
        svg.addEventListener('mousedown', e => this.#hitTest(e, 'mousedown'));

        return this;
    }

    render(): this
    {
        if (!this.#svg) { this.#renderToString(); return this; }
        const defs   = new SVGDefsAccum();
        const inner  = this.stage.children.map(c => c.toSVGElement(defs)).join('\n');
        const defsXml = defs.render();
        this.#svg.innerHTML = defsXml ? `<defs>${defsXml}</defs>\n${inner}` : inner;
        return this;
    }

    #renderToString(): string
    {
        const defs  = new SVGDefsAccum();
        const inner = this.stage.children.map(c => c.toSVGElement(defs)).join('\n');
        const d     = defs.render();
        const bg    = this.background !== 'transparent' ? `<rect width="${this.width}" height="${this.height}" fill="${this.background}"/>` : '';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">${d ? `<defs>${d}</defs>` : ''}${bg}${inner}</svg>`;
    }

    toSVG(): string { return this.#renderToString(); }

    #hitTest(e: MouseEvent, type: string): void
    {
        const rect = (e.target as Element).closest('svg')?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        this.stage.children.forEach(c => this.#testShape(c, x, y, e, type));
    }

    #testShape(shape: Shape2D, x: number, y: number, e: MouseEvent, type: string): void
    {
        if (!shape.visible) return;
        if (shape instanceof Group2D) { shape.children.forEach(c => this.#testShape(c, x, y, e, type)); return; }
        const bb = shape.getBBox();
        if (bb.contains(x, y)) shape.fire(type, e);
    }

    dispose(): void { this.#svg?.remove(); }
}

export class CanvasRenderer
{
    readonly stage    : Stage2D;
    readonly canvas   : HTMLCanvasElement;
    #ctx              : CanvasRenderingContext2D;
    width             : number;
    height            : number;
    background        : string;
    pixelRatio        : number;

    constructor(canvas: HTMLCanvasElement, opts: RendererOptions = {})
    {
        this.canvas     = canvas;
        this.width      = opts.width      ?? canvas.width  ?? 800;
        this.height     = opts.height     ?? canvas.height ?? 600;
        this.background = opts.background ?? 'transparent';
        this.pixelRatio = opts.pixelRatio ?? (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
        this.stage      = new Stage2D(this.width, this.height);

        canvas.width  = this.width  * this.pixelRatio;
        canvas.height = this.height * this.pixelRatio;
        canvas.style.width  = `${this.width}px`;
        canvas.style.height = `${this.height}px`;

        this.#ctx = canvas.getContext('2d', { alpha: true })!;
        this.#ctx.scale(this.pixelRatio, this.pixelRatio);

        canvas.addEventListener('click',     e => this.#hitTest(e, 'click'));
        canvas.addEventListener('mousemove', e => this.#hitTest(e, 'mousemove'));
        canvas.addEventListener('mousedown', e => this.#hitTest(e, 'mousedown'));
    }

    render(): this
    {
        const ctx = this.#ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        if (this.background && this.background !== 'transparent') {
            ctx.fillStyle = this.background;
            ctx.fillRect(0, 0, this.width, this.height);
        }
        for (const child of this.stage.children) child.drawCanvas(ctx);
        return this;
    }

    #hitTest(e: MouseEvent, type: string): void
    {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.width / rect.width);
        const y = (e.clientY - rect.top)  * (this.height / rect.height);
        this.stage.children.forEach(c => this.#testShape(c, x, y, e, type));
    }

    #testShape(shape: Shape2D, x: number, y: number, e: MouseEvent, type: string): void
    {
        if (!shape.visible) return;
        if (shape instanceof Group2D) { shape.children.forEach(c => this.#testShape(c, x, y, e, type)); return; }
        if (shape.getBBox().contains(x, y)) shape.fire(type, e);
    }

    toSVG(): string
    {
        // Convert to SVG string via SVGRenderer
        const r = new SVGRenderer({ width: this.width, height: this.height, background: this.background });
        r.stage.children.push(...this.stage.children);
        return r.toSVG();
    }

    async toPNG(quality = 0.92): Promise<Blob>
    {
        return new Promise((res, rej) => {
            this.canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas toBlob failed')), 'image/png', quality);
        });
    }

    async toJPEG(quality = 0.85): Promise<Blob>
    {
        return new Promise((res, rej) => {
            this.canvas.toBlob(b => b ? res(b) : rej(new Error('Canvas toBlob failed')), 'image/jpeg', quality);
        });
    }

    resize(w: number, h: number): this
    {
        this.width  = w; this.height = h;
        this.canvas.width  = w * this.pixelRatio;
        this.canvas.height = h * this.pixelRatio;
        this.canvas.style.width  = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.#ctx.scale(this.pixelRatio, this.pixelRatio);
        this.stage.width = w; this.stage.height = h;
        return this;
    }

    dispose(): void { /* event listeners auto-cleaned */ }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export type TwoRendererMode = 'svg' | 'canvas';
export type TwoRenderer = SVGRenderer | CanvasRenderer;

export function createRenderer(
    target : string | HTMLCanvasElement | HTMLElement,
    opts   : RendererOptions & { mode?: TwoRendererMode } = {}
): TwoRenderer
{
    const mode = opts.mode ?? (target instanceof HTMLCanvasElement ? 'canvas' : 'svg');

    if (mode === 'canvas') {
        const canvas = target instanceof HTMLCanvasElement
            ? target
            : (() => { const c = document.createElement('canvas'); (target instanceof HTMLElement ? target : document.querySelector(target as string) ?? document.body).appendChild(c); return c; })();
        return new CanvasRenderer(canvas, opts);
    } else {
        const r = new SVGRenderer(opts);
        const el = typeof target === 'string'
            ? document.querySelector(target)
            : target;
        if (el) r.mount(el);
        return r;
    }
}

// ── Easing functions ──────────────────────────────────────────────────────────

export type EasingName =
    | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
    | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
    | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
    | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
    | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce'
    | 'easeInElastic' | 'easeOutElastic' | 'easeInBack' | 'easeOutBack'
    | 'spring';

export type EasingFn = (t: number) => number;

const _easings: Record<EasingName, EasingFn> = {
    linear          : t => t,
    easeIn          : t => t * t,
    easeOut         : t => t * (2 - t),
    easeInOut       : t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t,
    easeInQuad      : t => t * t,
    easeOutQuad     : t => 1 - (1-t) * (1-t),
    easeInOutQuad   : t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2,
    easeInCubic     : t => t * t * t,
    easeOutCubic    : t => 1 - Math.pow(1-t, 3),
    easeInOutCubic  : t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2,
    easeInQuart     : t => t * t * t * t,
    easeOutQuart    : t => 1 - Math.pow(1-t, 4),
    easeInOutQuart  : t => t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2,4)/2,
    easeInBounce    : t => 1 - _easings.easeOutBounce(1 - t),
    easeOutBounce   : t => {
        if (t < 1/2.75)       return 7.5625*t*t;
        if (t < 2/2.75)       return 7.5625*(t-=1.5/2.75)*t+0.75;
        if (t < 2.5/2.75)     return 7.5625*(t-=2.25/2.75)*t+0.9375;
        return 7.5625*(t-=2.625/2.75)*t+0.984375;
    },
    easeInOutBounce : t => t < 0.5 ? (1-_easings.easeOutBounce(1-2*t))/2 : (1+_easings.easeOutBounce(2*t-1))/2,
    easeInElastic   : t => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2,10*t-10)*Math.sin((t*10-10.75)*(2*Math.PI/3)),
    easeOutElastic  : t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2,-10*t)*Math.sin((t*10-0.75)*(2*Math.PI/3))+1,
    easeInBack      : t => { const c1=1.70158, c3=c1+1; return c3*t*t*t-c1*t*t; },
    easeOutBack     : t => { const c1=1.70158, c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); },
    spring          : t => {
        const s = 1 - Math.exp(-t * 6) * Math.cos(t * 20);
        return Math.max(0, Math.min(1, s));
    },
};

// ── Tween ─────────────────────────────────────────────────────────────────────

export type Animatable = Record<string, number>;

export class Tween<T extends Animatable>
{
    #target   : T;
    #from     : Partial<T>;
    #to       : Partial<T>;
    #duration : number;
    #elapsed  = 0;
    #easing   : EasingFn = _easings.linear;
    #delay    = 0;
    #repeat   = 0;
    #yoyo     = false;
    #done     = false;
    #dir      = 1; // 1 = forward, -1 = backward (yoyo)
    #repeatCount = 0;
    onUpdate  : ((target: T, progress: number) => void) | null = null;
    onComplete: ((target: T) => void) | null = null;
    onStart   : ((target: T) => void) | null = null;
    #started  = false;

    constructor(target: T, to: Partial<T>, duration = 400)
    {
        this.#target   = target;
        this.#to       = to;
        this.#duration = duration;
        this.#from     = {} as Partial<T>;
        for (const k in to) this.#from[k] = target[k] as T[Extract<keyof T, string>];
    }

    easing(e: EasingName | EasingFn): this
    {
        this.#easing = typeof e === 'function' ? e : (_easings[e] ?? _easings.linear);
        return this;
    }

    delay(ms: number): this { this.#delay = ms; return this; }
    repeat(n: number): this { this.#repeat = n; return this; }
    yoyo(v = true): this { this.#yoyo = v; return this; }

    start(): this { (_tweens as Set<unknown>).add(this); return this; }
    stop(): this  { (_tweens as Set<unknown>).delete(this); this.#done = true; return this; }
    get done(): boolean { return this.#done; }

    /** Called by Timeline/loop — dt in ms */
    tick(dt: number): boolean
    {
        if (this.#done) return true;
        this.#elapsed += dt;

        if (this.#elapsed < this.#delay) return false;
        const t = Math.min((this.#elapsed - this.#delay) / this.#duration, 1);

        if (!this.#started) { this.#started = true; this.onStart?.(this.#target); }

        const et = this.#dir === 1 ? this.#easing(t) : this.#easing(1 - t);

        for (const k in this.#to) {
            const from = (this.#from[k] ?? 0) as number;
            const to   = (this.#to[k]   ?? 0) as number;
            (this.#target as Animatable)[k] = from + (to - from) * et;
        }

        this.onUpdate?.(this.#target, t);

        if (t >= 1) {
            if (this.#yoyo) this.#dir *= -1;
            if (this.#repeatCount < this.#repeat) {
                this.#elapsed  = this.#delay;
                this.#repeatCount++;
            } else {
                this.#done = true;
                this.onComplete?.(this.#target);
                (_tweens as Set<unknown>).delete(this);
                return true;
            }
        }
        return false;
    }
}

const _tweens = new Set<Tween<Animatable>>();

// ── Timeline ──────────────────────────────────────────────────────────────────

export class Timeline
{
    #entries : { tween: Tween<Animatable>; startAt: number }[] = [];
    #elapsed = 0;
    #done    = false;
    #loop    = false;
    onComplete: (() => void) | null = null;

    add(tween: Tween<Animatable>, startAt?: number): this
    {
        const at = startAt ?? this.#entries.reduce((m, e) => Math.max(m, e.startAt), 0);
        this.#entries.push({ tween, startAt: at });
        return this;
    }

    loop(v = true): this { this.#loop = v; return this; }

    play(): this { _timelines.add(this); return this; }
    stop(): this { _timelines.delete(this); return this; }

    tick(dt: number): boolean
    {
        if (this.#done) return true;
        this.#elapsed += dt;
        let allDone = true;
        for (const { tween, startAt } of this.#entries) {
            if (this.#elapsed >= startAt) {
                const localDt = this.#elapsed - startAt;
                if (!tween.done) { tween.tick(localDt); allDone = false; }
            } else { allDone = false; }
        }
        if (allDone) {
            if (this.#loop) this.#elapsed = 0;
            else { this.#done = true; this.onComplete?.(); _timelines.delete(this); return true; }
        }
        return false;
    }
}

const _timelines = new Set<Timeline>();

// ── AnimationLoop2D ───────────────────────────────────────────────────────────

export class AnimationLoop2D
{
    #rafId   = 0;
    #running = false;
    #last    = 0;
    onFrame  : (dt: number, time: number) => void;

    constructor(fn: (dt: number, time: number) => void) { this.onFrame = fn; }

    start(): this
    {
        if (this.#running) return this;
        this.#running = true; this.#last = performance.now();
        const loop = (now: number) => {
            if (!this.#running) return;
            const dt = now - this.#last; this.#last = now;
            // Tick global tweens and timelines
            _tweens.forEach(tw => tw.tick(dt));
            _timelines.forEach(tl => tl.tick(dt));
            this.onFrame(dt, now);
            this.#rafId = requestAnimationFrame(loop);
        };
        this.#rafId = requestAnimationFrame(loop);
        return this;
    }

    stop(): this { this.#running = false; cancelAnimationFrame(this.#rafId); return this; }
    get running(): boolean { return this.#running; }
}

// ── Path builder (D3-style fluent API) ────────────────────────────────────────

export class PathBuilder
{
    #cmds: string[] = [];

    moveTo(x: number, y: number): this { this.#cmds.push(`M${x},${y}`); return this; }
    lineTo(x: number, y: number): this { this.#cmds.push(`L${x},${y}`); return this; }
    hLineTo(x: number): this           { this.#cmds.push(`H${x}`);       return this; }
    vLineTo(y: number): this           { this.#cmds.push(`V${y}`);       return this; }
    close(): this                      { this.#cmds.push('Z');            return this; }

    curveTo(cx1: number, cy1: number, cx2: number, cy2: number, x: number, y: number): this
    { this.#cmds.push(`C${cx1},${cy1},${cx2},${cy2},${x},${y}`); return this; }

    smoothCurveTo(cx2: number, cy2: number, x: number, y: number): this
    { this.#cmds.push(`S${cx2},${cy2},${x},${y}`); return this; }

    quadTo(cx: number, cy: number, x: number, y: number): this
    { this.#cmds.push(`Q${cx},${cy},${x},${y}`); return this; }

    smoothQuadTo(x: number, y: number): this
    { this.#cmds.push(`T${x},${y}`); return this; }

    arc(rx: number, ry: number, angle: number, largeArc: 0|1, sweep: 0|1, x: number, y: number): this
    { this.#cmds.push(`A${rx},${ry},${angle},${largeArc},${sweep},${x},${y}`); return this; }

    /** Draw a circular arc centered at (cx,cy) from startAngle to endAngle (radians). */
    arcAround(cx: number, cy: number, r: number, startAngle: number, endAngle: number, antiClockwise = false): this
    {
        const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
        const end   = { x: cx + r * Math.cos(endAngle),   y: cy + r * Math.sin(endAngle)   };
        const large = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
        const sweep = antiClockwise ? 0 : 1;
        this.moveTo(start.x, start.y);
        this.#cmds.push(`A${r},${r},0,${large},${sweep},${end.x},${end.y}`);
        return this;
    }

    /** Generate a smooth curve through an array of points (Catmull-Rom → cubic Bezier). */
    spline(points: [number, number][], tension = 0.5): this
    {
        if (points.length < 2) return this;
        this.moveTo(points[0][0], points[0][1]);
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i-1)];
            const p1 = points[i];
            const p2 = points[i+1];
            const p3 = points[Math.min(points.length-1, i+2)];
            const cp1x = p1[0] + (p2[0] - p0[0]) * tension / 3;
            const cp1y = p1[1] + (p2[1] - p0[1]) * tension / 3;
            const cp2x = p2[0] - (p3[0] - p1[0]) * tension / 3;
            const cp2y = p2[1] - (p3[1] - p1[1]) * tension / 3;
            this.curveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
        }
        return this;
    }

    toString(): string { return this.#cmds.join(' '); }

    toPath(style?: Style2D): Path
    {
        return new Path({ d: this.toString(), style });
    }
}

// ── Axis helpers (D3-style) ───────────────────────────────────────────────────

export interface ScaleLinear {
    (value: number): number;
    domain(d: [number, number]): ScaleLinear;
    range(r:  [number, number]): ScaleLinear;
    ticks(n?: number): number[];
    invert(px: number): number;
}

export function scaleLinear(): ScaleLinear
{
    let domain: [number, number] = [0, 1];
    let range:  [number, number] = [0, 1];

    const scale = (v: number) => {
        const t = (v - domain[0]) / (domain[1] - domain[0]);
        return range[0] + t * (range[1] - range[0]);
    };

    scale.domain = (d: [number, number]) => { domain = d; return scale; };
    scale.range  = (r: [number, number]) => { range  = r; return scale; };
    scale.ticks  = (n = 5) => {
        const step = (domain[1] - domain[0]) / n;
        return Array.from({ length: n + 1 }, (_, i) => +(domain[0] + i * step).toPrecision(6));
    };
    scale.invert = (px: number) => {
        const t = (px - range[0]) / (range[1] - range[0]);
        return domain[0] + t * (domain[1] - domain[0]);
    };

    return scale as ScaleLinear;
}

export interface ScaleBand {
    (key: string): number;
    domain(d: string[]): ScaleBand;
    range(r: [number, number]): ScaleBand;
    bandwidth(): number;
    padding(p: number): ScaleBand;
}

export function scaleBand(): ScaleBand
{
    let domain: string[] = [];
    let range:  [number, number] = [0, 1];
    let pad = 0.1;

    const scale = (key: string): number => {
        const idx = domain.indexOf(key);
        if (idx < 0) return NaN;
        const bw  = scale.bandwidth();
        const gap = (range[1] - range[0]) * pad / domain.length;
        return range[0] + idx * (bw + gap) + gap / 2;
    };

    scale.domain    = (d: string[]) => { domain = d; return scale; };
    scale.range     = (r: [number, number]) => { range = r; return scale; };
    scale.bandwidth = () => {
        const total = range[1] - range[0];
        const gaps  = total * pad;
        return (total - gaps) / Math.max(domain.length, 1);
    };
    scale.padding   = (p: number) => { pad = p; return scale; };

    return scale as ScaleBand;
}

// ── Export helpers ────────────────────────────────────────────────────────────

export const Export2D = {

    /**
     * Export a renderer's stage as SVG string.
     */
    toSVG(renderer: SVGRenderer | CanvasRenderer): string
    {
        return renderer.toSVG();
    },

    /**
     * Download SVG string as a .svg file.
     */
    downloadSVG(renderer: SVGRenderer | CanvasRenderer, filename = 'image.svg'): void
    {
        const blob = new Blob([renderer.toSVG()], { type: 'image/svg+xml' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    },

    /**
     * Download canvas renderer output as .png.
     */
    async downloadPNG(renderer: CanvasRenderer, filename = 'image.png'): Promise<void>
    {
        const blob = await renderer.toPNG();
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    },

    /**
     * Export stage to a minimal single-page PDF (via Canvas).
     */
    async toPDF(renderer: CanvasRenderer): Promise<Blob>
    {
        // Render to canvas, then embed as JPEG in PDF
        const jpeg = await renderer.toJPEG(0.85);
        const buf  = await jpeg.arrayBuffer();
        const b64  = btoa(String.fromCharCode(...new Uint8Array(buf)));

        const w = renderer.width, h = renderer.height;
        const obj: string[] = [];
        let   xref: number[] = [], pos = 0;

        const write = (s: string) => { obj.push(s); pos += new TextEncoder().encode(s).length; };

        write('%PDF-1.4\n');
        xref[1] = pos; write(`1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`);
        xref[2] = pos; write(`2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`);
        xref[3] = pos; write(`3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${w} ${h}]/Contents 4 0 R/Resources<</XObject<</I0 5 0 R>>>>>>\nendobj\n`);

        const stream = `q ${w} 0 0 ${h} 0 0 cm /I0 Do Q`;
        xref[4] = pos; write(`4 0 obj\n<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj\n`);

        const imgData = atob(b64);
        xref[5] = pos; write(`5 0 obj\n<</Type/XObject/Subtype/Image/Width ${w}/Height ${h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${imgData.length}>>\nstream\n`);
        write(imgData);
        write('\nendstream\nendobj\n');

        const xrefPos = pos;
        write(`xref\n0 6\n0000000000 65535 f \n`);
        for (let i = 1; i <= 5; i++) write(`${String(xref[i]).padStart(10,'0')} 00000 n \n`);
        write(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`);

        return new Blob([obj.join('')], { type: 'application/pdf' });
    },
};

// ── Public API ────────────────────────────────────────────────────────────────

export const Two = {
    // Renderer factory
    createRenderer,
    SVGRenderer,
    CanvasRenderer,

    // Shapes
    Shape2D,
    Group2D,
    Stage2D,
    Circle,
    Rect,
    Ellipse,
    Line,
    Polygon,
    Path,
    Text: Text2D,
    Image: Image2D,

    // Math
    Vec2D,
    Mat3,
    BBox2D,

    // Path builder
    PathBuilder,
    path: () => new PathBuilder(),

    // Scales (D3-style)
    scaleLinear,
    scaleBand,

    // Animation
    Tween,
    Timeline,
    AnimationLoop: AnimationLoop2D,

    // Easing functions (accessible for custom use)
    easings: {
        linear          : (t: number) => t,
        easeIn          : (t: number) => t * t,
        easeOut         : (t: number) => t * (2 - t),
        easeInOut       : (t: number) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t,
        easeInCubic     : (t: number) => t * t * t,
        easeOutCubic    : (t: number) => 1 - Math.pow(1-t, 3),
        easeInOutCubic  : (t: number) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2,
        easeOutBounce   : (t: number) => {
            if (t < 1/2.75)   return 7.5625*t*t;
            if (t < 2/2.75)   return 7.5625*(t-=1.5/2.75)*t+0.75;
            if (t < 2.5/2.75) return 7.5625*(t-=2.25/2.75)*t+0.9375;
            return 7.5625*(t-=2.625/2.75)*t+0.984375;
        },
        spring          : (t: number) => Math.max(0, Math.min(1, 1 - Math.exp(-t*6)*Math.cos(t*20))),
    } satisfies Record<string, (t: number) => number>,

    // Export
    Export: Export2D,
};

// ── Global registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Two', {
        value       : Two,
        writable    : false,
        enumerable  : false,
        configurable: false,
    });

export default Two;
