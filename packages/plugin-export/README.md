# @bolt-flow/plugin-export

Optional portable JSON exchange for Bolt Flow. Alpha 0.1.0; unpublished, with validation ongoing. Use the local npm workspaces described in the [root README](../../README.md).

Register `exportPlugin({ maxImportBytes: 26214400 })` directly or via a trusted static `import()` loader. The default import limit is 25 MiB of UTF-8 JSON. Commands use `runtime.execute(commandId, payload)`:

- `export.json`: returns formatted JSON for the current document.
- `import.json`: accepts a JSON string, checks its byte size, parses and validates it before replacing live state. The import is recorded by history if enabled; it does not perform migrations.
- `export.download`: downloads the JSON document in a browser. Use `export.json` outside a browser.

The complete schema-version-1 document round-trips: graph nodes/edges, native same-canvas drawings/text/comments, owner anchors, local replies/resolution, per-object `style` / `className`, label styles, and explicit `false` markers. Unknown JSON extensions survive without their plugins installed, including legacy `extensions.excalidraw` scenes as opaque data only. They are not rendered or migrated. Export does not serialize React components or transient tool/selection/viewport state; host defaults persist only if stored in the document.

Importing a document does not enable plugins. Native drawing nodes need the drawing renderer for editing, with explicit consumer CSS as described in the [drawing package README](../plugin-draw/README.md).

Requires only the core peer, with no React, perfect-freehand, or Excalidraw dependency. This is JSON exchange, not canvas PNG/SVG export, image tools, multiplayer, rotation, full groups, or full drawing-editor parity. See the [root validation commands](../../README.md#validate-and-build); results remain subject to ongoing validation.

MIT © 2026 Bolt Flow contributors.