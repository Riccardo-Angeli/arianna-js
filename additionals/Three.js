"use strict";
/**
 * @module    AriannA3D
 * @author    Riccardo Angeli
 * @version   0.1.0
 * @copyright Riccardo Angeli 2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * WebGPU/WebGL renderer, scene graph, materials
 *
 * Includes: Scene, Camera, Mesh3D, Material, Light, Shader, Animation3D
 * Weight:   ~80KB gzipped
 * Deps:     Geometry, Math
 *
 * @example
 *   import AriannA from "./AriannA.ts";
 *   import { Three } from "./Three.ts";
 *
 *   Core.use(Three);
 *
 * Usage:
 *   // After Core.use(Three), all classes are available globally
 *   // and integrate with Real, State, Observable automatically
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Three = void 0;
// ── Three Plugin ─────────────────────────────────────────────────────────────
exports.Three = {
    name: "AriannA3D",
    version: "0.1.0",
    install: function (core, opts) {
        // Register Three on Core
        Object.defineProperty(window, "AriannA3D", {
            value: AriannA3DAPI,
            writable: false,
            enumerable: false,
            configurable: false,
        });
    },
};
// ── Three API ────────────────────────────────────────────────────────────────
var AriannA3DAPI = {
// TODO: implement Scene, Camera, Mesh3D ...
};
exports.default = exports.Three;
