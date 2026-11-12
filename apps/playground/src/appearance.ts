import type { BoltDocument, BoltStyle } from 'bolt-flow-core';

export interface Appearance {
  nodeBackground: string; nodeColor: string; nodeBorder: string; nodeRadius: number; nodeFont: number;
  edgeColor: string; edgeWidth: number; edgeType: string; edgeDashed: boolean; edgeAnimated: boolean; edgeArrow: boolean;
}
export const appearanceDefaults: Appearance = {
  nodeBackground: '#ffffff', nodeColor: '#182230', nodeBorder: '#dce3ec', nodeRadius: 10, nodeFont: 14,
  edgeColor: '#94a3b8', edgeWidth: 1.8, edgeType: 'smoothstep', edgeDashed: false, edgeAnimated: false, edgeArrow: true,
};
export function appearanceOf(document: BoltDocument): Appearance {
  const stored = document.extensions.appearance;
  const result = { ...appearanceDefaults };
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return result;
  for (const key of Object.keys(result) as (keyof Appearance)[]) {
    const value = stored[key];
    if (typeof value !== typeof result[key]) continue;
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value > 200)) continue;
    if (key === 'edgeType' && !['smoothstep', 'default', 'straight', 'step', 'bolt-waypoint'].includes(String(value))) continue;
    Object.assign(result, { [key]: value });
  }
  return result;
}
export function nodeStyle(appearance: Appearance): BoltStyle {
  return { backgroundColor: appearance.nodeBackground, color: appearance.nodeColor, borderColor: appearance.nodeBorder,
    borderWidth: 1, borderStyle: 'solid', borderRadius: appearance.nodeRadius, fontSize: appearance.nodeFont };
}
export function edgeStyle(appearance: Appearance): BoltStyle {
  return { stroke: appearance.edgeColor, strokeWidth: appearance.edgeWidth, strokeDasharray: appearance.edgeDashed ? '7 5' : '' };
}