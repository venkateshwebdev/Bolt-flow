import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { BoltRuntime, createDocument, editingPlugin, parseCanvas, serializeCanvas, moveNodes, type BoltDocument, type BoltPlugin, type BoltNode, type BoltEdge, type ChangeMeta, type Json } from 'bolt-flow-core';
import type { Node, Edge, ReactFlowInstance, ReactFlowProps } from '@xyflow/react';
import { BoltCanvas, BoltProvider, BoltTools, type BoltCanvasProps, type CanvasToolProps } from './index';
import { portableGraph, nodeChanges, edgeChanges } from './graph-state';
import { BoltEditor, type BoltEditorProps } from './editor';

export interface BoltFlowRef {
  /** Escape hatch for every existing command, plugin, storage adapter and export. */
  runtime: BoltRuntime;
  getDocument(): BoltDocument;
  toJSON(options?: { includeViewport?: boolean }): string;
  loadJSON(json: string): void;
}
interface BoltFlowInternalProps extends Omit<BoltCanvasProps, 'interaction'> {
  ref?: Ref<BoltFlowRef>;
  defaultNodes?: Node[];
  defaultEdges?: Edge[];
  /** Initial JSON document, including annotations, layers and extension settings. */
  defaultDocument?: BoltDocument;
  plugins?: readonly BoltPlugin[];
  onDocumentChange?: (document: BoltDocument, meta: ChangeMeta) => void;
  tool?: string;
  defaultTool?: string;
  onToolChange?: (tool: string) => void;
  toolOptions?: Record<string, Json>;
  onToolOptionsChange?: (options: Record<string, Json>) => void;
  onCreated?: CanvasToolProps['onCreated'];
  onMessage?: CanvasToolProps['onMessage'];
  /** Hide the contributed drawing toolbar when supplying your own UI. */
  toolbar?: boolean;
  /** Optional complete shell. Omit to compose ordinary React Flow children. */
  editor?: Omit<BoltEditorProps, 'canvas' | 'interaction' | 'showTools'>;
}
export type BoltFlowProps<N extends Node = Node, E extends Edge = Edge> =
  Omit<BoltFlowInternalProps, keyof ReactFlowProps> & ReactFlowProps<N, E>;

/** Familiar React Flow types, including custom node and edge unions. */
export function BoltFlow<N extends Node = Node, E extends Edge = Edge>(props: BoltFlowProps<N, E>) {
  return <BoltFlowInternal {...props as unknown as BoltFlowInternalProps} />;
}

const noPlugins: readonly BoltPlugin[] = [];
const noOptions: Record<string, Json> = {};

/** React Flow-shaped entry point. Owns and cleans up its document and feature runtime. */
function BoltFlowInternal({ ref, defaultNodes, defaultEdges, defaultDocument, plugins = noPlugins,
  onDocumentChange, tool: controlledTool, defaultTool = 'select', onToolChange,
  toolOptions: controlledOptions, onToolOptionsChange, onCreated, onMessage, toolbar = true, editor, ...canvas }: BoltFlowInternalProps) {
  const [runtime] = useState(() => new BoltRuntime(createDocument({ ...defaultDocument,
    nodes: portableGraph(canvas.nodes ?? defaultNodes ?? defaultDocument?.nodes ?? []) as BoltNode[],
    edges: portableGraph(canvas.edges ?? defaultEdges ?? defaultDocument?.edges ?? []) as BoltEdge[],
  })).use(editingPlugin()));
  const nativeFlow = useRef<ReactFlowInstance | null>(null);
  const latest = useRef({ canvas, onDocumentChange });
  latest.current = { canvas, onDocumentChange };
  const [tool, setTool] = useState(defaultTool);
  const [options, setOptions] = useState(noOptions);
  const interaction = { onCreated, onMessage, tool: controlledTool ?? tool, options: controlledOptions ?? options,
    onToolChange: (next: string) => { setTool(next); onToolChange?.(next); },
    onOptionsChange: (next: Record<string, Json>) => { setOptions(next); onToolOptionsChange?.(next); } };

  useImperativeHandle(ref, () => ({ runtime, getDocument: runtime.getDocument,
    toJSON: (options) => serializeCanvas(options?.includeViewport && nativeFlow.current
      ? { ...runtime.getDocument(), view: nativeFlow.current.getViewport() } : runtime.getDocument()),
    loadJSON: (json: string) => {
      const document = parseCanvas(json);
      runtime.replaceDocument(document, { source: 'import.json', history: 'ignore' });
      if (document.view) void nativeFlow.current?.setViewport(document.view, { duration: 0 });
    },
  }), [runtime]);
  useLayoutEffect(() => runtime.onDocumentChange((next, previous, meta) => {
    const { canvas: props, onDocumentChange: notify } = latest.current;
    // Echo only plugin edits or corrections such as attached positions / dangling edges.
    if (props.nodes !== undefined) {
        const changes = nodeChanges(next.nodes, meta.source === 'react.props' ? portableGraph(props.nodes) as BoltNode[] : previous.nodes, props.nodes).filter(change => !('id' in change) || !props.nodes?.find(node => node.id === change.id)?.dragging);
        if (changes.length) props.onNodesChange?.(changes);
      }
      if (props.edges !== undefined) {
        const changes = edgeChanges(next.edges, meta.source === 'react.props' ? portableGraph(props.edges) as BoltEdge[] : previous.edges, props.edges);
        if (changes.length) props.onEdgesChange?.(changes);
      }
    notify?.(next, meta);
  }), [runtime]);
  useLayoutEffect(() => {
    const wanted = new Set(plugins.map(plugin => plugin.id));
    for (const plugin of [...runtime.getSnapshot().plugins].reverse()) {
      if (plugin.id !== 'editor' && !wanted.has(plugin.id)) runtime.remove(plugin.id);
    }
    for (const plugin of plugins) runtime.use(plugin);
  }, [runtime, plugins]);
  useLayoutEffect(() => {
    if (canvas.nodes === undefined && canvas.edges === undefined) return;
    runtime.updateDocument(draft => {
      if (canvas.nodes !== undefined) {
        const before = new Map(draft.nodes.map(node => [node.id, node]));
        const positions = new Map<string, { x: number; y: number }>();
        draft.nodes = canvas.nodes.map(node => {
          const next = portableGraph(node) as BoltNode;
          const old = before.get(node.id);
          // Keep transient drag previews in React Flow; commit once on release.
          if (old) {
            if (!node.dragging && (next.position.x !== old.position.x || next.position.y !== old.position.y)) positions.set(node.id, next.position);
            next.position = old.position;
          }
          return next;
        });
        moveNodes(draft, positions);
      }
      if (canvas.edges !== undefined) draft.edges = portableGraph(canvas.edges) as BoltEdge[];
      const ids = new Set(draft.nodes.map(node => node.id));
      draft.edges = draft.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
    }, { source: 'react.props' });
  }, [runtime, canvas.nodes, canvas.edges]);
  const lifetime = useRef(0);
  useLayoutEffect(() => {
    const generation = ++lifetime.current;
    // Strict Mode replays cleanup/setup synchronously. Dispose only on real unmount.
    return () => { queueMicrotask(() => { if (lifetime.current === generation) runtime.dispose(); }); };
  }, [runtime]);
  const canvasProps: BoltCanvasProps = { defaultViewport: defaultDocument?.view, fitView: defaultDocument?.view ? false : undefined, ...canvas,
    onInit: instance => { nativeFlow.current = instance; canvas.onInit?.(instance); } };
  return <BoltProvider runtime={runtime} readOnly={canvas.readOnly}>
    {editor ? <BoltEditor {...editor} interaction={interaction} canvas={canvasProps} showTools={toolbar} /> :
      <div className="bolt-flow" data-bolt-editor>
        <BoltCanvas {...canvasProps} interaction={interaction} />
        {toolbar && <div className="bolt-flow-tools"><BoltTools {...interaction} /></div>}
      </div>}
  </BoltProvider>;
}
