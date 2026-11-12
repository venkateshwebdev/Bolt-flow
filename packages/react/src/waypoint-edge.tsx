import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { useBolt, useBoltReadOnly, useReactFlow } from './index';
import type { Json, Point } from 'bolt-flow-core';
export function BoltWaypointEdge({ id, sourceX, sourceY, targetX, targetY, data, selected, style, markerStart, markerEnd, label }: EdgeProps) {
  const runtime = useBolt(), flow = useReactFlow(), readOnly = useBoltReadOnly();
  const [draft, setDraft] = useState<Point[] | null>(null);
  const stored = Array.isArray(data?.points) ? data.points.filter((p): p is Point => !!p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
  const points = draft ?? stored;
  const path = [{ x: sourceX, y: sourceY }, ...points, { x: targetX, y: targetY }].map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const commit = (points: Point[]) => {
    if (readOnly) return;
    runtime.updateDocument(doc => { const edge = doc.edges.find(e => e.id === id); if (edge) edge.data = { ...edge.data, points: points as unknown as Json }; }, { source: 'edge.route' });
    setDraft(null);
  };
  return <>
    <g onDoubleClick={e => { if (readOnly) return; e.stopPropagation(); commit([...points, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })]); }}><BaseEdge id={id} path={path} style={style} markerStart={markerStart} markerEnd={markerEnd} label={label} labelX={(sourceX + targetX) / 2} labelY={(sourceY + targetY) / 2} /></g>
    {selected && !readOnly && <EdgeLabelRenderer>{points.map((point, index) => <button key={index} className="bolt-waypoint nodrag nopan" aria-label={`Waypoint ${index + 1}`} title="Drag waypoint. Double-click to remove."
      style={{ transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)` }} onDoubleClick={e => { e.stopPropagation(); commit(points.filter((_, i) => i !== index)); }}
      onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; const position = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }); setDraft(points.map((p, i) => i === index ? position : p)); }}
      onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { const position = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }); e.currentTarget.releasePointerCapture(e.pointerId); commit(points.map((p, i) => i === index ? position : p)); } }}
      onPointerCancel={() => setDraft(null)} onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); commit(points.filter((_, i) => i !== index)); } }} />)}</EdgeLabelRenderer>}
  </>;
}
