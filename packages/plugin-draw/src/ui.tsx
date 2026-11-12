import { useRef, useState, useEffect, useLayoutEffect, type PointerEvent } from 'react';
import { useBolt, useBoltReadOnly, useBoltSnapshot, useReactFlow, useViewport, NodeResizer, type CanvasToolProps, type NodeProps } from 'bolt-flow-react';
import type { BoltNode, Json } from 'bolt-flow-core';
import { inkPath, getSamples, makeDrawing, defaultSettings, findFlowNode, findAnchorTarget, inkColor, type Sample, type DrawShape, type InkSettings } from './geometry';
import type { DrawResult } from './index';
import { MousePointer2, Hand, Pencil, Square, Circle, Diamond, Minus, ArrowUpRight, Type, MessageSquare, Eraser, Shapes, SlidersHorizontal } from 'lucide-react';
import { EditableAnnotationText } from './rich-text';
import { defaultFonts, defaultColors, type DrawFont, type DrawShapeDefinition } from './config';

type ToolProps = CanvasToolProps & { allowed: string[]; defaults?: Partial<InkSettings>; customShapes?: DrawShapeDefinition[]; fonts?: DrawFont[]; colors?: string[] };
function Shape({ node }: { node: Pick<BoltNode, 'data' | 'width' | 'height'> }) {
  const data = node.data;
  const width = Number(data.originalWidth ?? node.width ?? 100), height = Number(data.originalHeight ?? node.height ?? 100);
  const size = Number(data.size ?? 3), color = inkColor(data.color), fill = !data.fill || data.fill === 'transparent' ? 'none' : String(data.fill);
  const points = getSamples(data.points);
  const inset = Math.max(8, size * 2);
  const first = points[0] ?? [inset, inset, 0.5], last = points[points.length - 1] ?? [width - inset, height - inset, 0.5];
  const props = { stroke: color, strokeWidth: size, fill, strokeLinejoin: 'round' as const };
  const head = Math.atan2(last[1] - first[1], last[0] - first[0]);
  const headSize = Math.max(12, size * 4);
  const x = inset, y = inset, right = width - inset, bottom = height - inset;
  const hitPath = typeof data.customPath === 'string' ? data.customPath : data.shape === 'pen' ? inkPath(points, size)
    : data.shape === 'ellipse' ? `M${x},${height / 2}a${(right - x) / 2},${(bottom - y) / 2} 0 1,0 ${right - x},0a${(right - x) / 2},${(bottom - y) / 2} 0 1,0 ${x - right},0`
    : data.shape === 'diamond' ? `M${width / 2},${y}L${right},${height / 2}L${width / 2},${bottom}L${x},${height / 2}Z`
    : data.shape === 'rectangle' ? `M${x},${y}H${right}V${bottom}H${x}Z` : `M${first[0]},${first[1]}L${last[0]},${last[1]}`;
  return <svg className="bolt-ink-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label={String(data.shape)}>
    {typeof data.customPath === 'string' && <path d={data.customPath} {...props} />}
    {data.shape === 'pen' && <path d={inkPath(points, size)} fill={color} />}
    {data.shape === 'rectangle' && <rect x={inset} y={inset} width={Math.max(1, width - inset * 2)} height={Math.max(1, height - inset * 2)} rx={6} {...props} />}
    {data.shape === 'ellipse' && <ellipse cx={width / 2} cy={height / 2} rx={Math.max(1, width / 2 - inset)} ry={Math.max(1, height / 2 - inset)} {...props} />}
    {data.shape === 'diamond' && <polygon points={`${width / 2},${inset} ${width - inset},${height / 2} ${width / 2},${height - inset} ${inset},${height / 2}`} {...props} />}
    {(data.shape === 'line' || data.shape === 'arrow') && <>
      <line x1={first[0]} y1={first[1]} x2={last[0]} y2={last[1]} {...props} strokeLinecap="round" />
      {data.shape === 'arrow' && <path d={`M${last[0] - headSize * Math.cos(head - 0.5)},${last[1] - headSize * Math.sin(head - 0.5)}L${last[0]},${last[1]}L${last[0] - headSize * Math.cos(head + 0.5)},${last[1] - headSize * Math.sin(head + 0.5)}`} {...props} fill="none" strokeLinecap="round" />}
    </>}
    <path className="bolt-hit-target" d={hitPath} fill="none" stroke="transparent" strokeWidth={16} vectorEffect="non-scaling-stroke" />
  </svg>;
}
function Resize({ id, selected }: { id: string; selected: boolean }) {
  const runtime = useBolt();
  const readOnly = useBoltReadOnly();
  const locked = readOnly || runtime.getDocument().nodes.find(n => n.id === id)?.locked;
  return <NodeResizer isVisible={selected && !locked} minWidth={24} minHeight={24} color="#8b70df" onResizeEnd={(_event, params) => {
    runtime.updateDocument((draft) => {
      const node = draft.nodes.find((item) => item.id === id);
      if (!node) return;
      node.width = params.width; node.height = params.height;
      node.position = { x: params.x, y: params.y };
      if (node.anchor) {
        const owner = draft.nodes.find((item) => item.id === node.anchor!.nodeId);
        if (owner) node.anchor.offset = { x: params.x - owner.position.x, y: params.y - owner.position.y };
      }
    }, { source: 'draw.resize' });
  }} />;
}
export function DrawingNode({ id, data, selected, width, height, customShapes = [] }: NodeProps & { customShapes?: DrawShapeDefinition[] }) {
  const runtime = useBolt();
  const node = runtime.getDocument().nodes.find((item) => item.id === id);
  const Custom = customShapes.find((shape) => shape.id === data.shape)?.component;
  return <div className={`bolt-drawing-node ${selected ? 'is-selected' : ''}`} data-drawing-shape={String(data.shape)}>
    {selected && <AnnotationActions id={id} />}
    <Resize id={id} selected={selected} />
    {data.shape === 'text' ? <div className="bolt-ink-text" style={{ color: inkColor(data.color), fontSize: Number(data.fontSize ?? 22), fontFamily: String(data.fontFamily ?? defaultSettings.fontFamily) }}><EditableAnnotationText id={id} data={data} /></div> : Custom ? <Custom node={{ data: data as Record<string, Json>, width, height }} /> : <Shape node={{ data: data as Record<string, Json>, width, height }} />}
    {node?.anchor && <span className="bolt-anchor-badge" title="Attached to a canvas object">↗ attached</span>}
  </div>;
}
export function CommentNode({ id, data, selected }: NodeProps) {
  const runtime = useBolt();
  const readOnly = useBoltReadOnly();
  const node = runtime.getDocument().nodes.find((item) => item.id === id);
  const replies = Array.isArray(data.replies) ? data.replies.length : 0;
  return <article className={`bolt-comment-node ${selected ? 'is-selected' : ''} ${data.resolved ? 'is-resolved' : ''}`} style={{ borderColor: inkColor(data.color ?? '#d7a540') }}>
    {selected && <AnnotationActions id={id} />}
    <Resize id={id} selected={selected} />
    <header><span>{node?.anchor ? '↗ ATTACHED COMMENT' : 'COMMENT'}</span><button disabled={readOnly || node?.locked} className="nodrag nopan" aria-label={data.resolved ? 'Reopen comment' : 'Resolve comment'} onClick={(event) => { event.stopPropagation(); runtime.execute('draw.resolve', id); }}>{data.resolved ? '↻' : '✓'}</button></header>
    <div className="bolt-comment-text" style={{ fontFamily: String(data.fontFamily ?? defaultSettings.fontFamily), fontSize: Number(data.fontSize ?? 22) }}><EditableAnnotationText id={id} data={data} /></div>
    <footer>{data.resolved ? 'Resolved' : 'Open discussion'}<span>{replies} {replies === 1 ? 'reply' : 'replies'}</span></footer>
  </article>;
}

const toolIcons = { select: MousePointer2, pan: Hand, pen: Pencil, rectangle: Square, ellipse: Circle, diamond: Diamond, line: Minus, arrow: ArrowUpRight, text: Type, comment: MessageSquare, eraser: Eraser };
const toolNames: Record<string, string> = { select: 'Select', pan: 'Pan', pen: 'Pen', rectangle: 'Rectangle', ellipse: 'Ellipse', diamond: 'Diamond', line: 'Line', arrow: 'Smart arrow', text: 'Text', comment: 'Comment', eraser: 'Eraser' };
export function DrawingTools({ readOnly, tool, options, onToolChange, onOptionsChange, allowed, defaults, customShapes = [], fonts = defaultFonts, colors = defaultColors }: ToolProps) {
  const { document } = useBoltSnapshot();
  const [expanded, setExpanded] = useState(false);
  const inheritedReadOnly = useBoltReadOnly();
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scope = toolbar.current?.closest('[data-bolt-editor]');
    if (!scope) return;
    const key = (raw: Event) => {
      const e = raw as KeyboardEvent;
      if (readOnly || inheritedReadOnly || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return;
      const shape = ({ p: 'pen', t: 'text', c: 'ellipse', a: 'arrow' } as Record<string, string>)[e.key.toLowerCase()];
      if (shape && allowed.includes(shape)) { e.preventDefault(); onToolChange?.(`draw.${shape}`); }
    };
    scope.addEventListener('keydown', key); return () => scope.removeEventListener('keydown', key);
  }, [allowed, onToolChange, readOnly, inheritedReadOnly]);
  const settings = { ...defaultSettings, ...defaults, ...options } as InkSettings;
  const textTool = tool === 'draw.text' || tool === 'draw.comment';
  const color = textTool ? settings.textColor || settings.color : settings.color;
  const patch = (key: string, value: Json) => onOptionsChange?.({ ...options, [key === 'color' && textTool ? 'textColor' : key]: value });
  const hidden = Array.isArray(options.hiddenTools) ? options.hiddenTools : [];
  const ordered = Array.isArray(options.toolOrder) ? [...new Set([...options.toolOrder.filter((id): id is string => typeof id === 'string' && allowed.includes(id)), ...allowed])] : allowed;
  const palette = Array.isArray(options.palette) && options.palette.length ? options.palette.filter((color): color is string => typeof color === 'string') : colors;
  return <div ref={toolbar} className="bolt-draw-tools" aria-label="Native drawing tools">
    <div className="bolt-draw-tool-row" role="toolbar" aria-label="Drawing tool selection">
      {['select', 'pan', ...ordered.filter(id => !hidden.includes(id))].map((id) => {
        const custom = customShapes.find((shape) => shape.id === id);
        const name = custom?.label ?? toolNames[id] ?? id;
        const Icon = toolIcons[id as keyof typeof toolIcons] ?? Shapes;
        const value = id === 'select' || id === 'pan' ? id : `draw.${id}`;
        return <button disabled={(readOnly || inheritedReadOnly) && id !== 'select' && id !== 'pan'} key={id} type="button" aria-label={`${name} tool`} aria-pressed={tool === value} title={name} onClick={() => onToolChange?.(value)}>{custom?.icon ?? <Icon size={18} strokeWidth={1.7} />}</button>;
      })}
      <span className="bolt-tool-divider" />
      <button type="button" aria-label="Drawing settings" aria-expanded={expanded} title="Drawing settings" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={18} /></button>
    </div>
    <div className="bolt-draw-quickbar">
      <span className="bolt-tool-caption">{tool === 'select' ? 'Select & move' : tool === 'pan' ? 'Pan canvas' : customShapes.find((s) => `draw.${s.id}` === tool)?.label ?? toolNames[tool.replace('draw.', '')]}</span>
      <div className="bolt-color-swatches" aria-label="Ink palette">{palette.map((swatch) => <button key={swatch} type="button" aria-label={`Ink ${swatch}`} aria-pressed={color === swatch} style={{ backgroundColor: inkColor(swatch) }} onClick={() => patch('color', swatch)} />)}</div>
      <span className="bolt-tool-help">{tool === 'select' ? 'Drag objects, not the canvas' : tool === 'pan' ? 'Drag to pan · V to select' : settings.keepTool ? 'Keep drawing · Esc to select' : 'Draw once · Esc to cancel'}</span>
    </div>
    {(expanded || tool === 'draw.text' || tool === 'draw.comment') && <div className="bolt-draw-settings">
      <label>Ink<input type="color" aria-label="Drawing color" value={color === 'auto' ? '#252936' : color} onChange={(event) => patch('color', event.target.value)} /></label>
      <button type="button" onClick={() => patch('color', 'auto')} aria-pressed={color === 'auto'}>Auto color</button>
      <label>Opacity<input aria-label="Drawing opacity" type="range" min="0.1" max="1" step="0.05" value={settings.opacity} onChange={e => patch('opacity', Number(e.target.value))} /></label>
      <label>Width<input aria-label="Drawing width" type="range" min="1" max="18" value={settings.size} onChange={(event) => patch('size', Number(event.target.value))} /><span>{settings.size}</span></label>
      <label>Fill<select aria-label="Shape fill" value={settings.fill} onChange={(event) => patch('fill', event.target.value)}><option value="transparent">None</option><option value="#ede9fe">Lavender</option><option value="#fef3c7">Butter</option><option value="#dbeafe">Sky</option><option value="#dcfce7">Mint</option></select></label>
      <label>Font<select aria-label="Drawing font" value={settings.fontFamily} onChange={(event) => patch('fontFamily', event.target.value)}>{fonts.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label>
      <label>Size<input className="bolt-font-size" aria-label="Drawing font size" type="number" min={8} max={200} value={settings.fontSize} onChange={(event) => { const size = Number(event.target.value); if (size >= 8 && size <= 200) patch('fontSize', size); }} /></label>
      <label className="bolt-anchor-picker">Attach to<select aria-label="Attach new annotations to" value={settings.anchorId} onChange={(event) => patch('anchorId', event.target.value)}><option value="">Canvas (unattached)</option>{document.nodes.filter((node) => !node.hidden && !node.locked).map((node) => <option value={node.id} key={node.id}>{String(node.data.label ?? node.id)}</option>)}</select></label>
      {tool === 'draw.arrow' && <label><input type="checkbox" checked={settings.smartConnect} onChange={(event) => patch('smartConnect', event.target.checked)} />Connect nodes</label>}
      <label><input type="checkbox" checked={!!options.showAttachments} onChange={e => patch('showAttachments', e.target.checked)} />Attachment links</label>
      <label><input type="checkbox" aria-label="Keep drawing tool active" checked={settings.keepTool} onChange={(event) => patch('keepTool', event.target.checked)} />Keep tool</label>
      {(tool === 'draw.text' || tool === 'draw.comment') && <input className="bolt-draw-content" aria-label="New annotation text" placeholder={tool === 'draw.comment' ? 'Write a comment, then click the canvas…' : 'Write text, then click the canvas…'} value={settings.text} onChange={(event) => patch('text', event.target.value)} />}
    </div>}
  </div>;
}
export function DrawingOverlay({ readOnly, tool, options, onToolChange, onCreated, onMessage, allowed, defaults, customShapes = [] }: ToolProps) {
  const runtime = useBolt();
  const flow = useReactFlow();
  const viewport = useViewport();
  const pointer = useRef<number | null>(null);
  const attach = useRef(false);
  const samples = useRef<Sample[]>([]);
  const [preview, setPreview] = useState<Sample[]>([]);
  const shape = tool.replace('draw.', '');
  const settings = { ...defaultSettings, ...defaults, ...options } as InkSettings;
  const active = !readOnly && tool.startsWith('draw.') && allowed.includes(shape);
  const reset = () => { pointer.current = null; samples.current = []; setPreview([]); };
  // Only an actual tool/capability change cancels a gesture. Hosts routinely
  // replace inline callbacks during pointer moves; that must not erase ink.
  // Clear before paint so a delayed passive effect cannot cancel a new stroke.
  useLayoutEffect(() => { reset(); }, [tool, active]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (!event.defaultPrevented && event.key === 'Escape') { reset(); onToolChange?.('select'); } };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [onToolChange]);
  if (!active) return null;
  const point = (event: { clientX: number; clientY: number; pressure: number; pointerType: string }): Sample => {
    const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: false });
    return [position.x, position.y, event.pointerType === 'pen' ? Math.max(0.1, event.pressure) : 0.5];
  };
  const erase = (sample: Sample) => {
    const candidates = [...flow.getNodes()].reverse();
    const hit = candidates.find((node) => runtime.getDocument().nodes.find((n) => n.id === node.id)?.role === 'annotation' && !node.hidden && !runtime.getDocument().nodes.find(n => n.id === node.id)?.locked && sample[0] >= node.position.x && sample[1] >= node.position.y && sample[0] <= node.position.x + (node.width ?? 0) && sample[1] <= node.position.y + (node.height ?? 0));
    if (hit) runtime.execute('draw.erase', hit.id);
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    event.stopPropagation();
    const points = [...samples.current];
    if (shape !== 'eraser') points.push(point(event));
    reset();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (shape === 'eraser') return;
    try {
      const center = points.length ? { x: (points[0][0] + points[points.length - 1][0]) / 2, y: (points[0][1] + points[points.length - 1][1]) / 2 } : { x: 0, y: 0 };
      const owner = attach.current && settings.attachOnShift ? findAnchorTarget(runtime.getDocument().nodes, center) : undefined;
      const result = runtime.execute<{ shape: DrawShape; points: Sample[]; settings: InkSettings }, DrawResult>('draw.create', { shape: shape as DrawShape, points: shape === 'pen' ? points : [points[0], points[points.length - 1]], settings: owner ? { ...settings, anchorId: owner.id, smartConnect: false } : settings });
      onCreated?.(result.id, result.kind);
      if (result.connected) onMessage?.('Ink → connection. This arrow is now a real workflow edge.');
      if (!settings.keepTool || shape === 'comment' || shape === 'text' || result.connected) onToolChange?.('select');
    } catch (error) { onMessage?.(error instanceof Error ? error.message : 'Unable to create drawing.'); }
  };
  const first = preview[0], end = preview[preview.length - 1];
  let customPreview: ReturnType<typeof makeDrawing> | undefined;
  const custom = customShapes.find((item) => item.id === shape);
  if (custom && first && end) {
    try {
      customPreview = makeDrawing(shape, [first, end], settings, 'preview');
      customPreview.data.customPath = custom.path({ width: customPreview.width!, height: customPreview.height!, size: settings.size });
    } catch { /* A failing host preview must not crash the entire canvas. Creation reports the error. */ }
  }
  const source = first && shape === 'arrow' && settings.smartConnect ? findFlowNode(runtime.getDocument().nodes, { x: first[0], y: first[1] }) : undefined;
  const target = end && shape === 'arrow' && settings.smartConnect ? findFlowNode(runtime.getDocument().nodes, { x: end[0], y: end[1] }) : undefined;
  const anchorTarget = attach.current && first && end ? findAnchorTarget(runtime.getDocument().nodes, { x: (first[0] + end[0]) / 2, y: (first[1] + end[1]) / 2 }) : undefined;
  return <div className={`bolt-draw-overlay nodrag nopan ${shape === 'eraser' ? 'is-eraser' : ''}`} data-testid="drawing-overlay" aria-label={`Canvas ${shape} tool`}
    onPointerDown={(event) => {
      if (event.button !== 0 || pointer.current !== null) return;
      event.preventDefault(); event.stopPropagation();
      attach.current = event.shiftKey;
      pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
      samples.current = [point(event)]; setPreview(samples.current);
      if (shape === 'eraser') erase(samples.current[0]);
    }}
    onPointerMove={(event) => {
      if (pointer.current !== event.pointerId) return;
      event.stopPropagation();
      // Browsers may deliver several fast stylus/mouse samples as one event.
      // Preserve those samples, including excursions that return to the start.
      const events = [...(event.nativeEvent.getCoalescedEvents?.() ?? []), event];
      const next = [...samples.current];
      for (const entry of events) {
        const sample = point(entry);
        if (shape === 'eraser') { erase(sample); continue; }
        if (shape !== 'pen') { next.splice(1, next.length, sample); continue; }
        if (next.length >= 8000) break;
        const previous = next[next.length - 1];
        if (Math.hypot(sample[0] - previous[0], sample[1] - previous[1]) >= 0.6 / viewport.zoom) next.push(sample);
      }
      if (shape === 'eraser') return;
      samples.current = next;
      setPreview(samples.current);
    }} onPointerUp={finish}
    onPointerCancel={event => { if (pointer.current === event.pointerId) reset(); }}
    onLostPointerCapture={event => { if (pointer.current === event.pointerId) reset(); }}>
    <svg className="bolt-draw-preview"><g opacity={settings.opacity} transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
      {customPreview && <g transform={`translate(${customPreview.position.x},${customPreview.position.y})`}><path d={String(customPreview.data.customPath ?? '')} stroke={inkColor(settings.color)} strokeWidth={settings.size} fill={settings.fill} strokeLinejoin="round" /></g>}
      {preview.length > 0 && shape === 'pen' && <path d={inkPath(preview, settings.size)} fill={inkColor(settings.color)} />}
      {first && end && (shape === 'line' || shape === 'arrow') && <line x1={first[0]} y1={first[1]} x2={end[0]} y2={end[1]} stroke={source && target ? '#2a9d78' : inkColor(settings.color)} strokeWidth={settings.size} strokeDasharray={source && target ? '8 5' : undefined} />}
      {first && end && shape === 'rectangle' && <rect x={Math.min(first[0], end[0])} y={Math.min(first[1], end[1])} width={Math.abs(end[0] - first[0])} height={Math.abs(end[1] - first[1])} rx={6} fill={settings.fill} stroke={inkColor(settings.color)} strokeWidth={settings.size} />}
      {first && end && shape === 'ellipse' && <ellipse cx={(first[0] + end[0]) / 2} cy={(first[1] + end[1]) / 2} rx={Math.abs(end[0] - first[0]) / 2} ry={Math.abs(end[1] - first[1]) / 2} fill={settings.fill} stroke={inkColor(settings.color)} strokeWidth={settings.size} />}
      {first && end && shape === 'diamond' && <polygon points={`${(first[0] + end[0]) / 2},${Math.min(first[1], end[1])} ${Math.max(first[0], end[0])},${(first[1] + end[1]) / 2} ${(first[0] + end[0]) / 2},${Math.max(first[1], end[1])} ${Math.min(first[0], end[0])},${(first[1] + end[1]) / 2}`} fill={settings.fill} stroke={inkColor(settings.color)} strokeWidth={settings.size} strokeLinejoin="round" />}
      {[source, target, anchorTarget].filter((node): node is BoltNode => !!node).map((node, index) => <rect key={`${node.id}-${index}`} x={node.position.x - 5} y={node.position.y - 5} width={(node.width ?? 240) + 10} height={(node.height ?? 148) + 10} fill="none" stroke="#2a9d78" strokeWidth={2} rx={14} />)}
    </g></svg>
  </div>;
}
function AnnotationActions({ id }: { id: string }) {
  const runtime = useBolt(), readOnly = useBoltReadOnly();
  const { document } = useBoltSnapshot();
  const node = document.nodes.find(n => n.id === id);
  const [error, setError] = useState('');
  if (!node || node.locked || readOnly) return null;
  const run = (command: string, payload: unknown) => { try { runtime.execute(command, payload); setError(''); } catch (error) { setError(error instanceof Error ? error.message : 'Action failed'); } };
  const excludes = new Set([id]);
  let changed = true;
  while (changed) { changed = false; for (const n of document.nodes) if (n.anchor && excludes.has(n.anchor.nodeId) && !excludes.has(n.id)) { excludes.add(n.id); changed = true; } }
  return <details className="bolt-annotation-actions nodrag nopan nowheel" onPointerDown={e => e.stopPropagation()}>
    <summary aria-label="Annotation actions">Edit drawing</summary>
    <div role="toolbar" aria-label="Selected annotation actions">
      <label>Color<input type="color" aria-label="Selected annotation color" value={String(node.data.color) === 'auto' ? '#252936' : String(node.data.color ?? '#7963d2')} onChange={e => run('draw.style', { id, color: e.target.value })} /></label>
      <button onClick={() => run('draw.style', { id, color: 'auto' })}>Auto</button>
      <label>Width<input type="range" aria-label="Selected stroke width" min="1" max="24" value={Number(node.data.size ?? 3)} onChange={e => run('draw.style', { id, size: Number(e.target.value) })} /></label>
      <label>Opacity<input type="range" aria-label="Selected annotation opacity" min="0.1" max="1" step="0.05" value={Number(node.style?.opacity ?? 1)} onChange={e => run('draw.style', { id, opacity: Number(e.target.value) })} /></label>
      <label>Attach<select aria-label="Drawing attachment target" value={node.anchor?.nodeId ?? ''} onChange={e => run(e.target.value ? 'draw.attach' : 'draw.detach', e.target.value ? { id, ownerId: e.target.value } : id)}><option value="">Free on canvas</option>{document.nodes.filter(n => !excludes.has(n.id) && !n.hidden && !n.locked).map(n => <option key={n.id} value={n.id}>{String(n.data.label ?? n.id)}</option>)}</select></label>
      <button disabled={!runtime.hasCommand('editor.duplicate')} onClick={() => run('editor.duplicate', [id])}>Duplicate</button>
      <button disabled={!runtime.hasCommand('editor.delete')} onClick={() => run('editor.delete', [id])}>Delete</button>
      {error && <span role="alert">{error}</span>}
    </div>
  </details>;
}
export function AnchorLinks({ options }: CanvasToolProps) {
  const { document } = useBoltSnapshot();
  const viewport = useViewport();
  if (!options.showAttachments) return null;
  return <svg className="bolt-anchor-links" aria-label="Annotation attachments"><g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>{document.nodes.filter(n => n.anchor && !n.hidden).map(node => {
    const owner = document.nodes.find(n => n.id === node.anchor!.nodeId && !n.hidden);
    if (!owner) return null;
    return <line key={node.id} x1={owner.position.x + (owner.width ?? 240) / 2} y1={owner.position.y + (owner.height ?? 100) / 2} x2={node.position.x + (node.width ?? 100) / 2} y2={node.position.y + (node.height ?? 80) / 2} stroke="var(--bolt-accent, #7963d2)" strokeWidth={1.5} strokeDasharray="5 5" />;
  })}</g></svg>;
}
