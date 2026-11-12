# bolt-flow-plugin-draw

Independent optional native drawing and local-comment plugin on the **same React Flow canvas** as workflow nodes. Uses the public perfect-freehand API for pressure-aware pen outlines; no Excalidraw dependency or separate editor. Alpha 0.1.0; unpublished, with validation ongoing. Use the local npm workspaces in the [root README](../../README.md).

## Integration

Register `drawPlugin(options)` directly or through `runtime.load('draw', async () => (await import('bolt-flow-plugin-draw')).drawPlugin(options))`. Use static, trusted loaders so bundlers can split optional code. Core and the React adapter never import drawing by default.

Inside `BoltProvider`, render `BoltTools` with a host-controlled `CanvasToolProps` object and pass the same object to `BoltCanvas` through `interaction`. Use `tool: 'draw.pen'` (or another `draw.*` tool), JSON `options`, and state callbacks `onToolChange` / `onOptionsChange`; `onCreated(id, kind)` and `onMessage` are optional. Use prefixed IDs such as `draw.triangle` for interaction state, but raw IDs such as `triangle` in plugin `tools` and `draw.create.shape`. Shape definitions belong in plugin configuration, never in JSON interaction options. `select` / `pan` are host modes; the adapter defaults drag-to-pan to explicit `pan`, with React Flow prop overrides available.

**CSS must be explicit for built consumers:** import `bolt-flow-react/style.css` and `bolt-flow-plugin-draw/style.css`. React CSS currently imports `@xyflow/react/dist/style.css`; import XYFlow CSS separately if your pipeline does not resolve it. The playground's source-level drawing CSS import does not guarantee built JavaScript consumers receive that CSS. Give the canvas parent an explicit size.

Drawing CSS imports `@fontsource/gochi-hand/latin-400.css`. Fontsource Gochi Hand is a direct plugin dependency, serving the handwritten font from local assets rather than a remote font service. If your pipeline does not resolve package CSS `@import`s, also import `@fontsource/gochi-hand/latin-400.css` explicitly in your application and ensure that package is resolvable there (declare it directly if your dependency resolver requires it). Keep font files and their upstream license/notices with distributed assets. Custom font faces must be loaded by host CSS; a font-family string alone does not download a font.

The plugin contributes `bolt-drawing` / `bolt-comment` to `canvas.nodeTypes`, the pointer overlay to `canvas.overlay`, and its toolbar to `canvas.tools`. `BoltTools` and `BoltCanvas` consume these slots; no `surface`, `editorProps`, or graph-to-sketch bridge API is used. It also contributes the merged `DrawFont[]` to `draw.fonts`; the playground inspector reads `runtime.getContributions<DrawFont[]>('draw.fonts').flat()` and merges it with fallback presets, without a runtime import of drawing. Consumer inspectors can do the same.

## Options and exported geometry

- `DrawPluginOptions.defaults?: Partial<InkSettings>` sets drawing defaults.
- `tools?: (DrawShape | 'eraser')[]` supplies an explicit tool subset/order. Omit it to include pen, rectangle, ellipse, diamond, line, smart arrow (`arrow`), text, comment, then custom shapes, then whole-annotation eraser. An explicit list does not automatically add custom shapes; unknown/duplicate IDs are rejected. Select and Pan remain toolbar modes outside this list. These tools are not independently downloadable packages.
- `shapes?: DrawShapeDefinition[]` adds host-defined shapes: `{ id, label, icon?, path, component? }`. IDs must match `^[a-z][a-z0-9-]*$` and be unique. Reserved IDs are `pen`, `rectangle`, `ellipse`, `diamond`, `line`, `arrow`, `text`, `comment`, `eraser`, `select`, and `pan`.
- `path({ width, height, size }): string` is required even with a component; return a nonempty SVG path in local shape coordinates. Creation saves its result as serializable `data.customPath`, with original dimensions for scaling. An optional trusted local React `component` receives `{ node }` (`data`, `width`, `height`) for richer rendering. Functions, icons, and components are never serialized or loaded from imported documents. Without that custom definition, the enabled drawing plugin renders the saved SVG fallback; without the drawing plugin, the adapter shows a placeholder.
- `fonts?: DrawFont[]` appends `{ id, label, family }` entries to Normal (`normal`: `Inter, system-ui, sans-serif`), Handwritten (`handwritten`: `"Gochi Hand", cursive`), and Code (`code`: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`). IDs must be unique, including the three preset IDs, and all fields nonempty. Normal and Code are font stacks, not bundled Inter/code font downloads. Host CSS supplies custom faces; saved annotations contain the family string, not font assets.
- `colors?: string[]` replaces the toolbar ink swatches. The exported `defaultColors` are `#252936`, `#7963d2`, `#2563eb`, `#059669`, `#e08a22`, and `#e0526e`; this is a palette, not a restriction on persisted colors or a replacement for fill choices.
- `toFlowNode?: (annotation: BoltNode) => Pick<BoltNode, 'data' | 'type' | 'width' | 'height'>` controls promotion to the consumer's flow-node type/data/dimensions. Register the matching renderer with `nodeTypes` if needed.
- `InkSettings` contains `color`, `fill`, `size`, `text`, `fontSize`, `fontFamily`, `smartConnect`, `anchorId`, and `keepTool`. Defaults are purple ink (`#7963d2`), transparent fill, size 3, empty text, font size 22, `"Gochi Hand", cursive`, smart connection on, no owner (`''`), and `keepTool: false`. `draw.create` requires size/font size to be finite, greater than zero, and at most 200.
- Exported geometry helpers: `inkPath(points, size)`, `makeDrawing(shape, samples, settings, id?)`, `findFlowNode(nodes, point, tolerance = 32)`, and `defaultSettings`. Also exports `DrawShape`, `Sample`, `InkSettings`, `DrawCreateInput`, and `DrawResult` types. `Sample` is `[x, y, pressure]`; helpers create geometry/nodes, not runtime transactions.

### Consumer triangle and font example

Configure once when registering the plugin on an existing runtime:

```ts
import { drawPlugin, type DrawShapeDefinition } from 'bolt-flow-plugin-draw';
import 'bolt-flow-react/style.css';
import 'bolt-flow-plugin-draw/style.css';

const triangle: DrawShapeDefinition = {
	id: 'triangle',
	label: 'Triangle',
	path: ({ width, height, size }) => {
		const inset = Math.max(8, size * 2);
		return `M ${width / 2} ${inset} L ${width - inset} ${height - inset} L ${inset} ${height - inset} Z`;
	},
};

runtime.use(drawPlugin({
	shapes: [triangle],
	fonts: [{ id: 'editorial', label: 'Editorial', family: 'Georgia, "Times New Roman", serif' }],
	colors: ['#7963d2', '#2563eb', '#059669'],
	defaults: { fontFamily: 'Georgia, "Times New Roman", serif', keepTool: false },
	// Omit tools to include built-ins and triangle automatically.
	// tools: ['triangle', 'text', 'eraser'], // Optional explicit subset/order.
}));
// Set the shared interaction.tool to 'draw.triangle' to draw this shape.
```

This example uses a system serif stack; for a custom web font, load its `@font-face` through host CSS and use that family in `fonts`/`defaults`. The playground's [drawing configuration](../../apps/playground/src/drawing.tsx) supplies Triangle, Database, an Editorial font stack, colors, and defaults. [Its loader](../../apps/playground/src/App.tsx) lazily imports that module alongside the optional drawing plugin with static `import()` expressions.

## Stable Draw interactions

The playground opens Draw in **Select**, not Pen. Select moves/selects objects without drag-panning; choose **Pan** explicitly to move the viewport (`H` in the playground, `V` to return). The React adapter disables node dragging/connections/selection in Pan and defaults node/selection auto-pan off. Opening the inspector or switching Flow/Draw does not automatically refit the viewport. Initial fitting and explicit fit, focus, layout, import, and template actions remain available.

Successful pointer creation requests `select` via `onToolChange` by default. `keepTool: true` allows repeated drawing, but text, comments, and connected smart edges (including reused edges) always request Select. Eraser remains active until another tool is chosen. Escape cancels the draft and requests Select; pointer cancellation/lost capture discards the preview. These are overlay interactions, not side effects of calling `draw.create` directly; hosts must apply the callbacks. The playground selects created objects through `onCreated`.

The React adapter applies controlled selection changes separately from document synchronization, so selecting an object does not restore saved positions over an in-progress drag. Live owner-relative movement is retained until positions commit at drag end.

## Commands

Call these with `runtime.execute(commandId, payload)`:

| Command | Payload | Behavior |
| --- | --- | --- |
| `draw.create` | `{ shape, points, settings? }` | Creates an annotation or smart edge; returns `{ id, kind: 'node' \| 'edge', connected? }`. Samples must contain finite flow-coordinate x/y/pressure values. |
| `draw.attach` | `{ id, ownerId }` | Attaches an annotation to a workflow or annotation owner in an acyclic chain, preserving its offset. |
| `draw.detach` | Annotation ID | Removes its anchor without moving it. |
| `draw.reply` | `{ id, text }` | Appends a nonempty local reply with generated ID and timestamp to a comment. |
| `draw.resolve` | Comment ID | Toggles resolved/open state. |
| `draw.convert` | Annotation ID | Promotes via `toFlowNode`, preserving ID/position, removing its anchor, and enabling connections. Default is a 220 × 120 `default` node with a label. |
| `draw.erase` | Annotation ID | Deletes a whole annotation and incident edges; requires the eraser tool to be allowed. |

With `smartConnect` enabled, arrow endpoints within 32 flow units of two distinct non-annotation nodes create a `smoothstep` edge with ink stroke/width and an `arrowclosed` marker. An existing edge with those source/target IDs is returned without restyling. Otherwise the arrow remains an annotation. This is endpoint matching, not shape recognition or reversible graph/sketch conversion.

## Native document behavior

Drawings and text are `bolt-drawing` nodes; comments are `bolt-comment` nodes. Both use `role: 'annotation'`, dimensions, position, and JSON data with local samples/style/text. They can be selected, dragged, resized, and erased. Ink styling lives in node data; portable node/edge `style` and `className` remain available through the adapter. Canvas `nodeDefaults` excludes annotations; smart edges have their own explicit style/marker. A marker set to `false` suppresses inherited arrows.

`anchor: { nodeId, offset }` makes annotations follow owner dragging/layout. Independently dragging/resizing an annotation updates the offset. Core synchronizes anchors during `updateDocument()`; deleting an owner detaches annotations at their current positions. Optional history covers graph edits, drawing, attachment changes, local replies/resolution, styles, promotion, and layout in one document history. The plugin has no separate undo engine.

Storage/export preserve native nodes, edges, anchors, replies, styles, and unknown JSON extensions. Disabling drawing removes UI/commands but retains objects; missing renderers show placeholders until re-enabled. Legacy `extensions.excalidraw` scenes are preserved as **opaque data only**, not rendered or migrated into native nodes.

## Limits, provenance, and validation

No multiplayer, authenticated discussions, images, rotation, full container groups/subflows, frames, managed shape libraries, SVG export, or Excalidraw/full drawing-editor parity. Host-defined shapes do not provide a shape-library browser or remote renderer execution. Long strokes and whole-document histories need performance and storage-quota review. No Excalidraw-era overrides are present in the current manifests; audit the actual installation instead of reusing obsolete overrides.

The user-supplied XYFlow Pro example was inspected for the concept only. Its code was not copied because of license restrictions. This is an independent implementation using perfect-freehand's public API, not a license to redistribute XYFlow Pro examples.

Direct dependencies are perfect-freehand, Lucide React, and Fontsource Gochi Hand, with core, React adapter, XYFlow, React, and React DOM peers. See the [root validation commands and dated snapshot](../../README.md#validate-and-build). `npm run test:consumer` checks built exports, public CSS, local font loading, and resized custom geometry after removing its host definition. These checks do not establish production readiness.

MIT © 2026 Bolt Flow contributors. Keep XYFlow/React Flow attribution and the upstream licenses/notices for perfect-freehand, Lucide, and Fontsource/Gochi Hand font assets. Excalidraw retains its license/trademarks as the previous integration; retain applicable notices with any legacy upstream material, without implying a current dependency.
## Rich annotation tools

Drawing now supports inline structured rich text, `opacity`, separate `textColor`, `auto` theme colors, selected-object actions, wider outline hit targets and optional Shift attachment. Owner pickers accept annotations as well as workflow nodes, with cycle validation. `toolbar` replaces/disables the default toolbar; host interaction options support `hiddenTools`, `toolOrder`, `palette` and `showAttachments`. Existing `tools` configuration remains the creation allowlist.

Exports also include `RichText`, `TextRun`, normalization/plain-text/HTML conversion helpers and `importWorkflowCanvas` for the reference workflow's canvas v1. These do not implement Excalidraw migration. See [the guide](../../docs/CUSTOMIZATION.md#rich-drawing-and-routing) for behaviors, importer limits and supported editing gestures.

### Fast pointer gestures

Active strokes survive host rerenders and inline callback changes. Coalesced pointer samples and the final release position are preserved. Escape, actual tool changes, pointer cancellation, and capture loss cancel only the unfinished draft. Completed annotations remain part of the document and shared history.

The documentation site's drawing guide includes editable sandboxes for every example: run the repository and open `/docs/drawing`.
