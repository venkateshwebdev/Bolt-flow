# @bolt-flow/plugin-storage

Optional debounced local persistence for Bolt Flow. Alpha 0.1.0; unpublished, with validation ongoing. Use the local npm workspaces described in the [root README](../../README.md).

Register `storagePlugin({ key, debounce, storage, onError })` directly or via a trusted static `import()` loader. Defaults are key `bolt-flow:document` and debounce 600 ms. The optional synchronous `StorageAdapter` implements `getItem(key)` and `setItem(key, value)`; browser `localStorage` is used otherwise. A non-browser host must supply an adapter.

Enabling restores a parsed, validated document once. A changed restore uses `history: 'ignore'` to establish a new history baseline. Document changes schedule debounced writes; removal/pagehide saves the current document and clears pending writes. Commands use `runtime.execute(commandId)`:

- `storage.save`: saves immediately and returns success as a boolean.
- `storage.status`: returns `{ savedAt: number | null, error: string | null }`. Observe this and `onError`; an enabled plugin is not proof that writes succeeded.

Persistence includes native same-canvas annotation nodes, graph edges, anchors, local replies/resolution, per-object styles/classes/markers, and all serializable document extensions. Unknown extensions survive without their plugins installed. Legacy `extensions.excalidraw` scenes are preserved as opaque data only, not rendered or migrated. Restoring does not install renderers; enable native drawing separately and supply its explicit consumer CSS as described in the [drawing package README](../plugin-draw/README.md).

Tool state, selection, viewport, undo stacks, and plugin choices are not saved by this plugin; the playground separately remembers plugin preferences. Long strokes and opaque legacy payloads can exceed browser storage quotas. There is no cloud backend, cross-tab synchronization, multiplayer identity, or conflict resolution. Native image tools, rotation, full groups, and full drawing-editor parity are not supplied by persistence.

Requires only the core peer; no React, perfect-freehand, or Excalidraw dependency. See the [root validation commands](../../README.md#validate-and-build); no final test/build/audit outcomes are asserted.

MIT © 2026 Bolt Flow contributors.