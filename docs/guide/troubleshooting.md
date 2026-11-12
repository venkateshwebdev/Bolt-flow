# Troubleshooting & deployment

Start with the smallest reproducible canvas, then check layout, provider ownership, styles, and plugin registration. Most integration problems come from those boundaries.

## The canvas is blank

Check that the parent has a real height and width. In a grid/flex layout, use `min-height: 0` and `min-width: 0` on shrinking children, and give the editor a bounded height. Confirm that `BoltCanvas` is inside `BoltProvider` and that the runtime document contains valid nodes.

If nodes exist far outside the visible region, use an explicit Fit action. If rendering custom types, verify `nodeTypes` keys match serialized `type` strings. A missing type shows a placeholder rather than loading code from JSON.

## Tools do not draw or switch back

Install drawing and render its tool UI. `BoltTools` and `BoltCanvas` must share the same `interaction` state under the same provider. Apply `onToolChange`; otherwise a requested return to Select has nowhere to go.

Use `draw.pen` for interaction and `pen` for the plugin allowlist/creation command. Check provider/canvas read-only state and the drawing allowlist. Do not put a separate full-screen overlay above the canvas unless it deliberately handles pointer input.

## Styles or fonts are missing

Import `bolt-flow-react/style.css` and, for drawing, `bolt-flow-plugin-draw/style.css`. If your bundler cannot resolve nested CSS imports, load React Flow CSS and the Fontsource font CSS explicitly from installed dependencies.

Registering a custom font family does not fetch a font. Serve its files, preserve the license, and verify the production asset URL. CSS class names saved in a document require the matching host stylesheet when reopening elsewhere.

## The viewport jumps while editing

Remove effects that fit the canvas on every document change, selection update, panel resize, or tool switch. Initial fit and explicit Fit, Focus, Layout, Template, and Import actions are different from normal edits.

Keep controlled selected IDs separate from document remapping. Let the adapter project live drag state. For later saved-document loads, restore `view` through `flow.setViewport` or fit if no view exists, not both.

## Save appears successful but newer edits are unsaved

A save acknowledges one snapshot revision. If the user edits during a slow write, that write can succeed while the current document remains dirty. Show the controller's `dirty` field alongside success state and allow another save.

A downloaded JSON file does not acknowledge remote or browser storage. Confirm the controller's document ID/key matches the destination you are reopening. Browser storage is per-origin/profile; a different port is a different origin.

## A conflict blocks further saves

The backend may have a newer version. The controller intentionally stops writes after `PersistenceConflict`. Reload successfully, or switch to a new document identity for a save-copy flow. Retrying the same stale write without reconciliation is not a conflict resolution strategy.

A failed reload retains the conflict barrier. Implement backend ETag/version enforcement; local runtime revisions alone do not detect other clients' edits.

## Imported JSON fails validation

Check schema version, duplicate IDs, missing source/target nodes, nonfinite coordinates, invalid dimensions, malformed style values, and anchor cycles. `parseCanvas` also enforces its byte limit. Valid schema 1 imports migrate; schema 3 or later is rejected by this version.

Application data is also subject to JSON serializability: functions, DOM nodes, undefined values in objects, cyclic references, and special runtime objects are not portable state. Preserve unknown extension data when writing your own converter.

## PNG export fails or crops custom content

Ensure the canvas is mounted and all included renderers exist in the DOM. A virtualized node that is not mounted cannot be captured. Verify images/fonts load without CORS or decoding failures and that the output is below the configured maximum dimension.

The exporter uses node dimensions plus built-in waypoint bounds. Custom edge curves, labels, shadows, or renderer content that extends beyond declared dimensions can require more padding or a host-specific exporter. Test with the actual fonts and image hosts used in production.

## Multiple editors share shortcuts or state

Use separate runtimes/providers for independent documents and keep shortcut listeners scoped to the editor root. Give storage adapters distinct keys. Avoid application-global handlers for drawing shortcuts and avoid nesting independent `data-bolt-editor` roots.

Sharing a runtime intentionally shares the document and plugin policy. Do not mistake shared-runtime views for independent editing sessions.

## Server rendering and framework integration

Core, history, layout, and JSON serialization can run without a browser. React Flow UI, native rich-text editing, localStorage, file downloads, and PNG capture need a browser. In frameworks with server components, mount the editor in a client component and create browser storage adapters only on the client.

Keep runtime ownership stable across re-renders and route transitions. Do not reuse a disposed runtime. React Strict Mode can replay effect cleanup, so choose a lifecycle boundary that does not permanently dispose an instance during a temporary effect cycle.

## Build and deploy this site

```sh
npm run build
npm run preview -w bolt-flow-playground
```

The site output is `apps/playground/dist`. It contains `/playground` and `/docs` client-side routes, plus JavaScript/CSS/font assets. Configure static hosting to serve `index.html` for unknown application paths while serving actual assets normally. Otherwise a direct refresh on `/docs/persistence` can return a server 404.

For an Nginx static deployment, the essential routing pattern is:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Set the site's document root to the build directory in your own deployment configuration. For a subdirectory deployment, configure Vite's base and the router basename consistently, then review root-relative links and assets. The checked-in application currently assumes hosting at the origin root.

The docs are checked-in Markdown under `docs/guide`, rendered by the site. Add a guide to the navigation registry when adding a page. Relative sibling `.md` links become documentation routes. Code blocks have copy controls; search matches titles, descriptions, and guide text.

## Validation and contribution workflow

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run test:consumer
npm audit
```

Run focused tests while iterating and the required checks before a release. The consumer check uses built public package exports rather than playground aliases. Browser tests cover Chromium at several viewport sizes; they do not prove Safari, physical touch/stylus, or large-document performance.

Before npm publication, review package names, peer dependencies, generated declarations, CSS/font assets, README/license files, compatibility policy, and `npm pack --dry-run` output for each package. Publishing and pushing are separate release actions.

## Known boundaries

Current groups are logical selection groups, not transform containers. Custom shapes are host-defined code, not a remote marketplace. Legacy Excalidraw data is opaque. Images, rotation, SVG scene export, multiplayer, managed cloud services, and large-scene optimization remain future work.

The runtime clones, validates, and freezes whole documents. Keep pointer drafts outside the document and commit at gesture boundaries. Measure your own document sizes and histories before making performance guarantees.

## Documentation sandboxes

Use **Open sandbox** under any code block. The compiler and local package bundle load only on demand (about 3 MB uncompressed in the current build). Run replaces the iframe with a fresh session; closing it stops that session. A sandbox stores no playground data and uses no remote package service. Browser examples run actual package APIs; shell/server examples preview the installed editor, while host-service examples explicitly show their mock implementations.

The iframe has an opaque origin and cannot read its parent document or local storage. Compilation uses scripts and evaluation inside that frame. If your deployment imposes a stricter inherited Content Security Policy, configure a separately hosted sandbox origin with a suitable policy or disable live examples; do not relax the editor application's policy merely to execute examples. Unsupported imports and syntax/runtime errors appear beneath the example, and Reset recovers the original source.
