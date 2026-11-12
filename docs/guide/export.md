# Import & export

Use JSON to preserve an editable canvas and PNG to share its visual appearance. They are separate outputs with separate save status and browser requirements.

## Serialize complete documents

```ts
import { serializeCanvas, parseCanvas } from 'bolt-flow-core';

const json = serializeCanvas(runtime.getDocument());
const loaded = parseCanvas(json);
runtime.replaceDocument(loaded, { source: 'import' });
```

The runtime is supplied by your application. Serialization includes graph nodes, edges, annotation geometry, rich text, comments, attachments, styles, groups, visibility/lock flags, extensions, and optional view. It excludes runtime components, callbacks, selected IDs, pointer drafts, and undo stacks.

`parseCanvas(input, maxBytes?)` rejects invalid or oversized JSON before it can replace state. The default limit is 25 MiB. Valid schema 1 files migrate to schema 2; future versions are rejected. Unknown renderer data survives even if the relevant plugin is not installed.

## Use JSON exchange commands

```ts
import { exportPlugin } from 'bolt-flow-plugin-export';

runtime.use(exportPlugin({ maxImportBytes: 10 * 1024 * 1024 }));
const json = runtime.execute<undefined, string>('export.json');
runtime.execute('import.json', json);
runtime.execute('export.download');
```

`export.json` and `import.json` work without a browser. `export.download` uses a browser Blob/download and suggests a `.bolt.json` filename based on the document name. The maximum size option applies to imports, not to how much state an application can construct itself.

Import is an undoable document replacement when history is installed. It does not install missing renderers or restore the React Flow viewport by itself. Apply view state through your host UI when intended.

## Import a browser file

```tsx
import { parseCanvas } from 'bolt-flow-core';
import { useBolt } from 'bolt-flow-react';

export function ImportButton() {
  const runtime = useBolt();
  return <label>Import JSON<input type="file" accept=".json"
    onChange={async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error('File exceeds 25 MiB.');
        const document = parseCanvas(await file.text());
        runtime.replaceDocument(document, { source: 'file.import' });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Import failed');
      }
    }} /></label>;
}
```

Use your application's error UI instead of `alert` in a polished integration. If replacement can discard unsaved work, resolve that choice in your import flow before committing. Use JSON studio-style preview/insertion when the user wants to merge objects rather than replace the canvas.

## Export a full PNG

Install the optional image-export package, then pass a mounted element containing the React Flow viewport:

```ts
import { downloadCanvasPng } from 'bolt-flow-plugin-image-export';

await downloadCanvasPng(canvasElement, runtime.getDocument(), {
  includeAnnotations: true,
  background: '#ffffff', grid: 'dots', gridColor: '#e2e8f0',
  padding: 40, scale: 2, maxDimension: 8192,
  fileName: 'approval-flow.png',
});
```

`canvasElement` is an HTMLElement from your own ref, not an arbitrary page selector. The exporter captures a cloned viewport and full visible-object bounds, including built-in route points. It does not pan, zoom, or deselect the live canvas. Hidden nodes and editor handles/formatting controls are excluded.

## PNG options

| Option | Default | Meaning |
| --- | --- | --- |
| `includeAnnotations` | `true` | Include native annotation nodes |
| `selectedIds` | Omitted | Limit to these visible node IDs; an empty array exports all |
| `background` | `#ffffff` | Output canvas background color |
| `grid` | No grid | `none`, `dots`, or `lines` |
| `gridColor` | `#e4e4eb` | Export grid color |
| `padding` | `40` | Flow-coordinate padding around bounds |
| `scale` | `2` | Pixel ratio for output |
| `maxDimension` | `8192` | Maximum output width or height in pixels |
| `fileName` | Derived from document name | Suggested download name |

Only edges whose endpoints are both included are exported. A selection region is determined by selected node bounds, not an arbitrary crop rectangle. A custom edge renderer that paints beyond those bounds may need a larger padding or its own export implementation.

## Return a Blob or register a command

```ts
import { canvasToPng } from 'bolt-flow-plugin-image-export';

const blob = await canvasToPng(canvasElement, runtime.getDocument(), { scale: 1 });
// Your application can preview, upload, or store this Blob.
```

```ts
import { imageExportPlugin } from 'bolt-flow-plugin-image-export';

runtime.use(imageExportPlugin({
  getElement: () => canvasRef.current,
  defaults: { background: '#ffffff', scale: 2 },
}));
await runtime.execute('export.png', { includeAnnotations: false });
```

The second example assumes `canvasRef` is a host ref. `export.png` downloads the image and merges supplied options with plugin defaults. Use `canvasToPng` directly if you need a Blob instead of a browser download.

## Assets and fidelity

PNG export waits for document fonts and included image elements to load. Fonts and images must be accessible to the browser and capturable by `html-to-image`; cross-origin restrictions and custom CSS/DOM can affect results. Keep custom renderers mounted and provide their dimensions. Virtualized offscreen nodes cannot be captured if they are absent from the DOM.

Large exports are rejected when scaled dimensions exceed the configured limit. Reduce scale, export a selection, or split the document. More memory can be consumed before browser limits are reached, so test your target scenes and devices.

Use JSON for later editing. PNG is a visual snapshot. SVG export, image insertion tools, and automatic server rendering are not provided by this package.
