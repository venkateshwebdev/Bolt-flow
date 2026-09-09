# @bolt-flow/plugin-history

Optional bounded undo/redo for the Bolt Flow document. Alpha 0.1.0; unpublished, with validation ongoing. Use the local npm workspaces described in the [root README](../../README.md).

Register `historyPlugin({ limit: 100, mergeWindow: 500 })` directly or via a trusted static `import()` loader. `limit` must be a positive integer; `mergeWindow` is in milliseconds. Commands use `runtime.execute(commandId)`:

- `history.undo` / `history.redo`: restore a previous/next document snapshot and return whether a change was available.
- `history.status`: returns `{ undo, redo }` counts.

One history covers graph edits, native drawings and comments on the same React Flow canvas, local replies/resolution, styles/classes, markers, attachment changes, promotion, and layout. Owner positions and annotation anchors restore together. There is no competing embedded drawing-editor history. Live pointer previews, transient selection, viewport, and host-only defaults are not document changes; React commits drag movement at drag end.

Group nearby edits through `ChangeMeta.group`. A non-history change marked `history: 'ignore'` clears undo/redo and establishes a new baseline when the document changes. Removing the plugin discards its stacks and registrations; re-enabling starts fresh. Command shortcut strings are metadata—the host binds keyboard events.

Snapshots preserve unknown JSON extensions, including legacy Excalidraw scenes as opaque data, without rendering or migrating them. Whole-document snapshots can consume substantial memory with long strokes, large extension payloads, or long histories. Undo stacks themselves are not serialized by storage/export.

Requires only the core peer; no React, perfect-freehand, or Excalidraw dependency, and no multiplayer/CRDT conflict semantics or drawing-editor parity. See the [root validation commands](../../README.md#validate-and-build); no final passing counts or results are asserted.

MIT © 2026 Bolt Flow contributors.