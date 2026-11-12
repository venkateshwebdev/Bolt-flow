import { describe, expect, it } from 'vitest';
import { BoltRuntime, createDocument, validateDocument, serializeCanvas, parseCanvas, captureCanvas, applyCanvas, insertCanvas, duplicateNodes, editingPlugin, moveNodes } from './index';
const chain = () => createDocument({ nodes: [
  { id: 'note', role: 'annotation', position: { x: 30, y: 40 }, anchor: { nodeId: 'arrow', offset: { x: 10, y: 10 } }, data: { label: 'Note' } },
  { id: 'step', position: { x: 0, y: 0 }, data: { secretBusinessData: 'preserve' } },
  { id: 'arrow', role: 'annotation', position: { x: 20, y: 30 }, anchor: { nodeId: 'step', offset: { x: 20, y: 30 } }, data: { shape: 'arrow' } },
] });
describe('portable document contracts', () => {
  it('translates route points with inserted and duplicated subgraphs', () => {
    const source = chain();
    source.edges.push({ id: 'route', source: 'step', target: 'arrow', type: 'bolt-waypoint', data: { points: [{ x: 100, y: 200 }] } });
    const inserted = insertCanvas(createDocument(), source, { x: 40, y: 50 }).document;
    expect(inserted.edges[0].data?.points).toEqual([{ x: 140, y: 250 }]);
    duplicateNodes(source, ['step', 'arrow'], { x: 20, y: 30 });
    expect(source.edges[1].data?.points).toEqual([{ x: 120, y: 230 }]);
    expect(source.edges[0].data?.points).toEqual([{ x: 100, y: 200 }]);
  });
  it('preserves node IDs that match object prototype keys in presentation JSON', () => {
    const graph = createDocument({ nodes: [{ id: '__proto__', position: { x: 30, y: 40 }, data: {} }] });
    const presentation = JSON.parse(JSON.stringify(captureCanvas(graph)));
    expect(Object.keys(presentation.nodes)).toEqual(['__proto__']);
    graph.nodes[0].position = { x: 0, y: 0 };
    expect(applyCanvas(graph, presentation).document.nodes[0].position).toEqual({ x: 30, y: 40 });
  });
  it('migrates v1 without losing extensions and rejects incompatible future versions', () => {
    const old = { ...createDocument(), schemaVersion: 1, extensions: { custom: { payload: [1, 'hello'] } } };
    const doc = parseCanvas(JSON.stringify(old));
    expect(doc.schemaVersion).toBe(2);
    expect(doc.extensions).toEqual(old.extensions);
    expect(parseCanvas(serializeCanvas(doc))).toEqual(doc);
    expect(() => validateDocument({ ...old, schemaVersion: 3 })).toThrow();
  });
  it('resolves arbitrary-order chains and detaches missing owners without jumps', () => {
    const runtime = new BoltRuntime(chain());
    runtime.updateDocument(doc => { doc.nodes[1].position.x = 100; });
    expect(runtime.getDocument().nodes[0].position).toEqual({ x: 130, y: 40 });
    runtime.updateDocument(doc => { doc.nodes = doc.nodes.filter(n => n.id !== 'arrow'); });
    expect(runtime.getDocument().nodes[0].anchor).toBeUndefined();
    expect(runtime.getDocument().nodes[0].position).toEqual({ x: 130, y: 40 });
  });
  it('rejects cycles atomically and keeps old v1 anchor semantics strict', () => {
    const runtime = new BoltRuntime(chain()), original = runtime.getDocument();
    expect(() => runtime.updateDocument(doc => { doc.nodes[1].anchor = { nodeId: 'note', offset: { x: 0, y: 0 } }; })).toThrow(/anchor/);
    expect(runtime.getDocument()).toBe(original);
    expect(() => validateDocument({ ...chain(), schemaVersion: 1 })).toThrow(/anchor/);
  });
  it('moves grouped chain members once and duplicates IDs and owners together', () => {
    const runtime = new BoltRuntime(chain()).use(editingPlugin());
    runtime.execute('editor.group', ['step', 'arrow', 'note']);
    runtime.updateDocument(doc => moveNodes(doc, new Map([['step', { x: 50, y: 50 }], ['arrow', { x: 70, y: 80 }], ['note', { x: 80, y: 90 }]])));
    expect(runtime.getDocument().nodes[0].position).toEqual({ x: 80, y: 90 });
    const ids = runtime.execute<string[], string[]>('editor.duplicate', ['step']);
    expect(ids).toHaveLength(3);
    const copies = runtime.getDocument().nodes.filter(n => ids.includes(n.id));
    expect(copies[0].anchor!.nodeId).toBe(copies[2].id);
    expect(copies[0].position).toEqual({ x: 112, y: 122 });
  });
  it('projects presentation without overwriting domain data and reports missing IDs', () => {
    const doc = chain(); doc.view = { x: 20, y: 10, zoom: 0.7 };
    const presentation = captureCanvas(doc);
    const graph = createDocument({ nodes: [{ id: 'step', data: { secretBusinessData: 'new' }, position: { x: 400, y: 400 } }] });
    const applied = applyCanvas(graph, presentation);
    expect(applied.document.nodes[0].data.secretBusinessData).toBe('new');
    expect(applied.document.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(applied.document.view).toEqual(doc.view);
    expect(applied.warnings).toEqual([]);
    expect(applyCanvas(createDocument(), presentation).warnings).toContain('Missing workflow node: step');
  });
  it('separates document revisions from plugin lifecycle and enforces command guards', () => {
    const runtime = new BoltRuntime();
    runtime.use(editingPlugin());
    expect(runtime.getDocumentRevision()).toBe(0);
    const remove = runtime.beforeCommand(() => 'Read only');
    expect(() => runtime.execute('editor.delete', [])).toThrow('Read only');
    remove(); runtime.updateDocument(doc => { doc.name = 'Edited'; });
    expect(runtime.getDocumentRevision()).toBe(1);
  });
});
