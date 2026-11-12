# Bolt Flow

**React Flow, with drawing, notes, portable canvas JSON, and optional storage.**

Bolt Flow puts workflow nodes, native drawings, and local comments on the **same React Flow canvas**. An independent, optional drawing plugin uses the public `perfect-freehand` API for pen outlines. A small, framework-independent kernel owns the document, commands, and plugin lifecycle. Neither core nor the React adapter imports optional feature packages; there is no Excalidraw dependency or separate drawing editor.

**Status: 0.1.0 alpha, unpublished.** Package names use the unscoped `bolt-flow-` prefix; ownership and availability must be checked before publishing. Use the local npm workspaces, not registry installation instructions. This is not a claim of Excalidraw or full drawing-editor parity.

## Customizable editor update

The canvas now supports inline rich text, hide/lock/group layers, chained annotations, theme-aware ink, configurable toolbars and presets, and full-canvas PNG export. **Save is explicit**, with an opt-in autosave controller and async host-adapter contract. JSON studio validates and applies generated documents; schema 2 migrates existing schema 1 JSON.

Use the [customization and persistence guide](docs/CUSTOMIZATION.md) for reusable `BoltEditor` primitives, host actions, workflow presentation JSON and migration details. [The implementation plan](docs/CUSTOMIZATION-PLAN.md) records the larger direction; advanced services and editor features remain staged work.

## Try the playground

Requires Node.js 22+ and npm with workspace support.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173/playground for the editor or http://127.0.0.1:5173/docs for the documentation. The root URL redirects to the documentation. The VS Code task **Bolt Flow: playground** also starts it.

- Connect, move, select, edit, duplicate, and delete graph nodes.
- Open Draw in **Select**, then choose pen, rectangle, ellipse, diamond, line, smart arrow, text, comment, annotation eraser, or the playground's custom Triangle/Database tools. Flow/Draw changes the tool UI, not the canvas or document.
- Select moves objects; choose **Pan** explicitly to drag the canvas. Inspector and mode changes do not automatically refit the viewport. Initial fitting and explicit fit/focus, layout, import, and template actions still adjust the view.
- Attach annotations to workflow owners: they follow live dragging, committed moves, layout, and undo/redo with history enabled. Deleting an owner detaches its annotations at their current positions.
- Draw a smart arrow near two distinct workflow nodes to create a real graph edge; otherwise it remains an arrow annotation.
- Add local comment replies, resolve/reopen discussions, or promote annotations into workflow nodes.
- Enable or disable five optional plugins from the plugin library.
- Use `⌘/Ctrl K` for commands, `N` to add a node, and `V` / `H` for selection / panning.
- Change node/edge defaults and per-object styles, CSS classes, markers, canvas settings, theme, templates, and graph layout.
- Click Save or export to keep your canvas; enable Autosave only when wanted. Without either, edits are in memory only.
- The playground remembers plugin choices locally. **BoltFlow includes core editing; feature plugins remain opt-in.** The demo initially enables history.

## Documentation

The [documentation index](docs/guide/README.md) covers installation, a complete React editor, custom layouts and renderers, drawing, themes, commands, plugins, JSON integration, persistence, import/export, and API details. The same Markdown sources power the searchable `/docs` site, with copyable examples and page navigation. Runnable examples have Preview / Code tabs; installation and build commands stay as copyable code. Sandboxes run the local package code; partial examples include visible host setup, and backend examples use labeled local mocks.

Start with [installation & quickstart](docs/guide/quickstart.md), then [editor layout & UI](docs/guide/react-editor.md) and [themes & customization](docs/guide/styling.md). For application integration, read [saving & storage](docs/guide/persistence.md) and [workflow & generated JSON](docs/guide/workflow-json.md).

## Package boundaries

| Package | Responsibility | Extra runtime dependencies |
| --- | --- | --- |
| `bolt-flow-core` | Serializable document, subscriptions, commands, plugin lifecycle | None |
| `bolt-flow-react` | Provider, hooks, controlled canvas, tool/overlay/renderer slots | React peers, `@xyflow/react` |
| `bolt-flow-plugin-draw` | Native ink, custom shapes/fonts, smart edges, attached annotations and comments | `perfect-freehand`, `lucide-react`, `@fontsource/gochi-hand`; core, React adapter, XYFlow and React peers |
| `bolt-flow-plugin-history` | Bounded undo/redo and grouped edits | Core peer only |
| `bolt-flow-plugin-layout` | Directional Dagre graph layout | `@dagrejs/dagre` |
| `bolt-flow-plugin-storage` | Debounced local persistence and adapter interface | Core peer only |
| `bolt-flow-plugin-export` | Versioned JSON import, export, browser download | Core peer only |
| `bolt-flow-plugin-image-export` | Full-content browser PNG capture | `html-to-image`, core peer |

The root workspace installs **all** packages to develop the complete demo. A consumer installs just its selected packages. Enabling a demo plugin loads a bundled JavaScript chunk; it does **not** run npm or execute arbitrary remote packages. Disabling a plugin removes its registrations and listeners, but cannot unload already-evaluated JavaScript from browser memory.

Drawing tools belong to one optional native package, not individually downloadable tool packages. Its `tools` option sets an explicit subset/order; omitting it includes built-ins and custom shapes automatically. The playground uses static `import()` loaders and can load drawing when Draw opens or when a remembered plugin preference enables it. Its [custom drawing configuration](apps/playground/src/drawing.tsx) is lazily imported alongside the plugin, not into the initial application bundle.

## Minimal React integration

Run `npm install` from this repository root to link the workspaces. The playground aliases local package source for development; run `npm run build:packages` before consuming package ESM/declaration exports from another local workspace application. The following example targets those local packages; registry availability is not assumed.

```tsx
import { BoltFlow } from 'bolt-flow-react';
import 'bolt-flow-react/style.css';

const nodes = [
  { id: 'start', position: { x: 100, y: 100 }, data: { label: 'Start here' } },
];

export function Editor() {
  return <div style={{ height: 420 }}>
    <BoltFlow defaultNodes={nodes} fitView fitViewOptions={{ maxZoom: 1 }} />
  </div>;
}
```

Use `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, and `onConnect` with React Flow's state hooks for controlled graphs. Add optional features through `plugins`, or opt into the full shell with `editor`. No provider or manual runtime lifecycle is required. See the [React Flow-style API](docs/guide/react-flow.md) for complete controlled, drawing, and explicit-save examples. The existing provider/runtime APIs remain available for advanced integrations.


Import `bolt-flow-react/style.css` explicitly. It currently includes `@xyflow/react/dist/style.css` through a CSS `@import`; if your CSS pipeline does not resolve that import, include `@xyflow/react/dist/style.css` explicitly as well. Built drawing consumers must also import `bolt-flow-plugin-draw/style.css`; do not rely on the playground's source imports to supply packaged CSS.

Drawing CSS imports `@fontsource/gochi-hand/latin-400.css` from the plugin's direct Fontsource dependency to self-host Gochi Hand. If your pipeline does not resolve package CSS `@import`s, import that font CSS separately too and ensure the package is resolvable by your app (declare it directly if required by your resolver). Custom fonts are loaded by host CSS, not by registering a family string.

Canvas configuration includes custom `nodeTypes`, `edgeTypes`, selection/panning behavior, connection validation, snapping, zoom bounds, themes, controls, and minimap. Unmanaged React Flow props pass through to the underlying engine. Use default graph props for internal ownership or controlled graph props for host ownership. The document adapter bridges committed edits and feature commands. Positions commit at drag end; attached annotations also follow the live drag. Controlled selection updates are separate from document synchronization, preserving live drag positions instead of restoring saved positions when selection changes. Use `useBolt()`, `useBoltSnapshot()`, and the re-exported `useReactFlow()` inside the provider.

`nodeDefaults` provides `style`, `className`, `draggable`, `selectable`, and `connectable` defaults for non-annotation nodes. `edgeDefaults` supplies edge fields other than IDs/endpoints and is also used when creating handle connections. Per-object fields override defaults; `style` merges by property. Nodes/edges persist serializable `style` and `className`; edges also support `labelStyle`, `labelBgStyle`, routing type, animation, and `markerStart` / `markerEnd`. Set a marker to `false` to suppress an inherited marker; leave it undefined to inherit. Markers use `{ type: 'arrow' | 'arrowclosed', color?, width?, height? }`.

These defaults are React props, not automatically saved document settings. The playground persists its own appearance configuration in `extensions.appearance`. Its inspector edits document fields; custom renderers and host CSS determine their visual effect. The adapter supports the fields declared in `BoltNode` and `BoltEdge`, not every XYFlow field or full parented groups/subflows.

## Add optional features

With `BoltFlow`, pass a stable plugin array, such as `plugins={[historyPlugin()]}` (defined outside render). The advanced snippets below assume an existing runtime, available through `ref.current.runtime` or your own `BoltProvider`.

```ts
import { historyPlugin } from 'bolt-flow-plugin-history';

runtime.use(historyPlugin({ limit: 80, mergeWindow: 500 }));
runtime.execute('history.undo');
runtime.execute('history.redo');

// Static import expressions let bundlers produce optional feature chunks.
await runtime.load('layout', async () => {
  const { layoutPlugin } = await import('bolt-flow-plugin-layout');
  return layoutPlugin({ direction: 'LR', nodeGap: 70, rankGap: 90 });
});
runtime.execute('layout.arrange', { direction: 'TB' });
runtime.remove('layout');
```

### Native connected ink

```ts
// Required explicitly for consumers of the built drawing package.
import 'bolt-flow-plugin-draw/style.css';

await runtime.load('draw', async () => {
  const { drawPlugin } = await import('bolt-flow-plugin-draw');
  return drawPlugin({
    defaults: { color: '#7963d2', size: 3, smartConnect: true },
    tools: ['pen', 'rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'text', 'comment', 'eraser'],
    toFlowNode: (annotation) => ({
      type: 'default',
      data: { label: String(annotation.data.label ?? 'New step') },
      width: 220,
      height: 120,
    }),
  });
});
```

Share one host-controlled `CanvasToolProps` object between `<BoltTools {...interaction} />` and `<BoltCanvas interaction={interaction} />`, both inside `BoltProvider`. It contains `tool`, JSON `options`, and optional `onToolChange`, `onOptionsChange`, `onCreated(id, kind)`, and `onMessage` callbacks. The host supplies state/setters for interactive tool changes. Use `select`, `pan`, or `draw.pen`, `draw.rectangle`, `draw.ellipse`, `draw.diamond`, `draw.line`, `draw.arrow`, `draw.text`, `draw.comment`, and `draw.eraser`; custom shapes use `draw.<id>`. Plugin `tools` and `draw.create.shape` use raw IDs instead (for example `triangle`, not `draw.triangle`). The adapter defaults drag-to-pan to explicit `pan`, disables graph dragging/connections/selection while panning, and defaults node/selection auto-pan off. React Flow pan props can override those defaults.

`BoltTools` renders `canvas.tools` contributions. `BoltCanvas` mounts `canvas.overlay` inside the same React Flow viewport and merges `canvas.nodeTypes` / `canvas.edgeTypes` contributions with host renderers. Active drawing tools arbitrate pointer interaction with graph editing; there is no `surface` switch or embedded editor API.

`InkSettings` contains `color`, `fill`, `size`, `text`, `fontSize`, `fontFamily`, `smartConnect`, `anchorId`, and `keepTool`. Defaults include font size 22, `"Gochi Hand", cursive`, and `keepTool: false`. Successful pointer creation requests Select; `keepTool: true` allows repeated drawing, but text, comments, and connected smart edges always request Select, even when reusing an edge. Eraser stays active until another tool is chosen. Escape cancels and requests Select. Hosts must apply `onToolChange`; calling `draw.create` directly does not change tool state.

`draw.create` accepts `{ shape, points, settings? }`, with finite `[x, y, pressure]` samples in flow coordinates, and returns `{ id, kind: 'node' | 'edge', connected? }`.

#### Custom shapes, fonts, and colors

Pass `shapes: DrawShapeDefinition[]` to `drawPlugin`. Each definition has `id`, `label`, optional `icon`, required `path({ width, height, size })`, and optional React `component`. The nonempty SVG path is saved as serializable `data.customPath`, providing a fallback when the drawing plugin is enabled without the custom definition. Components and path functions are trusted local code, never serialized or executed from imported documents. IDs must match `^[a-z][a-z0-9-]*$`, be unique, and not use reserved built-in names: `pen`, `rectangle`, `ellipse`, `diamond`, `line`, `arrow`, `text`, `comment`, `eraser`, `select`, or `pan`. Omit `tools` for automatic custom-tool inclusion; an explicit list controls the complete subset/order.

`fonts: DrawFont[]` appends `{ id, label, family }` entries to Normal (`normal`, Inter/system sans-serif stack), Handwritten (`handwritten`, self-hosted Gochi Hand), and Code (`code`, system monospace stack). Font IDs must be unique, including preset IDs. Only family strings persist, not font assets; load custom faces with host CSS. `colors: string[]` replaces the toolbar ink palette, not the set of permitted saved colors. The merged fonts are contributed through `draw.fonts` for host inspectors; the playground inspector consumes this slot without eagerly loading drawing.

See the [small consumer triangle/font example](packages/plugin-draw/README.md#consumer-triangle-and-font-example) and the playground's [Triangle/Database and Editorial configuration](apps/playground/src/drawing.tsx).

- Drawings/text use `bolt-drawing`; comments use `bolt-comment`. Both are `role: 'annotation'` nodes with serializable data, geometry, and dimensions in the main document.
- Smart arrows use endpoint proximity to two distinct non-annotation nodes (32 flow-unit tolerance). They create a styled `smoothstep` edge with an arrowhead, or return an existing source/target edge without restyling it. If no pair matches or smart connection is off, they remain annotations. This is not shape recognition or reversible graph/sketch binding.
- `draw.attach({ id, ownerId })` records `anchor: { nodeId, offset }`; `draw.detach(id)` releases it. Owners may be workflow nodes or annotations; attachments must be acyclic. Moving/resizing an attached annotation updates its offset; owner moves/layout preserve it. Deleting an owner detaches rather than deletes annotations.
- `draw.reply({ id, text })` adds a local timestamped reply; `draw.resolve(id)` toggles resolved/open state. These are document records, not authenticated multiplayer discussions.
- `draw.convert(id)` promotes an annotation using `toFlowNode`, preserves its ID/position, clears its anchor, and makes it connectable. Supply a callback and matching `nodeTypes` for your application's custom flow nodes.
- Selection, dragging, resizing, and whole-annotation erasing operate on native nodes. History, if enabled, covers graph edits, drawings, comments, styles, attachment changes, promotion, and layout together.

Removing drawing unregisters its UI/commands, not saved objects. Missing node renderers show placeholders until the plugin is enabled again. Unknown JSON extension data is preserved, including legacy `extensions.excalidraw` scenes as **opaque data only**: they are not rendered, interpreted, or migrated into native drawings.

### Persistence and export

```ts
import { storagePlugin } from 'bolt-flow-plugin-storage';
import { exportPlugin } from 'bolt-flow-plugin-export';

runtime.use(storagePlugin({
  key: 'my-app:canvas:123',
  debounce: 600,
  onError: (error) => console.error('Save failed', error),
}));
runtime.use(exportPlugin({ maxImportBytes: 25 * 1024 * 1024 }));

runtime.execute('storage.save');
const json = runtime.execute<undefined, string>('export.json');
runtime.execute('import.json', json);
runtime.execute('export.download'); // Browser only
```

The legacy `storagePlugin` retains its original automatic behavior. For explicit manual or async saving, use `createPersistenceController` or `persistencePlugin` from the [new guide](docs/CUSTOMIZATION.md#save-only-when-requested). Legacy storage accepts a synchronous `getItem` / `setItem` adapter for testing or host-specific persistence. It restores once when enabled, resets the history baseline on a changed restore, debounces writes, and saves on removal/pagehide. Browser quota/security errors are reported via `onError` and `storage.status`; enabling the plugin does not guarantee successful persistence. Long pen strokes and opaque legacy data can exceed localStorage quotas; choose an appropriate storage backend for production.

Import/export and storage serialize the complete validated schema-version-2 document (schema 1 imports are migrated): nodes, edges, native annotation/comment data, anchors, per-object styles, and extensions. Unknown extension keys survive without their plugins installed, including opaque legacy Excalidraw scenes. React components, functions, DOM objects, and transient tool/selection state are not portable document data. An explicitly saved `view` is portable. Import validates before replacing live state; it does not migrate legacy drawings or register missing renderers.

## Write a plugin

```ts
import type { BoltPlugin } from 'bolt-flow-core';

export function renamePlugin(): BoltPlugin {
  return {
    id: 'rename',
    name: 'Rename canvas',
    version: '1.0.0',
    setup(ctx) {
      ctx.registerCommand({
        id: 'rename.set',
        title: 'Rename the canvas',
        execute(name: string) {
          ctx.updateDocument((draft) => { draft.name = name; }, {
            source: 'rename',
            group: 'rename',
          });
        },
      });
      // Command registrations, contributions, and document subscriptions
      // are owned by this plugin and cleaned up automatically.
      // Return a function to clean up timers or external resources.
    },
  };
}
```

- `requires: ['other-plugin']` declares plugin-ID dependencies; install them first.
- `use()` is synchronous, duplicate-ID-idempotent, and rolls back partial registrations and provisional document edits if setup throws. Version compatibility negotiation is not implemented.
- `load(id, loader)` deduplicates simultaneous loads, validates module identity, and permits retries.
- `remove()` prevents disabling a dependency still needed by another plugin.
- `contribute(slot, value)` provides generic host-defined extension slots. The React adapter consumes `canvas.tools`, `canvas.overlay`, `canvas.nodeTypes`, and `canvas.edgeTypes`; applications may define additional slots. A globally typed slot map is not enforced by core.
- Mutate only drafts provided to `updateDocument()`. Snapshots are deeply frozen. JSON data must be finite and serializable. Imports validate schema version, IDs, and edge references atomically.
- `updateDocument()` synchronizes owner anchors in the same transaction before validation. `replaceDocument()` validates a supplied snapshot but does not recompute positions or detach missing owners; replacements must already have valid anchors.
- `history: 'ignore'` establishes a new history baseline. `group` merges nearby changes with the same key.
- Commands and plugin code are trusted local application code, **not sandboxed**. Only install plugins you trust. Runtime payload validation belongs to each command.

## Validate and build

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run test:consumer
npm audit
```

- `npm test` checks core/plugin behavior and compiles the complete quickstart and custom layout documentation examples against public types. `test:e2e` covers the editor, responsive layouts, documentation routes/search/copy, focus behavior, and canvas preservation across navigation.
- `test:consumer` builds the packages and checks their real exports (no source aliases), public CSS, local font assets, and resized custom-shape fallback rendering in Chromium. The production playground includes the Gochi Hand license at `licenses/gochi-hand.txt` alongside its bundled font assets.
- Rerun drawing/undo, smart edges, comments, styles, cancellation, resizing, erasing, import/unload restoration, custom shape/font portability, selection/drag stability, and viewport checks. Chromium viewport tests are not physical-device or Safari qualification.
- Before release, verify production lazy JavaScript/CSS/font assets and same-canvas ink, then inspect declarations, documentation, licenses, and CSS in every package dry run. Nothing is published by these checks.
- Rerun all checks against release candidates; validation is not a production-readiness or downstream security guarantee.
- `tsup` emits ESM, declaration files, and source maps for each package.
- Vite builds the playground. Measure generated bundles rather than inferring bundle size or performance from optional loading.

Preview the built demo with `npm run preview -w bolt-flow-playground`.

## Publishing checklist

1. Confirm ownership of the npm package names and choose the final package names.
2. Run type checks, unit/browser tests, production builds, and dependency audits.
3. Inspect `npm pack --dry-run -w bolt-flow-core` and every other package.
4. Only with explicit authorization, publish core first, React second, then individual plugins after reviewing generated artifacts.
5. Add release automation, changelogs, compatibility/version policy, and registry metadata before wider adoption.

Packages remain unpublished. Publishing packages or pushing repositories requires explicit authorization.

### Dependency security

The current manifests have no Excalidraw dependency and no Excalidraw-related overrides. Do not carry forward the old integration's override instructions. Run `npm audit` against the actual installed dependency tree and review advisories before release; no fixed vulnerability count or downstream security guarantee is asserted here.

## Honest boundaries and next steps

This alpha uses native annotations and workflow nodes in one React Flow viewport, with shared document history when enabled. It is an independent implementation, not an Excalidraw integration or a full drawing editor. The following are **not implemented or qualified**:

- Images/image tools, rotation, container groups/subflows, frames, managed shape libraries, or advanced drawing-editor parity. Host-defined shapes are supported, not a shape-library browser.
- Individually downloadable drawing tools or reversible graph/sketch synchronization.
- Multiplayer/CRDT synchronization, presence, accounts, cloud storage, or backend AI generation.
- Legacy Excalidraw scene rendering or migration; preserving opaque JSON is not compatibility with its editor.
- Canvas SVG export. PNG is available through the optional image-export package; the JSON export package remains headless.
- Sandboxed third-party plugins, remote plugin marketplace, capability permissions, or runtime semver negotiation.
- Spatial indexing, patch-based history, large-document performance guarantees, cross-browser/mobile-touch qualification, or a complete accessibility audit.

The headless store currently clones, validates, and freezes whole documents per update. This favors correctness and a simple API over high-frequency large-scene performance. Long strokes, opaque extension payloads, and snapshot histories amplify memory usage. Benchmark and consider structural sharing / operation-based history before claiming scale.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the staged plan toward the larger vision.

## License and upstream attribution

MIT © 2026 Bolt Flow contributors. React Flow / XYFlow, perfect-freehand, Dagre, Lucide, html-to-image, Fontsource/Gochi Hand, and other upstream dependencies retain their own licenses, trademarks, and attribution requirements. Preserve font licenses/notices with distributed assets. Keep React Flow attribution visible; Bolt Flow is not an official XYFlow or Excalidraw product. Excalidraw remains credited as the previous integration, not a current dependency; preserve any applicable notices with retained upstream material or legacy content.

The user-supplied XYFlow Pro example was inspected for the concept only. Its code was **not copied**, due to license restrictions. Native drawing was independently implemented using the public perfect-freehand API; this does not grant rights to XYFlow Pro example code.

The playground uses Lucide icons, system font stacks, and self-hosted Gochi Hand through Fontsource when drawing CSS loads; no remote font service is required. The drawing plugin does not load Excalidraw assets. Canvas content is not sent to a Bolt Flow backend; host-added fonts, plugins, and services require their own data/privacy review.