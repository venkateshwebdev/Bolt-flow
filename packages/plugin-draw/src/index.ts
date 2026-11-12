import type { BoltPlugin, BoltNode } from 'bolt-flow-core';
import { createElement } from 'react';
import type { CanvasExtension, NodeTypes } from 'bolt-flow-react';
import { DrawingNode, CommentNode, DrawingOverlay, DrawingTools, AnchorLinks } from './ui';
import { defaultSettings, shapes, makeDrawing, findFlowNode, type DrawShape, type Sample, type InkSettings } from './geometry';
import './style.css';
import { defaultFonts, defaultColors, type DrawFont, type DrawShapeDefinition } from './config';

export interface DrawPluginOptions {
  defaults?: Partial<InkSettings>;
  /** Override the default tool UI entirely, or disable it while keeping pointer tools. */
  toolbar?: CanvasExtension['component'] | false;
  tools?: (DrawShape | 'eraser')[];
  /** Appended to the built-in tools unless `tools` supplies an explicit order/subset. */
  shapes?: DrawShapeDefinition[];
  /** Added to the three built-in presets. Hosts load custom font faces via their CSS. */
  fonts?: DrawFont[];
  colors?: string[];
  /** Set the consumer's custom node type/data when promoting an annotation to a real flow node. */
  toFlowNode?: (annotation: BoltNode) => Pick<BoltNode, 'data' | 'type' | 'width' | 'height'>;
}
export interface DrawCreateInput { shape: DrawShape; points: Sample[]; settings?: Partial<InkSettings> }
export interface DrawResult { id: string; kind: 'node' | 'edge'; connected?: boolean }
export function drawPlugin(options: DrawPluginOptions = {}): BoltPlugin {
  return {
    id: 'draw', name: 'Connected ink', version: '0.1.0',
    setup(ctx) {
      const customShapes = options.shapes ?? [];
      const ids = new Set([...shapes, 'eraser', 'select', 'pan']);
      for (const shape of customShapes) {
        if (!/^[a-z][a-z0-9-]*$/.test(shape.id) || ids.has(shape.id) || !shape.label || typeof shape.path !== 'function') throw new Error('Invalid or duplicate drawing shape.');
        ids.add(shape.id);
      }
      const fonts = [...defaultFonts, ...(options.fonts ?? [])];
      if (new Set(fonts.map((font) => font.id)).size !== fonts.length || fonts.some((font) => !font.id || !font.label || !font.family)) throw new Error('Invalid or duplicate drawing font.');
      const allowed = options.tools ?? [...shapes, ...customShapes.map((shape) => shape.id), 'eraser'];
      if (allowed.some((id) => !ids.has(id) || id === 'select' || id === 'pan') || new Set(allowed).size !== allowed.length) throw new Error('Unknown or duplicate drawing tool.');
      const ui = { allowed, defaults: options.defaults, customShapes, fonts, colors: options.colors ?? defaultColors };
      ctx.contribute<DrawFont[]>('draw.fonts', fonts);
      ctx.contribute<NodeTypes>('canvas.nodeTypes', { 'bolt-drawing': (props) => createElement(DrawingNode, { ...props, customShapes }), 'bolt-comment': CommentNode });
      ctx.contribute<CanvasExtension>('canvas.overlay', { id: 'draw.links', component: AnchorLinks });
      ctx.contribute<CanvasExtension>('canvas.overlay', { id: 'draw', component: (props) => createElement(DrawingOverlay, { ...props, ...ui }) });
      if (options.toolbar !== false) ctx.contribute<CanvasExtension>('canvas.tools', { id: 'draw', component: options.toolbar ?? ((props) => createElement(DrawingTools, { ...props, ...ui })) });
      ctx.registerCommand({ id: 'draw.style', title: 'Style annotation', execute({ id, color, size, opacity }: { id: string; color?: string; size?: number; opacity?: number }) {
        if ((color !== undefined && typeof color !== 'string') || (size !== undefined && (!Number.isFinite(size) || size <= 0 || size > 200)) || (opacity !== undefined && (!Number.isFinite(opacity) || opacity < 0 || opacity > 1))) throw new Error('Invalid annotation style.');
        ctx.updateDocument(doc => {
          const node = doc.nodes.find(n => n.id === id && n.role === 'annotation' && !n.locked);
          if (!node) throw new Error('Select an unlocked annotation.');
          if (color !== undefined) node.data.color = color;
          if (size !== undefined) node.data.size = size;
          if (opacity !== undefined) node.style = { ...node.style, opacity };
        }, { source: 'draw.style', group: `draw.style.${id}` });
      } });
      ctx.registerCommand({ id: 'draw.create', title: 'Create a drawing', execute(input: DrawCreateInput): DrawResult {
        if (!input || input.shape === 'eraser' || !allowed.includes(input.shape)) throw new Error('Unsupported drawing tool.');
        const settings = { ...defaultSettings, ...options.defaults, ...input.settings };
        if (!Number.isFinite(settings.opacity) || settings.opacity < 0 || settings.opacity > 1) throw new Error('Invalid drawing opacity.');
        if (![settings.size, settings.fontSize].every((n) => Number.isFinite(n) && n > 0 && n <= 200)) throw new Error('Invalid drawing size.');
        if (![settings.color, settings.fill, settings.text, settings.fontFamily, settings.anchorId, settings.textColor].every((value) => typeof value === 'string')) throw new Error('Invalid drawing text or style.');
        if (![settings.keepTool, settings.smartConnect, settings.attachOnShift].every((value) => typeof value === 'boolean')) throw new Error('Invalid drawing interaction setting.');
        const node = makeDrawing(input.shape, input.points, settings);
        const custom = customShapes.find((shape) => shape.id === input.shape);
        if (custom) {
          const path = custom.path({ width: node.width!, height: node.height!, size: settings.size });
          if (typeof path !== 'string' || !path.trim()) throw new Error('Custom shape must return an SVG path.');
          node.data.customPath = path;
          node.data.label = settings.text.trim() || custom.label;
        }
        const doc = ctx.getDocument();
        if (input.shape === 'arrow' && settings.smartConnect && input.points.length > 1) {
          const first = input.points[0], last = input.points[input.points.length - 1];
          const source = findFlowNode(doc.nodes, { x: first[0], y: first[1] });
          const target = findFlowNode(doc.nodes, { x: last[0], y: last[1] });
          if (source && target && source.id !== target.id) {
            const existing = doc.edges.find((edge) => edge.source === source.id && edge.target === target.id);
            if (existing) return { id: existing.id, kind: 'edge', connected: true };
            const id = crypto.randomUUID();
            ctx.updateDocument((draft) => { draft.edges.push({ id, source: source.id, target: target.id, type: 'smoothstep', style: { stroke: settings.color, strokeWidth: settings.size }, markerEnd: { type: 'arrowclosed', color: settings.color }, data: { createdWith: 'connected-ink' } }); }, { source: 'draw.connect' });
            return { id, kind: 'edge', connected: true };
          }
        }
        const owner = doc.nodes.find((item) => item.id === settings.anchorId && !item.hidden && !item.locked);
        if (owner) node.anchor = { nodeId: owner.id, offset: { x: node.position.x - owner.position.x, y: node.position.y - owner.position.y } };
        ctx.updateDocument((draft) => { draft.nodes.push(node); }, { source: 'draw.create' });
        return { id: node.id, kind: 'node' };
      } });
      ctx.registerCommand({ id: 'draw.attach', title: 'Attach annotation', execute({ id, ownerId }: { id: string; ownerId: string }) {
        ctx.updateDocument((draft) => {
          const node = draft.nodes.find((n) => n.id === id && n.role === 'annotation' && !n.locked);
          const owner = draft.nodes.find((n) => n.id === ownerId && n.id !== id && !n.hidden && !n.locked);
          if (!node || !owner) throw new Error('Choose an unlocked annotation and an attachment target.');
          node.anchor = { nodeId: owner.id, offset: { x: node.position.x - owner.position.x, y: node.position.y - owner.position.y } };
        }, { source: 'draw.attach' });
      } });
      ctx.registerCommand({ id: 'draw.detach', title: 'Detach annotation', execute(id: string) {
        ctx.updateDocument((draft) => { const node = draft.nodes.find((n) => n.id === id && !n.locked); if (node) delete node.anchor; }, { source: 'draw.detach' });
      } });
      ctx.registerCommand({ id: 'draw.resolve', title: 'Resolve or reopen comment', execute(id: string) {
        ctx.updateDocument((draft) => { const node = draft.nodes.find((n) => n.id === id && n.type === 'bolt-comment' && !n.locked); if (node) node.data.resolved = !node.data.resolved; }, { source: 'draw.resolve' });
      } });
      ctx.registerCommand({ id: 'draw.reply', title: 'Reply to comment', execute({ id, text }: { id: string; text: string }) {
        if (!text?.trim()) throw new Error('Write a reply first.');
        ctx.updateDocument((draft) => {
          const node = draft.nodes.find((n) => n.id === id && n.type === 'bolt-comment' && !n.locked);
          if (!node) throw new Error('Comment not found.');
          node.data.replies = [...(Array.isArray(node.data.replies) ? node.data.replies : []), { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString() }];
        }, { source: 'draw.reply' });
      } });
      ctx.registerCommand({ id: 'draw.convert', title: 'Promote sketch to flow node', execute(id: string) {
        ctx.updateDocument((draft) => {
          const node = draft.nodes.find((n) => n.id === id && n.role === 'annotation' && !n.locked);
          if (!node) throw new Error('Select a drawing or comment to promote.');
          const converted = options.toFlowNode?.(node) ?? { type: 'default', data: { label: String(node.data.label ?? 'New step') }, width: 220, height: 120 };
          Object.assign(node, converted, { role: 'node', connectable: true, zIndex: 0 });
          delete node.anchor;
        }, { source: 'draw.convert' });
      } });
      ctx.registerCommand({ id: 'draw.erase', title: 'Erase annotation', execute(id: string) {
        if (!allowed.includes('eraser')) throw new Error('Eraser is disabled.');
        ctx.updateDocument((draft) => {
          draft.nodes = draft.nodes.filter((node) => !(node.id === id && node.role === 'annotation' && !node.locked && !node.hidden));
          const ids = new Set(draft.nodes.map((node) => node.id));
          draft.edges = draft.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
        }, { source: 'draw.erase', group: 'draw.erase' });
      } });
    },
  };
}
export { inkPath, makeDrawing, findFlowNode, defaultSettings } from './geometry';
export type { DrawShape, InkSettings, Sample } from './geometry';
export { defaultFonts, defaultColors } from './config';
export type { DrawFont, DrawShapeDefinition, DrawShapeGeometry, DrawShapeRenderProps } from './config';
export * from './rich-text';
export { importWorkflowCanvas } from './workflow-import';
