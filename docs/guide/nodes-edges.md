# Custom nodes & edges

A document's `type` selects a renderer. Keep renderers in application code and portable state in `data`, styles, dimensions, and IDs.

## Register a custom workflow card

This example defines a card with target and source handles. Declare the renderer map outside the component so it keeps a stable identity.

```tsx
import {
  BoltCanvas, Handle, Position,
  type Node, type NodeProps,
} from 'bolt-flow-react';

type TaskData = { label: string; owner: string; status: string };
function TaskNode({ data, selected }: NodeProps<Node<TaskData>>) {
  return <article className={`task-card ${selected ? 'is-selected' : ''}`}>
    <Handle type="target" position={Position.Left} id="input" />
    <strong>{data.label}</strong>
    <p>{data.owner}</p>
    <small>{data.status}</small>
    <Handle type="source" position={Position.Right} id="output" />
  </article>;
}
const nodeTypes = { 'acme-task': TaskNode };
export function WorkflowCanvas() {
  return <BoltCanvas nodeTypes={nodeTypes} />;
}
```

Add a corresponding node through the existing runtime:

```ts
runtime.updateDocument(draft => {
  draft.nodes.push({
    id: 'task-42', type: 'acme-task',
    position: { x: 100, y: 80 }, width: 180, height: 96,
    data: { label: 'Review proposal', owner: 'Design team', status: 'Ready' },
  });
}, { source: 'app.add-task' });
```

Provide card styling that respects the wrapper dimensions:

```css
.task-card { height: 100%; padding: 12px; border-radius: inherit; }
.task-card strong { display: block; font-size: 14px; }
.task-card p { font-size: 12px; opacity: .7; }
.task-card.is-selected { outline: 2px solid #2563eb; outline-offset: 2px; }
```

Renderer callbacks should validate any custom data they consume or render sensible defaults. Imported JSON may have a valid Bolt schema but unexpected application fields.

## Add interactive controls

React Flow treats a node as a drag target. Add `nodrag` to buttons and inputs that should not move it. Use `nopan` for controls that should not pan the viewport and `nowheel` for scrollable content.

```tsx
<button className="nodrag nopan" onClick={() => openTaskDetails(data.label)}>
  Open task
</button>
```

`openTaskDetails` is your application callback. A custom renderer can use `useBolt()` to update domain fields, but should respect `useBoltReadOnly()` and your own permission rules. Use a single draft transaction for one semantic action.

## Connect named handles

Multiple handles need stable IDs, and serialized edges must use those IDs:

```ts
runtime.updateDocument(draft => {
  draft.edges.push({
    id: 'route-1', source: 'task-42', target: 'task-43',
    sourceHandle: 'output', targetHandle: 'input',
    label: 'Approved', type: 'smoothstep',
    markerEnd: { type: 'arrowclosed', color: '#2563eb' },
    style: { stroke: '#2563eb', strokeWidth: 2 },
  });
}, { source: 'app.connect' });
```

Both task IDs must already exist. Edge `source` and `target` always refer to node IDs, not handle IDs. Handle position is a renderer concern; reconnecting or custom execution logic belongs to the host.

## Customize defaults and overrides

```tsx
<BoltCanvas nodeTypes={nodeTypes}
  nodeDefaults={{ style: {
    backgroundColor: '#ffffff', color: '#182230',
    borderColor: '#cbd5e1', borderWidth: 1, borderStyle: 'solid', borderRadius: 10,
  } }}
  edgeDefaults={{ type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#94a3b8' } }} />
```

Per-object `style` values override matching defaults. `markerEnd: false` suppresses a default arrowhead. Host defaults are presentation props; they are not automatically written into every node. Persist portable defaults in `extensions` and resolve them in the host when that is part of your document contract.

Host node defaults do not apply to annotation styling. Drawing has its own data/settings contract and renderers. Some interaction defaults are resolved by the adapter; use explicit per-node flags when your custom annotation renderer needs different behavior.

## Use editable waypoints

Set `type: 'bolt-waypoint'` and store points in flow coordinates:

```ts
const edge = {
  id: 'manual-route', source: 'task-42', target: 'task-43',
  type: 'bolt-waypoint',
  data: { points: [{ x: 350, y: 180 }, { x: 480, y: 180 }] },
};
```

Double-click the path to add a point. Select the edge and drag a handle to move it; double-click or Delete a focused handle to remove it. A drag commits one document change. Points round-trip through JSON and move with an inserted or duplicated subgraph.

The current implementation appends new waypoints in stored order. It does not perform nearest-segment insertion, obstacle avoidance, or orthogonal route constraints. Arbitrary movement of connected endpoints does not automatically reroute stored points.

## Define an edge renderer

Use React Flow's edge interface and register a stable map. The example below needs `@xyflow/react` as a direct dependency in the consuming app for its public `EdgeProps` type.

```tsx
import { BaseEdge, getBezierPath, BoltCanvas } from 'bolt-flow-react';
import type { EdgeProps } from '@xyflow/react';

function ApprovalEdge(props: EdgeProps) {
  const [path] = getBezierPath(props);
  return <BaseEdge id={props.id} path={path}
    markerEnd={props.markerEnd}
    style={{ ...props.style, strokeWidth: props.selected ? 3 : 2 }} />;
}
const edgeTypes = { approval: ApprovalEdge };
// Mount inside your provider:
function Canvas() { return <BoltCanvas edgeTypes={edgeTypes} />; }
```

Persist `type: 'approval'` on matching edges. For custom label portals, advanced routing, or selection visuals, use the upstream React Flow API and forward the props your feature needs. Core preserves portable data but does not interpret arbitrary renderer internals.

## Plugin renderers and missing types

A plugin can contribute `canvas.nodeTypes` and `canvas.edgeTypes`. Host maps passed to `BoltCanvas` take precedence over contributed maps. The built-in waypoint type can also be overridden by a host edge renderer.

Unknown node renderer types show a placeholder rather than deleting their objects. Enable the required plugin or supply the renderer to edit them fully. Drawing's saved custom SVG path offers a fallback when drawing is enabled but the original custom shape definition is absent.

Keep selection, hover, edit drafts, and component instances out of the document. Save application state that affects reproducible rendering and rebuild renderer functions when loading the application.
