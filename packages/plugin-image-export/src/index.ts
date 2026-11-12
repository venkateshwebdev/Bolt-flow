import type { BoltDocument, BoltPlugin } from 'bolt-flow-core';
import { toCanvas, getFontEmbedCSS } from 'html-to-image';
export interface ImageExportOptions {
  includeAnnotations?: boolean;
  selectedIds?: string[];
  background?: string;
  grid?: 'none' | 'dots' | 'lines';
  gridColor?: string;
  padding?: number;
  scale?: number;
  maxDimension?: number;
  fileName?: string;
}
export function exportBounds(document: BoltDocument, options: ImageExportOptions = {}) {
  const nodes = document.nodes.filter(n => !n.hidden && (options.includeAnnotations !== false || n.role !== 'annotation') && (!options.selectedIds?.length || options.selectedIds.includes(n.id)));
  if (!nodes.length) throw new Error('There are no visible objects to export.');
  const padding = options.padding ?? 40, scale = options.scale ?? 2, max = options.maxDimension ?? 8192;
  if (![padding, scale, max].every(Number.isFinite) || padding < 0 || scale <= 0 || max <= 0) throw new Error('Invalid export dimensions.');
  const ids = new Set(nodes.map(n => n.id));
  const route = document.edges.filter(edge => edge.type === 'bolt-waypoint' && ids.has(edge.source) && ids.has(edge.target)).flatMap(edge => Array.isArray(edge.data?.points) ? edge.data.points : []).flatMap(point =>
    point && typeof point === 'object' && !Array.isArray(point) && typeof point.x === 'number' && typeof point.y === 'number' && Number.isFinite(point.x) && Number.isFinite(point.y) ? [{ x: point.x, y: point.y }] : []);
  const x = Math.min(...nodes.map(n => n.position.x), ...route.map(p => p.x)), y = Math.min(...nodes.map(n => n.position.y), ...route.map(p => p.y));
  const width = Math.ceil(Math.max(...nodes.map(n => n.position.x + (n.width ?? 240)), ...route.map(p => p.x)) - x + padding * 2);
  const height = Math.ceil(Math.max(...nodes.map(n => n.position.y + (n.height ?? 100)), ...route.map(p => p.y)) - y + padding * 2);
  if (width * scale > max || height * scale > max) throw new Error(`Export exceeds ${max}px. Reduce scale or export a selection.`);
  return { x, y, width, height, padding, scale, ids };
}
/** Capture a cloned viewport; the user's zoom, pan and selection are never mutated. */
export async function canvasToPng(element: HTMLElement, document: BoltDocument, options: ImageExportOptions = {}): Promise<Blob> {
  const viewport = element.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) throw new Error('A mounted Bolt canvas is required.');
  const bounds = exportBounds(document, options);
  await globalThis.document.fonts.ready;
  await Promise.all([...viewport.querySelectorAll('img')].filter(img => {
    const owner = img.closest<HTMLElement>('.react-flow__node'); return !owner || bounds.ids.has(owner.dataset.id ?? '');
  }).map(async img => { await img.decode(); if (!img.naturalWidth) throw new Error(`Image could not be loaded: ${img.alt || img.src}`); }));
  const includedEdges = new Set(document.edges.filter(e => bounds.ids.has(e.source) && bounds.ids.has(e.target)).map(e => e.id));
  const fontEmbedCSS = await getFontEmbedCSS(viewport);
  const rendered = await toCanvas(viewport, {
    width: bounds.width, height: bounds.height, pixelRatio: bounds.scale, fontEmbedCSS,
    style: { transform: `translate(${bounds.padding - bounds.x}px, ${bounds.padding - bounds.y}px) scale(1)`, transformOrigin: '0 0' },
    filter: node => {
      if (!(node instanceof Element)) return true;
      if (node.matches('.react-flow__resize-control,.bolt-annotation-actions,.bolt-text-formatting,.bolt-anchor-badge,.bolt-waypoint,.react-flow__handle,.react-flow__selection,.react-flow__nodesselection')) return false;
      if (node.matches('.react-flow__node')) return bounds.ids.has((node as HTMLElement).dataset.id ?? '');
      if (node.matches('.react-flow__edge')) return includedEdges.has((node as HTMLElement).dataset.id ?? '');
      return true;
    },
  });
  const output = globalThis.document.createElement('canvas'); output.width = rendered.width; output.height = rendered.height;
  const ctx = output.getContext('2d'); if (!ctx) throw new Error('Canvas export is unavailable.');
  ctx.fillStyle = options.background ?? '#ffffff'; ctx.fillRect(0, 0, output.width, output.height);
  const spacing = 22 * bounds.scale;
  if (options.grid && options.grid !== 'none') {
    ctx.fillStyle = ctx.strokeStyle = options.gridColor ?? '#e4e4eb'; ctx.lineWidth = bounds.scale / 2;
    for (let x = 0; x < output.width; x += spacing) for (let y = 0; y < output.height; y += spacing) {
      if (options.grid === 'dots') ctx.fillRect(x, y, bounds.scale, bounds.scale);
    }
    if (options.grid === 'lines') {
      ctx.beginPath(); for (let x = 0; x < output.width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, output.height); }
      for (let y = 0; y < output.height; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(output.width, y); } ctx.stroke();
    }
  }
  ctx.drawImage(rendered, 0, 0);
  return new Promise((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'));
}
export async function downloadCanvasPng(element: HTMLElement, document: BoltDocument, options: ImageExportOptions = {}): Promise<void> {
  const blob = await canvasToPng(element, document, options), url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a'); anchor.href = url; anchor.download = options.fileName ?? `${document.name.replace(/[^a-z0-9_-]/gi, '-') || 'canvas'}.png`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function imageExportPlugin({ getElement, defaults }: { getElement: () => HTMLElement | null; defaults?: ImageExportOptions }): BoltPlugin {
  return { id: 'image-export', name: 'Canvas image export', version: '0.1.0', setup(ctx) {
    ctx.registerCommand({ id: 'export.png', title: 'Export canvas as PNG', execute: async (options?: ImageExportOptions) => {
      const element = getElement(); if (!element) throw new Error('Canvas is not mounted.');
      await downloadCanvasPng(element, ctx.getDocument(), { ...defaults, ...options });
    } });
  } };
}
