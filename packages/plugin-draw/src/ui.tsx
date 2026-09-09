import { useRef, useState, useEffect, type PointerEvent } from 'react';
import { useBolt, useBoltSnapshot, useReactFlow, useViewport, NodeResizer, type CanvasToolProps, type NodeProps } from 'bolt-flow-react';
import type { BoltNode, Json } from 'bolt-flow-core';
import { inkPath, getSamples, makeDrawing, defaultSettings, findFlowNode, type Sample, type DrawShape, type InkSettings } from './geometry';
import type { DrawResult } from './index';
import { MousePointer2, Hand, Pencil, Square, Circle, Diamond, Minus, ArrowUpRight, Type, MessageSquare, Eraser, Shapes, SlidersHorizontal } from 'lucide-react';
import { defaultFonts, defaultColors, type DrawFont, type DrawShapeDefinition } from './config';

type ToolProps = CanvasToolProps & { allowed: string[]; defaults?: Partial<InkSettings>; customShapes?: DrawShapeDefinition[]; fonts?: DrawFont[]; colors?: string[] };
function Shape({ node }: { node: Pick<BoltNode, 'data' | 'width' | 'height'> }) {
  const data = node.data;
  const width = Number(data.originalWidth ?? node.width ?? 100), height = Number(data.originalHeight ?? node.height ?? 100);
  const size = Number(data.size ?? 3), color = String(data.color ?? '#7963d2'), fill = String(data.fill ?? 'transparent');
  const points = getSamples(data.points);
  const inset = Math.max(8, size * 2);
  const first = points[0] ?? [inset, inset, 0.5], last = points[points.length - 1] ?? [width - inset, height - inset, 0.5];
  const props = { stroke: color, strokeWidth: size, fill, strokeLinejoin: 'round' as const };
  const head = Math.atan2(last[1] - first[1], last[0] - first[0]);
  const headSize = Math.max(12, size * 4);
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
  </svg>;
}
function Resize({ id, selected }: { id: string; selected: boolean }) {
  const runtime = useBolt();
  return <NodeResizer isVisible={selected} minWidth={24} minHeight={24} color="#8b70df" onResizeEnd={(_event, params) => {
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
    <Resize id={id} selected={selected} />
    {data.shape === 'text' ? <div className="bolt-ink-text" style={{ color: String(data.color), fontSize: Number(data.fontSize ?? 22), fontFamily: String(data.fontFamily ?? defaultSettings.fontFamily) }}>{String(data.label)}</div> : Custom ? <Custom node={{ data: data as Record<string, Json>, width, height }} /> : <Shape node={{ data: data as Record<string, Json>, width, height }} />}
    {node?.anchor && <span className="bolt-anchor-badge" title="Attached to a workflow node">↗ attached</span>}
  </div>;
}
export function CommentNode({ id, data, selected }: NodeProps) {
  const runtime = useBolt();
  const node = runtime.getDocument().nodes.find((item) => item.id === id);
  const replies = Array.isArray(data.replies) ? data.replies.length : 0;
  return <article className={`bolt-comment-node ${selected ? 'is-selected' : ''} ${data.resolved ? 'is-resolved' : ''}`} style={{ borderColor: String(data.color ?? '#d7a540') }}>
    <Resize id={id} selected={selected} />
    <header><span>{node?.anchor ? '↗ ATTACHED COMMENT' : 'COMMENT'}</span><button className="nodrag nopan" aria-label={data.resolved ? 'Reopen comment' : 'Resolve comment'} onClick={(event) => { event.stopPropagation(); runtime.execute('draw.resolve', id); }}>{data.resolved ? '↻' : '✓'}</button></header>
    <p style={{ fontFamily: String(data.fontFamily ?? defaultSettings.fontFamily), fontSize: Number(data.fontSize ?? 22) }}>{String(data.label ?? '')}</p>
    <footer>{data.resolved ? 'Resolved' : 'Open discussion'}<span>{replies} {replies === 1 ? 'reply' : 'replies'}</span></footer>
  </article>;
}

const toolIcons = { select: MousePointer2, pan: Hand, pen: Pencil, rectangle: Square, ellipse: Circle, diamond: Diamond, line: Minus, arrow: ArrowUpRight, text: Type, comment: MessageSquare, eraser: Eraser };
const toolNames: Record<string, string> = { select: 'Select', pan: 'Pan', pen: 'Pen', rectangle: 'Rectangle', ellipse: 'Ellipse', diamond: 'Diamond', line: 'Line', arrow: 'Smart arrow', text: 'Text', comment: 'Comment', eraser: 'Eraser' };
export function DrawingTools({ tool, options, onToolChange, onOptionsChange, allowed, defaults, customShapes = [], fonts = defaultFonts, colors = defaultColors }: ToolProps) {
  const { document } = useBoltSnapshot();
  const [expanded, setExpanded] = useState(false);
  const settings = { ...defaultSettings, ...defaults, ...options } as InkSettings;
  const patch = (key: string, value: Json) => onOptionsChange?.({ ...options, [key]: value });
  return <div className="bolt-draw-tools" aria-label="Native drawing tools">
    <div className="bolt-draw-tool-row" role="toolbar" aria-label="Drawing tool selection">
      {['select', 'pan', ...allowed].map((id) => {
        const custom = customShapes.find((shape) => shape.id === id);
        const name = custom?.label ?? toolNames[id] ?? id;
        const Icon = toolIcons[id as keyof typeof toolIcons] ?? Shapes;
        const value = id === 'select' || id === 'pan' ? id : `draw.${id}`;
        return <button key={id} type="button" aria-label={`${name} tool`} aria-pressed={tool === value} title={name} onClick={() => onToolChange?.(value)}>{custom?.icon ?? <Icon size={18} strokeWidth={1.7} />}</button>;
      })}
      <span className="bolt-tool-divider" />
      <button type="button" aria-label="Drawing settings" aria-expanded={expanded} title="Drawing settings" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={18} /></button>
    </div>
    <div className="bolt-draw-quickbar">
      <span className="bolt-tool-caption">{tool === 'select' ? 'Select & move' : tool === 'pan' ? 'Pan canvas' : customShapes.find((s) => `draw.${s.id}` === tool)?.label ?? toolNames[tool.replace('draw.', '')]}</span>
      <div className="bolt-color-swatches" aria-label="Ink palette">{colors.map((color) => <button key={color} type="button" aria-label={`Ink ${color}`} aria-pressed={settings.color === color} style={{ backgroundColor: color }} onClick={() => patch('color', color)} />)}</div>
      <span className="bolt-tool-help">{tool === 'select' ? 'Drag objects, not the canvas' : tool === 'pan' ? 'Drag to pan · V to select' : settings.keepTool ? 'Keep drawing · Esc to select' : 'Draw once · Esc to cancel'}</span>
    </div>
    {(expanded || tool === 'draw.text' || tool === 'draw.comment') && <div className="bolt-draw-settings">
      <label>Ink<input type="color" aria-label="Drawing color" value={settings.color} onChange={(event) => patch('color', event.target.value)} /></label>
      <label>Width<input aria-label="Drawing width" type="range" min="1" max="18" value={settings.size} onChange={(event) => patch('size', Number(event.target.value))} /><span>{settings.size}</span></label>
      <label>Fill<select aria-label="Shape fill" value={settings.fill} onChange={(event) => patch('fill', event.target.value)}><option value="transparent">None</option><option value="#ede9fe">Lavender</option><option value="#fef3c7">Butter</option><option value="#dbeafe">Sky</option><option value="#dcfce7">Mint</option></select></label>
      <label>Font<select aria-label="Drawing font" value={settings.fontFamily} onChange={(event) => patch('fontFamily', event.target.value)}>{fonts.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label>
      <label>Size<input className="bolt-font-size" aria-label="Drawing font size" type="number" min={8} max={200} value={settings.fontSize} onChange={(event) => { const size = Number(event.target.value); if (size >= 8 && size <= 200) patch('fontSize', size); }} /></label>
      <label className="bolt-anchor-picker">Attach to<select aria-label="Attach new annotations to" value={settings.anchorId} onChange={(event) => patch('anchorId', event.target.value)}><option value="">Canvas (unattached)</option>{document.nodes.filter((node) => node.role !== 'annotation').map((node) => <option value={node.id} key={node.id}>{String(node.data.label ?? node.id)}</option>)}</select></label>
      {tool === 'draw.arrow' && <label><input type="checkbox" checked={settings.smartConnect} onChange={(event) => patch('smartConnect', event.target.checked)} />Connect nodes</label>}
      <label><input type="checkbox" aria-label="Keep drawing tool active" checked={settings.keepTool} onChange={(event) => patch('keepTool', event.target.checked)} />Keep tool</label>
      {(tool === 'draw.text' || tool === 'draw.comment') && <input className="bolt-draw-content" aria-label="New annotation text" placeholder={tool === 'draw.comment' ? 'Write a comment, then click the canvas…' : 'Write text, then click the canvas…'} value={settings.text} onChange={(event) => patch('text', event.target.value)} />}
    </div>}
  </div>;
}
export function DrawingOverlay({ tool, options, onToolChange, onCreated, onMessage, allowed, defaults, customShapes = [] }: ToolProps) {
  const runtime = useBolt();
  const flow = useReactFlow();
  const viewport = useViewport();
  const pointer = useRef<number | null>(null);
  const samples = useRef<Sample[]>([]);
  const [preview, setPreview] = useState<Sample[]>([]);
  const shape = tool.replace('draw.', '');
  const settings = { ...defaultSettings, ...defaults, ...options } as InkSettings;
  const active = tool.startsWith('draw.') && allowed.includes(shape);
  const reset = () => { pointer.current = null; samples.current = []; setPreview([]); };
  useEffect(() => {
    reset();
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { reset(); onToolChange?.('select'); } };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [tool, onToolChange]);
  if (!active) return null;
  const point = (event: { clientX: number; clientY: number; pressure: number; pointerType: string }): Sample => {
    const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: false });
    return [position.x, position.y, event.pointerType === 'pen' ? Math.max(0.1, event.pressure) : 0.5];
  };
  const erase = (sample: Sample) => {
    const candidates = [...flow.getNodes()].reverse();
    const hit = candidates.find((node) => runtime.getDocument().nodes.find((n) => n.id === node.id)?.role === 'annotation' && sample[0] >= node.position.x && sample[1] >= node.position.y && sample[0] <= node.position.x + (node.width ?? 0) && sample[1] <= node.position.y + (node.height ?? 0));
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
      const result = runtime.execute<{ shape: DrawShape; points: Sample[]; settings: InkSettings }, DrawResult>('draw.create', { shape: shape as DrawShape, points: shape === 'pen' ? points : [points[0], points[points.length - 1]], settings });
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
  return <div className={`bolt-draw-overlay nodrag nopan ${shape === 'eraser' ? 'is-eraser' : ''}`} data-testid="drawing-overlay" aria-label={`Canvas ${shape} tool`}
    onPointerDown={(event) => {
      if (event.button !== 0 || pointer.current !== null) return;
      event.preventDefault(); event.stopPropagation();
      pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
      samples.current = [point(event)]; setPreview(samples.current);
      if (shape === 'eraser') erase(samples.current[0]);
    }}
    onPointerMove={(event) => {
      if (pointer.current !== event.pointerId) return;
      event.stopPropagation();
      const sample = point(event);
      if (shape === 'eraser') { erase(sample); return; }
      if (samples.current.length >= 8000) return;
      if (shape === 'pen') {
        const previous = samples.current[samples.current.length - 1];
        if (Math.hypot(sample[0] - previous[0], sample[1] - previous[1]) < 0.6 / viewport.zoom) return;
        samples.current = [...samples.current, sample];
      } else samples.current = [samples.current[0], sample];
      setPreview(samples.current);
    }} onPointerUp={finish} onPointerCancel={reset} onLostPointerCapture={reset}>
    <svg className="bolt-draw-preview"><g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
      {customPreview && <g transform={`translate(${customPreview.position.x},${customPreview.position.y})`}><path d={String(customPreview.data.customPath ?? '')} stroke={settings.color} strokeWidth={settings.size} fill={settings.fill} strokeLinejoin="round" /></g>}
      {preview.length > 0 && shape === 'pen' && <path d={inkPath(preview, settings.size)} fill={settings.color} />}
      {first && end && (shape === 'line' || shape === 'arrow') && <line x1={first[0]} y1={first[1]} x2={end[0]} y2={end[1]} stroke={source && target ? '#2a9d78' : settings.color} strokeWidth={settings.size} strokeDasharray={source && target ? '8 5' : undefined} />}
      {first && end && shape === 'rectangle' && <rect x={Math.min(first[0], end[0])} y={Math.min(first[1], end[1])} width={Math.abs(end[0] - first[0])} height={Math.abs(end[1] - first[1])} rx={6} fill={settings.fill} stroke={settings.color} strokeWidth={settings.size} />}
      {first && end && shape === 'ellipse' && <ellipse cx={(first[0] + end[0]) / 2} cy={(first[1] + end[1]) / 2} rx={Math.abs(end[0] - first[0]) / 2} ry={Math.abs(end[1] - first[1]) / 2} fill={settings.fill} stroke={settings.color} strokeWidth={settings.size} />}
      {first && end && shape === 'diamond' && <polygon points={`${(first[0] + end[0]) / 2},${Math.min(first[1], end[1])} ${Math.max(first[0], end[0])},${(first[1] + end[1]) / 2} ${(first[0] + end[0]) / 2},${Math.max(first[1], end[1])} ${Math.min(first[0], end[0])},${(first[1] + end[1]) / 2}`} fill={settings.fill} stroke={settings.color} strokeWidth={settings.size} strokeLinejoin="round" />}
      {[source, target].filter((node): node is BoltNode => !!node).map((node, index) => <rect key={`${node.id}-${index}`} x={node.position.x - 5} y={node.position.y - 5} width={(node.width ?? 240) + 10} height={(node.height ?? 148) + 10} fill="none" stroke="#2a9d78" strokeWidth={2} rx={14} />)}
    </g></svg>
  </div>;
}