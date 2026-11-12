import { describe, expect, it } from 'vitest';
import { createDocument } from 'bolt-flow-core';
import { exportBounds } from './index';
describe('full canvas image bounds', () => {
  it('includes off-screen content and excludes hidden layers', () => {
    const document = createDocument({ nodes: [
      { id: 'a', position: { x: -100, y: -50 }, width: 200, height: 100, data: {} },
      { id: 'b', position: { x: 2000, y: 1000 }, width: 100, height: 100, role: 'annotation', data: {} },
      { id: 'hidden', position: { x: 99999, y: 0 }, hidden: true, data: {} },
    ] });
    expect(exportBounds(document)).toMatchObject({ x: -100, y: -50, width: 2280, height: 1230 });
    expect(exportBounds(document, { includeAnnotations: false }).ids).toEqual(new Set(['a']));
    expect(() => exportBounds(document, { scale: 20 })).toThrow(/exceeds/);
  });
});
