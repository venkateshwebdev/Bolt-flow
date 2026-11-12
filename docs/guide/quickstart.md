# Installation & quickstart

Get a canvas running, add drawing and undo, and learn where your application takes ownership. These instructions describe the current unpublished workspace packages.

## Try the examples here

Runnable examples have **Preview / Code** tabs. Preview runs the example; Code lets you edit its source. Press **Run** to apply edits, **Reset** to restore the example, and **Stop** to close the sandbox. Switching tabs preserves the running canvas. Installation commands and server configuration are ordinary copyable code blocks.

Advanced excerpts include sample data and layout in the read-only `demo.tsx` and `demo.css` files in the Code selector. Copy those support files with `Example.tsx` and `Styles.css` to reuse the complete example; they are ordinary local files, not an extra npm package.

Previews use the real local packages in isolated iframes. Storage and backend demos identify their in-memory adapters and mock responses. They do not change your playground canvas.

## Run the repository

You need Node.js 22+ and npm. From the repository root:

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173/playground` for the editor or `http://127.0.0.1:5173/docs` for these guides. The root URL redirects to the documentation. The development server uses source aliases, so package edits appear in the playground without a package build.

```sh
npm run typecheck
npm test
npm run build
```

`build` generates the package outputs and the documentation/playground application. Nothing is published by these commands.

## Consume built local packages

The package names below are workspace names, not a claim that they are available from the npm registry. Build and pack the packages you need, then install the resulting tarballs into an existing React 19 project.

```sh
# In the Bolt Flow repository:
npm run build:packages
npm pack -w bolt-flow-core -w bolt-flow-react \
  -w bolt-flow-plugin-draw -w bolt-flow-plugin-history

# In your React 19 application, use the actual path to this repository:
npm install /absolute/path/to/Bolt-Flow/bolt-flow-core-0.1.0.tgz \
  /absolute/path/to/Bolt-Flow/bolt-flow-react-0.1.0.tgz \
  /absolute/path/to/Bolt-Flow/bolt-flow-plugin-draw-0.1.0.tgz \
  /absolute/path/to/Bolt-Flow/bolt-flow-plugin-history-0.1.0.tgz
```

Install interdependent tarballs together so npm can resolve the local peer packages. Pack additional plugins in the same way. Within an npm workspace, declare the matching package versions and build their outputs before consuming their public exports. Do not import another package's `src` files from a downstream application.

## Create your first editor

Start with the same node and edge objects you use in React Flow. `BoltFlow` creates and cleans up its own document; a provider and runtime are not required. This is a complete component:

```tsx
import { BoltFlow, Position } from 'bolt-flow-react';
import 'bolt-flow-react/style.css';

const nodes = [
  { id: 'signup', position: { x: 0, y: 100 },
    sourcePosition: Position.Right, data: { label: 'Sign up' } },
  { id: 'welcome', position: { x: 240, y: 100 },
    targetPosition: Position.Left, data: { label: 'Welcome email' } },
];
const edges = [{ id: 'welcome', source: 'signup', target: 'welcome' }];

export default function App() {
  return <div style={{ height: 420 }}>
    <BoltFlow defaultNodes={nodes} defaultEdges={edges}
      fitView fitViewOptions={{ maxZoom: 1 }} />
  </div>;
}
```

## Choose how much to add

- Start with `defaultNodes` and `defaultEdges` for an internally managed canvas.
- Use `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, and `onConnect` with React Flow's state hooks when your application owns the graph.
- Pass `nodeTypes`, `edgeTypes`, viewport props, and React Flow children as usual.
- Add `plugins={[drawPlugin()]}` for drawing, text notes, shapes, and comments. Import its stylesheet too.
- Use `onDocumentChange` to observe committed edits, or a `BoltFlowRef` to read/import the complete JSON on demand. Saving is explicit.
- Opt into `editor={{ ... }}` for the existing layers, properties, and actions shell. A plain canvas remains the default.

See the [React Flow-style API](react-flow.md) for complete controlled, drawing, and save examples. Keep node type maps and plugin definitions outside render, or memoize them. A parent with a nonzero height is required.

## Load the styles

Both stylesheet imports are public package exports. The React stylesheet imports React Flow's base CSS. Drawing CSS includes the self-hosted Gochi Hand font used by the default handwritten preset.

If your CSS pipeline does not resolve nested package `@import` rules, import `@xyflow/react/dist/style.css` and `@fontsource/gochi-hand/latin-400.css` explicitly from installed dependencies. Preserve their licenses and the React Flow attribution. See [themes and customization](styling.md) for your own fonts and tokens.

## Add explicit saving

Saving is optional. Installing drawing or history does not save the canvas. Add the storage package and create a manual controller:

```ts
import { createPersistenceController, localStorageAdapter } from 'bolt-flow-plugin-storage';

const persistence = createPersistenceController(runtime, {
  mode: 'manual',
  adapter: localStorageAdapter(window.localStorage, id => `my-product:${id}`),
});

await persistence.save(); // Call from your own Save button.
// At the end of this controller's lifetime:
persistence.dispose();
```

This advanced snippet assumes `runtime` is the existing editor runtime, available as `ref.current.runtime` from `BoltFlow`. The [React Flow-style API](react-flow.md) also shows saving plain JSON directly. Create the controller once for its owning editor/destination, not inside every render. Read [saving and storage](persistence.md) for a React status component, async adapters, error handling, and load confirmation.

## Build a smaller integration

If you need complete layout ownership, use `BoltCanvas` instead of `BoltEditor`. A bare canvas does not mount drawing toolbar contributions outside it; render `BoltTools` and pass the same interaction object to both components. The [editor UI guide](react-editor.md) provides the full controlled example.

For custom workflow cards, continue with [nodes and edges](nodes-edges.md). For generated workflow JSON, continue with [workflow integration](workflow-json.md).
