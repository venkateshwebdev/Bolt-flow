import { useState } from 'react';
import { useBolt, useBoltSnapshot, type CanvasToolProps } from 'bolt-flow-react';
import type { Json } from 'bolt-flow-core';

type Settings = Record<string, Json>;
const object = (value: Json | undefined): Settings => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function WorkspaceSettings({ theme, setTheme, grid, setGrid, snap, setSnap, minimap, setMinimap, interaction, notify }: {
  theme: 'light' | 'dark'; setTheme: (value: 'light' | 'dark') => void; grid: boolean; setGrid: (value: boolean) => void; snap: boolean; setSnap: (value: boolean) => void; minimap: boolean; setMinimap: (value: boolean) => void; interaction: CanvasToolProps; notify: (value: string) => void;
}) {
  const runtime = useBolt(); const { document } = useBoltSnapshot(); const [name, setName] = useState('My workspace');
  const settings = object(document.extensions.workspace);
  const hidden = Array.isArray(interaction.options.hiddenTools) ? interaction.options.hiddenTools as string[] : [];
  const patch = (key: string, value: Json) => runtime.updateDocument(doc => { doc.extensions.workspace = { ...object(doc.extensions.workspace), [key]: value }; }, { source: 'workspace.settings', group: `workspace.${key}` });
  const tools = ['pen', 'rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'text', 'comment', 'eraser', 'triangle', 'database'];
  const presets = Array.isArray(document.extensions.workspacePresets) ? document.extensions.workspacePresets.map(object) : [];
  return <div className="workspace-settings">
    <section><h3>Appearance & navigation</h3>
      <label>Theme<select value={theme} onChange={e => { const value = e.target.value as 'light' | 'dark'; setTheme(value); patch('theme', value); }}><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label>Accent<input type="color" aria-label="Workspace accent" value={String(settings.accent ?? '#2563eb')} onChange={e => patch('accent', e.target.value)} /></label>
      <label>Density<select value={String(settings.density ?? 'comfortable')} onChange={e => patch('density', e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      {([['Grid', grid, setGrid, 'grid'], ['Snap to grid', snap, setSnap, 'snap'], ['Minimap', minimap, setMinimap, 'minimap']] as const).map(([label, checked, change, key]) => <label key={key}><input type="checkbox" checked={checked} onChange={e => { change(e.target.checked); patch(key, e.target.checked); }} />{label}</label>)}
    </section>
    <section><h3>Your drawing toolbar</h3><p>Choose which tools appear. Existing drawings stay on the canvas.</p><div className="tool-choices">{tools.map(tool => <label key={tool}><input type="checkbox" checked={!hidden.includes(tool)} onChange={e => interaction.onOptionsChange?.({ ...interaction.options, hiddenTools: e.target.checked ? hidden.filter(id => id !== tool) : [...hidden, tool] })} />{tool}</label>)}</div>
      <label>Tool order<input aria-label="Drawing tool order" placeholder={tools.join(', ')} value={Array.isArray(interaction.options.toolOrder) ? interaction.options.toolOrder.join(', ') : ''} onChange={e => interaction.onOptionsChange?.({ ...interaction.options, toolOrder: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></label>
      <label>Palette<input aria-label="Drawing palette" placeholder="#7963d2, #2563eb, #059669" value={Array.isArray(interaction.options.palette) ? interaction.options.palette.join(', ') : ''} onChange={e => interaction.onOptionsChange?.({ ...interaction.options, palette: e.target.value.split(',').map(s => s.trim()).filter(s => /^#[0-9a-f]{6}$/i.test(s)) })} /></label>
      <label><input type="checkbox" checked={!!interaction.options.keepTool} onChange={e => interaction.onOptionsChange?.({ ...interaction.options, keepTool: e.target.checked })} />Keep tools active after drawing</label>
    </section>
    <section><h3>Reusable presets</h3><label>Preset name<input value={name} onChange={e => setName(e.target.value)} /></label><button className="button secondary" disabled={!name.trim()} onClick={() => { runtime.updateDocument(doc => { const preset = { name: name.trim(), settings, drawing: interaction.options, appearance: doc.extensions.appearance ?? {} }; doc.extensions.workspacePresets = [...presets.filter(p => p.name !== name.trim()), preset]; }, { source: 'workspace.preset' }); notify('Workspace preset saved in the document.'); }}>Save preset</button>
      {presets.map(preset => <button className="text-button" key={String(preset.name)} onClick={() => { runtime.updateDocument(doc => { doc.extensions.workspace = object(preset.settings); doc.extensions.appearance = object(preset.appearance); doc.extensions.drawing = object(preset.drawing); }, { source: 'workspace.preset.apply' }); interaction.onOptionsChange?.(object(preset.drawing)); }}>{String(preset.name)}</button>)}
      <button className="text-button" onClick={() => { runtime.updateDocument(doc => { delete doc.extensions.workspace; delete doc.extensions.drawing; }, { source: 'workspace.reset' }); setTheme('light'); setGrid(true); setSnap(false); setMinimap(false); interaction.onOptionsChange?.({}); }}>Reset workspace defaults</button>
    </section>
  </div>;
}
