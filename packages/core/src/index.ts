/** Bolt Flow's headless kernel. No React, graph engine, or drawing dependencies. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Point = { x: number; y: number };
export type BoltStyle = Record<string, string | number>;
export interface BoltAnchor { nodeId: string; offset: Point }
export interface BoltMarker { type: 'arrow' | 'arrowclosed'; color?: string; width?: number; height?: number }
export interface BoltNode {
  id: string;
  type?: string;
  position: Point;
  data: Record<string, Json>;
  width?: number;
  height?: number;
  role?: 'node' | 'annotation';
  anchor?: BoltAnchor;
  style?: BoltStyle;
  className?: string;
  zIndex?: number;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
}
export interface BoltEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
  type?: string;
  data?: Record<string, Json>;
  style?: BoltStyle;
  labelStyle?: BoltStyle;
  labelBgStyle?: BoltStyle;
  className?: string;
  markerStart?: BoltMarker | false;
  markerEnd?: BoltMarker | false;
  zIndex?: number;
}
export interface BoltDocument {
  schemaVersion: 2;
  id: string;
  name: string;
  nodes: BoltNode[];
  edges: BoltEdge[];
  extensions: Record<string, Json>;
  view?: { x: number; y: number; zoom: number };
}
export interface ChangeMeta { source?: string; history?: 'record' | 'ignore'; group?: string; transactionId?: string }
export interface Command<T = unknown, R = unknown> {
  id: string;
  title: string;
  shortcut?: string;
  enabled?: () => boolean | string;
  execute: (payload: T) => R;
}
export interface PluginContext {
  getDocument(): BoltDocument;
  getDocumentRevision(): number;
  updateDocument(update: (draft: BoltDocument) => void, meta?: ChangeMeta): void;
  replaceDocument(document: BoltDocument, meta?: ChangeMeta): void;
  onDocumentChange(listener: DocumentListener): () => void;
  registerCommand<T, R>(command: Command<T, R>): () => void;
  contribute<T>(slot: string, value: T): () => void;
}
export interface BoltPlugin {
  id: string;
  name: string;
  version: string;
  requires?: string[];
  setup(context: PluginContext): void | (() => void);
}
type DocumentListener = (next: BoltDocument, previous: BoltDocument, meta: ChangeMeta) => void;
export interface RuntimeSnapshot {
  document: BoltDocument;
  plugins: readonly { id: string; name: string; version: string }[];
  commands: readonly { id: string; title: string; shortcut?: string }[];
  revision: number;
  documentRevision: number;
}

export function createDocument(input: Partial<Omit<BoltDocument, 'schemaVersion'>> = {}): BoltDocument {
  return validateDocument({ schemaVersion: 2, id: 'untitled', name: 'Untitled canvas', nodes: [], edges: [], extensions: {}, ...input });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validStyle(value: unknown) {
  return value === undefined || (isObject(value) && Object.values(value).every((item) => typeof item === 'string' || typeof item === 'number'));
}
function validMarker(value: unknown) {
  return value === undefined || value === false || (isObject(value) && ['arrow', 'arrowclosed'].includes(String(value.type)) &&
    (value.color === undefined || typeof value.color === 'string') &&
    [value.width, value.height].every((size) => size === undefined || (typeof size === 'number' && size > 0)));
}
/** Resolve attachments in the same transaction as a move/layout. Deleting an owner detaches its annotations. */
export function syncAnchors(document: BoltDocument): void {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const done = new Set<string>();
  const visiting = new Set<string>();
  const resolve = (node: BoltNode) => {
    if (done.has(node.id)) return;
    if (visiting.has(node.id)) throw new Error('Cyclic annotation anchor.');
    visiting.add(node.id);
    if (node.anchor) {
      const owner = nodes.get(node.anchor.nodeId);
      if (!owner) delete node.anchor;
      else {
        resolve(owner);
        node.position = { x: owner.position.x + node.anchor.offset.x, y: owner.position.y + node.anchor.offset.y };
      }
    }
    visiting.delete(node.id);
    done.add(node.id);
  };
  document.nodes.forEach(resolve);
}
function isJson(value: unknown, seen = new Set<object>()): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  seen.add(value);
  const valid = Object.values(value).every((item) => isJson(item, seen));
  seen.delete(value);
  return valid;
}
/** Reject malformed imports before they can replace a live document. */
export function validateDocument(value: unknown): BoltDocument {
  if (!isObject(value) || !isJson(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || typeof value.id !== 'string' || typeof value.name !== 'string' ||
    !Array.isArray(value.nodes) || !Array.isArray(value.edges) || !isObject(value.extensions)) {
    throw new Error('Invalid Bolt Flow document (expected schemaVersion 1 or 2).');
  }
  if (value.view !== undefined && (!isObject(value.view) ||
    ![value.view.x, value.view.y, value.view.zoom].every((n) => typeof n === 'number' && Number.isFinite(n)) || Number(value.view.zoom) <= 0)) throw new Error('Invalid saved viewport.');
  const ids = new Set<string>();
  for (const node of value.nodes) {
    if (!isObject(node) || typeof node.id !== 'string' || !node.id || ids.has(node.id) || !isObject(node.position) ||
      typeof node.position.x !== 'number' || !Number.isFinite(node.position.x) || typeof node.position.y !== 'number' || !Number.isFinite(node.position.y) ||
      !isObject(node.data) || (node.type !== undefined && typeof node.type !== 'string') ||
      !validStyle(node.style) || (node.className !== undefined && typeof node.className !== 'string') ||
      (node.groupId !== undefined && (typeof node.groupId !== 'string' || !node.groupId)) ||
      (node.role !== undefined && !['node', 'annotation'].includes(String(node.role))) ||
      (node.zIndex !== undefined && typeof node.zIndex !== 'number') ||
      [node.draggable, node.selectable, node.connectable, node.hidden, node.locked].some((flag) => flag !== undefined && typeof flag !== 'boolean') ||
      [node.width, node.height].some((size) => size !== undefined && (typeof size !== 'number' || size <= 0))) {
      throw new Error('Invalid or duplicate node in document.');
    }
    ids.add(node.id);
  }
  const nodesById = new Map(value.nodes.map((node) => [(node as Record<string, unknown>).id, node as Record<string, unknown>]));
  for (const raw of value.nodes) {
    const node = raw as Record<string, unknown>;
    if (node.anchor === undefined) continue;
    const anchor = node.anchor;
    if (!isObject(anchor) || typeof anchor.nodeId !== 'string' || anchor.nodeId === node.id || !isObject(anchor.offset) ||
      typeof anchor.offset.x !== 'number' || typeof anchor.offset.y !== 'number' || !nodesById.has(anchor.nodeId) ||
      (value.schemaVersion === 1 && (nodesById.get(anchor.nodeId)?.anchor || nodesById.get(anchor.nodeId)?.role === 'annotation'))) throw new Error('Invalid annotation anchor.');
  }
  const visiting = new Set<string>(), done = new Set<string>();
  const checkChain = (id: string): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error('Cyclic annotation anchor.');
    visiting.add(id);
    const anchor = nodesById.get(id)?.anchor as BoltAnchor | undefined;
    if (anchor) checkChain(anchor.nodeId);
    visiting.delete(id); done.add(id);
  };
  for (const id of ids) checkChain(id);
  const edgeIds = new Set<string>();
  for (const edge of value.edges) {
    if (!isObject(edge) || typeof edge.id !== 'string' || !edge.id || edgeIds.has(edge.id) ||
      typeof edge.source !== 'string' || typeof edge.target !== 'string' || !ids.has(edge.source) || !ids.has(edge.target) ||
      [edge.type, edge.label].some((field) => field !== undefined && typeof field !== 'string') ||
      [edge.sourceHandle, edge.targetHandle].some((field) => field !== undefined && field !== null && typeof field !== 'string') ||
      [edge.style, edge.labelStyle, edge.labelBgStyle].some((style) => !validStyle(style)) ||
      !validMarker(edge.markerStart) || !validMarker(edge.markerEnd) ||
      (edge.data !== undefined && !isObject(edge.data)) || (edge.className !== undefined && typeof edge.className !== 'string') ||
      (edge.zIndex !== undefined && typeof edge.zIndex !== 'number') ||
      (edge.animated !== undefined && typeof edge.animated !== 'boolean')) {
      throw new Error('Invalid, duplicate, or dangling edge in document.');
    }
    edgeIds.add(edge.id);
  }
  return { ...structuredClone(value), schemaVersion: 2 } as unknown as BoltDocument;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

export class BoltRuntime {
  private document: BoltDocument;
  private documentRevision = 0;
  private commandGuards = new Set<(id: string, payload: unknown) => boolean | string | void>();
  private plugins = new Map<string, { plugin: BoltPlugin; cleanup: (() => void)[] }>();
  private commands = new Map<string, Command>();
  private contributions = new Map<string, { token: symbol; value: unknown }[]>();
  private listeners = new Set<() => void>();
  private documentListeners = new Set<DocumentListener>();
  private loading = new Map<string, Promise<void>>();
  private snapshot: RuntimeSnapshot;
  private disposed = false;
  private installing = false;
  private setupMeta: ChangeMeta = {};
  constructor(document = createDocument(), private onError: (error: unknown) => void = console.error) {
    this.document = freeze(validateDocument(document));
    this.snapshot = { document: this.document, plugins: [], commands: [], revision: 0, documentRevision: 0 };
  }
  getSnapshot = (): RuntimeSnapshot => this.snapshot;
  getDocument = (): BoltDocument => this.document;
  getDocumentRevision = (): number => this.documentRevision;
  /** Host policy applies to every command entry point. Trusted direct draft mutations remain available. */
  beforeCommand(guard: (id: string, payload: unknown) => boolean | string | void): () => void {
    this.commandGuards.add(guard);
    return () => { this.commandGuards.delete(guard); };
  }
  commandStatus(id: string, payload?: unknown): boolean | string {
    const command = this.commands.get(id);
    if (!command) return 'Command is unavailable.';
    for (const guard of this.commandGuards) {
      const result = guard(id, payload);
      if (result === false || typeof result === 'string') return result;
    }
    return command.enabled?.() ?? true;
  }
  subscribe = (listener: () => void): (() => void) => {
    this.assertActive();
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  onDocumentChange = (listener: DocumentListener): (() => void) => {
    this.assertActive();
    this.documentListeners.add(listener);
    return () => { this.documentListeners.delete(listener); };
  };
  private assertActive() { if (this.disposed) throw new Error('Bolt runtime has been disposed.'); }
  private emit() {
    if (this.installing) return;
    this.snapshot = {
      document: this.document,
      plugins: [...this.plugins.values()].map(({ plugin: { id, name, version } }) => ({ id, name, version })),
      commands: [...this.commands.values()].map(({ id, title, shortcut }) => ({ id, title, shortcut })),
      revision: this.snapshot.revision + 1,
      documentRevision: this.documentRevision,
    };
    this.listeners.forEach((listener) => { try { listener(); } catch (error) { this.onError(error); } });
  }
  updateDocument = (update: (draft: BoltDocument) => void, meta: ChangeMeta = {}): void => {
    this.assertActive();
    const draft = structuredClone(this.document);
    update(draft);
    syncAnchors(draft);
    this.replaceDocument(draft, meta);
  };
  replaceDocument = (document: BoltDocument, meta: ChangeMeta = {}): void => {
    this.assertActive();
    const next = freeze(validateDocument(document));
    if (JSON.stringify(next) === JSON.stringify(this.document)) return;
    const previous = this.document;
    this.document = next;
    if (this.installing) { this.setupMeta = meta; return; }
    this.notifyDocument(next, previous, meta);
    this.emit();
  };
  private notifyDocument(next: BoltDocument, previous: BoltDocument, meta: ChangeMeta) {
    this.documentRevision++;
    meta = { ...meta, transactionId: meta.transactionId ?? `document-${this.documentRevision}` };
    this.documentListeners.forEach((listener) => {
      try { listener(next, previous, meta); } catch (error) { this.onError(error); }
    });
  }
  hasPlugin(id: string): boolean { return this.plugins.has(id); }
  hasCommand(id: string): boolean { return this.commands.has(id); }
  execute<T = unknown, R = unknown>(id: string, payload?: T): R {
    this.assertActive();
    const command = this.commands.get(id);
    if (!command) throw new Error(`Command "${id}" is unavailable. Enable its plugin first.`);
    const status = this.commandStatus(id, payload);
    if (status !== true) throw new Error(typeof status === 'string' ? status : 'This action is disabled.');
    return command.execute(payload) as R;
  }
  getContributions<T>(slot: string): T[] {
    return (this.contributions.get(slot) ?? []).map(({ value }) => value as T);
  }
  use(plugin: BoltPlugin): this {
    this.assertActive();
    if (this.installing) throw new Error('Nested plugin installation is not supported.');
    if (this.plugins.has(plugin.id)) return this;
    for (const id of plugin.requires ?? []) {
      if (!this.hasPlugin(id)) throw new Error(`Plugin "${plugin.id}" requires "${id}".`);
    }
    const cleanup: (() => void)[] = [];
    const own = (dispose: () => void) => { cleanup.push(dispose); return dispose; };
    this.installing = true;
    this.setupMeta = {};
    const before = this.document;
    try {
      const teardown = plugin.setup({
        getDocument: this.getDocument,
        getDocumentRevision: this.getDocumentRevision,
        updateDocument: this.updateDocument,
        replaceDocument: this.replaceDocument,
        onDocumentChange: (listener) => own(this.onDocumentChange(listener)),
        registerCommand: (command) => {
          if (this.commands.has(command.id)) throw new Error(`Duplicate command: ${command.id}`);
          this.commands.set(command.id, command as Command);
          return own(() => { this.commands.delete(command.id); });
        },
        contribute: (slot, value) => {
          const token = Symbol(slot);
          this.contributions.set(slot, [...(this.contributions.get(slot) ?? []), { token, value }]);
          return own(() => { this.contributions.set(slot, (this.contributions.get(slot) ?? []).filter((item) => item.token !== token)); });
        },
      });
      if (teardown) cleanup.push(teardown);
      this.plugins.set(plugin.id, { plugin, cleanup });
    } catch (error) {
      cleanup.reverse().forEach((dispose) => { try { dispose(); } catch (failure) { this.onError(failure); } });
      this.document = before;
      throw error;
    } finally {
      this.installing = false;
      if (this.document !== before) this.notifyDocument(this.document, before, this.setupMeta);
      this.emit();
    }
    return this;
  }
  /** Consumers supply static import() loaders, so bundlers create optional chunks. */
  load(id: string, loader: () => Promise<BoltPlugin>): Promise<void> {
    this.assertActive();
    if (this.hasPlugin(id)) return Promise.resolve();
    const pending = this.loading.get(id);
    if (pending) return pending;
    const promise = Promise.resolve().then(loader).then((plugin) => {
      if (plugin.id !== id) throw new Error(`Expected plugin "${id}", received "${plugin.id}".`);
      this.use(plugin);
    }).finally(() => { this.loading.delete(id); });
    this.loading.set(id, promise);
    return promise;
  }
  remove(id: string): void {
    this.assertActive();
    for (const { plugin } of this.plugins.values()) {
      if (plugin.requires?.includes(id)) throw new Error(`Disable "${plugin.id}" before "${id}".`);
    }
    const record = this.plugins.get(id);
    if (!record) return;
    record.cleanup.reverse().forEach((dispose) => { try { dispose(); } catch (error) { this.onError(error); } });
    this.plugins.delete(id);
    this.emit();
  }
  dispose(): void {
    if (this.disposed) return;
    [...this.plugins.keys()].reverse().forEach((id) => this.remove(id));
    this.commandGuards.clear();
    this.documentListeners.clear();
    this.listeners.clear();
    this.disposed = true;
  }
}
export * from './operations';
export * from './serialization';
