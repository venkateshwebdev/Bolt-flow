# bolt-flow-plugin-storage

Optional manual/async and legacy debounced local persistence for Bolt Flow. Alpha 0.1.0; unpublished, with validation ongoing. Use the local npm workspaces described in the [root README](../../README.md).

The following API is retained for compatibility. For new integrations, prefer `createPersistenceController` or `persistencePlugin` as described below.

Register `storagePlugin({ key, debounce, storage, onError })` directly or via a trusted static `import()` loader. Defaults are key `bolt-flow:document` and debounce 600 ms. The optional synchronous `StorageAdapter` implements `getItem(key)` and `setItem(key, value)`; browser `localStorage` is used otherwise. A non-browser host must supply an adapter.

Enabling restores a parsed, validated document once. A changed restore uses `history: 'ignore'` to establish a new history baseline. Document changes schedule debounced writes; removal/pagehide saves the current document and clears pending writes. Commands use `runtime.execute(commandId)`:

- `storage.save`: saves immediately and returns success as a boolean.
- `storage.status`: returns `{ savedAt: number | null, error: string | null }`. Observe this and `onError`; an enabled plugin is not proof that writes succeeded.

Persistence includes native same-canvas annotation nodes, graph edges, anchors, local replies/resolution, per-object styles/classes/markers, and all serializable document extensions. Unknown extensions survive without their plugins installed. Legacy `extensions.excalidraw` scenes are preserved as opaque data only, not rendered or migrated. Restoring does not install renderers; enable native drawing separately and supply its explicit consumer CSS as described in the [drawing package README](../plugin-draw/README.md).

Tool state, selection, undo stacks, and plugin choices are not saved by this plugin; the playground separately remembers plugin preferences. Long strokes and opaque legacy payloads can exceed browser storage quotas. There is no bundled cloud backend, cross-tab synchronization or multiplayer identity. The new controller surfaces remote conflict signals but does not merge conflicts. Native image tools, rotation, full groups, and full drawing-editor parity are not supplied by persistence.

Requires only the core peer; no React, perfect-freehand, or Excalidraw dependency. See the [root validation commands](../../README.md#validate-and-build); no final test/build/audit outcomes are asserted.

MIT © 2026 Bolt Flow contributors.
## Explicit persistence

`createPersistenceController(runtime, { adapter, mode: 'manual' })` defaults to no automatic reads/writes. It exposes `save`, `load`, `setMode`, `getSnapshot`, `subscribe` and `dispose`. Manual disposal never flushes. `PersistenceAdapter` supports synchronous or asynchronous saves/loads, AbortSignal and optional ETags. `PersistenceConflict` stops blind retrying of stale writes. Revision tracking preserves edits made during saving.

`persistencePlugin(options)` wraps the controller in the runtime and contributes `storage.controller`. Its `storage.save`/`storage.load` commands return `Promise<boolean>`, unlike the legacy synchronous save command. Use only one storage plugin at a time. Saved document `view` is included when a host explicitly supplies it.

See [the manual/async integration examples](../../docs/CUSTOMIZATION.md#save-only-when-requested).
