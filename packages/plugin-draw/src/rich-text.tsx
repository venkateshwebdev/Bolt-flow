import { useEffect, useRef, useState } from 'react';
import type { Json } from 'bolt-flow-core';
import { useBolt, useBoltReadOnly } from 'bolt-flow-react';

export type TextRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string; highlight?: string };
export type RichText = { version: 1; blocks: { runs: TextRun[] }[] };
const literalColor = /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\)|[a-z]+)$/i;
export function normalizeRichText(input: unknown, fallback = ''): RichText {
  if (!input || typeof input !== 'object' || (input as RichText).version !== 1 || !Array.isArray((input as RichText).blocks)) return { version: 1, blocks: fallback.split('\n').map(text => ({ runs: [{ text }] })) };
  return { version: 1, blocks: (input as RichText).blocks.slice(0, 10000).map(block => ({ runs: (Array.isArray(block?.runs) ? block.runs : []).flatMap(run => {
    if (!run || typeof run.text !== 'string') return [];
    const safe: TextRun = { text: run.text };
    for (const key of ['bold', 'italic', 'underline', 'strike'] as const) if (run[key] === true) safe[key] = true;
    for (const key of ['color', 'highlight'] as const) if (typeof run[key] === 'string' && literalColor.test(run[key]!)) safe[key] = run[key];
    return [safe];
  }) })) };
}
export const richTextPlain = (value: RichText) => value.blocks.map(block => block.runs.map(run => run.text).join('')).join('\n');
export function RichTextView({ value, fallback = '' }: { value: unknown; fallback?: string }) {
  return <>{normalizeRichText(value, fallback).blocks.map((block, i) => <div key={i}>{block.runs.length ? block.runs.map((run, j) => <span key={j} style={{ fontWeight: run.bold ? 'bold' : undefined, fontStyle: run.italic ? 'italic' : undefined, textDecoration: [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean).join(' ') || undefined, color: run.color, backgroundColor: run.highlight }}>{run.text}</span>) : <br />}</div>)}</>;
}
/** Extract supported marks only. Script/style content and arbitrary HTML attributes are never retained. */
export function richTextFromElement(root: HTMLElement): RichText {
  const blocks: { runs: TextRun[] }[] = [];
  let runs: TextRun[] = [];
  const flush = () => { blocks.push({ runs }); runs = []; };
  const walk = (node: Node, inherited: Omit<TextRun, 'text'> = {}) => {
    if (node.nodeType === 3) { if (node.textContent) runs.push({ text: node.textContent, ...inherited }); return; }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'svg', 'img'].includes(tag)) return;
    if (tag === 'br') { if (node.nextSibling) flush(); return; }
    const block = ['div', 'p', 'li'].includes(tag);
    if (block && runs.length) flush();
    const marks = { ...inherited };
    if (['b', 'strong'].includes(tag) || ['bold', '700'].includes(node.style.fontWeight)) marks.bold = true;
    if (['i', 'em'].includes(tag) || node.style.fontStyle === 'italic') marks.italic = true;
    if (tag === 'u' || node.style.textDecoration.includes('underline')) marks.underline = true;
    if (['s', 'strike', 'del'].includes(tag) || node.style.textDecoration.includes('line-through')) marks.strike = true;
    const color = node.style.color || (tag === 'font' ? node.getAttribute('color') ?? '' : '');
    if (literalColor.test(color)) marks.color = color;
    if (literalColor.test(node.style.backgroundColor)) marks.highlight = node.style.backgroundColor;
    node.childNodes.forEach(child => walk(child, marks));
    if (block) flush();
  };
  root.childNodes.forEach(node => walk(node));
  if (runs.length || !blocks.length) flush();
  return normalizeRichText({ version: 1, blocks });
}
export function richTextFromHtml(html: string): RichText {
  if (typeof document === 'undefined') throw new Error('HTML conversion requires a browser. Use structured rich text on the server.');
  const template = document.createElement('template'); template.innerHTML = html;
  const root = document.createElement('div'); root.append(template.content.cloneNode(true));
  return richTextFromElement(root);
}

export function EditableAnnotationText({ id, data }: { id: string; data: Record<string, unknown> }) {
  const runtime = useBolt(), readOnly = useBoltReadOnly();
  const [editing, setEditing] = useState(false);
  const editor = useRef<HTMLDivElement>(null), wrapper = useRef<HTMLDivElement>(null), range = useRef<Range | null>(null);
  const initial = useRef(normalizeRichText(data.richText, String(data.label ?? '')));
  const locked = readOnly || runtime.getDocument().nodes.find(n => n.id === id)?.locked;
  const remember = () => { const selection = window.getSelection(); if (selection?.rangeCount && editor.current?.contains(selection.anchorNode)) range.current = selection.getRangeAt(0).cloneRange(); };
  const finish = () => {
    if (!editor.current || locked) { setEditing(false); return; }
    const richText = richTextFromElement(editor.current), text = richTextPlain(richText);
    runtime.updateDocument(doc => { const node = doc.nodes.find(n => n.id === id); if (node && !node.locked) { node.data.label = text; node.data.richText = richText as unknown as Json; } }, { source: 'draw.text' });
    setEditing(false); range.current = null;
  };
  useEffect(() => {
    if (!editing) return;
    editor.current?.focus();
    const outside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) finish(); };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [editing, locked]);
  const format = (command: string, value?: string) => {
    editor.current?.focus();
    if (range.current) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range.current); }
    document.execCommand(command, false, value); remember();
  };
  return <div ref={wrapper} className={`bolt-annotation-text ${editing ? 'is-editing nodrag nopan nowheel' : ''}`} onDoubleClick={event => { if (locked) return; event.stopPropagation(); initial.current = normalizeRichText(data.richText, String(data.label ?? '')); setEditing(true); }}>
    {editing ? <>
      <div className="bolt-text-formatting" role="toolbar" aria-label="Text formatting" onPointerDown={e => e.stopPropagation()} onMouseDown={e => { if ((e.target as HTMLElement).closest('button')) e.preventDefault(); }}>
        {([['bold', 'Bold', 'B'], ['italic', 'Italic', 'I'], ['underline', 'Underline', 'U'], ['strikeThrough', 'Strikethrough', 'S']] as const).map(([command, label, icon]) => <button key={command} aria-label={label} onClick={() => format(command)}>{icon}</button>)}
        <label title="Text color">Color<input type="color" aria-label="Selected text color" defaultValue="#252936" onChange={e => format('foreColor', e.target.value)} /></label>
        <label title="Highlight">Highlight<input type="color" aria-label="Selected text highlight" defaultValue="#fde68a" onChange={e => format('hiliteColor', e.target.value)} /></label>
        <button aria-label="Clear text formatting" onClick={() => format('removeFormat')}>Clear</button>
        <button onClick={finish}>Done</button>
      </div>
      <div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-label="Edit annotation text" aria-multiline="true" className="bolt-rich-editor" onMouseUp={remember} onKeyUp={remember}
        onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
        onKeyDown={e => { e.stopPropagation(); if (e.nativeEvent.isComposing) return; if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) { e.preventDefault(); finish(); } }}><RichTextView value={initial.current} /></div>
    </> : <div className="bolt-rich-display"><RichTextView value={data.richText} fallback={String(data.label ?? '')} /></div>}
  </div>;
}
