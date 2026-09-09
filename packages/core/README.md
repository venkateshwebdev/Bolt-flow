# bolt-flow-core

Dependency-free, framework-independent Bolt Flow document and plugin runtime. ESM and TypeScript declarations. Alpha 0.1.0; unpublished, with validation ongoing. Use the local npm workspaces described in the [root README](../../README.md).

## Document contract

Exports `BoltRuntime`, `createDocument`, `validateDocument`, `syncAnchors`, and document, command, plugin, and context types. `BoltDocument` has `schemaVersion: 1`, `id`, `name`, `nodes`, `edges`, and `extensions`. Runtime snapshots are deeply frozen JSON data; update only drafts supplied to `updateDocument()`.

- `BoltNode` includes `position`, `data`, dimensions, `type`, `role`, `anchor`, `style`, `className`, `zIndex`, and draggable/selectable/connectable flags.
- `BoltEdge` includes endpoints/handles, routing type, label, animation, data, `style`, `labelStyle`, `labelBgStyle`, `className`, `zIndex`, and `markerStart` / `markerEnd`.
- `BoltStyle` is a record of string/number values. Markers support `arrow` / `arrowclosed` with optional color and dimensions, or `false` to explicitly disable an inherited marker in the React adapter.
- An `anchor` is `{ nodeId, offset: { x, y } }`. Its owner must exist, be a different node, and be neither anchored nor an annotation. `updateDocument()` calls `syncAnchors()` before validation: owner movement/layout moves attached nodes in the same transaction; owner deletion removes the anchor and preserves the annotation's current position. `replaceDocument()` validates supplied snapshots without synchronizing anchors.
- Validation rejects invalid/non-JSON data, duplicate IDs, dangling edges, and invalid anchors. Preserve unknown extension keys. Legacy `extensions.excalidraw` scenes remain opaque JSON, not rendered or migrated by core or the native drawing plugin.

## Plugins and boundaries

Plugins register commands, document listeners, and generic host-defined contributions through `PluginContext`. Runtime-owned registrations are cleaned up on removal; return cleanup for external listeners/timers. `requires` declares plugin-ID dependencies. Failed setup rolls back registrations and provisional document edits. `load(id, loader)` deduplicates concurrent loads; use trusted static `import()` loaders, not arbitrary remote code. Plugins are not sandboxed.

Core has no React, DOM, XYFlow, perfect-freehand, or Excalidraw dependency and installs no features by default. Optional React/drawing packages interpret native annotation nodes on the same canvas. History restores whole-document snapshots, including anchors and local comment data, when its optional plugin is enabled. Core does not implement drawing UI, multiplayer, images, rotation, full groups, or full drawing-editor parity.

See the [root validation commands](../../README.md#validate-and-build). Whole-document cloning/validation/freezing and snapshot history need benchmarking before large-document guarantees.

MIT © 2026 Bolt Flow contributors.