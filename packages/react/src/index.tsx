import { createContext, useContext, useSyncExternalStore, useState, useEffect, useMemo, useCallback, type ComponentType, type ReactNode } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, type Node, type Edge, type ReactFlowProps, type NodeChange, type EdgeChange, type Connection, type NodeTypes, type EdgeTypes, type NodeProps } from '@xyflow/react';
import { portableGraph } from './graph-state';
import { BoltWaypointEdge } from './waypoint-edge';
import { BoltRuntime, moveNodes, expandNodeSelection, type BoltNode, type Json, type BoltEdge } from 'bolt-flow-core';

const ReadOnlyContext = createContext(false);
export function useBoltReadOnly() { return useContext(ReadOnlyContext); }
const RuntimeContext = createContext<BoltRuntime | null>(null);
export function BoltProvider({ runtime, children, readOnly = false }: { runtime: BoltRuntime; children: ReactNode; readOnly?: boolean }) {
  useEffect(() => readOnly ? runtime.beforeCommand(id => /^(draw\.|editor\.|history\.(undo|redo)|layout\.|import\.|storage\.load)/.test(id) ? 'This canvas is read only.' : true) : undefined, [runtime, readOnly]);
  return <RuntimeContext.Provider value={runtime}><ReadOnlyContext.Provider value={readOnly}><ReactFlowProvider>{children}</ReactFlowProvider></ReadOnlyContext.Provider></RuntimeContext.Provider>;
}
export function useBolt() {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('Wrap your canvas in <BoltProvider runtime={runtime}>.');
  return runtime;
}
export function useBoltSnapshot() {
  const runtime = useBolt();
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot);
}
/** A generic tool contract. The React adapter does not import drawing or other feature packages. */
export interface CanvasToolProps {
  tool: string;
  options: Record<string, Json>;
  onToolChange?: (tool: string) => void;
  onOptionsChange?: (options: Record<string, Json>) => void;
  onCreated?: (id: string, kind: 'node' | 'edge') => void;
  onMessage?: (message: string) => void;
  readOnly?: boolean;
}
export interface CanvasExtension { id: string; component: ComponentType<CanvasToolProps> }
export function BoltTools(props: CanvasToolProps) {
  const runtime = useBolt();
  useBoltSnapshot();
  return <>{runtime.getContributions<CanvasExtension>('canvas.tools').map(({ id, component: Tools }) => <Tools key={id} {...props} />)}</>;
}
export interface BoltCanvasProps extends Omit<ReactFlowProps, 'defaultNodes' | 'defaultEdges'> {
  theme?: 'light' | 'dark';
  showGrid?: boolean;
  showControls?: boolean;
  showMinimap?: boolean;
  interaction?: CanvasToolProps;
  readOnly?: boolean;
  selectedNodeIds?: string[];
  selectedEdgeIds?: string[];
  nodeDefaults?: Partial<Pick<BoltNode, 'style' | 'className' | 'draggable' | 'connectable' | 'selectable'>>;
  edgeDefaults?: Partial<Omit<BoltEdge, 'id' | 'source' | 'target'>>;
}
function MissingNode({ data }: NodeProps) {
  return <div className="bolt-missing-node">{String(data.label ?? 'Saved annotation')}<small>Enable its rendering plugin to edit</small></div>;
}
const fallbackTypes: NodeTypes = { 'bolt:missing': MissingNode };
const idleInteraction: CanvasToolProps = { tool: 'select', options: {} };

/** One graph viewport for flow nodes, drawing nodes, comments, and extension tools. */
export function BoltCanvas({ theme = 'light', showGrid = true, showControls = true, showMinimap = false, interaction = idleInteraction,
  readOnly = false, selectedNodeIds, selectedEdgeIds, nodeDefaults, edgeDefaults, children, nodeTypes, edgeTypes, nodes: controlledNodes, edges: controlledEdges, onNodesChange: notifyNodes, onEdgesChange: notifyEdges, onConnect: notifyConnect, ...props }: BoltCanvasProps) {
  const runtime = useBolt();
  const inheritedReadOnly = useBoltReadOnly();
  const lockedCanvas = readOnly || inheritedReadOnly;
  const snapshot = useBoltSnapshot();
  const { document } = snapshot;
  const types = useMemo(() => ({ ...fallbackTypes, ...Object.assign({}, ...runtime.getContributions<NodeTypes>('canvas.nodeTypes')), ...nodeTypes }), [runtime, snapshot.plugins, nodeTypes]);
  const connectionTypes = useMemo(() => ({ 'bolt-waypoint': BoltWaypointEdge, ...Object.assign({}, ...runtime.getContributions<EdgeTypes>('canvas.edgeTypes')), ...edgeTypes }), [runtime, snapshot.plugins, edgeTypes]);
  const mapNode = useCallback((node: BoltNode, current?: Node): Node => {
    const requested = node.type ?? 'default';
    return {
      ...(node.role === 'annotation' ? {} : nodeDefaults), ...node,
      style: { ...(node.role === 'annotation' ? {} : nodeDefaults?.style), ...node.style },
      type: ['default', 'input', 'output', 'group'].includes(requested) || types[requested] ? requested : 'bolt:missing',
      measured: current?.measured,
      selected: node.hidden || node.locked ? false : current?.selected,
      draggable: !lockedCanvas && !node.locked && (node.draggable ?? nodeDefaults?.draggable ?? true),
      selectable: !node.hidden && !node.locked && (node.selectable ?? nodeDefaults?.selectable ?? true),
      connectable: !lockedCanvas && !node.locked && (node.connectable ?? nodeDefaults?.connectable ?? true),
      deletable: !lockedCanvas && !node.locked && ((node as Node).deletable ?? true),
    };
  }, [nodeDefaults, types, lockedCanvas]);
  const mapEdge = useCallback((edge: BoltEdge, current?: Edge): Edge => ({
    ...edgeDefaults, ...edge, style: { ...edgeDefaults?.style, ...edge.style },
    markerStart: (edge.markerStart ?? edgeDefaults?.markerStart) || undefined,
    markerEnd: (edge.markerEnd ?? edgeDefaults?.markerEnd) || undefined,
    selected: current?.selected,
  }), [edgeDefaults]);
  const [nodes, setNodes] = useState<Node[]>(() => document.nodes.map((node) => ({ ...mapNode(node), selected: selectedNodeIds?.includes(node.id) })));
  const [edges, setEdges] = useState<Edge[]>(() => document.edges.map((edge) => ({ ...mapEdge(edge), selected: selectedEdgeIds?.includes(edge.id) })));
  useEffect(() => {
    setNodes((current) => document.nodes.map((node) => mapNode(node, current.find((item) => item.id === node.id))));
  }, [document.nodes, mapNode]);
  useEffect(() => {
    setEdges((current) => document.edges.map((edge) => mapEdge(edge, current.find((item) => item.id === edge.id))));
  }, [document.edges, mapEdge]);

  // Selection is UI state: never restore saved positions during a live drag.
  useEffect(() => {
    if (selectedNodeIds === undefined) return;
    const selected = new Set(expandNodeSelection(document.nodes, selectedNodeIds));
    setNodes((current) => current.some((node) => !!node.selected !== selected.has(node.id))
      ? current.map((node) => !!node.selected === selected.has(node.id) ? node : { ...node, selected: selected.has(node.id) }) : current);
  }, [selectedNodeIds, document.nodes]);
  useEffect(() => {
    if (selectedEdgeIds === undefined) return;
    const selected = new Set(selectedEdgeIds);
    setEdges((current) => current.some((edge) => !!edge.selected !== selected.has(edge.id))
      ? current.map((edge) => !!edge.selected === selected.has(edge.id) ? edge : { ...edge, selected: selected.has(edge.id) }) : current);
  }, [selectedEdgeIds, document.edges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const editableChanges = changes.filter(change => change.type === 'select' || change.type === 'dimensions' || (!lockedCanvas && (!('id' in change) || !runtime.getDocument().nodes.find(n => n.id === change.id)?.locked)));
    const outgoing = [...editableChanges];
    if (controlledNodes && editableChanges.some(change => change.type === 'select')) {
      const preview = applyNodeChanges(editableChanges, controlledNodes);
      const selected = new Set(expandNodeSelection(runtime.getDocument().nodes, preview.filter(node => node.selected).map(node => node.id)));
      preview.forEach(node => { if (!!node.selected !== selected.has(node.id)) outgoing.push({ type: 'select', id: node.id, selected: selected.has(node.id) }); });
    }
    notifyNodes?.(outgoing);
    if (controlledNodes !== undefined) return;
    setNodes((current) => {
      let next = applyNodeChanges(editableChanges, current);
      if (editableChanges.some(change => change.type === 'select')) {
        const selected = new Set(expandNodeSelection(runtime.getDocument().nodes, next.filter(n => n.selected).map(n => n.id)));
        next = next.map(n => ({ ...n, selected: selected.has(n.id) }));
      }
      const moving = new Map(next.filter(n => editableChanges.some(change => change.type === 'position' && change.id === n.id)).map(n => [n.id, n.position]));
      if (moving.size) {
        const preview = structuredClone(runtime.getDocument());
        moveNodes(preview, moving);
        const positions = new Map(preview.nodes.filter(n => n.anchor).map(n => [n.id, n.position]));
        next = next.map(n => positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n);
      }
      return next;
    });
    const removed = new Set(editableChanges.filter((change) => change.type === 'remove').map((change) => change.id));
    const savedChanges = editableChanges.filter(change => change.type === 'add' || change.type === 'replace' || (change.type === 'dimensions' && change.setAttributes));
    if (removed.size || savedChanges.length) runtime.updateDocument((draft) => {
      draft.nodes = portableGraph(applyNodeChanges(savedChanges, draft.nodes as Node[])) as BoltNode[];
      draft.nodes = draft.nodes.filter((node) => !removed.has(node.id));
      draft.edges = draft.edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target));
    }, { source: removed.size ? 'graph.delete' : 'graph.update' });
  }, [runtime, lockedCanvas, controlledNodes, notifyNodes]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (lockedCanvas) changes = changes.filter(change => change.type === 'select');
    notifyEdges?.(changes);
    if (controlledEdges !== undefined) return;
    setEdges((current) => applyEdgeChanges(changes, current));
    const removed = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id));
    const savedChanges = changes.filter(change => change.type === 'add' || change.type === 'replace');
    if (removed.size || savedChanges.length) runtime.updateDocument((draft) => {
      draft.edges = portableGraph(applyEdgeChanges(savedChanges, draft.edges as Edge[])).filter(edge => !removed.has(edge.id)) as BoltEdge[];
    }, { source: removed.size ? 'graph.delete' : 'graph.update' });
  }, [runtime, lockedCanvas, controlledEdges, notifyEdges]);
  const onConnect = useCallback((connection: Connection) => {
    if (lockedCanvas) return;
    if (notifyConnect) { notifyConnect(connection); return; }
    if (controlledEdges !== undefined) return;
    runtime.updateDocument((draft) => {
      if (draft.edges.some((edge) => edge.source === connection.source && edge.target === connection.target && (edge.sourceHandle ?? null) === connection.sourceHandle && (edge.targetHandle ?? null) === connection.targetHandle)) return;
      draft.edges.push({ type: 'smoothstep', ...edgeDefaults, ...connection, id: crypto.randomUUID() });
    }, { source: 'graph.connect' });
  }, [runtime, edgeDefaults, lockedCanvas, notifyConnect, controlledEdges]);
  const projectedNodes = useMemo(() => {
    if (!controlledNodes) return undefined;
    const preview = structuredClone(document);
    const moving = new Map(controlledNodes.filter(node => node.dragging).map(node => [node.id, node.position]));
    if (moving.size) moveNodes(preview, moving);
    const attached = new Map(preview.nodes.filter(node => node.anchor).map(node => [node.id, node.position]));
    return controlledNodes.map(node => ({ ...node, ...mapNode(node as BoltNode, node),
      ...(moving.size && attached.has(node.id) ? { position: attached.get(node.id)! } : {}) }));
  }, [controlledNodes, document, mapNode]);
  const activeTool = interaction.tool !== 'select' && interaction.tool !== 'pan';
  const panning = interaction.tool === 'pan';
  return <ReadOnlyContext.Provider value={lockedCanvas}><div className="bolt-canvas" data-theme={theme} data-tool={interaction.tool}>
    <ReactFlow {...props} nodeTypes={types} edgeTypes={connectionTypes} nodes={projectedNodes ?? nodes} edges={controlledEdges?.map(edge => ({ ...edge, ...mapEdge(edge as BoltEdge, edge) })) ?? edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
      nodesDraggable={!lockedCanvas && !activeTool && !panning && (props.nodesDraggable ?? true)} nodesConnectable={!lockedCanvas && !activeTool && !panning && (props.nodesConnectable ?? true)}
      elementsSelectable={!activeTool && !panning && (props.elementsSelectable ?? true)}
      panOnDrag={props.panOnDrag ?? panning} selectionOnDrag={!activeTool && !panning && (props.selectionOnDrag ?? true)}
      autoPanOnNodeDrag={props.autoPanOnNodeDrag ?? false} autoPanOnSelection={props.autoPanOnSelection ?? false}
      colorMode={theme} fitView={props.fitView ?? true} minZoom={props.minZoom ?? 0.15} maxZoom={props.maxZoom ?? 3}
      deleteKeyCode={activeTool || lockedCanvas ? null : props.deleteKeyCode === undefined ? ['Backspace', 'Delete'] : props.deleteKeyCode}
      onNodeDragStop={(event, node, draggedNodes) => {
        if (lockedCanvas) return;
        const moved = new Map(draggedNodes.map((item) => [item.id, item.position]));
        if (controlledNodes === undefined) runtime.updateDocument((draft) => {
          moveNodes(draft, moved);
        }, { source: 'graph.move' });
        props.onNodeDragStop?.(event, node, draggedNodes);
      }}>
      {showGrid && <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={theme === 'dark' ? '#3a435a' : '#ccd1df'} />}
      {showControls && <Controls />}
      {showMinimap && <MiniMap pannable zoomable nodeColor="#a99af4" />}
      {runtime.getContributions<CanvasExtension>('canvas.overlay').map(({ id, component: Overlay }) => <Overlay key={id} {...interaction} readOnly={lockedCanvas || interaction.readOnly} />)}
      {children}
    </ReactFlow>
  </div></ReadOnlyContext.Provider>;
}
export { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, Panel, addEdge, applyNodeChanges, applyEdgeChanges, useNodesState, useEdgesState, Handle, Position, useReactFlow, useViewport, NodeResizer, BaseEdge, getBezierPath } from '@xyflow/react';
export type { Node, Edge, NodeProps, NodeTypes, EdgeTypes, ReactFlowInstance, ReactFlowProps, NodeChange, EdgeChange, Connection } from '@xyflow/react';
export * from './editor';
export { BoltWaypointEdge } from './waypoint-edge';

export { BoltFlow, type BoltFlowProps, type BoltFlowRef } from './bolt-flow';
