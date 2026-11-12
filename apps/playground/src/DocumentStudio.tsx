import { useState } from 'react';
import { parseCanvas, serializeCanvas, insertCanvas, type BoltDocument } from 'bolt-flow-core';
import { useBolt } from 'bolt-flow-react';
export function DocumentStudio({ onApplied }: { onApplied: () => void }) {
  const runtime = useBolt();
  const [text, setText] = useState(() => serializeCanvas(runtime.getDocument()));
  const [preview, setPreview] = useState<BoltDocument | null>(null), [error, setError] = useState('');
  const validate = () => { try { setPreview(parseCanvas(text)); setError(''); } catch (error) { setPreview(null); setError(error instanceof Error ? error.message : 'Invalid canvas'); } };
  return <div className="document-studio"><p>Paste a generated canvas or edit this document. Preview validates the JSON before you apply it. Use Save when you want to keep the result.</p>
    <textarea aria-label="Canvas JSON" spellCheck={false} value={text} onChange={e => { setText(e.target.value); setPreview(null); }} />
    <div className="studio-actions"><button className="button secondary" onClick={validate}>Preview JSON</button>
      <button className="button secondary" disabled={!preview} onClick={() => { if (!preview) return; const result = insertCanvas(runtime.getDocument(), preview); runtime.replaceDocument(result.document, { source: 'generation.insert' }); onApplied(); }}>Insert objects</button>
      <button className="button primary" disabled={!preview} onClick={() => { if (!preview) return; runtime.replaceDocument(preview, { source: 'generation.replace' }); onApplied(); }}>Replace canvas</button></div>
    {preview && <p role="status">Valid canvas: {preview.nodes.length} objects, {preview.edges.length} connections. Schema version {preview.schemaVersion}.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
