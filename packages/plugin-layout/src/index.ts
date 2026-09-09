import dagre from '@dagrejs/dagre';
import type { BoltPlugin } from 'bolt-flow-core';

export interface LayoutOptions { direction?: 'LR' | 'TB' | 'RL' | 'BT'; nodeGap?: number; rankGap?: number }
export function layoutPlugin(defaults: LayoutOptions = {}): BoltPlugin {
  return {
    id: 'layout', name: 'Smart layout', version: '0.1.0',
    setup(context) {
      context.registerCommand({ id: 'layout.arrange', title: 'Auto-arrange canvas', shortcut: '⇧L', execute(options?: LayoutOptions) {
        const { direction = 'LR', nodeGap = 70, rankGap = 90 } = { ...defaults, ...options };
        const document = context.getDocument();
        const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
        graph.setGraph({ rankdir: direction, nodesep: nodeGap, ranksep: rankGap, marginx: 40, marginy: 40 });
        document.nodes.filter((node) => node.role !== 'annotation').forEach((node) => graph.setNode(node.id, { width: node.width ?? 240, height: node.height ?? 130 }));
        document.edges.filter((edge) => graph.hasNode(edge.source) && graph.hasNode(edge.target)).forEach((edge) => graph.setEdge(edge.source, edge.target));
        dagre.layout(graph);
        context.updateDocument((draft) => {
          draft.nodes.forEach((node) => {
            if (node.role === 'annotation') return;
            const position = graph.node(node.id);
            node.position = { x: position.x - (node.width ?? 240) / 2, y: position.y - (node.height ?? 130) / 2 };
          });
        }, { source: 'layout' });
      } });
    },
  };
}