import { useMemo, useState, useSyncExternalStore } from 'react';
import { useBolt } from 'bolt-flow-react';
import type { BoltDocument } from 'bolt-flow-core';
import type { PersistenceController } from 'bolt-flow-plugin-storage';
import { Copy, Download, FileCode2 } from 'lucide-react';
import { playgroundFiles, type CodeSettings } from './playground-code';
import './playground-code.css';
import { SourceCode } from './SourceCode';
const noSubscribe = () => () => {};
const noSnapshot = () => null;

export function PlaygroundCode({ document, settings, pluginIds }: { document: BoltDocument; settings: CodeSettings; pluginIds: string[] }) {
  const runtime = useBolt();
  const persistence = runtime.getContributions<PersistenceController>('storage.controller')[0];
  const saveState = useSyncExternalStore(persistence?.subscribe ?? noSubscribe, persistence?.getSnapshot ?? noSnapshot, noSnapshot);
  const files = useMemo(() => playgroundFiles(document, settings, pluginIds, saveState?.mode), [document, settings, pluginIds, saveState?.mode]);
  const [selected, setSelected] = useState('App.tsx'), [status, setStatus] = useState('');
  const file = files[selected] === undefined ? 'App.tsx' : selected;
  const source = files[file];
  const copy = async () => { try { await navigator.clipboard.writeText(source); setStatus(`Copied ${file}`); } catch { setStatus('Select the source and copy it manually.'); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' }));
    const link = window.document.createElement('a'); link.href = url; link.download = file; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Downloaded ${file}`);
  };
  return <section className="playground-code" aria-label="Live playground code">
    <header className="playground-code-header"><div><strong><FileCode2 size={17} />Your editor, in code</strong><p>Live React example with your canvas, colors, tools, and settings. Changes here follow the playground.</p></div><span className="code-live"><span className="status-dot" />Live</span></header>
    <div className="playground-code-toolbar"><label>File<select aria-label="Generated source file" value={file} onChange={event => { setSelected(event.target.value); setStatus(''); }}>{Object.keys(files).map(name => <option key={name}>{name}</option>)}</select></label><span className="code-file-count">{Object.keys(files).length} files</span><div><button onClick={() => void copy()}><Copy size={14} />Copy file</button><button onClick={download}><Download size={14} />Download file</button></div></div>
    <SourceCode label="Generated playground code" value={source} language={file.split('.').pop()} readOnly />
    <footer><span>Generated from the current playground · Read only</span><span role="status">{status}</span></footer>
  </section>;
}
