import { describe, it, expect } from 'vitest';
import { BoltRuntime, createDocument } from '@bolt-flow/core';
import { layoutPlugin } from './index';

describe('layout plugin', () => {
  it('arranges connected nodes horizontally and vertically without changing graph data', () => {
    const runtime = new BoltRuntime(createDocument({ nodes: [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'b', position: { x: 0, y: 0 }, data: { label: 'B' } },
    ], edges: [{ id: 'e', source: 'a', target: 'b' }] })).use(layoutPlugin());
    runtime.execute('layout.arrange');
    let [a, b] = runtime.getDocument().nodes;
    expect(b.position.x).toBeGreaterThan(a.position.x);
    runtime.execute('layout.arrange', { direction: 'TB' });
    [a, b] = runtime.getDocument().nodes;
    expect(b.position.y).toBeGreaterThan(a.position.y);
    expect(a.data.label).toBe('A');
    expect(runtime.getDocument().edges).toHaveLength(1);
  });
  it('handles an empty canvas', () => {
    expect(() => new BoltRuntime().use(layoutPlugin()).execute('layout.arrange')).not.toThrow();
  });
});