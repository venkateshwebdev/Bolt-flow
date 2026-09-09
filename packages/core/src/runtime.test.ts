import { describe, expect, it, vi } from 'vitest';
import { BoltRuntime, createDocument, validateDocument, type BoltPlugin } from './index';

const plugin = (setup: BoltPlugin['setup'], id = 'test'): BoltPlugin => ({ id, name: id, version: '1.0.0', setup });
describe('document runtime', () => {
  it('is headless with zero default plugins and immutable snapshots', () => {
    const runtime = new BoltRuntime();
    expect(runtime.getSnapshot().plugins).toEqual([]);
    expect(Object.isFrozen(runtime.getDocument().nodes)).toBe(true);
    expect(() => { runtime.getDocument().name = 'mutation'; }).toThrow();
  });
  it('notifies subscribers once per actual change and cleans up subscriptions', () => {
    const runtime = new BoltRuntime();
    const listener = vi.fn();
    const unsubscribe = runtime.subscribe(listener);
    runtime.updateDocument(() => {});
    expect(listener).not.toHaveBeenCalled();
    runtime.updateDocument((doc) => { doc.name = 'New'; });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    runtime.updateDocument((doc) => { doc.name = 'Again'; });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid imports, duplicate ids, dangling edges and non-JSON state', () => {
    expect(() => validateDocument({ schemaVersion: 2 })).toThrow();
    const node = { id: 'a', position: { x: 0, y: 0 }, data: {} };
    expect(() => createDocument({ nodes: [node, node] })).toThrow(/duplicate node/);
    expect(() => createDocument({ edges: [{ id: 'x', source: 'a', target: 'b' }] })).toThrow(/dangling/);
    expect(() => createDocument({ nodes: [{ ...node, position: { x: Infinity, y: 0 } }] })).toThrow();
    expect(() => validateDocument({ ...createDocument(), extensions: { bad: new Date() } })).toThrow();
  });
  it('keeps live state when an update is invalid', () => {
    const runtime = new BoltRuntime();
    const before = runtime.getDocument();
    expect(() => runtime.updateDocument((doc) => { doc.edges.push({ id: 'x', source: 'missing', target: 'missing' }); })).toThrow();
    expect(runtime.getDocument()).toBe(before);
  });
  it('isolates subscriber failures', () => {
    const error = vi.fn();
    const runtime = new BoltRuntime(undefined, error);
    const listener = vi.fn();
    runtime.subscribe(() => { throw new Error('boom'); });
    runtime.subscribe(listener);
    runtime.updateDocument((doc) => { doc.name = 'Safe'; });
    expect(listener).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});
describe('plugin lifecycle', () => {
  it('registers commands and contributions and cleans them up on removal', () => {
    const runtime = new BoltRuntime();
    const teardown = vi.fn();
    const listener = vi.fn();
    runtime.use(plugin((ctx) => {
      ctx.registerCommand({ id: 'test.answer', title: 'Answer', execute: () => 42 });
      ctx.contribute('test.slot', { hello: 'world' });
      ctx.onDocumentChange(listener);
      return teardown;
    }));
    expect(runtime.execute('test.answer')).toBe(42);
    expect(runtime.getContributions('test.slot')).toEqual([{ hello: 'world' }]);
    runtime.remove('test');
    expect(teardown).toHaveBeenCalledOnce();
    expect(runtime.getContributions('test.slot')).toEqual([]);
    expect(() => runtime.execute('test.answer')).toThrow(/unavailable/);
    runtime.updateDocument((doc) => { doc.name = 'No listener'; });
    expect(listener).not.toHaveBeenCalled();
  });
  it('rolls back registrations when setup fails', () => {
    const runtime = new BoltRuntime();
    expect(() => runtime.use(plugin((ctx) => {
      ctx.registerCommand({ id: 'half', title: 'Half', execute() {} });
      ctx.contribute('half', true);
      throw new Error('setup failed');
    }))).toThrow('setup failed');
    expect(runtime.hasPlugin('test')).toBe(false);
    expect(runtime.hasCommand('half')).toBe(false);
    expect(runtime.getContributions('half')).toEqual([]);
  });
  it('does not override another plugin command on collision', () => {
    const runtime = new BoltRuntime();
    runtime.use(plugin((ctx) => { ctx.registerCommand({ id: 'shared', title: 'Original', execute: () => 1 }); }, 'one'));
    expect(() => runtime.use(plugin((ctx) => { ctx.registerCommand({ id: 'shared', title: 'Conflict', execute: () => 2 }); }, 'two'))).toThrow(/Duplicate command/);
    expect(runtime.execute('shared')).toBe(1);
  });
  it('does not leak provisional document changes from failed setup', () => {
    const runtime = new BoltRuntime();
    const listener = vi.fn();
    runtime.onDocumentChange(listener);
    expect(() => runtime.use(plugin((ctx) => {
      ctx.updateDocument((doc) => { doc.name = 'Provisional'; });
      throw new Error('rollback');
    }))).toThrow('rollback');
    expect(listener).not.toHaveBeenCalled();
    expect(runtime.getDocument().name).toBe('Untitled canvas');
  });
  it('enforces dependencies on install and removal', () => {
    const runtime = new BoltRuntime();
    const child = { ...plugin(() => {}, 'child'), requires: ['parent'] };
    expect(() => runtime.use(child)).toThrow(/requires/);
    runtime.use(plugin(() => {}, 'parent')).use(child);
    expect(() => runtime.remove('parent')).toThrow(/Disable/);
    runtime.remove('child');
    runtime.remove('parent');
    expect(runtime.getSnapshot().plugins).toEqual([]);
  });
  it('deduplicates concurrent lazy loads and rejects wrong module identities', async () => {
    const runtime = new BoltRuntime();
    const loader = vi.fn(async () => plugin(() => {}));
    await Promise.all([runtime.load('test', loader), runtime.load('test', loader)]);
    expect(loader).toHaveBeenCalledOnce();
    await expect(runtime.load('other', loader)).rejects.toThrow(/Expected plugin/);
  });
  it('supports retries after load failure and rejects late installs after dispose', async () => {
    const runtime = new BoltRuntime();
    await expect(runtime.load('test', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    await runtime.load('test', async () => plugin(() => {}));
    expect(runtime.hasPlugin('test')).toBe(true);
    runtime.dispose();
    runtime.dispose();
    expect(() => runtime.use(plugin(() => {}))).toThrow(/disposed/);
  });
});