import type { ComponentType, ReactNode } from 'react';
import type { BoltNode } from '@bolt-flow/core';

export interface DrawFont { id: string; label: string; family: string }
export const defaultFonts: DrawFont[] = [
  { id: 'normal', label: 'Normal', family: 'Inter, system-ui, sans-serif' },
  { id: 'handwritten', label: 'Handwritten', family: '"Gochi Hand", cursive' },
  { id: 'code', label: 'Code', family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
];
export interface DrawShapeGeometry { width: number; height: number; size: number }
export interface DrawShapeRenderProps { node: Pick<BoltNode, 'data' | 'width' | 'height'> }
/** Trusted host code only. The generated SVG path is saved; functions and components are not. */
export interface DrawShapeDefinition {
  id: string;
  label: string;
  icon?: ReactNode;
  path: (bounds: DrawShapeGeometry) => string;
  /** Optional richer local renderer; saved path is the fallback without this definition. */
  component?: ComponentType<DrawShapeRenderProps>;
}
export const defaultColors = ['#252936', '#7963d2', '#2563eb', '#059669', '#e08a22', '#e0526e'];