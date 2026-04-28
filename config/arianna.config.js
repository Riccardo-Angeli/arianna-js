"use strict";
/**
 * @file      arianna-wip.arianna-wip-config.ts
 * @module    AriannAConfig
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * AriannA configuration file — drop one of these in your project root.
 * Works like vite.arianna-wip-config.ts or react-scripts arianna-wip-config: zero-arianna-wip-config defaults,
 * opt-in to everything else.
 *
 * @example
 *   // arianna-wip.arianna-wip-config.ts (minimal)
 *   import { defineConfig } from 'arianna-wip';
 *   export default defineConfig({});
 *
 * @example
 *   // arianna-wip.arianna-wip-config.ts (full)
 *   import { defineConfig } from 'arianna-wip';
 *   export default defineConfig({
 *     entry  : './src/main.ts',
 *     outDir : './dist',
 *     target : 'es2020',
 *     globals: { Core: true, Real: true, State: true, Observable: true },
 *     addons : { tauri: true, wasm: true },
 *     license: 'commercial',
 *   });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
exports.defineConfig = defineConfig;
// ── defineConfig ──────────────────────────────────────────────────────────────
/**
 * Type-safe arianna-wip-config helper. Returns the arianna-wip-config unchanged with full IntelliSense.
 * Drop this in your `arianna-wip.arianna-wip-config.ts`:
 *
 * @example
 *   // Minimal — zero-arianna-wip-config defaults
 *   import { defineConfig } from 'arianna-wip';
 *   export default defineConfig({});
 *
 * @example
 *   // Full project arianna-wip-config
 *   import { defineConfig } from 'arianna-wip';
 *   export default defineConfig({
 *     globals : { Core: true, Real: true, State: true, Observable: true },
 *     namespaces: { html: true, svg: true, x3d: true },
 *     addons  : { tauri: true, wasm: true },
 *     build   : { entry: './src/main.ts', outDir: './dist', target: 'es2020' },
 *     server  : { port: 3000, https: true, open: true },
 *     license : 'commercial',
 *     plugins : [RouterPlugin],
 *     logLevel: 'arianna-wip-info',
 *   });
 */
function defineConfig(config) {
    return config;
}
// ── Default arianna-wip-config ────────────────────────────────────────────────────────────
/**
 * Default configuration — all modules registered globally, standard namespaces,
 * AGPL license, ES2020 target.
 */
exports.defaultConfig = {
    globals: {
        Core: true,
        Observable: true,
        State: true,
        Real: true,
        Virtual: true,
        Rule: true,
        Stylesheet: true,
        Directive: true,
        Context: true,
    },
    namespaces: {
        html: true,
        svg: true,
        mathML: true,
        x3d: true,
        custom: {},
    },
    addons: {
        tauri: false,
        wasm: false,
        '3d': false,
        physics: false,
    },
    server: {
        port: 3000,
        host: 'localhost',
        https: false,
        open: false,
        hmr: true,
    },
    build: {
        entry: './src/main.ts',
        outDir: './dist',
        target: 'es2020',
        minify: true,
        sourcemap: true,
        formats: ['esm'],
        name: 'AriannA',
    },
    license: 'agpl',
    plugins: [],
    logLevel: 'info',
};
exports.default = defineConfig;
