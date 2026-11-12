import demoSource from './demo.tsx?raw';
import demoCss from './demo.css?raw';

import type { GuideSnippet } from './guide-snippets';
export { guideSnippets } from './guide-snippets';
export interface RunnableExample { code: string; css: string; note: string; support?: Record<string, string> }
// The excerpt remains unchanged in the guide. These adapters add the explicit
// host context needed to run partial examples, and expose that complete source.
export function runnableExample(slug: string, index: number, snippets: GuideSnippet[]): RunnableExample {
  const snippet = snippets[index], key = `${slug}:${index}`;
  if (slug === 'react-flow') return { code: snippet.code, css: '', note: 'Complete example, running exactly as shown. No hidden application setup.' };
  const imports = `import * as Sandbox from './demo';\nimport * as Core from 'bolt-flow-core';\nimport * as Bolt from 'bolt-flow-react';\nimport * as Draw from 'bolt-flow-plugin-draw';\nimport * as Storage from 'bolt-flow-plugin-storage';\n`;
  let setup = `const runtime = Sandbox.createDemo();\n`, body = snippet.code, after = '', component = '', children = '', canvas = '', options = '', css = '';
  let note = 'Runs this excerpt with sample data and a provider. Open Code to edit the complete runnable example; open live JSON to inspect the result. The demo.tsx and demo.css files contain the complete shared setup and can be copied with this example.';
  const get = (n: number) => snippets[n].code;
  const drawing = () => { setup += `runtime.use(Draw.drawPlugin());\n`; };
  const memory = () => { setup += `const persistence = Storage.createPersistenceController(runtime, { mode: 'manual', adapter: Storage.localStorageAdapter(Sandbox.memoryStorage, 'example') });\n`; };
  if (snippet.language === 'sh' || snippet.language === 'nginx') {
    body = ''; drawing();
    note = 'These commands/configuration run on your machine or server. This sandbox shows the resulting editor using the bundled local packages; it does not execute shell commands or configure a server.';
  } else if (slug === 'quickstart' && index === 3) {
    return { code: snippet.code, css: '', note: 'The complete quickstart, running unchanged. Edit the source and press Run to rebuild it.' };
  } else if (slug === 'quickstart' || slug === 'persistence') {
    drawing();
    note = 'Storage is an isolated in-memory demo, cleared on Reset or Run. No playground data or real backend is accessed. Full runnable source shows the adapter.';
    if (key === 'quickstart:4' || key === 'persistence:0' || key === 'persistence:5') {
      body = body.replace(/window\.localStorage|\blocalStorage(?=,)/g, 'Sandbox.memoryStorage');
      if (key === 'quickstart:4') body = body.replace('persistence.dispose();', '// Dispose when this example session ends.');
      if (key === 'persistence:5') children = `<button onClick={() => runtime.execute('storage.save')}>Save again</button><button onClick={() => console.log(runtime.execute('storage.status'))}>Inspect save status</button>`;
      else children = `<SaveControls persistence={persistence} />`, setup += snippets.find(s => s.code.includes('export function SaveControls'))?.code ?? `function SaveControls({ persistence }) { const state = React.useSyncExternalStore(persistence.subscribe, persistence.getSnapshot); return <><button onClick={() => persistence.save()}>Save</button><span>{state.dirty ? 'Unsaved changes' : 'Saved'}</span></>; }\n`;
    } else if (index === 1) { memory(); children = '<SaveControls persistence={persistence} />'; }
    else if (index === 2) { memory(); body = body.replace("window.confirm('Replace unsaved changes with the saved canvas?')", 'true /* explicit demo Open button; isolated sample data */'); children = `<button onClick={() => persistence.save()}>Save sample</button><button onClick={openSaved}>Open saved sample</button>`; }
    else if (index === 3) { memory(); children = `<button onClick={() => { persistence.setMode('autosave'); console.log('Autosave on'); }}>Enable autosave</button><button onClick={() => { persistence.setMode('manual'); console.log('Manual save'); }}>Use manual save</button>`; }
    else if (index === 4) {
      setup += `// Mock HTTP transport. No request leaves this iframe.\nlet stored = null; let revision = 0;\nasync function fetch(_url, init = {}) {\n  if (init.method === 'PUT') {\n    const match = init.headers['If-Match'];\n    if ((match && match !== String(revision)) || (!match && stored)) return new Response(null, { status: 412 });\n    stored = JSON.parse(init.body); revision++;\n  }\n  return stored ? new Response(JSON.stringify(stored), { headers: { ETag: String(revision) } }) : new Response(null, { status: 404 });\n}\n`;
      after = `const persistence = Storage.createPersistenceController(runtime, { adapter: httpAdapter });\n`;
      children = `<button onClick={async () => { await persistence.save(); console.log(persistence.getSnapshot()); }}>Save to mock server</button><button onClick={() => { revision++; console.log('Simulated another client save; your next save will conflict.'); }}>Simulate competing save</button>`;
      note = 'The HTTP adapter runs against an explicit mock transport with ETag conflict checks. It never calls a real server. Edit Code to inspect both adapter and mock.';
    }
  } else if (slug === 'react-editor') {
    drawing();
    if (index === 0) component = '<Editor />';
    if (index === 1) component = '<CustomWorkspace />';
    if (index === 2) component = '<Bolt.BoltEditor panels={{ inspector: TaskProperties }} />';
    if (index === 3) { setup += `function validateWorkflow(doc) { console.log({ valid: doc.nodes.length > 0, nodes: doc.nodes.length }); }\n`; component = '<Bolt.BoltEditor />'; }
    if (index === 4) { setup += `const saveDraft = () => console.log(Core.serializeCanvas(runtime.getDocument()));\nconst showError = console.error;\n`; component = '<Bolt.BoltEditor panels={{ toolbar: MyToolbar }} />'; }
  } else if (slug === 'nodes-edges') {
    setup = `const runtime = Sandbox.createDemo(['task-42', 'task-43']);\n`;
    if (index !== 0) setup += get(0) + '\n';
    if (index !== 1) setup += `runtime.updateDocument(doc => { doc.nodes.forEach(n => { n.type = 'acme-task'; }); doc.edges = []; });\n`;
    canvas = '{ nodeTypes }';
    if (index === 0) after = `runtime.updateDocument(doc => { doc.nodes.forEach(n => { n.type = 'acme-task'; }); doc.edges = []; });\n`;
    if (index === 1) setup += `runtime.updateDocument(doc => { doc.nodes = doc.nodes.filter(n => n.id !== 'task-42'); doc.edges = []; });\n`;
    if (index === 2) { css = body; body = ''; }
    if (index === 3) { setup += `const data = { label: 'Review proposal' };\nconst openTaskDetails = label => console.log('Task details:', label);\n`; children = body; body = ''; }
    if (index === 5) { component = body; body = ''; }
    if (index === 6) after = `runtime.updateDocument(doc => { doc.edges.push(edge); });\n`;
    if (index === 7) { setup = `const runtime = Sandbox.createDemo();\nruntime.updateDocument(doc => { doc.edges.forEach(e => { e.type = 'approval'; }); });\n`; canvas = ''; component = '<Canvas />'; }
  } else if (slug === 'document-model') {
    if (index === 0) { setup = `const runtime = new Core.BoltRuntime(Core.parseCanvas(${JSON.stringify(body)})).use(Core.editingPlugin());\n`; body = ''; }
    if (index === 1) setup = '';
    if (index === 2) body = body.replace('stop();', "runtime.updateDocument(doc => { doc.name = 'A watched edit'; });\nstop();");
    if (index === 3) { setup = `const runtime = Sandbox.createDemo(['owner-id']);\n`; drawing(); after = `const annotation = runtime.execute('draw.create', { shape: 'text', points: [[100, 280, .5]], settings: { text: 'Attached note' } });\nruntime.updateDocument(doc => { doc.nodes.find(n => n.id === annotation.id).anchor = ${body}; });\n`; body = ''; options = '{ showAttachments: true }'; }
    if (index === 4) { setup += `const jsonFromYourStorage = Core.serializeCanvas(runtime.getDocument());\n`; after = 'console.log(portable);\n'; }
  } else if (slug === 'drawing') {
    if (![0, 4, 5, 7].includes(index)) drawing();
    if (index === 2) { after = `const text = runtime.execute('draw.create', { shape: 'text', points: [[100, 250, .5]], settings: { text: 'Review before launch' } });\nruntime.updateDocument(doc => { doc.nodes.find(n => n.id === text.id).data.richText = ${body}; });\n`; body = ''; }
    if (index === 3) { setup += `const commentId = runtime.execute('draw.create', { shape: 'comment', points: [[160, 240, .5]], settings: { text: 'Review this workflow' } }).id;\n`; children = `<button onClick={() => { runtime.execute('draw.resolve', commentId); }}>Resolve / reopen</button>`; }
    if (index === 4) after = `runtime.execute('draw.create', { shape: 'triangle', points: [[80, 220, .5], [220, 340, .5]], settings: { fill: '#dbeafe' } });\n`;
    if (index === 6) { setup += `const annotationId = runtime.execute('draw.create', { shape: 'text', points: [[100, 280, .5]], settings: { text: 'Follow my owner' } }).id;\nconst workflowNodeId = 'task-a';\n`; children = `<button onClick={() => runtime.execute('draw.attach', { id: annotationId, ownerId: workflowNodeId })}>Attach note</button><button onClick={() => runtime.execute('draw.detach', annotationId)}>Detach note</button>`; options = '{ showAttachments: true }'; }
    if (index === 7) { setup += `const drawPlugin = Draw.drawPlugin;\n`; after = `runtime.use(drawing);\nconst annotationId = runtime.execute('draw.create', { shape: 'rectangle', points: [[100, 260, .5], [280, 340, .5]] }).id;\nconst nodeTypes = { 'acme-task': ({ data }) => <article className="task-card">{data.label} · {data.status}</article> };\n`; canvas = '{ nodeTypes }'; children = `<button onClick={() => runtime.execute('draw.convert', annotationId)}>Promote to workflow task</button>`; }
  } else if (slug === 'styling') {
    if (index !== 5) drawing();
    if (snippet.language === 'css') { css = body; body = ''; }
    if (index === 0) component = '<Bolt.BoltEditor className="my-editor" />';
    if (index === 1) { setup += `const BoltCanvas = Bolt.BoltCanvas;\n`; component = body; body = ''; }
    if (index === 2) setup += `const selectedId = 'task-a';\n`;
    if (index === 3) {
      body = `function CustomizedEditor() {\nconst [tool, setTool] = React.useState('select');\nconst [options, setOptions] = React.useState({});\n${body}\nreturn <Bolt.BoltEditor interaction={{ ...interaction, tool, options: { ...interaction.options, ...options } }} />;\n}\n`;
      component = '<CustomizedEditor />';
    }
    if (index === 4) { after = `runtime.execute('draw.create', { shape: 'text', points: [[100, 250, .5]], settings: { text: 'Theme-following ink', color: 'auto' } });\n`; children = `<button onClick={e => { const root = e.currentTarget.closest('.my-editor'); root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.style.background = root.dataset.theme === 'dark' ? '#182230' : '#fff'; }}>Toggle theme</button>`; }
    if (index === 5) setup += 'const drawPlugin = Draw.drawPlugin;\n';
    if (index === 6) { css = css.replace("url('/fonts/acme-sans.woff2') format('woff2')", "local('Georgia')"); after = `runtime.execute('draw.create', { shape: 'text', points: [[100, 250, .5]], settings: { text: 'Your custom font', fontFamily: '"Acme Sans", Georgia, serif' } });\n`; note = 'The guide uses your own font URL. This runnable version uses local Georgia with a serif fallback; replace the font source in your application.'; }
    if (index === 7) after = `console.log(runtime.getDocument().extensions['acme.editor-preset']);\n`;
  } else if (slug === 'commands-plugins') {
    if (index === 0) { after = `runtime.use(projectPlugin());\n`; children = `<button onClick={() => runtime.execute('acme.project.rename', 'Release plan')}>Rename project</button>`; }
    if (index === 1) { setup += `function subscribeToYourService(callback) { const timer = setInterval(() => { callback({ type: 'tick' }); console.log('Mock service tick'); }, 1000); return () => { clearInterval(timer); console.log('Subscription cleaned up'); }; }\n`; body = `runtime.use({ id: 'mock-service', name: 'Mock service', version: '1', ${body} });\n`; children = `<button onClick={() => runtime.remove('mock-service')}>Remove plugin and clean up</button>`; note = 'A local timer replaces the host service. Remove the plugin to see its cleanup; no network service is contacted.'; }
    if (index === 3) children = `<button onClick={() => console.log(runtime.execute('acme.validate.run'))}>Validate workflow</button>`;
    if (index === 4) { setup += get(0) + `\nruntime.use(projectPlugin());\nlet canRenameProject = false;\n`; children = `<button onClick={() => { try { runtime.execute('acme.project.rename', 'Renamed'); } catch (error) { console.log(error.message); } }}>Try guarded rename</button><button onClick={() => { canRenameProject = true; console.log('Rename enabled'); }}>Allow rename</button>`; }
  } else if (slug === 'workflow-json') {
    drawing();
    setup += `const generatedJson = Core.serializeCanvas(Core.createDocument({ id: 'generated', nodes: [{ id: 'generated-task', position: { x: 200, y: 250 }, data: { label: 'Generated proposal' } }] }));\n`;
    if (index === 0) children = `<button onClick={() => acceptGeneratedCanvas(generatedJson)}>Accept generated canvas</button>`;
    if (index === 1) setup += `const setSelectedIds = ids => console.log('Inserted IDs:', ids);\n`;
    if (index === 2) setup += `const serializeExecutableWorkflow = () => ({ steps: runtime.getDocument().nodes.map(n => ({ id: n.id, task: n.data.label })) });\nconst saveToYourBackend = async payload => console.log('Mock backend received:', payload);\n`;
    if (index === 3) setup += `const saved = { workflow: runtime.getDocument(), canvas: Core.captureCanvas(runtime.getDocument()) };\nconst convertWorkflowToBoltDocument = workflow => { const graph = structuredClone(workflow); graph.nodes[0].data.label = 'Updated executable task'; return graph; };\nconst showReconciliationWarnings = console.log;\n`;
    if (index === 4) setup += `const graph = runtime.getDocument();\nconst referenceCanvas = { version: 1, annotations: [{ id: 'reference-note', type: 'text', position: { x: 100, y: 250 }, width: 220, height: 80, data: { text: 'Imported note' } }] };\n`;
    if (index === 5) { setup += `const BoltCanvas = Bolt.BoltCanvas;\nconst document = { ...runtime.getDocument(), view: { x: 20, y: 20, zoom: .8 } };\n`; component = body; body = ''; }
    if (index === 6) { setup += `const restored = { document: { ...runtime.getDocument(), view: { x: 20, y: 20, zoom: .8 } } };\n`; body = `function RestoreView() { const flow = Bolt.useReactFlow(); return <button onClick={async () => { ${body} }}>Restore saved view</button>; }\n`; children = '<RestoreView />'; }
    if ([2, 3, 4].includes(index)) note = 'Uses explicit sample workflow data and local host callbacks. The runnable source shows the host adapter; no real backend is called.';
  } else if (slug === 'recipes') {
    drawing();
    if (index === 0) component = '<Review runtime={runtime} />';
    if (index === 1) { memory(); component = '<EditorWithSave persistence={persistence} />'; note = 'Save writes only to this sandbox’s in-memory adapter. Reset clears the sample.'; }
    if (index === 2) { setup += `// Explicit mock response for the host-owned generation endpoint.\nasync function fetch() { return new Response(Core.serializeCanvas(Core.createDocument({ nodes: [{ id: 'proposal', position: { x: 150, y: 250 }, data: { label: 'Generated proposal' } }] }))); }\n`; children = `<button onClick={async () => { const candidate = await previewGenerated('An approval step'); console.log('Preview:', candidate); }}>Preview generated data</button><button onClick={async () => acceptInsert(await previewGenerated('An approval step'))}>Accept insertion</button>`; note = 'Generation uses a mock JSON response, shown in Code. Preview and acceptance stay separate; no AI or network service is called.'; }
    if (index === 3) { setup = setup.replace('runtime.use(Draw.drawPlugin());', "runtime.use(Draw.drawPlugin({ tools: ['text', 'comment', 'arrow'] }));"); component = '<AnnotationWorkspace />'; }
    if (index === 4) children = '<ArrangeButton />';
    if (index === 5) { setup += `const { BoltProvider, BoltEditor } = Bolt;\nconst leftRuntime = Sandbox.createDemo(['left']); const rightRuntime = Sandbox.createDemo(['right']);\n`; component = body; body = ''; }
  } else if (slug === 'export') {
    drawing();
    if (index === 0) after = 'console.log(json);\n';
    if (index === 1) { const [importLine, ...rest] = body.split('\n'); body = `${importLine}\nasync function exportExample() { ${rest.join('\n')} }\n`; children = '<button onClick={exportExample}>Download JSON</button>'; }
    if (index === 2) children = '<ImportButton />';
    if (index >= 3) {
      // Imports stay at module scope; capture DOM only after the canvas mounts.
      const lines = body.split('\n'), importLine = lines.shift();
      body = `${importLine}\nasync function captureExample() {\nconst canvasElement = window.document.querySelector('.bolt-canvas');\nconst canvasRef = { current: canvasElement };\n${lines.join('\n')}\n${index === 4 ? "const image = window.document.createElement('img'); image.src = URL.createObjectURL(blob); image.alt = 'Captured canvas'; image.style.maxWidth = '100%'; window.document.body.appendChild(image);" : ''}\n}\n`;
      children = `<button onClick={() => captureExample().catch(console.error)}>${index === 4 ? 'Preview PNG' : 'Download PNG'}</button>`;
    }
  }
  const view = slug === 'recipes' && [0, 5].includes(index) ? component : `<Sandbox.Demo runtime={runtime}${component ? ` component={${component}}` : ''}${canvas ? ` canvas={${canvas}}` : ''}${options ? ` options={${options}}` : ''}>${children}</Sandbox.Demo>`;
  const used = setup + body + after + view;
  const neededImports = imports.split('\n').filter(line => !line || new RegExp('\\b' + (line.match(/as (\w+)/)?.[1] ?? '') + '\\b').test(used)).join('\n');
  const code = `import * as React from 'react';\nimport './Styles.css';\n${neededImports}\n// Sample host setup (editable).\n${setup}\n// Documentation excerpt.\n${body}\n${after}\n// Mount the example.\nexport default function Example() { return (${view}); }\n`;
  return { code, css, note, support: { 'demo.tsx': demoSource, 'demo.css': demoCss } };
}
