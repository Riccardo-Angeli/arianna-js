/**
 * @internal Shared base, type interfaces and geometry helpers for A.r.i.a.n.n.A. 3D Modifiers.
 */

// ── Three.ts type interfaces (subset) ────────────────────────────────────────

export interface Vec3Like { x: number; y: number; z: number; }

export interface Geometry3Like {
    vertices : Vec3Like[];
    normals  : Vec3Like[];
    indices  : number[];
    uvs?     : [number, number][];
    clone():  Geometry3Like;
}

export interface MeshLike {
    geometry  : Geometry3Like;
    position  : Vec3Like;
    rotation  : Vec3Like;
    scale     : Vec3Like;
    visible   : boolean;
    userData  : Record<string, unknown>;
    updateMatrix?(): void;
}

export interface SceneLike {
    children: MeshLike[];
    add(obj: MeshLike): void;
    remove(obj: MeshLike): void;
}

export interface CameraLike {
    position: Vec3Like;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

export function _v3(x: number, y: number, z: number): Vec3Like { return { x, y, z }; }
export function _vAdd(a: Vec3Like, b: Vec3Like): Vec3Like { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
export function _vSub(a: Vec3Like, b: Vec3Like): Vec3Like { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
export function _vScale(v: Vec3Like, s: number): Vec3Like { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
export function _vLen(v: Vec3Like): number                 { return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2); }
export function _vNorm(v: Vec3Like): Vec3Like              { const l = _vLen(v) || 1; return _vScale(v, 1 / l); }
export function _vCross(a: Vec3Like, b: Vec3Like): Vec3Like { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
export function _vLerp(a: Vec3Like, b: Vec3Like, t: number): Vec3Like { return _vAdd(a, _vScale(_vSub(b, a), t)); }

export function _cloneGeom(g: Geometry3Like): Geometry3Like {
    return {
        vertices: g.vertices.map(v => ({ ...v })),
        normals:  g.normals.map(v  => ({ ...v })),
        indices:  [...g.indices],
        uvs:      g.uvs ? g.uvs.map(uv => [...uv] as [number, number]) : undefined,
        clone()   { return _cloneGeom(this); },
    };
}

export function _recomputeNormals(g: Geometry3Like): void {
    const normals: Vec3Like[] = Array.from({ length: g.vertices.length }, () => _v3(0, 0, 0));
    for (let i = 0; i < g.indices.length; i += 3) {
        const [ia, ib, ic] = g.indices.slice(i, i + 3);
        const n = _vNorm(_vCross(_vSub(g.vertices[ib], g.vertices[ia]), _vSub(g.vertices[ic], g.vertices[ia])));
        [ia, ib, ic].forEach(idx => { normals[idx] = _vAdd(normals[idx], n); });
    }
    g.normals = normals.map(_vNorm);
}

// ── Base 3D modifier ──────────────────────────────────────────────────────────

export abstract class Modifier3D {
    protected mesh    : MeshLike;
    protected enabled = true;
    protected cleanups: (() => void)[] = [];

    constructor(mesh: MeshLike) { this.mesh = mesh; }

    enable(): this  { this.enabled = true;  return this; }
    disable(): this { this.enabled = false; return this; }
    destroy(): void { this.cleanups.forEach(fn => fn()); this.cleanups = []; }

    abstract apply(): this;
}
