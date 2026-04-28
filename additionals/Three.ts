/**
 * @module    Three
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * AriannA Three — WebGPU 3D renderer + scene graph + modifiers.
 * Zero dependencies. Pure TypeScript.
 *
 * ── RENDERER ─────────────────────────────────────────────────────────────────
 *   WebGPU primary  (Chrome 113+, Safari 18+, Edge 113+)
 *   WebGL2 fallback (disposable — will be removed when WebGPU is universal)
 *
 * ── SCENE GRAPH ──────────────────────────────────────────────────────────────
 *   Scene → Object3D → Mesh | Light | Camera | Group
 *   Every node: position / rotation / scale / matrix / children
 *
 * ── GEOMETRIES ───────────────────────────────────────────────────────────────
 *   BoxGeometry / SphereGeometry / CylinderGeometry / PlaneGeometry
 *   ConeGeometry / TorusGeometry / BufferGeometry (custom)
 *
 * ── MATERIALS ────────────────────────────────────────────────────────────────
 *   MeshBasicMaterial / MeshLambertMaterial / MeshPhongMaterial
 *   MeshPBRMaterial / WireframeMaterial / LineMaterial
 *
 * ── LIGHTS ───────────────────────────────────────────────────────────────────
 *   AmbientLight / DirectionalLight / PointLight / SpotLight
 *
 * ── CAMERAS ──────────────────────────────────────────────────────────────────
 *   PerspectiveCamera / OrthographicCamera
 *
 * ── MODIFIERS (pure JS BSP/geometry) ─────────────────────────────────────────
 *   CSG.union / CSG.subtract / CSG.intersect  (BSP tree)
 *   SubdivisionModifier  (Catmull-Clark)
 *   BevelModifier        (edge bevel)
 *   DecimateModifier     (vertex collapse)
 *   MirrorModifier       (axis mirror)
 *   ArrayModifier        (repeat along axis)
 *   BendModifier / TwistModifier
 *
 * ── IMPORT / EXPORT ──────────────────────────────────────────────────────────
 *   STL  (binary + ASCII) read/write
 *   OBJ  read/write
 *   glTF / GLB  read/write
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *   const renderer = await Three.createRenderer(canvas);
 *   const scene    = new Three.Scene();
 *   const camera   = new Three.PerspectiveCamera(60, canvas.width / canvas.height);
 *   camera.position.set(0, 1, 5);
 *
 *   const geo  = new Three.BoxGeometry(1, 1, 1);
 *   const mat  = new Three.MeshPBRMaterial({ color: '#e40c88' });
 *   const mesh = new Three.Mesh(geo, mat);
 *   scene.add(mesh);
 *
 *   renderer.render(scene, camera);
 *
 * @example
 *   // CSG — subtract a sphere from a box
 *   const box    = new Three.Mesh(new Three.BoxGeometry(2,2,2));
 *   const sphere = new Three.Mesh(new Three.SphereGeometry(1.2));
 *   const result = Three.CSG.subtract(box, sphere);
 *   scene.add(result);
 */

// ── WebGPU type declarations (self-contained, no @webgpu/types needed) ────────

declare global {
    interface GPUDevice {
        createBuffer(desc: { size: number; usage: number; mappedAtCreation?: boolean }): GPUBuffer;
        createTexture(desc: { size: number[]; format: string; usage: number; sampleCount?: number }): GPUTexture;
        createShaderModule(desc: { code: string }): GPUShaderModule;
        createRenderPipeline(desc: object): GPURenderPipeline;
        createComputePipeline(desc: object): GPUComputePipeline;
        createBindGroupLayout(desc: object): GPUBindGroupLayout;
        createBindGroup(desc: object): GPUBindGroup;
        createPipelineLayout(desc: object): GPUPipelineLayout;
        createCommandEncoder(): GPUCommandEncoder;
        createSampler(desc?: object): GPUSampler;
        readonly queue: GPUQueue;
        destroy(): void;
    }
    interface GPUBuffer { destroy(): void; }
    interface GPUTexture { createView(desc?: object): GPUTextureView; destroy(): void; }
    interface GPUTextureView {}
    interface GPUSampler {}
    interface GPUShaderModule {}
    interface GPURenderPipeline {}
    interface GPUComputePipeline {}
    interface GPUBindGroupLayout {}
    interface GPUBindGroup {}
    interface GPUPipelineLayout {}
    interface GPUCanvasContext {
        configure(desc: object): void;
        getCurrentTexture(): GPUTexture;
    }
    interface GPUQueue {
        writeBuffer(buf: GPUBuffer, offset: number, data: ArrayBuffer | ArrayBufferView): void;
        submit(cmds: GPUCommandBuffer[]): void;
    }
    interface GPUCommandEncoder {
        beginRenderPass(desc: object): GPURenderPassEncoder;
        beginComputePass(desc?: object): GPUComputePassEncoder;
        finish(): GPUCommandBuffer;
    }
    interface GPURenderPassEncoder {
        setPipeline(p: GPURenderPipeline): void;
        setBindGroup(idx: number, bg: GPUBindGroup): void;
        setVertexBuffer(slot: number, buf: GPUBuffer): void;
        setIndexBuffer(buf: GPUBuffer, fmt: string): void;
        draw(count: number, instances?: number): void;
        drawIndexed(count: number, instances?: number): void;
        end(): void;
    }
    interface GPUComputePassEncoder {
        setPipeline(p: GPUComputePipeline): void;
        setBindGroup(idx: number, bg: GPUBindGroup): void;
        dispatchWorkgroups(x: number, y?: number, z?: number): void;
        end(): void;
    }
    interface GPUCommandBuffer {}
    interface GPUAdapter {
        requestDevice(desc?: object): Promise<GPUDevice>;
    }
    interface GPU {
        requestAdapter(desc?: object): Promise<GPUAdapter | null>;
        getPreferredCanvasFormat(): string;
    }
    interface Navigator { readonly gpu: GPU; }
    interface HTMLCanvasElement {
        getContext(id: 'webgpu'): GPUCanvasContext | null;
    }
}


// ── Math primitives ───────────────────────────────────────────────────────────

export class Vec2
{
    constructor(public x = 0, public y = 0) {}

    set(x: number, y: number): this { this.x = x; this.y = y; return this; }
    clone(): Vec2 { return new Vec2(this.x, this.y); }
    add(v: Vec2): this { this.x += v.x; this.y += v.y; return this; }
    sub(v: Vec2): this { this.x -= v.x; this.y -= v.y; return this; }
    scale(s: number): this { this.x *= s; this.y *= s; return this; }
    length(): number { return Math.sqrt(this.x*this.x + this.y*this.y); }
    normalize(): this { const l = this.length() || 1; return this.scale(1/l); }
    dot(v: Vec2): number { return this.x*v.x + this.y*v.y; }
    toArray(): [number, number] { return [this.x, this.y]; }
    static from(a: [number, number]): Vec2 { return new Vec2(a[0], a[1]); }
}

export class Vec3
{
    constructor(public x = 0, public y = 0, public z = 0) {}

    set(x: number, y: number, z: number): this { this.x = x; this.y = y; this.z = z; return this; }
    clone(): Vec3 { return new Vec3(this.x, this.y, this.z); }
    copy(v: Vec3): this { this.x = v.x; this.y = v.y; this.z = v.z; return this; }

    add(v: Vec3): this { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    addScalar(s: number): this { this.x += s; this.y += s; this.z += s; return this; }
    sub(v: Vec3): this { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    mul(v: Vec3): this { this.x *= v.x; this.y *= v.y; this.z *= v.z; return this; }
    scale(s: number): this { this.x *= s; this.y *= s; this.z *= s; return this; }
    negate(): this { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }

    length(): number { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); }
    lengthSq(): number { return this.x*this.x + this.y*this.y + this.z*this.z; }
    normalize(): this { const l = this.length() || 1; return this.scale(1/l); }

    dot(v: Vec3): number { return this.x*v.x + this.y*v.y + this.z*v.z; }
    cross(v: Vec3): Vec3 {
        return new Vec3(
            this.y*v.z - this.z*v.y,
            this.z*v.x - this.x*v.z,
            this.x*v.y - this.y*v.x,
        );
    }

    distanceTo(v: Vec3): number { return this.clone().sub(v).length(); }
    lerp(v: Vec3, t: number): this {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        this.z += (v.z - this.z) * t;
        return this;
    }

    applyMat4(m: Mat4): this {
        const { x, y, z } = this;
        const e = m.elements;
        const w = 1 / (e[3]*x + e[7]*y + e[11]*z + e[15]);
        this.x = (e[0]*x + e[4]*y + e[8] *z + e[12]) * w;
        this.y = (e[1]*x + e[5]*y + e[9] *z + e[13]) * w;
        this.z = (e[2]*x + e[6]*y + e[10]*z + e[14]) * w;
        return this;
    }

    applyQuat(q: Quaternion): this {
        const { x, y, z } = this;
        const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
        const ix =  qw*x + qy*z - qz*y;
        const iy =  qw*y + qz*x - qx*z;
        const iz =  qw*z + qx*y - qy*x;
        const iw = -qx*x - qy*y - qz*z;
        this.x = ix*qw + iw*(-qx) + iy*(-qz) - iz*(-qy);
        this.y = iy*qw + iw*(-qy) + iz*(-qx) - ix*(-qz);
        this.z = iz*qw + iw*(-qz) + ix*(-qy) - iy*(-qx);
        return this;
    }

    toArray(): [number, number, number] { return [this.x, this.y, this.z]; }
    toFloat32(): Float32Array { return new Float32Array([this.x, this.y, this.z]); }
    equals(v: Vec3, eps = 1e-6): boolean {
        return Math.abs(this.x-v.x) < eps && Math.abs(this.y-v.y) < eps && Math.abs(this.z-v.z) < eps;
    }

    static from(a: [number,number,number] | number[]): Vec3 { return new Vec3(a[0]!, a[1]!, a[2]!); }
    static add(a: Vec3, b: Vec3): Vec3 { return a.clone().add(b); }
    static sub(a: Vec3, b: Vec3): Vec3 { return a.clone().sub(b); }
    static cross(a: Vec3, b: Vec3): Vec3 { return a.cross(b); }
    static dot(a: Vec3, b: Vec3): number { return a.dot(b); }
}

export class Vec4
{
    constructor(public x = 0, public y = 0, public z = 0, public w = 1) {}
    set(x: number, y: number, z: number, w: number): this { this.x=x; this.y=y; this.z=z; this.w=w; return this; }
    clone(): Vec4 { return new Vec4(this.x, this.y, this.z, this.w); }
    toArray(): [number,number,number,number] { return [this.x,this.y,this.z,this.w]; }
    toFloat32(): Float32Array { return new Float32Array([this.x,this.y,this.z,this.w]); }
}

export class Quaternion
{
    constructor(public x = 0, public y = 0, public z = 0, public w = 1) {}

    set(x: number, y: number, z: number, w: number): this { this.x=x; this.y=y; this.z=z; this.w=w; return this; }
    clone(): Quaternion { return new Quaternion(this.x, this.y, this.z, this.w); }
    copy(q: Quaternion): this { this.x=q.x; this.y=q.y; this.z=q.z; this.w=q.w; return this; }

    identity(): this { this.x=0; this.y=0; this.z=0; this.w=1; return this; }

    setFromAxisAngle(axis: Vec3, angle: number): this {
        const half = angle / 2;
        const s    = Math.sin(half);
        this.x = axis.x * s;
        this.y = axis.y * s;
        this.z = axis.z * s;
        this.w = Math.cos(half);
        return this;
    }

    setFromEuler(x: number, y: number, z: number): this {
        const cx = Math.cos(x/2), sx = Math.sin(x/2);
        const cy = Math.cos(y/2), sy = Math.sin(y/2);
        const cz = Math.cos(z/2), sz = Math.sin(z/2);
        this.x = sx*cy*cz + cx*sy*sz;
        this.y = cx*sy*cz - sx*cy*sz;
        this.z = cx*cy*sz + sx*sy*cz;
        this.w = cx*cy*cz - sx*sy*sz;
        return this;
    }

    multiply(q: Quaternion): this {
        const ax=this.x, ay=this.y, az=this.z, aw=this.w;
        const bx=q.x,    by=q.y,    bz=q.z,    bw=q.w;
        this.x = ax*bw + aw*bx + ay*bz - az*by;
        this.y = ay*bw + aw*by + az*bx - ax*bz;
        this.z = az*bw + aw*bz + ax*by - ay*bx;
        this.w = aw*bw - ax*bx - ay*by - az*bz;
        return this;
    }

    normalize(): this {
        const l = Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z + this.w*this.w) || 1;
        this.x/=l; this.y/=l; this.z/=l; this.w/=l;
        return this;
    }

    slerp(q: Quaternion, t: number): this {
        let dot = this.x*q.x + this.y*q.y + this.z*q.z + this.w*q.w;
        if (dot < 0) { dot = -dot; q = new Quaternion(-q.x,-q.y,-q.z,-q.w); }
        if (dot > 0.9995) {
            this.x += t*(q.x-this.x); this.y += t*(q.y-this.y);
            this.z += t*(q.z-this.z); this.w += t*(q.w-this.w);
            return this.normalize();
        }
        const theta0 = Math.acos(dot);
        const theta  = theta0 * t;
        const sin0   = Math.sin(theta0);
        const sinT   = Math.sin(theta);
        const s1 = Math.cos(theta) - dot * sinT / sin0;
        const s2 = sinT / sin0;
        this.x = s1*this.x + s2*q.x;
        this.y = s1*this.y + s2*q.y;
        this.z = s1*this.z + s2*q.z;
        this.w = s1*this.w + s2*q.w;
        return this;
    }

    toArray(): [number,number,number,number] { return [this.x,this.y,this.z,this.w]; }
}

export class Mat4
{
    elements: Float32Array;

    constructor() { this.elements = new Float32Array(16); this.identity(); }

    identity(): this {
        const e = this.elements;
        e.fill(0);
        e[0]=e[5]=e[10]=e[15]=1;
        return this;
    }

    clone(): Mat4 { const m = new Mat4(); m.elements.set(this.elements); return m; }
    copy(m: Mat4): this { this.elements.set(m.elements); return this; }

    multiply(m: Mat4): this {
        const a = this.elements, b = m.elements, r = new Float32Array(16);
        for (let i = 0; i < 4; i++)
            for (let j = 0; j < 4; j++) {
                let s = 0;
                for (let k = 0; k < 4; k++) s += a[i*4+k] * b[k*4+j];
                r[i*4+j] = s;
            }
        this.elements.set(r);
        return this;
    }

    makeTranslation(x: number, y: number, z: number): this {
        this.identity();
        this.elements[12]=x; this.elements[13]=y; this.elements[14]=z;
        return this;
    }

    makeScale(x: number, y: number, z: number): this {
        this.identity();
        this.elements[0]=x; this.elements[5]=y; this.elements[10]=z;
        return this;
    }

    makeRotationFromQuat(q: Quaternion): this {
        const { x, y, z, w } = q;
        const e = this.elements;
        e[0]  = 1-2*(y*y+z*z); e[1]  = 2*(x*y+z*w);   e[2]  = 2*(x*z-y*w);   e[3]  = 0;
        e[4]  = 2*(x*y-z*w);   e[5]  = 1-2*(x*x+z*z); e[6]  = 2*(y*z+x*w);   e[7]  = 0;
        e[8]  = 2*(x*z+y*w);   e[9]  = 2*(y*z-x*w);   e[10] = 1-2*(x*x+y*y); e[11] = 0;
        e[12] = 0;              e[13] = 0;              e[14] = 0;              e[15] = 1;
        return this;
    }

    compose(pos: Vec3, rot: Quaternion, scl: Vec3): this {
        const te = this.elements;
        const { x, y, z, w } = rot;
        const x2=x+x, y2=y+y, z2=z+z;
        const xx=x*x2, xy=x*y2, xz=x*z2;
        const yy=y*y2, yz=y*z2, zz=z*z2;
        const wx=w*x2, wy=w*y2, wz=w*z2;
        const { x:sx, y:sy, z:sz } = scl;
        te[0]=(1-(yy+zz))*sx; te[1]=(xy+wz)*sx;      te[2]=(xz-wy)*sx;      te[3]=0;
        te[4]=(xy-wz)*sy;     te[5]=(1-(xx+zz))*sy;  te[6]=(yz+wx)*sy;      te[7]=0;
        te[8]=(xz+wy)*sz;     te[9]=(yz-wx)*sz;       te[10]=(1-(xx+yy))*sz; te[11]=0;
        te[12]=pos.x;         te[13]=pos.y;            te[14]=pos.z;          te[15]=1;
        return this;
    }

    makePerspective(fovY: number, aspect: number, near: number, far: number): this {
        const f = 1 / Math.tan(fovY * Math.PI / 360);
        const e = this.elements;
        e.fill(0);
        e[0]  =  f / aspect;
        e[5]  =  f;
        e[10] = -(far + near) / (far - near);
        e[11] = -1;
        e[14] = -(2 * far * near) / (far - near);
        return this;
    }

    makeOrthographic(l: number, r: number, t: number, b: number, near: number, far: number): this {
        const e = this.elements;
        e.fill(0);
        e[0]  =  2/(r-l); e[12] = -(r+l)/(r-l);
        e[5]  =  2/(t-b); e[13] = -(t+b)/(t-b);
        e[10] = -2/(far-near); e[14] = -(far+near)/(far-near);
        e[15] = 1;
        return this;
    }

    lookAt(eye: Vec3, target: Vec3, up: Vec3): this {
        const f = Vec3.sub(eye, target).normalize();
        const r = Vec3.cross(up.clone().normalize(), f).normalize();
        const u = Vec3.cross(f, r);
        const e = this.elements;
        e[0]=r.x; e[4]=r.y; e[8] =r.z; e[12]=-(r.x*eye.x+r.y*eye.y+r.z*eye.z);
        e[1]=u.x; e[5]=u.y; e[9] =u.z; e[13]=-(u.x*eye.x+u.y*eye.y+u.z*eye.z);
        e[2]=f.x; e[6]=f.y; e[10]=f.z; e[14]=-(f.x*eye.x+f.y*eye.y+f.z*eye.z);
        e[3]=0;   e[7]=0;   e[11]=0;   e[15]=1;
        return this;
    }

    invert(): this {
        const a = this.elements, inv = new Float32Array(16);
        inv[0]  =  a[5]*a[10]*a[15] - a[5]*a[11]*a[14] - a[9]*a[6]*a[15] + a[9]*a[7]*a[14] + a[13]*a[6]*a[11] - a[13]*a[7]*a[10];
        inv[4]  = -a[4]*a[10]*a[15] + a[4]*a[11]*a[14] + a[8]*a[6]*a[15] - a[8]*a[7]*a[14] - a[12]*a[6]*a[11] + a[12]*a[7]*a[10];
        inv[8]  =  a[4]*a[9] *a[15] - a[4]*a[11]*a[13] - a[8]*a[5]*a[15] + a[8]*a[7]*a[13] + a[12]*a[5]*a[11] - a[12]*a[7]*a[9];
        inv[12] = -a[4]*a[9] *a[14] + a[4]*a[10]*a[13] + a[8]*a[5]*a[14] - a[8]*a[6]*a[13] - a[12]*a[5]*a[10] + a[12]*a[6]*a[9];
        inv[1]  = -a[1]*a[10]*a[15] + a[1]*a[11]*a[14] + a[9]*a[2]*a[15] - a[9]*a[3]*a[14] - a[13]*a[2]*a[11] + a[13]*a[3]*a[10];
        inv[5]  =  a[0]*a[10]*a[15] - a[0]*a[11]*a[14] - a[8]*a[2]*a[15] + a[8]*a[3]*a[14] + a[12]*a[2]*a[11] - a[12]*a[3]*a[10];
        inv[9]  = -a[0]*a[9] *a[15] + a[0]*a[11]*a[13] + a[8]*a[1]*a[15] - a[8]*a[3]*a[13] - a[12]*a[1]*a[11] + a[12]*a[3]*a[9];
        inv[13] =  a[0]*a[9] *a[14] - a[0]*a[10]*a[13] - a[8]*a[1]*a[14] + a[8]*a[2]*a[13] + a[12]*a[1]*a[10] - a[12]*a[2]*a[9];
        inv[2]  =  a[1]*a[6] *a[15] - a[1]*a[7] *a[14] - a[5]*a[2]*a[15] + a[5]*a[3]*a[14] + a[13]*a[2]*a[7]  - a[13]*a[3]*a[6];
        inv[6]  = -a[0]*a[6] *a[15] + a[0]*a[7] *a[14] + a[4]*a[2]*a[15] - a[4]*a[3]*a[14] - a[12]*a[2]*a[7]  + a[12]*a[3]*a[6];
        inv[10] =  a[0]*a[5] *a[15] - a[0]*a[7] *a[13] - a[4]*a[1]*a[15] + a[4]*a[3]*a[13] + a[12]*a[1]*a[7]  - a[12]*a[3]*a[5];
        inv[14] = -a[0]*a[5] *a[14] + a[0]*a[6] *a[13] + a[4]*a[1]*a[14] - a[4]*a[2]*a[13] - a[12]*a[1]*a[6]  + a[12]*a[2]*a[5];
        inv[3]  = -a[1]*a[6] *a[11] + a[1]*a[7] *a[10] + a[5]*a[2]*a[11] - a[5]*a[3]*a[10] - a[9]*a[2]*a[7]   + a[9]*a[3]*a[6];
        inv[7]  =  a[0]*a[6] *a[11] - a[0]*a[7] *a[10] - a[4]*a[2]*a[11] + a[4]*a[3]*a[10] + a[8]*a[2]*a[7]   - a[8]*a[3]*a[6];
        inv[11] = -a[0]*a[5] *a[11] + a[0]*a[7] *a[9]  + a[4]*a[1]*a[11] - a[4]*a[3]*a[9]  - a[8]*a[1]*a[7]   + a[8]*a[3]*a[5];
        inv[15] =  a[0]*a[5] *a[10] - a[0]*a[6] *a[9]  - a[4]*a[1]*a[10] + a[4]*a[2]*a[9]  + a[8]*a[1]*a[6]   - a[8]*a[2]*a[5];
        let det = a[0]*inv[0] + a[1]*inv[4] + a[2]*inv[8] + a[3]*inv[12];
        if (Math.abs(det) < 1e-10) return this;
        det = 1 / det;
        for (let i = 0; i < 16; i++) this.elements[i] = inv[i] * det;
        return this;
    }

    transpose(): this {
        const e = this.elements;
        let t;
        t=e[1]; e[1]=e[4]; e[4]=t;    t=e[2]; e[2]=e[8]; e[8]=t;
        t=e[3]; e[3]=e[12]; e[12]=t;  t=e[6]; e[6]=e[9]; e[9]=t;
        t=e[7]; e[7]=e[13]; e[13]=t;  t=e[11]; e[11]=e[14]; e[14]=t;
        return this;
    }
}

export class Box3
{
    min = new Vec3(Infinity, Infinity, Infinity);
    max = new Vec3(-Infinity, -Infinity, -Infinity);

    expandByPoint(p: Vec3): this {
        this.min.x = Math.min(this.min.x, p.x);
        this.min.y = Math.min(this.min.y, p.y);
        this.min.z = Math.min(this.min.z, p.z);
        this.max.x = Math.max(this.max.x, p.x);
        this.max.y = Math.max(this.max.y, p.y);
        this.max.z = Math.max(this.max.z, p.z);
        return this;
    }

    getCenter(out = new Vec3()): Vec3 {
        return out.set(
            (this.min.x + this.max.x) / 2,
            (this.min.y + this.max.y) / 2,
            (this.min.z + this.max.z) / 2,
        );
    }

    getSize(out = new Vec3()): Vec3 {
        return out.set(
            this.max.x - this.min.x,
            this.max.y - this.min.y,
            this.max.z - this.min.z,
        );
    }
}

// ── Color ─────────────────────────────────────────────────────────────────────

export class Color
{
    r: number; g: number; b: number; a: number;

    constructor(r = 1, g = 1, b = 1, a = 1) { this.r=r; this.g=g; this.b=b; this.a=a; }

    setHex(hex: string): this {
        const h = hex.replace('#', '');
        this.r = parseInt(h.slice(0,2), 16) / 255;
        this.g = parseInt(h.slice(2,4), 16) / 255;
        this.b = parseInt(h.slice(4,6), 16) / 255;
        return this;
    }

    toArray(): [number,number,number,number] { return [this.r,this.g,this.b,this.a]; }
    toFloat32(): Float32Array { return new Float32Array([this.r,this.g,this.b,this.a]); }
    clone(): Color { return new Color(this.r,this.g,this.b,this.a); }

    static fromHex(hex: string): Color { return new Color().setHex(hex); }
    static white(): Color { return new Color(1,1,1,1); }
    static black(): Color { return new Color(0,0,0,1); }
}

// ── Geometry ──────────────────────────────────────────────────────────────────

export class BufferGeometry
{
    positions  : Float32Array = new Float32Array(0);
    normals    : Float32Array = new Float32Array(0);
    uvs        : Float32Array = new Float32Array(0);
    indices    : Uint32Array  = new Uint32Array(0);
    vertexCount: number = 0;
    indexCount : number = 0;
    boundingBox: Box3 = new Box3();

    setPositions(data: Float32Array | number[]): this {
        this.positions   = data instanceof Float32Array ? data : new Float32Array(data);
        this.vertexCount = this.positions.length / 3;
        this.#computeBB();
        return this;
    }
    setNormals(data: Float32Array | number[]): this { this.normals = data instanceof Float32Array ? data : new Float32Array(data); return this; }
    setUVs(data: Float32Array | number[]): this     { this.uvs = data instanceof Float32Array ? data : new Float32Array(data); return this; }
    setIndices(data: Uint32Array | number[]): this  { this.indices = data instanceof Uint32Array ? data : new Uint32Array(data); this.indexCount = this.indices.length; return this; }

    #computeBB(): void {
        this.boundingBox = new Box3();
        for (let i = 0; i < this.positions.length; i += 3)
            this.boundingBox.expandByPoint(new Vec3(this.positions[i], this.positions[i+1], this.positions[i+2]));
    }

    computeNormals(): this {
        const pos = this.positions, idx = this.indices;
        const nrm = new Float32Array(pos.length);
        const process = (i0: number, i1: number, i2: number) => {
            const ax=pos[i0*3], ay=pos[i0*3+1], az=pos[i0*3+2];
            const bx=pos[i1*3], by=pos[i1*3+1], bz=pos[i1*3+2];
            const cx=pos[i2*3], cy=pos[i2*3+1], cz=pos[i2*3+2];
            const ex=bx-ax, ey=by-ay, ez=bz-az;
            const fx=cx-ax, fy=cy-ay, fz=cz-az;
            const nx=ey*fz-ez*fy, ny=ez*fx-ex*fz, nz=ex*fy-ey*fx;
            for (const ii of [i0,i1,i2]) {
                nrm[ii*3]  +=nx; nrm[ii*3+1]+=ny; nrm[ii*3+2]+=nz;
            }
        };
        if (idx.length > 0)
            for (let i = 0; i < idx.length; i+=3) process(idx[i], idx[i+1], idx[i+2]);
        else
            for (let i = 0; i < pos.length/3; i+=3) process(i, i+1, i+2);
        // Normalize
        for (let i = 0; i < nrm.length; i+=3) {
            const l = Math.sqrt(nrm[i]*nrm[i] + nrm[i+1]*nrm[i+1] + nrm[i+2]*nrm[i+2]) || 1;
            nrm[i]/=l; nrm[i+1]/=l; nrm[i+2]/=l;
        }
        this.normals = nrm;
        return this;
    }

    clone(): BufferGeometry {
        const g = new BufferGeometry();
        g.positions   = new Float32Array(this.positions);
        g.normals     = new Float32Array(this.normals);
        g.uvs         = new Float32Array(this.uvs);
        g.indices     = new Uint32Array(this.indices);
        g.vertexCount = this.vertexCount;
        g.indexCount  = this.indexCount;
        return g;
    }
}

export class BoxGeometry extends BufferGeometry
{
    constructor(w = 1, h = 1, d = 1, wSeg = 1, hSeg = 1, dSeg = 1)
    {
        super();
        const hw=w/2, hh=h/2, hd=d/2;
        const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
        let vi = 0;
        const addFace = (ax: number, ay: number, az: number, bx: number, by: number, bz: number,
                         cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
                         nx: number, ny: number, nz: number) => {
            pos.push(ax,ay,az, bx,by,bz, cx,cy,cz, dx,dy,dz);
            for (let i=0;i<4;i++) nrm.push(nx,ny,nz);
            uv.push(0,0, 1,0, 1,1, 0,1);
            idx.push(vi,vi+1,vi+2, vi,vi+2,vi+3); vi+=4;
        };
        addFace(-hw,-hh,hd, hw,-hh,hd, hw,hh,hd, -hw,hh,hd, 0,0,1);
        addFace(hw,-hh,-hd,-hw,-hh,-hd,-hw,hh,-hd, hw,hh,-hd, 0,0,-1);
        addFace(-hw,hh,hd, hw,hh,hd, hw,hh,-hd,-hw,hh,-hd, 0,1,0);
        addFace(-hw,-hh,-hd,hw,-hh,-hd,hw,-hh,hd,-hw,-hh,hd, 0,-1,0);
        addFace(hw,-hh,hd, hw,-hh,-hd,hw,hh,-hd, hw,hh,hd, 1,0,0);
        addFace(-hw,-hh,-hd,-hw,-hh,hd,-hw,hh,hd,-hw,hh,-hd,-1,0,0);
        this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
    }
}

export class SphereGeometry extends BufferGeometry
{
    constructor(radius = 1, wSeg = 32, hSeg = 16)
    {
        super();
        const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
        for (let j = 0; j <= hSeg; j++) {
            const theta  = j * Math.PI / hSeg;
            const sinT   = Math.sin(theta), cosT = Math.cos(theta);
            for (let i = 0; i <= wSeg; i++) {
                const phi = i * 2 * Math.PI / wSeg;
                const x   = -sinT * Math.cos(phi);
                const y   =  cosT;
                const z   =  sinT * Math.sin(phi);
                pos.push(x*radius, y*radius, z*radius);
                nrm.push(x,y,z);
                uv.push(i/wSeg, j/hSeg);
            }
        }
        for (let j = 0; j < hSeg; j++)
            for (let i = 0; i < wSeg; i++) {
                const a = j*(wSeg+1)+i, b=a+wSeg+1;
                idx.push(a,b,a+1, b,b+1,a+1);
            }
        this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
    }
}

export class CylinderGeometry extends BufferGeometry
{
    constructor(rTop = 0.5, rBot = 0.5, height = 1, radSeg = 32, hSeg = 1, openEnded = false)
    {
        super();
        const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
        let vi = 0;
        const hy = height / 2;
        for (let j = 0; j <= hSeg; j++) {
            const v   = j / hSeg;
            const r   = rTop + (rBot - rTop) * v;
            const y   = hy - height * v;
            for (let i = 0; i <= radSeg; i++) {
                const theta = i * 2 * Math.PI / radSeg;
                const x = Math.sin(theta), z = Math.cos(theta);
                const slope = (rBot - rTop) / height;
                const nl = Math.sqrt(1 + slope*slope);
                pos.push(x*r, y, z*r);
                nrm.push(x/nl, slope/nl, z/nl);
                uv.push(i/radSeg, 1-v);
            }
        }
        for (let j = 0; j < hSeg; j++)
            for (let i = 0; i < radSeg; i++) {
                const a = j*(radSeg+1)+i, b=a+radSeg+1;
                idx.push(a,b,a+1, b,b+1,a+1);
                vi+=2;
            }
        const colCount = radSeg + 1;
        if (!openEnded) {
            const topY = hy, botY = -hy;
            const topCenter = pos.length/3; pos.push(0,topY,0); nrm.push(0,1,0); uv.push(0.5,0.5);
            for (let i = 0; i <= radSeg; i++) {
                const theta = i*2*Math.PI/radSeg;
                pos.push(Math.sin(theta)*rTop, topY, Math.cos(theta)*rTop);
                nrm.push(0,1,0); uv.push(0.5+0.5*Math.sin(theta), 0.5+0.5*Math.cos(theta));
            }
            for (let i = 0; i < radSeg; i++) idx.push(topCenter, topCenter+1+i+1, topCenter+1+i);
            const botCenter = pos.length/3; pos.push(0,botY,0); nrm.push(0,-1,0); uv.push(0.5,0.5);
            for (let i = 0; i <= radSeg; i++) {
                const theta = i*2*Math.PI/radSeg;
                pos.push(Math.sin(theta)*rBot, botY, Math.cos(theta)*rBot);
                nrm.push(0,-1,0); uv.push(0.5+0.5*Math.sin(theta), 0.5+0.5*Math.cos(theta));
            }
            for (let i = 0; i < radSeg; i++) idx.push(botCenter, botCenter+1+i, botCenter+1+i+1);
        }
        this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
    }
}

export class PlaneGeometry extends BufferGeometry
{
    constructor(w = 1, h = 1, wSeg = 1, hSeg = 1)
    {
        super();
        const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
        const hw = w/2, hh = h/2;
        for (let j = 0; j <= hSeg; j++)
            for (let i = 0; i <= wSeg; i++) {
                pos.push(-hw + i*w/wSeg, hh - j*h/hSeg, 0);
                nrm.push(0,0,1);
                uv.push(i/wSeg, 1-j/hSeg);
            }
        for (let j = 0; j < hSeg; j++)
            for (let i = 0; i < wSeg; i++) {
                const a=j*(wSeg+1)+i, b=a+wSeg+1;
                idx.push(a,b,a+1, b,b+1,a+1);
            }
        this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
    }
}

export class ConeGeometry extends CylinderGeometry
{
    constructor(radius = 1, height = 2, radSeg = 32, hSeg = 1) { super(0, radius, height, radSeg, hSeg); }
}

export class TorusGeometry extends BufferGeometry
{
    constructor(radius = 1, tube = 0.4, radSeg = 32, tubeSeg = 16)
    {
        super();
        const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
        for (let j = 0; j <= radSeg; j++) {
            for (let i = 0; i <= tubeSeg; i++) {
                const u = i / tubeSeg * 2 * Math.PI;
                const v = j / radSeg * 2 * Math.PI;
                const x = (radius + tube * Math.cos(v)) * Math.cos(u);
                const y = (radius + tube * Math.cos(v)) * Math.sin(u);
                const z = tube * Math.sin(v);
                pos.push(x, y, z);
                const cx = Math.cos(u)*Math.cos(v), cy = Math.sin(u)*Math.cos(v), cz = Math.sin(v);
                nrm.push(cx,cy,cz);
                uv.push(i/tubeSeg, j/radSeg);
            }
        }
        for (let j = 0; j < radSeg; j++)
            for (let i = 0; i < tubeSeg; i++) {
                const a=j*(tubeSeg+1)+i, b=a+tubeSeg+1;
                idx.push(a,b,a+1, b,b+1,a+1);
            }
        this.setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
    }
}

// ── Materials ─────────────────────────────────────────────────────────────────

export interface MaterialOptions
{
    color?     : string | Color;
    emissive?  : string | Color;
    roughness? : number;
    metalness? : number;
    opacity?   : number;
    wireframe? : boolean;
    side?      : 'front' | 'back' | 'both';
}

function _toColor(c?: string | Color): Color
{
    if (!c) return Color.white();
    if (c instanceof Color) return c.clone();
    return Color.fromHex(c);
}

export class Material
{
    color     : Color;
    emissive  : Color;
    roughness : number;
    metalness : number;
    opacity   : number;
    wireframe : boolean;
    side      : 'front' | 'back' | 'both';
    type      : string = 'basic';

    constructor(opts: MaterialOptions = {})
    {
        this.color     = _toColor(opts.color);
        this.emissive  = _toColor(opts.emissive ?? '#000000');
        this.roughness = opts.roughness ?? 0.5;
        this.metalness = opts.metalness ?? 0;
        this.opacity   = opts.opacity   ?? 1;
        this.wireframe = opts.wireframe ?? false;
        this.side      = opts.side      ?? 'front';
    }
}

export class MeshBasicMaterial    extends Material { constructor(o: MaterialOptions = {}) { super(o); this.type = 'basic'; } }
export class MeshLambertMaterial  extends Material { constructor(o: MaterialOptions = {}) { super(o); this.type = 'lambert'; } }
export class MeshPhongMaterial    extends Material {
    shininess = 30;
    constructor(o: MaterialOptions & { shininess?: number } = {}) { super(o); this.type = 'phong'; this.shininess = o.shininess ?? 30; }
}
export class MeshPBRMaterial      extends Material { constructor(o: MaterialOptions = {}) { super(o); this.type = 'pbr'; } }
export class WireframeMaterial    extends Material { constructor(o: MaterialOptions = {}) { super({ ...o, wireframe: true }); this.type = 'wireframe'; } }
export class LineMaterial         extends Material { lineWidth = 1; constructor(o: MaterialOptions & { lineWidth?: number } = {}) { super(o); this.type = 'line'; this.lineWidth = o.lineWidth ?? 1; } }

// ── Lights ────────────────────────────────────────────────────────────────────

export interface LightOptions
{
    color?     : string | Color;
    intensity? : number;
}

export class Light
{
    color     : Color;
    intensity : number;
    type      : string = 'ambient';

    constructor(opts: LightOptions = {})
    {
        this.color     = _toColor(opts.color ?? '#ffffff');
        this.intensity = opts.intensity ?? 1;
    }
}

export class AmbientLight     extends Light { constructor(o: LightOptions = {}) { super(o); this.type = 'ambient'; } }
export class DirectionalLight extends Light {
    direction = new Vec3(0, -1, 0);
    castShadow = false;
    constructor(o: LightOptions & { direction?: Vec3 } = {}) { super(o); this.type = 'directional'; if (o.direction) this.direction.copy(o.direction); }
}
export class PointLight extends Light {
    position = new Vec3();
    distance = 0;
    decay    = 2;
    constructor(o: LightOptions & { position?: Vec3; distance?: number } = {}) {
        super(o); this.type = 'point';
        if (o.position) this.position.copy(o.position);
        if (o.distance !== undefined) this.distance = o.distance;
    }
}
export class SpotLight extends Light {
    position  = new Vec3();
    direction = new Vec3(0,-1,0);
    angle     = Math.PI / 6;
    penumbra  = 0.1;
    constructor(o: LightOptions & { position?: Vec3; direction?: Vec3; angle?: number } = {}) {
        super(o); this.type = 'spot';
        if (o.position)  this.position.copy(o.position);
        if (o.direction) this.direction.copy(o.direction);
        if (o.angle !== undefined) this.angle = o.angle;
    }
}

// ── Scene graph ───────────────────────────────────────────────────────────────

let _objId = 0;

export class Object3D
{
    readonly id       = ++_objId;
    name              = '';
    position          = new Vec3();
    rotation          = new Vec3();  // Euler XYZ radians
    quaternion        = new Quaternion();
    scale             = new Vec3(1, 1, 1);
    matrix            = new Mat4();
    matrixWorld       = new Mat4();
    parent            : Object3D | null = null;
    children          : Object3D[] = [];
    visible           = true;
    castShadow        = false;
    receiveShadow     = false;
    userData          : Record<string, unknown> = {};

    add(...objects: Object3D[]): this
    {
        for (const o of objects) {
            if (o.parent) o.parent.remove(o);
            o.parent = this;
            this.children.push(o);
        }
        return this;
    }

    remove(...objects: Object3D[]): this
    {
        for (const o of objects) {
            const i = this.children.indexOf(o);
            if (i >= 0) { this.children.splice(i, 1); o.parent = null; }
        }
        return this;
    }

    updateMatrix(): void
    {
        this.quaternion.setFromEuler(this.rotation.x, this.rotation.y, this.rotation.z);
        this.matrix.compose(this.position, this.quaternion, this.scale);
    }

    updateMatrixWorld(force = false): void
    {
        this.updateMatrix();
        if (!this.parent) {
            this.matrixWorld.copy(this.matrix);
        } else {
            this.matrixWorld.copy(this.parent.matrixWorld).multiply(this.matrix);
        }
        for (const child of this.children) child.updateMatrixWorld(force);
    }

    traverse(cb: (o: Object3D) => void): void
    {
        cb(this);
        for (const c of this.children) c.traverse(cb);
    }

    getWorldPosition(out = new Vec3()): Vec3
    {
        this.updateMatrixWorld();
        out.x = this.matrixWorld.elements[12];
        out.y = this.matrixWorld.elements[13];
        out.z = this.matrixWorld.elements[14];
        return out;
    }

    lookAt(target: Vec3): void
    {
        const pos = this.getWorldPosition();
        const m   = new Mat4().lookAt(pos, target, new Vec3(0,1,0));
        this.quaternion.setFromEuler(
            Math.atan2( m.elements[6],  m.elements[10]),
            Math.atan2(-m.elements[2],  Math.sqrt(m.elements[6]**2 + m.elements[10]**2)),
            Math.atan2( m.elements[1],  m.elements[0]),
        );
    }

    clone(recursive = true): Object3D
    {
        const o = new Object3D();
        o.name     = this.name;
        o.position = this.position.clone();
        o.rotation = this.rotation.clone();
        o.scale    = this.scale.clone();
        o.visible  = this.visible;
        if (recursive) for (const c of this.children) o.add(c.clone(true));
        return o;
    }
}

export class Group extends Object3D {}

export class Mesh extends Object3D
{
    geometry : BufferGeometry;
    material : Material;

    // GPU buffer handles — set by renderer
    _gpuBuffers : {
        vertex?   : GPUBuffer;
        normal?   : GPUBuffer;
        uv?       : GPUBuffer;
        index?    : GPUBuffer;
        uniform?  : GPUBuffer;
        pipeline? : GPURenderPipeline;
    } = {};

    // WebGL buffer handles — set by renderer
    _glBuffers : {
        vao?    : WebGLVertexArrayObject;
        vertex? : WebGLBuffer;
        normal? : WebGLBuffer;
        uv?     : WebGLBuffer;
        index?  : WebGLBuffer;
    } = {};

    constructor(geometry: BufferGeometry, material: Material = new MeshBasicMaterial())
    {
        super();
        this.geometry = geometry;
        this.material = material;
    }

    clone(recursive = true): Mesh
    {
        const m = new Mesh(this.geometry.clone(), this.material);
        m.position.copy(this.position);
        m.rotation.copy(this.rotation);
        m.scale.copy(this.scale);
        return m;
    }
}

// ── Cameras ───────────────────────────────────────────────────────────────────

export class Camera extends Object3D
{
    projectionMatrix     = new Mat4();
    projectionMatrixInv  = new Mat4();
    viewMatrix           = new Mat4();
    near = 0.1;
    far  = 1000;

    updateProjectionMatrix(): void {}

    updateViewMatrix(): void
    {
        this.updateMatrixWorld();
        this.viewMatrix.copy(this.matrixWorld).invert();
    }
}

export class PerspectiveCamera extends Camera
{
    fov    : number;
    aspect : number;

    constructor(fov = 60, aspect = 1, near = 0.1, far = 1000)
    {
        super();
        this.fov    = fov;
        this.aspect = aspect;
        this.near   = near;
        this.far    = far;
        this.updateProjectionMatrix();
    }

    updateProjectionMatrix(): void
    {
        this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far);
        this.projectionMatrixInv.copy(this.projectionMatrix).invert();
    }

    setAspect(aspect: number): void { this.aspect = aspect; this.updateProjectionMatrix(); }
}

export class OrthographicCamera extends Camera
{
    left: number; right: number; top: number; bottom: number;

    constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 1000)
    {
        super();
        this.left = left; this.right = right; this.top = top; this.bottom = bottom;
        this.near = near; this.far = far;
        this.updateProjectionMatrix();
    }

    updateProjectionMatrix(): void
    {
        this.projectionMatrix.makeOrthographic(this.left, this.right, this.top, this.bottom, this.near, this.far);
        this.projectionMatrixInv.copy(this.projectionMatrix).invert();
    }
}

// ── Scene ─────────────────────────────────────────────────────────────────────

export class Scene extends Object3D
{
    background : Color | null = null;
    fog        : { color: Color; near: number; far: number } | null = null;

    constructor() { super(); this.name = 'Scene'; }

    get lights(): Light[]
    {
        const result: Light[] = [];
        this.traverse(o => { if (o instanceof Light) result.push(o); });
        return result;
    }

    get meshes(): Mesh[]
    {
        const result: Mesh[] = [];
        this.traverse(o => { if (o instanceof Mesh) result.push(o); });
        return result;
    }
}

// ── WGSL Shaders ──────────────────────────────────────────────────────────────

const _WGSL_COMMON = /* wgsl */`
struct Uniforms {
    modelMatrix      : mat4x4<f32>,
    viewMatrix       : mat4x4<f32>,
    projMatrix       : mat4x4<f32>,
    normalMatrix     : mat4x4<f32>,
    cameraPos        : vec3<f32>,
    time             : f32,
    color            : vec4<f32>,
    emissive         : vec4<f32>,
    roughness        : f32,
    metalness        : f32,
    opacity          : f32,
    _pad             : f32,
};

struct LightData {
    position  : vec4<f32>,
    color     : vec4<f32>,
    direction : vec4<f32>,
    params    : vec4<f32>,  // x=intensity, y=type(0=ambient,1=dir,2=point,3=spot), z=range, w=spotAngle
};

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var<storage, read> lights : array<LightData>;
`;

const _WGSL_VERTEX = /* wgsl */`
${_WGSL_COMMON}

struct VertexIn {
    @location(0) position : vec3<f32>,
    @location(1) normal   : vec3<f32>,
    @location(2) uv       : vec2<f32>,
};

struct VertexOut {
    @builtin(position) clip_pos : vec4<f32>,
    @location(0) world_pos      : vec3<f32>,
    @location(1) world_normal   : vec3<f32>,
    @location(2) uv             : vec2<f32>,
};

@vertex
fn vs_main(in: VertexIn) -> VertexOut {
    var out : VertexOut;
    let world_pos   = u.modelMatrix * vec4<f32>(in.position, 1.0);
    out.clip_pos    = u.projMatrix * u.viewMatrix * world_pos;
    out.world_pos   = world_pos.xyz;
    out.world_normal= normalize((u.normalMatrix * vec4<f32>(in.normal, 0.0)).xyz);
    out.uv          = in.uv;
    return out;
}
`;

const _WGSL_FRAGMENT_PBR = /* wgsl */`
${_WGSL_COMMON}

struct FragIn {
    @location(0) world_pos    : vec3<f32>,
    @location(1) world_normal : vec3<f32>,
    @location(2) uv           : vec2<f32>,
};

const PI = 3.14159265359;

fn distributionGGX(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
    let a  = roughness * roughness;
    let a2 = a * a;
    let NdH  = max(dot(N, H), 0.0);
    let denom = NdH*NdH*(a2-1.0)+1.0;
    return a2 / (PI * denom * denom);
}

fn geometrySchlick(NdV: f32, roughness: f32) -> f32 {
    let k = (roughness+1.0)*(roughness+1.0)/8.0;
    return NdV / (NdV*(1.0-k)+k);
}

fn fresnelSchlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
    return F0 + (1.0-F0)*pow(clamp(1.0-cosTheta,0.0,1.0),5.0);
}

@fragment
fn fs_main(in: FragIn) -> @location(0) vec4<f32> {
    let N     = normalize(in.world_normal);
    let V     = normalize(u.cameraPos - in.world_pos);
    let albedo= u.color.rgb;
    let rough = clamp(u.roughness, 0.04, 1.0);
    let metal = u.metalness;

    var F0 = vec3<f32>(0.04);
    F0 = mix(F0, albedo, metal);

    var Lo = vec3<f32>(0.0);
    let numLights = i32(arrayLength(&lights));
    for (var i = 0; i < numLights; i++) {
        let light    = lights[i];
        let ltype    = i32(light.params.y);
        let lIntensity = light.params.x;
        var L        = vec3<f32>(0.0);
        var radiance = light.color.rgb * lIntensity;

        if (ltype == 0) {
            // Ambient
            Lo += albedo * radiance * 0.03;
            continue;
        } else if (ltype == 1) {
            L = normalize(-light.direction.xyz);
        } else {
            L = normalize(light.position.xyz - in.world_pos);
            let dist = length(light.position.xyz - in.world_pos);
            let atten = 1.0 / max(dist*dist, 0.0001);
            radiance *= atten;
        }

        let H     = normalize(V + L);
        let NdL   = max(dot(N, L), 0.0);
        let NdV   = max(dot(N, V), 0.0);

        let D  = distributionGGX(N, H, rough);
        let G  = geometrySchlick(NdV, rough) * geometrySchlick(NdL, rough);
        let F  = fresnelSchlick(max(dot(H,V),0.0), F0);

        let kD    = (vec3<f32>(1.0) - F) * (1.0 - metal);
        let spec  = D * G * F / max(4.0 * NdV * NdL, 0.001);
        Lo += (kD * albedo / PI + spec) * radiance * NdL;
    }

    Lo += u.emissive.rgb;
    let color = Lo / (Lo + vec3<f32>(1.0)); // Reinhard tonemapping
    return vec4<f32>(pow(color, vec3<f32>(1.0/2.2)), u.opacity);
}
`;

const _WGSL_FRAGMENT_BASIC = /* wgsl */`
${_WGSL_COMMON}

struct FragIn {
    @location(0) world_pos    : vec3<f32>,
    @location(1) world_normal : vec3<f32>,
    @location(2) uv           : vec2<f32>,
};

@fragment
fn fs_main(in: FragIn) -> @location(0) vec4<f32> {
    return vec4<f32>(u.color.rgb, u.opacity);
}
`;

const _WGSL_FRAGMENT_LAMBERT = /* wgsl */`
${_WGSL_COMMON}

struct FragIn {
    @location(0) world_pos    : vec3<f32>,
    @location(1) world_normal : vec3<f32>,
    @location(2) uv           : vec2<f32>,
};

@fragment
fn fs_main(in: FragIn) -> @location(0) vec4<f32> {
    let N = normalize(in.world_normal);
    var diffuse = vec3<f32>(0.0);
    let numLights = i32(arrayLength(&lights));
    for (var i = 0; i < numLights; i++) {
        let light = lights[i]; let ltype = i32(light.params.y);
        if (ltype == 0) { diffuse += light.color.rgb * light.params.x * 0.1; continue; }
        let L   = select(normalize(-light.direction.xyz), normalize(light.position.xyz - in.world_pos), ltype > 1);
        let NdL = max(dot(N, L), 0.0);
        diffuse += light.color.rgb * light.params.x * NdL;
    }
    return vec4<f32>(u.color.rgb * diffuse + u.emissive.rgb, u.opacity);
}
`;

function _wgslFragForType(type: string): string {
    switch (type) {
        case 'pbr':     return _WGSL_FRAGMENT_PBR;
        case 'lambert': return _WGSL_FRAGMENT_LAMBERT;
        default:        return _WGSL_FRAGMENT_BASIC;
    }
}

// ── WebGPU Renderer ───────────────────────────────────────────────────────────

const _UNIFORM_SIZE  = 256; // aligned to 256 bytes
const _LIGHT_STRIDE  = 64;  // 4 vec4<f32>
const _MAX_LIGHTS    = 16;

export class WebGPURenderer
{
    readonly canvas  : HTMLCanvasElement;
    #device          : GPUDevice | null    = null;
    #context         : GPUCanvasContext | null = null;
    #depthTexture    : GPUTexture | null   = null;
    #lightBuffer     : GPUBuffer | null    = null;
    #bindGroupLayout : GPUBindGroupLayout | null = null;
    #pipelineCache   : Map<string, GPURenderPipeline> = new Map();
    #ready           = false;

    constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

    async init(): Promise<boolean>
    {
        if (!navigator.gpu) return false;
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return false;
        this.#device  = await adapter.requestDevice();
        this.#context = this.canvas.getContext('webgpu') as GPUCanvasContext;
        if (!this.#context) return false;

        const fmt = navigator.gpu.getPreferredCanvasFormat();
        this.#context.configure({ device: this.#device, format: fmt, alphaMode: 'premultiplied' });

        this.#bindGroupLayout = this.#device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: (1 | 2) /* VERTEX | FRAGMENT */,
                  buffer: { type: 'uniform' } },
                { binding: 1, visibility: 2 /* GPUShaderStage.FRAGMENT */,
                  buffer: { type: 'read-only-storage' } },
            ],
        });

        this.#lightBuffer = this.#device.createBuffer({
            size  : _LIGHT_STRIDE * _MAX_LIGHTS,
            usage : (128 | 8) /* STORAGE | COPY_DST */,
        });

        this.#createDepthTexture();
        this.#ready = true;
        return true;
    }

    get ready(): boolean { return this.#ready; }

    #createDepthTexture(): void
    {
        this.#depthTexture?.destroy();
        this.#depthTexture = this.#device!.createTexture({
            size   : [this.canvas.width, this.canvas.height],
            format : 'depth24plus',
            usage  : 16 /* GPUTextureUsage.RENDER_ATTACHMENT */,
        });
    }

    resize(w: number, h: number): void
    {
        this.canvas.width  = w;
        this.canvas.height = h;
        if (this.#ready) this.#createDepthTexture();
    }

    #getPipeline(mat: Material): GPURenderPipeline
    {
        const key = mat.type + (mat.wireframe ? '_wire' : '');
        if (this.#pipelineCache.has(key)) return this.#pipelineCache.get(key)!;

        const device = this.#device!;
        const fmt    = navigator.gpu.getPreferredCanvasFormat();

        const shaderModule = device.createShaderModule({
            code: _WGSL_VERTEX + _wgslFragForType(mat.type),
        });

        const pipeline = device.createRenderPipeline({
            layout  : device.createPipelineLayout({ bindGroupLayouts: [this.#bindGroupLayout!] }),
            vertex  : {
                module     : shaderModule,
                entryPoint : 'vs_main',
                buffers    : [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                    { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                    { arrayStride:  8, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
                ],
            },
            fragment: {
                module     : shaderModule,
                entryPoint : 'fs_main',
                targets    : [{ format: fmt, blend: {
                    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                    alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
                } }],
            },
            primitive: {
                topology  : mat.wireframe ? 'line-list' : 'triangle-list',
                cullMode  : mat.side === 'both' ? 'none' : mat.side === 'back' ? 'front' : 'back',
            },
            depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
        });

        this.#pipelineCache.set(key, pipeline);
        return pipeline;
    }

    #uploadMeshBuffers(mesh: Mesh): void
    {
        const device = this.#device!;
        const geo    = mesh.geometry;
        const b      = mesh._gpuBuffers;

        const makeBuffer = (data: Float32Array | Uint32Array, usage: number) => {
            const buf = device.createBuffer({ size: data.byteLength, usage: usage | 8   /* GPUBufferUsage.COPY_DST */ });
            device.queue.writeBuffer(buf, 0, data);
            return buf;
        };

        if (geo.positions.length > 0 && !b.vertex)
            b.vertex = makeBuffer(geo.positions, 32  /* GPUBufferUsage.VERTEX */);
        if (geo.normals.length > 0 && !b.normal)
            b.normal = makeBuffer(geo.normals, 32  /* GPUBufferUsage.VERTEX */);
        if (geo.uvs.length > 0)
            b.uv = makeBuffer(geo.uvs, 32  /* GPUBufferUsage.VERTEX */);
        else
            b.uv = makeBuffer(new Float32Array(geo.vertexCount * 2), 32  /* GPUBufferUsage.VERTEX */);
        if (geo.indices.length > 0 && !b.index)
            b.index = makeBuffer(geo.indices, 16  /* GPUBufferUsage.INDEX */);

        if (!b.uniform)
            b.uniform = device.createBuffer({ size: _UNIFORM_SIZE, usage: 64  /* GPUBufferUsage.UNIFORM */ | 8   /* GPUBufferUsage.COPY_DST */ });
    }

    #uploadUniforms(mesh: Mesh, camera: Camera, time: number): void
    {
        const device = this.#device!;
        const mat    = mesh.material;

        mesh.updateMatrixWorld();
        const normalMat = mesh.matrixWorld.clone().invert().transpose();

        const data = new Float32Array(_UNIFORM_SIZE / 4);
        let   off  = 0;
        data.set(mesh.matrixWorld.elements,            off); off += 16;
        data.set(camera.viewMatrix.elements,           off); off += 16;
        data.set(camera.projectionMatrix.elements,     off); off += 16;
        data.set(normalMat.elements,                   off); off += 16;
        const cp = camera.getWorldPosition();
        data.set([cp.x, cp.y, cp.z, time],             off); off += 4;
        data.set(mat.color.toArray(),                   off); off += 4;
        data.set(mat.emissive.toArray(),                off); off += 4;
        data.set([mat.roughness, mat.metalness, mat.opacity, 0], off);

        device.queue.writeBuffer(mesh._gpuBuffers.uniform!, 0, data);
    }

    #uploadLights(scene: Scene): void
    {
        const device = this.#device!;
        const data   = new Float32Array(_LIGHT_STRIDE / 4 * _MAX_LIGHTS);
        let   off    = 0;

        const lights = scene.lights.slice(0, _MAX_LIGHTS);
        for (const light of lights) {
            const typeId = light.type === 'ambient' ? 0 : light.type === 'directional' ? 1 : light.type === 'point' ? 2 : 3;
            if (light instanceof PointLight) data.set([light.position.x, light.position.y, light.position.z, 1], off);
            else                              data.set([0,0,0,0], off);
            off += 4;
            data.set(light.color.toArray(), off); off += 4;
            if (light instanceof DirectionalLight) data.set([light.direction.x, light.direction.y, light.direction.z, 0], off);
            else                                    data.set([0,-1,0,0], off);
            off += 4;
            data.set([light.intensity, typeId, 0, 0], off); off += 4;
        }

        device.queue.writeBuffer(this.#lightBuffer!, 0, data);
    }

    render(scene: Scene, camera: Camera, time = 0): void
    {
        if (!this.#ready || !this.#device || !this.#context) return;

        camera.updateViewMatrix();

        const device      = this.#device;
        const colorView   = this.#context.getCurrentTexture().createView();
        const depthView   = this.#depthTexture!.createView();

        this.#uploadLights(scene);

        const encoder     = device.createCommandEncoder();
        const bgColor     = scene.background?.toArray() ?? [0, 0, 0, 1];
        const renderPass  = encoder.beginRenderPass({
            colorAttachments: [{ view: colorView, clearValue: { r: bgColor[0], g: bgColor[1], b: bgColor[2], a: bgColor[3] }, loadOp: 'clear', storeOp: 'store' }],
            depthStencilAttachment: { view: depthView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
        });

        for (const mesh of scene.meshes) {
            if (!mesh.visible) continue;

            this.#uploadMeshBuffers(mesh);
            this.#uploadUniforms(mesh, camera, time);

            const pipeline   = this.#getPipeline(mesh.material);
            const bindGroup  = device.createBindGroup({
                layout  : this.#bindGroupLayout!,
                entries : [
                    { binding: 0, resource: { buffer: mesh._gpuBuffers.uniform! } },
                    { binding: 1, resource: { buffer: this.#lightBuffer! } },
                ],
            });

            renderPass.setPipeline(pipeline);
            renderPass.setBindGroup(0, bindGroup);
            renderPass.setVertexBuffer(0, mesh._gpuBuffers.vertex!);
            renderPass.setVertexBuffer(1, mesh._gpuBuffers.normal!);
            renderPass.setVertexBuffer(2, mesh._gpuBuffers.uv!);

            if (mesh._gpuBuffers.index && mesh.geometry.indexCount > 0) {
                renderPass.setIndexBuffer(mesh._gpuBuffers.index, 'uint32');
                renderPass.drawIndexed(mesh.geometry.indexCount);
            } else {
                renderPass.draw(mesh.geometry.vertexCount);
            }
        }

        renderPass.end();
        device.queue.submit([encoder.finish()]);
    }

    dispose(): void
    {
        this.#depthTexture?.destroy();
        this.#lightBuffer?.destroy();
        this.#device?.destroy();
        this.#ready = false;
    }
}

// ── WebGL2 Fallback Renderer ──────────────────────────────────────────────────
// Minimal fallback — renders with Phong shading via WebGL2.
// Disposable when WebGPU is universal.

const _GL_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNorm;
layout(location=2) in vec2 aUV;
uniform mat4 uModel, uView, uProj, uNormal;
out vec3 vWorldPos, vNormal;
out vec2 vUV;
void main() {
    vec4 wp = uModel * vec4(aPos,1.0);
    vWorldPos = wp.xyz;
    vNormal   = normalize((uNormal * vec4(aNorm,0.0)).xyz);
    vUV       = aUV;
    gl_Position = uProj * uView * wp;
}`;

const _GL_FS = `#version 300 es
precision highp float;
in vec3 vWorldPos, vNormal;
in vec2 vUV;
uniform vec4 uColor, uEmissive;
uniform vec3 uLightDir, uLightColor, uAmbient, uCamPos;
uniform float uRoughness, uMetalness, uOpacity;
out vec4 fragColor;
void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(-uLightDir);
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 H = normalize(L + V);
    float diff = max(dot(N,L),0.0);
    float spec = pow(max(dot(N,H),0.0), mix(4.0,128.0,1.0-uRoughness));
    vec3 col = uColor.rgb * (uAmbient + uLightColor * diff) + uLightColor * spec * (1.0-uRoughness) + uEmissive.rgb;
    fragColor = vec4(col, uOpacity);
}`;

export class WebGL2Renderer
{
    readonly canvas : HTMLCanvasElement;
    #gl             : WebGL2RenderingContext | null = null;
    #program        : WebGLProgram | null = null;
    #ready          = false;

    constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

    init(): boolean
    {
        const gl = this.canvas.getContext('webgl2');
        if (!gl) return false;
        this.#gl = gl;

        const vs  = this.#compileShader(gl.VERTEX_SHADER,   _GL_VS);
        const fs  = this.#compileShader(gl.FRAGMENT_SHADER, _GL_FS);
        if (!vs || !fs) return false;

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;

        this.#program = prog;
        gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
        this.#ready = true;
        return true;
    }

    get ready(): boolean { return this.#ready; }

    #compileShader(type: number, src: string): WebGLShader | null
    {
        const gl = this.#gl!;
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src); gl.compileShader(sh);
        return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    }

    render(scene: Scene, camera: Camera): void
    {
        if (!this.#ready || !this.#gl || !this.#program) return;
        const gl = this.#gl, prog = this.#program;

        const bg = scene.background?.toArray() ?? [0,0,0,1];
        gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.useProgram(prog);

        camera.updateViewMatrix();
        const ul = (n: string) => gl.getUniformLocation(prog, n);

        // Lights — take first directional or use default
        const dir   = scene.lights.find(l => l instanceof DirectionalLight) as DirectionalLight | undefined;
        const amb   = scene.lights.find(l => l instanceof AmbientLight);
        const lightDir   = dir ? dir.direction.clone().normalize() : new Vec3(0,-1,0);
        const lightColor = dir ? dir.color.toArray().slice(0,3) : [1,1,1];
        const ambient    = amb ? amb.color.toArray().slice(0,3).map(v => v * amb.intensity) : [0.1,0.1,0.1];
        const cp         = camera.getWorldPosition();

        gl.uniform3fv(ul('uLightDir'),   new Float32Array(lightDir.toArray()));
        gl.uniform3fv(ul('uLightColor'), new Float32Array(lightColor as [number,number,number]));
        gl.uniform3fv(ul('uAmbient'),    new Float32Array(ambient as [number,number,number]));
        gl.uniform3fv(ul('uCamPos'),     new Float32Array([cp.x, cp.y, cp.z]));

        gl.uniformMatrix4fv(ul('uView'), false, camera.viewMatrix.elements);
        gl.uniformMatrix4fv(ul('uProj'), false, camera.projectionMatrix.elements);

        for (const mesh of scene.meshes) {
            if (!mesh.visible) continue;
            mesh.updateMatrixWorld();
            const normalMat = mesh.matrixWorld.clone().invert().transpose();

            gl.uniformMatrix4fv(ul('uModel'),  false, mesh.matrixWorld.elements);
            gl.uniformMatrix4fv(ul('uNormal'), false, normalMat.elements);

            const mat = mesh.material;
            gl.uniform4fv(ul('uColor'),    mat.color.toFloat32());
            gl.uniform4fv(ul('uEmissive'), mat.emissive.toFloat32());
            gl.uniform1f(ul('uRoughness'), mat.roughness);
            gl.uniform1f(ul('uMetalness'), mat.metalness);
            gl.uniform1f(ul('uOpacity'),   mat.opacity);

            // Upload geometry if needed
            const b = mesh._glBuffers;
            const geo = mesh.geometry;

            if (!b.vao) {
                b.vao    = gl.createVertexArray()!;
                b.vertex = gl.createBuffer()!;
                b.normal = gl.createBuffer()!;
                b.uv     = gl.createBuffer()!;
                if (geo.indices.length > 0) b.index = gl.createBuffer()!;

                gl.bindVertexArray(b.vao);
                gl.bindBuffer(gl.ARRAY_BUFFER, b.vertex);
                gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(0);

                gl.bindBuffer(gl.ARRAY_BUFFER, b.normal);
                gl.bufferData(gl.ARRAY_BUFFER, geo.normals.length > 0 ? geo.normals : new Float32Array(geo.positions.length), gl.STATIC_DRAW);
                gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(1);

                gl.bindBuffer(gl.ARRAY_BUFFER, b.uv);
                gl.bufferData(gl.ARRAY_BUFFER, geo.uvs.length > 0 ? geo.uvs : new Float32Array(geo.vertexCount*2), gl.STATIC_DRAW);
                gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(2);

                if (b.index) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW); }
                gl.bindVertexArray(null);
            }

            gl.bindVertexArray(b.vao);
            if (geo.indexCount > 0 && b.index) gl.drawElements(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_INT, 0);
            else                                gl.drawArrays(gl.TRIANGLES, 0, geo.vertexCount);
            gl.bindVertexArray(null);
        }
    }

    dispose(): void
    {
        if (this.#gl && this.#program) this.#gl.deleteProgram(this.#program);
        this.#ready = false;
    }
}

// ── Renderer factory ──────────────────────────────────────────────────────────

export type AnyRenderer = WebGPURenderer | WebGL2Renderer;

export async function createRenderer(canvas: HTMLCanvasElement): Promise<AnyRenderer>
{
    const gpuRenderer = new WebGPURenderer(canvas);
    const gpuOk       = await gpuRenderer.init();
    if (gpuOk) return gpuRenderer;

    // Fallback to WebGL2
    const glRenderer = new WebGL2Renderer(canvas);
    const glOk       = glRenderer.init();
    if (glOk) return glRenderer;

    throw new Error('Three: Neither WebGPU nor WebGL2 is available in this browser.');
}

// ── BSP Tree (for CSG) ────────────────────────────────────────────────────────

interface BSPVertex { pos: Vec3; normal: Vec3; uv: Vec2; }
interface BSPPolygon { vertices: BSPVertex[]; plane: BSPPlane; }
interface BSPPlane { normal: Vec3; w: number; }

const BSP_COPLANAR = 0, BSP_FRONT = 1, BSP_BACK = 2, BSP_SPANNING = 3;
const BSP_EPS = 1e-5;

function _bspPlaneFromVerts(verts: BSPVertex[]): BSPPlane {
    const n = Vec3.cross(
        Vec3.sub(verts[1].pos, verts[0].pos),
        Vec3.sub(verts[2].pos, verts[0].pos),
    ).normalize();
    return { normal: n, w: n.dot(verts[0].pos) };
}

function _bspClassifyPoint(plane: BSPPlane, p: Vec3): number {
    const d = plane.normal.dot(p) - plane.w;
    return d < -BSP_EPS ? BSP_BACK : d > BSP_EPS ? BSP_FRONT : BSP_COPLANAR;
}

function _bspSplitPolygon(plane: BSPPlane, poly: BSPPolygon): { front: BSPPolygon[]; back: BSPPolygon[] } {
    const front: BSPVertex[] = [], back: BSPVertex[] = [];
    const verts = poly.vertices, n = verts.length;

    for (let i = 0; i < n; i++) {
        const j    = (i + 1) % n;
        const vi   = verts[i], vj = verts[j];
        const ti   = _bspClassifyPoint(plane, vi.pos);
        const tj   = _bspClassifyPoint(plane, vj.pos);

        if (ti !== BSP_BACK)  front.push(vi);
        if (ti !== BSP_FRONT) back.push(vi);

        if ((ti | tj) === BSP_SPANNING) {
            const t  = (plane.w - plane.normal.dot(vi.pos)) / plane.normal.dot(Vec3.sub(vj.pos, vi.pos));
            const ip = vi.pos.clone().lerp(vj.pos, t);
            const in_ = vi.normal.clone().lerp(vj.normal, t).normalize();
            const iuv = vi.uv.clone().add(vj.uv.clone().sub(vi.uv).scale(t));
            const iv: BSPVertex = { pos: ip, normal: in_, uv: iuv };
            front.push(iv); back.push(iv);
        }
    }

    const toPolys = (vs: BSPVertex[]) => vs.length >= 3
        ? [{ vertices: vs, plane: _bspPlaneFromVerts(vs) }]
        : [];
    return { front: toPolys(front), back: toPolys(back) };
}

class BSPNode {
    plane    : BSPPlane | null = null;
    front    : BSPNode | null  = null;
    back     : BSPNode | null  = null;
    polygons : BSPPolygon[]    = [];

    build(polys: BSPPolygon[]): void {
        if (!polys.length) return;
        if (!this.plane) this.plane = polys[0].plane;
        const f: BSPPolygon[] = [], b: BSPPolygon[] = [];
        for (const p of polys) {
            const types = p.vertices.map(v => _bspClassifyPoint(this.plane!, v.pos));
            const type  = types.reduce((a, t) => a | t, 0);
            if      (type === BSP_COPLANAR) this.polygons.push(p);
            else if (type === BSP_FRONT)    f.push(p);
            else if (type === BSP_BACK)     b.push(p);
            else {
                const { front, back } = _bspSplitPolygon(this.plane!, p);
                f.push(...front); b.push(...back);
            }
        }
        if (f.length) { this.front = new BSPNode(); this.front.build(f); }
        if (b.length) { this.back  = new BSPNode(); this.back.build(b);  }
    }

    allPolygons(): BSPPolygon[] {
        let p = [...this.polygons];
        if (this.front) p = p.concat(this.front.allPolygons());
        if (this.back)  p = p.concat(this.back.allPolygons());
        return p;
    }

    clone(): BSPNode {
        const n = new BSPNode();
        n.plane    = this.plane ? { normal: this.plane.normal.clone(), w: this.plane.w } : null;
        n.front    = this.front  ? this.front.clone()  : null;
        n.back     = this.back   ? this.back.clone()   : null;
        n.polygons = this.polygons.map(p => ({ vertices: p.vertices.map(v => ({ pos: v.pos.clone(), normal: v.normal.clone(), uv: v.uv.clone() })), plane: { normal: p.plane.normal.clone(), w: p.plane.w } }));
        return n;
    }

    invert(): void {
        for (const p of this.polygons) {
            p.vertices.reverse();
            p.vertices.forEach(v => v.normal.negate());
            p.plane.normal.negate(); p.plane.w = -p.plane.w;
        }
        if (this.plane) { this.plane.normal.negate(); this.plane.w = -this.plane.w; }
        if (this.front) this.front.invert();
        if (this.back)  this.back.invert();
        [this.front, this.back] = [this.back, this.front];
    }

    clipPolygons(polys: BSPPolygon[]): BSPPolygon[] {
        if (!this.plane) return [...polys];
        let f: BSPPolygon[] = [], b: BSPPolygon[] = [];
        for (const p of polys) {
            const { front, back } = _bspSplitPolygon(this.plane, p);
            f.push(...front); b.push(...back);
        }
        if (this.front) f = this.front.clipPolygons(f);
        b = this.back  ? this.back.clipPolygons(b) : [];
        return f.concat(b);
    }

    clipTo(bsp: BSPNode): void {
        this.polygons = bsp.clipPolygons(this.polygons);
        if (this.front) this.front.clipTo(bsp);
        if (this.back)  this.back.clipTo(bsp);
    }
}

function _geomToPolygons(mesh: Mesh): BSPPolygon[]
{
    const geo = mesh.geometry;
    const pos = geo.positions, nrm = geo.normals, uvd = geo.uvs;
    const idx = geo.indices;
    const out: BSPPolygon[] = [];

    const makeVert = (i: number): BSPVertex => ({
        pos:    new Vec3(pos[i*3], pos[i*3+1], pos[i*3+2]).applyMat4(mesh.matrixWorld),
        normal: new Vec3(nrm[i*3]??0, nrm[i*3+1]??0, nrm[i*3+2]??1),
        uv:     new Vec2(uvd[i*2]??0, uvd[i*2+1]??0),
    });

    if (idx.length > 0) {
        for (let i = 0; i < idx.length; i += 3) {
            const verts = [makeVert(idx[i]), makeVert(idx[i+1]), makeVert(idx[i+2])];
            out.push({ vertices: verts, plane: _bspPlaneFromVerts(verts) });
        }
    } else {
        for (let i = 0; i < pos.length/3; i += 3) {
            const verts = [makeVert(i), makeVert(i+1), makeVert(i+2)];
            out.push({ vertices: verts, plane: _bspPlaneFromVerts(verts) });
        }
    }
    return out;
}

function _polygonsToGeom(polys: BSPPolygon[]): BufferGeometry
{
    const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
    let vi = 0;
    for (const p of polys) {
        const n = p.vertices.length;
        for (const v of p.vertices) { pos.push(v.pos.x, v.pos.y, v.pos.z); nrm.push(v.normal.x, v.normal.y, v.normal.z); uv.push(v.uv.x, v.uv.y); }
        for (let i = 1; i < n-1; i++) idx.push(vi, vi+i, vi+i+1);
        vi += n;
    }
    return new BufferGeometry().setPositions(pos).setNormals(nrm).setUVs(uv).setIndices(idx);
}

// ── CSG ───────────────────────────────────────────────────────────────────────

export const CSG = {
    /**
     * Boolean union — merges two meshes.
     * @example
     *   const result = CSG.union(meshA, meshB);
     */
    union(a: Mesh, b: Mesh): Mesh
    {
        a.updateMatrixWorld(); b.updateMatrixWorld();
        const na = new BSPNode(), nb = new BSPNode();
        na.build(_geomToPolygons(a)); nb.build(_geomToPolygons(b));
        na.clipTo(nb); nb.clipTo(na); nb.invert(); nb.clipTo(na); nb.invert();
        na.build(nb.allPolygons());
        return new Mesh(_polygonsToGeom(na.allPolygons()), a.material);
    },

    /**
     * Boolean subtract — subtracts mesh b from mesh a.
     * @example
     *   const result = CSG.subtract(box, sphere);
     */
    subtract(a: Mesh, b: Mesh): Mesh
    {
        a.updateMatrixWorld(); b.updateMatrixWorld();
        const na = new BSPNode(), nb = new BSPNode();
        na.build(_geomToPolygons(a)); nb.build(_geomToPolygons(b));
        na.invert(); na.clipTo(nb); nb.clipTo(na); nb.invert(); nb.clipTo(na); nb.invert();
        na.build(nb.allPolygons()); na.invert();
        return new Mesh(_polygonsToGeom(na.allPolygons()), a.material);
    },

    /**
     * Boolean intersect — keeps only the overlapping volume.
     * @example
     *   const result = CSG.intersect(meshA, meshB);
     */
    intersect(a: Mesh, b: Mesh): Mesh
    {
        a.updateMatrixWorld(); b.updateMatrixWorld();
        const na = new BSPNode(), nb = new BSPNode();
        na.build(_geomToPolygons(a)); nb.build(_geomToPolygons(b));
        na.invert(); nb.clipTo(na); nb.invert(); na.clipTo(nb); nb.clipTo(na);
        na.build(nb.allPolygons()); na.invert();
        return new Mesh(_polygonsToGeom(na.allPolygons()), a.material);
    },
};

// ── Modifiers (pure JS) ───────────────────────────────────────────────────────

export const SubdivisionModifier = {
    /**
     * Catmull-Clark subdivision surface.
     * Smooths a mesh by iterating subdivision steps.
     * @param mesh       - Source mesh
     * @param iterations - Subdivision steps (1-4, default: 1)
     */
    apply(mesh: Mesh, iterations = 1): Mesh
    {
        let geo = mesh.geometry.clone();
        for (let iter = 0; iter < iterations; iter++) geo = _catmullClark(geo);
        return new Mesh(geo, mesh.material);
    },
};

function _catmullClark(geo: BufferGeometry): BufferGeometry
{
    // Build edge and face tables
    const pos   = geo.positions;
    const idx   = geo.indices;
    const verts = geo.vertexCount;

    // Collect faces as quads/tris
    const faces: number[][] = [];
    for (let i = 0; i < idx.length; i += 3) faces.push([idx[i], idx[i+1], idx[i+2]]);

    const newPos: number[] = [];
    const newIdx: number[] = [];

    // Face points
    const facePts: Vec3[] = faces.map(f => {
        const c = new Vec3();
        for (const vi of f) c.add(new Vec3(pos[vi*3], pos[vi*3+1], pos[vi*3+2]));
        return c.scale(1 / f.length);
    });

    // Edge map: edge → [face indices, midpoint]
    const edgeMap = new Map<string, { mid: Vec3; faces: number[] }>();
    const edgeKey = (a: number, b: number) => a < b ? `${a}_${b}` : `${b}_${a}`;
    const edgeAvg = (a: number, b: number, fi: number) => {
        const k = edgeKey(a, b);
        if (!edgeMap.has(k)) edgeMap.set(k, { mid: new Vec3(), faces: [] });
        const e = edgeMap.get(k)!;
        e.faces.push(fi);
        return k;
    };
    faces.forEach((f, fi) => {
        const n = f.length;
        for (let i = 0; i < n; i++) edgeAvg(f[i], f[(i+1)%n], fi);
    });

    // Edge points
    edgeMap.forEach((e, k) => {
        const [ai, bi] = k.split('_').map(Number);
        const a  = new Vec3(pos[ai*3], pos[ai*3+1], pos[ai*3+2]);
        const b  = new Vec3(pos[bi*3], pos[bi*3+1], pos[bi*3+2]);
        const fc = e.faces.length === 2
            ? facePts[e.faces[0]].clone().add(facePts[e.faces[1]]).scale(0.5)
            : a.clone().add(b).scale(0.5);
        e.mid = a.clone().add(b).add(fc).scale(1/3);
    });

    // Vertex valence + face point average
    const vFaces  : Vec3[][] = Array.from({ length: verts }, () => [] as Vec3[]);
    const vEdgeMid : Vec3[][] = Array.from({ length: verts }, () => [] as Vec3[]);
    faces.forEach((f, fi) => {
        for (const vi of f) vFaces[vi].push(facePts[fi]);
    });
    edgeMap.forEach((e, k) => {
        const [ai, bi] = k.split('_').map(Number);
        vEdgeMid[ai].push(e.mid); vEdgeMid[bi].push(e.mid);
    });

    const newVerts: Vec3[] = [];
    for (let i = 0; i < verts; i++) {
        const p  = new Vec3(pos[i*3], pos[i*3+1], pos[i*3+2]);
        const n  = vFaces[i].length;
        if (n === 0) { newVerts.push(p); continue; }
        const fp = vFaces[i].reduce((a, v) => a.add(v), new Vec3()).scale(1/n);
        const ep = vEdgeMid[i].reduce((a, v) => a.add(v), new Vec3()).scale(1/vEdgeMid[i].length);
        newVerts.push(fp.scale(1/n).add(ep.scale(2/n)).add(p.clone().scale((n-3)/n)));
    }

    // Build new geometry — insert face & edge vertices
    const allVerts: Vec3[] = [...newVerts];
    const faceVtxIdx = facePts.map(fp => { allVerts.push(fp); return allVerts.length - 1; });
    const edgeVtxIdx = new Map<string, number>();
    edgeMap.forEach((e, k) => { allVerts.push(e.mid); edgeVtxIdx.set(k, allVerts.length - 1); });

    const outPos: number[] = [];
    const outIdx: number[] = [];
    allVerts.forEach(v => outPos.push(v.x, v.y, v.z));

    faces.forEach((f, fi) => {
        const n  = f.length;
        const fp = faceVtxIdx[fi];
        for (let i = 0; i < n; i++) {
            const vi = f[i], vj = f[(i+1)%n], vk = f[(i+n-1)%n];
            const eij = edgeVtxIdx.get(edgeKey(vi, vj))!;
            const eki = edgeVtxIdx.get(edgeKey(vk, vi))!;
            outIdx.push(vi, eij, fp, eki);
        }
    });

    // Convert quads to tris
    const tris: number[] = [];
    for (let i = 0; i < outIdx.length; i += 4)
        tris.push(outIdx[i], outIdx[i+1], outIdx[i+2], outIdx[i], outIdx[i+2], outIdx[i+3]);

    return new BufferGeometry().setPositions(outPos).setIndices(tris).computeNormals();
}

export const DecimateModifier = {
    /**
     * Reduce vertex count by half-edge collapse.
     * @param mesh  - Source mesh
     * @param ratio - Target ratio of original vertex count (0–1, default: 0.5)
     */
    apply(mesh: Mesh, ratio = 0.5): Mesh
    {
        const geo     = mesh.geometry.clone();
        const pos     = Array.from(geo.positions);
        const idx     = Array.from(geo.indices);
        const target  = Math.max(4, Math.floor(geo.vertexCount * ratio));

        // Build adjacency — for each vertex, which vertices is it connected to
        const adj = new Array<Set<number>>(geo.vertexCount).fill(null as unknown as Set<number>).map(() => new Set<number>());
        for (let i = 0; i < idx.length; i += 3) {
            const a=idx[i],b=idx[i+1],c=idx[i+2];
            adj[a].add(b); adj[a].add(c);
            adj[b].add(a); adj[b].add(c);
            adj[c].add(a); adj[c].add(b);
        }

        const removed = new Set<number>();
        let   current = geo.vertexCount;

        while (current > target) {
            // Find edge with minimum cost (shortest)
            let   best = Infinity, bestA = -1, bestB = -1;
            for (let i = 0; i < geo.vertexCount; i++) {
                if (removed.has(i)) continue;
                for (const j of adj[i]) {
                    if (removed.has(j) || j <= i) continue;
                    const dx=pos[i*3]-pos[j*3], dy=pos[i*3+1]-pos[j*3+1], dz=pos[i*3+2]-pos[j*3+2];
                    const cost = dx*dx+dy*dy+dz*dz;
                    if (cost < best) { best=cost; bestA=i; bestB=j; }
                }
            }
            if (bestA < 0) break;

            // Collapse bestB into bestA (midpoint)
            pos[bestA*3]  =(pos[bestA*3]  +pos[bestB*3]  )/2;
            pos[bestA*3+1]=(pos[bestA*3+1]+pos[bestB*3+1])/2;
            pos[bestA*3+2]=(pos[bestA*3+2]+pos[bestB*3+2])/2;
            removed.add(bestB);
            for (let i = 0; i < idx.length; i++) if (idx[i] === bestB) idx[i] = bestA;
            current--;
        }

        // Remove degenerate triangles
        const cleanIdx: number[] = [];
        for (let i = 0; i < idx.length; i += 3) {
            const a=idx[i],b=idx[i+1],c=idx[i+2];
            if (a !== b && b !== c && a !== c && !removed.has(a) && !removed.has(b) && !removed.has(c))
                cleanIdx.push(a,b,c);
        }

        return new Mesh(new BufferGeometry().setPositions(pos).setIndices(cleanIdx).computeNormals(), mesh.material);
    },
};

export const MirrorModifier = {
    /**
     * Mirror geometry across a given axis.
     * @param mesh - Source mesh
     * @param axis - 'x' | 'y' | 'z' (default: 'x')
     */
    apply(mesh: Mesh, axis: 'x' | 'y' | 'z' = 'x'): Mesh
    {
        const geo     = mesh.geometry;
        const origPos = Array.from(geo.positions);
        const origNrm = Array.from(geo.normals);
        const origIdx = Array.from(geo.indices);
        const offset  = geo.vertexCount;

        const mirrorPos = origPos.slice();
        const mirrorNrm = origNrm.slice();
        const ax = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        for (let i = ax; i < mirrorPos.length; i += 3) mirrorPos[i] *= -1;
        for (let i = ax; i < mirrorNrm.length; i += 3) mirrorNrm[i] *= -1;

        const mirrorIdx = origIdx.map(i => i + offset);
        // Flip winding for mirror face
        for (let i = 0; i < mirrorIdx.length; i += 3) [mirrorIdx[i], mirrorIdx[i+2]] = [mirrorIdx[i+2], mirrorIdx[i]];

        const newPos = new Float32Array([...origPos, ...mirrorPos]);
        const newNrm = new Float32Array([...origNrm, ...mirrorNrm]);
        const newIdx = new Uint32Array([...origIdx, ...mirrorIdx]);

        return new Mesh(new BufferGeometry().setPositions(newPos).setNormals(newNrm).setIndices(newIdx), mesh.material);
    },
};

export const ArrayModifier = {
    /**
     * Repeat geometry N times along an axis.
     * @param mesh   - Source mesh
     * @param count  - Number of copies (default: 3)
     * @param offset - Offset per copy as Vec3 (default: x+1 per step)
     */
    apply(mesh: Mesh, count = 3, offset = new Vec3(1, 0, 0)): Mesh
    {
        const geo   = mesh.geometry;
        const allPos: number[] = [];
        const allNrm: number[] = [];
        const allIdx: number[] = [];

        for (let c = 0; c < count; c++) {
            const dx = offset.x*c, dy = offset.y*c, dz = offset.z*c;
            const base = allPos.length / 3;
            for (let i = 0; i < geo.positions.length; i += 3) {
                allPos.push(geo.positions[i]+dx, geo.positions[i+1]+dy, geo.positions[i+2]+dz);
            }
            allNrm.push(...geo.normals);
            allIdx.push(...geo.indices.map(i => i + base));
        }

        return new Mesh(new BufferGeometry().setPositions(allPos).setNormals(allNrm).setIndices(allIdx), mesh.material);
    },
};

export const BendModifier = {
    /**
     * Bend geometry along the Y axis.
     * @param mesh  - Source mesh
     * @param angle - Bend angle in radians (default: π/4)
     */
    apply(mesh: Mesh, angle = Math.PI / 4): Mesh
    {
        const geo = mesh.geometry.clone();
        const pos = geo.positions;

        // Find bounding box Y extent
        let minY = Infinity, maxY = -Infinity;
        for (let i = 1; i < pos.length; i += 3) { if (pos[i] < minY) minY = pos[i]; if (pos[i] > maxY) maxY = pos[i]; }
        const span = maxY - minY || 1;

        for (let i = 0; i < pos.length; i += 3) {
            const y   = pos[i+1];
            const t   = (y - minY) / span;
            const a   = t * angle;
            const r   = span / (angle || 0.0001);
            pos[i]   = (r + pos[i]) * Math.sin(a) - r * Math.sin(0);
            pos[i+1] = r - (r + pos[i+2]) * Math.cos(a);
        }

        return new Mesh(geo.computeNormals(), mesh.material);
    },
};

export const TwistModifier = {
    /**
     * Twist geometry around the Y axis.
     * @param mesh  - Source mesh
     * @param angle - Total twist angle in radians (default: π)
     */
    apply(mesh: Mesh, angle = Math.PI): Mesh
    {
        const geo = mesh.geometry.clone();
        const pos = geo.positions;

        let minY = Infinity, maxY = -Infinity;
        for (let i = 1; i < pos.length; i += 3) { if (pos[i] < minY) minY = pos[i]; if (pos[i] > maxY) maxY = pos[i]; }
        const span = maxY - minY || 1;

        for (let i = 0; i < pos.length; i += 3) {
            const y   = pos[i+1];
            const t   = (y - minY) / span;
            const a   = t * angle;
            const x   = pos[i], z = pos[i+2];
            pos[i]   = x * Math.cos(a) - z * Math.sin(a);
            pos[i+2] = x * Math.sin(a) + z * Math.cos(a);
        }

        return new Mesh(geo.computeNormals(), mesh.material);
    },
};

export const BevelModifier = {
    /**
     * Simple vertex bevel — offsets each vertex slightly inward.
     * For production-quality chamfering, use CSG.
     * @param mesh   - Source mesh
     * @param amount - Bevel distance (default: 0.05)
     */
    apply(mesh: Mesh, amount = 0.05): Mesh
    {
        const geo = mesh.geometry.clone();
        const pos = geo.positions;
        const nrm = geo.normals;

        // Offset each vertex along its normal by -amount
        for (let i = 0; i < pos.length; i++) pos[i] -= nrm[i] * amount;

        return new Mesh(geo, mesh.material);
    },
};

// ── STL Import/Export ─────────────────────────────────────────────────────────

export const STLLoader = {
    /**
     * Parse STL (binary or ASCII) into a BufferGeometry.
     * @example
     *   const geo = STLLoader.parse(arrayBuffer);
     */
    parse(buf: ArrayBuffer): BufferGeometry
    {
        const u8  = new Uint8Array(buf);
        const isBinary = !_isAsciiSTL(u8);
        return isBinary ? _parseBinarySTL(buf) : _parseAsciiSTL(new TextDecoder().decode(u8));
    },
};

function _isAsciiSTL(u8: Uint8Array): boolean
{
    const start = Math.min(256, u8.length);
    for (let i = 0; i < start; i++) if (u8[i] > 127) return false;
    const text = new TextDecoder().decode(u8.slice(0, start));
    return text.trimStart().startsWith('solid');
}

function _parseBinarySTL(buf: ArrayBuffer): BufferGeometry
{
    const view  = new DataView(buf);
    const count = view.getUint32(80, true);
    const pos: number[] = [], nrm: number[] = [];
    let   off = 84;
    for (let i = 0; i < count; i++, off += 50) {
        const nx=view.getFloat32(off,true),   ny=view.getFloat32(off+4,true),  nz=view.getFloat32(off+8,true);
        for (let v = 0; v < 3; v++) {
            const o = off + 12 + v * 12;
            pos.push(view.getFloat32(o,true), view.getFloat32(o+4,true), view.getFloat32(o+8,true));
            nrm.push(nx,ny,nz);
        }
    }
    return new BufferGeometry().setPositions(pos).setNormals(nrm);
}

function _parseAsciiSTL(text: string): BufferGeometry
{
    const pos: number[] = [], nrm: number[] = [];
    const lines = text.split('\n');
    let cn = [0,0,0];
    for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('facet normal')) {
            const [,,, nx, ny, nz] = t.split(/\s+/);
            cn = [parseFloat(nx), parseFloat(ny), parseFloat(nz)];
        } else if (t.startsWith('vertex')) {
            const [, x, y, z] = t.split(/\s+/);
            pos.push(parseFloat(x), parseFloat(y), parseFloat(z));
            nrm.push(...cn);
        }
    }
    return new BufferGeometry().setPositions(pos).setNormals(nrm);
}

export const STLExporter = {
    /**
     * Export a mesh to binary STL.
     * @example
     *   const buf = STLExporter.toBinary(mesh);
     *   Docs.download(new DocsDocument('stl', buf), 'model.stl');
     */
    toBinary(mesh: Mesh): ArrayBuffer
    {
        const geo   = mesh.geometry;
        const idx   = geo.indices;
        const pos   = geo.positions;
        const nrm   = geo.normals;
        const count = idx.length > 0 ? idx.length / 3 : pos.length / 9;
        const buf   = new ArrayBuffer(84 + count * 50);
        const view  = new DataView(buf);
        view.setUint32(80, count, true);
        let   off   = 84;

        const writeV = (i: number) => {
            view.setFloat32(off,   pos[i*3],   true);
            view.setFloat32(off+4, pos[i*3+1], true);
            view.setFloat32(off+8, pos[i*3+2], true);
            off += 12;
        };
        const writeFace = (i0: number, i1: number, i2: number) => {
            // Normal
            view.setFloat32(off,    nrm[i0*3]??0, true);
            view.setFloat32(off+4,  nrm[i0*3+1]??0, true);
            view.setFloat32(off+8,  nrm[i0*3+2]??1, true);
            off += 12;
            writeV(i0); writeV(i1); writeV(i2);
            view.setUint16(off, 0, true); off += 2;
        };

        if (idx.length > 0) for (let i = 0; i < idx.length; i += 3) writeFace(idx[i], idx[i+1], idx[i+2]);
        else                 for (let i = 0; i < pos.length/3; i += 3) writeFace(i, i+1, i+2);

        return buf;
    },

    toAscii(mesh: Mesh): string
    {
        const geo = mesh.geometry;
        const idx = geo.indices, pos = geo.positions, nrm = geo.normals;
        const lines = ['solid mesh'];
        const v = (i: number) => `${pos[i*3]} ${pos[i*3+1]} ${pos[i*3+2]}`;
        const n = (i: number) => `${nrm[i*3]??0} ${nrm[i*3+1]??0} ${nrm[i*3+2]??1}`;
        const face = (i0: number, i1: number, i2: number) => `  facet normal ${n(i0)}\n    outer loop\n      vertex ${v(i0)}\n      vertex ${v(i1)}\n      vertex ${v(i2)}\n    endloop\n  endfacet`;
        if (idx.length > 0) for (let i = 0; i < idx.length; i += 3) lines.push(face(idx[i], idx[i+1], idx[i+2]));
        else                 for (let i = 0; i < pos.length/3; i += 3) lines.push(face(i, i+1, i+2));
        lines.push('endsolid mesh');
        return lines.join('\n');
    },
};

// ── OBJ Import/Export ─────────────────────────────────────────────────────────

export const OBJLoader = {
    /**
     * Parse OBJ text into a BufferGeometry.
     */
    parse(text: string): BufferGeometry
    {
        const vp: number[] = [], vn: number[] = [], vt: number[] = [];
        const pos: number[] = [], nrm: number[] = [], uv: number[] = [];

        for (const line of text.split('\n')) {
            const t = line.trim();
            if (t.startsWith('v '))  { const [,x,y,z]=t.split(/\s+/); vp.push(parseFloat(x),parseFloat(y),parseFloat(z)); }
            if (t.startsWith('vn ')) { const [,x,y,z]=t.split(/\s+/); vn.push(parseFloat(x),parseFloat(y),parseFloat(z)); }
            if (t.startsWith('vt ')) { const [,u,v]=t.split(/\s+/); vt.push(parseFloat(u),parseFloat(v)); }
            if (t.startsWith('f ')) {
                const parts = t.split(/\s+/).slice(1);
                // Fan triangulation for polygons
                for (let i = 1; i < parts.length - 1; i++) {
                    for (const pi of [parts[0], parts[i], parts[i+1]]) {
                        const [vi, ti, ni] = pi.split('/').map(s => s ? parseInt(s)-1 : -1);
                        pos.push(vp[vi*3], vp[vi*3+1], vp[vi*3+2]);
                        if (ni >= 0) nrm.push(vn[ni*3], vn[ni*3+1], vn[ni*3+2]);
                        if (ti >= 0) uv.push(vt[ti*2], vt[ti*2+1]);
                    }
                }
            }
        }
        const geo = new BufferGeometry().setPositions(pos);
        if (nrm.length) geo.setNormals(nrm); else geo.computeNormals();
        if (uv.length)  geo.setUVs(uv);
        return geo;
    },
};

export const OBJExporter = {
    export(mesh: Mesh, name = 'mesh'): string
    {
        const geo   = mesh.geometry;
        const pos   = geo.positions, nrm = geo.normals, uvd = geo.uvs, idx = geo.indices;
        const lines = [`# AriannA Three export`, `o ${name}`];

        for (let i = 0; i < pos.length; i += 3) lines.push(`v ${pos[i]} ${pos[i+1]} ${pos[i+2]}`);
        for (let i = 0; i < nrm.length; i += 3) lines.push(`vn ${nrm[i]} ${nrm[i+1]} ${nrm[i+2]}`);
        for (let i = 0; i < uvd.length; i += 2) lines.push(`vt ${uvd[i]} ${uvd[i+1]}`);

        const fi = (i: number) => `${i+1}/${uvd.length>0?i+1:''}/${nrm.length>0?i+1:''}`;
        if (idx.length > 0) for (let i = 0; i < idx.length; i += 3) lines.push(`f ${fi(idx[i])} ${fi(idx[i+1])} ${fi(idx[i+2])}`);
        else                 for (let i = 0; i < pos.length/3; i += 3) lines.push(`f ${fi(i)} ${fi(i+1)} ${fi(i+2)}`);
        return lines.join('\n');
    },
};

// ── glTF / GLB Export (minimal) ───────────────────────────────────────────────

export const GLTFExporter = {
    /**
     * Export a mesh or scene to GLB binary.
     * Outputs a valid glTF 2.0 binary container.
     */
    toGLB(mesh: Mesh): ArrayBuffer
    {
        const geo   = mesh.geometry;
        const pos   = geo.positions;
        const idx   = geo.indices;
        const nrm   = geo.normals;

        const posBytes = pos.buffer.slice(pos.byteOffset, pos.byteOffset + pos.byteLength) as ArrayBuffer;
        const idxU32  = idx.length > 0 ? idx : new Uint32Array(Array.from({length:pos.length/3},(v,i)=>i));
        const idxBytes = idxU32.buffer.slice(idxU32.byteOffset, idxU32.byteOffset + idxU32.byteLength) as ArrayBuffer;
        const nrmBytes = (nrm.length > 0 ? nrm.buffer.slice(nrm.byteOffset, nrm.byteOffset + nrm.byteLength) : new ArrayBuffer(0)) as ArrayBuffer;

        const bufView: unknown[] = [];
        let bOff = 0;
        const addBV = (buf: ArrayBuffer, target?: number) => {
            bufView.push({ buffer: 0, byteOffset: bOff, byteLength: buf.byteLength, ...(target ? { target } : {}) });
            bOff += buf.byteLength + (buf.byteLength % 4 ? 4 - buf.byteLength % 4 : 0);
            return bufView.length - 1;
        };

        const posView = addBV(posBytes, 34962);
        const idxView = addBV(idxBytes as ArrayBuffer, 34963);
        const nrmView = nrmBytes.byteLength > 0 ? addBV(nrmBytes, 34962) : -1;

        const accessors: unknown[] = [
            { bufferView: posView, componentType: 5126, count: geo.vertexCount, type: 'VEC3',
              min: [geo.boundingBox.min.x, geo.boundingBox.min.y, geo.boundingBox.min.z],
              max: [geo.boundingBox.max.x, geo.boundingBox.max.y, geo.boundingBox.max.z] },
            { bufferView: idxView, componentType: 5125, count: idxU32.length, type: 'SCALAR' },
        ];
        if (nrmView >= 0) accessors.push({ bufferView: nrmView, componentType: 5126, count: geo.vertexCount, type: 'VEC3' });

        const prim: Record<string, unknown> = { attributes: { POSITION: 0 }, indices: 1, mode: 4 };
        if (nrmView >= 0) (prim.attributes as Record<string,number>)['NORMAL'] = 2;
        const col = mesh.material.color;

        const json = {
            asset     : { version: '2.0', generator: 'AriannA Three' },
            bufferViews: bufView,
            accessors,
            meshes    : [{ name: 'mesh', primitives: [prim] }],
            nodes     : [{ mesh: 0, name: 'node' }],
            scenes    : [{ nodes: [0] }],
            scene     : 0,
            materials : [{ name: 'mat', pbrMetallicRoughness: { baseColorFactor: col.toArray(), metallicFactor: mesh.material.metalness, roughnessFactor: mesh.material.roughness } }],
            buffers   : [{ byteLength: bOff }],
        };

        const jsonStr  = JSON.stringify(json);
        const jsonBytes = new TextEncoder().encode(jsonStr);
        const jsonPad  = jsonBytes.length % 4 ? 4 - jsonBytes.length % 4 : 0;

        // Combine all binary buffers
        const allBufs: ArrayBuffer[] = [posBytes, idxBytes as ArrayBuffer];
        if (nrmBytes.byteLength > 0) allBufs.push(nrmBytes);
        const binLen = allBufs.reduce((s, b) => s + b.byteLength + (b.byteLength%4?4-b.byteLength%4:0), 0);

        const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + binLen;
        const out   = new ArrayBuffer(total);
        const view  = new DataView(out);
        const u8    = new Uint8Array(out);
        let   off   = 0;

        // GLB header
        view.setUint32(0, 0x46546C67, true); // 'glTF'
        view.setUint32(4, 2, true);           // version
        view.setUint32(8, total, true);       // length
        off = 12;

        // JSON chunk
        view.setUint32(off, jsonBytes.length + jsonPad, true); view.setUint32(off+4, 0x4E4F534A, true); off += 8;
        u8.set(jsonBytes, off); off += jsonBytes.length;
        for (let i = 0; i < jsonPad; i++) u8[off++] = 0x20;

        // BIN chunk
        view.setUint32(off, binLen, true); view.setUint32(off+4, 0x004E4942, true); off += 8;
        for (const b of allBufs) {
            const src = new Uint8Array(b);
            u8.set(src, off); off += src.length;
            const pad = src.length%4 ? 4-src.length%4 : 0;
            for (let i=0;i<pad;i++) u8[off++] = 0;
        }

        return out;
    },
};

// ── OrbitControls ─────────────────────────────────────────────────────────────

export class OrbitControls
{
    camera       : Camera;
    canvas       : HTMLCanvasElement;
    target       = new Vec3();
    minDistance  = 0.5;
    maxDistance  = 100;
    minPolarAngle = 0;
    maxPolarAngle = Math.PI;
    enableDamping = true;
    dampingFactor = 0.05;
    enableZoom    = true;
    enableRotate  = true;
    enablePan     = true;

    #spherical   = { r: 5, theta: 0, phi: Math.PI / 4 };
    #isDragging  = false;
    #isPanning   = false;
    #lastX       = 0;
    #lastY       = 0;
    #dTheta      = 0;
    #dPhi        = 0;
    #dispose     : (() => void)[] = [];

    constructor(camera: Camera, canvas: HTMLCanvasElement)
    {
        this.camera = camera;
        this.canvas = canvas;
        this.#init();
        this.#updateCamera();
    }

    #init(): void
    {
        const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
            this.canvas.addEventListener(type, fn as EventListener);
            this.#dispose.push(() => this.canvas.removeEventListener(type, fn as EventListener));
        };
        const onW = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) => {
            window.addEventListener(type, fn as EventListener);
            this.#dispose.push(() => window.removeEventListener(type, fn as EventListener));
        };

        on('mousedown', e => {
            if (e.button === 0) { this.#isDragging = true; this.#isPanning = false; }
            if (e.button === 2) { this.#isPanning  = true; this.#isDragging = false; }
            this.#lastX = e.clientX; this.#lastY = e.clientY;
        });
        onW('mouseup', () => { this.#isDragging = false; this.#isPanning = false; });
        onW('mousemove', e => {
            const dx = e.clientX - this.#lastX, dy = e.clientY - this.#lastY;
            this.#lastX = e.clientX; this.#lastY = e.clientY;
            if (this.#isDragging && this.enableRotate) { this.#dTheta -= dx * 0.01; this.#dPhi -= dy * 0.01; }
            if (this.#isPanning  && this.enablePan)    { this.target.x -= dx*0.005; this.target.y += dy*0.005; }
        });
        on('wheel', e => {
            if (!this.enableZoom) return;
            this.#spherical.r = Math.min(this.maxDistance, Math.max(this.minDistance, this.#spherical.r + e.deltaY * 0.01));
            this.#updateCamera();
        });
        on('contextmenu', e => e.preventDefault());

        // Touch support
        let touches: Touch[] = [];
        on('touchstart', e => { touches = Array.from(e.touches); });
        on('touchmove', e => {
            if (e.touches.length === 1 && this.enableRotate) {
                const dx = e.touches[0].clientX - touches[0].clientX;
                const dy = e.touches[0].clientY - touches[0].clientY;
                this.#dTheta -= dx * 0.01; this.#dPhi -= dy * 0.01;
                touches = Array.from(e.touches);
            }
            if (e.touches.length === 2 && this.enableZoom) {
                const d0 = Math.hypot(touches[0].clientX-touches[1].clientX, touches[0].clientY-touches[1].clientY);
                const d1 = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
                this.#spherical.r = Math.min(this.maxDistance, Math.max(this.minDistance, this.#spherical.r * (d0/d1)));
                touches = Array.from(e.touches);
            }
        });
    }

    update(): void
    {
        if (this.enableDamping) {
            this.#spherical.theta += this.#dTheta;
            this.#spherical.phi   += this.#dPhi;
            this.#dTheta *= 1 - this.dampingFactor;
            this.#dPhi   *= 1 - this.dampingFactor;
        } else {
            this.#spherical.theta += this.#dTheta; this.#dTheta = 0;
            this.#spherical.phi   += this.#dPhi;   this.#dPhi   = 0;
        }
        this.#spherical.phi = Math.max(this.minPolarAngle + 0.01, Math.min(this.maxPolarAngle - 0.01, this.#spherical.phi));
        this.#updateCamera();
    }

    #updateCamera(): void
    {
        const { r, theta, phi } = this.#spherical;
        const sp = Math.sin(phi), cp = Math.cos(phi);
        const st = Math.sin(theta), ct = Math.cos(theta);
        this.camera.position.set(
            this.target.x + r * sp * st,
            this.target.y + r * cp,
            this.target.z + r * sp * ct,
        );
        this.camera.lookAt(this.target);
    }

    dispose(): void { this.#dispose.forEach(fn => fn()); }
}

// ── AnimationLoop ─────────────────────────────────────────────────────────────

export class AnimationLoop
{
    #rafId   : number = 0;
    #running = false;
    #time    = 0;
    #last    = 0;
    onFrame  : (time: number, dt: number) => void;

    constructor(fn: (time: number, dt: number) => void) { this.onFrame = fn; }

    start(): this
    {
        if (this.#running) return this;
        this.#running = true;
        this.#last    = performance.now();
        const loop = (now: number) => {
            if (!this.#running) return;
            const dt = (now - this.#last) / 1000;
            this.#last = now;
            this.#time += dt;
            this.onFrame(this.#time, dt);
            this.#rafId = requestAnimationFrame(loop);
        };
        this.#rafId = requestAnimationFrame(loop);
        return this;
    }

    stop(): this
    {
        this.#running = false;
        cancelAnimationFrame(this.#rafId);
        return this;
    }

    get running(): boolean { return this.#running; }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const Three = {
    // Scene graph
    Scene, Group, Mesh, Object3D,

    // Cameras
    PerspectiveCamera, OrthographicCamera,

    // Geometries
    BufferGeometry,
    BoxGeometry, SphereGeometry, CylinderGeometry,
    PlaneGeometry, ConeGeometry, TorusGeometry,

    // Materials
    Material,
    MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial,
    MeshPBRMaterial, WireframeMaterial, LineMaterial,

    // Lights
    AmbientLight, DirectionalLight, PointLight, SpotLight,

    // Math
    Vec2, Vec3, Vec4, Mat4, Quaternion, Color, Box3,

    // Renderer
    createRenderer,
    WebGPURenderer,
    WebGL2Renderer,

    // Controls
    OrbitControls,
    AnimationLoop,

    // CSG
    CSG,

    // Modifiers
    SubdivisionModifier,
    DecimateModifier,
    MirrorModifier,
    ArrayModifier,
    BendModifier,
    TwistModifier,
    BevelModifier,

    // Import/Export
    STLLoader, STLExporter,
    OBJLoader, OBJExporter,
    GLTFExporter,
};

// ── Global registration ───────────────────────────────────────────────────────

if (typeof window !== 'undefined')
    Object.defineProperty(window, 'Three', {
        value       : Three,
        writable    : false,
        enumerable  : false,
        configurable: false,
    });

export default Three;
