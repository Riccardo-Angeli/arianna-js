/**
 * @module    Animation
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * Migrated and extended from Golem CSS Animation system (2012-2018).
 *
 * ── Original Golem Animation system ──────────────────────────────────────────
 *
 *   The original was an IIFE (Immediately Invoked Function Expression) that:
 *   - Maintained a requestAnimationFrame loop at 60fps
 *   - Tracked _animationElements (map of elements being animated)
 *   - Maintained _animationFrames (array of frame snapshots)
 *   - Had _animationFrameRate (default 60fps)
 *   - Exposed Start(AnimationEventArguments) / Stop(Id) functions
 *   - Fired 4 callbacks:
 *       onAnimation          — every frame
 *       onAnimationStart     — when animation begins
 *       onAnimationStop      — when animation ends
 *       onAnimationIteration — on each iteration/loop
 *
 *   All of this is preserved in the AnimationLoop class below.
 *
 * ── Extensions (new in AriannA 1.0) ──────────────────────────────────────────
 *
 *   Tween    — value interpolation with 12 easing functions
 *   Spring   — physics-based animation (stiffness/damping/mass)
 *   Timeline — sequence/parallel composition of tweens
 *   Keyframe — CSS keyframe equivalent
 *
 * @example
 *   import { Animation, AnimationLoop, Tween, Spring } from "./Animation.ts";
 *   Core.use(Animation);
 *
 *   // Original Golem API preserved
 *   const loop = new AnimationLoop({ frameRate: 60 });
 *   loop.onAnimation = (frame) => { myEl.style.left = frame.Index + "px"; };
 *   loop.Start();
 *   setTimeout(() => loop.Stop(), 3000);
 *
 *   // New Tween API
 *   new Tween(el.style, {
 *     opacity : [0, 1],
 *     duration: 0.6,
 *     easing  : "easeOutCubic",
 *   });
 *
 *   // Spring
 *   const spring = new Spring(0, 100, { stiffness: 200, damping: 20 }, v => {
 *     el.style.transform = `translateX(${v}px)`;
 *   });
 */

import { Core, State } from "../core/index.ts";

// ── AnimationLoop ─────────────────────────────────────────────────────────────
// Original Golem animation IIFE — migrated to a class with identical semantics

export interface AnimationFrame {
  Name    : string;
  Duration: number;
  Rate    : number;
  Index   : number;
  Elements: Record<string, Element>;
  Keyframe: boolean;
}

export class AnimationLoop {
  private _elements  : Record<string, Element> = {};
  private _frames    : AnimationFrame[] = [];
  private _frameRate : number;
  private _duration  : number;
  private _id        : number | false = false;
  private _running   = false;
  private _callbacks = {
    onAnimation         : (_frame: AnimationFrame) => {},
    onAnimationStart    : (_frame: AnimationFrame) => {},
    onAnimationStop     : () => {},
    onAnimationIteration: () => {},
  };

  constructor(opts: { frameRate?: number } = {}) {
    this._frameRate = opts.frameRate ?? 60;
    this._duration  = 1 / this._frameRate;
  }

  // Original Golem callbacks
  get onAnimation         () { return this._callbacks.onAnimation; }
  set onAnimation         (fn: (f:AnimationFrame)=>void) { this._callbacks.onAnimation=fn; }
  get onAnimationStart    () { return this._callbacks.onAnimationStart; }
  set onAnimationStart    (fn: (f:AnimationFrame)=>void) { this._callbacks.onAnimationStart=fn; }
  get onAnimationStop     () { return this._callbacks.onAnimationStop; }
  set onAnimationStop     (fn: ()=>void) { this._callbacks.onAnimationStop=fn; }
  get onAnimationIteration() { return this._callbacks.onAnimationIteration; }
  set onAnimationIteration(fn: ()=>void) { this._callbacks.onAnimationIteration=fn; }

  get IsRunning(): boolean { return this._running; }
  get Frames   (): AnimationFrame[] { return this._frames; }
  get FrameRate(): number { return this._frameRate; }

  // Original Golem Add/Remove element
  Add(id: string, el: Element): this { this._elements[id]=el; return this; }
  Remove(id: string): this { delete this._elements[id]; return this; }

  // Original Golem Start — migrated from IIFE function
  Start(_args?: unknown): this {
    if (this._running) return this;
    this._running = true;

    const animate = (_time: number) => {
      if (!this._running) return;

      const frameIndex = this._frames.length;
      const frame: AnimationFrame = {
        Name    : `AriannA-Frame-${frameIndex}`,
        Duration: this._duration,
        Rate    : this._frameRate,
        Index   : frameIndex,
        Elements: this._elements,
        Keyframe: false,
      };

      this._frames.push(frame);

      if (frameIndex === 0) {
        this._callbacks.onAnimationStart(frame);
      }

      this._callbacks.onAnimation(frame);

      if (frameIndex > 0 && frameIndex % this._frameRate === 0) {
        this._callbacks.onAnimationIteration();
      }

      this._id = requestAnimationFrame(animate);
    };

    this._id = requestAnimationFrame(animate);
    return this;
  }

  // Original Golem Stop — migrated
  Stop(id?: number | string): this {
    this._running = false;
    const cancelId = id !== undefined
        ? (typeof id === "string" ? parseInt(id) : id)
        : (this._id || 0);
    cancelAnimationFrame(cancelId);
    this._id = false;
    this._callbacks.onAnimationStop();
    return this;
  }

  Reset(): this { this._frames=[]; return this; }
}

// ── Easing ────────────────────────────────────────────────────────────────────

export const Easing: Record<string, (t:number)=>number> = {
  linear        : t => t,
  easeInQuad    : t => t*t,
  easeOutQuad   : t => t*(2-t),
  easeInOutQuad : t => t<0.5?2*t*t:-1+(4-2*t)*t,
  easeInCubic   : t => t*t*t,
  easeOutCubic  : t => (--t)*t*t+1,
  easeInOutCubic: t => t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1,
  easeInQuart   : t => t*t*t*t,
  easeOutQuart  : t => 1-(--t)*t*t*t,
  easeInExpo    : t => t===0?0:Math.pow(2,10*t-10),
  easeOutExpo   : t => t===1?1:1-Math.pow(2,-10*t),
  easeInOutExpo : t => t===0?0:t===1?1:t<0.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2,
  easeOutBack   : t => { const c1=1.70158,c3=c1+1; return 1+c3*(t-1)**3+c1*(t-1)**2; },
  easeOutBounce : t => {
    const n=7.5625,d=2.75;
    if(t<1/d)return n*t*t;
    if(t<2/d)return n*(t-=1.5/d)*t+0.75;
    if(t<2.5/d)return n*(t-=2.25/d)*t+0.9375;
    return n*(t-=2.625/d)*t+0.984375;
  },
  easeOutElastic: t => {
    if(t===0||t===1)return t;
    return Math.pow(2,-10*t)*Math.sin((t*10-0.75)*(2*Math.PI)/3)+1;
  },
};

// ── Tween ─────────────────────────────────────────────────────────────────────

export interface TweenOptions {
  duration   : number;
  easing?    : keyof typeof Easing | ((t:number)=>number);
  delay?     : number;
  repeat?    : number | "infinite";
  yoyo?      : boolean;
  onUpdate?  : (progress:number) => void;
  onComplete?: () => void;
  [key: string]: unknown;
}

export class Tween {
  private _from     : Record<string,number> = {};
  private _to       : Record<string,number> = {};
  private _target   : Record<string,unknown>;
  private _opts     : TweenOptions;
  private _start    = 0;
  private _running  = false;
  private _raf      = 0;
  private _reps     = 0;
  private _forward  = true;

  constructor(target: Record<string,unknown>, opts: TweenOptions) {
    this._target = target;
    this._opts   = opts;

    for (const [key,val] of Object.entries(opts)) {
      if (Array.isArray(val) && val.length === 2) {
        this._from[key] = val[0] as number;
        this._to[key]   = val[1] as number;
        target[key]     = val[0];
      }
    }

    setTimeout(() => this.play(), (opts.delay ?? 0) * 1000);
  }

  play(): this {
    this._running=true; this._start=performance.now(); this._tick(); return this;
  }
  pause(): this { this._running=false; cancelAnimationFrame(this._raf); return this; }
  stop (): this { this.pause(); this._reps=0; this._forward=true; return this; }

  private _tick(): void {
    if(!this._running) return;
    const elapsed=(performance.now()-this._start)/1000;
    const t=Math.min(elapsed/this._opts.duration,1);
    const easeFn=typeof this._opts.easing==="function"
        ? this._opts.easing
        : Easing[this._opts.easing??"linear"]??Easing.linear;
    const e=this._forward?easeFn(t):easeFn(1-t);

    for(const key of Object.keys(this._from)) {
      this._target[key]=this._from[key]+(this._to[key]-this._from[key])*e;
    }
    this._opts.onUpdate?.(t);

    if(t>=1) {
      this._reps++;
      const maxReps=this._opts.repeat==="infinite"?Infinity:(this._opts.repeat??0)+1;
      if(this._reps<maxReps) {
        if(this._opts.yoyo) this._forward=!this._forward;
        this._start=performance.now();
        this._raf=requestAnimationFrame(()=>this._tick());
      } else {
        this._running=false;
        this._opts.onComplete?.();
      }
    } else {
      this._raf=requestAnimationFrame(()=>this._tick());
    }
  }
}

// ── Spring ────────────────────────────────────────────────────────────────────

export class Spring {
  private _pos    : number;
  private _vel    = 0;
  private _target : number;
  private _opts   : { stiffness:number; damping:number; mass:number; precision:number };
  private _cb     : (value:number)=>void;
  private _running= false;
  private _raf    = 0;

  constructor(
      from    : number,
      to      : number,
      opts    : { stiffness?:number; damping?:number; mass?:number; precision?:number } = {},
      onUpdate: (value:number) => void,
  ) {
    this._pos    = from;
    this._target = to;
    this._cb     = onUpdate;
    this._opts   = {
      stiffness: opts.stiffness ?? 150,
      damping  : opts.damping   ?? 20,
      mass     : opts.mass      ?? 1,
      precision: opts.precision ?? 0.001,
    };
    this.play();
  }

  setTarget(to: number): this { this._target=to; if(!this._running)this.play(); return this; }

  play(): this {
    this._running=true;
    let last=performance.now();
    const tick=(now:number)=>{
      const dt=Math.min((now-last)/1000,0.064);
      last=now;
      const force=-this._opts.stiffness*(this._pos-this._target)-this._opts.damping*this._vel;
      this._vel+=force/this._opts.mass*dt;
      this._pos+=this._vel*dt;
      this._cb(this._pos);
      if(Math.abs(this._vel)<this._opts.precision&&Math.abs(this._pos-this._target)<this._opts.precision){
        this._pos=this._target; this._cb(this._pos); this._running=false;
      } else {
        this._raf=requestAnimationFrame(tick);
      }
    };
    this._raf=requestAnimationFrame(tick);
    return this;
  }

  pause(): this { this._running=false; cancelAnimationFrame(this._raf); return this; }
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export class Timeline {
  private _items: Array<{ tween:Tween; at:number }> = [];
  private _duration = 0;

  add(tween: Tween, at: number | "+=0"): this {
    const t=typeof at==="string"?this._duration+parseFloat(at.slice(2)):at;
    this._items.push({tween,at:t});
    this._duration=Math.max(this._duration,t+(tween as unknown as {_opts:{duration:number}})._opts.duration);
    return this;
  }

  play(): this {
    const start=performance.now();
    this._items.forEach(({tween,at})=>{
      setTimeout(()=>(tween as unknown as {play:()=>void}).play(), at*1000);
    });
    return this;
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const Animation = {
  name   : "Animation",
  version: "1.0.0",
  install(_core: typeof Core): void {
    try {
      Object.assign(window, { AnimationLoop, Easing, Tween, Spring, Timeline });
    } catch {}
  },
};

export default Animation;
