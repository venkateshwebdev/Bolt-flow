# Plan: a fully customizable connected canvas

Status: proposed implementation plan, based on source inspection on November 12, 2026. Features below are planned unless explicitly marked existing. The plan was subsequently used for implementation; see [the integration guide](CUSTOMIZATION.md) and [roadmap status](ROADMAP.md) for shipped APIs and remaining work. This document retains the proposed design for comparison.

## Product direction

Give developers a usable editor immediately, and let them replace every product-facing part through supported APIs: tools, renderers, styling, panels, shortcuts, commands, persistence, import/export, and application actions. Give end users controls for appearance, organization, reusable presets, and saving within the capabilities their application enables.

Preserve Bolt Flow's current experience: one React Flow viewport, one document containing workflow nodes and native annotations, shared optional history, and Flow/Draw as tool modes. Draw opens in Select; Pan remains explicit. Opening panels or changing modes must not move the viewport. Keep existing shapes, comments, smart connections, custom fonts, and annotation promotion.

“Customize everything” has two concrete surfaces:

- **End users:** edit visual properties, arrange/group/lock/hide items, customize enabled toolbars and shortcuts, save reusable styles/templates, and choose among the host's save/export actions.
- **Application developers:** replace the UI, define node/edge/tool types, register commands and inspectors, control permissions and gestures, and decide how documents are loaded, generated, saved, and executed.

The default editor must use the same public APIs available to consumers. No essential capability should exist only inside the playground.

## Reference inspection and feature gaps

The reference is the workflow builder in the separate `mit-webapp` checkout, principally `src/components/actions/v2/workflow/` and `src/components/actions/v2/drawing/`. This is a behavioral reference, not a runtime dependency. Reimplement generic behavior within Bolt Flow's package architecture; keep application-specific services and workflow execution outside the SDK.

| Reference capability | Bolt Flow today | Planned work |
| --- | --- | --- |
| Native pen, circle, arrow, text over workflow nodes | Existing pen, ellipse, arrow, text plus rectangle, diamond, line, comments and custom shapes | Preserve tools; add optional sketch-like circle styling and configurable annotation-arrow versus smart-edge behavior |
| Separate pen/text colors, theme-following Auto color | Shared drawing color; customizable palette and fonts | Separate creation defaults by tool; semantic Auto color resolved at render time; preserve explicit colors |
| Stroke width and opacity on creation and selection | Width on creation; per-object opacity available in inspector | Consistent width/opacity controls in toolbar and selected-object actions; configurable ranges |
| Inline text placement and double-click editing | Plain text entered in toolbar/inspector | Inline editing, selection formatting, bold/italic/underline/strike, text color, highlight, clear formatting, multiline text, fixed box resizing |
| Text editing finish with outside click, Escape, or modifier+Enter | No inline editor | Scoped editor shortcuts and focus restoration; text typing must not activate canvas commands |
| Painted outline hit targets; empty circle interiors pass through | Drawing nodes use rectangular containers | Geometry-aware hit targets and configurable stacking, so a ring does not block the underlying workflow step |
| Annotation actions near selection | Mostly inspector-based | Configurable floating actions for style, attach/detach, duplicate, delete and custom host actions |
| Shift while drawing to attach; otherwise free placement | Explicit workflow owner selection | Add optional Shift attachment, target preview and configurable nearest-target policy; retain explicit picker |
| Attach annotations to steps or other annotations | Only a single workflow owner; validator rejects annotation owners | Acyclic chained attachments, descendant movement, explicit detach, optional reattachment after drag, target badges and link overlays |
| Attachments survive reload, movement and owner removal | Existing direct-owner support | Extend correctness to chains, group movement, layout, resize, deletion and undo without position jumps |
| Searchable annotation layers, focus, hide/show, lock/unlock | Basic item navigation and object controls | Reusable Layers component with search, labels, focus, hidden/locked state and multi-selection |
| Group/ungroup annotations; members select and move together | No first-class annotation groups | Persistent selection groups with batch commands; keep these distinct from later container groups/subflows |
| Drawing help and scoped keyboard shortcuts | Basic help plus Select/Pan/undo commands | Registry-driven help, tool shortcuts and host-remappable key bindings |
| Annotation undo/redo and workflow-position snapshots | Existing unified document history | Keep unified history; one history entry per completed drag, resize, text session or batch operation |
| Save visual canvas beside execution JSON and restore it | Complete Bolt document JSON; no workflow projection adapter | Add explicit serialization/load APIs and a presentation projection adapter for host workflows |
| Save includes viewport; schema carries annotation dimensions and parent-relative positions | Viewport is transient; annotations persist with absolute position and owner offset | Optional saved view, schema migration, and an explicit reference-format importer |
| Full-workflow PNG, optionally including annotations, background and grid | JSON export only | Optional image-export package with full-content bounds and inclusion controls |
| Node/edge positions and manual edge waypoints in canvas JSON | Positions and styled edges; custom edge renderer support | Standard waypoint representation plus optional editable edge-routing tools |

Reference source evidence:

- `drawing/drawing-help.tsx`, `drawing/stroke-controls.tsx`, `drawing/annotation-action-menu.tsx`: tools, styles, gestures and shortcuts.
- `drawing/text-editor.tsx`, `drawing/text-format.ts`, `drawing/text-node.tsx`: rich text, sanitization, editor lifecycle and rendering.
- `drawing/annotation-layers.tsx`, `drawing/annotation-selection.ts`: grouping, search, visibility and locking.
- `drawing/anchor.ts`, `drawing/annotation-overlay.tsx`, `drawing/anchor-links-overlay.tsx`: geometry, chained attachment, Shift gesture and previews.
- `utils/workflow-converter.ts`, functions `buildCanvasState` and `applyCanvasState`: separate visual snapshot and restoration.
- `types/workflow-schema.ts`, `canvasStateSchema`: version, viewport, node layout, edge waypoints and annotations.
- `workflow/index.tsx`, `handleSave`: builds execution JSON and canvas JSON together; fingerprints the submitted state so edits made during saving remain unsaved.
- `workflow/utils/exportWorkflow.ts`: full-content PNG generation. Its internal SVG capture is not evidence of a user-facing SVG exporter.

Some reference store comments call annotation actions “session-only,” but the serializer explicitly saves annotation data and parent IDs. Workflow container groups are explicitly excluded from that serializer. Treat the actual save/restore path as evidence; do not promise that every reference feature round-trips perfectly. For example, its restore helper applies workflow positions and edge points but not every field it captures.

## Architecture and package ownership

| Package/surface | Responsibility |
| --- | --- |
| [Core](../packages/core/src/index.ts) | Versioned JSON, validation/migrations, atomic document transactions, command registry, subscriptions, plugin lifecycle, attachment invariants; remain dependency-free and DOM-free |
| [React adapter](../packages/react/src/index.tsx) | Canvas interaction, live geometry, selection, typed React slots, controlled view state and accessible primitives |
| [Drawing plugin](../packages/plugin-draw/src/index.ts) | Drawing geometry, inline annotation editing, paint settings, hit targets, attachment tools and default drawing UI |
| Proposed optional editor package | Ready-made configurable shell: toolbar, inspector, Layers, menus, command palette, save status and settings; also export composable components |
| [History plugin](../packages/plugin-history/src/index.ts) | Shared undo/redo, explicit transactions and gesture grouping |
| [Storage plugin](../packages/plugin-storage/src/index.ts) | Persistence controller, sync/async adapters, explicit save/load policy and observable status |
| [Export plugin](../packages/plugin-export/src/index.ts) | JSON serialization/import/download; migration reports and size limits |
| Proposed optional image-export package | PNG first, later SVG via renderer contributions; asset/font resolution and export bounds |
| Optional follow-on packages | Edge-routing tools, alignment/layout extensions, shape libraries/assets, generation integration and collaboration |
| Host integration/example | Mapping to domain workflow JSON, backend requests, authentication, generation providers, run/publish/version-history actions |

Avoid splitting each drawing tool into a separate package. Optional heavy dependencies such as rich-text editing and image capture should be lazy-loaded at their feature boundary. Core and the base React adapter must continue to work without drawing, storage, history or the editor shell installed.

## Public customization contracts

### Replaceable UI and predictable configuration

Add a typed contribution map for tools, node/edge renderers, inspector sections, context menus, toolbar groups, panels, command-palette entries, keyboard bindings and exporters. Preserve the existing `canvas.tools`, `canvas.overlay`, `canvas.nodeTypes` and `canvas.edgeTypes` slots through compatibility adapters.

Each contribution needs a stable ID, owner, ordering information and optional visibility/enabled predicates. Host overrides replace contributions by ID; removals clean up subscriptions and shortcuts. Duplicate IDs and incompatible contributions produce actionable errors. Callback/component overrides are registered in application code and are never deserialized from document JSON.

Resolve visual configuration in this order: SDK defaults → host preset → permitted document settings → object overrides. Host capability restrictions remain authoritative. User UI preferences such as dock position and shortcuts are separate from shared canvas content. Provide reset-to-default and reset-section actions with a preview of the resulting values.

Expose CSS variables for all default-shell visual tokens: colors, surfaces, spacing, typography, borders, shadows, radii and focus indicators. Export unstyled primitives and component replacement slots. Move reusable inspector and shell behavior out of the playground.

### Commands, events and host actions

All editor actions, including built-ins, route through documented commands with typed payloads, validation and disabled-state reasons. Introduce explicit transaction boundaries for grouped changes. Keep core draft mutation available for trusted integrations; UI capability flags are not a security sandbox for arbitrary plugin code.

Provide document change, selection change, tool change, viewport change, before-action and after-action hooks. Change events include origin and transaction ID so hosts can distinguish user edits, imports, remote updates and generation. Track document revision separately from the current runtime revision, which also changes when plugins register.

Applications can add buttons such as Save, Save as, Download JSON, Generate, Run, Validate or Publish. Each action receives a consistent snapshot and calls host code. Saving and workflow execution are separate actions; installing Bolt Flow must not implicitly run a workflow or call a backend.

Add edit capabilities for nodes, edges, annotations, styling, delete, export and read-only mode. Apply restrictions across keyboard, toolbar, menu, pointer and built-in command entry points. Hiding a button alone is insufficient.

## JSON ownership, generation and persistence

### Two serialization use cases

1. **Standalone editor:** save the complete versioned Bolt document, preserving nodes, edges, annotation geometry, rich text, styles, layer/group metadata, attachments and unknown extensions. This remains the canonical editable canvas.
2. **Workflow application:** the host serializes executable workflow data separately and embeds a versioned canvas presentation snapshot alongside it, matching the reference pattern. On reload, it generates the workflow graph, then applies matching saved positions, routing, annotations and optional viewport by stable IDs.

Do not serialize the React Flow instance or raw internal UI state. Define codecs with validation, migration and deterministic output. Selection, active pointers, undo stacks, open menus and transient tool drafts stay outside the document. Viewport persistence is explicitly opt-in; on restore, use the saved viewport instead of also fitting the canvas.

Keep document settings portable only when they affect the canvas: theme tokens, default styles, named presets and relevant plugin settings. Keep credentials, API clients, functions, components and browser handles outside JSON. Missing plugins preserve their data and show placeholders or supported fallbacks.

### Schema and migration

Introduce schema version 2 before enabling persisted chained anchors, groups, rich text and saved view contracts. Continue to accept version 1 through a pure migration; never silently reinterpret a v1 anchor under new rules. Reject unsupported future versions before replacing live state. Preserve unknown extension keys during migrations.

Use validated structured rich-text JSON with a plain-text fallback. Convert the reference's sanitized supported HTML into this representation; do not store executable markup or couple the portable format to a particular editor library. Preserve existing plain `data.label` documents.

Persist logical annotation groups as ID membership, independent of attachment. Keep canonical node positions absolute with owner-relative anchor offsets; resolve chains topologically. A group drag computes each affected item's final position once, including attached descendants, and then reconciles offsets. Reject self-links/cycles; detach descendants of deleted owners at their last world positions. Full transform/container groups require a later contract.

Build a separate, opt-in reference-format converter. Map `freehand`/`text`, points, dimensions, opacity, color, formatted text, layer flags and annotation-group IDs. Resolve reference parent-relative coordinates before creating Bolt absolute positions and offsets. Convert theme-following color explicitly. Report unsupported fields and keep opaque source metadata where practical. Stable workflow IDs must come from a host mapping; do not infer executable nodes from labels.

Generated JSON goes through the same validation/migration pipeline as imports. The host chooses whether generation replaces the whole canvas, inserts a subgraph, or changes selected objects. Preview and acceptance produce one undoable transaction. Preserve annotations tied to retained IDs; report deletions and ID remaps before applying. Saving the generated result is a separate user/host action unless autosave was explicitly enabled.

### Explicit save policy

The current storage plugin restores immediately, autosaves changes, and saves on pagehide and removal. It cannot currently express a truly manual-save editor. Add independently configurable controls:

| Control | Proposed behavior |
| --- | --- |
| Save mode | `manual` or `autosave`; manual makes no background writes |
| Restore | Explicit load by default for the new controller; optional restore-on-install |
| Save trigger | Button, shortcut, host callback or autosave debounce |
| Destination | Host adapter: memory, localStorage, IndexedDB, HTTP API or another service |
| Exit/removal | Explicit flush policy; never write in manual mode just because the plugin was removed |
| Status | Observable idle/dirty/saving/saved/error/conflict, submitted revision and last successful save time |
| Failure | Preserve the live document and dirty state; show Retry; never announce success before persistence succeeds |

Keep the legacy `storagePlugin()` behavior documented during a deprecation window, and introduce an explicit new policy API. Migrate the playground to the new controller deliberately. Do not silently change existing consumers' autosave expectations.

The controller should capture an immutable snapshot and document revision at save time. Acknowledging revision N must not mark edits at N+1 saved. Serialize writes per document and coalesce queued autosaves; bind in-flight requests to document identity so a late response cannot affect a newly opened canvas. Remote adapters accept a concurrency token such as ETag and surface conflicts instead of blindly overwriting. Load/import validates before replacement and asks the host to resolve dirty-document replacement.

Local draft recovery and remote Save are separately labeled destinations. Download JSON produces a file and should not mark remote persistence complete. Cancellation, quota errors, offline failures, document switching and retry have explicit states. Do not rely on asynchronous network saves finishing during pagehide.

Proposed host-facing API sketch — names are design targets, not exports available today:

```ts
const persistence = createPersistenceController(runtime, {
  mode: 'manual',
  restoreOnInstall: false,
  flushOnExit: false,
  adapter: {
    load: ({ documentId, signal }) => api.loadCanvas(documentId, signal),
    save: ({ documentId, snapshot, revision, etag, signal }) =>
      api.saveCanvas({ documentId, snapshot, revision, etag, signal }),
  },
});

// Host controls where and when each action appears.
const saveAction = { id: 'app.save', label: 'Save', run: () => persistence.save() };
const downloadAction = {
  id: 'app.download',
  label: 'Download JSON',
  run: () => downloadCanvas(serializeCanvas(runtime.getDocument())),
};
```

## Delivery sequence and acceptance gates

### 1. Stabilize documents and save ownership

Add schema migrations, serialization contracts, optional saved view, a document-specific revision and the manual/async persistence controller. Add visible Save, Save as, load, download, dirty/error state and autosave opt-in to the playground. Supply both standalone and host-workflow examples.

Acceptance: generate/import → edit graph and drawing → click Save → reload into the same canvas with matching IDs, geometry, styles and chosen viewport. Manual mode performs zero writes before an explicit save, including plugin removal and pagehide. Failures and edits during an in-flight save remain dirty. Existing v1 documents migrate without data loss.

### 2. Make editor surfaces public and replaceable

Add typed contributions, configuration resolution, theme tokens, command/shortcut registration and reusable shell components. Preserve current exported APIs while adding the new composition layer. Demonstrate a default editor and a substantially different custom editor using the same document.

Acceptance: a consumer replaces the toolbar, inspector, menu, node renderer, palette, shortcuts and save action without changing package source. Two editors on one page do not steal one another's shortcuts. Editable fields and IME composition suppress canvas shortcuts. Built consumer tests use package exports, not playground source aliases.

### 3. Reach reference drawing behavior

Add inline rich text, separate tool defaults, theme-following colors, stroke opacity, contextual actions, geometry-based hit targets, layer search/hide/lock and persistent annotation groups. Add scoped tool shortcuts and registry-generated help.

Acceptance: rich formatting survives JSON save/load; clicking a ring interior reaches the workflow node; dragging its outline moves the ring. Hidden/locked items behave consistently across canvas and Layers. Group move/duplicate/delete is atomic. Undo returns to the state before a complete editing gesture. Existing comments and promotion continue to work.

### 4. Add attachment chains and workflow projection

Extend the anchor model, validator, core synchronization, React live-drag projection and history together. Add optional Shift attachment, previews, target picker, link visualization and reattachment policy. Implement the reference-format importer and canvas projection/apply helpers.

Acceptance: step → arrow → note survives drag, resize, layout, detach, owner deletion, undo, export and reload. Invalid chains are rejected atomically. Groups and chains do not move descendants twice. Projection updates only canvas presentation and preserves executable workflow data. Missing workflow IDs produce an explicit reconciliation report.

### 5. Add image export and richer customization

Deliver full-content PNG export with annotation inclusion, background, grid, scale and selected-region options. Wait for fonts/assets and report unresolved resources. Add editable edge waypoints, align/distribute, front/back ordering and reusable style presets. Implement asset-backed images, rotation, frames and managed shape libraries as separately tested follow-on features.

Acceptance: off-screen visible content is included, hidden layers are excluded by default, editing handles/toolbars are excluded, and view state is unchanged after export. Font and image failures are visible. Custom renderers can supply export adapters; SVG export remains a separate feature with defined fidelity limits.

### 6. Make the repository easy to adopt and extend

Provide a feature gallery, API/configuration reference, migration guide, plugin author guide, minimal integration, workflow JSON integration, custom-editor example and storage adapters. Add contribution/security guidance, changelogs, compatibility policy and release automation. Keep examples executable in CI and test package installation, CSS/font assets and lazy-loading behavior.

Benchmark mixed graphs and drawings at 100, 1,000 and 5,000 objects, plus long strokes and repeated undo/redo, recording hardware, document size, latency, memory and bundle cost. The current kernel clones/validates/freezes full documents; introduce structural sharing or patch history when measurements justify it. Do not market large-canvas performance without results.

Optional later integrations include user-provided generation services, CRDT synchronization, presence, asset storage and version history. These depend on stable document/transaction contracts. Workflow execution and backend publication remain application responsibilities.

## Validation strategy

For each implementation phase, add tests for observable behavior rather than reproducing implementation details:

- Schema fixtures and round-trips: v1 migration, rich text, chained anchors, groups, unknown extensions, malformed input and unavailable renderers.
- Persistence: zero-write manual mode, async save races, failure/retry, conflict, cancellation, restore, document switching and destination-specific saved status.
- Canvas browser tests: selection during live dragging, pointer cancellation, zoomed hit targets, group/anchor interaction, text-editor focus, mode/panel viewport stability and read-only commands.
- Cross-browser and physical touch/stylus checks for gesture-heavy features; keyboard navigation, accessible labels, focus and contrast for the configurable shell.
- Built consumer tests: optional plugins absent, custom contributions present, public declarations, CSS and self-hosted fonts, import/unload/reload portability.

Run the repository's typecheck, unit tests, browser tests, production build and built-consumer check for implementation changes; inspect dependencies and package artifacts before releases. This planning change was based on source reading, not a fresh runtime qualification. Publication is a separate action.

The first usable milestone is explicit manual saving with reliable JSON round-trips and replaceable UI; reference drawing parity follows on those contracts. Each phase must remain independently usable and preserve today's one-canvas behavior.
