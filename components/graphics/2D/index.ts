/**
 * @module    components/graphics/2D
 *
 * 2D graphics suite — canvases, vector path editing, layers, and the
 * tool palettes for the Wires / Daedalus visual editors.
 *
 * Note: colour pickers and gradient editors live in `graphics/colors/`,
 * not here, so the 2D / 3D split can stay focused on geometry.
 */

// Canvas
export { Canvas2D }            from './Canvas2D.ts';
export type { Canvas2DOptions } from './Canvas2D.ts';

// Vector path editor
export { BezierEditor }        from './BezierEditor.ts';
export type { BezierEditorOptions, Anchor, Vec2, BezierMode } from './BezierEditor.ts';

// Layers
export { LayersPanel }         from './LayersPanel.ts';
export type { LayersPanelOptions, LayerNode, LayerKind } from './LayersPanel.ts';

// Tool palettes
export { ToolsPalette }        from './ToolsPalette.ts';
export type { ToolsPaletteOptions, PaletteTool } from './ToolsPalette.ts';

export { LinesPalette2D }      from './LinesPalette2D.ts';
export type { LinesPalette2DOptions, LineTool } from './LinesPalette2D.ts';
