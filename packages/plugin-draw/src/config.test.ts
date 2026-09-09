import { expect, it } from 'vitest';
import { BoltRuntime } from '@bolt-flow/core';
import { drawPlugin, defaultFonts, type DrawResult } from './index';

it('registers custom shapes and stores portable fallback geometry with fonts', () => {
  const runtime = new BoltRuntime().use(drawPlugin({
    shapes: [{ id: 'triangle', label: 'Triangle', path: ({ width, height }) => `M${width / 2},8 L${width - 8},${height - 8} L8,${height - 8} Z` }],
    fonts: [{ id: 'brand', label: 'Brand', family: 'Brand Font, serif' }],
  }));
  const result = runtime.execute<unknown, DrawResult>('draw.create', { shape: 'triangle', points: [[0, 0, .5], [100, 80, .5]], settings: { fontFamily: 'Brand Font, serif' } });
  expect(result.kind).toBe('node');
  expect(runtime.getDocument().nodes[0].data).toMatchObject({ shape: 'triangle', label: 'Triangle', customPath: 'M58,8 L108,88 L8,88 Z', fontFamily: 'Brand Font, serif' });
  expect(runtime.getContributions('draw.fonts')).toEqual([[...defaultFonts, { id: 'brand', label: 'Brand', family: 'Brand Font, serif' }]]);
  const serialized = JSON.stringify(runtime.getDocument());
  runtime.remove('draw');
  expect(runtime.getContributions('draw.fonts')).toEqual([]);
  runtime.use(drawPlugin());
  expect(JSON.stringify(runtime.getDocument())).toBe(serialized);
});

it('rejects collisions and invalid registry settings before installation', () => {
  expect(() => new BoltRuntime().use(drawPlugin({ shapes: [{ id: 'pen', label: 'Duplicate', path: () => 'M0,0' }] }))).toThrow(/duplicate/);
  expect(() => new BoltRuntime().use(drawPlugin({ tools: ['not-registered'] }))).toThrow(/Unknown/);
  expect(() => new BoltRuntime().use(drawPlugin({ fonts: [{ id: 'normal', label: 'Duplicate', family: 'serif' }] }))).toThrow(/duplicate/);
});

it('validates generated geometry and styles atomically', () => {
  const runtime = new BoltRuntime().use(drawPlugin({ shapes: [{ id: 'broken', label: 'Broken', path: () => '' }] }));
  expect(() => runtime.execute('draw.create', { shape: 'broken', points: [[0, 0, .5]] })).toThrow(/SVG path/);
  expect(() => runtime.execute('draw.create', { shape: 'text', points: [[0, 0, .5]], settings: { fontFamily: {} } })).toThrow(/style/);
  expect(runtime.getDocument().nodes).toEqual([]);
});