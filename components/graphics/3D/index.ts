/**
 * @module    components/graphics/3D
 *
 * 3D graphics suite: viewport, modifier stack, materials browser. Built
 * to host any renderer (Three.js, Babylon, WebGPU) underneath the
 * AriannA-styled UI chrome.
 */

export { CameraViewer3D }          from './CameraViewer3D.ts';
export type { CameraViewer3DOptions, PaneId, Pane, Camera, ProjectionKind, Vec3 } from './CameraViewer3D.ts';

// File: Modifiers3DPalette.ts — class still named PaletteModifiers3D
export { PaletteModifiers3D }      from './Modifiers3DPalette.ts';
export type { PaletteModifiers3DOptions, ModifierKind, StackItem } from './Modifiers3DPalette.ts';

// File: MaterialsPalette.ts — class still named PaletteMaterials
export { PaletteMaterials }        from './MaterialsPalette.ts';
export type { PaletteMaterialsOptions, MaterialSpec, MaterialKind } from './MaterialsPalette.ts';
