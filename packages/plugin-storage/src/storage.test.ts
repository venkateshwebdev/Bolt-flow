import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoltRuntime, createDocument } from '@bolt-flow/core';
import { storagePlugin } from './index';

afterEach(() => vi.useRealTimers());
describe('storage plugin', () => {
  it('restores and debounces writes through an injected adapter', () => {
    vi.useFakeTimers();
    const storage = { getItem: () => JSON.stringify(createDocument({ name: 'Saved' })), setItem: vi.fn() };
    const runtime = new BoltRuntime().use(storagePlugin({ storage, debounce: 100 }));
    expect(runtime.getDocument().name).toBe('Saved');
    runtime.updateDocument((doc) => { doc.name = 'A'; });
    runtime.updateDocument((doc) => { doc.name = 'B'; });
    expect(storage.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(JSON.parse(storage.setItem.mock.calls[0][1]).name).toBe('B');
    runtime.dispose();
  });
  it('keeps the current canvas when saved data is corrupt', () => {
    const onError = vi.fn();
    const runtime = new BoltRuntime().use(storagePlugin({ storage: { getItem: () => '{broken', setItem() {} }, onError }));
    expect(runtime.getDocument().name).toBe('Untitled canvas');
    expect(onError).toHaveBeenCalledOnce();
    runtime.dispose();
  });
  it('reports quota errors instead of crashing the document store', () => {
    const onError = vi.fn();
    const runtime = new BoltRuntime().use(storagePlugin({ storage: { getItem: () => null, setItem() { throw new Error('Quota exceeded'); } }, onError }));
    expect(runtime.execute('storage.save')).toBe(false);
    expect(runtime.execute('storage.status')).toEqual({ savedAt: null, error: 'Quota exceeded' });
    runtime.dispose();
  });
});