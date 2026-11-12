import { expect, it } from 'vitest';
import { createDocument } from 'bolt-flow-core';
import { exportBounds } from './index';

it('includes outlying route points only when both connected nodes are exported', () => {
  const doc = createDocument({ nodes: [
    { id: 'a', position: { x: 0, y: 0 }, width: 100, height: 100, data: {} },
    { id: 'b', position: { x: 200, y: 0 }, width: 100, height: 100, data: {} },
    { id: 'hidden', hidden: true, position: { x: -5000, y: -5000 }, data: {} },
  ], edges: [{ id: 'route', source: 'a', target: 'b', type: 'bolt-waypoint', data: { points: [{ x: 150, y: -500 }] } }] });
  expect(exportBounds(doc)).toMatchObject({ x: 0, y: -500, width: 380, height: 680 });
  expect(exportBounds(doc, { selectedIds: ['a'] })).toMatchObject({ x: 0, y: 0, width: 180, height: 180 });
  expect(() => exportBounds(doc, { maxDimension: 100 })).toThrow('Reduce scale');
});
