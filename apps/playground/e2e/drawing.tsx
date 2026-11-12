import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BoltRuntime, createDocument } from 'bolt-flow-core';
import { BoltCanvas, BoltProvider } from 'bolt-flow-react';
import { drawPlugin } from 'bolt-flow-plugin-draw';
import { historyPlugin } from 'bolt-flow-plugin-history';
import 'bolt-flow-react/style.css';
import 'bolt-flow-plugin-draw/style.css';
const runtime = new BoltRuntime(createDocument()).use(drawPlugin()).use(historyPlugin());
function Fixture() {
  const [tool, setTool] = useState('draw.pen');
  const [moves, setMoves] = useState(0);
  const [json, setJson] = useState('');
  return <div onPointerMoveCapture={e => { if (e.buttons === 1) setMoves(n => n + 1); }}>
    <button onClick={() => setTool('draw.pen')}>Pen</button>
    <button onClick={() => setTool('draw.rectangle')}>Rectangle</button>
    <button onClick={() => setTool('select')}>Select</button>
    <button onClick={() => runtime.execute('history.undo')}>Undo</button>
    <button onClick={() => runtime.execute('history.redo')}>Redo</button>
    <button onClick={() => setJson(JSON.stringify(runtime.getDocument()))}>Inspect JSON</button>
    <output aria-label="Host renders">{moves}</output>
    <pre aria-label="Document JSON">{json}</pre>
    <div style={{ height: 500 }}><BoltCanvas fitView={false} defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      interaction={{ tool, options: { keepTool: true }, onToolChange: next => setTool(next) }} /></div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<BoltProvider runtime={runtime}><Fixture /></BoltProvider>);
