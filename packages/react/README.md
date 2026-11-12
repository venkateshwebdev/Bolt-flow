# bolt-flow-react

Composable React 19 bindings for one React Flow canvas containing workflow nodes and optional native annotations. Alpha 0.1.0; unpublished, with validation ongoing. Use local npm workspaces and build package exports as described in the [root README](../../README.md).

## Start with BoltFlow

```tsx
import { BoltFlow } from 'bolt-flow-react';
import 'bolt-flow-react/style.css';

export function App() {
  return <div style={{ height: 420 }}>
    <BoltFlow defaultNodes={[
      { id: 'start', position: { x: 80, y: 100 }, data: { label: 'Start' } },
    ]} fitView fitViewOptions={{ maxZoom: 1 }} />
  </div>;
}
```

`BoltFlow` owns the provider/runtime lifecycle. It accepts familiar `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `onConnect`, custom renderers, viewport props, and React Flow children. Use `defaultNodes`/`defaultEdges` for internal state. Feature `plugins` are optional; `editor` opts into the full existing shell. A `BoltFlowRef` exposes `getDocument()`, `toJSON()`, `loadJSON(json)`, and the advanced `runtime`. `onDocumentChange` observes committed changes. Nothing saves automatically.

Read the [complete React Flow-style API guide](../../docs/guide/react-flow.md), including controlled state, drawing, JSON saving, customization, and ownership. React Flow's `useNodesState`, `useEdgesState`, `addEdge`, `applyNodeChanges`, `applyEdgeChanges`, `Background`, `Controls`, `MiniMap`, `Panel`, and relevant types are reexported. Importing directly from `@xyflow/react` works too.

The APIs below remain available for advanced applications that own or share a runtime.

## Setup and CSS

Exports `BoltProvider`, `BoltCanvas`, `BoltTools`, `useBolt`, `useBoltSnapshot`, `CanvasToolProps`, `CanvasExtension`, `BoltCanvasProps`, and selected XYFlow primitives/types. Wrap the canvas in `BoltProvider` with a stable `BoltRuntime` and an explicitly sized parent. Dispose the runtime when its owning editor is permanently destroyed.

Import `bolt-flow-react/style.css` explicitly. It currently includes `@xyflow/react/dist/style.css` via CSS `@import`; if that import is not resolved by your CSS pipeline, import `@xyflow/react/dist/style.css` explicitly too. Consumers of the built optional drawing package must also import `bolt-flow-plugin-draw/style.css`. Source-aliased playground behavior is not a substitute for consumer CSS setup.

Drawing CSS imports `@fontsource/gochi-hand/latin-400.css` from the drawing plugin's direct dependency for self-hosted handwriting. If your pipeline does not resolve package CSS `@import`s, import that font CSS separately and make the dependency resolvable from the host app (declare it directly if necessary). Custom font faces are loaded by host CSS. The React adapter itself does not depend on Fontsource or drawing.

## Tools and rendering slots

Share the same host-controlled `CanvasToolProps` between `BoltTools` and `BoltCanvas`'s `interaction` prop. Supply `tool`, JSON `options`, and callbacks `onToolChange`, `onOptionsChange`, `onCreated(id, kind)`, and `onMessage` as needed. The host owns tool/option state; default interaction is `select` with empty options.

- `BoltTools` renders `canvas.tools` contributions.
- `BoltCanvas` mounts `canvas.overlay` contributions inside React Flow and combines `canvas.nodeTypes` / `canvas.edgeTypes` with host renderers. Host renderers take precedence for matching types.
- Tool/overlay contributions use `CanvasExtension`: `{ id, component }`, where the component receives `CanvasToolProps`.
- Non-`select`/`pan` tools disable graph dragging, connecting, selection, and delete keys at canvas level. Explicit `pan` disables node dragging, connecting, and selection, and defaults `panOnDrag` to true; other tools default it to false. `select` defaults `selectionOnDrag` to true. Hosts can override pan behavior through React Flow props. `autoPanOnNodeDrag` and `autoPanOnSelection` default to false.
- Unrecognized node types show a missing-renderer placeholder without deleting saved data. Removing drawing unregisters rendering/tools; re-enabling restores its native renderers.

There is no separate drawing surface or embedded editor API. The optional drawing plugin supplies pen, shapes, smart arrows, text, and local comments without being imported into this adapter's defaults.

Drawing interaction IDs are prefixed (`draw.pen`, `draw.triangle`); plugin `tools` options and `draw.create.shape` use raw IDs (`pen`, `triangle`). The plugin supports `shapes`, `fonts`, `colors`, and drawing defaults; configure trusted shape functions/components in `drawPlugin`, not in JSON `interaction.options`. See the [drawing contracts and consumer example](../plugin-draw/README.md#options-and-exported-geometry). It contributes merged preset/custom font metadata through `draw.fonts` for host inspectors; this is not an adapter rendering slot. The playground inspector consumes it without importing drawing at runtime.

The playground starts Draw in **Select** and lazily loads its [custom shape/font configuration](../../apps/playground/src/drawing.tsx) with the drawing plugin. Successful pointer creation requests Select by default (`keepTool: false`); text, comments, and connected smart edges request Select even with `keepTool: true`. Hosts must update tool state through `onToolChange` and can select the created object in `onCreated`. Eraser remains active until another tool is chosen.

`BoltCanvas` defaults `fitView` to true for initial fitting. The playground does not automatically refit on inspector or Flow/Draw changes; explicit fit/focus, layout, import, and template actions still adjust the viewport. Keep UI layout changes separate from viewport commands.

## Defaults, styles, and persistence

`nodeDefaults` accepts `style`, `className`, `draggable`, `selectable`, and `connectable`; these defaults do not apply to `role: 'annotation'` nodes. `edgeDefaults` accepts edge fields except `id`, `source`, and `target`, and is also applied to new handle connections. Per-object fields override defaults; `style` merges by property. Other fields, including label styles, are replaced rather than deeply merged.

Nodes and edges persist serializable `style` / `className`. Edges additionally support label styling, routing, animation, and markers. `markerStart: false` / `markerEnd: false` suppress inherited markers; undefined inherits them. Marker objects have `type: 'arrow' | 'arrowclosed'` and optional `color`, `width`, `height`. Defaults are React props, not automatically persisted: the playground saves its own settings in `extensions.appearance`.

Custom `nodeTypes`, `edgeTypes`, and unmanaged React Flow props are supported. `BoltFlow` supports controlled graph arrays and callbacks; the low-level provider/canvas API defaults to runtime ownership. Controlled `selectedNodeIds` / `selectedEdgeIds` updates change selection separately from document synchronization, preserving current live drag positions rather than remapping saved positions on selection changes. Drag positions commit at drag end, while attached annotations follow live owner dragging; independently moved annotations update their offsets. Owner deletion detaches annotations through core synchronization. Optional history restores document snapshots, not transient selection or viewport state.

Only the portable `BoltNode` / `BoltEdge` contract is supported, not every XYFlow field or full groups/subflows. Custom renderers/host CSS determine visual styling. Unknown extensions, including legacy Excalidraw scenes, remain opaque and are not rendered or migrated. Requires core and React/React DOM peers, with XYFlow as a dependency; no Excalidraw dependency or parity claim. Images, rotation, multiplayer, and full drawing-editor features are outside the current contract.

See the [root validation commands and dated snapshot](../../README.md#validate-and-build). Browser regressions cover viewport stability during Draw selection/dragging and inspector changes; the built-consumer check verifies public CSS without source aliases. Release qualification remains separate.

MIT © 2026 Bolt Flow contributors. XYFlow retains its own license and attribution requirements.
## Configurable editor components

`BoltEditor`, `BoltToolbar`, `BoltLayers`, `BoltInspector`, `BoltSlot`, `editorUIPlugin`, `useBoltActions`, `useBoltShortcuts`, and `BoltWaypointEdge` are public exports. `editingPlugin` is re-exported for convenience and installed automatically only by `BoltFlow`. The optional shell supports replacement/hideable panels, host actions, CSS variables, controlled tools and canvas props. `BoltProvider readOnly` protects built-in editing commands/UI. `BoltCanvas readOnly` protects canvas interactions. Locked/hidden nodes and logical group selection are mapped to React Flow; chained anchors follow live drags.

See [the customization guide](../../docs/CUSTOMIZATION.md) and the [built consumer example](../../tests/consumer/main.tsx).
