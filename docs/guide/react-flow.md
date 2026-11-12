# React Flow-style API

Bolt Flow adds drawing, notes, canvas JSON, image capture, and storage to React Flow. Start with `BoltFlow`; it owns the provider and runtime lifecycle. The underlying React Flow components, hooks, event shapes, custom nodes, and edges remain available. Existing `BoltProvider`, `BoltCanvas`, and `BoltEditor` integrations continue to work.

## Controlled nodes and edges

This complete example uses the familiar state hooks and `addEdge`. Drag, connect, delete, or rename a node using the button. Host changes and committed gestures update the portable document too.

```tsx
import { BoltFlow, Panel, addEdge, useNodesState, useEdgesState } from 'bolt-flow-react';
import 'bolt-flow-react/style.css';

const initialNodes = [
  { id: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
  { id: 'finish', position: { x: 240, y: 120 }, data: { label: 'Finish' } },
];

export default function ControlledFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  return <div style={{ height: 420 }}>
    <BoltFlow nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      onConnect={connection => setEdges(current => addEdge(connection, current))}
      fitView fitViewOptions={{ maxZoom: 1 }}>
      <Panel position="top-right">
        <button onClick={() => setNodes(current => current.map(node =>
          node.id === 'start' ? { ...node, data: { label: 'Ready' } } : node
        ))}>Rename start</button>
      </Panel>
    </BoltFlow>
  </div>;
}
```

When you provide `nodes` or `edges`, your corresponding change handler must apply changes using React Flow's helpers. Drawing, undo, imports, and plugin commands also emit add/remove/replace changes through these handlers. Keep **all** nodes in that state, including annotations; filtering annotations out would discard them. Selection, measured sizes, and in-progress drag flags are transient UI state, not saved document fields. A completed drag records one document edit.

Graph props update the document when their array references change. Apply callback changes promptly with functional setters. For async approvals, keep a local interactive graph and persist it asynchronously instead of delaying the state callbacks.

## Add drawing and undo

The same canvas supports pen, highlighter, eraser, shapes, arrows, text notes, rich text, comments, attachments, and custom tools. All drawing and flow changes share one history. This example adds only drawing, history, and two host-owned buttons:

```tsx
import { useRef } from 'react';
import { BoltFlow, Panel, type BoltFlowRef } from 'bolt-flow-react';
import { drawPlugin } from 'bolt-flow-plugin-draw';
import { historyPlugin } from 'bolt-flow-plugin-history';
import 'bolt-flow-react/style.css';
import 'bolt-flow-plugin-draw/style.css';

const plugins = [historyPlugin(), drawPlugin()];

export default function DrawingFlow() {
  const flow = useRef<BoltFlowRef>(null);
  return <div style={{ height: 480 }}>
    <BoltFlow ref={flow} plugins={plugins} defaultTool="draw.pen" fitView={false}
      toolOptions={{ color: '#2563eb', size: 2, keepTool: true }}>
      <Panel position="bottom-right">
        <button onClick={() => flow.current?.runtime.execute('history.undo')}>Undo</button>
        <button onClick={() => flow.current?.runtime.execute('history.redo')}>Redo</button>
      </Panel>
    </BoltFlow>
  </div>;
}
```

`onCreated(id, kind)` and `onMessage(message)` observe drawing outcomes. `tool` / `onToolChange` and `toolOptions` / `onToolOptionsChange` make tools controlled when needed. Pass `toolbar={false}` to build your own toolbar. Custom shapes, fonts, promotion rules, and tool lists are configured in `drawPlugin(options)`; the complete [drawing guide](drawing.md) documents them. `readOnly` blocks gestures and edit commands.

## Save and reopen JSON explicitly

You decide when and where to save. `toJSON()` includes nodes, edges, annotations, attachments, layers, and extension settings. `loadJSON()` validates before replacing the document and resets history. This example keeps the saved JSON in React state; replace that setter with your API or storage call. No save occurs until the button is pressed.

```tsx
import { useRef, useState } from 'react';
import { BoltFlow, Panel, type BoltFlowRef } from 'bolt-flow-react';
import 'bolt-flow-react/style.css';

export default function SaveFlow() {
  const flow = useRef<BoltFlowRef>(null);
  const [saved, setSaved] = useState('');
  return <div style={{ height: 420 }}>
    <BoltFlow ref={flow}
      defaultNodes={[{ id: 'task', position: { x: 80, y: 120 }, data: { label: 'Move me, then save' } }]}
      fitView fitViewOptions={{ maxZoom: 1 }}>
      <Panel position="top-right">
        <button onClick={() => setSaved(flow.current!.toJSON())}>Save JSON</button>
        <button disabled={!saved} onClick={() => flow.current!.loadJSON(saved)}>Reopen saved</button>
        <span role="status">{saved ? 'Snapshot saved' : 'Not saved yet'}</span>
      </Panel>
    </BoltFlow>
  </div>;
}
```

`toJSON({ includeViewport: true })` also captures current pan and zoom. A document with a saved view restores it on initial load and through `loadJSON()`.

For an existing saved canvas, parse it with `parseCanvas` from `bolt-flow-core` and pass `defaultDocument`. Defaults initialize once; use `loadJSON()` for a later replacement. `onDocumentChange(document, meta)` observes committed edits without imposing storage. Autosave, async status, conflict handling, adapters, and optional viewport capture remain in the [storage](persistence.md) and [workflow JSON](workflow-json.md) guides. PNG capture remains in [import & export](export.md); use a DOM ref around `BoltFlow` as the capture root.

## Customize or compose the UI

Pass React Flow's `nodeTypes`, `edgeTypes`, `snapToGrid`, `snapGrid`, `minZoom`, `maxZoom`, `defaultViewport`, `onInit`, and pointer callbacks directly to `BoltFlow`. `onInit` receives the ordinary React Flow instance; `ref` receives Bolt's document handle. Import the same primitives from `@xyflow/react`, or use the convenience reexports from `bolt-flow-react`.

`showGrid`, `showControls`, and `showMinimap` configure built-in controls. Set them to false when supplying your own `Background`, `Controls`, or `MiniMap` children. `nodeDefaults` and `edgeDefaults` supply shared styles while each object's own styles take precedence. Custom React components stay in `nodeTypes` and `edgeTypes`; serializable values stay in node/edge data. CSS classes and tokens customize the shell independently.

`editor={{ panels, actions, style, className, onError }}` opts into the full existing editor layout. Every panel can be replaced or hidden. The [editor layout](react-editor.md), [custom nodes](nodes-edges.md), and [styling](styling.md) guides cover those extension points. Low-level composition with `BoltProvider`, `BoltCanvas`, `BoltTools`, layers, and inspectors remains supported when your app must own a shared runtime.

## API and ownership

| Prop or handle | Behavior |
| --- | --- |
| `defaultNodes`, `defaultEdges` | Initial graph. Internal state owns later edits. |
| `nodes`, `edges` | Controlled graph; apply the respective change callbacks. |
| `onNodesChange`, `onEdgesChange`, `onConnect` | React Flow events. A supplied `onConnect` owns edge creation. |
| `defaultDocument` | Initial complete schema-2 canvas; graph props take precedence. |
| `plugins` | Optional feature definitions, in dependency order. Core editing is included. |
| `tool`, `defaultTool`, `onToolChange` | Controlled tool or initial tool; defaults to select. |
| `toolOptions`, `onToolOptionsChange` | Drawing settings and change callback. |
| `toolbar` | Show contributed tools; defaults to true. |
| `editor` | Optional full editor shell; omitted for a plain canvas. |
| `onDocumentChange` | Committed graph, annotation, import, or extension changes. |
| `ref.current.getDocument()` | Current immutable document. |
| `ref.current.toJSON()` | Serialize complete document without saving anywhere. |
| `ref.current.loadJSON(json)` | Validate and replace document. |
| `ref.current.runtime` | Full command/plugin API, storage and advanced integration escape hatch. |

Keep plugin definitions stable. Changing the list adds/removes plugin IDs; changing a factory's options for the same ID requires remounting that editor (for example with a React `key`) or explicit runtime removal/reinstallation. Removing a renderer keeps its document data. BoltFlow cleans up its runtime and plugins on actual unmount, including under React Strict Mode.

Documents use JSON-safe data. Put functions, React elements, and service instances in custom component code or context. Edge labels in portable documents are strings; render richer labels in a custom edge component. Native React Flow UI fields are retained while rendering but excluded from saved JSON. This constraint enables validation, storage, export, and undo to share one portable representation.
