// Shared sample data and UI for the advanced documentation examples.
import * as React from 'react';
import * as Core from 'bolt-flow-core';
import * as Bolt from 'bolt-flow-react';
import * as History from 'bolt-flow-plugin-history';
import * as XYFlow from '@xyflow/react';
import 'bolt-flow-react/style.css';
import 'bolt-flow-plugin-draw/style.css';
import './demo.css';

const memory = new Map<string, string>();
export const memoryStorage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
export function createDemo(ids = ['task-a', 'task-b']) {
  return new Core.BoltRuntime(Core.createDocument({ id: 'example', name: 'Example canvas',
    nodes: ids.map((id, i) => ({ id, position: { x: 60 + i * 240, y: 100 }, sourcePosition: XYFlow.Position.Right, targetPosition: XYFlow.Position.Left,
      data: { label: i ? 'Approve request' : 'Review request', owner: 'Design team', status: 'Ready', retries: 2, enabled: true } })),
    edges: ids.length > 1 ? [{ id: 'route', source: ids[0], target: ids[1] }] : [],
  })).use(Core.editingPlugin()).use(History.historyPlugin());
}
export function DocumentView() {
  const { document } = Bolt.useBoltSnapshot();
  return <details className="example-json"><summary>Live document JSON · {document.nodes.length} nodes</summary><pre>{JSON.stringify(document, null, 2)}</pre></details>;
}
function DemoContent({ runtime, children, canvas, component, options: initialOptions = {} }: DemoProps) {
  const [tool, setTool] = React.useState('select'), [options, setOptions] = React.useState<Record<string, Core.Json>>(initialOptions);
  const [error, setError] = React.useState('');
  const snapshot = Bolt.useBoltSnapshot();
  const interaction = { tool, options, onToolChange: setTool, onOptionsChange: setOptions, onMessage: setError };
  return <div data-bolt-editor className="example-demo my-editor" tabIndex={-1}>
    <div className="example-actions"><strong>{snapshot.document.name}</strong>
      <button onClick={() => runtime.updateDocument(doc => { doc.nodes.push({ id: crypto.randomUUID(), position: { x: 120, y: 270 }, data: { label: 'New task' } }); })}>Add task</button>
      <button disabled={!runtime.hasCommand('history.undo')} onClick={() => runtime.execute('history.undo')}>Undo</button>
      <button disabled={!runtime.hasCommand('history.redo')} onClick={() => runtime.execute('history.redo')}>Redo</button>
    </div>
    {children}
    {error && <p role="status">{error}</p>}
    {component ?? <><Bolt.BoltTools {...interaction} /><div className="example-canvas"><Bolt.BoltCanvas {...canvas} interaction={interaction} fitViewOptions={{ padding: .3, maxZoom: 1 }} /></div></>}
    <DocumentView />
  </div>;
}
interface DemoProps { runtime: Core.BoltRuntime; children?: React.ReactNode; component?: React.ReactNode; canvas?: Bolt.BoltCanvasProps; options?: Record<string, Core.Json> }
export function Demo(props: DemoProps) { return <Bolt.BoltProvider runtime={props.runtime}><DemoContent {...props} /></Bolt.BoltProvider>; }
