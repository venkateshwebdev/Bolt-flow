# Build your own Bolt Flow editor

For the complete package documentation, start with the [guide index](guide/README.md). The same guides are available at `/docs` in the development site.

Bolt Flow provides a default connected canvas and replaceable UI components. The playground demonstrates drawing, layers, appearance presets, explicit saving and generated JSON. The SDK installs no plugins automatically. This is an unpublished alpha; use the workspace packages locally.

## Start with a shell, or compose your own

```tsx
import { BoltRuntime, createDocument, editingPlugin } from 'bolt-flow-core';
import { BoltProvider, BoltEditor, editorUIPlugin } from 'bolt-flow-react';
import { historyPlugin } from 'bolt-flow-plugin-history';
import 'bolt-flow-react/style.css';

const runtime = new BoltRuntime(createDocument({ id: 'my-canvas' }))
  .use(editingPlugin())
  .use(historyPlugin());

runtime.use(editorUIPlugin({
  id: 'my-app',
  actions: [{
    id: 'my-app.validate', label: 'Validate', shortcut: 'Mod+Shift+V',
    run: () => console.log(runtime.getDocument()),
  }],
  slots: {
    'editor.status': [{ id: 'my-status', component: () => <span>My application</span> }],
  },
}));

export function Editor() {
  return <BoltProvider runtime={runtime}>
    <div style={{ height: 700 }}>
      <BoltEditor panels={{ inspector: false }}
        canvas={{ showMinimap: true }}
        style={{ fontFamily: 'system-ui' }} />
    </div>
  </BoltProvider>;
}
```

`BoltEditor` accepts host actions, controlled `interaction`, React Flow canvas options, styles and replacement toolbar/inspector/layers/status components. Pass `false` to hide a built-in panel. For complete layout control, compose `BoltCanvas`, `BoltTools`, `BoltToolbar`, `BoltLayers`, `BoltInspector` and `BoltSlot` yourself. Host `nodeTypes`/`edgeTypes` override contributed renderers.

`editorUIPlugin` supplies typed actions and panels for `editor.toolbar`, `editor.inspector`, `editor.menu`, `editor.panel` and `editor.status`. Mount `BoltSlot` for the slots your layout uses. The default shell mounts toolbar, panel, inspector and status slots. `BoltSlot.overrides` replaces or hides panels by ID; `BoltToolbar.actions` replaces contributed actions by ID and `hidden` removes actions. Use namespaced IDs across plugins. `order` sorts panels. Provide `onError` for host actions that may fail.

`useBoltShortcuts(ref, actions)` binds only inside that editor. It ignores inputs, contenteditable content and IME composition. Shortcut syntax includes `Mod+S`, `Mod+Shift+Z`, `Alt+A`, `Ctrl+K` and `Meta+K`. Drawing's P/T/C/A shortcuts are scoped to the nearest `data-bolt-editor` ancestor. Hosts can replace the drawing toolbar and register their own shortcuts.

The default primitives use `--bolt-accent`, `--bolt-surface`, `--bolt-text`, `--bolt-border`, `--bolt-radius`, `--bolt-space` and `--bolt-font`. Existing canvas and drawing classes remain available for host CSS. The playground's Customize dialog demonstrates hiding/reordering drawing tools, palettes, theme, density and saved presets. Advanced node/edge properties remain in its inspector.

## Save only when requested

```ts
import { createPersistenceController, localStorageAdapter } from 'bolt-flow-plugin-storage';

const persistence = createPersistenceController(runtime, {
  mode: 'manual',
  adapter: localStorageAdapter(window.localStorage, id => `my-app:${id}`),
});

await persistence.save(); // Call from the host's Save button or shortcut.
await persistence.load({ discardChanges: true }); // After the host resolves unsaved edits.
persistence.setMode('autosave'); // Explicit opt-in; default debounce is 600 ms.
const unsubscribe = persistence.subscribe(() => console.log(persistence.getSnapshot()));
// When the owning editor is destroyed:
unsubscribe();
persistence.dispose();
```

Manual mode never restores on installation or writes on a timer, pagehide or disposal. `restoreOnInstall: true` explicitly opts into replacing the initial document. `load()` refuses to discard a dirty document unless the host passes `discardChanges: true`. A load also refuses to replace edits made while its request was in flight. Downloads do not mark storage as saved.

`PersistenceAdapter` can be synchronous or asynchronous. Its `save` receives `{ documentId, snapshot, revision, etag, signal }` and may return `{ etag }`. Its `load` receives `{ documentId, signal }` and returns `{ snapshot, etag? }` or `null`. Supply HTTP, IndexedDB or other application adapters using this contract. Honor abort signals and enforce concurrency tokens at your backend. Throw `PersistenceConflict` for stale writes; the controller surfaces conflict state and stops further writes until a successful reload or document switch. It does not merge conflicts for you.

Each controller serializes its writes and ignores responses for a previous document. Acknowledging revision N leaves revision N+1 dirty. Observe `status`, `dirty`, `error`, `savedAt`, `savedRevision` and `mode` through `getSnapshot`/`subscribe`. Separate destinations should have separate controllers and status displays. Network writes are not guaranteed to complete during browser shutdown.

Alternatively, `runtime.use(persistencePlugin(options))` owns the controller lifecycle and exposes `storage.save`, `storage.load`, `storage.status`, `storage.mode`, and the `storage.controller` contribution. Its default mode is manual. Do not install it together with the legacy `storagePlugin`, which uses the same plugin ID and intentionally retains its previous restore/autosave/removal-flush behavior.

The playground saves one current canvas under its existing browser key. Its **Save**, **Open saved**, **Autosave**, and **Save view** controls are explicit. A multi-document library, Save-as UI, and cloud accounts remain host features; use per-document adapter keys and your own actions.

## Use JSON from generation or a workflow backend

```ts
import {
  parseCanvas, serializeCanvas, insertCanvas, captureCanvas, applyCanvas,
} from 'bolt-flow-core';

// Generated JSON is validated before it can replace live state.
const candidate = parseCanvas(generatedJson);
runtime.replaceDocument(candidate, { source: 'generation.replace' });
// Or insert with new node/edge/group IDs while retaining internal attachments.
const inserted = insertCanvas(runtime.getDocument(), candidate);
runtime.replaceDocument(inserted.document, { source: 'generation.insert' });

const json = serializeCanvas(runtime.getDocument());
// Store presentation beside the host's separately serialized execution data.
const canvas = captureCanvas(runtime.getDocument());
const restored = applyCanvas(freshlyGeneratedWorkflowGraph, canvas);
runtime.replaceDocument(restored.document, { source: 'load', history: 'ignore' });
console.log(restored.warnings);
```

`captureCanvas` saves workflow layout/styles, edge presentation/waypoints, annotations, extensions and optional view. `applyCanvas` whitelists presentation fields, preserves executable node/edge data and reports stale IDs, annotation collisions and detached owners. Hosts must use stable IDs. Insert preserves the destination's extensions and viewport; it does not merge imported theme presets automatically.

The playground's JSON studio offers validation/preview, insertion and replacement. Each accepted operation is one document-history entry. There is no bundled AI service or implicit backend execution. Generation, Save, Run and Publish are separate host actions.

For the reference workflow's canvas version 1, use `importWorkflowCanvas(graph, canvas)` from the drawing package. It maps freehand/text nodes, parent-relative coordinates, chains, theme-following colors, dimensions, opacity, annotation groups and hide/lock state. It preserves supported rich formatting through a browser HTML-to-structured-text conversion; a server can supply `convertHtml`, otherwise a warning identifies plain-text fallback. The reference's business workflow converter and backend are not bundled. This importer does not handle Excalidraw scenes.

## Schema version 2 and editing behavior

`createDocument` and `validateDocument` now produce version 2. Version 1 JSON is accepted, validated under its original anchor restrictions and migrated. Unknown extensions survive. Unsupported future versions are rejected. Older Bolt Flow versions that accept only schema 1 cannot open newly exported version 2 files.

Nodes add `hidden`, `locked` and `groupId`. `view?: { x, y, zoom }` is portable when the host chooses to save it. Selection, tool drafts, menus, runtime objects, functions and history are transient. `getDocumentRevision()` changes only for committed document changes; runtime snapshot `revision` also includes plugin lifecycle changes. Change metadata carries a transaction ID.

Anchors retain `{ nodeId, offset }` but may now form acyclic chains. Positions remain absolute. Core synchronizes owners before descendants, detaches missing owners without jumping, and rejects cycles atomically. `moveNodes` reconciles group moves and anchor offsets once. `editingPlugin()` registers grouping, ungrouping, duplication with ID remapping, deletion, layer visibility/locking, front/back ordering and left/top/center alignment commands. Logical selection groups are not transform containers or subflows.

`BoltProvider readOnly` blocks built-in mutation commands and editing UI; `BoltCanvas readOnly` blocks that canvas's pointer controls. Use `runtime.beforeCommand` and command `enabled` predicates for additional host policies. Trusted code can still call draft APIs directly: these controls are not a plugin sandbox or backend authorization system.

## Rich drawing and routing

Drawing supports separate text/ink colors, `auto` theme color, opacity, inline text formatting, selected-object actions, annotation-layer organization and optional Shift attachment with a target preview. Shift attachment is enabled by default and does not change ordinary free-placement behavior. The toolbar owner picker can attach directly to annotations. Cycles are rejected. Enable attachment links in drawing settings to inspect saved relationships.

Double-click a text annotation to edit; select text and use bold/italic/underline/strike, color, highlight or clear formatting. Done, Escape, outside click, or Mod+Enter commits one document change. Paste inserts plain text. Portable structured text is rendered through React; imported HTML is reduced to supported text and color marks. Browser-native rich-text editing is currently qualified in Chromium only. Text boxes retain their size, and unfilled outlines have a wider hit target while their interiors allow underlying workflow selection.

`drawPlugin({ toolbar: CustomToolbar })` replaces its toolbar; `toolbar: false` disables it while retaining pointer tools. Host-controlled `interaction.options` supports `hiddenTools`, `toolOrder`, `palette` and `showAttachments`. These control presentation, while the plugin's `tools` allowlist controls which tools can create objects. Existing custom shapes/fonts remain supported.

Set an edge's type to `bolt-waypoint` for editable routing. Double-click its path to add a waypoint; select the edge and drag a handle, or double-click/Delete a handle to remove it. Points persist in `edge.data.points`. More advanced segment insertion, orthogonal routing constraints and routing UX remain future refinements.

## Export images

```ts
const { downloadCanvasPng } = await import('bolt-flow-plugin-image-export');
await downloadCanvasPng(canvasElement, runtime.getDocument(), {
  includeAnnotations: true,
  background: '#ffffff', grid: 'dots', scale: 2,
});
```

PNG export uses a cloned viewport and full visible-object bounds. It supports selected IDs, annotation inclusion, padding, scale, background and grid. Hidden nodes and editor handles/formatting controls are excluded. An 8192px default dimension limit prevents oversized exports. `canvasToPng` returns a Blob; `imageExportPlugin` registers `export.png` using a host-supplied `getElement` callback.

Custom renderers must be mounted and capturable. Supply accessible fonts/images; browser/CORS and DOM-capture fidelity limits apply. SVG export, image insertion, rotation, frame/container transforms, managed asset libraries and multiplayer remain outside this implementation.
