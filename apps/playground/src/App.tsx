import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createDocument, type BoltPlugin, type Json } from 'bolt-flow-core';
import { BoltCanvas, BoltTools, BoltLayers, useBolt, useBoltSnapshot, useReactFlow, type CanvasToolProps } from 'bolt-flow-react';
import { ArrowRight, ArrowUpRight, BookOpen, Box, Check, ChevronRight, CircleHelp, Code2, Command, Download, Focus, FolderOpen, GitBranch, Grid2X2, Hand, History, Layers, Lightbulb, Link2, MessageCircle, Minus, Moon, MousePointer2, Palette, PanelRight, Pencil, Plus, Puzzle, Redo2, Rocket, Search, Shapes, SlidersHorizontal, Sparkles, Sun, Undo2, Upload, Workflow, X, Zap, type LucideIcon } from 'lucide-react';
import { architectureTemplate, launchTemplate } from './templates';
import { DocumentStudio } from './DocumentStudio';
import { PersistenceBar } from './PersistenceBar';
import { WorkspaceSettings } from './WorkspaceSettings';
import { Inspector } from './Inspector';
import { nodeTypes } from './FlowCard';
import { PlaygroundCode } from './PlaygroundCode';
import { SiteHeader, IconButton, Modal, DocumentationLink } from './ui';
import { appearanceOf, nodeStyle, edgeStyle } from './appearance';

type PluginId = 'draw' | 'history' | 'layout' | 'storage' | 'export';
const catalog: { id: PluginId; name: string; description: string; icon: LucideIcon; color: string; loader: () => Promise<BoltPlugin> }[] = [
  { id: 'draw', name: 'Connected ink', description: 'Draw, comment, attach context, and turn ink into real workflow connections. One canvas.', icon: Pencil, color: 'pink', loader: async () => {
    const [{ drawPlugin }, { drawOptions }] = await Promise.all([import('bolt-flow-plugin-draw'), import('./drawing')]);
    return drawPlugin({ ...drawOptions, toFlowNode: (node) => ({ type: 'bolt', width: 190, height: 112, data: { label: String(node.data.label), description: 'Promoted from a canvas annotation.', kind: 'idea', tag: 'FROM SKETCH TO STEP', accent: 'purple' } }) });
  } },
  { id: 'layout', name: 'Smart layout', description: 'Arrange workflow steps automatically. Attached sketches and comments follow their owners.', icon: Workflow, color: 'blue', loader: async () => (await import('bolt-flow-plugin-layout')).layoutPlugin() },
  { id: 'history', name: 'Time machine', description: 'One undo history for workflow edits, ink, comments, styles, and layout.', icon: History, color: 'purple', loader: async () => (await import('bolt-flow-plugin-history')).historyPlugin() },
  { id: 'storage', name: 'Canvas persistence', description: 'Save on demand, open saved JSON, or explicitly enable autosave in this browser.', icon: FolderOpen, color: 'green', loader: async () => { const { persistencePlugin, localStorageAdapter } = await import('bolt-flow-plugin-storage'); const auto = localStorage.getItem('bolt-flow:autosave') === 'true'; return persistencePlugin({ adapter: localStorageAdapter(localStorage, 'bolt-flow:playground:v1'), mode: auto ? 'autosave' : 'manual', restoreOnInstall: auto }); } },
  { id: 'export', name: 'Portable canvas', description: 'Import and export your graph, drawings, discussions, and styles together as JSON.', icon: Download, color: 'orange', loader: async () => (await import('bolt-flow-plugin-export')).exportPlugin() },
];
const preferencesKey = 'bolt-flow:playground:plugins';
function remember(ids: string[]) { try { localStorage.setItem(preferencesKey, JSON.stringify(ids)); } catch { /* Noncritical preferences only. */ } }
export default function App() {
  useEffect(() => { document.title = 'Playground · Bolt Flow'; }, []);
  const runtime = useBolt();
  const { document: canvas, plugins } = useBoltSnapshot();
  const flow = useReactFlow();
  const [showDraw, setShowDraw] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [rememberView, setRememberView] = useState(false);
  const [tool, setTool] = useState('select');
  const [drawOptions, setDrawOptions] = useState<Record<string, Json>>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [grid, setGrid] = useState(true), [minimap, setMinimap] = useState(false), [snap, setSnap] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const zoom = viewport.zoom;
  const [selection, setSelection] = useState<{ nodes: string[]; edges: string[] }>({ nodes: [], edges: [] });
  const [inspector, setInspector] = useState(() => window.innerWidth >= 1280);
  const [dialog, setDialog] = useState<'plugins' | 'commands' | 'templates' | 'help' | 'customize' | 'json' | 'layers' | 'review' | null>(null);
  const [query, setQuery] = useState(''), [pending, setPending] = useState<string[]>([]), [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'canvas' | 'layers' | 'review'>('canvas');
  const appRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nodeId = selection.nodes[0] ?? null, edgeId = selection.edges[0] ?? null;
  const selected = canvas.nodes.find((node) => node.id === nodeId);
  const annotations = canvas.nodes.filter((node) => node.role === 'annotation');
  const comments = annotations.filter((node) => node.type === 'bolt-comment');
  const workspaceSettings = canvas.extensions.workspace && typeof canvas.extensions.workspace === 'object' && !Array.isArray(canvas.extensions.workspace) ? canvas.extensions.workspace : {};
  useEffect(() => {
    if (workspaceSettings.theme === 'light' || workspaceSettings.theme === 'dark') setTheme(workspaceSettings.theme);
    if (typeof workspaceSettings.grid === 'boolean') setGrid(workspaceSettings.grid);
    if (typeof workspaceSettings.snap === 'boolean') setSnap(workspaceSettings.snap);
    if (typeof workspaceSettings.minimap === 'boolean') setMinimap(workspaceSettings.minimap);
  }, [canvas.extensions.workspace]);
  useEffect(() => {
    const saved = canvas.extensions.drawing;
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) setDrawOptions(saved);
  }, [canvas.extensions.drawing]);
  const saveDrawOptions = useCallback((options: Record<string, Json>) => {
    setDrawOptions(options);
    runtime.updateDocument(doc => { doc.extensions.drawing = options; }, { source: 'drawing.settings', group: 'drawing.settings' });
  }, [runtime]);
  const appearance = useMemo(() => appearanceOf(canvas), [canvas.extensions.appearance]);
  const nodeDefaults = useMemo(() => ({ style: nodeStyle(appearance) }), [appearance]);
  const edgeDefaults = useMemo(() => ({ type: appearance.edgeType, style: edgeStyle(appearance), animated: appearance.edgeAnimated,
    markerEnd: appearance.edgeArrow ? { type: 'arrowclosed' as const, color: appearance.edgeColor } : false as const }), [appearance]);
  const close = useCallback(() => { setDialog(null); setQuery(''); }, []);
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  const selectNode = useCallback((id: string | null) => { setSelection({ nodes: id ? [id] : [], edges: [] }); if (id) setInspector(true); }, []);
  const onSelectionChange = useCallback(({ nodes, edges }: { nodes: { id: string }[]; edges: { id: string }[] }) => {
    const next = { nodes: nodes.map((node) => node.id), edges: edges.map((edge) => edge.id) };
    setSelection((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, []);
  const enable = useCallback(async (id: PluginId) => {
    setPending((items) => [...items, id]);
    try { await runtime.load(id, catalog.find((plugin) => plugin.id === id)!.loader); remember(runtime.getSnapshot().plugins.map((plugin) => plugin.id)); return true; }
    catch (error) { notify(error instanceof Error ? error.message : 'Plugin failed to load.'); return false; }
    finally { setPending((items) => items.filter((item) => item !== id)); }
  }, [runtime, notify]);
  useEffect(() => {
    let ids: PluginId[] = ['history'];
    try { const saved: unknown = JSON.parse(localStorage.getItem(preferencesKey) ?? 'null'); if (Array.isArray(saved)) ids = saved.filter((id): id is PluginId => catalog.some((item) => item.id === id)); } catch { /* Demo default. */ }
    void Promise.all(ids.map(enable));
  }, [enable]);
  const execute = useCallback((id: string, payload?: unknown) => {
    try { return runtime.execute(id, payload); } catch (error) { notify(error instanceof Error ? error.message : 'Action failed.'); }
  }, [runtime, notify]);
  const openDraw = async (next = 'select') => {
    if (!runtime.hasPlugin('draw') && !await enable('draw')) return;
    setShowCode(false); setShowDraw(true); setTool(next);
    requestAnimationFrame(() => appRef.current?.focus({ preventScroll: true }));
  };
  // React Flow fits once on mount. Resizing chrome must never move the viewport.
  const fit = useCallback(() => {
    // Import and layout update the document before React Flow projects its nodes.
    // Fit the current document so an explicit fit never uses the previous graph.
    const nodes = runtime.getDocument().nodes.filter(node => !node.hidden);
    if (!nodes.length) return;
    const x = Math.min(...nodes.map(node => node.position.x));
    const y = Math.min(...nodes.map(node => node.position.y));
    const right = Math.max(...nodes.map(node => node.position.x + (node.width ?? flow.getNode(node.id)?.measured?.width ?? 190)));
    const bottom = Math.max(...nodes.map(node => node.position.y + (node.height ?? flow.getNode(node.id)?.measured?.height ?? 112)));
    void flow.fitBounds({ x, y, width: right - x, height: bottom - y }, { padding: 0.13 });
  }, [flow, runtime]);
  useEffect(() => runtime.onDocumentChange((doc, _previous, meta) => {
    if (meta.source === 'persistence.load') { if (doc.view) void flow.setViewport(doc.view); else fit(); }
  }), [runtime, flow, fit]);
  const arrange = async (direction: 'LR' | 'TB' = 'LR') => {
    if (!runtime.hasPlugin('layout') && !await enable('layout')) return;
    execute('layout.arrange', { direction });
    requestAnimationFrame(fit);
    notify('Layout updated. Attached annotations stayed with their workflow steps.');
  };
  const exportCanvas = async () => {
    if (!runtime.hasPlugin('export') && !await enable('export')) return;
    execute('export.download');
  };
  const exportImage = async () => {
    if (exportingImage) return;
    setExportingImage(true);
    try {
      const { downloadCanvasPng } = await import('bolt-flow-plugin-image-export');
      const element = appRef.current?.querySelector<HTMLElement>('.bolt-canvas');
      if (!element) throw new Error('Canvas is not ready.');
      await downloadCanvasPng(element, runtime.getDocument(), { includeAnnotations: true, background: theme === 'dark' ? '#1b1e26' : '#fafbfc', grid: grid ? 'dots' : 'none' });
      notify('Full canvas image downloaded.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Image export failed.'); }
    finally { setExportingImage(false); }
  };
  const addNode = useCallback((kind = 'idea') => {
    const rect = document.querySelector('.canvas-stage')?.getBoundingClientRect();
    const position = flow.screenToFlowPosition({ x: (rect?.left ?? 200) + (rect?.width ?? 700) / 2 - 90, y: (rect?.top ?? 100) + (rect?.height ?? 500) / 2 - 50 });
    const id = crypto.randomUUID();
    runtime.updateDocument((draft) => { draft.nodes.push({ id, type: 'bolt', width: 190, height: 112, position, data: { label: kind === 'note' ? 'A note to remember' : 'Your next big idea', description: 'Select this card to make it your own.', kind, tag: 'NEW POSSIBILITY', accent: kind === 'note' ? 'orange' : 'purple' } }); }, { source: 'node.add' });
    selectNode(id); setTool('select');
  }, [flow, runtime, selectNode]);
  const onCreated = useCallback((id: string, kind: 'node' | 'edge') => {
    setSelection({ nodes: kind === 'node' ? [id] : [], edges: kind === 'edge' ? [id] : [] });
    if (kind === 'edge' || runtime.getDocument().nodes.find((node) => node.id === id)?.type === 'bolt-comment') setInspector(true);
  }, [runtime]);
  const interaction: CanvasToolProps = useMemo(() => ({ tool, options: drawOptions, onToolChange: setTool, onOptionsChange: saveDrawOptions, onCreated, onMessage: notify }), [tool, drawOptions, saveDrawOptions, onCreated, notify]);
  const history = runtime.hasCommand('history.status') ? runtime.execute<undefined, { undo: number; redo: number }>('history.status') : { undo: 0, redo: 0 };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); appRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Save canvas"]')?.click(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setDialog((old) => old === 'commands' ? null : 'commands'); return; }
      if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]') || dialog) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && runtime.hasPlugin('history')) { event.preventDefault(); execute(event.shiftKey ? 'history.redo' : 'history.undo'); }
      if (event.metaKey || event.ctrlKey) return;
      if (event.key.toLowerCase() === 'n') addNode();
      if (event.key.toLowerCase() === 'v' || event.key === 'Escape') setTool('select');
      if (event.key.toLowerCase() === 'h') setTool('pan');
    };
    const scope = appRef.current;
    scope?.addEventListener('keydown', key); return () => scope?.removeEventListener('keydown', key);
  }, [runtime, dialog, execute, notify, addNode, enable]);
  const importCanvas = async (file?: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { notify('Choose a document smaller than 25 MB.'); return; }
    if (!runtime.hasPlugin('export') && !await enable('export')) return;
    try { runtime.execute('import.json', await file.text()); selectNode(null); setTool('select'); const view = runtime.getDocument().view; if (view) void flow.setViewport(view); else fit(); notify('Canvas imported. Enable Connected ink to edit saved drawings.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Invalid document.'); }
  };
  const focusNode = (id: string) => { const node = runtime.getDocument().nodes.find(n => n.id === id); if (node?.hidden) execute('editor.layer', { ids: [id], hidden: false }); selectNode(id); setTool('select'); void flow.fitView({ nodes: [{ id }], maxZoom: 1.1, duration: 250 }); };
  return <div ref={appRef} data-bolt-editor data-density={String(workspaceSettings.density ?? 'comfortable')} style={{ '--bolt-accent': String(workspaceSettings.accent ?? '#2563eb') } as CSSProperties} tabIndex={-1} className={`app ${theme === 'dark' ? 'dark' : ''} ${inspector ? 'inspector-open' : ''}`}>
    <SiteHeader><button className="search-trigger" onClick={() => setDialog('commands')} aria-label="Find an action"><Search size={16} /><span>Search actions</span><kbd>⌘ K</kbd></button><IconButton icon={theme === 'light' ? Moon : Sun} label="Toggle color theme" onClick={() => setTheme(old => old === 'light' ? 'dark' : 'light')} /><IconButton icon={CircleHelp} label="Help & shortcuts" onClick={() => setDialog('help')} /></SiteHeader>
    <div className="document-bar">
      <div className="document-title"><span className="document-symbol"><Workflow size={20} /></span><div><h1>{canvas.name}</h1><span>Personal workspace <span aria-hidden="true">/</span> Editable example</span></div></div>
      <div className="document-actions"><PersistenceBar rememberView={rememberView} setRememberView={setRememberView} enable={() => enable('storage')} notify={notify} /><span className="toolbar-divider" /><button className="button secondary" aria-label="Import canvas" onClick={() => fileInput.current?.click()}><Upload size={15} /><span>Import</span></button><button className="button secondary png-action" disabled={exportingImage} onClick={() => void exportImage()}>{exportingImage ? 'Exporting…' : 'PNG'}</button><button className="button secondary" aria-label="Export canvas" onClick={() => void exportCanvas()}><Download size={15} /><span>Export JSON</span></button></div>
      <input className="visually-hidden" ref={fileInput} aria-label="Import canvas JSON" type="file" accept=".json" onChange={event => { void importCanvas(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="sidebar-top"><strong>Workspace</strong><IconButton icon={Plus} label="Create a canvas" onClick={() => setDialog('templates')} /></div>
      <div className="sidebar-tabs" role="group" aria-label="Workspace panels">
        <button className={tab === 'canvas' ? 'current' : ''} aria-label="My canvas" aria-pressed={tab === 'canvas'} onClick={() => setTab('canvas')}><Box size={15} /><span>Insert</span></button>
        <button className={tab === 'layers' ? 'current' : ''} aria-label="Layers" aria-pressed={tab === 'layers'} onClick={() => { setTab('layers'); if (window.innerWidth < 1100) setDialog('layers'); }}><Layers size={15} /><span>Layers</span></button>
        <button className={tab === 'review' ? 'current' : ''} aria-label="Review comments" aria-pressed={tab === 'review'} onClick={() => { setTab('review'); if (window.innerWidth < 1100) setDialog('review'); }}><MessageCircle size={15} /><span>Notes</span></button>
      </div>
      <div className="sidebar-details">
        {tab === 'layers' ? <BoltLayers selectedIds={selection.nodes} onSelect={ids => { setSelection({ nodes: ids, edges: [] }); setTool('select'); }} onFocus={focusNode} onError={error => notify(String(error))} /> : tab === 'canvas' ? <>
          <div className="section-title">Add to canvas</div><p className="panel-description">Choose a starting point. Make it your own in Properties.</p>
          <div className="insert-grid">{([['idea', 'Idea', Lightbulb], ['build', 'Task', Code2], ['note', 'Note', BookOpen], ['feedback', 'Review', MessageCircle]] as const).map(([kind, label, Icon]) => <button key={kind} onClick={() => addNode(kind)}><Icon size={21} /><span>{label}</span></button>)}</div>
          <button className="sidebar-feature" onClick={() => void openDraw()}><span className="feature-icon"><Pencil size={18} /></span><span><strong>Draw & annotate</strong><small>Shapes, ink, and connected notes</small></span><ChevronRight size={15} /></button>
          <div className="section-title">Start with a template</div><button className="template-preview" aria-label="Templates" onClick={() => setDialog('templates')}><span className="mini-graph" aria-hidden="true"><i /><i /><i /><i /></span><strong>Explore templates<ArrowUpRight size={14} /></strong><small>Product launch, architecture, or blank</small></button>
          <div className="panel-tip"><span><Lightbulb size={15} /> Quick tip</span><p>Draw an arrow between two steps to create a real connection.</p><DocumentationLink to="/docs/drawing">Drawing guide</DocumentationLink></div>
        </> : <><div className="section-title">Conversations <span>{comments.length}</span></div><div className="layer-list">{comments.map(node => <button key={node.id} onClick={() => focusNode(node.id)}><MessageCircle size={15} /><span>{String(node.data.label)}</span>{node.data.resolved === true && <Check size={14} />}</button>)}</div>{!comments.length && <div className="panel-empty"><MessageCircle size={26} /><strong>No comments yet</strong><p>Add a note anywhere on the canvas or attach it to a step.</p><button className="button secondary" onClick={() => void openDraw('draw.comment')}>Add comment</button></div>}</>}
      </div>
      <nav className="sidebar-bottom" aria-label="Workspace tools"><button className="nav-item" aria-label="JSON studio" onClick={() => setDialog('json')}><Code2 size={17} /><span>JSON studio</span><kbd>{'{ }'}</kbd></button><button className="nav-item" aria-label="Customize workspace" onClick={() => setDialog('customize')}><SlidersHorizontal size={17} /><span>Customize</span></button><button className="nav-item" aria-label="Plugin library" onClick={() => setDialog('plugins')}><Puzzle size={17} /><span>Plugins</span><small>{plugins.length}</small></button><DocumentationLink to="/docs/quickstart">Build your own editor</DocumentationLink></nav>
    </aside>
    <main className="main-workspace" aria-label="Canvas editor">
      <div className="workbench"><div className="workbench-toolbar"><div className="mode-tabs" role="group" aria-label="Editing mode"><button className={!showDraw && !showCode ? 'selected' : ''} aria-pressed={!showDraw && !showCode} onClick={() => { setShowCode(false); setShowDraw(false); setTool('select'); }}><Workflow size={15} />Flow</button><button className={showDraw && !showCode ? 'selected' : ''} aria-label="Draw" aria-pressed={showDraw && !showCode} onClick={() => void openDraw()} disabled={pending.includes('draw')}><Pencil size={15} />{pending.includes('draw') ? 'Loading…' : 'Draw'}</button><button className={showCode ? 'selected' : ''} aria-pressed={showCode} onClick={() => setShowCode(true)}><Code2 size={15} />Code</button></div><span className="toolbar-divider" /><IconButton icon={Undo2} label="Undo (⌘Z)" disabled={!history.undo} onClick={() => execute('history.undo')} /><IconButton icon={Redo2} label="Redo (⌘⇧Z)" disabled={!history.redo} onClick={() => execute('history.redo')} /><div className="toolbar-right"><button className="text-button layout-action" onClick={() => void arrange()} disabled={pending.includes('layout')}><Sparkles size={15} /><span>Auto layout</span></button><IconButton icon={Grid2X2} label="Toggle canvas grid" active={grid} onClick={() => setGrid(!grid)} /><IconButton icon={Puzzle} label="Open plugin settings" onClick={() => setDialog('plugins')} /><span className="toolbar-divider" /><IconButton icon={PanelRight} label="Toggle inspector" active={inspector} onClick={() => setInspector(!inspector)} /></div></div>
        <div className={`canvas-stage ${showDraw ? 'drawing-mode' : ''}`}><div className={`canvas-surface ${showCode ? 'code-hidden' : ''}`} aria-hidden={showCode} inert={showCode}>
          <BoltCanvas theme={theme} nodeTypes={nodeTypes} nodeDefaults={nodeDefaults} edgeDefaults={edgeDefaults} showGrid={grid} showControls={false} showMinimap={minimap} interaction={interaction}
            selectedNodeIds={selection.nodes} selectedEdgeIds={selection.edges} fitViewOptions={{ padding: 0.18 }} panOnDrag={tool === 'pan'} selectionOnDrag={tool === 'select'} nodesDraggable={tool === 'select'} autoPanOnNodeDrag={false} autoPanOnSelection={false} snapToGrid={snap} snapGrid={[20, 20]}
            onNodeClick={() => setInspector(true)} onEdgeClick={() => setInspector(true)} onPaneClick={() => selectNode(null)} onSelectionChange={onSelectionChange} onMove={(_event, view) => setViewport(view)} />
          {showDraw && runtime.hasPlugin('draw') && <BoltTools {...interaction} />}
          {!showDraw && <div className="floating-tools" role="toolbar" aria-label="Canvas tools"><IconButton icon={MousePointer2} label="Select tool (V)" active={tool === 'select'} onClick={() => setTool('select')} /><IconButton icon={Hand} label="Pan tool (H)" active={tool === 'pan'} onClick={() => setTool('pan')} /><span className="toolbar-divider" /><IconButton icon={Plus} label="Add idea node (N)" onClick={() => addNode()} /><IconButton icon={MessageCircle} label="Add comment" onClick={() => { if (selected && selected.role !== 'annotation') setDrawOptions(old => ({ ...old, anchorId: selected.id })); void openDraw('draw.comment'); }} /><IconButton icon={Pencil} label="Open drawing tools" onClick={() => void openDraw()} /><span className="toolbar-divider" /><IconButton icon={SlidersHorizontal} label="Canvas style settings" onClick={() => { selectNode(null); setInspector(true); }} /></div>}
          {!canvas.nodes.length && <div className="empty-canvas"><span className="empty-icon"><Workflow size={30} /></span><h2>Space for your next idea</h2><p>Add a step, connect your thinking, or start drawing.</p><button className="button primary" onClick={() => addNode()}>Add your first idea</button></div>}
          <div className="canvas-hint">{tool.startsWith('draw.') ? 'Draw on the canvas · Esc to select' : tool === 'pan' ? 'Drag to pan · V to select' : 'Select an object to edit · Scroll to zoom'}</div>
          <div className="zoom-controls"><IconButton icon={Minus} label="Zoom out" onClick={() => void flow.zoomOut({ duration: 150 })} /><button className="zoom-number" aria-label="Reset zoom to 100 percent" onClick={() => void flow.zoomTo(1)}>{Math.round(zoom * 100)}%</button><IconButton icon={Plus} label="Zoom in" onClick={() => void flow.zoomIn({ duration: 150 })} /><span className="toolbar-divider" /><IconButton icon={Focus} label="Fit canvas to view" onClick={fit} /></div>
        </div>{showCode && <PlaygroundCode document={canvas} settings={{ theme, grid, minimap, snap, tool, drawing: drawOptions, viewport, inspector, showDraw, rememberView }} pluginIds={plugins.map(plugin => plugin.id)} />}
        </div>
        <footer className="workbench-status"><span><span className="status-dot" />{canvas.nodes.length - annotations.length} steps <span className="status-detail">· {annotations.length} annotations · {canvas.edges.length} connections</span></span><button onClick={() => setDialog('plugins')}><Puzzle size={12} />{plugins.length} plugins</button></footer>
      </div>
    </main>
    {inspector && <><button className="inspector-scrim" aria-label="Dismiss inspector" onClick={() => setInspector(false)} /><aside className="inspector" aria-label="Properties"><Inspector nodeId={nodeId} edgeId={edgeId} onClose={() => setInspector(false)} onSelect={selectNode} onMessage={notify} grid={grid} setGrid={setGrid} minimap={minimap} setMinimap={setMinimap} snap={snap} setSnap={setSnap} /></aside></>}
    {dialog === 'review' && <Modal title="Canvas comments" close={close}><div className="layer-list">{comments.map(node => <button key={node.id} onClick={() => { focusNode(node.id); close(); }}><MessageCircle size={16} /><span>{String(node.data.label)}</span></button>)}{!comments.length && <p>No comments yet. Choose Add comment to start a conversation.</p>}<button className="button primary" onClick={() => { close(); void openDraw('draw.comment'); }}>Add comment</button></div></Modal>}
    {notice && <div className="toast" role="status"><Sparkles size={16} /><span>{notice}</span><IconButton icon={X} label="Dismiss notification" onClick={() => setNotice('')} /></div>}
    {dialog === 'layers' && <Modal title="Canvas layers" close={close}><BoltLayers selectedIds={selection.nodes} onSelect={ids => setSelection({ nodes: ids, edges: [] })} onFocus={id => { focusNode(id); close(); }} onError={error => notify(String(error))} /></Modal>}
    {dialog === 'json' && <Modal title="JSON studio" subtitle="Preview, insert, or replace a generated canvas." close={close} wide><DocumentStudio onApplied={() => { close(); selectNode(null); setTool('select'); requestAnimationFrame(fit); notify('Canvas updated. Undo is available; Save persists the result.'); }} /></Modal>}
    {dialog === 'customize' && <Modal title="Customize workspace" subtitle="Choose your tools, colors, and workspace defaults." close={close} wide><WorkspaceSettings theme={theme} setTheme={setTheme} grid={grid} setGrid={setGrid} snap={snap} setSnap={setSnap} minimap={minimap} setMinimap={setMinimap} interaction={interaction} notify={notify} /></Modal>}
    {dialog === 'plugins' && <Modal title="Plugin library" subtitle="Optional packages. Load what you need, leave out what you don’t." close={close} wide><div className="dialog-search"><Search size={16} /><input aria-label="Search plugins" placeholder="Find a plugin…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="plugin-grid">{catalog.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())).map(({ id, name, description, icon: Icon, color }) => <article className="plugin-card" key={id}><span className={`plugin-icon accent-${color}`}><Icon size={24} /></span><h3>{name}</h3><p>{description}</p><div><code>plugin-{id}</code><button className={`button ${runtime.hasPlugin(id) ? 'enabled' : 'secondary'}`} disabled={pending.includes(id)} onClick={() => {
      if (runtime.hasPlugin(id)) { if (id === 'draw') { setShowDraw(false); setTool('select'); } runtime.remove(id); remember(runtime.getSnapshot().plugins.map((p) => p.id)); notify(`${name} disabled. Saved objects are retained.`); }
      else void enable(id);
    }}>{pending.includes(id) ? 'Loading…' : runtime.hasPlugin(id) ? <><Check size={13} />Enabled</> : <><Plus size={13} />Enable</>}</button></div></article>)}</div><div className="modal-footer"><Code2 size={18} /><span>Custom tools, renderers, and commands through the typed plugin SDK.</span></div></Modal>}
    {dialog === 'commands' && <Modal title="Search actions" close={close}><div className="dialog-search"><Search size={17} /><input aria-label="Search commands" placeholder="Search actions…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></div><div className="command-list">{[
      { title: 'Add an idea node', shortcut: 'N', action: () => addNode() }, { title: 'Open native drawing tools', action: () => void openDraw() }, { title: 'Add a canvas comment', action: () => void openDraw('draw.comment') },
      { title: 'Explore the plugin library', action: () => setDialog('plugins') }, { title: 'Arrange nodes horizontally', action: () => void arrange() }, { title: 'Arrange nodes vertically', action: () => void arrange('TB') },
      { title: 'Download canvas document', action: () => void exportCanvas() }, { title: 'Customize canvas defaults', action: () => { selectNode(null); setInspector(true); } },
      ...(runtime.hasPlugin('history') ? [{ title: 'Undo last change', shortcut: '⌘ Z', action: () => execute('history.undo') }, { title: 'Redo last change', shortcut: '⌘ ⇧ Z', action: () => execute('history.redo') }] : []),
    ].filter((command) => command.title.toLowerCase().includes(query.toLowerCase())).map((command) => <button key={command.title} onClick={() => { close(); command.action(); }}><Command size={16} /><span>{command.title}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}<ChevronRight size={15} /></button>)}</div></Modal>}
    {dialog === 'templates' && <Modal title="Choose a template" subtitle="This replaces the current document. Export a copy first, or use Undo with history enabled." close={close}><div className="template-list">{[
      { title: 'Product launch', text: 'From the first spark to lift off.', icon: Rocket, create: launchTemplate }, { title: 'System architecture', text: 'Map how the pieces fit together.', icon: Workflow, create: architectureTemplate }, { title: 'A blank canvas', text: 'Start a workflow, sketch, or conversation.', icon: Plus, create: () => createDocument({ id: crypto.randomUUID() }) },
    ].map(({ title, text, icon: Icon, create }) => <button key={title} onClick={() => { runtime.replaceDocument(create(), { source: 'template' }); selectNode(null); setTool('select'); close(); requestAnimationFrame(fit); }}><span><Icon size={24} /></span><div><strong>{title}</strong><p>{text}</p></div><ArrowRight size={16} /></button>)}</div></Modal>}
    {dialog === 'help' && <Modal title="Help & shortcuts" subtitle="A native, connected canvas — no separate drawing editor." close={close}><div className="help-content"><h3>Try the connected workflow</h3><ol><li>Open <strong>Draw</strong> and choose Comment or Pen.</li><li>Choose a workflow step in <strong>Attach to</strong>, then annotate it.</li><li>Switch to Select and drag the step. Its annotations move with it.</li><li>Draw a <strong>Smart arrow</strong> between two unconnected steps. It becomes a real edge.</li><li>Select a drawing and <strong>Promote to workflow step</strong> when an idea becomes actionable.</li></ol><p>Comments support local replies and resolution. This is not multiplayer collaboration.</p><h3>Shortcuts</h3><div className="shortcuts">{[['Commands', '⌘ / Ctrl K'], ['Add a step', 'N'], ['Select / pan', 'V / H'], ['Undo / redo', '⌘Z / ⌘⇧Z'], ['Cancel drawing', 'Esc'], ['Save (storage plugin)', '⌘ / Ctrl S']].map(([title, key]) => <div key={title}><span>{title}</span><kbd>{key}</kbd></div>)}</div><p>Click Save or export before closing. Autosave is optional. The current native tools do not reproduce every advanced drawing-editor feature.</p></div></Modal>}
  </div>;
}
