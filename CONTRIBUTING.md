# Contributing to Bolt Flow

Start with the [README](README.md) and [documentation index](docs/guide/README.md). Use Node.js 22+ and npm workspaces. Run `npm install`, then `npm run dev` to serve `/playground` and `/docs`. Edit the canonical guides in `docs/guide/`; keep the documentation page registry and source imports aligned when adding a guide.

Keep core free of React, DOM and optional feature dependencies. Install features explicitly through plugins. Use one document and viewport for graph nodes and annotations. Preserve unknown extension data and provide migrations when document contracts change. Never put functions, React components, secrets or service clients in portable JSON.

For a behavior change, add a focused regression test that exercises the observable result. Keep documentation examples aligned with public package exports. Verify:

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:consumer
npm audit
```

The browser suite includes preservation of selection and viewport during editing, drawing history, rich text, attachment chains, layers, explicit saving and generated-document handling. The built-consumer fixture checks public exports, a custom editor action/panel, CSS, fonts and fallback geometry without source aliases.

Describe the user-visible problem, behavior change, compatibility impact and validation in each pull request. Use [the roadmap](docs/ROADMAP.md) to distinguish implemented features from future work. Physical touch/stylus devices, additional browsers and large-scene performance need their own evidence.

Preserve applicable MIT and font licenses and React Flow attribution. Inspect any reused third-party code's license before copying it; restricted example code is not part of this project.

Packages are unpublished alpha workspaces. A document schema change must explain old-file migration and whether older consumers can read newly saved files. npm publication, package-name ownership, release versioning and remote repository changes require a separately reviewed release decision; running local builds never publishes packages.

Documentation examples are executable: each fenced block is adapted by the sandbox registry in `apps/playground/src/sandbox/examples.ts`. When adding or reordering excerpts, update that registry and run `tests/sandbox.spec.ts`. Show host scaffolding and label all mock services explicitly. The preview bundles local packages and runs in an opaque-origin iframe; do not add `allow-same-origin` or evaluate user-edited example code in the documentation page.
