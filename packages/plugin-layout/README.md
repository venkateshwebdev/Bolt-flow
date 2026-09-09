# bolt-flow-plugin-layout

Optional Dagre layout for Bolt Flow. Alpha 0.1.0; unpublished, with validation ongoing. Use the local npm workspaces described in the [root README](../../README.md).

Register `layoutPlugin({ direction: 'LR', nodeGap: 70, rankGap: 90 })` directly or through a trusted static `import()` loader. Execute `runtime.execute('layout.arrange', overrides)` with optional `LayoutOptions` overrides. Supported directions: `LR`, `RL`, `TB`, `BT`. Uses declared node dimensions with 240 × 130 defaults.

Only nodes whose `role` is not `annotation` and edges between those nodes participate in Dagre layout. Native pen/shapes/text/comments remain on the same React Flow canvas but are excluded from graph ranking. Unattached annotations keep their positions; attached annotations follow their owners via core anchor synchronization in the same `updateDocument()` transaction. Optional history restores the layout and attachments together. Promoted annotations participate as regular flow nodes.

Layout changes positions, preserving per-object styles/classes, markers, local comment data, and unknown extensions. Legacy Excalidraw extension scenes remain opaque and are neither laid out, rendered, nor migrated. Deleting an owner elsewhere through a document update detaches its annotations rather than deleting them.

This command does not auto-fit the host viewport, implement full groups/subflows, or provide drawing-editor parity. The playground requests viewport fitting separately. Requires the core peer and Dagre; no React, perfect-freehand, or Excalidraw dependency. See the [root validation commands](../../README.md#validate-and-build); validation results are not finalized here.

MIT © 2026 Bolt Flow contributors. Dagre retains its upstream license and notices.