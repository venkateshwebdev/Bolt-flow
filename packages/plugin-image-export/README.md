# bolt-flow-plugin-image-export

Optional full-content PNG export for a mounted Bolt Flow canvas. Unpublished alpha; use local workspace packages.

Exports `canvasToPng(element, document, options)` → `Promise<Blob>`, `downloadCanvasPng`, `exportBounds`, and `imageExportPlugin({ getElement, defaults })`, which registers `export.png`.

Options: `includeAnnotations`, `selectedIds`, `background`, `grid` (`none`, `dots`, `lines`), `gridColor`, `padding`, `scale`, `maxDimension`, and `fileName`. Defaults include annotations, 40px padding, 2× scale, white background and an 8192px maximum dimension. Hidden objects and editor controls are excluded. The canvas viewport is cloned and the live view is not changed.

Requires a mounted React Flow viewport, browser Canvas support, loaded fonts, and accessible image assets. Uses html-to-image, which retains its MIT license. Arbitrary custom DOM/CSS and cross-origin assets can have capture limitations. This package does not implement SVG export or image insertion.

See the [customization guide](../../docs/CUSTOMIZATION.md#export-images) and [validation commands](../../README.md#validate-and-build).
