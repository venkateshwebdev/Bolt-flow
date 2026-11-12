import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BoltRuntime, createDocument, editingPlugin } from 'bolt-flow-core';
import { BoltFlow, Panel, type BoltFlowRef, BoltProvider, BoltCanvas, BoltTools, BoltEditor, editorUIPlugin } from 'bolt-flow-react';
import { drawPlugin, type DrawCreateInput, type DrawResult } from 'bolt-flow-plugin-draw';
import 'bolt-flow-react/style.css';
import 'bolt-flow-plugin-draw/style.css';

// No source aliases: this fixture consumes only built workspace exports and public CSS.
const runtime = new BoltRuntime().use(drawPlugin({ shapes: [{ id: 'triangle', label: 'Triangle', path: ({ width, height }) => `M${width / 2},8 L${width - 8},${height - 8} L8,${height - 8} Z` }] }));
const result = runtime.execute<DrawCreateInput, DrawResult>('draw.create', { shape: 'triangle', points: [[0, 0, .5], [160, 100, .5]] });
runtime.updateDocument((doc) => { const node = doc.nodes.find((item) => item.id === result.id)!; node.width = 300; node.height = 180; });
runtime.execute('draw.create', { shape: 'text', points: [[0, 160, .5]], settings: { text: 'Built handwritten font' } });
// Fallback geometry must render even after the host stops supplying the custom definition.
runtime.remove('draw'); runtime.use(drawPlugin());
const custom = new BoltRuntime(createDocument({ name: 'Custom editor', nodes: [{ id: 'custom-node', position: { x: 0, y: 0 }, data: { label: 'Custom editor node' } }] })).use(editingPlugin()).use(editorUIPlugin({ id: 'consumer-ui', actions: [{ id: 'consumer.rename', label: 'Custom action', shortcut: 'Mod+J', run: () => custom.updateDocument(doc => { doc.nodes[0].data.label = 'Host action ran'; }) }], slots: { 'editor.status': [{ id: 'host-status', component: () => <span>Host status panel</span> }] } }));
const simplePlugins = [drawPlugin()];
function SimpleApp() {
  const ref = useRef<BoltFlowRef>(null);
  const [saved, setSaved] = useState('');
  return <section className="simple-consumer" style={{ height: 500 }}>
    <BoltFlow ref={ref} plugins={simplePlugins} defaultTool="draw.pen" toolOptions={{ keepTool: true }} toolbar={false}
      defaultNodes={[{ id: 'simple', position: { x: 40, y: 40 }, data: { label: 'Simple public API' } }]} fitView={false}>
      <Panel position="top-right"><button onClick={() => setSaved(ref.current!.toJSON())}>Read simple JSON</button></Panel>
    </BoltFlow>
    <output aria-label="Simple JSON">{saved}</output>
  </section>;
}
function App() {
  const [tool, onToolChange] = useState('select');
  const interaction = { tool, options: {}, onToolChange };
  return <><BoltProvider runtime={runtime}><BoltTools {...interaction} /><div style={{ width: 900, height: 600 }}><BoltCanvas interaction={interaction} /></div></BoltProvider><div style={{ height: 500 }}><BoltProvider runtime={custom}><BoltEditor panels={{ inspector: false }} /></BoltProvider></div><SimpleApp /></>;
}
createRoot(document.getElementById('root')!).render(<App />);