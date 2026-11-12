import { describe, expect, it } from 'vitest';
import { createDocument, parseCanvas, serializeCanvas } from 'bolt-flow-core';
import { importWorkflowCanvas } from './workflow-import';
describe('workflow canvas import', () => {
  it('maps parent-relative chains, dimensions, grouping, theme color and strokes', () => {
    const graph = createDocument({ nodes: [{ id: 'step', position: { x: 0, y: 0 }, data: { action: 'keep this' } }] });
    const { document, warnings } = importWorkflowCanvas(graph, { version: 1, nodes: { step: { x: 100, y: 200 } }, annotations: [
      { id: 'text', type: 'text', parentId: 'arrow', position: { x: 10, y: 20 }, data: { text: 'Hello', annotationGroup: 'group', locked: true } },
      { id: 'arrow', type: 'freehand', parentId: 'step', position: { x: 30, y: 40 }, width: 150, height: 80, data: { shape: 'arrow', points: [[0, 0, .5], [100, 50, .5]], initialSize: { width: 100, height: 50 }, color: 'auto', opacity: .5 } },
    ] });
    expect(warnings).toEqual([]);
    expect(document.nodes[1]).toMatchObject({ position: { x: 140, y: 260 }, locked: true, groupId: 'group' });
    expect(document.nodes[2]).toMatchObject({ data: { customPath: 'M0,0L100,50', color: 'auto', originalWidth: 100 }, style: { opacity: .5 } });
    expect(parseCanvas(serializeCanvas(document))).toEqual(document);
    expect(document.nodes[0].data.action).toBe('keep this');
  });
  it('reports unavailable owners and rejects cyclic chains', () => {
    const annotation = { id: 'note', type: 'text', position: { x: 1, y: 2 }, parentId: 'missing', data: {} };
    expect(importWorkflowCanvas(createDocument(), { version: 1, annotations: [annotation] }).warnings).toHaveLength(1);
    expect(() => importWorkflowCanvas(createDocument(), { version: 1, annotations: [{ ...annotation, parentId: 'note' }] })).toThrow(/Cyclic/);
  });
});
