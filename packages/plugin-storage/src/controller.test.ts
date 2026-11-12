import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoltRuntime, createDocument } from 'bolt-flow-core';
import { createPersistenceController, PersistenceConflict, type PersistenceAdapter } from './controller';
const defer = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
afterEach(() => vi.useRealTimers());
describe('explicit persistence', () => {
  it('keeps conflicts blocked through failed reloads and resets them on document switch', async () => {
    const save = vi.fn().mockRejectedValueOnce(new PersistenceConflict()).mockResolvedValue(undefined);
    const runtime = new BoltRuntime(), controller = createPersistenceController(runtime, { adapter: { save, load: () => null } });
    expect(await controller.save()).toBe(false);
    expect(await controller.load({ discardChanges: true })).toBe(false);
    expect(await controller.save()).toBe(false);
    expect(save).toHaveBeenCalledOnce();
    runtime.replaceDocument(createDocument({ id: 'another-canvas' }));
    expect(controller.getSnapshot()).toMatchObject({ status: 'dirty', error: null });
    expect(await controller.save()).toBe(true);
    expect(save).toHaveBeenCalledTimes(2); controller.dispose();
  });
  it('coalesces autosaves behind a slow write and cancels them when manual mode is selected', async () => {
    vi.useFakeTimers();
    const pending = defer<void>();
    const save = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue(undefined);
    const runtime = new BoltRuntime(), controller = createPersistenceController(runtime, { adapter: { save, load: () => null } });
    const first = controller.save(); await Promise.resolve();
    controller.setMode('autosave');
    runtime.updateDocument(doc => { doc.name = 'First queued edit'; }); await vi.advanceTimersByTimeAsync(600);
    runtime.updateDocument(doc => { doc.name = 'Second queued edit'; }); await vi.advanceTimersByTimeAsync(600);
    controller.setMode('manual'); pending.resolve(); await first; await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledOnce(); expect(controller.getSnapshot().dirty).toBe(true);
    controller.setMode('autosave'); await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].snapshot.name).toBe('Second queued edit'); controller.dispose();
  });
  it('never writes or restores implicitly in manual mode, including disposal', async () => {
    vi.useFakeTimers();
    const adapter = { load: vi.fn(() => null), save: vi.fn() };
    const runtime = new BoltRuntime(), controller = createPersistenceController(runtime, { adapter });
    runtime.updateDocument(d => { d.name = 'Unsaved'; }); vi.runAllTimers();
    expect(adapter.load).not.toHaveBeenCalled(); expect(adapter.save).not.toHaveBeenCalled();
    expect(await controller.save()).toBe(true);
    expect(adapter.save).toHaveBeenCalledOnce();
    controller.dispose(); vi.runAllTimers(); expect(adapter.save).toHaveBeenCalledOnce();
  });
  it('keeps edits made during an in-flight save dirty and serializes writes', async () => {
    const pending = defer<void>();
    const save = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue(undefined);
    const runtime = new BoltRuntime(), controller = createPersistenceController(runtime, { adapter: { save, load: () => null } });
    const first = controller.save(); await Promise.resolve();
    runtime.updateDocument(d => { d.name = 'Newer'; });
    const second = controller.save(); await Promise.resolve(); expect(save).toHaveBeenCalledOnce();
    pending.resolve(); await first;
    expect(controller.getSnapshot().dirty).toBe(true);
    await second; expect(controller.getSnapshot().dirty).toBe(false);
    expect(save.mock.calls[0][0].snapshot.name).toBe('Untitled canvas');
    expect(save.mock.calls[1][0].snapshot.name).toBe('Newer'); controller.dispose();
  });
  it('ignores stale responses after switching documents', async () => {
    const pending = defer<void>(); const runtime = new BoltRuntime();
    const controller = createPersistenceController(runtime, { adapter: { save: () => pending.promise, load: () => null } });
    const save = controller.save(); await Promise.resolve();
    runtime.replaceDocument(createDocument({ id: 'new' })); pending.resolve();
    expect(await save).toBe(false); expect(controller.getSnapshot()).toMatchObject({ documentId: 'new', dirty: true, savedRevision: null }); controller.dispose();
  });
  it('preserves dirty state on failure and surfaces conflicts without automatic overwrites', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new PersistenceConflict());
    const runtime = new BoltRuntime(), controller = createPersistenceController(runtime, { adapter: { save, load: () => null } });
    expect(await controller.save()).toBe(false); expect(controller.getSnapshot()).toMatchObject({ status: 'error', dirty: true });
    expect(await controller.save()).toBe(true);
    runtime.updateDocument(d => { d.name = 'Changed'; });
    expect(await controller.save()).toBe(false); expect(controller.getSnapshot().status).toBe('conflict');
    expect(await controller.save()).toBe(false); expect(save).toHaveBeenCalledTimes(3); controller.dispose();
  });
  it('does not replace unsaved data on load, including edits made during a request', async () => {
    const pending = defer<{ snapshot: ReturnType<typeof createDocument> }>();
    const load = vi.fn(() => pending.promise), runtime = new BoltRuntime();
    const controller = createPersistenceController(runtime, { adapter: { load, save() {} } });
    expect(await controller.load()).toBe(false); expect(load).not.toHaveBeenCalled();
    const loading = controller.load({ discardChanges: true }); await Promise.resolve();
    runtime.updateDocument(d => { d.name = 'Typing'; }); pending.resolve({ snapshot: createDocument({ name: 'Saved' }) });
    expect(await loading).toBe(false); expect(runtime.getDocument().name).toBe('Typing'); controller.dispose();
  });
  it('debounces opt-in autosave and cancels queued writes when disabled', async () => {
    vi.useFakeTimers();
    const adapter: PersistenceAdapter = { load: () => null, save: vi.fn() };
    const runtime = new BoltRuntime(), controller = createPersistenceController(runtime, { adapter });
    controller.setMode('autosave'); runtime.updateDocument(d => { d.name = 'First'; }); runtime.updateDocument(d => { d.name = 'Last'; });
    await vi.advanceTimersByTimeAsync(600); expect(adapter.save).toHaveBeenCalledOnce();
    runtime.updateDocument(d => { d.name = 'Manual again'; }); controller.setMode('manual');
    await vi.advanceTimersByTimeAsync(600); expect(adapter.save).toHaveBeenCalledOnce(); controller.dispose();
  });
});
