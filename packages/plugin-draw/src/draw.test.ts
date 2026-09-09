import { describe, expect, it } from 'vitest';
import { BoltRuntime, createDocument, validateDocument } from '@bolt-flow/core';
import { drawPlugin, type DrawResult } from './index';
import { defaultSettings, inkPath, makeDrawing } from './geometry';
import { historyPlugin } from '../../plugin-history/src/index';
import { layoutPlugin } from '../../plugin-layout/src/index';

const document = () => createDocument({ nodes: [
  { id: 'a', position: { x: 0, y: 0 }, width: 200, height: 100, data: { label: 'Start' } },
  { id: 'b', position: { x: 500, y: 100 }, width: 200, height: 100, data: { label: 'End' } },
] });
const setup = () => new BoltRuntime(document()).use(historyPlugin()).use(drawPlugin());
describe('native connected ink', () => {
  it('normalizes negative coordinates and pressure without losing world position', () => {
    const node = makeDrawing('pen', [[-100, -40, 0.2], [-50, -20, 0.8]], defaultSettings, 'ink');
    expect(node.role).toBe('annotation');
    expect(node.position.x).toBeLessThan(-100);
    const points = node.data.points as number[][];
    expect(points[0][0] + node.position.x).toBe(-100);
    expect(points[1][2]).toBe(0.8);
    expect(inkPath([[0, 0, 0.5]], 4)).toMatch(/^M.*Z$/);
  });
  it('supports all primitive tools and rejects malformed samples', () => {
    for (const shape of ['pen', 'rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'text', 'comment'] as const) {
      const node = makeDrawing(shape, [[40, 50, 0.5], [10, 20, 0.5]], defaultSettings);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
    expect(() => makeDrawing('pen', [], defaultSettings)).toThrow();
    expect(() => makeDrawing('pen', [[NaN, 0, 1]], defaultSettings)).toThrow();
  });
  it('creates real edges from smart arrows and prevents duplicates', () => {
    const runtime = setup();
    const input = { shape: 'arrow', points: [[100, 50, 0.5], [550, 150, 0.5]], settings: { color: '#112233', size: 4 } };
    const result = runtime.execute<unknown, DrawResult>('draw.create', input);
    expect(result).toMatchObject({ kind: 'edge', connected: true });
    expect(runtime.getDocument().edges[0]).toMatchObject({ source: 'a', target: 'b', style: { stroke: '#112233', strokeWidth: 4 } });
    runtime.execute('draw.create', input);
    expect(runtime.getDocument().edges).toHaveLength(1);
    runtime.execute('history.undo');
    expect(runtime.getDocument().edges).toHaveLength(0);
  });
  it('keeps arrows as annotations when snapping is disabled or endpoints miss nodes', () => {
    const runtime = setup();
    runtime.execute('draw.create', { shape: 'arrow', points: [[100, 50, 0.5], [550, 150, 0.5]], settings: { smartConnect: false } });
    expect(runtime.getDocument().edges).toHaveLength(0);
    expect(runtime.getDocument().nodes[2].data.shape).toBe('arrow');
  });
  it('moves attached comments atomically and undoes owner and comment together', () => {
    const runtime = setup();
    const result = runtime.execute<unknown, DrawResult>('draw.create', { shape: 'comment', points: [[30, 160, 0.5]], settings: { anchorId: 'a', text: 'Review this' } });
    const before = structuredClone(runtime.getDocument());
    runtime.updateDocument((draft) => { draft.nodes[0].position = { x: 120, y: 250 }; });
    expect(runtime.getDocument().nodes[2].position).toEqual({ x: before.nodes[2].position.x + 120, y: before.nodes[2].position.y + 250 });
    runtime.execute('history.undo');
    expect(runtime.getDocument()).toEqual(before);
    runtime.execute('draw.detach', result.id);
    expect(runtime.getDocument().nodes[2].anchor).toBeUndefined();
  });
  it('excludes ink from layout but carries attached ink with its owner', () => {
    const runtime = setup().use(layoutPlugin());
    runtime.execute('draw.create', { shape: 'pen', points: [[-80, 100, 0.5]], settings: { anchorId: 'a' } });
    runtime.execute('draw.create', { shape: 'rectangle', points: [[900, 900, 0.5], [1000, 1000, 0.5]] });
    const freePosition = runtime.getDocument().nodes[3].position;
    runtime.execute('layout.arrange');
    const [owner, , attached, free] = runtime.getDocument().nodes;
    expect(attached.position.x).toBe(owner.position.x + attached.anchor!.offset.x);
    expect(free.position).toEqual(freePosition);
  });
  it('detaches annotations without deleting discussions when an owner is deleted', () => {
    const runtime = setup();
    runtime.execute('draw.create', { shape: 'comment', points: [[0, 200, 0.5]], settings: { anchorId: 'a' } });
    const before = runtime.getDocument().nodes[2].position;
    runtime.updateDocument((draft) => { draft.nodes = draft.nodes.filter((node) => node.id !== 'a'); });
    expect(runtime.getDocument().nodes[1].anchor).toBeUndefined();
    expect(runtime.getDocument().nodes[1].position).toEqual(before);
  });
  it('supports replies, resolution, and promotion into a custom flow renderer', () => {
    const runtime = new BoltRuntime(document()).use(drawPlugin({ toFlowNode: (node) => ({ type: 'custom', data: { label: node.data.label }, width: 250, height: 150 }) }));
    const { id } = runtime.execute<unknown, DrawResult>('draw.create', { shape: 'comment', points: [[0, 200, 0.5]], settings: { text: 'Add validation' } });
    runtime.execute('draw.reply', { id, text: 'Agreed' });
    runtime.execute('draw.resolve', id);
    expect(runtime.getDocument().nodes[2].data.replies).toHaveLength(1);
    expect(runtime.getDocument().nodes[2].data.resolved).toBe(true);
    runtime.execute('draw.convert', id);
    expect(runtime.getDocument().nodes[2]).toMatchObject({ id, type: 'custom', role: 'node', connectable: true, data: { label: 'Add validation' } });
  });
  it('unloads tools and commands while retaining serialized drawings', () => {
    const runtime = setup();
    runtime.execute('draw.create', { shape: 'pen', points: [[10, 10, 0.5]] });
    runtime.remove('draw');
    expect(runtime.getContributions('canvas.nodeTypes')).toEqual([]);
    expect(runtime.getContributions('canvas.overlay')).toEqual([]);
    expect(runtime.hasCommand('draw.create')).toBe(false);
    expect(runtime.getDocument().nodes).toHaveLength(3);
  });
  it('rejects invalid anchor references and cyclic attachments on import', () => {
    const doc = document();
    doc.nodes[0].anchor = { nodeId: 'missing', offset: { x: 0, y: 0 } };
    expect(() => validateDocument(doc)).toThrow(/anchor/);
    doc.nodes[0].anchor.nodeId = 'b';
    doc.nodes[1].anchor = { nodeId: 'a', offset: { x: 0, y: 0 } };
    expect(() => validateDocument(doc)).toThrow(/anchor/);
  });
  it('honors restricted tool configuration and validates stroke widths', () => {
    const runtime = new BoltRuntime().use(drawPlugin({ tools: ['pen'] }));
    expect(() => runtime.execute('draw.create', { shape: 'rectangle', points: [[0, 0, 0.5]] })).toThrow(/Unsupported/);
    expect(() => runtime.execute('draw.create', { shape: 'pen', points: [[0, 0, 0.5]], settings: { size: -3 } })).toThrow(/size/);
  });
});