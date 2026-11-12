import { validateDocument, type BoltDocument, type BoltNode, type BoltEdge, type Json } from './index';
import { translateEdgeRoute } from './operations';

export const DEFAULT_MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export function serializeCanvas(document: BoltDocument, pretty = true): string {
  return JSON.stringify(validateDocument(document), null, pretty ? 2 : undefined);
}
export function parseCanvas(input: string, maxBytes = DEFAULT_MAX_IMPORT_BYTES): BoltDocument {
  if (typeof input !== 'string' || !Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error('Invalid JSON input or import limit.');
  if (new TextEncoder().encode(input).length > maxBytes) throw new Error('This document exceeds the configured import size limit.');
  return validateDocument(JSON.parse(input));
}
export interface CanvasPresentation {
  version: 2;
  nodes: Record<string, { position: { x: number; y: number }; width?: number; height?: number; style?: BoltNode['style']; className?: string; hidden?: boolean; locked?: boolean; groupId?: string; zIndex?: number }>;
  edges: Record<string, Pick<BoltEdge, 'type' | 'style' | 'labelStyle' | 'labelBgStyle' | 'markerStart' | 'markerEnd'> & { points?: Json }>;
  annotations: BoltNode[];
  extensions: Record<string, Json>;
  view?: BoltDocument['view'];
}
/** Presentation-only projection: executable node/edge data belongs to the host. */
export function captureCanvas(document: BoltDocument): CanvasPresentation {
  const doc = validateDocument(document);
  const result: CanvasPresentation = { version: 2, nodes: Object.create(null), edges: Object.create(null), annotations: [], extensions: doc.extensions };
  if (doc.view) result.view = doc.view;
  for (const n of doc.nodes) {
    if (n.role === 'annotation') { result.annotations.push(n); continue; }
    const { position, width, height, style, className, hidden, locked, groupId, zIndex } = n;
    result.nodes[n.id] = JSON.parse(JSON.stringify({ position, width, height, style, className, hidden, locked, groupId, zIndex }));
  }
  for (const e of doc.edges) {
    const { type, style, labelStyle, labelBgStyle, markerStart, markerEnd } = e;
    result.edges[e.id] = JSON.parse(JSON.stringify({ type, style, labelStyle, labelBgStyle, markerStart, markerEnd, points: e.data?.points }));
  }
  return result;
}
export function applyCanvas(graph: BoltDocument, presentation: CanvasPresentation): { document: BoltDocument; warnings: string[] } {
  if (presentation?.version !== 2 || !presentation.nodes || !presentation.edges || !Array.isArray(presentation.annotations)) throw new Error('Invalid canvas presentation.');
  const doc = validateDocument(graph), warnings: string[] = [];
  const nodes = new Map(doc.nodes.map(n => [n.id, n]));
  for (const [id, layout] of Object.entries(presentation.nodes)) {
    const node = nodes.get(id);
    if (node && node.role !== 'annotation') {
      // Explicitly whitelist presentation fields: never assign host data or IDs.
      for (const key of ['position', 'width', 'height', 'style', 'className', 'hidden', 'locked', 'groupId', 'zIndex'] as const) {
        if (layout[key] !== undefined) Object.assign(node, { [key]: structuredClone(layout[key]) });
      }
    } else warnings.push(`Missing workflow node: ${id}`);
  }
  for (const annotation of presentation.annotations) {
    if (annotation.role !== 'annotation') throw new Error('Presentation contains a non-annotation node.');
    if (nodes.has(annotation.id)) { warnings.push(`Annotation ID collision: ${annotation.id}`); continue; }
    const copy = structuredClone(annotation); doc.nodes.push(copy); nodes.set(copy.id, copy);
  }
  for (const n of doc.nodes) if (n.anchor && !nodes.has(n.anchor.nodeId)) { warnings.push(`Detached ${n.id}: missing owner ${n.anchor.nodeId}`); delete n.anchor; }
  for (const [id, saved] of Object.entries(presentation.edges)) {
    const edge = doc.edges.find(e => e.id === id);
    if (!edge) { warnings.push(`Missing workflow edge: ${id}`); continue; }
    for (const key of ['type', 'style', 'labelStyle', 'labelBgStyle', 'markerStart', 'markerEnd'] as const) if (saved[key] !== undefined) Object.assign(edge, { [key]: structuredClone(saved[key]) });
    if (saved.points !== undefined) edge.data = { ...edge.data, points: structuredClone(saved.points) };
  }
  doc.extensions = { ...doc.extensions, ...structuredClone(presentation.extensions) };
  if (presentation.view) doc.view = structuredClone(presentation.view);
  return { document: validateDocument(doc), warnings };
}

/** Insert generated/imported objects with fresh IDs, preserving internal edges and anchors. */
export function insertCanvas(target: BoltDocument, incoming: BoltDocument, offset = { x: 40, y: 40 }): { document: BoltDocument; insertedIds: string[] } {
  const document = validateDocument(target), source = validateDocument(incoming);
  const ids = new Map(source.nodes.map(n => [n.id, crypto.randomUUID()])), groups = new Map<string, string>();
  const nodes = source.nodes.map(n => {
    const copy = structuredClone(n); copy.id = ids.get(n.id)!;
    copy.position = { x: n.position.x + offset.x, y: n.position.y + offset.y };
    if (copy.anchor) copy.anchor.nodeId = ids.get(copy.anchor.nodeId)!;
    if (copy.groupId) { if (!groups.has(copy.groupId)) groups.set(copy.groupId, crypto.randomUUID()); copy.groupId = groups.get(copy.groupId)!; }
    return copy;
  });
  document.nodes.push(...nodes);
  document.edges.push(...source.edges.map(e => ({ ...translateEdgeRoute(e, offset), id: crypto.randomUUID(), source: ids.get(e.source)!, target: ids.get(e.target)! })));
  return { document: validateDocument(document), insertedIds: nodes.map(n => n.id) };
}
