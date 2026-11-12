# Workflow & generated JSON

Keep the canvas editable while preserving your application's workflow semantics. Bolt Flow supports complete document exchange and a separate presentation snapshot for backends that already own executable workflow JSON.

## Choose a storage model

| Model | Use it when | Save |
| --- | --- | --- |
| Complete Bolt document | Your app owns its graph directly in Bolt format | `serializeCanvas(runtime.getDocument())` |
| Host workflow plus canvas presentation | Your backend has a separate execution model | Domain workflow JSON plus `captureCanvas(document)` |

A canvas save must not silently execute a workflow. Keep Generate, Validate, Run, Save, and Publish as distinct application actions.

## Replace with generated JSON

```ts
import { parseCanvas } from 'bolt-flow-core';

function acceptGeneratedCanvas(json: string) {
  const candidate = parseCanvas(json);
  // Show your preview and collect any product-specific acceptance first.
  runtime.replaceDocument(candidate, { source: 'generation.replace' });
}
```

This assumes your existing runtime. Validation happens before mutation. If parsing fails, show the error and retain the current document. Apply application-specific validation after parsing: allowed node types, required fields, execution rules, and asset references are yours to define.

Do not deserialize React components or evaluate code returned by a generator. A generated document can choose known renderer IDs and supply JSON data; the application supplies renderer functions.

## Insert without ID collisions

```ts
import { insertCanvas, parseCanvas } from 'bolt-flow-core';

const candidate = parseCanvas(generatedJson);
const inserted = insertCanvas(runtime.getDocument(), candidate, { x: 80, y: 60 });
runtime.replaceDocument(inserted.document, { source: 'generation.insert' });
setSelectedIds(inserted.insertedIds);
```

`generatedJson` and `setSelectedIds` are host input/state. Insertion remaps node IDs, edge IDs, and logical group IDs. Internal anchors and edges point to the inserted copies. Positions and built-in waypoint routes translate by the supplied offset, which defaults to `{ x: 40, y: 40 }`.

The target document keeps its own extensions and viewport. Imported theme presets are not automatically merged. The result is one undoable document replacement when history is installed. Saving remains an explicit policy decision.

## Capture presentation separately

```ts
import { captureCanvas } from 'bolt-flow-core';

const payload = {
  workflow: serializeExecutableWorkflow(),
  canvas: captureCanvas(runtime.getDocument()),
};
await saveToYourBackend(payload);
```

The two functions in this example are application functions, not Bolt exports. `captureCanvas` stores workflow-node position, size, style, class, visibility, lock/group/z-index fields, edge presentation and waypoint data, full annotation nodes, extensions, and an optional view.

It does not copy executable workflow-node data into the presentation map. Store the domain workflow separately using your existing model.

## Restore onto a regenerated graph

```ts
import { applyCanvas } from 'bolt-flow-core';

const graph = convertWorkflowToBoltDocument(saved.workflow);
const restored = applyCanvas(graph, saved.canvas);
runtime.replaceDocument(restored.document, {
  source: 'workflow.load', history: 'ignore',
});
if (restored.warnings.length) showReconciliationWarnings(restored.warnings);
```

`convertWorkflowToBoltDocument`, `saved`, and `showReconciliationWarnings` are host-owned. Your converter must generate stable node and edge IDs so saved presentation can match them. Do not use labels or array indexes as persistent IDs if they change across loads.

`applyCanvas` whitelists presentation fields and preserves current executable node/edge data. It reports missing workflow IDs, annotation collisions, and detached owners. This allows a workflow definition to evolve without silently replacing its executable configuration with older canvas data.

A saved annotation can reference a missing owner; reconciliation detaches it and reports the condition. Annotation ID collisions are skipped with warnings. Decide how your application presents these cases and whether the user should accept the resulting layout.

## Reference workflow canvas importer

The drawing package includes an adapter for the inspected reference application's canvas version 1:

```ts
import { importWorkflowCanvas } from 'bolt-flow-plugin-draw';

const imported = importWorkflowCanvas(graph, referenceCanvas);
runtime.replaceDocument(imported.document, { source: 'workflow.import' });
console.log(imported.warnings);
```

`graph` is the host-converted Bolt workflow graph. `referenceCanvas` is that reference format's canvas payload, not a complete arbitrary workflow response. The adapter maps native freehand/text annotations, dimensions, colors, opacity, groups, hide/lock state, and parent-relative coordinates into Bolt's absolute-position/anchor model.

Supported rich HTML is converted to structured text in a browser. Server callers can supply `convertHtml`; without a converter a warning identifies plain-text fallback. Review the importer’s options and returned warnings for your source format before integrating.

The adapter does not bundle the reference application's services or business workflow converter. It is not an Excalidraw scene importer.

## Viewport restoration

Presentation may include `view`, but React Flow state is not serialized wholesale. On initial mount:

```tsx
<BoltCanvas defaultViewport={document.view} fitView={!document.view} />
```

For a later load, use the React Flow instance after the document is applied:

```ts
if (restored.document.view) await flow.setViewport(restored.document.view, { duration: 1 });
else await flow.fitView({ padding: 0.15 });
```

This example assumes you obtained `flow` from `useReactFlow()`. A small transition can supersede an in-progress zoom transition. Avoid fitting again after restoring a saved view, and do not fit automatically when opening a panel or changing tools.

## Validation and version boundaries

Complete Bolt JSON uses schema 2; canvas presentation uses its own `version: 2` contract. Validate incoming data before replacement and keep your domain payload version separate. Preserve unknown portable extensions when upgrading your own converter.

Generated content is still input. Limit payload sizes, report validation errors, and preview changes before replacing valuable work. The playground's JSON studio demonstrates validation, insertion, and replacement, while backend generation remains your integration.
