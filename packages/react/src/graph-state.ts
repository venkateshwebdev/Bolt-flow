import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import type { BoltNode, BoltEdge } from 'bolt-flow-core';

// React Flow's transient UI fields do not belong in portable canvas JSON.
export function portableGraph<T>(value: T): T {
  const clean = (item: unknown) => {
    if (!item || typeof item !== 'object') return item;
    const { selected, dragging, resizing, measured, ...saved } = item as Node;
    return saved;
  };
  return JSON.parse(JSON.stringify(Array.isArray(value) ? value.map(clean) : clean(value), (_key, item: unknown) => {
    if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') {
      throw new Error('Bolt Flow documents require JSON data. Keep event handlers and React elements in your nodeTypes components.');
    }
    return item;
  }));
}
export function nodeChanges(next: BoltNode[], previous: BoltNode[], current: Node[]): NodeChange[] {
  const before = new Map(previous.map(node => [node.id, node]));
  const ids = new Set(next.map(node => node.id));
  const changes: NodeChange[] = previous.filter(node => !ids.has(node.id)).map(node => ({ type: 'remove', id: node.id }));
  next.forEach((node, index) => {
    const old = before.get(node.id);
    const ui = current.find(item => item.id === node.id);
    const item = { ...node, ...(ui ? { selected: ui.selected, measured: ui.measured } : {}) } as Node;
    if (!old) changes.push({ type: 'add', item, index });
    else if (JSON.stringify(old) !== JSON.stringify(node)) changes.push({ type: 'replace', id: node.id, item });
  });
  return changes;
}
export function edgeChanges(next: BoltEdge[], previous: BoltEdge[], current: Edge[]): EdgeChange[] {
  const before = new Map(previous.map(edge => [edge.id, edge]));
  const ids = new Set(next.map(edge => edge.id));
  const changes: EdgeChange[] = previous.filter(edge => !ids.has(edge.id)).map(edge => ({ type: 'remove', id: edge.id }));
  next.forEach((edge, index) => {
    const old = before.get(edge.id);
    const item = { ...edge, markerStart: edge.markerStart || undefined, markerEnd: edge.markerEnd || undefined,
      selected: current.find(item => item.id === edge.id)?.selected } as Edge;
    if (!old) changes.push({ type: 'add', item, index });
    else if (JSON.stringify(old) !== JSON.stringify(edge)) changes.push({ type: 'replace', id: edge.id, item });
  });
  return changes;
}

