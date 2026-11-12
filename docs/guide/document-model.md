# Documents & state

The document is the portable source of truth. The runtime owns its lifecycle, while React selection, active tools, menus, and history remain transient editor state.

## The document shape

A minimal schema 2 document looks like this:

```json
{
  "schemaVersion": 2,
  "id": "approval-flow",
  "name": "Approval flow",
  "nodes": [
    {
      "id": "review",
      "position": { "x": 100, "y": 100 },
      "width": 200,
      "height": 80,
      "data": { "label": "Review request" }
    }
  ],
  "edges": [],
  "extensions": {},
  "view": { "x": 0, "y": 0, "zoom": 1 }
}
```

`view` is optional. Coordinates are flow/world coordinates, not browser pixels. Node positions are absolute even when an annotation is attached to another object.

## Nodes and edges

Nodes require a unique nonempty `id`, finite `position.x/y`, and a JSON `data` object. Optional fields include renderer `type`, positive dimensions, `role`, `anchor`, `style`, `className`, `zIndex`, `draggable`, `selectable`, `connectable`, `hidden`, `locked`, and `groupId`.

Edges require unique IDs and existing source/target node IDs. Optional fields include handle IDs, renderer type, label, animation, data, style, label styles, class, markers, and z-index. Marker values can be `false` to explicitly suppress an inherited marker.

`data` is application-defined JSON. Store execution settings there only when a full Bolt document is your chosen application model. If your backend already owns executable workflow data, use the presentation helpers in [workflow integration](workflow-json.md) instead.

## Create and update safely

```ts
import { BoltRuntime, createDocument } from 'bolt-flow-core';

const runtime = new BoltRuntime(createDocument({ id: 'my-canvas' }));
runtime.updateDocument(draft => {
  draft.nodes.push({
    id: 'task-1', type: 'default',
    position: { x: 80, y: 120 },
    data: { label: 'My first task', priority: 2 },
  });
}, { source: 'app.add-task' });

runtime.updateDocument(draft => {
  const task = draft.nodes.find(node => node.id === 'task-1');
  if (task) task.data.label = 'Renamed task';
}, { source: 'app.rename', group: 'task-1.label' });
```

`getDocument()` returns a deeply frozen snapshot. Never mutate it. `updateDocument()` creates a draft, runs your callback, synchronizes anchors, validates the result, and publishes one committed change. A malformed update throws and leaves the previous document intact. JSON-identical updates do not emit a document change.

`replaceDocument(next, meta)` validates an entire replacement. It does not synchronize anchor positions; a replacement must already contain valid references and intended coordinates. Use replacement for imported, generated, or loaded documents.

## Change metadata and history

| Field | Meaning |
| --- | --- |
| `source` | Origin you choose, such as `app.rename`, `generation.insert`, or `remote.load` |
| `group` | Groups nearby edits in the optional history plugin; useful for typing and sliders |
| `history` | `record` by default; `ignore` establishes a new history baseline |
| `transactionId` | Optional host ID; otherwise generated for a committed document change |

With the history plugin, edits with the same group within its merge window share an undo entry. `history: 'ignore'` clears undo and redo history for a changed replacement; it is not simply “skip this one entry while preserving history.” This matters when loading a different document.

```ts
const stop = runtime.onDocumentChange((next, previous, meta) => {
  console.log(meta.source, meta.transactionId, next.id);
  console.log('Document revision:', runtime.getDocumentRevision());
});
// When this subscription is no longer needed:
stop();
```

`getDocumentRevision()` changes only on committed document changes. Runtime snapshot `revision` also changes when plugins register or unregister. Use document revision for save acknowledgments; plugin loading should not make a saved canvas look edited.

## Attachments and groups

An attachment is represented by:

```json
{ "nodeId": "owner-id", "offset": { "x": 40, "y": 180 } }
```

It belongs in an annotation node's `anchor` field. The annotation's position is the owner's absolute position plus the offset. Owners can be workflow nodes or annotations; chains must be acyclic. `updateDocument()` resolves owners before their descendants and detaches missing owners without jumping the annotation.

`moveNodes(document, positions)` is a draft helper for moving selected objects and reconciling offsets once. `expandNodeSelection(nodes, ids)` expands logical group membership and excludes hidden/locked objects. `duplicateNodes(document, ids, offset?)` copies selected/grouped nodes, remaps internal edges and anchors, and returns the new IDs.

Groups use shared `groupId` strings. They are selection groups, not nested coordinate systems, frames, or transform containers. Locking an attached annotation does not sever its relationship with its moving owner.

## Validation and migrations

```ts
import { parseCanvas, serializeCanvas, validateDocument } from 'bolt-flow-core';

const loaded = parseCanvas(jsonFromYourStorage);
const validated = validateDocument(loaded);
const portable = serializeCanvas(validated); // Pretty JSON by default.
const compact = serializeCanvas(validated, false);
```

These examples assume `jsonFromYourStorage` is a string supplied by your application. Parsing defaults to a 25 MiB UTF-8 size limit; pass a positive maximum byte count as the second argument when needed.

Validation checks finite JSON values, schema version, IDs, positions, dimensions, edge references, styles, and anchors. Version 1 is validated under its original anchor restrictions and migrated to version 2. Unsupported future schema versions are rejected before replacing state. Unknown extension keys are preserved.

Validation cannot know whether your renderer understands a custom `data` payload. Add application-level validation for your own node types, domain fields, assets, and execution rules.

## Portable extensions and transient state

Store namespaced portable settings in `extensions`, for example:

```ts
runtime.updateDocument(draft => {
  draft.extensions['acme.brand'] = {
    accent: '#0f766e', density: 'compact', version: 1,
  };
}, { source: 'acme.brand' });
```

Do not serialize React components, functions, DOM nodes, clients, credentials, selected IDs, active pointers, or the React Flow instance. JSON does not preserve `Map`, `Set`, `Date`, or class instances as those runtime types. Convert domain values deliberately.

Snapshots clone, validate, and freeze the full document. Keep high-frequency pointer drafts outside the runtime, then commit at the end of a gesture. Long strokes and large undo stacks increase memory usage; benchmark your target document sizes.
