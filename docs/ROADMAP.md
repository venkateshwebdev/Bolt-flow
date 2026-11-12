# Roadmap: native connected canvas alpha

For the source-based comparison with the reference workflow drawing mode and the detailed implementation sequence, see [the connected-canvas customization plan](CUSTOMIZATION-PLAN.md). It covers drawing parity, replaceable editor UI, host-triggered saving, workflow canvas JSON, and release milestones. The plan records the proposed direction; the implementation status below identifies shipped capabilities and remaining work.

Bolt Flow is an unpublished 0.1.0 npm-workspace alpha. The current implementation uses one React Flow canvas with an independent optional perfect-freehand drawing plugin, not an embedded Excalidraw editor. A dated validation snapshot appears below; broader cross-browser, touch, accessibility, performance, and release qualification remain future work. Implemented below describes source capabilities, not release certification.

## November 2026 customization implementation

Implemented: schema 2 with v1 migration, manual/async persistence controller, host workflow canvas projection and reference-canvas import, reusable editor components/actions/slots, rich text, group/hide/lock layers, attachment chains, paint hit targets, toolbar/preset customization, generated-JSON preview/apply, editable waypoints, and optional PNG export. The playground uses explicit Save/Open and opt-in Autosave.

See [the integration guide](CUSTOMIZATION.md) for actual APIs and limits. Save-as/document libraries, cloud adapters/services, reattachment-on-drag policy, advanced container transforms, image tools, SVG, multiplayer and performance qualification remain future work. The detailed plan is a direction, not a claim of complete drawing-editor parity.

## Current foundation (implemented)

- Headless, dependency-free kernel and immutable versioned document.
- Plugin registration, scoped cleanup, dependency IDs, commands, and static `import()` loaders for trusted optional packages.
- `BoltProvider`, `BoltCanvas`, `BoltTools`, and shared `interaction` props; `canvas.tools`, `canvas.overlay`, `canvas.nodeTypes`, and `canvas.edgeTypes` contributions.
- Native pen, rectangle, ellipse, diamond, line, smart arrow, text, comment, whole-annotation erasing, selection, dragging, and resizing on the same React Flow canvas.
- Host `drawPlugin({ shapes })` definitions with required SVG `path({ width, height, size })` and optional trusted local React `component`/icon. Generated paths persist as serializable fallbacks; functions/components never enter documents. Custom IDs are unique lowercase identifiers (`^[a-z][a-z0-9-]*$`); built-in shape IDs plus `eraser`, `select`, and `pan` are reserved. Custom tools are included automatically unless `tools` specifies a complete subset/order. Interaction IDs use `draw.<id>`; plugin `tools` and creation payloads use raw IDs.
- Custom `fonts` append to Normal, self-hosted Gochi Hand/Handwritten, and Code presets; IDs must be unique, including `normal`, `handwritten`, and `code`. Host CSS loads custom faces. `colors` replaces ink swatches. The `draw.fonts` contribution exposes merged fonts to the playground inspector without eagerly importing drawing.
- Drawing defaults include font size 22, Gochi Hand, and `keepTool: false`. Successful pointer creation requests Select; text, comments, and connected smart edges always do so even with Keep tool enabled. Eraser remains active until another tool is selected. Escape cancels drafts and requests Select.
- Playground Draw opens in Select, with explicit Pan for viewport dragging and no automatic refit on inspector/mode changes. Initial fit and explicit fit/focus, layout, import, and template actions remain. The React adapter separates controlled selection updates from document synchronization to preserve live drag positions, and defaults node/selection auto-pan off.
- Smart arrows create real styled graph edges between nearby distinct workflow nodes, or remain annotations; existing source/target edges are reused.
- Owner-relative annotation anchors follow dragging/layout and restore with undo/redo. Deleting an owner detaches annotations; moving/resizing an attached annotation updates its offset.
- Local comment replies and resolve/reopen state; promotion through `draw.convert` and the host's `toFlowNode` callback. No multiplayer discussion service.
- `nodeDefaults` / `edgeDefaults`, serializable per-object `style` / `className`, edge label styling, and explicit `false` markers to suppress inherited arrows.
- Optional shared document history, Dagre layout excluding annotations, local persistence, and JSON exchange. Free annotations stay put during layout; attached annotations follow owners.
- Validation and preservation of unknown JSON extensions. Legacy `extensions.excalidraw` scenes remain opaque: not rendered or migrated.
- Playground inspectors, plugin library, commands, templates, themes, layers, and local review UI. Flow/Draw chooses tools, not separate surfaces. [Drawing configuration](../apps/playground/src/drawing.tsx) (Triangle, Database, Editorial font stack, palette/defaults) is lazily imported alongside the optional plugin.
- Explicit consumer CSS: `bolt-flow-react/style.css` (currently imports `@xyflow/react/dist/style.css`; import XYFlow CSS separately if not resolved) and `bolt-flow-plugin-draw/style.css` for built drawing consumers. Drawing CSS imports `@fontsource/gochi-hand/latin-400.css` from a direct dependency. Import that font CSS separately too if the host pipeline does not resolve package CSS `@import`s, ensuring host package resolution. Custom font faces remain the host's responsibility.

## Next — Stabilize the native contracts (planned)

- Extend existing drawing, zoom, attachment, deletion, resize, layout, history, and unload regression tests to cross-browser and physical touch-device cases.
- Strengthen pointer cancellation, keyboard navigation, screen-reader semantics, contrast, responsive layouts, and touch-device behavior.
- Expand command payload validation, renderer compatibility checks, and public API documentation as contracts evolve.
- Verify built-package CSS/font assets, peer resolution, static optional chunks, custom shape SVG fallbacks without host renderers, font-family portability, and isolated consumer installation; measure rather than assume bundle/performance characteristics.
- Decide and document migration policy before adding any legacy scene importer. Preservation alone is not migration support.

## Later — A stronger plugin SDK (planned)

- Typed contribution maps for tools, inspectors, menus, nodes, connectors, exporters, and renderers.
- Config schemas, version negotiation, dependency resolution, and capability declarations.
- Richer document schemas and tested migrations; evaluate full groups/subflows and rotation separately from current annotation resizing.
- Storage adapters for IndexedDB and remote APIs, with visible save/error states.
- Package-level contract and isolated-install tests; semver and release automation.

## Longer term — Scale and optional services (planned)

- Structural sharing, batched operations, patch history, and worker-assisted layout.
- Benchmarks for large graphs, native ink, opaque extension payloads, and long editing sessions.
- Optional CRDT transport/presence, offline synchronization, and conflict semantics.
- Evaluate image tools, SVG exporters, and user-provided AI backends with explicit data controls.

## Explicit boundaries and provenance

No Excalidraw dependency, rendering/migration of legacy Excalidraw scenes, or Excalidraw/full drawing-editor parity. Images, rotation, full groups, multiplayer, canvas SVG export, remote plugin execution, and sandboxing are not supported features. Host-defined shapes are not a managed shape-library browser. Optional native drawing is one package, not a separately downloadable package per tool. Smart edges and promotion are not reversible graph/sketch synchronization.

The user-supplied XYFlow Pro example was inspected for the concept only; its code was not copied because of license restrictions. The implementation independently uses perfect-freehand's public API. Preserve React Flow attribution and all applicable upstream licenses/notices, including Fontsource/Gochi Hand font assets and retained legacy Excalidraw material. No Excalidraw-era dependency overrides are required by the current manifests.

## Validation and release gates

**November 12, 2026 snapshot:** typecheck, 58 unit tests, all 26 Chromium browser tests, production package/playground builds and the built-consumer check passed. Dependency audit reported zero vulnerabilities. The new coverage includes manual saving, saved view restoration, async persistence races/conflicts, rich text, chained attachments, layers, generated JSON, editable routes and PNG export. This is local validation, not cross-browser or physical-device qualification.

From the repository root, run `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, `npm run test:consumer`, and `npm audit`. Install Chromium with `npx playwright install chromium` if needed. **September 9, 2026 snapshot:** typecheck, 38 unit tests, 16 Chromium workflows, package/playground builds, and built-consumer smoke passed; audit reported zero vulnerabilities. Seven package dry runs included licenses, READMEs, and declarations. Coverage includes custom shapes/fonts, Select/Pan and live-drag regressions, public CSS/font assets, and resized fallback geometry. Rerun these checks for every release candidate; production lazy loading still merits deployment-specific smoke checks.

Do not describe the product as production-ready or superior to upstream tools without benchmarks, accessibility checks, cross-browser tests, threat modeling, documented compatibility, tested migrations, and reliable release/rollback procedures. Review package artifacts with `npm pack --dry-run` per workspace and confirm scope ownership before any explicitly authorized publication. Planned work above is not a promise of currently supported features. See the [root README](../README.md) for local setup and integration.

The documentation now pairs each fenced example with an editable, isolated local-package sandbox. Partial excerpts include explicit host setup and service mocks. Fast annotation gestures retain coalesced samples and survive inline callback changes during host rerenders; regression coverage includes release/cancel behavior and history.
