import { validateDocument, type BoltDocument, type BoltNode, type Json } from 'bolt-flow-core';
import { defaultSettings, getSamples } from './geometry';
import { normalizeRichText, richTextFromHtml, richTextPlain, type RichText } from './rich-text';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
/** Import the reference workflow's canvas v1, using the host's existing graph IDs. */
export function importWorkflowCanvas(graph: BoltDocument, input: unknown, options: { convertHtml?: (html: string) => RichText } = {}): { document: BoltDocument; warnings: string[] } {
  const canvas = record(input);
  if (canvas.version !== 1) throw new Error('Expected workflow canvas version 1.');
  const document = validateDocument(graph), warnings: string[] = [];
  const byId = new Map(document.nodes.map(n => [n.id, n]));
  for (const [id, value] of Object.entries(record(canvas.nodes))) {
    const node = byId.get(id), saved = record(value);
    if (!node) { warnings.push(`Missing workflow node: ${id}`); continue; }
    node.position = { x: finite(saved.x, node.position.x), y: finite(saved.y, node.position.y) };
    if (typeof saved.width === 'number' && saved.width > 0) node.width = saved.width;
    if (typeof saved.height === 'number' && saved.height > 0) node.height = saved.height;
  }
  for (const [id, value] of Object.entries(record(canvas.edges))) {
    const edge = document.edges.find(e => e.id === id), saved = record(value);
    if (!edge) { warnings.push(`Missing workflow edge: ${id}`); continue; }
    if (saved.points !== undefined) edge.data = { ...edge.data, points: saved.points as Json };
    if (typeof saved.type === 'string') edge.type = saved.type;
  }
  if (canvas.annotations !== undefined && !Array.isArray(canvas.annotations)) throw new Error('Invalid workflow annotations.');
  const parents = new Map<string, string>();
  for (const raw of (canvas.annotations ?? []) as unknown[]) {
    const saved = record(raw), data = record(saved.data), position = record(saved.position), initial = record(data.initialSize);
    if (typeof saved.id !== 'string' || !saved.id || !['freehand', 'text'].includes(String(saved.type))) throw new Error('Invalid workflow annotation.');
    if (byId.has(saved.id)) throw new Error(`Annotation ID collision: ${saved.id}`);
    const isText = saved.type === 'text', width = finite(saved.width, isText ? 240 : 100), height = finite(saved.height, isText ? 80 : 100);
    const points = getSamples(data.points);
    let richText = normalizeRichText(undefined, String(data.text ?? ''));
    if (isText && typeof data.textHtml === 'string') {
      const convert = options.convertHtml ?? (typeof globalThis.document !== 'undefined' ? richTextFromHtml : undefined);
      if (convert) richText = normalizeRichText(convert(data.textHtml)); else warnings.push(`Plain-text fallback used for ${saved.id}; supply convertHtml to preserve formatting.`);
    }
    const node: BoltNode = { id: saved.id, role: 'annotation', type: 'bolt-drawing', position: { x: finite(position.x, 0), y: finite(position.y, 0) }, width, height, connectable: false, zIndex: isText ? 0 : 5,
      data: { shape: isText ? 'text' : data.shape ? 'reference-stroke' : 'pen', label: isText ? richTextPlain(richText) : String(data.title ?? 'Drawing'), color: typeof data.color === 'string' ? data.color : 'auto', fill: 'none', size: finite(data.strokeWidth, 3), fontSize: 22, fontFamily: defaultSettings.fontFamily, points, originalWidth: finite(initial.width, width), originalHeight: finite(initial.height, height) },
      style: { opacity: finite(data.opacity, 1) }, hidden: data.annotationHidden === true, locked: data.locked === true,
    };
    if (isText) node.data.richText = richText as unknown as Json;
    if (data.shape && points.length) node.data.customPath = `M${points.map(([x, y]) => `${x},${y}`).join('L')}`;
    if (typeof data.annotationGroup === 'string' && data.annotationGroup) node.groupId = data.annotationGroup;
    if (typeof saved.parentId === 'string') parents.set(node.id, saved.parentId);
    byId.set(node.id, node); document.nodes.push(node);
  }
  const done = new Set<string>(), visiting = new Set<string>();
  const resolve = (node: BoltNode): void => {
    if (done.has(node.id)) return;
    if (visiting.has(node.id)) throw new Error('Cyclic workflow annotation anchor.');
    visiting.add(node.id);
    const parentId = parents.get(node.id), parent = parentId && byId.get(parentId);
    if (parent) { resolve(parent); const offset = { ...node.position }; node.position = { x: parent.position.x + offset.x, y: parent.position.y + offset.y }; node.anchor = { nodeId: parent.id, offset }; }
    else if (parentId) warnings.push(`Detached ${node.id}: missing owner ${parentId}`);
    visiting.delete(node.id); done.add(node.id);
  };
  document.nodes.forEach(resolve);
  if (canvas.viewport) document.view = canvas.viewport as BoltDocument['view'];
  return { document: validateDocument(document), warnings };
}
