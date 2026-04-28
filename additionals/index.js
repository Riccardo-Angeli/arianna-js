"use strict";
/**
 * AriannA Addons — index
 * Import only what you need — each addon is tree-shakeable
 *
 * @example
 *   import { Core } from "./AriannA.ts";
 *   import { Math }      from "./addons/Math.ts";
 *   import { Three }        from "./addons/Three.ts";
 *   import { Animation } from "./addons/Animation.ts";
 *
 *   Core.use(Math);
 *   Core.use(Three);
 *   Core.use(Animation);
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AriannASSR = exports.AriannAWorkers = exports.AriannAIO = exports.AriannANetwork = exports.AriannAVideo = exports.AriannAAudio = exports.AriannAAnimation = exports.AriannALatex = exports.AriannA3D = exports.AriannAGeometry = exports.AriannAMath = void 0;
var Math_ts_1 = require("./Math.ts");
Object.defineProperty(exports, "AriannAMath", { enumerable: true, get: function () { return Math_ts_1.default; } });
var Geometry_ts_1 = require("./Geometry.ts");
Object.defineProperty(exports, "AriannAGeometry", { enumerable: true, get: function () { return Geometry_ts_1.default; } });
var Three_ts_1 = require("./Three.ts");
Object.defineProperty(exports, "AriannA3D", { enumerable: true, get: function () { return Three_ts_1.default; } });
var Latex_ts_1 = require("./Latex.ts");
Object.defineProperty(exports, "AriannALatex", { enumerable: true, get: function () { return Latex_ts_1.default; } });
var Animation_ts_1 = require("./Animation.ts");
Object.defineProperty(exports, "AriannAAnimation", { enumerable: true, get: function () { return Animation_ts_1.default; } });
var Audio_ts_1 = require("./Audio.ts");
Object.defineProperty(exports, "AriannAAudio", { enumerable: true, get: function () { return Audio_ts_1.default; } });
var Video_ts_1 = require("./Video.ts");
Object.defineProperty(exports, "AriannAVideo", { enumerable: true, get: function () { return Video_ts_1.default; } });
var Network_ts_1 = require("./Network.ts");
Object.defineProperty(exports, "AriannANetwork", { enumerable: true, get: function () { return Network_ts_1.default; } });
var IO_ts_1 = require("./IO.ts");
Object.defineProperty(exports, "AriannAIO", { enumerable: true, get: function () { return IO_ts_1.default; } });
var Workers_ts_1 = require("../core/Workers.ts");
Object.defineProperty(exports, "AriannAWorkers", { enumerable: true, get: function () { return Workers_ts_1.default; } });
var SSR_ts_1 = require("../core/SSR.ts");
Object.defineProperty(exports, "AriannASSR", { enumerable: true, get: function () { return SSR_ts_1.default; } });
