import { describe, it, expect } from 'vitest';
import { BoltRuntime } from '@bolt-flow/core';
import { historyPlugin } from './index';

describe('history plugin', () => {
  it('undoes and redoes document edits', () => {
    const runtime = new BoltRuntime().use(historyPlugin());
    runtime.updateDocument((doc) => { doc.name = 'Changed'; });
    expect(runtime.execute('history.undo')).toBe(true);
    expect(runtime.getDocument().name).toBe('Untitled canvas');
    runtime.execute('history.redo');
    expect(runtime.getDocument().name).toBe('Changed');
  });
  it('coalesces grouped edits and clears redo after a new branch', () => {
    const runtime = new BoltRuntime().use(historyPlugin());
    runtime.updateDocument((doc) => { doc.name = 'A'; }, { group: 'typing' });
    runtime.updateDocument((doc) => { doc.name = 'AB'; }, { group: 'typing' });
    expect(runtime.execute('history.status')).toEqual({ undo: 1, redo: 0 });
    runtime.execute('history.undo');
    runtime.updateDocument((doc) => { doc.name = 'C'; });
    expect(runtime.execute('history.redo')).toBe(false);
  });
  it('resets the baseline after a non-historical restore and bounds memory', () => {
    const runtime = new BoltRuntime().use(historyPlugin({ limit: 2 }));
    for (const name of ['A', 'B', 'C']) runtime.updateDocument((doc) => { doc.name = name; });
    expect(runtime.execute('history.status')).toEqual({ undo: 2, redo: 0 });
    runtime.updateDocument((doc) => { doc.name = 'Loaded'; }, { history: 'ignore' });
    expect(runtime.execute('history.undo')).toBe(false);
  });
});