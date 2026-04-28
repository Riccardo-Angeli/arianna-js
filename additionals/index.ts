/**
 * AriannA Addons — index
 * Import only what you need — each addon is tree-shakeable
 *
 * @example
 *   import { Core } from "../core/index.ts";
 *   import { AriannaMath as Math, AriannaMath }      from "./addons/Math.ts";
 *   import { Three }        from "./addons/Three.ts";
 *   import { Animation } from "./addons/Animation.ts";
 *
 *   Core.use(Math);
 *   Core.use(Three);
 *   Core.use(Animation);
 */

export { default as AriannAMath }      from "./Math.ts";
export { default as AriannAGeometry }  from "./Geometry.ts";
export { default as AriannA3D }        from "./Three.ts";
export { default as AriannALatex }     from "./Latex.ts";
export { default as AriannAAnimation } from "./Animation.ts";
export { default as AriannAAudio }     from "./Audio.ts";
export { default as AriannAVideo }     from "./Video.ts";
export { default as AriannANetwork }   from "./Network.ts";
export { default as AriannAIO }        from "./IO.ts";
export { default as AriannAWorkers }   from "../core/Workers.ts";
export { default as AriannASSR }       from "../core/SSR.ts";
