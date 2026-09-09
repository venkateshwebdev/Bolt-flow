import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createDocument, type BoltPlugin, type Json } from 'bolt-flow-core';
import { BoltCanvas, BoltTools, Handle, Position, useBolt, useBoltSnapshot, useReactFlow, type NodeProps, type Node, type CanvasToolProps } from 'bolt-flow-react';
import { ArrowRight, ArrowUpRight, BookOpen, Box, Check, ChevronRight, CircleHelp, Code2, Command, Download, Focus, FolderOpen, GitBranch, Grid2X2, Hand, History, Layers, Lightbulb, Link2, MessageCircle, Minus, Moon, MousePointer2, Palette, PanelRight, Pencil, Plus, Puzzle, Redo2, Rocket, Search, Shapes, SlidersHorizontal, Sparkles, Sun, Undo2, Upload, Workflow, X, Zap, type LucideIcon } from 'lucide-react';
import { architectureTemplate, launchTemplate } from './templates';
import { Inspector } from './Inspector';
import { appearanceOf, nodeStyle, edgeStyle } from './appearance';

const icons: Record<string, LucideIcon> = { idea: Lightbulb, research: Search, design: Palette, build: Code2, feedback: MessageCircle, launch: Rocket, note: BookOpen };
function FlowCard({ data, selected }: NodeProps<Node<Record<string, Json>>>) {
  const Icon = icons[String(data.kind)] ?? Box;
  return <article className={`flow-card accent-${String(data.accent ?? 'purple')} ${selected ? 'selected' : ''}`}>
    <Handle type="target" position={Position.Left} />
    <div className="card-top"><span className="card-icon"><Icon size={19} /></span><span className="card-tag">{String(data.tag ?? 'WORKFLOW STEP')}</span></div>
    <h3>{String(data.label ?? 'Untitled')}</h3><p>{String(data.description ?? '')}</p>
    <Handle type="source" position={Position.Right} />
  </article>;
}
const nodeTypes = { bolt: FlowCard };
type PluginId = 'draw' | 'history' | 'layout' | 'storage' | 'export';
const catalog: { id: PluginId; name: string; description: string; icon: LucideIcon; color: string; loader: () => Promise<BoltPlugin> }[] = [
  { id: 'draw', name: 'Connected ink', description: 'Draw, comment, attach context, and turn ink into real workflow connections. One canvas.', icon: Pencil, color: 'pink', loader: async () => {
    const [{ drawPlugin }, { drawOptions }] = await Promise.all([import('bolt-flow-plugin-draw'), import('./drawing')]);
    return drawPlugin({ ...drawOptions, toFlowNode: (node) => ({ type: 'bolt', width: 240, height: 148, data: { label: String(node.data.label), description: 'Promoted from a canvas annotation.', kind: 'idea', tag: 'FROM SKETCH TO STEP', accent: 'purple' } }) });
  } },
  { id: 'layout', name: 'Smart layout', description: 'Arrange workflow steps automatically. Attached sketches and comments follow their owners.', icon: Workflow, color: 'blue', loader: async () => (await import('bolt-flow-plugin-layout')).layoutPlugin() },
  { id: 'history', name: 'Time machine', description: 'One undo history for workflow edits, ink, comments, styles, and layout.', icon: History, color: 'purple', loader: async () => (await import('bolt-flow-plugin-history')).historyPlugin() },
  { id: 'storage', name: 'Local autosave', description: 'Keep this document and its annotations in your browser. No cloud account.', icon: FolderOpen, color: 'green', loader: async () => (await import('bolt-flow-plugin-storage')).storagePlugin({ key: 'bolt-flow:playground:v1' }) },
  { id: 'export', name: 'Portable canvas', description: 'Import and export your graph, drawings, discussions, and styles together as JSON.', icon: Download, color: 'orange', loader: async () => (await import('bolt-flow-plugin-export')).exportPlugin() },
];
const preferencesKey = 'bolt-flow:playground:plugins';
function remember(ids: string[]) { try { localStorage.setItem(preferencesKey, JSON.stringify(ids)); } catch { /* Noncritical preferences only. */ } }
function IconButton({ icon: Icon, label, onClick, active, disabled = false }: { icon: LucideIcon; label: string; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" className={`icon-button ${active ? 'active' : ''}`} aria-label={label} aria-pressed={active} title={label} onClick={onClick} disabled={disabled}><Icon size={18} strokeWidth={1.8} /></button>;
}
function Modal({ title, subtitle, children, close, wide }: { title: string; subtitle?: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex="0"]');
    const initial = ref.current?.querySelector<HTMLElement>('input') ?? ref.current;
    initial?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      const list = focusable(); if (!list?.length) return;
      const first = list[0], last = list[list.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [close]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><IconButton icon={X} label="Close dialog" onClick={close} /></div>{children}</div></div>;
}

export default function App() {
  const runtime = useBolt();
  const { document: canvas, plugins } = useBoltSnapshot();
  const flow = useReactFlow();
  const [showDraw, setShowDraw] = useState(false);
  const [tool, setTool] = useState('select');
  const [drawOptions, setDrawOptions] = useState<Record<string, Json>>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [grid, setGrid] = useState(true), [minimap, setMinimap] = useState(false), [snap, setSnap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<{ nodes: string[]; edges: string[] }>({ nodes: [], edges: [] });
  const [inspector, setInspector] = useState(() => window.innerWidth >= 1440);
  const [dialog, setDialog] = useState<'plugins' | 'commands' | 'templates' | 'help' | null>(null);
  const [query, setQuery] = useState(''), [pending, setPending] = useState<string[]>([]), [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'canvas' | 'layers' | 'review'>('canvas');
  const fileInput = useRef<HTMLInputElement>(null);
  const nodeId = selection.nodes[0] ?? null, edgeId = selection.edges[0] ?? null;
  const selected = canvas.nodes.find((node) => node.id === nodeId);
  const annotations = canvas.nodes.filter((node) => node.role === 'annotation');
  const comments = annotations.filter((node) => node.type === 'bolt-comment');
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
    setShowDraw(true); setTool(next);
  };
  // React Flow fits once on mount. Resizing chrome must never move the viewport.
  const fit = useCallback(() => { void flow.fitView({ padding: 0.13, duration: 250 }); }, [flow]);
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
  const addNode = useCallback((kind = 'idea') => {
    const rect = document.querySelector('.canvas-stage')?.getBoundingClientRect();
    const position = flow.screenToFlowPosition({ x: (rect?.left ?? 200) + (rect?.width ?? 700) / 2 - 90, y: (rect?.top ?? 100) + (rect?.height ?? 500) / 2 - 50 });
    const id = crypto.randomUUID();
    runtime.updateDocument((draft) => { draft.nodes.push({ id, type: 'bolt', width: 240, height: 148, position, data: { label: kind === 'note' ? 'A note to remember' : 'Your next big idea', description: 'Select this card to make it your own.', kind, tag: 'NEW POSSIBILITY', accent: kind === 'note' ? 'orange' : 'purple' } }); }, { source: 'node.add' });
    selectNode(id); setTool('select');
  }, [flow, runtime, selectNode]);
  const onCreated = useCallback((id: string, kind: 'node' | 'edge') => {
    setSelection({ nodes: kind === 'node' ? [id] : [], edges: kind === 'edge' ? [id] : [] });
    if (kind === 'edge' || runtime.getDocument().nodes.find((node) => node.id === id)?.type === 'bolt-comment') setInspector(true);
  }, [runtime]);
  const interaction: CanvasToolProps = useMemo(() => ({ tool, options: drawOptions, onToolChange: setTool, onOptionsChange: setDrawOptions, onCreated, onMessage: notify }), [tool, drawOptions, onCreated, notify]);
  const history = runtime.hasCommand('history.status') ? runtime.execute<undefined, { undo: number; redo: number }>('history.status') : { undo: 0, redo: 0 };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setDialog((old) => old === 'commands' ? null : 'commands'); return; }
      if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]') || dialog) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && runtime.hasPlugin('history')) { event.preventDefault(); execute(event.shiftKey ? 'history.redo' : 'history.undo'); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (runtime.hasPlugin('storage')) execute('storage.save'); else notify('Enable Local autosave to save in this browser, or export a JSON document.'); }
      if (event.metaKey || event.ctrlKey) return;
      if (event.key.toLowerCase() === 'n') addNode();
      if (event.key.toLowerCase() === 'v' || event.key === 'Escape') setTool('select');
      if (event.key.toLowerCase() === 'h') setTool('pan');
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [runtime, dialog, execute, notify, addNode]);
  const importCanvas = async (file?: File) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { notify('Choose a document smaller than 25 MB.'); return; }
    if (!runtime.hasPlugin('export') && !await enable('export')) return;
    try { runtime.execute('import.json', await file.text()); selectNode(null); setTool('select'); requestAnimationFrame(fit); notify('Canvas imported. Enable Connected ink to edit saved drawings.'); }
    catch (error) { notify(error instanceof Error ? error.message : 'Invalid document.'); }
  };
  const focusNode = (id: string) => { selectNode(id); setTool('select'); void flow.fitView({ nodes: [{ id }], maxZoom: 1.1, duration: 250 }); };
  return <div className={`app ${theme === 'dark' ? 'dark' : ''} ${inspector ? 'inspector-open' : ''}`}>
    <header className="app-header"><a className="brand" href="#" onClick={(event) => event.preventDefault()} aria-label="Bolt Flow home"><span className="brand-mark"><Zap size={23} fill="currentColor" /></span><span>bolt<span>flow</span></span><small>ALPHA</small></a><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={13} /><strong>{canvas.name}</strong></div><div className="header-actions"><button className="search-trigger" onClick={() => setDialog('commands')}><Search size={16} /><span>Find an action</span><kbd>⌘ K</kbd></button><IconButton icon={theme === 'light' ? Moon : Sun} label="Toggle color theme" onClick={() => setTheme((old) => old === 'light' ? 'dark' : 'light')} /><IconButton icon={PanelRight} label="Toggle inspector" active={inspector} onClick={() => setInspector(!inspector)} /></div></header>
    <aside className="sidebar"><div className="workspace-label"><span><Layers size={17} /></span><div><strong>Your workspace</strong><small>A home for connected ideas</small></div></div><button className="new-canvas" aria-label="Create a canvas" onClick={() => setDialog('templates')}><Plus size={17} /><span>Create a canvas</span></button>
      <div className="nav-caption">WORKSPACE</div>
      <button className={`nav-item ${tab === 'canvas' ? 'current' : ''}`} aria-label="My canvas" onClick={() => setTab('canvas')}><Grid2X2 size={18} /><span>My canvas</span><small>1</small></button>
      <button className={`nav-item ${tab === 'layers' ? 'current' : ''}`} aria-label="Layers" onClick={() => setTab('layers')}><Layers size={18} /><span>Layers</span><small>{canvas.nodes.length}</small></button>
      <button className={`nav-item ${tab === 'review' ? 'current' : ''}`} aria-label="Review comments" onClick={() => setTab('review')}><MessageCircle size={18} /><span>Review</span><small>{comments.filter((node) => !node.data.resolved).length}</small></button>
      <button className="nav-item" aria-label="Templates" onClick={() => setDialog('templates')}><Shapes size={18} /><span>Templates</span></button>
      <div className="sidebar-details"><div className="nav-caption">{tab === 'layers' ? 'CANVAS OBJECTS' : tab === 'review' ? 'OPEN CONVERSATIONS' : 'CURRENT CANVAS'}</div>
        {tab === 'canvas' ? <button className="canvas-item" onClick={fit}><GitBranch size={15} /><span>{canvas.name}</span></button> : <div className="layer-list">{(tab === 'review' ? comments : canvas.nodes).map((node) => <button className={nodeId === node.id ? 'selected' : ''} key={node.id} onClick={() => focusNode(node.id)}>{node.type === 'bolt-comment' ? <MessageCircle size={13} /> : node.role === 'annotation' ? <Pencil size={13} /> : <Box size={13} />}<span>{String(node.data.label)}</span>{node.anchor && <Link2 size={11} />}{node.data.resolved === true && <Check size={12} />}</button>)}{tab === 'review' && !comments.length && <p>No comments yet. Open Draw, choose Comment, and click anywhere.</p>}</div>}
      </div>
      <div className="sidebar-spacer" /><div className="connected-promo"><Link2 size={24} /><strong>Context that stays connected.</strong><p>Attach ink to a step. Move the step. The conversation moves with it.</p><button onClick={() => void openDraw('draw.comment')}>Try connected ink<ArrowUpRight size={14} /></button></div>
      <button className="nav-item" aria-label="Plugin library" onClick={() => setDialog('plugins')}><Puzzle size={18} /><span>Plugin library</span><small>{plugins.length}</small></button><button className="nav-item" aria-label="Help & shortcuts" onClick={() => setDialog('help')}><CircleHelp size={18} /><span>Help & shortcuts</span></button><div className="sidebar-footer"><span className="status-dot" />Local-first · v0.1</div>
    </aside>
    <main className="main-workspace"><div className="canvas-heading"><div><div className="eyebrow"><Workflow size={13} />ONE CANVAS. MORE POSSIBILITIES.</div><h1>{canvas.name}<span>.</span></h1><p>Workflows, sketches, and the conversations between them.</p></div><div className="heading-actions"><button className="button secondary" onClick={() => fileInput.current?.click()}><Upload size={15} /><span>Import</span></button><button className="button primary" onClick={() => void exportCanvas()}><Download size={15} /><span>Export canvas</span></button></div></div>
      <input className="visually-hidden" ref={fileInput} type="file" accept=".json" onChange={(event) => { void importCanvas(event.target.files?.[0]); event.target.value = ''; }} />
      <div className="workbench"><div className="workbench-toolbar"><div className="mode-tabs"><button className={!showDraw ? 'selected' : ''} aria-pressed={!showDraw} onClick={() => { setShowDraw(false); setTool('select'); }}><Workflow size={15} />Flow</button><button className={showDraw ? 'selected' : ''} aria-label="Draw" aria-pressed={showDraw} onClick={() => void openDraw()} disabled={pending.includes('draw')}><Pencil size={15} />{pending.includes('draw') ? 'Loading…' : 'Draw'}</button></div><div className="toolbar-divider" /><IconButton icon={Undo2} label="Undo (⌘Z)" disabled={!history.undo} onClick={() => execute('history.undo')} /><IconButton icon={Redo2} label="Redo (⌘⇧Z)" disabled={!history.redo} onClick={() => execute('history.redo')} /><div className="toolbar-right"><button className="text-button layout-action" onClick={() => void arrange()} disabled={pending.includes('layout')}><Sparkles size={15} /><span>Auto layout</span></button><IconButton icon={Grid2X2} label="Toggle canvas grid" active={grid} onClick={() => setGrid(!grid)} /><IconButton icon={Focus} label="Fit canvas to view" onClick={fit} /><IconButton icon={Puzzle} label="Open plugin settings" onClick={() => setDialog('plugins')} /></div></div>
        <div className={`canvas-stage ${showDraw ? 'drawing-mode' : ''}`}>
          <BoltCanvas theme={theme} nodeTypes={nodeTypes} nodeDefaults={nodeDefaults} edgeDefaults={edgeDefaults} showGrid={grid} showControls={false} showMinimap={minimap} interaction={interaction}
            selectedNodeIds={selection.nodes} selectedEdgeIds={selection.edges} fitViewOptions={{ padding: 0.13 }} panOnDrag={tool === 'pan'} selectionOnDrag={tool === 'select'} nodesDraggable={tool === 'select'} autoPanOnNodeDrag={false} autoPanOnSelection={false} snapToGrid={snap} snapGrid={[20, 20]}
            onNodeClick={() => setInspector(true)} onEdgeClick={() => setInspector(true)} onPaneClick={() => selectNode(null)}
            onSelectionChange={onSelectionChange}
            onMove={(_event, viewport) => setZoom(viewport.zoom)} />
          {showDraw && runtime.hasPlugin('draw') && <BoltTools {...interaction} />}
          <div className="canvas-label"><span className="status-dot" />{tool.startsWith('draw.') ? `${tool.replace('draw.', '').toUpperCase()} · ${drawOptions.anchorId ? 'ATTACHED TO A STEP' : 'DRAW DIRECTLY ON THE WORKFLOW'}` : 'THE BIG PICTURE'}</div>
          {!showDraw && <div className="floating-tools" role="toolbar" aria-label="Canvas tools"><IconButton icon={MousePointer2} label="Select tool (V)" active={tool === 'select'} onClick={() => setTool('select')} /><IconButton icon={Hand} label="Pan tool (H)" active={tool === 'pan'} onClick={() => setTool('pan')} /><hr /><IconButton icon={Plus} label="Add idea node (N)" onClick={() => addNode()} /><IconButton icon={MessageCircle} label="Add comment" onClick={() => { if (selected && selected.role !== 'annotation') setDrawOptions((old) => ({ ...old, anchorId: selected.id })); void openDraw('draw.comment'); }} /><IconButton icon={Pencil} label="Open drawing tools" onClick={() => void openDraw()} /><hr /><IconButton icon={SlidersHorizontal} label="Canvas style settings" onClick={() => { selectNode(null); setInspector(true); }} /></div>}
          {!canvas.nodes.length && <div className="empty-canvas"><Sparkles size={32} /><h2>A fresh start.</h2><p>One idea is all it takes.</p><button className="button primary" onClick={() => addNode()}>Add your first idea</button></div>}
          <div className="canvas-hint">{tool.startsWith('draw.') ? 'Esc to select · scroll to zoom · drawings share your undo history' : 'V to select · H to pan · N for a new step'}</div>
          <div className="zoom-controls"><IconButton icon={Minus} label="Zoom out" onClick={() => void flow.zoomOut({ duration: 150 })} /><button className="zoom-number" aria-label="Reset zoom to 100 percent" onClick={() => void flow.zoomTo(1)}>{Math.round(zoom * 100)}%</button><IconButton icon={Plus} label="Zoom in" onClick={() => void flow.zoomIn({ duration: 150 })} /><IconButton icon={Focus} label="Fit all nodes" onClick={fit} /></div>
        </div>
        <div className="workbench-status"><span><span className="status-dot" />{canvas.nodes.length - annotations.length} steps<span className="status-detail"> · {annotations.length} annotations · {canvas.edges.length} connections</span></span><button onClick={() => setDialog('plugins')}><Puzzle size={12} />{plugins.length} plugins</button></div>
      </div><footer className="workspace-bottom"><span><Link2 size={12} />Sketch → connect → discuss. Without switching canvases.</span><button onClick={() => setDialog('commands')}>Command palette <kbd>⌘ K</kbd></button></footer>
    </main>
    {inspector && <><button className="inspector-scrim" aria-label="Dismiss inspector" onClick={() => setInspector(false)} /><aside className="inspector"><Inspector nodeId={nodeId} edgeId={edgeId} onClose={() => setInspector(false)} onSelect={selectNode} onMessage={notify} grid={grid} setGrid={setGrid} minimap={minimap} setMinimap={setMinimap} snap={snap} setSnap={setSnap} /></aside></>}
    {notice && <div className="toast" role="status"><Sparkles size={16} /><span>{notice}</span><IconButton icon={X} label="Dismiss notification" onClick={() => setNotice('')} /></div>}
    {dialog === 'plugins' && <Modal title="Build your own canvas." subtitle="Optional packages. Load what you need, leave out what you don’t." close={close} wide><div className="dialog-search"><Search size={16} /><input aria-label="Search plugins" placeholder="Find a plugin…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="plugin-grid">{catalog.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())).map(({ id, name, description, icon: Icon, color }) => <article className="plugin-card" key={id}><span className={`plugin-icon accent-${color}`}><Icon size={24} /></span><h3>{name}</h3><p>{description}</p><div><code>plugin-{id}</code><button className={`button ${runtime.hasPlugin(id) ? 'enabled' : 'secondary'}`} disabled={pending.includes(id)} onClick={() => {
      if (runtime.hasPlugin(id)) { if (id === 'draw') { setShowDraw(false); setTool('select'); } runtime.remove(id); remember(runtime.getSnapshot().plugins.map((p) => p.id)); notify(`${name} disabled. Saved objects are retained.`); }
      else void enable(id);
    }}>{pending.includes(id) ? 'Loading…' : runtime.hasPlugin(id) ? <><Check size={13} />Enabled</> : <><Plus size={13} />Enable</>}</button></div></article>)}</div><div className="modal-footer"><Code2 size={18} /><span>Custom tools, renderers, and commands through the typed plugin SDK.</span></div></Modal>}
    {dialog === 'commands' && <Modal title="What’s your next move?" close={close}><div className="dialog-search"><Search size={17} /><input aria-label="Search commands" placeholder="Search actions…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>ESC</kbd></div><div className="command-list">{[
      { title: 'Add an idea node', shortcut: 'N', action: () => addNode() }, { title: 'Open native drawing tools', action: () => void openDraw() }, { title: 'Add a canvas comment', action: () => void openDraw('draw.comment') },
      { title: 'Explore the plugin library', action: () => setDialog('plugins') }, { title: 'Arrange nodes horizontally', action: () => void arrange() }, { title: 'Arrange nodes vertically', action: () => void arrange('TB') },
      { title: 'Download canvas document', action: () => void exportCanvas() }, { title: 'Customize canvas defaults', action: () => { selectNode(null); setInspector(true); } },
      ...(runtime.hasPlugin('history') ? [{ title: 'Undo last change', shortcut: '⌘ Z', action: () => execute('history.undo') }, { title: 'Redo last change', shortcut: '⌘ ⇧ Z', action: () => execute('history.redo') }] : []),
    ].filter((command) => command.title.toLowerCase().includes(query.toLowerCase())).map((command) => <button key={command.title} onClick={() => { close(); command.action(); }}><Command size={16} /><span>{command.title}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}<ChevronRight size={15} /></button>)}</div></Modal>}
    {dialog === 'templates' && <Modal title="Big ideas start somewhere." subtitle="This replaces the current document. Export a copy first, or use Undo with history enabled." close={close}><div className="template-list">{[
      { title: 'Product launch', text: 'From the first spark to lift off.', icon: Rocket, create: launchTemplate }, { title: 'System architecture', text: 'Map how the pieces fit together.', icon: Workflow, create: architectureTemplate }, { title: 'A blank canvas', text: 'Start a workflow, sketch, or conversation.', icon: Plus, create: () => createDocument({ id: crypto.randomUUID() }) },
    ].map(({ title, text, icon: Icon, create }) => <button key={title} onClick={() => { runtime.replaceDocument(create(), { source: 'template' }); selectNode(null); setTool('select'); close(); requestAnimationFrame(fit); }}><span><Icon size={24} /></span><div><strong>{title}</strong><p>{text}</p></div><ArrowRight size={16} /></button>)}</div></Modal>}
    {dialog === 'help' && <Modal title="More than ink on a diagram." subtitle="A native, connected canvas — no separate drawing editor." close={close}><div className="help-content"><h3>Try the connected workflow</h3><ol><li>Open <strong>Draw</strong> and choose Comment or Pen.</li><li>Choose a workflow step in <strong>Attach to</strong>, then annotate it.</li><li>Switch to Select and drag the step. Its annotations move with it.</li><li>Draw a <strong>Smart arrow</strong> between two unconnected steps. It becomes a real edge.</li><li>Select a drawing and <strong>Promote to workflow step</strong> when an idea becomes actionable.</li></ol><p>Comments support local replies and resolution. This is not multiplayer collaboration.</p><h3>Shortcuts</h3><div className="shortcuts">{[['Commands', '⌘ / Ctrl K'], ['Add a step', 'N'], ['Select / pan', 'V / H'], ['Undo / redo', '⌘Z / ⌘⇧Z'], ['Cancel drawing', 'Esc'], ['Save (storage plugin)', '⌘ / Ctrl S']].map(([title, key]) => <div key={title}><span>{title}</span><kbd>{key}</kbd></div>)}</div><p>Enable Local autosave or export before closing. The current native tools do not reproduce every advanced drawing-editor feature.</p></div></Modal>}
  </div>;
}