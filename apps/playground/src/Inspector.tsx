import { useState } from 'react';
import { Check, Copy, Link2, MessageCircle, SlidersHorizontal, Sparkles, Trash2, Unlink, X } from 'lucide-react';
import { useBolt, useBoltSnapshot } from 'bolt-flow-react';
import type { BoltNode, BoltEdge, BoltStyle, Json } from 'bolt-flow-core';
import type { DrawFont } from 'bolt-flow-plugin-draw';
import { appearanceOf, appearanceDefaults, nodeStyle, edgeStyle, type Appearance } from './appearance';

// Keep the inspector usable without loading the optional drawing package.
const fallbackFonts: DrawFont[] = [
  { id: 'normal', label: 'Normal', family: 'Inter, system-ui, sans-serif' },
  { id: 'handwritten', label: 'Handwritten', family: '"Gochi Hand", cursive' },
  { id: 'code', label: 'Code', family: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
];
function FontSelect({ label, value, fonts, onChange }: { label: string; value: string; fonts: DrawFont[]; onChange: (value: string) => void }) {
  return <label className="field-label">{label}<select value={value} onChange={(event) => onChange(event.target.value)}>
    {!fonts.some((font) => font.family === value) && <option value={value}>{value}</option>}
    {fonts.map((font) => <option key={font.family} value={font.family}>{font.label}</option>)}
  </select></label>;
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="color-field"><span>{label}</span><span><input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#7963d2'} onChange={(event) => onChange(event.target.value)} /><code>{value}</code></span></label>;
}
function Range({ label, value, min = 0, max = 40, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<output>{value}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
export function Inspector({ nodeId, edgeId, onClose, onSelect, onMessage, grid, setGrid, minimap, setMinimap, snap, setSnap }: {
  nodeId: string | null; edgeId: string | null; onClose: () => void; onSelect: (id: string | null) => void; onMessage: (message: string) => void;
  grid: boolean; setGrid: (value: boolean) => void; minimap: boolean; setMinimap: (value: boolean) => void; snap: boolean; setSnap: (value: boolean) => void;
}) {
  const runtime = useBolt();
  const { document } = useBoltSnapshot();
  const node = document.nodes.find((item) => item.id === nodeId);
  const edge = document.edges.find((item) => item.id === edgeId);
  const appearance = appearanceOf(document);
  const [reply, setReply] = useState('');
  const annotation = node?.role === 'annotation';
  const textAnnotation = annotation && (node.data.shape === 'text' || node.type === 'bolt-comment');
  const fillableAnnotation = annotation && (['rectangle', 'ellipse', 'diamond'].includes(String(node.data.shape)) || typeof node.data.customPath === 'string');
  const fonts = [...new Map([...fallbackFonts, ...runtime.getContributions<DrawFont[]>('draw.fonts').flat()].map((font) => [font.family, font])).values()];
  const style = { ...nodeStyle(appearance), ...node?.style };
  const connectionStyle = { ...edgeStyle(appearance), ...edge?.style };
  const changeNode = (update: (node: BoltNode) => void, group = 'node') => runtime.updateDocument((draft) => { const item = draft.nodes.find((n) => n.id === nodeId); if (item && !('locked' in item && item.locked)) update(item); }, { source: 'inspector', group: `${nodeId}:${group}` });
  const changeEdge = (update: (edge: BoltEdge) => void, group = 'edge') => runtime.updateDocument((draft) => { const item = draft.edges.find((n) => n.id === edgeId); if (item && !('locked' in item && item.locked)) update(item); }, { source: 'inspector', group: `${edgeId}:${group}` });
  const data = (key: string, value: Json) => changeNode((node) => { node.data[key] = value; if (key === 'label') delete node.data.richText; }, key);
  const nodeCSS = (key: string, value: string | number) => changeNode((node) => { node.style = { ...node.style, [key]: value }; }, key);
  const edgeCSS = (key: string, value: string | number) => changeEdge((edge) => { edge.style = { ...edge.style, [key]: value }; }, key);
  const defaults = (key: keyof Appearance, value: Json) => runtime.updateDocument((draft) => { draft.extensions.appearance = { ...appearanceOf(draft), [key]: value }; }, { source: 'appearance', group: `appearance:${key}` });
  const command = (id: string, payload: unknown) => {
    try { runtime.execute(id, payload); } catch (error) { onMessage(error instanceof Error ? error.message : 'Unable to complete action'); }
  };
  const remove = () => {
    runtime.updateDocument((draft) => {
      if (node) { draft.nodes = draft.nodes.filter((item) => item.id !== node.id); draft.edges = draft.edges.filter((item) => item.source !== node.id && item.target !== node.id); }
      else if (edge) draft.edges = draft.edges.filter((item) => item.id !== edge.id);
    }, { source: 'inspector.delete' });
    onSelect(null);
  };
  return <>
    <div className="inspector-heading"><span><SlidersHorizontal size={15} />{annotation ? 'Annotation' : node ? 'Node properties' : edge ? 'Edge properties' : 'Canvas & defaults'}</span><button className="icon-button" aria-label="Close inspector" onClick={onClose}><X size={17} /></button></div>
    <div className="inspector-scroll">
      {node && <>
        <section className="inspector-section">
          <div className="section-title">{annotation ? 'ON THIS CANVAS' : 'CONTENT'}<span className="pill">{annotation ? String(node.data.shape) : 'NODE'}</span></div>
          <label className="field-label">{node.type === 'bolt-comment' ? 'Comment' : 'Title'}<textarea rows={node.type === 'bolt-comment' ? 3 : 2} value={String(node.data.label ?? '')} onChange={(event) => data('label', event.target.value)} /></label>
          {!annotation && <><label className="field-label">Description<textarea rows={2} value={String(node.data.description ?? '')} onChange={(event) => data('description', event.target.value)} /></label><label className="field-label">Eyebrow<input value={String(node.data.tag ?? '')} onChange={(event) => data('tag', event.target.value)} /></label>
            <label className="field-label">Icon<select value={String(node.data.kind ?? 'idea')} onChange={(event) => data('kind', event.target.value)}>{['idea', 'research', 'design', 'build', 'feedback', 'launch', 'note'].map((kind) => <option key={kind}>{kind}</option>)}</select></label></>}
        </section>
        <section className="inspector-section"><div className="section-title">APPEARANCE</div>
          {annotation ? <>
            <Color label="Ink color" value={String(node.data.color ?? '#7963d2')} onChange={(value) => data('color', value)} />
            <Range label="Stroke width" value={Number(node.data.size ?? 3)} min={1} max={18} onChange={(value) => data('size', value)} />
            {fillableAnnotation && <>
              <Color label="Shape fill" value={String(node.data.fill ?? 'transparent')} onChange={(value) => data('fill', value)} />
              <label className="toggle-row"><span>No fill</span><input type="checkbox" checked={!node.data.fill || node.data.fill === 'transparent' || node.data.fill === 'none'} onChange={(event) => data('fill', event.target.checked ? 'transparent' : '#ede9fe')} /></label>
            </>}
            {textAnnotation && <>
              <FontSelect label="Font family" value={String(node.data.fontFamily ?? fallbackFonts[1].family)} fonts={fonts} onChange={(value) => data('fontFamily', value)} />
              <Range label="Text size" value={Number(node.data.fontSize ?? 22)} min={8} max={200} onChange={(value) => data('fontSize', value)} />
            </>}
          </> : <>
            <Color label="Node background" value={String(style.backgroundColor)} onChange={(value) => nodeCSS('backgroundColor', value)} />
            <Color label="Node text color" value={String(style.color)} onChange={(value) => nodeCSS('color', value)} />
            <Color label="Node border color" value={String(style.borderColor)} onChange={(value) => nodeCSS('borderColor', value)} />
            <Range label="Corner radius" value={Number(style.borderRadius)} max={60} onChange={(value) => nodeCSS('borderRadius', value)} />
            <FontSelect label="Node font family" value={String(style.fontFamily ?? fallbackFonts[0].family)} fonts={fonts} onChange={(value) => nodeCSS('fontFamily', value)} />
            <Range label="Font size" value={Number(style.fontSize)} min={10} max={28} onChange={(value) => nodeCSS('fontSize', value)} />
            <Range label="Border width" value={Number(style.borderWidth)} max={8} onChange={(value) => nodeCSS('borderWidth', value)} />
            <label className="field-label">Border style<select value={String(style.borderStyle)} onChange={(event) => nodeCSS('borderStyle', event.target.value)}><option>solid</option><option>dashed</option><option>dotted</option><option>none</option></select></label>
            <label className="toggle-row"><span>Lock position</span><input type="checkbox" checked={node.draggable === false} onChange={(event) => changeNode((n) => { n.draggable = !event.target.checked; })} /></label>
          </>}
          <div className="two-fields"><label className="field-label">Width<input aria-label="Node width" type="number" min="24" max="2000" value={Math.round(node.width ?? 240)} onChange={(event) => { if (Number(event.target.value) >= 24) changeNode((n) => { n.width = Number(event.target.value); }, 'width'); }} /></label><label className="field-label">Height<input aria-label="Node height" type="number" min="24" max="2000" value={Math.round(node.height ?? 148)} onChange={(event) => { if (Number(event.target.value) >= 24) changeNode((n) => { n.height = Number(event.target.value); }, 'height'); }} /></label></div>
          <Range label="Opacity" value={Number(node.style?.opacity ?? 1)} max={1} step={0.05} onChange={(value) => nodeCSS('opacity', value)} />
          <label className="field-label">CSS class<input placeholder="your-node-class" value={node.className ?? ''} onChange={(event) => changeNode((n) => { n.className = event.target.value; }, 'class')} /></label>
          <button className="text-button" onClick={() => changeNode((n) => { delete n.style; delete n.className; })}>Reset style overrides</button>
        </section>
        {annotation && <section className="inspector-section connected-section"><div className="section-title"><Link2 size={14} />CONNECTED ANNOTATION</div><p>Attach this to a step. It follows that step during dragging, layout, and undo.</p>
          <label className="field-label">Attached workflow node<select aria-label="Annotation attachment" disabled={!runtime.hasPlugin('draw')} value={node.anchor?.nodeId ?? ''} onChange={(event) => command(event.target.value ? 'draw.attach' : 'draw.detach', event.target.value ? { id: node.id, ownerId: event.target.value } : node.id)}><option value="">Free on canvas</option>{document.nodes.filter((n) => n.id !== node.id && !n.hidden && !n.locked).map((n) => <option key={n.id} value={n.id}>{String(n.data.label ?? n.id)}</option>)}</select></label>
          {node.anchor && <button className="text-button" onClick={() => command('draw.detach', node.id)}><Unlink size={13} />Detach</button>}
          <button className="button secondary full-width" disabled={!runtime.hasPlugin('draw')} onClick={() => command('draw.convert', node.id)}><Sparkles size={14} />Promote to workflow step</button>
        </section>}
        {node.type === 'bolt-comment' && <section className="inspector-section"><div className="section-title"><MessageCircle size={14} />DISCUSSION<span className="pill">{node.data.resolved ? 'RESOLVED' : 'OPEN'}</span></div>
          <div className="reply-list">{(Array.isArray(node.data.replies) ? node.data.replies : []).map((raw, index) => { if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.text !== 'string') return null; return <div className="reply" key={index}><small>Local reply · {typeof raw.createdAt === 'string' ? new Date(raw.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown time'}</small><p>{raw.text}</p></div>; })}</div>
          <form onSubmit={(event) => { event.preventDefault(); command('draw.reply', { id: node.id, text: reply }); setReply(''); }}><label className="field-label">Reply<textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Add context to the conversation…" /></label><button className="button primary full-width" disabled={!reply.trim() || !runtime.hasPlugin('draw')}>Add reply</button></form>
          <button className="text-button" onClick={() => command('draw.resolve', node.id)}><Check size={14} />{node.data.resolved ? 'Reopen discussion' : 'Resolve discussion'}</button>
        </section>}
        <section className="inspector-section action-row"><button className="button secondary" onClick={() => {
          const id = crypto.randomUUID(); runtime.updateDocument((draft) => { const copy = structuredClone(node); copy.id = id; copy.position = { x: copy.position.x + 40, y: copy.position.y + 60 }; if (copy.anchor) { copy.anchor.offset.x += 40; copy.anchor.offset.y += 60; } draft.nodes.push(copy); }, { source: 'node.duplicate' }); onSelect(id);
        }}><Copy size={14} />Duplicate</button><button className="button danger" aria-label="Delete selected node" onClick={remove}><Trash2 size={14} /></button></section>
      </>}
      {edge && <>
        <section className="inspector-section"><div className="section-title">CONNECTION<span className="pill">{edge.data?.createdWith === 'connected-ink' ? 'DRAWN → LIVE' : 'EDGE'}</span></div><p className="connection-caption">{String(document.nodes.find((n) => n.id === edge.source)?.data.label)} → {String(document.nodes.find((n) => n.id === edge.target)?.data.label)}</p>
          <label className="field-label">Edge label<input value={edge.label ?? ''} onChange={(event) => changeEdge((item) => { item.label = event.target.value; }, 'label')} /></label>
          <label className="field-label">Edge routing<select aria-label="Edge routing" value={edge.type ?? appearance.edgeType} onChange={(event) => changeEdge((item) => { item.type = event.target.value; })}><option value="smoothstep">Rounded orthogonal</option><option value="default">Bezier curve</option><option value="straight">Straight</option><option value="bolt-waypoint">Editable waypoints</option><option value="step">Orthogonal</option></select></label>
          <Color label="Edge color" value={String(connectionStyle.stroke)} onChange={(value) => changeEdge((item) => { item.style = { ...item.style, stroke: value }; if (item.markerEnd !== false && (item.markerEnd || appearance.edgeArrow)) item.markerEnd = { type: 'arrowclosed', ...item.markerEnd, color: value }; }, 'stroke')} />
          <Range label="Edge width" value={Number(connectionStyle.strokeWidth)} min={1} max={10} step={0.5} onChange={(value) => edgeCSS('strokeWidth', value)} />
          <label className="toggle-row"><span>Dashed edge</span><input type="checkbox" checked={Boolean(connectionStyle.strokeDasharray)} onChange={(event) => edgeCSS('strokeDasharray', event.target.checked ? '8 5' : '')} /></label>
          <label className="toggle-row"><span>Animate edge</span><input type="checkbox" checked={edge.animated ?? appearance.edgeAnimated} onChange={(event) => changeEdge((item) => { item.animated = event.target.checked; })} /></label>
          <label className="toggle-row"><span>Arrowhead</span><input type="checkbox" checked={edge.markerEnd !== undefined ? edge.markerEnd !== false : appearance.edgeArrow} onChange={(event) => changeEdge((item) => { item.markerEnd = event.target.checked ? { type: 'arrowclosed', color: String(connectionStyle.stroke) } : false; })} /></label>
          <Color label="Edge label color" value={String(edge.labelStyle?.fill ?? '#645477')} onChange={(value) => changeEdge((item) => { item.labelStyle = { ...item.labelStyle, fill: value }; }, 'labelColor')} />
          <Range label="Edge opacity" value={Number(edge.style?.opacity ?? 1)} max={1} step={0.05} onChange={(value) => edgeCSS('opacity', value)} />
          <label className="field-label">CSS class<input value={edge.className ?? ''} onChange={(event) => changeEdge((item) => { item.className = event.target.value; }, 'class')} /></label>
          <button className="button danger full-width" onClick={remove}><Trash2 size={14} />Delete connection</button>
        </section>
      </>}
      {!node && !edge && <>
        <section className="inspector-section"><div className="section-title">WORKSPACE</div><label className="field-label">Canvas name<input value={document.name} onChange={(event) => runtime.updateDocument((draft) => { draft.name = event.target.value; }, { source: 'rename', group: 'canvas.name' })} /></label>
          <label className="toggle-row"><span>Dot grid</span><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} /></label><label className="toggle-row"><span>Minimap</span><input type="checkbox" checked={minimap} onChange={(event) => setMinimap(event.target.checked)} /></label><label className="toggle-row"><span>Snap to grid</span><input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} /></label>
        </section>
        <section className="inspector-section"><div className="section-title">NODE DEFAULTS</div><p>Applies to nodes without a per-node override.</p>
          <Color label="Default node background" value={appearance.nodeBackground} onChange={(value) => defaults('nodeBackground', value)} /><Color label="Default node text" value={appearance.nodeColor} onChange={(value) => defaults('nodeColor', value)} /><Color label="Default node border" value={appearance.nodeBorder} onChange={(value) => defaults('nodeBorder', value)} /><Range label="Default node radius" value={appearance.nodeRadius} max={60} onChange={(value) => defaults('nodeRadius', value)} /><Range label="Default node font" value={appearance.nodeFont} min={10} max={28} onChange={(value) => defaults('nodeFont', value)} />
        </section>
        <section className="inspector-section"><div className="section-title">EDGE DEFAULTS</div><Color label="Default edge color" value={appearance.edgeColor} onChange={(value) => defaults('edgeColor', value)} /><Range label="Default edge width" value={appearance.edgeWidth} min={1} max={10} step={0.2} onChange={(value) => defaults('edgeWidth', value)} />
          <label className="field-label">Default routing<select value={appearance.edgeType} onChange={(event) => defaults('edgeType', event.target.value)}><option value="smoothstep">Rounded orthogonal</option><option value="default">Bezier curve</option><option value="straight">Straight</option><option value="bolt-waypoint">Editable waypoints</option><option value="step">Orthogonal</option></select></label>
          <label className="toggle-row"><span>Default animation</span><input type="checkbox" checked={appearance.edgeAnimated} onChange={(event) => defaults('edgeAnimated', event.target.checked)} /></label><label className="toggle-row"><span>Default dashed</span><input type="checkbox" checked={appearance.edgeDashed} onChange={(event) => defaults('edgeDashed', event.target.checked)} /></label>
          <button className="text-button" onClick={() => runtime.updateDocument((draft) => { draft.extensions.appearance = { ...appearanceDefaults }; }, { source: 'appearance.reset' })}>Reset all defaults</button>
        </section>
      </>}
      <div className="sdk-note"><code>nodeTypes · edgeTypes · style</code><p>These controls edit the portable document. The SDK also accepts custom renderers, CSS classes, and React Flow configuration.</p></div>
    </div>
  </>;
}