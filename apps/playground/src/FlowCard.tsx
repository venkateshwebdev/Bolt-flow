import { Handle, Position, type NodeProps, type Node } from 'bolt-flow-react';
import type { Json } from 'bolt-flow-core';
import { Lightbulb, Search, Palette, Code2, MessageCircle, Rocket, BookOpen, Box, type LucideIcon } from 'lucide-react';
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
export const nodeTypes = { bolt: FlowCard };
