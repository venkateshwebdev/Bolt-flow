import { parseCanvas, serializeCanvas, validateDocument, type BoltDocument, type PluginContext, type BoltPlugin } from 'bolt-flow-core';

export type PersistenceMode = 'manual' | 'autosave';
export interface SaveRequest { documentId: string; snapshot: BoltDocument; revision: number; etag?: string; signal: AbortSignal }
export interface LoadResult { snapshot: BoltDocument; etag?: string }
export interface PersistenceAdapter {
  load(request: { documentId: string; signal: AbortSignal }): LoadResult | null | Promise<LoadResult | null>;
  save(request: SaveRequest): void | { etag?: string } | Promise<void | { etag?: string }>;
}
export class PersistenceConflict extends Error { constructor(message = 'This canvas changed at the destination. Reload or save a copy.') { super(message); this.name = 'PersistenceConflict'; } }
export interface PersistenceState {
  status: 'dirty' | 'saving' | 'saved' | 'loading' | 'error' | 'conflict';
  mode: PersistenceMode;
  documentId: string;
  dirty: boolean;
  revision: number;
  savedRevision: number | null;
  savedAt: number | null;
  error: string | null;
}
export interface PersistenceOptions {
  adapter: PersistenceAdapter;
  mode?: PersistenceMode;
  debounce?: number;
  /** Explicitly set true only when restoring over the initial document is intended. */
  restoreOnInstall?: boolean;
  onError?: (error: unknown) => void;
}

/** No implicit restore, unload listeners, or writes in manual mode. Own one controller per destination. */
export function createPersistenceController(runtime: Pick<PluginContext, 'getDocument' | 'getDocumentRevision' | 'onDocumentChange' | 'replaceDocument'>, options: PersistenceOptions) {
  const debounce = options.debounce ?? 600;
  if (!Number.isFinite(debounce) || debounce < 0) throw new Error('Invalid persistence debounce.');
  let disposed = false, generation = 0, restoring = false, conflicted = false, autosaveVersion = 0;
  let etag: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  const requests = new Set<AbortController>(), listeners = new Set<() => void>();
  let state: PersistenceState = { status: 'dirty', mode: options.mode ?? 'manual', documentId: runtime.getDocument().id, dirty: true, revision: runtime.getDocumentRevision(), savedRevision: null, savedAt: null, error: null };
  if (!['manual', 'autosave'].includes(state.mode)) throw new Error('Invalid persistence mode.');
  const publish = (patch: Partial<PersistenceState>) => {
    state = Object.freeze({ ...state, ...patch });
    listeners.forEach(listener => { try { listener(); } catch (error) { options.onError?.(error); } });
  };
  const active = (epoch: number) => !disposed && epoch === generation;
  const fail = (error: unknown) => {
    if (error instanceof PersistenceConflict) conflicted = true;
    publish({ status: conflicted ? 'conflict' : 'error', error: error instanceof Error ? error.message : String(error) });
    options.onError?.(error);
  };
  const cancel = () => {
    generation++; clearTimeout(timer); requests.forEach(request => request.abort()); requests.clear();
  };
  const schedule = () => {
    clearTimeout(timer);
    const version = ++autosaveVersion;
    if (state.mode === 'autosave' && state.dirty && !conflicted) timer = setTimeout(() => { void enqueueSave(version); }, debounce);
  };
  const unsubscribe = runtime.onDocumentChange((doc) => {
    if (restoring || disposed) return;
    if (doc.id !== state.documentId) {
      cancel(); etag = undefined; conflicted = false;
      publish({ documentId: doc.id, savedAt: null, savedRevision: null, status: 'dirty', error: null });
    }
    publish({ revision: runtime.getDocumentRevision(), dirty: true, status: state.status === 'saving' ? 'saving' : state.status === 'conflict' ? 'conflict' : 'dirty', error: state.status === 'conflict' ? state.error : null });
    schedule();
  });
  function enqueueSave(automaticVersion?: number): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    clearTimeout(timer);
    const epoch = generation, snapshot = runtime.getDocument(), revision = runtime.getDocumentRevision();
    const work = async () => {
      if (!active(epoch)) return false;
      if (conflicted || (automaticVersion !== undefined && (state.mode !== 'autosave' || automaticVersion !== autosaveVersion))) return false;
      const request = new AbortController(); requests.add(request);
      publish({ status: 'saving', error: null });
      try {
        const result = await options.adapter.save({ documentId: snapshot.id, snapshot, revision, etag, signal: request.signal });
        if (!active(epoch)) return false;
        etag = result?.etag ?? etag;
        const dirty = runtime.getDocumentRevision() !== revision;
        publish({ status: dirty ? 'dirty' : 'saved', dirty, savedRevision: revision, savedAt: Date.now(), error: null });
        return true;
      } catch (error) { if (active(epoch)) fail(error); return false; }
      finally { requests.delete(request); }
    };
    const result = tail.then(work, work);
    tail = result;
    return result;
  }
  async function load({ discardChanges = false }: { discardChanges?: boolean } = {}): Promise<boolean> {
    if (disposed) return false;
    if (state.dirty && !discardChanges) { fail(new Error('Unsaved changes. Pass discardChanges after the user chooses to replace them.')); return false; }
    cancel();
    const epoch = generation, revision = runtime.getDocumentRevision(), documentId = runtime.getDocument().id;
    const request = new AbortController(); requests.add(request);
    publish({ status: 'loading', error: null });
    try {
      // Wait for older writes to settle so a load does not race a pending write at the destination.
      await tail;
      if (!active(epoch)) return false;
      const result = await options.adapter.load({ documentId, signal: request.signal });
      if (!active(epoch)) return false;
      if (runtime.getDocumentRevision() !== revision) throw new Error('The canvas changed while loading. Load again to replace it.');
      if (!result) throw new Error('No saved canvas was found.');
      const next = validateDocument(result.snapshot);
      restoring = true;
      try { runtime.replaceDocument(next, { source: 'persistence.load', history: 'ignore' }); } finally { restoring = false; }
      etag = result.etag; conflicted = false;
      publish({ documentId: next.id, revision: runtime.getDocumentRevision(), savedRevision: runtime.getDocumentRevision(), savedAt: Date.now(), status: 'saved', dirty: false, error: null });
      return true;
    } catch (error) { if (active(epoch)) fail(error); return false; }
    finally { requests.delete(request); }
  }
  function setMode(mode: PersistenceMode) {
    if (disposed) throw new Error('Persistence controller is disposed.');
    if (!['manual', 'autosave'].includes(mode)) throw new Error('Invalid persistence mode.');
    publish({ mode }); schedule();
  }
  const controller = {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    save: () => enqueueSave(), load, setMode,
    /** Cancels pending work. It never saves on disposal. */
    dispose: () => { if (disposed) return; disposed = true; cancel(); unsubscribe(); listeners.clear(); },
  };
  if (options.restoreOnInstall) void load({ discardChanges: true });
  else schedule();
  return controller;
}
export type PersistenceController = ReturnType<typeof createPersistenceController>;

export function localStorageAdapter(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string | ((id: string) => string) = id => `bolt-flow:${id}`): PersistenceAdapter {
  const resolve = (id: string) => typeof key === 'function' ? key(id) : key;
  return {
    load: ({ documentId }) => { const json = storage.getItem(resolve(documentId)); return json ? { snapshot: parseCanvas(json) } : null; },
    save: ({ documentId, snapshot }) => { storage.setItem(resolve(documentId), serializeCanvas(snapshot, false)); },
  };
}

/** Optional runtime wrapper. Manual mode is the default; enabling it does not restore or write. */
export function persistencePlugin(options: PersistenceOptions): BoltPlugin {
  return { id: 'storage', name: 'Canvas persistence', version: '0.2.0', setup(ctx) {
    const controller = createPersistenceController(ctx, options);
    ctx.contribute('storage.controller', controller);
    ctx.registerCommand({ id: 'storage.save', title: 'Save canvas', shortcut: 'Mod+S', execute: () => controller.save() });
    ctx.registerCommand({ id: 'storage.load', title: 'Open saved canvas', execute: (options?: { discardChanges?: boolean }) => controller.load(options) });
    ctx.registerCommand({ id: 'storage.status', title: 'Save status', execute: () => controller.getSnapshot() });
    ctx.registerCommand({ id: 'storage.mode', title: 'Set save mode', execute: (mode: PersistenceMode) => controller.setMode(mode) });
    return controller.dispose;
  } };
}
