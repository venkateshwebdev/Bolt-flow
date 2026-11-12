import { useMemo, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import './source-code.css';

function syntax(source: string, language: string) {
  const name = ({ ts: 'typescript', js: 'javascript', sh: 'bash', 'tsx': 'tsx' } as Record<string, string>)[language] ?? language;
  return Prism.highlight(source, Prism.languages[name] ?? Prism.languages.plain, name);
}
export function HighlightedCode({ source, language = 'tsx' }: { source: string; language?: string }) {
  const html = useMemo(() => syntax(source, language), [source, language]);
  return <code className="source-tokens" dangerouslySetInnerHTML={{ __html: html }} />;
}
/** A native accessible textarea, with a matching highlighted presentation underneath. */
export function SourceCode({ value, label, language = 'tsx', readOnly = false, onChange }: {
  value: string; label: string; language?: string; readOnly?: boolean; onChange?: (value: string) => void;
}) {
  const preview = useRef<HTMLPreElement>(null);
  return <div className="source-editor">
    <pre ref={preview} aria-hidden="true"><HighlightedCode source={value + '\n'} language={language} /></pre>
    <textarea aria-label={label} value={value} readOnly={readOnly} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off"
      onChange={event => onChange?.(event.target.value)} onScroll={event => {
        if (preview.current) { preview.current.scrollTop = event.currentTarget.scrollTop; preview.current.scrollLeft = event.currentTarget.scrollLeft; }
      }} onKeyDown={event => {
        if (event.key !== 'Tab' || readOnly) return;
        // Escape then Tab still leaves the editor; ordinary Tab follows native focus order.
        if (!event.altKey) return;
        event.preventDefault();
        const input = event.currentTarget, start = input.selectionStart, end = input.selectionEnd;
        onChange?.(value.slice(0, start) + '  ' + value.slice(end));
        requestAnimationFrame(() => input.setSelectionRange(start + 2, start + 2));
      }} />
  </div>;
}
