import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BoltRuntime } from 'bolt-flow-core';
import { BoltProvider, BoltCanvas, BoltTools } from 'bolt-flow-react';
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
function App() {
  const [tool, onToolChange] = useState('select');
  const interaction = { tool, options: {}, onToolChange };
  return <BoltProvider runtime={runtime}><BoltTools {...interaction} /><div style={{ width: 900, height: 600 }}><BoltCanvas interaction={interaction} /></div></BoltProvider>;
}
createRoot(document.getElementById('root')!).render(<App />);