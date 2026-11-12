import type { BoltDocument, Json } from 'bolt-flow-core';
import drawingSource from './drawing.tsx?raw';
import nodeSource from './FlowCard.tsx?raw';
import nodeCss from './flow-card.css?raw';
import { appearanceOf, nodeStyle, edgeStyle } from './appearance';

export interface CodeSettings {
  theme: 'light' | 'dark'; grid: boolean; minimap: boolean; snap: boolean;
  tool: string; drawing: Record<string, Json>; viewport: { x: number; y: number; zoom: number };
  inspector: boolean; showDraw: boolean; rememberView: boolean;
}
export function playgroundFiles(document: BoltDocument, settings: CodeSettings, pluginIds: string[], mode = 'manual'): Record<string, string> {
  const enabled = (id: string) => pluginIds.includes(id);
  const packages: Record<string, string> = { react: '^19.2.0', 'react-dom': '^19.2.0', 'bolt-flow-core': '^0.1.0', 'bolt-flow-react': '^0.1.0', 'lucide-react': '^0.468.0' };
  const imports: string[] = [], install: string[] = [];
  for (const id of ['history', 'draw', 'layout', 'storage', 'export']) {
    if (!enabled(id)) continue;
    packages[`bolt-flow-plugin-${id}`] = '^0.1.0';
    if (id === 'storage') {
      imports.push("import { persistencePlugin, localStorageAdapter, type PersistenceController } from 'bolt-flow-plugin-storage';");
      install.push(`persistencePlugin({ adapter: localStorageAdapter(localStorage, 'bolt-flow:example:' + snapshot.id), mode: ${JSON.stringify(mode)}, restoreOnInstall: false })`);
    } else {
      imports.push(`import { ${id}Plugin } from 'bolt-flow-plugin-${id}';`);
      install.push(id === 'draw' ? `runtime.use(drawPlugin({ ...drawOptions, toFlowNode: node => ({ type: 'bolt', width: 190, height: 112, data: { label: String(node.data.label), description: 'Promoted from a canvas annotation.', kind: 'idea', tag: 'FROM SKETCH TO STEP', accent: 'purple' } }) }));` : `runtime.use(${id}Plugin());`);
    }
  }
  if (enabled('draw')) imports.push("import { drawOptions } from './drawing';", "import 'bolt-flow-plugin-draw/style.css';");
  const actions = ["{ id: 'add', label: 'Add task', run: () => runtime.updateDocument(doc => { doc.nodes.push({ id: crypto.randomUUID(), type: 'bolt', width: 190, height: 112, position: { x: 120, y: 180 }, data: { label: 'New task', kind: 'build' } }); }) }"];
  if (enabled('history')) actions.push("{ id: 'undo', label: 'Undo', command: 'history.undo', shortcut: 'Mod+Z' }", "{ id: 'redo', label: 'Redo', command: 'history.redo', shortcut: 'Mod+Shift+Z' }");
  if (enabled('layout')) actions.push("{ id: 'layout', label: 'Arrange', command: 'layout.arrange', payload: { direction: 'LR' } }");
  if (enabled('export')) actions.push("{ id: 'export', label: 'Download JSON', command: 'export.download' }");
  if (enabled('storage')) actions.push(`{ id: 'save', label: 'Save', shortcut: 'Mod+S', run: () => { runtime.updateDocument(doc => { ${settings.rememberView ? 'doc.view = flow.getViewport();' : 'delete doc.view;'} }, { source: 'view.save' }); return persistence.save(); } }`, "{ id: 'load', label: 'Open saved', run: () => persistence.load() }");
  const appearance = appearanceOf(document);
  const workspace = document.extensions.workspace as Record<string, Json> | undefined;
  const features = `import type { BoltPlugin } from 'bolt-flow-core';
${imports.join('\n')}
import snapshot from './canvas.json';

export const plugins: BoltPlugin[] = [
  ${install.map(line => line.replace(/^runtime\.use\((.*)\);$/s, '$1').replace(/;$/, '')).join(',\n  ')}
];
`;
  const app = `import { useRef, useState, type CSSProperties } from 'react';
import { BoltFlow, type BoltFlowRef, type ReactFlowInstance } from 'bolt-flow-react';
import { parseCanvas, type Json } from 'bolt-flow-core';
${enabled('storage') ? "import type { PersistenceController } from 'bolt-flow-plugin-storage';" : ''}
import { plugins } from './features';
import { nodeTypes } from './FlowCard';
import snapshot from './canvas.json';
import 'bolt-flow-react/style.css';
${enabled('draw') ? "import 'bolt-flow-plugin-draw/style.css';" : ''}
import './styles.css';

// Canvas data lives in canvas.json; the settings below follow the playground.
const initial = ${JSON.stringify(settings, null, 2)};
const document = parseCanvas(JSON.stringify(snapshot));

export default function App() {
  const editor = useRef<BoltFlowRef>(null);
  const flow = useRef<ReactFlowInstance>(null);
  const [tool, setTool] = useState<string>(initial.tool);
  const [drawingMode, setDrawingMode] = useState(initial.showDraw);
  const [options, setOptions] = useState<Record<string, Json>>(initial.drawing);
  const [message, setMessage] = useState('');
  ${enabled('storage') ? `const persistence = () => editor.current!.runtime.getContributions<PersistenceController>('storage.controller')[0];
  const save = () => {
    editor.current!.runtime.updateDocument(doc => { ${settings.rememberView ? 'doc.view = flow.current!.getViewport();' : 'delete doc.view;'} }, { source: 'view.save' });
    return persistence().save();
  };` : ''}
  return <div data-bolt-editor data-density=${JSON.stringify(String(workspace?.density ?? 'comfortable'))} data-theme={initial.theme}
    className={drawingMode ? 'example-app drawing-mode' : 'example-app'}
    style={{ '--bolt-accent': ${JSON.stringify(String(workspace?.accent ?? '#2563eb'))} } as CSSProperties}>
    <header className="example-heading"><strong>{document.name}</strong><div role="group" aria-label="Editing mode">
      <button aria-pressed={!drawingMode} onClick={() => { setDrawingMode(false); setTool('select'); }}>Flow</button>
      ${enabled('draw') ? '<button aria-pressed={drawingMode} onClick={() => { setDrawingMode(true); setTool(\'select\'); }}>Draw</button>' : ''}
    </div></header>
    <BoltFlow ref={editor} defaultDocument={document} plugins={plugins} nodeTypes={nodeTypes}
      onMessage={setMessage} tool={tool} onToolChange={setTool} toolOptions={options} onToolOptionsChange={next => {
        setOptions(next);
        editor.current!.runtime.updateDocument(doc => { doc.extensions.drawing = next; }, { source: 'drawing.settings' });
      }}
      theme=${JSON.stringify(settings.theme)} showGrid={initial.grid} showMinimap={initial.minimap}
      snapToGrid={initial.snap} snapGrid={[20, 20]} defaultViewport={initial.viewport} fitView={false}
      onInit={instance => { flow.current = instance; }}
      nodeDefaults={${JSON.stringify({ style: nodeStyle(appearance) }, null, 2)}}
      edgeDefaults={${JSON.stringify({ type: appearance.edgeType, style: edgeStyle(appearance), animated: appearance.edgeAnimated, markerEnd: appearance.edgeArrow ? { type: 'arrowclosed', color: appearance.edgeColor } : false }, null, 2)}}
      editor={{ panels: { inspector: initial.inspector ? undefined : false },
        style: { '--bolt-accent': ${JSON.stringify(String(workspace?.accent ?? '#2563eb'))}, '--bolt-space': ${JSON.stringify(workspace?.density === 'compact' ? '6px' : '8px')} } as CSSProperties,
        onError: error => setMessage(String(error)),
        actions: [${actions.map(action => action.replace(/run: \(\) => \{ runtime\.updateDocument[\s\S]*return persistence\.save\(\); \}/, 'run: save').replace('persistence.load()', 'persistence().load()').replace('runtime.updateDocument', 'editor.current!.runtime.updateDocument')).join(',\n          ')}] }} />
    {message && <p role="status">{message}</p>}
  </div>;
}
`;

  return {
    'App.tsx': app.replace(/\n{3,}/g, '\n\n'),
    'canvas.json': JSON.stringify(document, null, 2) + '\n',
    'FlowCard.tsx': nodeSource,
    'features.ts': features,
    ...(enabled('draw') ? { 'drawing.tsx': drawingSource } : {}),
    'styles.css': `/* The same card styles used by the playground. */\n${nodeCss}\n* { box-sizing: border-box; }\nbody { margin: 0; font: 14px system-ui, sans-serif; }\n.example-app { height: 100dvh; display: flex; flex-direction: column; background: #fafbfc; color: #182230; }\n.example-app[data-theme=dark] { background: #1b1e26; color: #e4e8f0; --paper: #1b1e26; --ink: #e4e8f0; --line: #374151; }\n.example-heading { display: flex; gap: 16px; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #dce3ec; }\n.example-heading button { padding: 6px 12px; cursor: pointer; }\n.example-heading button[aria-pressed=true] { color: var(--bolt-accent); }\n.example-app > .bolt-editor { flex: 1; min-height: 0; }\n.example-app:not(.drawing-mode) .bolt-editor-tools { display: none; }\n`,
    'main.tsx': "import { createRoot } from 'react-dom/client';\nimport App from './App';\ncreateRoot(document.getElementById('root')!).render(<App />);\n",
    'index.html': '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bolt Flow editor</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>\n',
    'package.json': JSON.stringify({ name: 'my-bolt-editor', version: '0.0.0', private: true, type: 'module', scripts: { dev: 'vite', build: 'tsc --noEmit && vite build' }, dependencies: packages, devDependencies: { vite: '^6.4.6', typescript: '^5.8.3', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' } }, null, 2) + '\n',
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, skipLibCheck: true, resolveJsonModule: true, esModuleInterop: true, noEmit: true, types: ['vite/client'] }, include: ['*.ts', '*.tsx', '*.json'] }, null, 2) + '\n',
    'README.md': '# Your current Bolt Flow editor\n\nSave all listed files in one folder. Run `npm install`, then `npm run dev`. Use `npm run build` to typecheck and build. The Bolt Flow packages are an unpublished alpha: if unavailable from your registry, build this repository with `npm run build:packages`, pack the required packages with `npm pack`, and install those local tarballs instead.\n\nApp.tsx uses BoltFlow with familiar canvas props and your current colors, tools and viewport. features.ts declares the optional plugins and saving policy. canvas.json includes all nodes, edges, annotations, rich text, colors, attachments, layers and extension settings. Custom card renderers, drawing shapes/fonts and CSS are included as separate files. This integration opts into the package’s editor shell; the surrounding playground navigation and documentation site are host application UI.\n\nCode is generated one way from playground state. Editing your downloaded files does not update the playground. JSON changes can be applied with JSON studio. Storage uses an example-specific key and does not overwrite the playground’s saved canvas. Plugin unloads retain canvas data; reinstall the required renderer plugins to edit those annotations.\n',
  };
}
