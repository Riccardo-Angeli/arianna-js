/**
 * @module    jsx-dev-runtime
 * @author    Riccardo Angeli
 * @version   1.0.0
 * @copyright Riccardo Angeli 2012-2026
 *
 * AriannA JSX development runtime.
 * Dedicated with love to Arianna. ♡
 *
 * Re-exports everything from `jsx-runtime` and exposes `jsxDEV`
 * for TypeScript's `jsx: "react-jsxdev"` mode.
 * No additional logic lives here — all factories delegate to `jsx-runtime`.
 *
 * ── tsconfig.json (dev build) ─────────────────────────────────────────────────
 *   {
 *     "compilerOptions": {
 *       "jsx"             : "react-jsxdev",
 *       "jsxImportSource" : "arianna"
 *     }
 *   }
 *
 * @example
 *   // The compiler resolves `arianna/jsx-dev-runtime` automatically
 *   // when `jsxImportSource` is set to `"arianna-wip"` in dev mode.
 *   import { jsxDEV, Fragment } from 'arianna/jsx-dev-runtime';
 */

export
{
    h,
    jsx,
    jsxs,
    jsxDEV,
    Fragment,
    setDefaultRuntime,
    getDefaultRuntime,
    type JSXProps,
    type JSXNode,
    type JSXRuntime,
    type AriannAFragment,
    type IntrinsicElements,
} from './jsx-runtime.ts';
