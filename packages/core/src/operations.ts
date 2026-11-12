import { syncAnchors, type BoltDocument, type BoltNode, type BoltEdge, type BoltPlugin, type Point } from './index';

/** Translate built-in route points when copying a subgraph to a new position. */
export function translateEdgeRoute(edge: BoltEdge, offset: Point): BoltEdge {
  const copy = structuredClone(edge);
  if (copy.type === 'bolt-waypoint' && Array.isArray(copy.data?.points)) {
    copy.data.points = copy.data.points.map(point => {
      if (!point || typeof point !== 'object' || Array.isArray(point) || typeof point.x !== 'number' || typeof point.y !== 'number') return point;
      return { ...point, x: point.x + offset.x, y: point.y + offset.y };
    });
  }
  return copy;
}

export function expandNodeSelection(nodes: readonly BoltNode[], ids: readonly string[]): string[] {
  const requested = new Set(ids);
  const groups = new Set(nodes.filter(n => requested.has(n.id) && n.groupId).map(n => n.groupId));
  return nodes.filter(n => !n.hidden && !n.locked && (requested.has(n.id) || (n.groupId && groups.has(n.groupId)))).map(n => n.id);
}

/** Apply absolute positions once, then reconcile every dependent anchor. */
export function moveNodes(document: BoltDocument, positions: ReadonlyMap<string, Point>): void {
  const nodes = new Map(document.nodes.map(n => [n.id, n]));
  const done = new Set<string>(), visiting = new Set<string>();
  const move = (node: BoltNode): void => {
    if (done.has(node.id)) return;
    if (visiting.has(node.id)) throw new Error('Cyclic annotation anchor.');
    visiting.add(node.id);
    const owner = node.anchor && nodes.get(node.anchor.nodeId);
    if (owner) move(owner);
    const position = positions.get(node.id);
    if (position && !node.locked) {
      node.position = { ...position };
      if (owner && node.anchor) node.anchor.offset = { x: position.x - owner.position.x, y: position.y - owner.position.y };
    } else if (owner && node.anchor) {
      node.position = { x: owner.position.x + node.anchor.offset.x, y: owner.position.y + node.anchor.offset.y };
    }
    visiting.delete(node.id); done.add(node.id);
  };
  document.nodes.forEach(move);
}

export function duplicateNodes(document: BoltDocument, ids: readonly string[], offset: Point = { x: 32, y: 32 }): string[] {
  const selected = new Set(expandNodeSelection(document.nodes, ids));
  const remap = new Map([...selected].map(id => [id, crypto.randomUUID()]));
  const groups = new Map<string, string>();
  const copies = document.nodes.filter(n => selected.has(n.id)).map(node => {
    const copy = structuredClone(node);
    copy.id = remap.get(node.id)!;
    copy.position = { x: copy.position.x + offset.x, y: copy.position.y + offset.y };
    if (copy.groupId) {
      if (!groups.has(copy.groupId)) groups.set(copy.groupId, crypto.randomUUID());
      copy.groupId = groups.get(copy.groupId)!;
    }
    if (copy.anchor) {
      const owner = remap.get(copy.anchor.nodeId);
      if (owner) copy.anchor.nodeId = owner;
      else copy.anchor.offset = { x: copy.anchor.offset.x + offset.x, y: copy.anchor.offset.y + offset.y };
    }
    return copy;
  });
  const edges = document.edges.filter(e => selected.has(e.source) && selected.has(e.target)).map(e => ({ ...translateEdgeRoute(e, offset), id: crypto.randomUUID(), source: remap.get(e.source)!, target: remap.get(e.target)! }));
  document.nodes.push(...copies); document.edges.push(...edges); syncAnchors(document);
  return copies.map(n => n.id);
}

/** Optional command pack shared by default and custom editor UIs. */
export function editingPlugin(): BoltPlugin {
  return { id: 'editor', name: 'Canvas editing', version: '0.2.0', setup(ctx) {
    const selected = (ids: string[]) => {
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Expected an array of node IDs.');
      return expandNodeSelection(ctx.getDocument().nodes, ids);
    };
    ctx.registerCommand({ id: 'editor.group', title: 'Group selection', execute(ids: string[]) {
      const targets = selected(ids);
      if (targets.length < 2) throw new Error('Select at least two unlocked items.');
      const groupId = crypto.randomUUID();
      ctx.updateDocument(doc => { doc.nodes.forEach(n => { if (targets.includes(n.id)) n.groupId = groupId; }); }, { source: 'editor.group' });
      return groupId;
    } });
    ctx.registerCommand({ id: 'editor.ungroup', title: 'Ungroup selection', execute(ids: string[]) {
      const targets = selected(ids);
      ctx.updateDocument(doc => { doc.nodes.forEach(n => { if (targets.includes(n.id)) delete n.groupId; }); }, { source: 'editor.ungroup' });
    } });
    ctx.registerCommand({ id: 'editor.duplicate', title: 'Duplicate selection', execute(ids: string[]) {
      let result: string[] = [];
      ctx.updateDocument(doc => { result = duplicateNodes(doc, selected(ids)); }, { source: 'editor.duplicate' });
      return result;
    } });
    ctx.registerCommand({ id: 'editor.delete', title: 'Delete selection', execute(ids: string[]) {
      const targets = new Set(selected(ids));
      ctx.updateDocument(doc => { doc.nodes = doc.nodes.filter(n => !targets.has(n.id)); doc.edges = doc.edges.filter(e => !targets.has(e.source) && !targets.has(e.target)); }, { source: 'editor.delete' });
    } });
    ctx.registerCommand({ id: 'editor.layer', title: 'Update layer', execute({ ids, hidden, locked }: { ids: string[]; hidden?: boolean; locked?: boolean }) {
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string') || [hidden, locked].some(v => v !== undefined && typeof v !== 'boolean')) throw new Error('Invalid layer update.');
      ctx.updateDocument(doc => { doc.nodes.forEach(n => { if (ids.includes(n.id)) { if (hidden !== undefined) n.hidden = hidden; if (locked !== undefined) n.locked = locked; } }); }, { source: 'editor.layer' });
    } });
    ctx.registerCommand({ id: 'editor.order', title: 'Reorder selection', execute({ ids, direction }: { ids: string[]; direction: 'front' | 'back' }) {
      if (!['front', 'back'].includes(direction)) throw new Error('Invalid layer direction.');
      const targets = selected(ids);
      ctx.updateDocument(doc => {
        const levels = doc.nodes.map(n => n.zIndex ?? 0);
        const z = direction === 'front' ? Math.max(0, ...levels) + 1 : Math.min(0, ...levels) - 1;
        doc.nodes.forEach(n => { if (targets.includes(n.id)) n.zIndex = z; });
      }, { source: 'editor.order' });
    } });
    ctx.registerCommand({ id: 'editor.align', title: 'Align selection', execute({ ids, axis }: { ids: string[]; axis: 'left' | 'top' | 'center-x' | 'center-y' }) {
      const targets = selected(ids);
      if (!['left', 'top', 'center-x', 'center-y'].includes(axis)) throw new Error('Invalid alignment.');
      ctx.updateDocument(doc => {
        const nodes = doc.nodes.filter(n => targets.includes(n.id));
        if (nodes.length < 2) return;
        const horizontal = axis === 'left' || axis === 'center-x';
        const coord = horizontal ? 'x' : 'y';
        const size = (n: BoltNode) => horizontal ? n.width ?? 240 : n.height ?? 100;
        const start = Math.min(...nodes.map(n => n.position[coord]));
        const end = Math.max(...nodes.map(n => n.position[coord] + size(n)));
        const positions = new Map(nodes.map(n => [n.id, { ...n.position, [coord]: axis.startsWith('center') ? (start + end - size(n)) / 2 : start }]));
        moveNodes(doc, positions);
      }, { source: 'editor.align' });
    } });
  } };
}
