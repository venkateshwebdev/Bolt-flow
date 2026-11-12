# Bolt Flow workspace

- Unpublished 0.1.0 alpha npm-workspaces monorepo: TypeScript, React 19, XYFlow, independent optional perfect-freehand native drawing, tsup, Vite. Do not assume the proposed npm scope is available or packages are published.
- Use Node.js 22+; run `npm install` from the root. The playground aliases local source; run `npm run build:packages` before consuming built workspace exports.
- Keep [core](../packages/core/src/index.ts) free of runtime dependencies and DOM/React imports.
- Keep optional features in independent packages; never import them into core or React defaults.
- Use static `import()` loaders for optional demo plugins. Never execute arbitrary remote plugin code.
- Native pen, rectangle, ellipse, diamond, line, smart arrow, text, and comment annotations share one React Flow canvas and document with workflow nodes. Flow/Draw changes tools, not surfaces. There is no Excalidraw dependency or embedded editor API.
- `drawPlugin({ shapes })` accepts `DrawShapeDefinition[]`: unique `id`, nonempty `label`, required `path({ width, height, size })` returning a nonempty SVG path, optional `icon` and React `component`. Persist generated `data.customPath` as the fallback, never functions/components/icons. Components are trusted local code only. Without a custom definition, the enabled drawing plugin renders the saved path; without drawing, use placeholders.
- Custom shape IDs match `^[a-z][a-z0-9-]*$`; reserve `pen`, `rectangle`, `ellipse`, `diamond`, `line`, `arrow`, `text`, `comment`, `eraser`, `select`, and `pan`. Omitted `tools` includes built-ins/custom shapes automatically; explicit `tools` is the complete subset/order. Interaction IDs use `draw.foo`; plugin `tools` and `draw.create.shape` use raw `foo`. Keep shape functions out of JSON interaction options.
- `fonts` appends `{ id, label, family }` to Normal (`normal`, Inter/system sans), Handwritten (`handwritten`, self-hosted Gochi Hand), and Code (`code`, system monospace); require unique IDs/nonempty fields. Host CSS loads custom faces; only family strings persist. `colors` replaces toolbar ink swatches. `draw.fonts` contributes merged font metadata for host inspectors without eager drawing imports.
- Drawing defaults include font size 22, `"Gochi Hand", cursive`, and `keepTool: false`. Successful pointer creation requests Select; text/comments/connected smart edges always request Select even with Keep tool enabled. Eraser remains active until another tool is chosen. Hosts must apply `onToolChange`; direct `draw.create` calls do not change interaction state.
- Playground Draw starts Select; Pan is explicit. Never automatically refit on inspector or Flow/Draw changes; preserve initial fit and explicit fit/focus/layout/import/template actions. Adapter `panOnDrag` defaults to Pan only, Pan disables node dragging/connections/selection, and node/selection auto-pan defaults off; host React Flow prop overrides remain supported. Keep controlled selection updates separate from document mapping so live drag positions are not reset.
- The playground's [drawing configuration](../apps/playground/src/drawing.tsx) supplies Triangle/Database, an Editorial font stack, colors/defaults and is lazily imported alongside the optional drawing plugin.
- React exposes `BoltTools` and `BoltCanvas.interaction` with shared host-controlled `CanvasToolProps`. Slots are `canvas.tools`, `canvas.overlay`, `canvas.nodeTypes`, and `canvas.edgeTypes`; do not document the obsolete surface contract.
- Preserve `nodeDefaults` / `edgeDefaults`, per-object serializable `style` / `className`, edge label styles, and markers. `false` explicitly disables an inherited marker; undefined inherits. Node defaults exclude annotations; host defaults persist only if explicitly saved in document data.
- Consumer CSS must be explicit: import `bolt-flow-react/style.css`; it currently imports `@xyflow/react/dist/style.css`, which must be imported separately if the CSS pipeline does not resolve it. Built drawing consumers must also import `bolt-flow-plugin-draw/style.css`; do not rely on source-aliased demo behavior.
- Drawing CSS imports `@fontsource/gochi-hand/latin-400.css` from a direct plugin dependency, self-hosting the font. If package CSS `@import`s are unresolved, explicitly import that font CSS too and ensure host package resolution (declare the dependency directly if needed). Custom font faces are host CSS, not downloaded by registering a family.
- All persisted data must be serializable and pass document validation. Preserve unknown extension data, including legacy `extensions.excalidraw` scenes as opaque JSON: not rendered, interpreted, or migrated into native drawings.
- Attachments use owner-relative anchors. `updateDocument()` synchronizes them during movement/layout; deleting an owner detaches annotations at their current positions. Live React dragging follows owners; independent annotation moves/resizes update offsets. `replaceDocument()` requires already-valid anchors and does not synchronize positions.
- Local comments support replies and resolve/reopen, not multiplayer. Promotion uses `draw.convert` and configurable `toFlowNode`; smart arrows match nearby workflow endpoints to real graph edges, not reversible graph/sketch binding. Optional history covers all document changes together.
- Register plugin resources through the context and clean up external listeners/timers on removal.
- Removing drawing unregisters UI/commands, not saved objects. Missing renderers use placeholders until re-enabled.
- Do not claim Excalidraw/full drawing-editor parity, images, rotation, full container groups/subflows, multiplayer, SVG export, or Excalidraw scene migration. Native tools are one optional package, not separately downloadable tool packages.
- The user-supplied XYFlow Pro example was inspected for the concept only; code was not copied because of license restrictions. Drawing was implemented independently using the public perfect-freehand API. Do not copy restricted Pro example code.
- Preserve React Flow attribution and applicable upstream licenses/notices (including perfect-freehand, Dagre, Lucide, Fontsource/Gochi Hand font assets, and retained legacy Excalidraw material). Do not describe Excalidraw as a current dependency or carry forward its obsolete override instructions.
- Validate with `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, and `npm audit`.
- Install Chromium with `npx playwright install chromium` when needed. Validation is ongoing: do not assert fixed passing test counts, build results, or audit totals without fresh evidence.
- Run the demo using `npm run dev` or the Bolt Flow: playground task.
- Update the [README](../README.md), [roadmap](../docs/ROADMAP.md), and affected package READMEs when public contracts or supported features change.
- Do not publish packages, push repositories, or remove upstream attribution without explicit authorization.

## Release status

- Source capabilities and planned work are distinguished in the roadmap. Earlier passing snapshots do not qualify future changes; no final validation results are recorded here.
- Before release, review current typecheck/test/browser/build/audit results, built consumer CSS, declarations, package contents, licenses, scope ownership, and compatibility policy. Inspect each workspace with `npm pack --dry-run`.
- No editor extensions are required. Package publishing and repository pushes remain separately authorized actions.
## November customization contracts

- Documents now use schema 2; validate/migrate schema 1 and preserve unknown extensions. Anchors may form acyclic annotation chains. Logical groups and hidden/locked flags persist.
- New persistence defaults to manual; preserve legacy storagePlugin behavior. Never add implicit writes to the manual controller.
- Public editor primitives, structured rich text, reference workflow canvas import, optional PNG export and editable waypoints are implemented; see [the guide](../docs/CUSTOMIZATION.md). Keep future services distinct from shipped features.
