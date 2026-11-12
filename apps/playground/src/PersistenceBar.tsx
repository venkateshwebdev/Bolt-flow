import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useBolt, useBoltSnapshot, useReactFlow } from 'bolt-flow-react';
import { ChevronDown, Save } from 'lucide-react';
import type { PersistenceController } from 'bolt-flow-plugin-storage';
const noSubscribe = () => () => {};
const noSnapshot = () => null;
export function PersistenceBar({ enable, notify, rememberView, setRememberView }: { enable: () => Promise<boolean>; notify: (message: string) => void; rememberView: boolean; setRememberView: (value: boolean) => void }) {
  const runtime = useBolt(), flow = useReactFlow(); useBoltSnapshot();
  const controller = runtime.getContributions<PersistenceController>('storage.controller')[0];
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscribe, controller?.getSnapshot ?? noSnapshot, noSnapshot);
  const [autosaveRequested, setAutosaveRequested] = useState<boolean | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { const outside = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside); }, []);
  const ensure = async () => {
    if (!runtime.hasPlugin('storage') && !await enable()) return undefined;
    return runtime.getContributions<PersistenceController>('storage.controller')[0];
  };
  const save = async () => {
    const controller = await ensure(); if (!controller) return;
    runtime.updateDocument(doc => { if (rememberView) doc.view = flow.getViewport(); else delete doc.view; }, { source: 'view.save' });
    if (await controller.save()) notify(controller.getSnapshot().dirty ? 'Saved the submitted version. Newer edits are still unsaved.' : 'Canvas saved in this browser.');
  };
  const load = async () => {
    const controller = await ensure(); if (!controller) return;
    if (controller.getSnapshot().dirty && !window.confirm('Replace this canvas with the saved version? Unsaved changes will be lost.')) return;
    if (await controller.load({ discardChanges: true })) {
      // Identical document JSON emits no change event, but Open still restores its view.
      const view = runtime.getDocument().view;
      if (view) await flow.setViewport(view, { duration: 1 }); else await flow.fitView({ padding: .13, duration: 1 });
      notify('Saved canvas opened.');
    }
  };
  return <div className="persistence-bar" aria-label="Canvas persistence">
    <span role="status" className={`save-state ${state?.error ? 'has-error' : ''}`}>{state?.error ?? (state?.status === 'saved' ? 'Saved in this browser' : state?.status === 'loading' ? 'Opening…' : state?.status === 'saving' ? 'Saving…' : 'Unsaved changes')}</span>
    <button className="button primary" aria-label="Save canvas" disabled={state?.status === 'saving' || state?.status === 'loading'} onClick={() => void save()}><Save size={14} />{state?.status === 'saving' ? 'Saving…' : 'Save'}</button>
    <details className="save-options" ref={menu} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.currentTarget.open = false; e.currentTarget.querySelector<HTMLElement>('summary')?.focus(); } }}><summary className="icon-button" aria-label="Save options" title="Save options"><ChevronDown size={16} /></summary><div className="save-options-panel"><strong>Save preferences</strong><button className="button secondary" onClick={() => { if (menu.current) menu.current.open = false; void load(); }}>Open saved</button>
    <label><input type="checkbox" aria-label="Autosave canvas" checked={autosaveRequested ?? state?.mode === 'autosave'} onChange={async e => { const on = e.target.checked; setAutosaveRequested(on); try { const c = await ensure(); if (c) { c.setMode(on ? 'autosave' : 'manual'); localStorage.setItem('bolt-flow:autosave', String(on)); } } catch (error) { notify(String(error)); } finally { setAutosaveRequested(null); } }} />Autosave</label>
    <label><input type="checkbox" checked={rememberView} onChange={e => setRememberView(e.target.checked)} />Save view</label>
    <p>Save keeps this canvas in your browser. Export JSON to download a portable copy.</p></div></details>
    {state?.status === 'error' && <button className="text-button" onClick={() => void save()}>Retry save</button>}
  </div>;
}
