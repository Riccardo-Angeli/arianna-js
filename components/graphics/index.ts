/**
 * @module    components/graphics
 *
 * Barrel for the graphics namespace — re-exports the three sub-namespaces:
 * 2D (canvas, vector, layers, palettes), 3D (viewport, modifiers, materials),
 * and Colors (pickers, gradient editors).
 */

export * from './2D/index.ts';
export * from './3D/index.ts';
export * from './colors/index.ts';
