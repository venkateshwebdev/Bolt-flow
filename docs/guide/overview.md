# Build the canvas your product needs

Bolt Flow is a composable toolkit for workflows, drawings, and annotations on one connected canvas. Start with the ready-made React editor, then replace its tools, panels, renderers, styling, and application actions as your product grows.

[Open the playground](/playground) · [Build your first editor](quickstart.md) · [Browse the API](api-reference.md)

## What you can build

Use Bolt Flow for workflow builders, architecture diagrams, planning boards, annotated processes, and applications that generate editable graphs from JSON. Workflow nodes and native drawing objects share one document, one viewport, and an optional shared undo history. A note can follow a workflow step, and an arrow drawn between steps can become a real graph connection.

The host application decides what a workflow means, how to execute it, who may edit it, and where to save it. Bolt Flow supplies the canvas and extension contracts. It does not execute business workflows or connect to an AI backend automatically.

## Choose your starting point

| Your goal | Start here |
| --- | --- |
| Explore without writing code | [Playground tour](playground.md) |
| Embed a working editor | [Installation and quickstart](quickstart.md) |
| Replace the editor layout | [Editor layout and UI](react-editor.md) |
| Render application-specific cards | [Custom nodes and edges](nodes-edges.md) |
| Add annotation tools and custom shapes | [Drawing and annotations](drawing.md) |
| Apply your design system | [Themes and customization](styling.md) |
| Save to your application backend | [Saving and storage](persistence.md) |
| Restore layout over generated workflows | [Workflow and generated JSON](workflow-json.md) |
| Add new capabilities | [Commands and plugins](commands-plugins.md) |

## How the architecture fits together

There are three layers:

1. **The document and runtime.** `bolt-flow-core` owns a validated, immutable JSON document. Changes happen through transactions and commands. Core has no React, DOM, or drawing dependencies.
2. **The React adapter.** `bolt-flow-react` connects that document to React Flow. It provides a canvas, hooks, a default editor shell, replaceable UI primitives, and contribution slots.
3. **Optional plugins.** Drawing, history, layout, persistence, JSON exchange, and PNG export can be installed independently. Applications can define additional plugins using the same public interfaces.

The SDK installs no plugins automatically. The playground installs the editing commands and enables history initially, then loads other capabilities on demand. Removing a plugin removes its UI and commands while retaining document data.

## Package map

| Package | Purpose | Browser needed? |
| --- | --- | --- |
| `bolt-flow-core` | Runtime, schema, validation, editing commands, JSON and presentation helpers | No |
| `bolt-flow-react` | React bindings, canvas, editor primitives, editable waypoint edge | Yes for rendering |
| `bolt-flow-plugin-draw` | Native ink, shapes, text, comments, connected annotations | Yes for UI; HTML conversion needs a browser unless supplied by host |
| `bolt-flow-plugin-history` | Shared document undo/redo | No |
| `bolt-flow-plugin-layout` | Dagre workflow layout | No |
| `bolt-flow-plugin-storage` | Manual/autosave controllers and adapters | Only when using browser storage |
| `bolt-flow-plugin-export` | JSON import/export commands | Only downloading requires a browser |
| `bolt-flow-plugin-image-export` | Capture a mounted canvas as PNG | Yes |

All packages use ESM. React bindings target React 19. The repository uses Node.js 22+, TypeScript, npm workspaces, tsup, and Vite.

## Two kinds of customization

**Application developers** control components, layout, node and edge renderers, tools, commands, panels, shortcuts, serialization integration, persistence adapters, and application actions such as Validate or Run.

**End users** work within the capabilities the host exposes: colors, dimensions, rich text, grouping, visibility, locking, tool ordering, presets, zoom, and saving. A hidden toolbar button is a UI preference; it is not backend authorization.

The [customization guide](styling.md) shows where each setting belongs. Functions, credentials, React components, and storage clients stay in host code. Portable appearance and annotation data can live in document JSON.

## Current support and boundaries

This is an **unpublished 0.1.0 alpha**, not a package release announcement. Use the repository or built local packages. Schema 2 documents are supported, and valid schema 1 documents migrate on import. Older clients that only accept schema 1 cannot read new schema 2 exports.

Native drawing includes rich text, comments, attachments, groups, custom shapes, and PNG export. It is not a complete general-purpose drawing suite. Images, rotation, full container transforms, SVG export, multiplayer, managed cloud services, and a document-library UI remain future work. Legacy Excalidraw extension data is preserved as opaque JSON, not rendered or converted.

Chromium automated tests cover the shipped interactions. Physical stylus/touch qualification, additional browsers, large-scene benchmarks, and a complete accessibility audit require further work. Read [troubleshooting and deployment](troubleshooting.md) before integrating into a production application.

## Where to go next

Follow [the quickstart](quickstart.md) for a complete minimal editor. Keep the [playground](/playground) open while reading the focused guides. The website renders these same checked-in Markdown files, so documentation changes are reviewed alongside source changes.
