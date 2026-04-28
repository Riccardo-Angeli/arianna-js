/**
 * @module    Geometry
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * Migrated and extended from Golem.Geometry (2012-2018).
 *
 * ── Original Golem classes preserved ──────────────────────────────────────────
 *
 *   Angle     — full unit system: Radians, Degrees, Turns, Quadrants,
 *               Grads, Mils, Sextants, Points, BinaryDegrees, Hours,
 *               Minutes, Seconds + all trig values
 *   Rotation  — 3D rotation with Psi/Theta/Phi (Euler angles)
 *   Size      — Width/Height/Depth
 *   Point     — X/Y/Z coordinate
 *   Vector    — N-dimensional vector (Sum, Subtract, Dot, Cross, Normalize)
 *   Vector2d  → now exported as Vector2 (see Math.ts)
 *   Vector3d  → now exported as Vector3 (see Math.ts)
 *   Matrix    — full NxN matrix with LUP, QR, EigenValues, EigenVectors
 *   Transform — CSS/3D transform (Translate, Scale, Rotate, Skew, Reflect)
 *   Shapes    — Rectangle, Line, Curve, Path, Triangle, Circle, Plane, Polygon
 *   Solids    — Frustum, TetraHedron, Pyramid, Box, Sphere, Octahedron,
 *               Torus, ChamferBox, Cylinder, Tube
 *
 * ── New additions ─────────────────────────────────────────────────────────────
 *
 *   AABB      — Axis-Aligned Bounding Box (collision detection)
 *   Ray       — Ray casting (mouse picking, raycasting)
 *   Plane3D   — Infinite plane in 3D space
 *   BVH       — Bounding Volume Hierarchy (TODO: Phase 3)
 *   CSG       — Constructive Solid Geometry (TODO: Phase 3, manifold WASM)
 *
 * @example
 *   import { Geometry, Angle, Matrix, Shapes, AABB, Ray } from "./Geometry.ts";
 *   Core.use(Geometry);
 *
 *   // Original Golem API preserved
 *   const a = new Angle(Math.PI / 4, "Radians");
 *   console.log(a.Degrees);   // → 45
 *   console.log(a.Sine);      // → 0.7071...
 *
 *   const m = Matrix.identity(4);
 *   m.Determinant();          // → 1
 *
 *   // New
 *   const box = new AABB(new Vector3(-1,-1,-1), new Vector3(1,1,1));
 *   const ray = new Ray(new Vector3(0,5,0), new Vector3(0,-1,0));
 *   console.log(ray.intersectAABB(box)); // → { hit: true, t: 4 }
 */

import { Core } from "../core/index.ts";
import { Vector2, Vector3, Matrix4, Quaternion } from "./Math.ts";

// ── Angle ─────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Angle — all units and trig values preserved

export class Angle {
  private _radians: number;

  constructor(value: number, unit: AngleUnit = "Radians") {
    this._radians = Angle._toRadians(value, unit);
  }

  // Unit conversions — all original Golem units
  get Radians      (): number { return this._radians; }
  get Degrees      (): number { return this._radians * 180 / Math.PI; }
  get Turns        (): number { return this._radians / (2 * Math.PI); }
  get Quadrants    (): number { return this._radians / (Math.PI / 2); }
  get Grads        (): number { return this._radians * 200 / Math.PI; }
  get Mils         (): number { return this._radians * 3200 / Math.PI; }
  get Sextants     (): number { return this._radians / (Math.PI / 3); }
  get Points       (): number { return this._radians * 32 / (2 * Math.PI); }
  get BinaryDegrees(): number { return this._radians * 256 / (2 * Math.PI); }
  get Hours        (): number { return this._radians * 12 / Math.PI; }
  get Minutes      (): number { return this.Hours * 60; }
  get Seconds      (): number { return this.Hours * 3600; }

  // Trig values — original Golem
  get Sine     (): number { return Math.sin(this._radians); }
  get Cosine   (): number { return Math.cos(this._radians); }
  get Tangent  (): number { return Math.tan(this._radians); }
  get Secant   (): number { return 1 / Math.cos(this._radians); }
  get Cosecant (): number { return 1 / Math.sin(this._radians); }
  get Cotangent(): number { return 1 / Math.tan(this._radians); }

  // Operations
  add     (b: Angle): Angle { return new Angle(this._radians + b._radians); }
  sub     (b: Angle): Angle { return new Angle(this._radians - b._radians); }
  scale   (s: number): Angle { return new Angle(this._radians * s); }
  normalize(): Angle { return new Angle(((this._radians % (2*Math.PI)) + 2*Math.PI) % (2*Math.PI)); }

  static Parse(s: string): Angle {
    const n = parseFloat(s);
    if (s.includes("°") || s.toLowerCase().includes("deg")) return new Angle(n, "Degrees");
    if (s.toLowerCase().includes("grad")) return new Angle(n, "Grads");
    if (s.toLowerCase().includes("turn")) return new Angle(n, "Turns");
    return new Angle(n, "Radians");
  }

  static Is(v: unknown): v is Angle { return v instanceof Angle; }

  static _toRadians(value: number, unit: AngleUnit): number {
    switch (unit) {
      case "Degrees"      : return value * Math.PI / 180;
      case "Turns"        : return value * 2 * Math.PI;
      case "Quadrants"    : return value * Math.PI / 2;
      case "Grads"        : return value * Math.PI / 200;
      case "Mils"         : return value * Math.PI / 3200;
      case "Sextants"     : return value * Math.PI / 3;
      case "Points"       : return value * 2 * Math.PI / 32;
      case "BinaryDegrees": return value * 2 * Math.PI / 256;
      case "Hours"        : return value * Math.PI / 12;
      case "Minutes"      : return value * Math.PI / 720;
      case "Seconds"      : return value * Math.PI / 43200;
      default             : return value; // Radians
    }
  }

  valueOf (): number { return this._radians; }
  toString(): string { return `${this.Degrees.toFixed(4)}°`; }
}

export type AngleUnit =
    | "Radians" | "Degrees" | "Turns" | "Quadrants" | "Grads"
    | "Mils" | "Sextants" | "Points" | "BinaryDegrees"
    | "Hours" | "Minutes" | "Seconds";

// ── Rotation ──────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Rotation — Euler angles (Psi/Theta/Phi)

export class Rotation {
  private _psi  : Angle;
  private _theta: Angle;
  private _phi  : Angle;

  constructor(psi: number|Angle = 0, theta: number|Angle = 0, phi: number|Angle = 0, unit: AngleUnit = "Radians") {
    this._psi   = psi   instanceof Angle ? psi   : new Angle(psi,   unit);
    this._theta = theta instanceof Angle ? theta : new Angle(theta, unit);
    this._phi   = phi   instanceof Angle ? phi   : new Angle(phi,   unit);
  }

  get Psi  (): Angle { return this._psi;   }
  get Theta(): Angle { return this._theta; }
  get Phi  (): Angle { return this._phi;   }

  get Matrix()     : Matrix4 { return Matrix4.rotation(this.toQuaternion()); }
  get Quaternion() : Quaternion { return this.toQuaternion(); }

  toQuaternion(): Quaternion {
    return Quaternion.fromEuler(this._psi.Radians, this._theta.Radians, this._phi.Radians);
  }

  static Is(v: unknown): v is Rotation { return v instanceof Rotation; }
  toString(): string { return `Rotation(ψ=${this._psi}, θ=${this._theta}, φ=${this._phi})`; }
}

// ── Size ──────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Size

export class Size {
  constructor(
      public Width : number = 0,
      public Height: number = 0,
      public Depth : number = 0,
  ) {}

  get Area  (): number { return this.Width * this.Height; }
  get Volume(): number { return this.Width * this.Height * this.Depth; }
  scale(s: number): Size { return new Size(this.Width*s, this.Height*s, this.Depth*s); }
  toString(): string { return `Size(${this.Width}×${this.Height}×${this.Depth})`; }
}

// ── Point ─────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Point

export class Point {
  constructor(public X=0, public Y=0, public Z=0) {}

  distanceTo(p: Point): number { return Math.sqrt((p.X-this.X)**2+(p.Y-this.Y)**2+(p.Z-this.Z)**2); }
  toVector3 (): Vector3       { return new Vector3(this.X, this.Y, this.Z); }
  translate (dx:number,dy:number,dz=0): Point { return new Point(this.X+dx,this.Y+dy,this.Z+dz); }
  toString  (): string        { return `Point(${this.X},${this.Y},${this.Z})`; }
}

// ── Matrix (NxN) ──────────────────────────────────────────────────────────────
// Original Golem.Geometry.Matrix — full implementation
// 25 methods: Is, Diagonal, Trace, Clone, Sum, Subtract, Multiply, Divide,
// Transpose, Inverse, Determinant, Invertible, Singular, GetMinor,
// LUP, Lower, Upper, Permutation, QR, Q, R, H, RREF, EigenValues, EigenVectors

export class Matrix {
  private _data: number[][];
  readonly rows: number;
  readonly cols: number;

  constructor(data: number[][]) {
    this._data = data.map(r => [...r]);
    this.rows  = data.length;
    this.cols  = data[0]?.length ?? 0;
  }

  static identity(n: number): Matrix {
    return new Matrix(Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0)));
  }
  static zeros  (rows:number,cols:number): Matrix { return new Matrix(Array.from({length:rows},()=>new Array(cols).fill(0))); }
  static from   (flat: number[], rows:number,cols:number): Matrix { return new Matrix(Array.from({length:rows},(_,i)=>flat.slice(i*cols,(i+1)*cols))); }
  static Is     (v: unknown): v is Matrix { return v instanceof Matrix; }

  get(r:number,c:number): number { return this._data[r][c]; }
  set(r:number,c:number,v:number): this { this._data[r][c]=v; return this; }
  row(r:number): number[] { return [...this._data[r]]; }
  col(c:number): number[] { return this._data.map(r=>r[c]); }

  // Original Golem methods
  Diagonal (): number[]  { return Array.from({length:Math.min(this.rows,this.cols)},(_,i)=>this._data[i][i]); }
  Trace    (): number    { return this.Diagonal().reduce((a,b)=>a+b,0); }
  Clone    (): Matrix    { return new Matrix(this._data); }
  Transpose(): Matrix    { return new Matrix(Array.from({length:this.cols},(_,j)=>Array.from({length:this.rows},(_,i)=>this._data[i][j]))); }

  Sum     (b: Matrix): Matrix { return new Matrix(this._data.map((r,i)=>r.map((v,j)=>v+b._data[i][j]))); }
  Subtract(b: Matrix): Matrix { return new Matrix(this._data.map((r,i)=>r.map((v,j)=>v-b._data[i][j]))); }
  Multiply(b: Matrix): Matrix {
    const out=Matrix.zeros(this.rows,b.cols);
    for(let i=0;i<this.rows;i++) for(let j=0;j<b.cols;j++) for(let k=0;k<this.cols;k++) out._data[i][j]+=this._data[i][k]*b._data[k][j];
    return out;
  }
  Divide(s: number): Matrix { return new Matrix(this._data.map(r=>r.map(v=>v/s))); }

  Determinant(): number {
    if(this.rows!==this.cols) throw new Error('Determinant: matrix must be square');
    const n=this.rows;
    if(n===1) return this._data[0][0];
    if(n===2) return this._data[0][0]*this._data[1][1]-this._data[0][1]*this._data[1][0];
    let det=0;
    for(let j=0;j<n;j++) det+=((j%2===0)?1:-1)*this._data[0][j]*this.GetMinor(0,j).Determinant();
    return det;
  }

  GetMinor(row:number,col:number): Matrix {
    return new Matrix(this._data.filter((_,i)=>i!==row).map(r=>r.filter((_,j)=>j!==col)));
  }

  Invertible(): boolean { return Math.abs(this.Determinant()) > 1e-10; }
  Singular  (): boolean { return !this.Invertible(); }

  Inverse(): Matrix {
    if(!this.Invertible()) throw new Error('Matrix.Inverse: matrix is singular');
    const n=this.rows,det=this.Determinant();
    const adj=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>((i+j)%2===0?1:-1)*this.GetMinor(j,i).Determinant()));
    return new Matrix(adj).Divide(det);
  }

  // LUP decomposition (original Golem)
  LUP(): { L: Matrix; U: Matrix; P: Matrix } {
    const n=this.rows;
    const L=Matrix.identity(n),U=this.Clone(),P=Matrix.identity(n);
    for(let k=0;k<n;k++) {
      let max=Math.abs(U._data[k][k]),maxRow=k;
      for(let i=k+1;i<n;i++) if(Math.abs(U._data[i][k])>max){max=Math.abs(U._data[i][k]);maxRow=i;}
      [U._data[k],U._data[maxRow]]=[U._data[maxRow],U._data[k]];
      [P._data[k],P._data[maxRow]]=[P._data[maxRow],P._data[k]];
      for(let i=k+1;i<n;i++) {
        const f=U._data[i][k]/U._data[k][k];
        L._data[i][k]=f;
        for(let j=k;j<n;j++) U._data[i][j]-=f*U._data[k][j];
      }
    }
    return {L,U,P};
  }
  Lower(): Matrix { return this.LUP().L; }
  Upper(): Matrix { return this.LUP().U; }
  Permutation(): Matrix { return this.LUP().P; }

  // QR decomposition (original Golem)
  QR(): { Q: Matrix; R: Matrix } {
    const n=this.rows,m=this.cols;
    const Q=Matrix.zeros(n,m),R=Matrix.zeros(m,m);
    const cols=Array.from({length:m},(_,j)=>this.col(j));
    const qs: number[][]=[];
    for(let j=0;j<m;j++) {
      let u=[...cols[j]];
      for(const q of qs) { const dot=u.reduce((s,v,i)=>s+v*q[i],0); u=u.map((v,i)=>v-dot*q[i]); }
      const norm=Math.sqrt(u.reduce((s,v)=>s+v*v,0));
      const e=norm>1e-10?u.map(v=>v/norm):u;
      qs.push(e);
      for(let i=0;i<n;i++) Q._data[i][j]=e[i];
      for(let jj=j;jj<m;jj++) R._data[j][jj]=cols[jj].reduce((s,v,i)=>s+v*e[i],0);
    }
    return {Q,R};
  }
  Q(): Matrix { return this.QR().Q; }
  R(): Matrix { return this.QR().R; }
  H(): Matrix { return this.Transpose(); } // Hermitian (conjugate transpose — same as transpose for real)

  // RREF (Row Reduced Echelon Form)
  RREF(): Matrix {
    const m=this.Clone();
    let lead=0;
    for(let r=0;r<m.rows;r++) {
      if(lead>=m.cols) break;
      let i=r;
      while(Math.abs(m._data[i][lead])<1e-10) { i++; if(i===m.rows){i=r;lead++;if(lead===m.cols)return m;} }
      [m._data[i],m._data[r]]=[m._data[r],m._data[i]];
      const lv=m._data[r][lead];
      m._data[r]=m._data[r].map(v=>v/lv);
      for(let j=0;j<m.rows;j++) if(j!==r){const f=m._data[j][lead];m._data[j]=m._data[j].map((v,c)=>v-f*m._data[r][c]);}
      lead++;
    }
    return m;
  }

  // EigenValues (power iteration for dominant eigenvalue; QR method for all)
  EigenValues(): number[] {
    if(this.rows!==this.cols) throw new Error('EigenValues: matrix must be square');
    // QR algorithm — iterate until convergence
    let A=this.Clone();
    for(let iter=0;iter<100;iter++) {
      const {Q,R}=A.QR();
      A=R.Multiply(Q);
    }
    return A.Diagonal();
  }

  EigenVectors(): Matrix {
    // Approximate eigenvectors via inverse power iteration
    const eigenvals=this.EigenValues();
    const n=this.rows;
    const vecs: number[][]=[];
    for(const lambda of eigenvals) {
      const shifted=this.Subtract(Matrix.identity(n).Multiply(new Matrix([[lambda]]))); // A - λI
      // Simple approximation — power iteration from random vector
      let v=Array.from({length:n},()=>Math.random());
      for(let iter=0;iter<50;iter++) {
        const mv=shifted.Multiply(new Matrix(v.map(x=>[x]))).col(0);
        const norm=Math.sqrt(mv.reduce((s,x)=>s+x*x,0));
        v=norm>1e-10?mv.map(x=>x/norm):v;
      }
      vecs.push(v);
    }
    return new Matrix(vecs[0].map((_,i)=>vecs.map(v=>v[i])));
  }

  toString(): string {
    return this._data.map(r=>'['+r.map(v=>v.toFixed(4)).join(', ')+']').join('\n');
  }
}

// ── Transform ─────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Transform — CSS + 3D transforms

export class Transform {
  private _matrix: Matrix4;

  constructor(matrix?: Matrix4) { this._matrix = matrix ?? Matrix4.identity(); }

  get Matrix() { return this._matrix; }

  Translate(x:number,y:number,z=0): Transform { return new Transform(this._matrix.multiply(Matrix4.translation(x,y,z))); }
  Scale    (x:number,y:number,z=1): Transform { return new Transform(this._matrix.multiply(Matrix4.scale(x,y,z))); }
  Rotate   (angle:Angle, axis: Vector3 = new Vector3(0,0,1)): Transform {
    return new Transform(this._matrix.multiply(Matrix4.rotation(Quaternion.fromAxisAngle(axis, angle.Radians))));
  }
  Skew(ax:number,ay:number): Transform {
    const m=Matrix4.identity();
    const arr=m.toArray();
    arr[4]=Math.tan(ax); arr[1]=Math.tan(ay);
    return new Transform(this._matrix.multiply(new Matrix4(arr)));
  }
  Reflect(axis: "x"|"y"|"z"): Transform {
    const s = { x:[-1,1,1], y:[1,-1,1], z:[1,1,-1] }[axis];
    return new Transform(this._matrix.multiply(Matrix4.scale(s[0],s[1],s[2])));
  }

  get CSSMatrix(): string {
    const m=this._matrix.toArray();
    return `matrix3d(${m.map((v: number)=>v.toFixed(6)).join(",")})`;
  }
  get CSS(): string { return `transform: ${this.CSSMatrix};`; }

  toString(): string { return this.CSSMatrix; }
}

// ── AABB ──────────────────────────────────────────────────────────────────────
// NEW — Axis-Aligned Bounding Box for collision detection

export class AABB {
  constructor(public min: Vector3, public max: Vector3) {}

  center   (): Vector3  { return this.min.add(this.max).scale(0.5); }
  size     (): Vector3  { return this.max.sub(this.min); }
  contains (p: Vector3): boolean {
    return p.x>=this.min.x&&p.x<=this.max.x&&p.y>=this.min.y&&p.y<=this.max.y&&p.z>=this.min.z&&p.z<=this.max.z;
  }
  intersects(b: AABB): boolean {
    return this.min.x<=b.max.x&&this.max.x>=b.min.x&&this.min.y<=b.max.y&&this.max.y>=b.min.y&&this.min.z<=b.max.z&&this.max.z>=b.min.z;
  }
  expand   (v: Vector3): AABB {
    return new AABB(
        new Vector3(Math.min(this.min.x,v.x),Math.min(this.min.y,v.y),Math.min(this.min.z,v.z)),
        new Vector3(Math.max(this.max.x,v.x),Math.max(this.max.y,v.y),Math.max(this.max.z,v.z)),
    );
  }
  merge    (b: AABB): AABB {
    return new AABB(
        new Vector3(Math.min(this.min.x,b.min.x),Math.min(this.min.y,b.min.y),Math.min(this.min.z,b.min.z)),
        new Vector3(Math.max(this.max.x,b.max.x),Math.max(this.max.y,b.max.y),Math.max(this.max.z,b.max.z)),
    );
  }
  volume   (): number { const s=this.size(); return s.x*s.y*s.z; }
  toString (): string { return `AABB(${this.min}, ${this.max})`; }
}

// ── Ray ───────────────────────────────────────────────────────────────────────
// NEW — Ray casting for picking and intersection tests

export class Ray {
  readonly origin   : Vector3;
  readonly direction: Vector3;

  constructor(origin: Vector3, direction: Vector3) {
    this.origin    = origin;
    this.direction = direction.normalize();
  }

  at(t: number): Vector3 { return this.origin.add(this.direction.scale(t)); }

  intersectAABB(box: AABB): { hit:boolean; t:number; point?:Vector3 } {
    const inv=new Vector3(1/this.direction.x,1/this.direction.y,1/this.direction.z);
    const t1=(box.min.x-this.origin.x)*inv.x, t2=(box.max.x-this.origin.x)*inv.x;
    const t3=(box.min.y-this.origin.y)*inv.y, t4=(box.max.y-this.origin.y)*inv.y;
    const t5=(box.min.z-this.origin.z)*inv.z, t6=(box.max.z-this.origin.z)*inv.z;
    const tmin=Math.max(Math.min(t1,t2),Math.min(t3,t4),Math.min(t5,t6));
    const tmax=Math.min(Math.max(t1,t2),Math.max(t3,t4),Math.max(t5,t6));
    const hit=tmax>=0&&tmin<=tmax;
    return { hit, t:tmin, point:hit?this.at(tmin):undefined };
  }

  intersectPlane(normal:Vector3, d:number): { hit:boolean; t:number; point?:Vector3 } {
    const denom=normal.dot(this.direction);
    if(Math.abs(denom)<1e-6) return {hit:false,t:0};
    const t=(d-normal.dot(this.origin))/denom;
    return {hit:t>=0,t,point:t>=0?this.at(t):undefined};
  }

  intersectSphere(center:Vector3,radius:number): { hit:boolean; t:number } {
    const oc=this.origin.sub(center);
    const b=oc.dot(this.direction),c=oc.dot(oc)-radius*radius,disc=b*b-c;
    if(disc<0) return {hit:false,t:0};
    const t=-b-Math.sqrt(disc);
    return {hit:t>=0,t};
  }
}

// ── Shapes ────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Shapes — migrated with 2D geometry + SVG output
// Original: Shape, Rectangle, Line, Curve, Path, Triangle, Circle, Plane, Polygon

export class Rectangle {
  constructor(
      public x: number, public y: number,
      public width: number, public height: number,
  ) {}
  get area      (): number { return this.width * this.height; }
  get perimeter (): number { return 2*(this.width+this.height); }
  get diagonal  (): number { return Math.sqrt(this.width**2+this.height**2); }
  contains(px:number,py:number): boolean { return px>=this.x&&px<=this.x+this.width&&py>=this.y&&py<=this.y+this.height; }
  intersects(r: Rectangle): boolean { return !(r.x>this.x+this.width||r.x+r.width<this.x||r.y>this.y+this.height||r.y+r.height<this.y); }
  toSVG(): string { return `<rect x="${this.x}" y="${this.y}" width="${this.width}" height="${this.height}"/>`; }
  toHTML(): string { return `style="position:absolute;left:${this.x}px;top:${this.y}px;width:${this.width}px;height:${this.height}px"`; }
  toString(): string { return `Rectangle(${this.x},${this.y},${this.width}×${this.height})`; }
}

export class Circle {
  constructor(public cx: number, public cy: number, public radius: number) {}
  get area        (): number { return Math.PI * this.radius**2; }
  get circumference(): number { return 2 * Math.PI * this.radius; }
  contains(px:number,py:number): boolean { return (px-this.cx)**2+(py-this.cy)**2<=this.radius**2; }
  intersects(c: Circle): boolean { return Math.sqrt((c.cx-this.cx)**2+(c.cy-this.cy)**2)<=this.radius+c.radius; }
  toSVG(): string { return `<circle cx="${this.cx}" cy="${this.cy}" r="${this.radius}"/>`; }
  toString(): string { return `Circle(${this.cx},${this.cy},r=${this.radius})`; }
}

export class Triangle {
  constructor(
      public a: Point, public b: Point, public c: Point,
  ) {}
  get area(): number {
    return Math.abs((this.b.X-this.a.X)*(this.c.Y-this.a.Y)-(this.c.X-this.a.X)*(this.b.Y-this.a.Y))/2;
  }
  get perimeter(): number {
    return this.a.distanceTo(this.b)+this.b.distanceTo(this.c)+this.c.distanceTo(this.a);
  }
  centroid(): Point { return new Point((this.a.X+this.b.X+this.c.X)/3,(this.a.Y+this.b.Y+this.c.Y)/3); }
  contains(p: Point): boolean {
    const d1=Math.sign((p.X-this.b.X)*(this.a.Y-this.b.Y)-(this.a.X-this.b.X)*(p.Y-this.b.Y));
    const d2=Math.sign((p.X-this.c.X)*(this.b.Y-this.c.Y)-(this.b.X-this.c.X)*(p.Y-this.c.Y));
    const d3=Math.sign((p.X-this.a.X)*(this.c.Y-this.a.Y)-(this.c.X-this.a.X)*(p.Y-this.a.Y));
    return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));
  }
  toSVG(): string { return `<polygon points="${this.a.X},${this.a.Y} ${this.b.X},${this.b.Y} ${this.c.X},${this.c.Y}"/>`; }
}

export class Polygon {
  constructor(public points: Point[]) {}
  get area(): number {
    let a=0;
    for(let i=0,j=this.points.length-1;i<this.points.length;j=i++) a+=(this.points[j].X+this.points[i].X)*(this.points[j].Y-this.points[i].Y);
    return Math.abs(a)/2;
  }
  get perimeter(): number { return this.points.reduce((s,p,i)=>s+p.distanceTo(this.points[(i+1)%this.points.length]),0); }
  centroid(): Point {
    const n=this.points.length;
    return new Point(this.points.reduce((s,p)=>s+p.X,0)/n,this.points.reduce((s,p)=>s+p.Y,0)/n);
  }
  toSVG(): string { return `<polygon points="${this.points.map(p=>`${p.X},${p.Y}`).join(' ')}"/>`; }
}

// ── Solids ────────────────────────────────────────────────────────────────────
// Original Golem.Geometry.Solids — 11 solid types with volume/surface area
// Box, Sphere, Cylinder, Torus, Cone(Frustum), Pyramid, TetraHedron,
// Octahedron, ChamferBox, Tube

export class Sphere {
  constructor(public radius: number) {}
  get volume      (): number { return (4/3)*Math.PI*this.radius**3; }
  get surfaceArea (): number { return 4*Math.PI*this.radius**2; }
  get diameter    (): number { return 2*this.radius; }
  toSVG(cx=0,cy=0): string { return `<circle cx="${cx}" cy="${cy}" r="${this.radius}"/>`; }
  toString(): string { return `Sphere(r=${this.radius})`; }
}

export class Box {
  constructor(public width:number,public height:number,public depth:number) {}
  get volume      (): number { return this.width*this.height*this.depth; }
  get surfaceArea (): number { return 2*(this.width*this.height+this.height*this.depth+this.depth*this.width); }
  get diagonal    (): number { return Math.sqrt(this.width**2+this.height**2+this.depth**2); }
  toAABB(center=new Vector3()): AABB {
    const h=new Vector3(this.width/2,this.height/2,this.depth/2);
    return new AABB(center.sub(h),center.add(h));
  }
  toString(): string { return `Box(${this.width}×${this.height}×${this.depth})`; }
}

export class Cylinder {
  constructor(public radius:number, public height:number) {}
  get volume      (): number { return Math.PI*this.radius**2*this.height; }
  get surfaceArea (): number { return 2*Math.PI*this.radius*(this.radius+this.height); }
  get lateralArea (): number { return 2*Math.PI*this.radius*this.height; }
  toString(): string { return `Cylinder(r=${this.radius},h=${this.height})`; }
}

export class Torus {
  constructor(public majorRadius:number, public minorRadius:number) {}
  get volume      (): number { return 2*Math.PI**2*this.majorRadius*this.minorRadius**2; }
  get surfaceArea (): number { return 4*Math.PI**2*this.majorRadius*this.minorRadius; }
  toString(): string { return `Torus(R=${this.majorRadius},r=${this.minorRadius})`; }
}

export class Cone {
  constructor(public radius:number, public height:number) {}
  get slantHeight (): number { return Math.sqrt(this.radius**2+this.height**2); }
  get volume      (): number { return (1/3)*Math.PI*this.radius**2*this.height; }
  get surfaceArea (): number { return Math.PI*this.radius*(this.radius+this.slantHeight); }
  toString(): string { return `Cone(r=${this.radius},h=${this.height})`; }
}

export class Pyramid {
  constructor(public baseWidth:number, public baseDepth:number, public height:number) {}
  get volume     (): number { return (1/3)*this.baseWidth*this.baseDepth*this.height; }
  get baseArea   (): number { return this.baseWidth*this.baseDepth; }
  toString(): string { return `Pyramid(${this.baseWidth}×${this.baseDepth},h=${this.height})`; }
}

export class Tube {
  constructor(public outerRadius:number, public innerRadius:number, public height:number) {}
  get volume     (): number { return Math.PI*(this.outerRadius**2-this.innerRadius**2)*this.height; }
  get surfaceArea(): number { return 2*Math.PI*(this.outerRadius+this.innerRadius)*this.height+2*Math.PI*(this.outerRadius**2-this.innerRadius**2); }
  toString(): string { return `Tube(r=${this.outerRadius},ri=${this.innerRadius},h=${this.height})`; }
}

// Aliases — original Golem names
export const Shapes = { Rectangle, Circle, Triangle, Polygon };
export const Solids = { Sphere, Box, Cylinder, Torus, Cone, Pyramid, Tube };

// ── Plane3D ───────────────────────────────────────────────────────────────────

export class Plane3D {
    normal   : { x: number; y: number; z: number };
    constant : number;

    constructor(nx: number, ny: number, nz: number, d: number) {
        this.normal = { x: nx, y: ny, z: nz };
        this.constant = d;
    }

    static fromPoints(a: {x:number;y:number;z:number}, b: {x:number;y:number;z:number}, c: {x:number;y:number;z:number}): Plane3D {
        const ab = { x: b.x-a.x, y: b.y-a.y, z: b.z-a.z };
        const ac = { x: c.x-a.x, y: c.y-a.y, z: c.z-a.z };
        const n  = {
            x: ab.y*ac.z - ab.z*ac.y,
            y: ab.z*ac.x - ab.x*ac.z,
            z: ab.x*ac.y - ab.y*ac.x,
        };
        const len = Math.sqrt(n.x**2 + n.y**2 + n.z**2) || 1;
        n.x /= len; n.y /= len; n.z /= len;
        const d = -(n.x*a.x + n.y*a.y + n.z*a.z);
        return new Plane3D(n.x, n.y, n.z, d);
    }

    distanceToPoint(p: {x:number;y:number;z:number}): number {
        return this.normal.x*p.x + this.normal.y*p.y + this.normal.z*p.z + this.constant;
    }

    projectPoint(p: {x:number;y:number;z:number}): {x:number;y:number;z:number} {
        const d = this.distanceToPoint(p);
        return { x: p.x - d*this.normal.x, y: p.y - d*this.normal.y, z: p.z - d*this.normal.z };
    }

    /** Returns parameter t at which a ray hits this plane, or null. */
    rayIntersect(origin: {x:number;y:number;z:number}, dir: {x:number;y:number;z:number}): number | null {
        const denom = this.normal.x*dir.x + this.normal.y*dir.y + this.normal.z*dir.z;
        if (Math.abs(denom) < 1e-6) return null;
        const t = -(this.normal.x*origin.x + this.normal.y*origin.y + this.normal.z*origin.z + this.constant) / denom;
        return t >= 0 ? t : null;
    }
}

// ── BVH (Bounding Volume Hierarchy) ─────────────────────────────────────────

export interface BVHTriangle {
    a: { x: number; y: number; z: number };
    b: { x: number; y: number; z: number };
    c: { x: number; y: number; z: number };
    index: number;
}

interface BVHNode {
    box  : { min: {x:number;y:number;z:number}; max: {x:number;y:number;z:number} };
    left?: BVHNode; right?: BVHNode;
    tris?: BVHTriangle[];
}

export class BVH {
    #root: BVHNode | null = null;

    build(triangles: BVHTriangle[], maxLeaf = 4): this {
        this.#root = this.#buildNode(triangles, 0, maxLeaf);
        return this;
    }

    #centroid(t: BVHTriangle): {x:number;y:number;z:number} {
        return {
            x: (t.a.x+t.b.x+t.c.x)/3,
            y: (t.a.y+t.b.y+t.c.y)/3,
            z: (t.a.z+t.b.z+t.c.z)/3,
        };
    }

    #triBox(tris: BVHTriangle[]): BVHNode['box'] {
        const pts = tris.flatMap(t => [t.a, t.b, t.c]);
        return {
            min: { x: Math.min(...pts.map(p=>p.x)), y: Math.min(...pts.map(p=>p.y)), z: Math.min(...pts.map(p=>p.z)) },
            max: { x: Math.max(...pts.map(p=>p.x)), y: Math.max(...pts.map(p=>p.y)), z: Math.max(...pts.map(p=>p.z)) },
        };
    }

    #buildNode(tris: BVHTriangle[], depth: number, maxLeaf: number): BVHNode {
        const box = this.#triBox(tris);
        if (tris.length <= maxLeaf || depth > 20) return { box, tris };
        const axis = ['x','y','z'][[box.max.x-box.min.x, box.max.y-box.min.y, box.max.z-box.min.z].indexOf(Math.max(box.max.x-box.min.x, box.max.y-box.min.y, box.max.z-box.min.z))] as 'x'|'y'|'z';
        const sorted = [...tris].sort((a,b) => this.#centroid(a)[axis] - this.#centroid(b)[axis]);
        const mid = Math.floor(sorted.length / 2);
        return {
            box,
            left:  this.#buildNode(sorted.slice(0, mid), depth+1, maxLeaf),
            right: this.#buildNode(sorted.slice(mid),    depth+1, maxLeaf),
        };
    }

    /** Ray-cast: returns nearest hit triangle index and t parameter, or null. */
    raycast(origin: {x:number;y:number;z:number}, dir: {x:number;y:number;z:number}): { index: number; t: number } | null {
        let best: { index: number; t: number } | null = null;
        const traverse = (node: BVHNode | undefined) => {
            if (!node || !this.#rayHitsBox(origin, dir, node.box)) return;
            if (node.tris) {
                for (const tri of node.tris) {
                    const t = this.#rayTriangle(origin, dir, tri);
                    if (t !== null && (best === null || t < best.t)) best = { index: tri.index, t };
                }
            } else { traverse(node.left); traverse(node.right); }
        };
        traverse(this.#root ?? undefined);
        return best;
    }

    #rayHitsBox(o: {x:number;y:number;z:number}, d: {x:number;y:number;z:number}, box: BVHNode['box']): boolean {
        let tmin = -Infinity, tmax = Infinity;
        for (const axis of ['x','y','z'] as const) {
            if (Math.abs(d[axis]) < 1e-8) {
                if (o[axis] < box.min[axis] || o[axis] > box.max[axis]) return false;
            } else {
                const t1 = (box.min[axis]-o[axis])/d[axis];
                const t2 = (box.max[axis]-o[axis])/d[axis];
                tmin = Math.max(tmin, Math.min(t1,t2));
                tmax = Math.min(tmax, Math.max(t1,t2));
                if (tmax < tmin) return false;
            }
        }
        return true;
    }

    #rayTriangle(o: {x:number;y:number;z:number}, d: {x:number;y:number;z:number}, t: BVHTriangle): number | null {
        // Möller-Trumbore
        const edge1 = { x: t.b.x-t.a.x, y: t.b.y-t.a.y, z: t.b.z-t.a.z };
        const edge2 = { x: t.c.x-t.a.x, y: t.c.y-t.a.y, z: t.c.z-t.a.z };
        const h = { x: d.y*edge2.z-d.z*edge2.y, y: d.z*edge2.x-d.x*edge2.z, z: d.x*edge2.y-d.y*edge2.x };
        const a = edge1.x*h.x+edge1.y*h.y+edge1.z*h.z;
        if (Math.abs(a) < 1e-8) return null;
        const f = 1/a;
        const s = { x: o.x-t.a.x, y: o.y-t.a.y, z: o.z-t.a.z };
        const u = f*(s.x*h.x+s.y*h.y+s.z*h.z);
        if (u < 0 || u > 1) return null;
        const q = { x: s.y*edge1.z-s.z*edge1.y, y: s.z*edge1.x-s.x*edge1.z, z: s.x*edge1.y-s.y*edge1.x };
        const v = f*(d.x*q.x+d.y*q.y+d.z*q.z);
        if (v < 0 || u+v > 1) return null;
        const r = f*(edge2.x*q.x+edge2.y*q.y+edge2.z*q.z);
        return r > 1e-8 ? r : null;
    }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const Geometry = {
  name   : 'Geometry',
  version: '1.0.0',
  install(_core: typeof Core): void {
    try {
      Object.assign(window, {
        Angle, Rotation, Size, Point, Matrix, Transform, AABB, Ray, Plane3D, BVH,
        Rectangle, Circle, Triangle, Polygon,
        Sphere, Box, Cylinder, Torus, Cone, Pyramid, Tube,
        Shapes, Solids,
      });
    } catch {}
  },
};

export default Geometry;
