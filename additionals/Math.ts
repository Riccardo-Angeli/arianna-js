/**
 * @module    Math
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * Migrated and extended from Golem.Math (2012-2018).
 * Every class and function from the original is preserved.
 * New additions: Vector2/3/4, Quaternion, Matrix4, LinearFunction,
 * QuadraticFunction, Complex, Statistics.
 * Dedicated with love to Arianna. ♡
 *
 * @example
 *   import { Math, MathConstants, Fraction, Vector3 } from "./Math.ts";
 *   Core.use(Math);
 *
 *   // Original Golem API
 *   const f = new Fraction(3, 4);
 *   f.Sum(new Fraction(1, 4)).toString();  // "1/1"
 *
 *   // New AriannA API
 *   const v = new Vector3(1, 2, 3);
 *   const m = Matrix4.perspective(Math.PI/4, 16/9, 0.1, 1000);
 */

import { Core } from "../core/index.ts";

// ── MathConstants ─────────────────────────────────────────────────────────────
// All 32 original Golem.Math.Constants preserved

export const MathConstants = Object.freeze({
  // Mathematical
  E       : Math.E,
  PI      : Math.PI,
  Pi      : Math.PI,
  pi      : Math.PI,
  P       : Math.PI,
  Sqrt2   : Math.sqrt(2),
  Sqrt3   : Math.sqrt(3),
  Sqrt5   : Math.sqrt(5),
  Sqrt6   : Math.sqrt(6),
  Sqrt7   : Math.sqrt(7),
  P2      : Math.log(1 + Math.sqrt(2)) + Math.sqrt(2),
  Gamma   : 0.5772156649015328606065120900824024310421593359,
  Phi     : (1 + Math.sqrt(5)) * 0.5,

  // Physical constants (SI)
  N       : 6.02214129e23,     // Avogadro (mol⁻¹)
  H       : 6.62606957e-34,    // Planck (J·s)
  h       : 1.05457172647e-34, // Reduced Planck ħ (J·s)
  l       : 1.616199e-35,      // Planck length (m)
  m       : 2.17651e-8,        // Planck mass (kg)
  K       : 1.3806488e-23,     // Boltzmann (J/K)
  Epsilon : 8.85418782e-12,    // Vacuum permittivity (F/m)
  G       : 6.67384e-11,       // Gravitational (m³/kg·s²)
  g       : 9.80665,           // Standard gravity (m/s²)
  c       : 299792458,         // Speed of light (m/s)
  F       : 6.02214129e23 * Math.E,  // Faraday (C/mol)
  R       : 8.314462175,       // Gas constant (J/mol·K)
  Mu      : 1.2566370614e-6,   // Vacuum permeability (H/m)
  Z       : 376.73031,         // Impedance free space (Ω)
  Ke      : 8.987551787e9,     // Coulomb (N·m²/C²)
  e       : 1.60217656535e-19, // Elementary charge (C)
  Kj      : 4.8359787011e14,   // Josephson (Hz/V)
  Phi0    : 2.06783375846e-15, // Magnetic flux quantum (Wb)
  Rydberg : 10973731.56853955, // Rydberg (m⁻¹)
});

// ── Numbers ───────────────────────────────────────────────────────────────────
// Golem.Math.Numbers helpers — migrated to TypeScript

export const Numbers = {
  isNatural (n: unknown): boolean {
    return n !== undefined && !isNaN(n as number)
        && (n as number) % 1 === 0 && (n as number) >= 0;
  },
  isRelative(n: unknown): boolean {
    return n !== undefined && typeof n === 'number' && !isNaN(n) && n % 1 === 0;
  },
  isRational(n: unknown): boolean {
    return n !== undefined && typeof n === 'number' && !isNaN(n) && isFinite(n);
  },
  isReal    (n: unknown): boolean {
    return n !== undefined && typeof n === 'number' && !isNaN(n);
  },
};

// ── Fraction ──────────────────────────────────────────────────────────────────
// Original Golem.Math.Numbers.Fraction — all 11 operations preserved
// Added: MathML, LaTeX getters, Equals, LessThan, GreaterThan

export class Fraction {
  private _n : number;
  private _d : number;
  private _r : number;
  private _rd: number;

  constructor(numerator: number | string, denominator = 1) {
    if (typeof numerator === 'string') {
      const p = Fraction.Parse(numerator);
      this._n = p._n; this._d = p._d;
    } else {
      this._n = numerator; this._d = denominator;
    }
    if (this._d === 0) throw new Error('Fraction: denominator cannot be zero');
    if (this._d < 0)   { this._n = -this._n; this._d = -this._d; }
    const g  = Fraction._gcd(Math.abs(this._n), this._d);
    this._r  = this._n / g;
    this._rd = this._d / g;
  }

  // Original Golem properties
  get Numerator()  : number  { return this._n; }
  get Denominator(): number  { return this._d; }
  get Reduced()    : string  { return `${this._r}/${this._rd}`; }
  get Value()      : number  { return this._n / this._d; }
  get IsInteger()  : boolean { return this._rd === 1; }
  get IsProper()   : boolean { return Math.abs(this._n) < this._d; }

  // New — MathML and LaTeX output
  get MathML(): string { return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>${this._n}</mn><mn>${this._d}</mn></mfrac></math>`; }
  get LaTeX() : string { return `\frac{${this._n}}{${this._d}}`; }

  static Is(v: unknown): v is Fraction { return v instanceof Fraction; }

  static Parse(s: string): Fraction {
    const parts = String(s).split('/');
    if (parts.length === 2) return new Fraction(parseInt(parts[0]), parseInt(parts[1]));
    const n = parseFloat(s);
    if (!isNaN(n)) {
      const dec = s.includes('.') ? s.split('.')[1].length : 0;
      const d   = Math.pow(10, dec);
      return new Fraction(Math.round(n * d), d);
    }
    throw new Error(`Fraction.Parse: cannot parse "${s}"`);
  }

  private static _gcd(a: number, b: number): number { return b===0?a:Fraction._gcd(b,a%b); }
  private static _lcm(a: number, b: number): number { return (a*b)/Fraction._gcd(a,b); }

  // Original Golem operations
  Sum       (b: Fraction|number): Fraction { const f=b instanceof Fraction?b:new Fraction(b); const d=Fraction._lcm(this._d,f._d); return new Fraction(this._n*(d/this._d)+f._n*(d/f._d),d); }
  Subtract  (b: Fraction|number): Fraction { const f=b instanceof Fraction?b:new Fraction(b); return this.Sum(new Fraction(-f._n,f._d)); }
  Multiply  (b: Fraction|number): Fraction { const f=b instanceof Fraction?b:new Fraction(b); return new Fraction(this._n*f._n,this._d*f._d); }
  Divide    (b: Fraction|number): Fraction { const f=b instanceof Fraction?b:new Fraction(b); if(f._n===0)throw new Error('Division by zero'); return new Fraction(this._n*f._d,this._d*f._n); }
  Power     (exp: number)       : Fraction { return exp<0?new Fraction(Math.pow(this._d,-exp),Math.pow(this._n,-exp)):new Fraction(Math.pow(this._n,exp),Math.pow(this._d,exp)); }
  Root      (n: number)         : number   { return Math.pow(this.Value, 1/n); }
  Exponential()                 : number   { return Math.exp(this.Value); }
  Logarithm (base=Math.E)       : number   { return Math.log(this.Value)/Math.log(base); }
  Reduce    ()                  : Fraction { return new Fraction(this._r, this._rd); }

  // New
  Equals     (b: Fraction): boolean { return this._r===b._r && this._rd===b._rd; }
  LessThan   (b: Fraction): boolean { return this.Value < b.Value; }
  GreaterThan(b: Fraction): boolean { return this.Value > b.Value; }

  valueOf() : number  { return this.Value; }
  toString(): string  { return `${this._n}/${this._d}`; }
}

// ── MathFunctions ─────────────────────────────────────────────────────────────
// All 27 original Golem.Math.Functions preserved and typed

export const MathFunctions = {
  Absolute           : (x: number)              => Math.abs(x),
  Sign               : (x: number)              => Math.sign(x),
  Sum                : (...a: number[])          => a.reduce((s,v)=>s+v, 0),
  Subtract           : (a: number, b: number)   => a - b,
  Product            : (...a: number[])          => a.reduce((p,v)=>p*v, 1),
  Division           : (a: number, b: number)   => { if(b===0)throw new Error('Division by zero'); return a/b; },
  Power              : (b: number, e: number)   => Math.pow(b, e),
  Root               : (x: number, n=2)         => Math.pow(x, 1/n),
  Exponential        : (x: number)              => Math.exp(x),
  Logarithm          : (x: number, base=Math.E) => Math.log(x)/Math.log(base),
  LeastCommonMultiplier : (a: number, b: number): number => { const gcd=(x:number,y:number):number=>y===0?x:gcd(y,x%y); return Math.abs(a*b)/gcd(Math.abs(a),Math.abs(b)); },
  GreatestCommonDivisor : (a: number, b: number): number => { const gcd=(x:number,y:number):number=>y===0?x:gcd(y,x%y); return gcd(Math.abs(a),Math.abs(b)); },
  Factorial          : (n: number): number       => { if(n<0)throw new Error('Factorial undefined for negatives'); let r=1; for(let i=2;i<=n;i++)r*=i; return r; },
  Sine               : (x: number)              => Math.sin(x),
  Cosine             : (x: number)              => Math.cos(x),
  Tangent            : (x: number)              => Math.tan(x),
  Cotangent          : (x: number)              => 1/Math.tan(x),
  Secant             : (x: number)              => 1/Math.cos(x),
  Cosecant           : (x: number)              => 1/Math.sin(x),
  HyperbolicSine     : (x: number)              => Math.sinh(x),
  HyperbolicCosine   : (x: number)              => Math.cosh(x),
  HyperbolicTangent  : (x: number)              => Math.tanh(x),
  HyperbolicCotangent: (x: number)              => 1/Math.tanh(x),
  HyperbolicSecant   : (x: number)              => 1/Math.cosh(x),
  HyperbolicCosecant : (x: number)              => 1/Math.sinh(x),
  Random             : (min=0, max=1)            => min + Math.random()*(max-min),
  GetUUID            : ()                        => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
};

// ── Range ─────────────────────────────────────────────────────────────────────
// Original Golem.Math.Objects.Range migrated

export class Range {
  constructor(
      public readonly Start: number,
      public readonly End  : number,
      public readonly Step : number = 1,
  ) {
    if (Step === 0) throw new Error('Range: step cannot be zero');
  }

  get Length(): number   { return Math.ceil((this.End - this.Start) / this.Step); }
  get Values(): number[] {
    const arr: number[] = [];
    for (let v=this.Start; this.Step>0?v<=this.End:v>=this.End; v+=this.Step) arr.push(v);
    return arr;
  }
  Contains(v: number): boolean  { return v>=Math.min(this.Start,this.End)&&v<=Math.max(this.Start,this.End); }
  Intersect(r: Range): Range|null {
    const s=Math.max(Math.min(this.Start,this.End),Math.min(r.Start,r.End));
    const e=Math.min(Math.max(this.Start,this.End),Math.max(r.Start,r.End));
    return s<=e ? new Range(s,e) : null;
  }
  toString(): string { return `[${this.Start}..${this.End} step ${this.Step}]`; }
}

// ── Monomial ──────────────────────────────────────────────────────────────────
// Original Golem.Math.Objects.Monomial migrated + MathML/LaTeX added

export class Monomial {
  constructor(
      public readonly Coefficient: number,
      public readonly Variable   : string = 'x',
      public readonly Degree     : number = 1,
  ) {}

  Evaluate  (x: number): number   { return this.Coefficient * Math.pow(x, this.Degree); }
  Derivative(): Monomial           { if(this.Degree===0)return new Monomial(0,this.Variable,0); return new Monomial(this.Coefficient*this.Degree,this.Variable,this.Degree-1); }
  Integral  (C=0): Monomial        { if(this.Degree===-1)throw new Error('Use Logarithm for degree -1'); return new Monomial(this.Coefficient/(this.Degree+1),this.Variable,this.Degree+1); }
  Sum       (m: Monomial): Monomial { if(m.Variable!==this.Variable||m.Degree!==this.Degree)throw new Error('Can only sum like terms'); return new Monomial(this.Coefficient+m.Coefficient,this.Variable,this.Degree); }
  Multiply  (m: Monomial): Monomial { return new Monomial(this.Coefficient*m.Coefficient,this.Variable,this.Degree+m.Degree); }

  get MathML(): string {
    if(this.Degree===0) return `<mn>${this.Coefficient}</mn>`;
    if(this.Degree===1) return `<mrow><mn>${this.Coefficient}</mn><mi>${this.Variable}</mi></mrow>`;
    return `<mrow><mn>${this.Coefficient}</mn><msup><mi>${this.Variable}</mi><mn>${this.Degree}</mn></msup></mrow>`;
  }
  get LaTeX(): string {
    if(this.Degree===0) return `${this.Coefficient}`;
    if(this.Degree===1) return `${this.Coefficient}${this.Variable}`;
    return `${this.Coefficient}${this.Variable}^{${this.Degree}}`;
  }
  toString(): string { return this.LaTeX; }
}

// ── LinearFunction ────────────────────────────────────────────────────────────
// NEW — not in original Golem, added for Horizon/Hiram data analysis

export class LinearFunction {
  constructor(public readonly slope: number, public readonly intercept: number) {}

  evaluate (x: number): number     { return this.slope*x + this.intercept; }
  zero     (): number              { return -this.intercept/this.slope; }
  inverse  (): LinearFunction      { return new LinearFunction(1/this.slope, -this.intercept/this.slope); }
  get LaTeX(): string              { return `y = ${this.slope}x + ${this.intercept}`; }
  get MathML(): string             { return `<math><mrow><mi>y</mi><mo>=</mo><mn>${this.slope}</mn><mi>x</mi><mo>+</mo><mn>${this.intercept}</mn></mrow></math>`; }
  toString (): string              { return this.LaTeX; }

  static fromPoints(x1:number,y1:number,x2:number,y2:number): LinearFunction {
    if(x1===x2) throw new Error('LinearFunction: points are vertical (undefined slope)');
    const s=(y2-y1)/(x2-x1);
    return new LinearFunction(s, y1-s*x1);
  }
  static fromSlopePoint(slope:number, x:number, y:number): LinearFunction {
    return new LinearFunction(slope, y-slope*x);
  }
}

// ── QuadraticFunction ─────────────────────────────────────────────────────────
// NEW — added for curve analysis and physics simulations

export class QuadraticFunction {
  constructor(
      public readonly a: number,
      public readonly b: number,
      public readonly c: number,
  ) {}

  evaluate    (x: number): number    { return this.a*x*x + this.b*x + this.c; }
  discriminant(): number             { return this.b*this.b - 4*this.a*this.c; }
  vertex      (): [number,number]    { const x=-this.b/(2*this.a); return [x, this.evaluate(x)]; }
  roots       (): number[]           {
    const d=this.discriminant();
    if(d<0)  return [];
    if(d===0)return [-this.b/(2*this.a)];
    return [(-this.b+Math.sqrt(d))/(2*this.a), (-this.b-Math.sqrt(d))/(2*this.a)];
  }
  derivative  (): LinearFunction     { return new LinearFunction(2*this.a, this.b); }
  get LaTeX   (): string             { return `${this.a}x^2 + ${this.b}x + ${this.c}`; }
  get MathML  (): string             { return `<math><mrow><mn>${this.a}</mn><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>${this.b}</mn><mi>x</mi><mo>+</mo><mn>${this.c}</mn></mrow></math>`; }
}

// ── ExponentialFunction ───────────────────────────────────────────────────────

export class ExponentialFunction {
  constructor(
      public readonly coefficient: number,
      public readonly base       : number,
      public readonly exponentCoeff: number = 1,
  ) {}

  evaluate(x: number): number { return this.coefficient * Math.pow(this.base, this.exponentCoeff*x); }
  get LaTeX(): string         { return `${this.coefficient} \cdot ${this.base}^{${this.exponentCoeff}x}`; }
}

// ── Vector2 ───────────────────────────────────────────────────────────────────
// Maps to original Golem.Geometry.Vector2d — enhanced with new methods

export class Vector2 {
  constructor(public x=0, public y=0) {}
  static zero  = new Vector2(0, 0);
  static one   = new Vector2(1, 1);
  static up    = new Vector2(0, 1);
  static right = new Vector2(1, 0);

  add     (v: Vector2): Vector2    { return new Vector2(this.x+v.x, this.y+v.y); }
  sub     (v: Vector2): Vector2    { return new Vector2(this.x-v.x, this.y-v.y); }
  scale   (s: number) : Vector2    { return new Vector2(this.x*s,   this.y*s); }
  dot     (v: Vector2): number     { return this.x*v.x + this.y*v.y; }
  length  ()          : number     { return Math.sqrt(this.x**2+this.y**2); }
  normalize()         : Vector2    { const l=this.length(); return l>0?this.scale(1/l):Vector2.zero; }
  angle   ()          : number     { return Math.atan2(this.y, this.x); }
  rotate  (rad:number): Vector2    { const c=Math.cos(rad),s=Math.sin(rad); return new Vector2(c*this.x-s*this.y,s*this.x+c*this.y); }
  lerp    (v:Vector2,t:number):Vector2 { return this.add(v.sub(this).scale(t)); }
  distance(v: Vector2): number     { return this.sub(v).length(); }
  toArray (): [number,number]      { return [this.x, this.y]; }
  clone   (): Vector2              { return new Vector2(this.x, this.y); }
  toString(): string               { return `Vector2(${this.x}, ${this.y})`; }
}

// ── Vector3 ───────────────────────────────────────────────────────────────────
// Maps to original Golem.Geometry.Vector3d — enhanced with full 3D operations

export class Vector3 {
  constructor(public x=0, public y=0, public z=0) {}
  static up    = new Vector3(0, 1, 0);
  static right = new Vector3(1, 0, 0);
  static fwd   = new Vector3(0, 0, -1);
  static zero  = new Vector3(0, 0, 0);
  static one   = new Vector3(1, 1, 1);

  add     (v: Vector3): Vector3     { return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z); }
  sub     (v: Vector3): Vector3     { return new Vector3(this.x-v.x,this.y-v.y,this.z-v.z); }
  scale   (s: number) : Vector3     { return new Vector3(this.x*s,this.y*s,this.z*s); }
  dot     (v: Vector3): number      { return this.x*v.x+this.y*v.y+this.z*v.z; }
  cross   (v: Vector3): Vector3     { return new Vector3(this.y*v.z-this.z*v.y,this.z*v.x-this.x*v.z,this.x*v.y-this.y*v.x); }
  length  ()          : number      { return Math.sqrt(this.dot(this)); }
  normalize()         : Vector3     { const l=this.length(); return l>0?this.scale(1/l):Vector3.zero; }
  lerp    (v:Vector3,t:number):Vector3 { return this.add(v.sub(this).scale(t)); }
  distance(v: Vector3): number      { return this.sub(v).length(); }
  reflect (n: Vector3): Vector3     { return this.sub(n.scale(2*this.dot(n))); }
  toArray (): [number,number,number]{ return [this.x,this.y,this.z]; }
  toVec4  (w=1): Vector4            { return new Vector4(this.x,this.y,this.z,w); }
  clone   (): Vector3               { return new Vector3(this.x,this.y,this.z); }
  toString(): string                { return `Vector3(${this.x.toFixed(4)},${this.y.toFixed(4)},${this.z.toFixed(4)})`; }
}

// ── Vector4 ───────────────────────────────────────────────────────────────────

export class Vector4 {
  constructor(public x=0,public y=0,public z=0,public w=1) {}
  add     (v: Vector4): Vector4 { return new Vector4(this.x+v.x,this.y+v.y,this.z+v.z,this.w+v.w); }
  scale   (s: number) : Vector4 { return new Vector4(this.x*s,this.y*s,this.z*s,this.w*s); }
  toVec3  (): Vector3           { return new Vector3(this.x/this.w,this.y/this.w,this.z/this.w); }
  toArray (): [number,number,number,number] { return [this.x,this.y,this.z,this.w]; }
  toString(): string            { return `Vector4(${this.x},${this.y},${this.z},${this.w})`; }
}

// ── Quaternion ────────────────────────────────────────────────────────────────
// Original Golem.Math.Quaternion migrated — used for 3D rotations without gimbal lock

export class Quaternion {
  constructor(public x=0,public y=0,public z=0,public w=1) {}
  static identity = new Quaternion(0,0,0,1);

  static fromAxisAngle(axis: Vector3, rad: number): Quaternion {
    const s=Math.sin(rad/2),n=axis.normalize();
    return new Quaternion(n.x*s,n.y*s,n.z*s,Math.cos(rad/2));
  }
  static fromEuler(x:number,y:number,z:number): Quaternion {
    const cx=Math.cos(x/2),sx=Math.sin(x/2),cy=Math.cos(y/2),sy=Math.sin(y/2),cz=Math.cos(z/2),sz=Math.sin(z/2);
    return new Quaternion(sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz);
  }
  multiply(q: Quaternion): Quaternion {
    return new Quaternion(
        this.w*q.x+this.x*q.w+this.y*q.z-this.z*q.y,
        this.w*q.y-this.x*q.z+this.y*q.w+this.z*q.x,
        this.w*q.z+this.x*q.y-this.y*q.x+this.z*q.w,
        this.w*q.w-this.x*q.x-this.y*q.y-this.z*q.z,
    );
  }
  rotate(v: Vector3): Vector3 {
    const qv=new Quaternion(v.x,v.y,v.z,0),inv=new Quaternion(-this.x,-this.y,-this.z,this.w);
    const r=this.multiply(qv).multiply(inv);
    return new Vector3(r.x,r.y,r.z);
  }
  normalize(): Quaternion {
    const l=Math.sqrt(this.x**2+this.y**2+this.z**2+this.w**2);
    return l>0?new Quaternion(this.x/l,this.y/l,this.z/l,this.w/l):Quaternion.identity;
  }
  slerp(q: Quaternion, t: number): Quaternion {
    let dot=this.x*q.x+this.y*q.y+this.z*q.z+this.w*q.w;
    const qb=dot<0?new Quaternion(-q.x,-q.y,-q.z,-q.w):q;
    dot=Math.abs(dot);
    if(dot>0.9995) return new Quaternion(this.x+(qb.x-this.x)*t,this.y+(qb.y-this.y)*t,this.z+(qb.z-this.z)*t,this.w+(qb.w-this.w)*t).normalize();
    const th0=Math.acos(dot),th=th0*t,s0=Math.cos(th)-dot*Math.sin(th)/Math.sin(th0),s1=Math.sin(th)/Math.sin(th0);
    return new Quaternion(this.x*s0+qb.x*s1,this.y*s0+qb.y*s1,this.z*s0+qb.z*s1,this.w*s0+qb.w*s1);
  }
  toEuler(): [number,number,number] {
    const sinr_cosp=2*(this.w*this.x+this.y*this.z),cosr_cosp=1-2*(this.x**2+this.y**2);
    const sinp=2*(this.w*this.y-this.z*this.x);
    const siny_cosp=2*(this.w*this.z+this.x*this.y),cosy_cosp=1-2*(this.y**2+this.z**2);
    return [Math.atan2(sinr_cosp,cosr_cosp), Math.abs(sinp)>=1?Math.sign(sinp)*Math.PI/2:Math.asin(sinp), Math.atan2(siny_cosp,cosy_cosp)];
  }
}

// ── Matrix4 ───────────────────────────────────────────────────────────────────
// Maps to original Golem.Geometry.Matrix — GPU-ready Float32Array, column-major
// The original had LUP, QR, EigenValues — those are preserved in AriannAGeometry.ts (NxN Matrix)

export class Matrix4 {
  private _m: Float32Array;
  constructor(data?: Float32Array|number[]) { this._m=data?new Float32Array(data):new Float32Array(16); }

  static identity   (): Matrix4 { return new Matrix4([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
  static translation(x:number,y:number,z:number): Matrix4 { return new Matrix4([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]); }
  static scale      (x:number,y:number,z:number): Matrix4 { return new Matrix4([x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]); }
  static rotation   (q: Quaternion): Matrix4 {
    const {x,y,z,w}=q;
    return new Matrix4([1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y),0,2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x),0,2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y),0,0,0,0,1]);
  }
  static rotationX  (rad:number): Matrix4 { const c=Math.cos(rad),s=Math.sin(rad); return new Matrix4([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]); }
  static rotationY  (rad:number): Matrix4 { const c=Math.cos(rad),s=Math.sin(rad); return new Matrix4([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]); }
  static rotationZ  (rad:number): Matrix4 { const c=Math.cos(rad),s=Math.sin(rad); return new Matrix4([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]); }
  static perspective(fov:number,aspect:number,near:number,far:number): Matrix4 {
    const f=1/Math.tan(fov/2),nf=1/(near-far);
    return new Matrix4([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
  }
  static orthographic(l:number,r:number,b:number,t:number,n:number,f:number): Matrix4 {
    return new Matrix4([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);
  }
  static lookAt(eye:Vector3,target:Vector3,up:Vector3): Matrix4 {
    const z=eye.sub(target).normalize(),x=up.cross(z).normalize(),y=z.cross(x);
    return new Matrix4([x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,-x.dot(eye),-y.dot(eye),-z.dot(eye),1]);
  }
  multiply(b: Matrix4): Matrix4 {
    const a=this._m,bm=b._m,out=new Float32Array(16);
    for(let i=0;i<4;i++) for(let j=0;j<4;j++) out[j*4+i]=a[i]*bm[j*4]+a[4+i]*bm[j*4+1]+a[8+i]*bm[j*4+2]+a[12+i]*bm[j*4+3];
    return new Matrix4(out);
  }
  transpose(): Matrix4 {
    const m=this._m;
    return new Matrix4([m[0],m[4],m[8],m[12],m[1],m[5],m[9],m[13],m[2],m[6],m[10],m[14],m[3],m[7],m[11],m[15]]);
  }
  transformPoint(v: Vector3): Vector3 {
    const m=this._m,x=m[0]*v.x+m[4]*v.y+m[8]*v.z+m[12],y=m[1]*v.x+m[5]*v.y+m[9]*v.z+m[13],z=m[2]*v.x+m[6]*v.y+m[10]*v.z+m[14],w=m[3]*v.x+m[7]*v.y+m[11]*v.z+m[15];
    return new Vector3(x/w,y/w,z/w);
  }
  toFloat32Array(): Float32Array { return new Float32Array(this._m); }
  toArray       (): number[]     { return Array.from(this._m); }
  toString      (): string {
    const m=this._m;
    return `Matrix4:\n[${m[0].toFixed(3)} ${m[4].toFixed(3)} ${m[8].toFixed(3)} ${m[12].toFixed(3)}]\n[${m[1].toFixed(3)} ${m[5].toFixed(3)} ${m[9].toFixed(3)} ${m[13].toFixed(3)}]\n[${m[2].toFixed(3)} ${m[6].toFixed(3)} ${m[10].toFixed(3)} ${m[14].toFixed(3)}]\n[${m[3].toFixed(3)} ${m[7].toFixed(3)} ${m[11].toFixed(3)} ${m[15].toFixed(3)}]`;
  }
}

// ── Complex ───────────────────────────────────────────────────────────────────
// Original Golem.Math.Complex migrated — extended with exp, pow, FFT-ready

export class Complex {
  constructor(public re=0, public im=0) {}

  add (c: Complex): Complex { return new Complex(this.re+c.re,this.im+c.im); }
  sub (c: Complex): Complex { return new Complex(this.re-c.re,this.im-c.im); }
  mul (c: Complex): Complex { return new Complex(this.re*c.re-this.im*c.im,this.re*c.im+this.im*c.re); }
  div (c: Complex): Complex { const d=c.re**2+c.im**2; return new Complex((this.re*c.re+this.im*c.im)/d,(this.im*c.re-this.re*c.im)/d); }
  abs ()          : number  { return Math.sqrt(this.re**2+this.im**2); }
  arg ()          : number  { return Math.atan2(this.im, this.re); }
  conjugate()     : Complex { return new Complex(this.re,-this.im); }
  pow (n: number) : Complex { const r=Math.pow(this.abs(),n),a=this.arg()*n; return new Complex(r*Math.cos(a),r*Math.sin(a)); }
  sqrt()          : Complex { return this.pow(0.5); }
  exp ()          : Complex { const e=Math.exp(this.re); return new Complex(e*Math.cos(this.im),e*Math.sin(this.im)); }
  Norm()          : number  { return this.re**2+this.im**2; }
  Argument()      : number  { return this.arg(); }
  Conjugate()     : Complex { return this.conjugate(); }

  static fromPolar(r:number,theta:number): Complex { return new Complex(r*Math.cos(theta),r*Math.sin(theta)); }

  get MathML(): string { return `<math><mrow><mn>${this.re}</mn><mo>+</mo><mn>${this.im}</mn><mi>i</mi></mrow></math>`; }
  get LaTeX () : string { return `${this.re}${this.im>=0?'+':''}${this.im}i`; }
  toString() : string { return this.LaTeX; }
}

// ── Statistics ────────────────────────────────────────────────────────────────
// NEW — essential for Horizon data governance and Hiram property analytics

export const Statistics = {
  mean      : (d: number[]) => d.reduce((a,b)=>a+b,0)/d.length,
  sum       : (d: number[]) => d.reduce((a,b)=>a+b,0),
  min       : (d: number[]) => Math.min(...d),
  max       : (d: number[]) => Math.max(...d),
  range     : (d: number[]) => Math.max(...d)-Math.min(...d),
  median    : (d: number[]) => { const s=[...d].sort((a,b)=>a-b),m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  mode      : (d: number[]) => { const c=new Map<number,number>(); d.forEach(v=>c.set(v,(c.get(v)??0)+1)); return [...c.entries()].sort((a,b)=>b[1]-a[1])[0][0]; },
  variance  : (d: number[]) => { const m=Statistics.mean(d); return d.reduce((a,b)=>a+(b-m)**2,0)/d.length; },
  stdDev    : (d: number[]) => Math.sqrt(Statistics.variance(d)),
  zScore    : (d: number[], x: number) => (x-Statistics.mean(d))/Statistics.stdDev(d),
  percentile: (d: number[], p: number) => {
    const s=[...d].sort((a,b)=>a-b),i=(p/100)*(s.length-1);
    const lo=Math.floor(i),hi=Math.ceil(i);
    return s[lo]+(s[hi]-s[lo])*(i-lo);
  },
  histogram : (d: number[], buckets: number) => {
    const mn=Math.min(...d),mx=Math.max(...d),w=(mx-mn)/buckets;
    const out=Array.from({length:buckets},(_,i)=>({min:mn+i*w,max:mn+(i+1)*w,count:0,frequency:0}));
    d.forEach(v=>{const i=Math.min(Math.floor((v-mn)/w),buckets-1);out[i].count++;});
    out.forEach(b=>b.frequency=b.count/d.length);
    return out;
  },
  linearRegression: (xs: number[], ys: number[]) => {
    const n=xs.length,mx=Statistics.mean(xs),my=Statistics.mean(ys);
    const slope=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/xs.reduce((a,x)=>a+(x-mx)**2,0);
    const intercept=my-slope*mx;
    const predicted=xs.map(x=>slope*x+intercept);
    const ss_res=ys.reduce((a,y,i)=>a+(y-predicted[i])**2,0);
    const ss_tot=ys.reduce((a,y)=>a+(y-my)**2,0);
    return { slope, intercept, r2: 1-ss_res/ss_tot, predict:(x:number)=>slope*x+intercept };
  },
};

// ── Plugin ────────────────────────────────────────────────────────────────────

export const AriannaMath = {
  name   : 'Math',
  version: '1.0.0',
  install(_core: typeof Core): void {
    try {
      Object.assign(window, {
        MathConstants, Numbers, Fraction, MathFunctions,
        Range, Monomial, LinearFunction, QuadraticFunction, ExponentialFunction,
        Vector2, Vector3, Vector4, Quaternion, Matrix4,
        Complex, Statistics,
      });
    } catch {}
  },
};


/** @deprecated Use AriannaMath */
export { AriannaMath as Math };
export default AriannaMath;
