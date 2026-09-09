import { describe, expect, it } from 'vitest';
import { BoltRuntime, createDocument } from '@bolt-flow/core';
import { exportPlugin } from './index';

describe('document exchange', () => {
  it('round-trips graph and drawing extension data without optional plugins', () => {
    const document = createDocument({ name: 'Portable', extensions: { excalidraw: { elements: [], files: {}, background: '#fff' } } });
    const source = new BoltRuntime(document).use(exportPlugin());
    const target = new BoltRuntime().use(exportPlugin());
    target.execute('import.json', source.execute('export.json'));
    expect(target.getDocument()).toEqual(document);
  });
  it('rejects malformed or oversized imports atomically', () => {
    const runtime = new BoltRuntime().use(exportPlugin({ maxImportBytes: 200 }));
    expect(() => runtime.execute('import.json', 'x'.repeat(201))).toThrow(/size limit/);
    expect(() => runtime.execute('import.json', '{}')).toThrow(/Invalid/);
    expect(runtime.getDocument().name).toBe('Untitled canvas');
  });
});