# Drawing & annotations

The drawing plugin adds ink, shapes, text, and conversations directly to the workflow canvas. Drawings are native nodes, so layout, history, import, export, and attachments work against one document.

Fast pointer gestures keep their samples through host rerenders, including inline interaction callbacks. Browser-coalesced pen samples and the release coordinate are preserved. Escape, pointer cancellation, capture loss, and a real tool change cancel only the unfinished gesture.

## Install and configure drawing

```tsx
import { drawPlugin } from 'bolt-flow-plugin-draw';
import 'bolt-flow-plugin-draw/style.css';

runtime.use(drawPlugin({
  tools: ['pen', 'rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'text', 'comment', 'eraser'],
  defaults: {
    color: '#2563eb', textColor: '#182230', size: 3,
    fill: 'transparent', opacity: 1,
    fontSize: 22, fontFamily: '"Gochi Hand", cursive',
    smartConnect: true, keepTool: false, attachOnShift: true,
  },
}));
```

`runtime` is the stable runtime created by your application. Render `BoltTools` and `BoltCanvas` with shared interaction, or use `BoltEditor`, as explained in [editor layout](react-editor.md).

## Tool IDs and gesture behavior

| Context | Example |
| --- | --- |
| Plugin `tools` allowlist | `pen`, `text`, `triangle` |
| `draw.create` shape | `pen`, `text`, `triangle` |
| Controlled interaction tool | `draw.pen`, `draw.text`, `draw.triangle` |
| Selection and navigation | `select`, `pan` |

Omitting `tools` includes built-in and custom shapes automatically. Supplying `tools` declares the complete allowed subset and order. Select and Pan are navigation tools and cannot be included as drawing shape IDs.

Successful creation requests Select unless `keepTool` is enabled. Text, comments, and real graph connections always request Select. Eraser stays active. Escape cancels the current draft and requests Select. The host must handle `onToolChange` for these requests to change the active tool.

`draw.create` is a data command: it does not change the host's active tool by itself.

## Create annotations programmatically

```ts
import type { DrawCreateInput, DrawResult } from 'bolt-flow-plugin-draw';

const result = runtime.execute<DrawCreateInput, DrawResult>('draw.create', {
  shape: 'rectangle',
  points: [[80, 100, 0.5], [340, 260, 0.5]],
  settings: { color: '#0f766e', fill: '#ccfbf1', size: 3, opacity: 0.8 },
});
console.log(result.id, result.kind);
```

Samples are finite `[x, y, pressure]` tuples in flow coordinates. Use `flow.screenToFlowPosition()` to convert browser pointer coordinates before calling the command. Pen uses its sample path; two-point shapes use their bounds/endpoints. Text and comments use an initial placement point and default box dimensions.

Nodes use `type: 'bolt-drawing'`, or `type: 'bolt-comment'` for comments, and `role: 'annotation'`. Their data includes geometry, original dimensions, text, ink/fill colors, font settings, and comment fields. Opacity is stored in node style.

## Rich text and comments

Double-click a text annotation to enter editing. The built-in editor supports bold, italic, underline, strikethrough, text color, highlight, and clearing formatting. Done, Escape, outside click, or Mod+Enter commits one document change. Paste inserts plain text.

The saved format is structured JSON:

```json
{
  "version": 1,
  "blocks": [
    { "runs": [
      { "text": "Review ", "bold": true },
      { "text": "before launch", "color": "#2563eb", "highlight": "#dbeafe" }
    ] }
  ]
}
```

Store that value in annotation `data.richText` and keep `data.label` as its plain-text fallback. Supported marks render through React rather than arbitrary HTML. Imported HTML is reduced to supported text/marks. This is a small rich-text model, not a full document editor with lists, tables, or embedded media. Browser-native editing is currently qualified in Chromium.

Comment commands operate on an existing comment annotation:

```ts
runtime.execute('draw.reply', { id: commentId, text: 'Please check this branch.' });
runtime.execute('draw.resolve', commentId); // Toggle resolved/open.
```

Replies are local timestamped records. They do not imply authenticated identities, notifications, or multiplayer services.

## Custom shapes

```tsx
import { drawPlugin } from 'bolt-flow-plugin-draw';

runtime.use(drawPlugin({
  shapes: [{
    id: 'triangle', label: 'Triangle',
    path: ({ width, height }) =>
      `M${width / 2},8 L${width - 8},${height - 8} L8,${height - 8} Z`,
  }],
}));
```

This is an alternative initial configuration, not a second registration to merge into an already installed drawing plugin. Plugin IDs are idempotent; configure once, or remove/reinstall deliberately while preserving your document.

Every shape needs a unique lowercase ID matching `^[a-z][a-z0-9-]*$`, a label, and a path callback returning a nonempty SVG path. Built-in shape IDs plus `eraser`, `select`, and `pan` are reserved. Optional `icon` and `component` customize local rendering. A component receives `{ node: { data, width, height } }`.

The generated path is saved in `data.customPath`. It remains a fallback when drawing is enabled without the original definition. Functions, icons, and components are never serialized. Preserve original geometry fields when editing saved nodes so resizing scales the fallback consistently.

## Replace the drawing toolbar

```tsx
import type { CanvasToolProps } from 'bolt-flow-react';
import { drawPlugin } from 'bolt-flow-plugin-draw';

function ReviewTools({ tool, onToolChange, readOnly }: CanvasToolProps) {
  return <div role="toolbar" aria-label="Review tools">
    <button aria-pressed={tool === 'select'} onClick={() => onToolChange?.('select')}>Select</button>
    <button disabled={readOnly} aria-pressed={tool === 'draw.comment'}
      onClick={() => onToolChange?.('draw.comment')}>Comment</button>
  </div>;
}
runtime.use(drawPlugin({ tools: ['comment'], toolbar: ReviewTools }));
```

Use `toolbar: false` to retain pointer tools without contributing a toolbar. A host that renders a toolbar outside the canvas should also read provider read-only state with `useBoltReadOnly()` or pass its policy explicitly; your custom component is responsible for its controls.

Interaction options `hiddenTools`, `toolOrder`, and `palette` adjust toolbar presentation. The plugin's `tools` allowlist controls creation capability. See [themes and customization](styling.md) for configuration precedence.

## Attachments and smart arrows

```ts
runtime.execute('draw.attach', { id: annotationId, ownerId: workflowNodeId });
runtime.execute('draw.detach', annotationId);
```

Attachments store owner-relative offsets with absolute node positions. They support workflow → arrow → note chains. Moving the owner synchronizes descendants in the same transaction. Moving/resizing an annotation updates its offset. Deleting an owner detaches direct dependents at their last world positions. Cycles and invalid owners are rejected.

Hold Shift while drawing for an attachment-target preview when `attachOnShift` is true. `anchorId` chooses an explicit owner. `showAttachments: true` in interaction options displays links for saved attachments.

With `smartConnect` enabled, arrows near two distinct workflow nodes become actual graph edges. Matching uses a 32-flow-unit tolerance. Existing source/target edges are reused. Otherwise the arrow remains an annotation. This is endpoint matching, not shape recognition or reversible sketch-to-graph synchronization.

## Promotion, style, and organization

Supply `toFlowNode` in initial plugin configuration to define promotion:

```ts
const drawing = drawPlugin({
  toFlowNode: annotation => ({
    type: 'acme-task', width: 240, height: 140,
    data: { label: String(annotation.data.label ?? 'New task'), status: 'Draft' },
  }),
});
// Install drawing once and register the acme-task renderer.
// Later: runtime.execute('draw.convert', annotationId);
```

Promotion preserves the ID and position and clears its anchor. `draw.style` changes ink color, stroke size, or opacity for an annotation. Use `editingPlugin()` for group/hide/lock/order/align commands. Whole-annotation erasing, dragging, resizing, and text changes share history when installed.

Image insertion, rotation, transform containers, and SVG document export are not included. Custom shapes extend rendering; they do not create a managed asset library.
