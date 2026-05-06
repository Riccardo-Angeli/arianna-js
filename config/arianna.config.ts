/**
 * @file      arianna.config.ts
 * @module    AriannAConfig
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2024 All Rights Reserved
 *
 * AriannA configuration file — drop one of these in your project root.
 * Works like vite.config.ts or react-scripts config: zero-config defaults,
 * opt-in to everything else.
 *
 * @example
 *   // arianna.config.ts (minimal)
 *   import { defineConfig } from 'arianna';
 *   export default defineConfig({});
 *
 * @example
 *   // arianna.config.ts (full)
 *   import { defineConfig } from 'arianna';
 *   export default defineConfig({
 *     entry  : './src/main.ts',
 *     outDir : './dist',
 *     target : 'es2020',
 *     globals: { Core: true, Real: true, State: true, Observable: true },
 *     addons : { tauri: true, wasm: true },
 *     license: 'commercial',
 *   });
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Which AriannA modules to register as global `window.*` properties.
 * Set to `true` to enable, `false` to skip (useful for tree-shaking in ESM-only builds).
 * Default: all true.
 */
export interface GlobalsConfig {
  Core?        : boolean;
  Observable?  : boolean;
  State?       : boolean;
  Real?        : boolean;
  Virtual?     : boolean;
  Rule?        : boolean;
  Stylesheet?  : boolean;
  Directive?   : boolean;
  Context?     : boolean;
}

/**
 * Namespace registration config.
 * AriannA ships html, svg, mathML, x3d namespaces by default.
 * Add custom namespaces here.
 */
export interface NamespacesConfig {
  /** Include built-in HTML namespace (default: true). */
  html?   : boolean;
  /** Include built-in SVG namespace (default: true). */
  svg?    : boolean;
  /** Include built-in MathML namespace (default: true). */
  mathML? : boolean;
  /** Include built-in X3D namespace (default: true). */
  x3d?    : boolean;
  /** Custom namespace descriptors keyed by name. */
  custom? : Record<string, {
    schema : string;
    base   : string;       // global constructor name e.g. 'HTMLElement'
    w3c?   : string;
    tags?  : string[];
  }>;
}

/**
 * Optional add-on integrations.
 */
export interface AddonsConfig {
  /**
   * Enable Tauri 2 integration.
   * Adds window.__TAURI__ bridge bindings and IPC helpers.
   */
  tauri?: boolean;

  /**
   * Enable WebAssembly integration.
   * Configures WASM module loading and memory management helpers.
   */
  wasm?: boolean;

  /**
   * Enable 3D namespace (X3D + Three.js/Babylon.js bridge).
   * Requires wasm: true for physics.
   */
  '3d'?: boolean;

  /**
   * Enable physics engine (Rapier via WASM).
   * Requires wasm: true.
   */
  physics?: boolean;
}

/**
 * Development server options.
 */
export interface DevServerConfig {
  /** Port (default: 3000). */
  port?  : number;
  /** Host (default: 'localhost'). */
  host?  : string;
  /** Enable HTTPS (default: false — set to true for Tauri). */
  https? : boolean;
  /** Open browser on start (default: false). */
  open?  : boolean;
  /** HMR (Hot Module Replacement) config. */
  hmr?   : boolean | { port?: number; host?: string };
}

/**
 * Build output options.
 */
export interface BuildConfig {
  /** Entry point (default: './src/main.ts'). */
  entry?    : string;
  /** Output directory (default: './dist'). */
  outDir?   : string;
  /** ES target (default: 'es2020'). */
  target?   : 'es2015' | 'es2017' | 'es2019' | 'es2020' | 'es2022' | 'esnext';
  /** Minify output (default: true in production). */
  minify?   : boolean;
  /** Generate source maps (default: true in development). */
  sourcemap?: boolean;
  /** Output formats (default: ['esm']). */
  formats?  : ('esm' | 'cjs' | 'iife' | 'umd')[];
  /** Global name for IIFE/UMD builds (default: 'AriannA'). */
  name?     : string;
}

/**
 * License configuration.
 * - 'agpl'       : Public open-source (AGPL v3). Default.
 * - 'commercial' : Commercial license. Requires LICENSE_KEY env var.
 * - 'oem'        : OEM / system integrator license.
 */
export type LicenseMode = 'agpl' | 'commercial' | 'oem';

/**
 * JSX transform configuration.
 */
export interface JSXConfig {
  /**
   * Default JSX runtime mode.
   *
   * - `'real'`    → JSX elements become `new Real(...)` calls (DOM, default)
   * - `'virtual'` → JSX elements become `Virtual.Create(...)` calls (virtual nodes)
   *
   * Can be overridden per-file with the pragma comment:
   *   `\/* @dom-render: virtual *\/`  at the top of any .tsx file.
   *
   * @default 'real'
   *
   * @example
   *   jsx: { runtime: 'real' }    // all .tsx → Real (default)
   *   jsx: { runtime: 'virtual' } // all .tsx → Virtual
   */
  runtime?: 'real' | 'virtual';
}

/**
 * Complete AriannA configuration.
 */
export interface AriannAConfig {
  /**
   * Global window registrations.
   * Default: all modules registered globally.
   * @example
   *   globals: { Core: true, Observable: true, State: true }
   */
  globals?: GlobalsConfig;

  /**
   * Namespace configuration.
   * @example
   *   namespaces: { html: true, svg: true, mathML: true, x3d: false }
   */
  namespaces?: NamespacesConfig;

  /**
   * Optional add-on integrations (Tauri, WASM, 3D, Physics).
   * @example
   *   addons: { tauri: true, wasm: true }
   */
  addons?: AddonsConfig;

  /**
   * Development server options (used by `arianna dev`).
   */
  server?: DevServerConfig;

  /**
   * Build output options (used by `arianna build`).
   */
  build?: BuildConfig;

  /**
   * License mode. Default: 'agpl'.
   * Set to 'commercial' for closed-source commercial projects.
   */
  license?: LicenseMode;

  /**
   * Plugin array — extend AriannA with custom plugins.
   * Each plugin is a CorePlugin-compatible object with name + install.
   * @example
   *   plugins: [RouterPlugin, i18nPlugin]
   */
  plugins?: Array<{
    name    : string;
    install : (core: unknown, opts?: Record<string, unknown>) => void;
  }>;

  /**
   * JSX transform options.
   *
   * @example
   *   jsx: { runtime: 'real' }    // all .tsx files produce Real instances
   *   jsx: { runtime: 'virtual' } // all .tsx files produce VirtualNode instances
   */
  jsx?: JSXConfig;

  /**
   * Logging level.
   * - 'silent'  : No output.
   * - 'error'   : Errors only.
   * - 'warn'    : Warnings + errors.
   * - 'info'    : Default.
   * - 'verbose' : Full debug output.
   */
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'verbose';
}

// ── defineConfig ──────────────────────────────────────────────────────────────

/**
 * Type-safe config helper. Returns the config unchanged with full IntelliSense.
 * Drop this in your `arianna.config.ts`:
 *
 * @example
 *   // Minimal — zero-config defaults
 *   import { defineConfig } from 'arianna';
 *   export default defineConfig({});
 *
 * @example
 *   // Full project config
 *   import { defineConfig } from 'arianna';
 *   export default defineConfig({
 *     globals : { Core: true, Real: true, State: true, Observable: true },
 *     namespaces: { html: true, svg: true, x3d: true },
 *     addons  : { tauri: true, wasm: true },
 *     build   : { entry: './src/main.ts', outDir: './dist', target: 'es2020' },
 *     server  : { port: 3000, https: true, open: true },
 *     license : 'commercial',
 *     plugins : [RouterPlugin],
 *     logLevel: 'info',
 *   });
 */
export function defineConfig(config: AriannAConfig): AriannAConfig {
  return config;
}

// ── Default config ────────────────────────────────────────────────────────────

/**
 * Default configuration — all modules registered globally, standard namespaces,
 * AGPL license, ES2020 target.
 */
export const defaultConfig: Required<AriannAConfig> = {
  globals: {
    Core       : true,
    Observable : true,
    State      : true,
    Real       : true,
    Virtual    : true,
    Rule       : true,
    Stylesheet : true,
    Directive  : true,
    Context    : true,
  },
  namespaces: {
    html  : true,
    svg   : true,
    mathML: true,
    x3d   : true,
    custom: {},
  },
  addons: {
    tauri  : false,
    wasm   : false,
    '3d'   : false,
    physics: false,
  },
  server: {
    port  : 3000,
    host  : 'localhost',
    https : false,
    open  : false,
    hmr   : true,
  },
  build: {
    entry    : './src/main.ts',
    outDir   : './dist',
    target   : 'es2020',
    minify   : true,
    sourcemap: true,
    formats  : ['esm'],
    name     : 'AriannA',
  },
  jsx: {
    runtime: 'real',
  },
  license : 'agpl',
  plugins : [],
  logLevel: 'info',
};

export default defineConfig;
