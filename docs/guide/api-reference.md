# API reference

This reference describes the current workspace exports and supported contracts. All examples assume ESM imports. Runtime plugin version strings and package versions serve different purposes; the workspace packages are still unpublished 0.1.0 alpha packages.

## Core runtime

Import from `bolt-flow-core`.

| API | Signature or behavior |
| --- | --- |
| `createDocument(input?)` | Accepts partial document fields except schema version; returns validated schema 2 |
| `validateDocument(value)` | Validates unknown input, migrates valid v1, returns a clone |
| `new BoltRuntime(document?, onError?)` | Owns a frozen document and plugin registry |
| `runtime.getDocument()` | Current frozen document |
| `runtime.getDocumentRevision()` | Committed document revision |
| `runtime.getSnapshot()` | Document, plugins, command metadata, runtime/document revisions |
| `runtime.subscribe(listener)` | External-store subscription; returns disposer |
| `runtime.onDocumentChange(listener)` | Receives next, previous, and change metadata; returns disposer |
| `runtime.updateDocument(callback, meta?)` | Mutate a draft, synchronize anchors, validate, commit |
| `runtime.replaceDocument(document, meta?)` | Validate and replace; does not recompute positions |
| `runtime.use(plugin)` | Synchronous, idempotent by plugin ID; returns runtime |
| `runtime.load(id, loader)` | Load an optional plugin asynchronously; deduplicated |
| `runtime.remove(id)` | Remove owned registrations; dependency checks apply |
| `runtime.hasPlugin(id)` | Whether a plugin is installed |
| `runtime.hasCommand(id)` | Whether a command is registered |
| `runtime.execute<T, R>(id, payload?)` | Invoke a command; T is payload, R is return type |
| `runtime.commandStatus(id, payload?)` | true, false, or a disabled reason |
| `runtime.beforeCommand(guard)` | Register a command policy; returns disposer |
| `runtime.getContributions<T>(slot)` | Current contributed values for a slot |
| `runtime.dispose()` | Permanently remove plugins and subscriptions |

`ChangeMeta` has optional `source`, `group`, `history: 'record' | 'ignore'`, and `transactionId`. `Command<T,R>` has `id`, `title`, optional `shortcut`, optional `enabled: () => boolean | string`, and `execute(payload)`.

## Core document types

| Type | Fields |
| --- | --- |
| `Json` | null, boolean, finite number, string, arrays, and string-keyed JSON objects |
| `Point` | `{ x: number; y: number }` |
| `BoltStyle` | `Record<string, string | number>` |
| `BoltAnchor` | `{ nodeId: string; offset: Point }` |
| `BoltMarker` | `type: 'arrow' | 'arrowclosed'`, optional color/width/height |
| `BoltNode` | id, position, data; optional type/dimensions/role/anchor/style/className/zIndex/interaction flags/hidden/locked/groupId |
| `BoltEdge` | id, source, target; optional handles/type/label/animated/data/style/label styles/className/markers/zIndex |
| `BoltDocument` | schemaVersion 2, id, name, nodes, edges, extensions, optional view |
| `RuntimeSnapshot` | document, plugins, commands, revision, documentRevision |

Node dimensions must be positive when supplied. IDs must be unique within their collection, and edge references must exist. Anchor chains must be acyclic. Class names and renderer IDs are data; their implementations remain in host code.

## Serialization and editing helpers

| Function | Purpose |
| --- | --- |
| `parseCanvas(json, maxBytes?)` | Parse/validate a complete document; default limit 25 MiB |
| `serializeCanvas(document, pretty = true)` | Validate and serialize a complete document |
| `captureCanvas(document)` | Capture version-2 presentation separate from execution data |
| `applyCanvas(graph, presentation)` | Return `{ document, warnings }` after reconciliation |
| `insertCanvas(target, incoming, offset?)` | Return `{ document, insertedIds }` with fresh IDs; default offset 40/40 |
| `syncAnchors(document)` | Draft helper: resolve owner chains and detach missing owners |
| `moveNodes(document, positions)` | Draft helper: apply a Map of absolute positions and reconcile anchors |
| `expandNodeSelection(nodes, ids)` | Expand logical groups, excluding hidden/locked objects |
| `duplicateNodes(document, ids, offset?)` | Draft helper: copy selected/grouped nodes and internal edges; default offset 32/32 |
| `translateEdgeRoute(edge, offset)` | Clone an edge and translate built-in waypoint data |
| `editingPlugin()` | Register shared organization commands |

Use draft helpers inside `updateDocument`, or on a standalone mutable document before replacement. Never pass a frozen runtime snapshot to a mutating helper.

## React components and hooks

Import from `bolt-flow-react` and load `bolt-flow-react/style.css`.

| Export | Main props or behavior |
| --- | --- |
| `BoltFlow` | React Flow-style canvas; default/controlled graph, plugins, tool state, optional editor shell, document ref; see [complete API](react-flow.md) |
| `BoltProvider` | runtime, children, optional readOnly |
| `BoltCanvas` | Document-bound React Flow canvas; see options below |
| `BoltTools` | Render contributed toolbars with CanvasToolProps |
| `BoltEditor` | canvas, actions, interaction, panels, style, className, onError |
| `BoltToolbar` | actions, hidden IDs, onError, accessible label |
| `BoltLayers` | selectedIds, onSelect, onFocus, filter, renderLabel, onError |
| `BoltInspector` | nodeId, fields, children |
| `BoltSlot` | name, selection, interaction, optional component overrides |
| `BoltWaypointEdge` | Built-in editable waypoint renderer |
| `editorUIPlugin` | Typed action and panel contributions |
| `useBolt()` | Current runtime |
| `useBoltSnapshot()` | React external-store subscription |
| `useBoltReadOnly()` | Effective provider/canvas read-only context |
| `useBoltActions(overrides?, hidden?)` | Resolve contributed actions |
| `useBoltShortcuts(ref, actions, onError?)` | Scoped action shortcuts |
| `shortcutMatches(event, shortcut)` | Match supported shortcut strings |

React Flow helpers re-exported include `Handle`, `Position`, `useReactFlow`, `useViewport`, `NodeResizer`, `BaseEdge`, and `getBezierPath`. Re-exported types include `Node`, `Edge`, `NodeProps`, `NodeTypes`, `EdgeTypes`, and `ReactFlowInstance`. For other upstream exports, depend on `@xyflow/react` directly.

## Canvas options

`BoltCanvasProps` extends React Flow props except its controlled document nodes/edges and mutation callbacks. Core-specific props:

| Prop | Default | Purpose |
| --- | --- | --- |
| `theme` | light | Canvas color mode |
| `showGrid` | true | Dot background |
| `showControls` | true | React Flow controls |
| `showMinimap` | false | Minimap |
| `interaction` | Select with empty options | Shared tool state |
| `readOnly` | false | Disable canvas pointer mutations |
| `selectedNodeIds` | Uncontrolled | Host-controlled node selection |
| `selectedEdgeIds` | Uncontrolled | Host-controlled edge selection |
| `nodeDefaults` | None | Workflow style/class/interaction defaults |
| `edgeDefaults` | None | Edge fields other than id/source/target |
| `nodeTypes`, `edgeTypes` | Built-ins/contributions | Host renderers override contributed renderers |

Unless overridden, initial fit is enabled, minZoom is 0.15, maxZoom is 3, and node/selection auto-pan is disabled. Pan mode disables node dragging, connection creation, and selection. Active drawing tools arbitrate pointer input on the same canvas.

`CanvasToolProps` contains `tool`, JSON `options`, and optional `onToolChange`, `onOptionsChange`, `onCreated(id, 'node' | 'edge')`, `onMessage`, and `readOnly`.

## Actions and slots

`BoltAction` fields: `id`, `label`, optional `command`, `payload`, `run`, `shortcut`, `enabled`, `icon`. Supply a command or run callback. If both exist, the command is used. `enabled` is a boolean; dynamic policy should be resolved by the host or command status.

`EditorPanel` fields: `id`, optional `order`, and `component`. Components receive `EditorSlotProps`: `selection: string[]` and `interaction: CanvasToolProps`. Slot names are `editor.toolbar`, `editor.inspector`, `editor.menu`, `editor.panel`, and `editor.status`.

`InspectorField` fields: `key`, `label`, optional `type` (`text`, `number`, `color`, `checkbox`), `min`, and `max`. Fields edit node data keys, not arbitrary nested document paths.

## Drawing options and settings

Import from `bolt-flow-plugin-draw` and load its stylesheet. `drawPlugin(options?)` accepts:

| Option | Behavior |
| --- | --- |
| `defaults` | Partial InkSettings |
| `toolbar` | Custom CanvasToolProps component, or false |
| `tools` | Complete allowlist/order of raw drawing IDs |
| `shapes` | DrawShapeDefinition array |
| `fonts` | Append DrawFont definitions |
| `colors` | Replace palette swatches |
| `toFlowNode` | Return type/data/dimensions for annotation promotion |

`InkSettings` defaults:

| Field | Default |
| --- | --- |
| color | `#7963d2` |
| textColor | Empty; inherit color |
| fill | transparent |
| size | 3 |
| opacity | 1 |
| text | Empty |
| fontSize | 22 |
| fontFamily | Gochi Hand, cursive |
| smartConnect | true |
| anchorId | Empty; unattached |
| keepTool | false |
| attachOnShift | true |

`DrawCreateInput` has shape, point tuples, and optional partial settings. `DrawResult` has id, kind, and optional connected. `DrawShapeDefinition` has id, label, path, optional icon/component. `DrawFont` has id, label, family.

Other drawing exports include rich-text helpers/types and `importWorkflowCanvas(graph, input, { convertHtml? })`. Consult the generated declaration file for the exact inferred importer options; there is no separate required importer configuration object.

## Built-in command reference

Install the corresponding plugin before calling its commands.

| Command | Payload | Result / effect |
| --- | --- | --- |
| `editor.group` | Node ID array | Group ID; needs at least two editable targets |
| `editor.ungroup` | Node ID array | Remove grouping |
| `editor.duplicate` | Node ID array | New node IDs |
| `editor.delete` | Node ID array | Delete targets and related edges |
| `editor.layer` | `{ ids, hidden?, locked? }` | Update layer flags |
| `editor.order` | `{ ids, direction: 'front' \| 'back' }` | Update z-index |
| `editor.align` | `{ ids, axis }` | left/top/center-x/center-y alignment |
| `draw.erase` | Annotation ID string | Erase one visible, unlocked annotation; requires eraser tool. |
| `draw.create` | `{ shape, points, settings? }` | DrawResult |
| `draw.style` | `{ id, color?, size?, opacity? }` | Update annotation style |
| `draw.attach` | `{ id, ownerId }` | Attach annotation |
| `draw.detach` | Annotation ID | Detach annotation |
| `draw.reply` | `{ id, text }` | Add local reply |
| `draw.resolve` | Comment ID | Toggle resolution |
| `draw.convert` | Annotation ID | Promote using host callback/default |
| `history.undo` | None | Boolean; undo if possible |
| `history.redo` | None | Boolean; redo if possible |
| `history.status` | None | `{ undo, redo }` counts |
| `layout.arrange` | Optional direction/nodeGap/rankGap | Arrange workflow nodes |
| `storage.save` | None | New controller: Promise of boolean |
| `storage.load` | Optional `{ discardChanges }` | New controller: Promise of boolean |
| `storage.status` | None | Controller state; legacy shape differs |
| `storage.mode` | manual or autosave | Set new controller mode |
| `export.json` | None | Complete JSON string |
| `import.json` | JSON string | Validate and replace |
| `export.download` | None | Download JSON in browser |
| `export.png` | Optional ImageExportOptions | Download PNG; async |

## History and layout options

`historyPlugin({ limit = 100, mergeWindow = 500 })` uses document snapshots. The limit must be a positive integer. A group key merges nearby edits within the merge window. Ignored-history replacements clear the baseline; undo/redo's own changes do not become new history entries.

`layoutPlugin({ direction = 'LR', nodeGap = 70, rankGap = 90 })` uses Dagre. Command options override defaults. Directions are the supported Dagre rank directions exposed by `LayoutOptions`. Annotations are excluded from the graph layout and attached annotations follow their owners through anchor synchronization. Layout is not an automatic rerouter for custom waypoints or a permission policy.

## Persistence API

`createPersistenceController(runtime, options)` accepts `adapter`, optional `mode`, `debounce`, `restoreOnInstall`, and `onError`. It returns `getSnapshot`, `subscribe`, `save`, `load`, `setMode`, and `dispose`.

`PersistenceAdapter.load({ documentId, signal })` returns null or `{ snapshot, etag? }`, synchronously or asynchronously. `save({ documentId, snapshot, revision, etag?, signal })` returns void or `{ etag? }`, synchronously or asynchronously.

`localStorageAdapter(storage, key?)` accepts getItem/setItem storage and a string key or document-ID-to-key function. The default key is `bolt-flow:<id>`. `PersistenceConflict` is the conflict error class. `persistencePlugin` owns a new controller with manual defaults. `storagePlugin` is the legacy autosaving implementation; do not install both.

## Image export API

`canvasToPng(element, document, options?)` returns a Blob promise. `downloadCanvasPng` downloads that Blob. `exportBounds(document, options?)` calculates included bounds and IDs. `imageExportPlugin({ getElement, defaults? })` registers `export.png`.

Options and default limits are described in [import and export](export.md#png-options). The renderer must be mounted, assets accessible, and dimensions reasonable for the browser's memory limits.
