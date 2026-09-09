import { createContext, useContext, useSyncExternalStore, useState, useEffect, useMemo, useCallback, type ComponentType, type ReactNode } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, type Node, type Edge, type ReactFlowProps, type NodeChange, type EdgeChange, type Connection, type NodeTypes, type EdgeTypes, type NodeProps } from '@xyflow/react';
import { BoltRuntime, type BoltNode, type Json, type BoltEdge } from '@bolt-flow/core';

const RuntimeContext = createContext<BoltRuntime | null>(null);
export function BoltProvider({ runtime, children }: { runtime: BoltRuntime; children: ReactNode }) {
  return <RuntimeContext.Provider value={runtime}><ReactFlowProvider>{children}</ReactFlowProvider></RuntimeContext.Provider>;
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
}
export interface CanvasExtension { id: string; component: ComponentType<CanvasToolProps> }
export function BoltTools(props: CanvasToolProps) {
  const runtime = useBolt();
  useBoltSnapshot();
  return <>{runtime.getContributions<CanvasExtension>('canvas.tools').map(({ id, component: Tools }) => <Tools key={id} {...props} />)}</>;
}
export interface BoltCanvasProps extends Omit<ReactFlowProps, 'nodes' | 'edges' | 'onNodesChange' | 'onEdgesChange' | 'onConnect'> {
  theme?: 'light' | 'dark';
  showGrid?: boolean;
  showControls?: boolean;
  showMinimap?: boolean;
  interaction?: CanvasToolProps;
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
  selectedNodeIds, selectedEdgeIds, nodeDefaults, edgeDefaults, children, nodeTypes, edgeTypes, ...props }: BoltCanvasProps) {
  const runtime = useBolt();
  const snapshot = useBoltSnapshot();
  const { document } = snapshot;
  const types = useMemo(() => ({ ...fallbackTypes, ...Object.assign({}, ...runtime.getContributions<NodeTypes>('canvas.nodeTypes')), ...nodeTypes }), [runtime, snapshot.plugins, nodeTypes]);
  const connectionTypes = useMemo(() => ({ ...Object.assign({}, ...runtime.getContributions<EdgeTypes>('canvas.edgeTypes')), ...edgeTypes }), [runtime, snapshot.plugins, edgeTypes]);
  const mapNode = useCallback((node: BoltNode, current?: Node): Node => {
    const requested = node.type ?? 'default';
    return {
      ...(node.role === 'annotation' ? {} : nodeDefaults), ...node,
      style: { ...(node.role === 'annotation' ? {} : nodeDefaults?.style), ...node.style },
      type: ['default', 'input', 'output', 'group'].includes(requested) || types[requested] ? requested : 'bolt:missing',
      measured: current?.measured,
      selected: current?.selected,
    };
  }, [nodeDefaults, types]);
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
    const selected = new Set(selectedNodeIds);
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
    setNodes((current) => {
      const next = applyNodeChanges(changes, current);
      const moving = new Set(changes.filter((change) => change.type === 'position').map((change) => change.id));
      // Attached ink follows the live React Flow drag, not just the committed document.
      return next.map((node) => {
        const anchor = runtime.getDocument().nodes.find((item) => item.id === node.id)?.anchor;
        if (!anchor || !moving.has(anchor.nodeId)) return node;
        const owner = next.find((item) => item.id === anchor.nodeId);
        return owner ? { ...node, position: { x: owner.position.x + anchor.offset.x, y: owner.position.y + anchor.offset.y } } : node;
      });
    });
    const removed = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id));
    if (removed.size) runtime.updateDocument((draft) => {
      draft.nodes = draft.nodes.filter((node) => !removed.has(node.id));
      draft.edges = draft.edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target));
    }, { source: 'graph.delete' });
  }, [runtime]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
    const removed = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id));
    if (removed.size) runtime.updateDocument((draft) => { draft.edges = draft.edges.filter((edge) => !removed.has(edge.id)); }, { source: 'graph.delete' });
  }, [runtime]);
  const onConnect = useCallback((connection: Connection) => {
    runtime.updateDocument((draft) => {
      if (draft.edges.some((edge) => edge.source === connection.source && edge.target === connection.target && (edge.sourceHandle ?? null) === connection.sourceHandle && (edge.targetHandle ?? null) === connection.targetHandle)) return;
      draft.edges.push({ type: 'smoothstep', ...edgeDefaults, ...connection, id: crypto.randomUUID() });
    }, { source: 'graph.connect' });
  }, [runtime, edgeDefaults]);
  const activeTool = interaction.tool !== 'select' && interaction.tool !== 'pan';
  const panning = interaction.tool === 'pan';
  return <div className="bolt-canvas" data-theme={theme} data-tool={interaction.tool}>
    <ReactFlow {...props} nodeTypes={types} edgeTypes={connectionTypes} nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
      nodesDraggable={!activeTool && !panning && (props.nodesDraggable ?? true)} nodesConnectable={!activeTool && !panning && (props.nodesConnectable ?? true)}
      elementsSelectable={!activeTool && !panning && (props.elementsSelectable ?? true)}
      panOnDrag={props.panOnDrag ?? panning} selectionOnDrag={!activeTool && !panning && (props.selectionOnDrag ?? true)}
      autoPanOnNodeDrag={props.autoPanOnNodeDrag ?? false} autoPanOnSelection={props.autoPanOnSelection ?? false}
      colorMode={theme} fitView={props.fitView ?? true} minZoom={props.minZoom ?? 0.15} maxZoom={props.maxZoom ?? 3}
      deleteKeyCode={activeTool ? null : props.deleteKeyCode === undefined ? ['Backspace', 'Delete'] : props.deleteKeyCode}
      onNodeDragStop={(event, node, draggedNodes) => {
        const moved = new Map(draggedNodes.map((item) => [item.id, item.position]));
        runtime.updateDocument((draft) => {
          draft.nodes.forEach((item) => {
            const position = moved.get(item.id);
            if (!position) return;
            item.position = position;
            if (item.anchor && !moved.has(item.anchor.nodeId)) {
              const owner = draft.nodes.find((candidate) => candidate.id === item.anchor!.nodeId);
              if (owner) item.anchor.offset = { x: position.x - owner.position.x, y: position.y - owner.position.y };
            }
          });
        }, { source: 'graph.move' });
        props.onNodeDragStop?.(event, node, draggedNodes);
      }}>
      {showGrid && <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={theme === 'dark' ? '#3a435a' : '#ccd1df'} />}
      {showControls && <Controls />}
      {showMinimap && <MiniMap pannable zoomable nodeColor="#a99af4" />}
      {runtime.getContributions<CanvasExtension>('canvas.overlay').map(({ id, component: Overlay }) => <Overlay key={id} {...interaction} />)}
      {children}
    </ReactFlow>
  </div>;
}
export { Handle, Position, useReactFlow, useViewport, NodeResizer, BaseEdge, getBezierPath } from '@xyflow/react';
export type { Node, Edge, NodeProps, NodeTypes, EdgeTypes, ReactFlowInstance } from '@xyflow/react';