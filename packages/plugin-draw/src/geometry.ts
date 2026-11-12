import { getStroke } from 'perfect-freehand';
import type { BoltNode, Point } from 'bolt-flow-core';

export type Sample = [number, number, number];
export type DrawShape = 'pen' | 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'text' | 'comment' | (string & {});
export const shapes: DrawShape[] = ['pen', 'rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'text', 'comment'];
export interface InkSettings { color: string; fill: string; size: number; text: string; fontSize: number; fontFamily: string; smartConnect: boolean; anchorId: string; keepTool: boolean; opacity: number; textColor: string; attachOnShift: boolean }
export const defaultSettings: InkSettings = { color: '#7963d2', fill: 'transparent', size: 3, text: '', fontSize: 22, fontFamily: '"Gochi Hand", cursive', smartConnect: true, anchorId: '', keepTool: false, opacity: 1, textColor: '', attachOnShift: true };

export function inkPath(points: Sample[], size: number): string {
  // Independent polygon tessellation using perfect-freehand's public pressure outline API.
  const outline = getStroke(points, { size, thinning: 0.45, smoothing: 0.65, streamline: 0.45, simulatePressure: false, last: true });
  return outline.length ? `M${outline.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z` : '';
}
export function findFlowNode(nodes: BoltNode[], point: Point, tolerance = 32): BoltNode | undefined {
  return nodes.filter((node) => node.role !== 'annotation' && !node.hidden && !node.locked).map((node) => {
    const dx = Math.max(node.position.x - point.x, 0, point.x - node.position.x - (node.width ?? 240));
    const dy = Math.max(node.position.y - point.y, 0, point.y - node.position.y - (node.height ?? 148));
    return { node, distance: Math.hypot(dx, dy) };
  }).filter(({ distance }) => distance <= tolerance).sort((a, b) => a.distance - b.distance)[0]?.node;
}
export function makeDrawing(shape: DrawShape, samples: Sample[], settings: InkSettings, id: string = crypto.randomUUID()): BoltNode {
  if (!Array.isArray(samples) || !samples.length || samples.some((sample) => !Array.isArray(sample) || sample.length !== 3 || sample.some((n) => !Number.isFinite(n)))) throw new Error('Drawing requires finite x/y/pressure samples.');
  const padding = Math.max(8, settings.size * 2);
  const minX = Math.min(...samples.map(([x]) => x)), minY = Math.min(...samples.map(([, y]) => y));
  const maxX = Math.max(...samples.map(([x]) => x)), maxY = Math.max(...samples.map(([, y]) => y));
  const position = { x: minX - padding, y: minY - padding };
  const text = settings.text.trim() || (shape === 'comment' ? 'A thought to discuss…' : shape === 'text' ? 'Add your thought' : shape);
  const width = shape === 'comment' ? 230 : shape === 'text' ? 240 : Math.max(2 * padding + 1, maxX - minX + 2 * padding);
  const height = shape === 'comment' ? 130 : shape === 'text' ? 80 : Math.max(2 * padding + 1, maxY - minY + 2 * padding);
  return {
    id, type: shape === 'comment' ? 'bolt-comment' : 'bolt-drawing', role: 'annotation', position, width, height, connectable: false, zIndex: shape === 'comment' ? 20 : shape === 'text' ? -1 : 5,
    style: { opacity: settings.opacity },
    data: {
      shape, label: text, color: (shape === 'text' || shape === 'comment') && settings.textColor ? settings.textColor : settings.color, fill: settings.fill, size: settings.size, fontSize: settings.fontSize, fontFamily: settings.fontFamily,
      points: samples.map(([x, y, pressure]) => [x - position.x, y - position.y, pressure]), originalWidth: width, originalHeight: height,
      resolved: false, replies: [],
    },
  };
}
export function getSamples(value: unknown): Sample[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is Sample => Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === 'number' && Number.isFinite(n)));
}
export function findAnchorTarget(nodes: readonly BoltNode[], point: Point, exclude: string[] = [], radius = 140): BoltNode | undefined {
  return nodes.filter(n => !n.hidden && !n.locked && !exclude.includes(n.id)).map(node => {
    const dx = Math.max(node.position.x - point.x, 0, point.x - node.position.x - (node.width ?? 240));
    const dy = Math.max(node.position.y - point.y, 0, point.y - node.position.y - (node.height ?? 100));
    return { node, distance: Math.hypot(dx, dy), area: (node.width ?? 240) * (node.height ?? 100) };
  }).filter(n => n.distance <= radius).sort((a, b) => a.distance - b.distance || a.area - b.area)[0]?.node;
}
export const inkColor = (color: unknown) => color === 'auto' ? 'var(--bolt-ink-auto, #252936)' : String(color ?? '#7963d2');
