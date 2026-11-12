import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BoltFlow, useNodesState, useEdgesState, addEdge, type BoltFlowRef, type Node, type Edge } from 'bolt-flow-react';
import type { BoltPlugin } from 'bolt-flow-core';
import { drawPlugin } from 'bolt-flow-plugin-draw';
import { historyPlugin } from 'bolt-flow-plugin-history';
import 'bolt-flow-react/style.css';
import 'bolt-flow-plugin-draw/style.css';

let active = 0;
const probe: BoltPlugin = { id: 'probe', name: 'Lifecycle probe', version: '1', setup() {
  active++; return () => { active--; };
} };
const plugins = [historyPlugin(), drawPlugin(), probe];
const initial: Node[] = [{ id: 'a', position: { x: 60, y: 60 }, data: { label: 'Start', selected: 'user data must survive' } },
  { id: 'b', position: { x: 350, y: 60 }, data: { label: 'Finish' } }];
function Fixture() {
  const controlled = !location.search.includes('uncontrolled');
  const flow = useRef<BoltFlowRef>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [tool, setTool] = useState('select'), [moves, setMoves] = useState(0);
  const [json, setJson] = useState(''), [saved, setSaved] = useState(''), [mounted, setMounted] = useState(true);
  const [lifecycle, setLifecycle] = useState('');
  return <div onPointerMoveCapture={event => { if (event.buttons === 1) setMoves(n => n + 1); }}>
    <button onClick={() => setTool('draw.pen')}>Pen</button>
    <button onClick={() => setTool('select')}>Select</button>
    <button onClick={() => {
      const result = flow.current!.runtime.execute<unknown, { id: string }>('draw.create', { shape: 'text', points: [[200, 280, .5]], settings: { text: 'Attached note' } });
      flow.current!.runtime.execute('draw.attach', { id: result.id, ownerId: 'a' });
    }}>Attach note</button>
    <button onClick={() => flow.current?.runtime.execute('history.undo')}>Undo</button>
    <button onClick={() => flow.current?.runtime.execute('history.redo')}>Redo</button>
    <button onClick={() => setJson(flow.current!.toJSON())}>Inspect</button>
    <button onClick={() => setSaved(flow.current!.toJSON())}>Save</button>
    <button onClick={() => flow.current!.loadJSON(saved)}>Load</button>
    <button onClick={() => setNodes(current => current.map(node => node.id === 'a' ? { ...node, data: { ...node.data, label: 'Renamed' } } : node))}>Rename</button>
    <button onClick={() => { setNodes(current => current.filter(node => node.id !== 'b')); setEdges([]); }}>Remove finish</button>
    <button onClick={() => setMounted(!mounted)}>Toggle mount</button>
    <button onClick={() => setLifecycle(String(active))}>Check lifecycle</button>
    <output aria-label="Lifecycle">{lifecycle}</output><output aria-label="Renders">{moves}</output>
    <div style={{ height: 500 }}>{mounted && <BoltFlow ref={flow} plugins={plugins}
      {...(controlled ? { nodes, edges, onNodesChange, onEdgesChange, onConnect: connection => setEdges(current => addEdge(connection, current)) } : { defaultNodes: initial })}
      tool={tool} onToolChange={setTool} toolOptions={{ keepTool: true }} toolbar={false}
      fitView={false} defaultViewport={{ x: 0, y: 0, zoom: 1 }} />}</div>
    <pre aria-label="Document JSON">{json}</pre>
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
