/**
 * @module    AriannAAnimation
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * Easing functions and animation utilities for AriannA controls.
 *
 * @example
 *   import { animate, easing } from 'arianna-wip/controls/core/AriannAAnimation';
 *
 *   animate({
 *     from     : 0,
 *     to       : 1,
 *     duration : 300,
 *     easing   : easing.easeOutCubic,
 *     onUpdate : v => el.style.opacity = String(v),
 *   });
 */

/** Easing function signature. */
export type EasingFn = (t: number) => number;

/** Standard easing functions (t ∈ [0,1] → [0,1]). */
export const easing: Record<string, EasingFn> = {
  linear       : t => t,
  easeInQuad   : t => t * t,
  easeOutQuad  : t => t * (2 - t),
  easeInOutQuad: t => t < .5 ? 2*t*t : -1+(4-2*t)*t,
  easeInCubic  : t => t * t * t,
  easeOutCubic : t => (--t) * t * t + 1,
  easeInOutCubic: t => t < .5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
  easeInQuart  : t => t*t*t*t,
  easeOutQuart : t => 1-(--t)*t*t*t,
  easeInElastic: t => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2,10*t-10)*Math.sin((t*10-10.75)*(2*Math.PI)/3),
  easeOutElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2,-10*t)*Math.sin((t*10-.75)*(2*Math.PI)/3)+1,
  easeOutBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1/d1)       return n1*t*t;
    if (t < 2/d1)       return n1*(t-=1.5/d1)*t+.75;
    if (t < 2.5/d1)     return n1*(t-=2.25/d1)*t+.9375;
    return n1*(t-=2.625/d1)*t+.984375;
  },
  easeInOutSine: t => -(Math.cos(Math.PI*t)-1)/2,
};

/** Options for animate(). */
export interface AnimateOptions {
  from       : number;
  to         : number;
  duration   : number;
  easing?    : EasingFn;
  onUpdate   : (value: number) => void;
  onComplete?: () => void;
  signal?    : AbortSignal;
}

/**
 * Animate a numeric value over time using requestAnimationFrame.
 * Returns a cancel function.
 *
 * @example
 *   const cancel = animate({
 *     from: 0, to: 300, duration: 400,
 *     easing: easing.easeOutCubic,
 *     onUpdate: v => (el.style.height = v + 'px'),
 *   });
 *   // cancel() to stop early
 */
export function animate(opts: AnimateOptions): () => void {
  const { from, to, duration, onUpdate, onComplete, signal } = opts;
  const ease   = opts.easing ?? easing.easeOutCubic;
  let   start  = 0;
  let   raf    = 0;
  let   done   = false;

  const step = (ts: number) => {
    if (done) return;
    if (signal?.aborted) { done = true; return; }
    if (!start) start = ts;
    const elapsed = ts - start;
    const t       = Math.min(elapsed / duration, 1);
    onUpdate(from + (to - from) * ease(t));
    if (t < 1) {
      raf = requestAnimationFrame(step);
    } else {
      done = true;
      onComplete?.();
    }
  };

  raf = requestAnimationFrame(step);
  return () => { done = true; cancelAnimationFrame(raf); };
}

/**
 * Fade an element in or out.
 *
 * @example
 *   await fadeIn(el, 200);
 *   await fadeOut(el, 200);
 */
export function fadeIn(el: HTMLElement, duration = 200): Promise<void> {
  el.style.opacity = '0'; el.style.display = '';
  return new Promise(res => animate({ from: 0, to: 1, duration, easing: easing.easeOutQuad, onUpdate: v => el.style.opacity = String(v), onComplete: res }));
}

export function fadeOut(el: HTMLElement, duration = 200): Promise<void> {
  return new Promise(res => animate({ from: 1, to: 0, duration, easing: easing.easeInQuad, onUpdate: v => el.style.opacity = String(v), onComplete: () => { el.style.display = 'none'; res(); } }));
}

/**
 * Slide an element open (height: 0 → auto).
 */
export function slideDown(el: HTMLElement, duration = 250): Promise<void> {
  const targetH = el.scrollHeight;
  el.style.overflow = 'hidden'; el.style.height = '0'; el.style.display = '';
  return new Promise(res => animate({ from: 0, to: targetH, duration, easing: easing.easeOutCubic, onUpdate: v => el.style.height = v+'px', onComplete: () => { el.style.height = ''; el.style.overflow = ''; res(); } }));
}

export function slideUp(el: HTMLElement, duration = 250): Promise<void> {
  const startH = el.offsetHeight;
  el.style.overflow = 'hidden';
  return new Promise(res => animate({ from: startH, to: 0, duration, easing: easing.easeInCubic, onUpdate: v => el.style.height = v+'px', onComplete: () => { el.style.display = 'none'; el.style.height = ''; el.style.overflow = ''; res(); } }));
}

/**
 * Staggered animation for a list of elements.
 *
 * @example
 *   stagger(document.querySelectorAll('.item'), (el, i) => {
 *     el.style.animationDelay = i * 50 + 'ms';
 *     el.classList.add('ar-fadein');
 *   });
 */
export function stagger(
  els  : NodeListOf<HTMLElement> | HTMLElement[],
  fn   : (el: HTMLElement, index: number) => void,
  delay = 40,
): void {
  Array.from(els).forEach((el, i) =>
    setTimeout(() => fn(el, i), i * delay)
  );
}
