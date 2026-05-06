/**
 * AriannA Addons — index
 * Import only what you need — each addon is tree-shakeable
 *
 * @example
 *   import { Core } from "../core/index.ts";
 *   import { Math as Math, Math }      from "./addons/Math.ts";
 *   import { Three }        from "./addons/Three.ts";
 *   import { Animation } from "./addons/Animation.ts";
 *
 *   Core.use(Math);
 *   Core.use(Three);
 *   Core.use(Animation);
 */

export { default as AI }        from "./AI.ts";
export { default as Animation } from "./Animation.ts";
export { default as Audio }     from "./Audio.ts";
export { default as Colors }    from "./Colors.ts";
export { default as Data }      from "./Data.ts";
export { default as Finance }   from "./Finance.ts";
export { default as Geometry }  from "./Geometry.ts";
export { default as IO }        from "./IO.ts";
export { default as Latex }     from "./Latex.ts";
export { default as Math }      from "./Math.ts";
export { default as Midi }      from "./Midi.ts";
export { default as Network }   from "./Network.ts";
export { default as Three }     from "./Three.ts";
export { default as Two }       from "./Two.ts";
export { default as Video }     from "./Video.ts";

export { default as Workers }   from "../core/Workers.ts";
export { default as SSR }       from "../core/SSR.ts";
