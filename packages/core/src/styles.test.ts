import { it, expect } from 'vitest';
import { createDocument, validateDocument } from './index';

it('round-trips node styles, edge styles, explicit marker overrides and custom renderer metadata', () => {
  const doc = createDocument({ nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: {}, style: { backgroundColor: '#fff', borderRadius: 20 }, className: 'custom', draggable: false }], edges: [
    { id: 'loop', source: 'a', target: 'a', style: { stroke: '#123456', strokeWidth: 4, strokeDasharray: '7 5' }, labelStyle: { fill: '#654321' }, markerEnd: false, animated: true, data: { custom: 'metadata' } },
  ] });
  expect(validateDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
});
it('rejects unsafe style values and malformed marker definitions', () => {
  const doc = createDocument({ nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: {} }] });
  expect(() => validateDocument({ ...doc, nodes: [{ ...doc.nodes[0], style: { opacity: {} } }] })).toThrow();
  expect(() => validateDocument({ ...doc, edges: [{ id: 'e', source: 'a', target: 'a', markerEnd: { type: 'unknown' } }] })).toThrow();
});