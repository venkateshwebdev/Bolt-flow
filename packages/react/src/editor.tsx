import { useEffect, useState, useRef, type ComponentType, type ReactNode, type RefObject, type CSSProperties } from 'react';
import { editingPlugin, type BoltPlugin, type BoltNode, type Json } from 'bolt-flow-core';
import { BoltCanvas, BoltTools, useBolt, useBoltSnapshot, useBoltReadOnly, useReactFlow, type BoltCanvasProps, type CanvasToolProps } from './index';

export interface BoltAction {
  id: string;
  label: string;
  command?: string;
  payload?: unknown;
  run?: () => unknown;
  shortcut?: string;
  enabled?: boolean;
  icon?: ReactNode;
}
export interface EditorSlotProps { selection: string[]; interaction: CanvasToolProps }
export type EditorSlotName = 'editor.toolbar' | 'editor.inspector' | 'editor.menu' | 'editor.panel' | 'editor.status';
export interface EditorPanel { id: string; order?: number; component: ComponentType<EditorSlotProps> }
export interface EditorUIOptions { id: string; actions?: BoltAction[]; slots?: Partial<Record<EditorSlotName, EditorPanel[]>> }
/** Typed contribution entry point; components and callbacks stay in trusted host code. */
export function editorUIPlugin(options: EditorUIOptions): BoltPlugin {
  return { id: options.id, name: options.id, version: '0.2.0', setup(ctx) {
    const ids = new Set<string>();
    for (const action of options.actions ?? []) {
      if (!action.id || ids.has(action.id) || (!action.run && !action.command)) throw new Error('Invalid or duplicate editor action.');
      ids.add(action.id); ctx.contribute('editor.actions', action);
    }
    for (const [slot, panels] of Object.entries(options.slots ?? {})) {
      const ids = new Set<string>();
      for (const panel of panels) {
        if (!panel.id || ids.has(panel.id)) throw new Error('Duplicate panel contribution.');
        ids.add(panel.id); ctx.contribute(slot, panel);
      }
    }
  } };
}
export function BoltSlot({ name, overrides = {}, ...props }: EditorSlotProps & { name: EditorSlotName; overrides?: Record<string, ComponentType<EditorSlotProps> | false> }) {
  const runtime = useBolt(); useBoltSnapshot();
  const panels = new Map(runtime.getContributions<EditorPanel>(name).map(p => [p.id, p]));
  for (const [id, component] of Object.entries(overrides)) { if (component === false) panels.delete(id); else panels.set(id, { ...panels.get(id), id, component }); }
  return <>{[...panels.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(({ id, component: Component }) => <Component key={id} {...props} />)}</>;
}
export function useBoltActions(overrides: BoltAction[] = [], hidden: string[] = []) {
  const runtime = useBolt(); useBoltSnapshot();
  const actions = new Map(runtime.getContributions<BoltAction>('editor.actions').map(action => [action.id, action]));
  overrides.forEach(action => actions.set(action.id, action));
  return [...actions.values()].filter(action => !hidden.includes(action.id));
}
export function BoltToolbar({ actions = [], hidden, onError, label = 'Editor actions' }: { actions?: BoltAction[]; hidden?: string[]; onError?: (error: unknown) => void; label?: string }) {
  const runtime = useBolt(); const resolved = useBoltActions(actions, hidden);
  return <div className="bolt-editor-toolbar" role="toolbar" aria-label={label}>{resolved.map(action => <button type="button" key={action.id}
    disabled={action.enabled === false || (!!action.command && runtime.commandStatus(action.command, action.payload) !== true)} title={action.shortcut}
    onClick={() => { try { Promise.resolve(action.command ? runtime.execute(action.command, action.payload) : action.run?.()).catch(onError ?? (() => {})); } catch (error) { onError?.(error); } }}>{action.icon}{action.label}</button>)}</div>;
}
export function shortcutMatches(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop();
  const mod = parts.includes('mod');
  return event.key.toLowerCase() === key && (mod ? event.metaKey || event.ctrlKey : event.metaKey === parts.includes('meta') && event.ctrlKey === parts.includes('ctrl')) && event.shiftKey === parts.includes('shift') && event.altKey === parts.includes('alt');
}
/** Shortcuts are scoped to the editor element and ignore typing/IME composition. */
export function useBoltShortcuts(ref: RefObject<HTMLElement | null>, actions: BoltAction[], onError?: (error: unknown) => void) {
  const runtime = useBolt();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || event.isComposing || target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')) return;
      const action = actions.find(a => a.shortcut && shortcutMatches(event, a.shortcut) && a.enabled !== false && (!a.command || runtime.commandStatus(a.command, a.payload) === true));
      if (!action) return;
      event.preventDefault(); event.stopPropagation();
      try { Promise.resolve(action.command ? runtime.execute(action.command, action.payload) : action.run?.()).catch(onError ?? (() => {})); } catch (error) { onError?.(error); }
    };
    element.addEventListener('keydown', handler); return () => element.removeEventListener('keydown', handler);
  }, [ref, actions, runtime, onError]);
}

export interface BoltLayersProps {
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onFocus?: (id: string) => void;
  filter?: (node: BoltNode) => boolean;
  renderLabel?: (node: BoltNode) => ReactNode;
  onError?: (error: unknown) => void;
}
export function BoltLayers({ selectedIds = [], onSelect, onFocus, filter, renderLabel, onError }: BoltLayersProps) {
  const runtime = useBolt(); const { document } = useBoltSnapshot(); const readOnly = useBoltReadOnly();
  const [query, setQuery] = useState('');
  const run = (id: string, payload: unknown) => { try { return runtime.execute(id, payload); } catch (error) { onError?.(error); } };
  const available = (command: string) => !readOnly && runtime.commandStatus(command) === true;
  return <section className="bolt-layers" aria-label="Canvas layers">
    <input aria-label="Find a layer" placeholder="Find a layer…" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="bolt-editor-toolbar" role="toolbar" aria-label="Layer actions">
      <button disabled={selectedIds.length < 2 || !available('editor.group')} onClick={() => run('editor.group', selectedIds)}>Group</button>
      <button disabled={!selectedIds.length || !available('editor.ungroup')} onClick={() => run('editor.ungroup', selectedIds)}>Ungroup</button>
      <button disabled={!selectedIds.length || !available('editor.duplicate')} onClick={() => { const ids = run('editor.duplicate', selectedIds); if (Array.isArray(ids)) onSelect?.(ids); }}>Duplicate</button>
    </div>
    <div className="bolt-layer-items">{document.nodes.filter(n => (!filter || filter(n)) && String(n.data.label ?? n.id).toLowerCase().includes(query.toLowerCase())).map(n => {
      const label = String(n.data.label ?? n.id);
      return <div className="bolt-layer" key={n.id} data-selected={selectedIds.includes(n.id)}>
        <input type="checkbox" aria-label={`Select ${label}`} checked={selectedIds.includes(n.id)} disabled={n.locked || n.hidden} onChange={e => onSelect?.(e.target.checked ? [...selectedIds, n.id] : selectedIds.filter(id => id !== n.id))} />
        <button className="bolt-layer-name" title={label} onClick={() => onFocus?.(n.id)}>{renderLabel?.(n) ?? label}{n.groupId && <small>Grouped</small>}{n.anchor && <small>↳ attached</small>}</button>
        <button aria-label={`${n.hidden ? 'Show' : 'Hide'} ${label}`} disabled={!available('editor.layer')} onClick={() => run('editor.layer', { ids: [n.id], hidden: !n.hidden })}>{n.hidden ? 'Show' : 'Hide'}</button>
        <button aria-label={`${n.locked ? 'Unlock' : 'Lock'} ${label}`} disabled={!available('editor.layer')} onClick={() => run('editor.layer', { ids: [n.id], locked: !n.locked })}>{n.locked ? 'Unlock' : 'Lock'}</button>
      </div>;
    })}</div>
  </section>;
}
export interface InspectorField { key: string; label: string; type?: 'text' | 'number' | 'color' | 'checkbox'; min?: number; max?: number }
export function BoltInspector({ nodeId, fields = [{ key: 'label', label: 'Label' }], children }: { nodeId?: string; fields?: InspectorField[]; children?: ReactNode }) {
  const runtime = useBolt(); const { document } = useBoltSnapshot(); const readOnly = useBoltReadOnly();
  const node = document.nodes.find(n => n.id === nodeId);
  return <section className="bolt-inspector" aria-label="Object properties">{node ? fields.map(field => <label key={field.key}>{field.label}<input type={field.type ?? 'text'} min={field.min} max={field.max} disabled={readOnly || node.locked}
    {...(field.type === 'checkbox' ? { checked: Boolean(node.data[field.key]) } : { value: String(node.data[field.key] ?? '') })}
    onChange={e => { const value: Json = field.type === 'checkbox' ? e.target.checked : field.type === 'number' ? Number(e.target.value) : e.target.value; if (typeof value === 'number' && (!Number.isFinite(value) || (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))) return; runtime.updateDocument(doc => { const target = doc.nodes.find(n => n.id === node.id); if (target) target.data[field.key] = value; }, { source: 'inspector', group: `inspector.${node.id}.${field.key}` }); }} /></label>) : <p>Select an object to edit it.</p>}{children}</section>;
}
export interface BoltEditorProps {
  showTools?: boolean;
  canvas?: BoltCanvasProps;
  actions?: BoltAction[];
  interaction?: CanvasToolProps;
  panels?: Partial<Record<'toolbar' | 'inspector' | 'layers' | 'status', ComponentType<EditorSlotProps> | false>>;
  style?: CSSProperties;
  className?: string;
  onError?: (error: unknown) => void;
}
/** Optional ready-made shell. Use its exported primitives to build an entirely different UI. */
export function BoltEditor({ canvas, actions = [], interaction: controlled, panels = {}, style, className = '', onError, showTools = true }: BoltEditorProps) {
  const runtime = useBolt(), flow = useReactFlow(); useBoltSnapshot();
  const ref = useRef<HTMLDivElement>(null), [selection, setSelection] = useState<string[]>([]), [tool, setTool] = useState('select'), [options, setOptions] = useState<Record<string, Json>>({});
  const interaction = controlled ?? { tool, options, onToolChange: setTool, onOptionsChange: setOptions };
  const props = { selection, interaction };
  const resolved = useBoltActions(actions);
  useBoltShortcuts(ref, resolved, onError);
  const toolbar = panels.toolbar, inspector = panels.inspector, layers = panels.layers, status = panels.status;
  const render = (Component: ComponentType<EditorSlotProps> | false | undefined, fallback: ReactNode) => Component === false ? null : Component ? <Component {...props} /> : fallback;
  return <div ref={ref} data-bolt-editor tabIndex={-1} className={`bolt-editor ${className}`} style={style}>
    <header>{render(toolbar, <BoltToolbar actions={actions} onError={onError} />)}<BoltSlot name="editor.toolbar" {...props} /></header>
    <div className="bolt-editor-body"><aside style={layers === false ? { display: 'none' } : undefined}>{render(layers, <BoltLayers selectedIds={selection} onSelect={setSelection} onFocus={id => { setSelection([id]); void flow.fitView({ nodes: [{ id }], maxZoom: 1.2 }); }} onError={onError} />)}<BoltSlot name="editor.panel" {...props} /></aside>
      <main><BoltCanvas {...canvas} interaction={interaction} selectedNodeIds={selection} onSelectionChange={change => { setSelection(change.nodes.map(n => n.id)); canvas?.onSelectionChange?.(change); }} />{showTools && <div className="bolt-editor-tools"><BoltTools {...interaction} /></div>}</main>
      <aside style={inspector === false ? { display: 'none' } : undefined}>{render(inspector, <BoltInspector nodeId={selection[0]} />)}<BoltSlot name="editor.inspector" {...props} /></aside></div>
    <footer>{render(status, <span>{runtime.getDocument().nodes.length} objects · {runtime.getDocument().edges.length} connections</span>)}<BoltSlot name="editor.status" {...props} /></footer>
  </div>;
}
export { editingPlugin };
