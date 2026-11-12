import { useEffect, useRef, useState } from 'react';
import type { RunnableExample } from './examples';
import { ViewTabs, type ExampleView } from './ViewTabs';
import './sandbox.css';
import { SourceCode } from '../SourceCode';

export default function ExampleSandbox({ example, label, view, onViewChange, onStop }: { example: RunnableExample; label: string; view: ExampleView; onViewChange: (view: ExampleView) => void; onStop: () => void }) {
  const [code, setCode] = useState(example.code), [css, setCss] = useState(example.css);
  const [file, setFile] = useState('code');
  const [run, setRun] = useState(0), [status, setStatus] = useState('Loading sandbox…');
  const [logs, setLogs] = useState<string[]>([]), [error, setError] = useState('');
  const [html, setHtml] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  // Edits do not rerun or discard the current example until Run is pressed.
  const draft = useRef({ code, css }); draft.current = { code, css };
  useEffect(() => {
    const session = crypto.randomUUID();
    const input = { ...draft.current };
    let disposed = false;
    setStatus('Loading sandbox…'); setError(''); setLogs([]); setHtml('');
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.source !== 'bolt-example' || event.data.session !== session) return;
      const { type, value } = event.data;
      if (type === 'boot') { frame.current?.contentWindow?.postMessage({ source: 'bolt-example-host', session, ...input }, '*'); setStatus('Running…'); }
      if (type === 'ready') setStatus('Running');
      if (type === 'error') { setError(String(value)); setStatus('Example error'); }
      if (type === 'log') setLogs(current => [...current.slice(-19), String(value)]);
    };
    window.addEventListener('message', receive);
    void import('virtual:example-sandbox').then(({ default: bundle }) => {
      if (disposed) return;
      const script = bundle.js.replace(/<\/script/gi, '<\\/script');
      const styles = bundle.css.replace(/<\/style/gi, '<\\/style');
      setHtml(`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src data: blob:"><style>${styles}</style></head><body><div id="root"></div><script>window.__exampleSession=${JSON.stringify(session)};${script}</script></body></html>`);
    }).catch(error => { if (!disposed) { setError(String(error)); setStatus('Could not load sandbox'); } });
    return () => { disposed = true; window.removeEventListener('message', receive); };
  }, [run]);
  return <section className="example-sandbox" aria-label={`Sandbox: ${label}`}>
    <div className="sandbox-toolbar">
      <ViewTabs value={view} onChange={onViewChange} label={label} />
      <span role="status">{status}</span>
      <div className="sandbox-actions">
        <button className="sandbox-run" onClick={() => { if (view === 'code') onViewChange('preview'); setRun(n => n + 1); }}>Run</button>
        <button onClick={() => { draft.current = { code: example.code, css: example.css }; setCode(example.code); setCss(example.css); setRun(n => n + 1); }}>Reset</button>
        <button onClick={onStop} title="Stop this sandbox and return to the documentation excerpt">Stop</button>
      </div>
    </div>
    <div role="tabpanel" id={`${label}-panel`} aria-labelledby={`${label}-tab-${view}`} className={`sandbox-workspace sandbox-${view}`}>
      <div className="sandbox-source-pane" hidden={view === 'preview'}>
        <div className="sandbox-pane-heading"><select aria-label="Source file" value={file} onChange={event => setFile(event.target.value)}><option value="code">Example.tsx</option><option value="css">Styles.css</option>{Object.keys(example.support ?? {}).map(name => <option key={name} value={name}>{name}</option>)}</select><span>{example.support?.[file] ? 'Shared setup · Read only' : 'Editable · Run to apply'}</span></div>
        <SourceCode label={file === 'code' ? 'Runnable example code' : file === 'css' ? 'Example CSS' : file} value={example.support?.[file] ?? (file === 'code' ? code : css)} language={file === 'code' || file.endsWith('.tsx') ? 'tsx' : 'css'} readOnly={!!example.support?.[file]} onChange={file === 'code' ? setCode : setCss} />
      </div>
      <div className="sandbox-preview-pane" hidden={view === 'code'}>
        <div className="sandbox-pane-heading"><span>Live preview</span><span>Interactive</span></div>
        {html && <iframe ref={frame} title={`Interactive example: ${label}`} sandbox="allow-scripts allow-downloads" srcDoc={html} className="sandbox-frame" />}
      </div>
    </div>
    <details className="sandbox-about"><summary>About this example</summary><p className="sandbox-note">{example.note}</p></details>
    {error && <pre className="sandbox-error" role="alert">{error}</pre>}
    {logs.length > 0 && <details className="sandbox-output" open><summary>Console output</summary><pre>{logs.join('\n')}</pre></details>}
  </section>;
}
