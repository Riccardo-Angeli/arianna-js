/**
 * @module    components/graphics/colors
 *
 * Colour suite — colour pickers and gradient editors. Sits alongside
 * `graphics/2D` and `graphics/3D` and shares the colour-space mathematics
 * with the rest of AriannA via the `additionals/Colors` addon, where
 * every conversion (sRGB ⇄ HSL/HSV/CMYK/CIELUV/OKLCH/Cube/HEX) lives.
 *
 *   import { ColorPickerWheel } from 'arianna/components/graphics/colors';
 *   import * as Colors          from 'arianna/additionals/Colors';
 *
 * Components in this folder assemble the pure functions in `Colors` into
 * three picker styles (Wheel / Square / Tile) and three gradient editors
 * (Linear / Radial / Shape), plus a back-compat `ColorPicker` (the
 * original simpler picker shipped before the family expansion).
 */

// ── Pickers ────────────────────────────────────────────────────────────────

export { ColorPicker }         from './ColorPicker.ts';
export type { ColorPickerOptions, Color } from './ColorPicker.ts';

export { ColorPickerWheel }    from './ColorPickerWheel.ts';
export type { ColorPickerWheelOptions } from './ColorPickerWheel.ts';

export { ColorPickerSquare }   from './ColorPickerSquare.ts';
export type { ColorPickerSquareOptions } from './ColorPickerSquare.ts';

export { ColorPickerTile }     from './ColorPickerTile.ts';
export type { ColorPickerTileOptions } from './ColorPickerTile.ts';

// ── Gradient editors ───────────────────────────────────────────────────────

export { GradientEditorBase }   from './GradientEditor.ts';
export type { GradientEditorOptions, GradientStop } from './GradientEditor.ts';

export { LinearGradientEditor } from './LinearGradientEditor.ts';
export type { LinearGradientEditorOptions, GradientInterp } from './LinearGradientEditor.ts';

export { RadialGradientEditor } from './RadialGradientEditor.ts';
export type { RadialGradientEditorOptions, RadialShape, RadialSize } from './RadialGradientEditor.ts';

export { ShapeGradientEditor }  from './ShapeGradientEditor.ts';
export type { ShapeGradientEditorOptions, ShapeStop } from './ShapeGradientEditor.ts';
