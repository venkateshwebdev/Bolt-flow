# Editor layout & UI

Use the default editor when you want a useful starting layout. Compose its exported primitives when your product needs a different navigation structure, toolbar, or property panel.

## Provider boundaries

Every canvas and its related tools must share a `BoltProvider`. The provider creates the React Flow context and exposes the runtime to Bolt hooks. Use a separate provider and runtime for independent editors.

`useBolt()` returns the runtime. `useBoltSnapshot()` subscribes to document and plugin updates. `useReactFlow()` provides coordinate conversion, fitting, zoom, and other React Flow operations. Calling these hooks outside their required provider is an error.

## Configure the default shell

```tsx
import { BoltEditor } from 'bolt-flow-react';

// Render inside the BoltProvider created in the quickstart.
function Editor() {
  return <BoltEditor
    panels={{ layers: false, inspector: false }}
    canvas={{ showGrid: true, showMinimap: true, minZoom: 0.25, maxZoom: 2 }}
    actions={[
      { id: 'app.undo', label: 'Undo', command: 'history.undo', shortcut: 'Mod+Z' },
    ]}
    style={{ fontFamily: 'system-ui' }}
    onError={error => console.error('Editor action failed', error)}
  />;
}
```

`panels` accepts `toolbar`, `layers`, `inspector`, and `status`. Set one to `false` to hide that built-in area or supply a React component to replace it. Replacement components receive `{ selection, interaction }`. The current default shell hides an entire layers/inspector column when that panel is false, including slots inside the column.

`canvas` forwards supported React Flow options through `BoltCanvas`. The shell owns selected-node state and interaction unless you supply controlled `interaction`. For fully controlled selection or a layout beyond these panels, compose the primitives directly.

## Build a custom layout

This is a complete controlled canvas component. Mount it under your existing provider with drawing installed.

```tsx
import { useRef, useState } from 'react';
import type { Json } from 'bolt-flow-core';
import {
  BoltCanvas, BoltTools, BoltLayers, BoltInspector,
  useBoltShortcuts, type CanvasToolProps,
} from 'bolt-flow-react';

export function CustomWorkspace() {
  const root = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState('select');
  const [options, setOptions] = useState<Record<string, Json>>({ color: '#0f766e' });
  const [selected, setSelected] = useState<string[]>([]);
  const interaction: CanvasToolProps = {
    tool, options, onToolChange: setTool, onOptionsChange: setOptions,
    onCreated: (id, kind) => { if (kind === 'node') setSelected([id]); },
  };
  useBoltShortcuts(root, [
    { id: 'select', label: 'Select', shortcut: 'V', run: () => setTool('select') },
    { id: 'pan', label: 'Pan', shortcut: 'H', run: () => setTool('pan') },
  ]);

  return <div ref={root} data-bolt-editor tabIndex={-1}
    style={{ height: 650, display: 'grid', gridTemplateColumns: '220px 1fr 240px' }}>
    <aside><BoltLayers selectedIds={selected} onSelect={setSelected} /></aside>
    <main style={{ position: 'relative', minWidth: 0 }}>
      <BoltCanvas interaction={interaction} selectedNodeIds={selected}
        onSelectionChange={({ nodes }) => setSelected(nodes.map(node => node.id))} />
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <BoltTools {...interaction} />
      </div>
    </main>
    <aside><BoltInspector nodeId={selected[0]} /></aside>
  </div>;
}
```

The example uses inline layout styles for clarity. In your product, move them into responsive CSS and give panels their own scroll containers. Use `min-width: 0` and `min-height: 0` in grid/flex children so the canvas can shrink correctly.

The same `interaction` goes to tools and canvas. The host must apply `onToolChange`, including requests to return to Select after drawing. `data-bolt-editor` scopes drawing shortcuts to this editor. Avoid nesting independent editor roots inside one another.

## Replace panels and inspector fields

The generic inspector edits declared keys in `node.data`. It does not know your domain schema or display the entire playground inspector automatically.

```tsx
import { BoltInspector, type EditorSlotProps } from 'bolt-flow-react';

export function TaskProperties({ selection }: EditorSlotProps) {
  return <BoltInspector nodeId={selection[0]} fields={[
    { key: 'label', label: 'Task name' },
    { key: 'retries', label: 'Retry count', type: 'number', min: 0, max: 10 },
    { key: 'enabled', label: 'Enabled', type: 'checkbox' },
  ]} />;
}
// <BoltEditor panels={{ inspector: TaskProperties }} />
```

For validation across fields, conditional UI, attachments, or rich text, write a panel using `useBolt()` and `useBoltSnapshot()`. Update the draft by stable node ID. Keep editor-specific selection separate from portable `data`.

`BoltLayers` also supports `filter`, `renderLabel`, `onFocus`, and `onError`. `onFocus` is a host callback; the primitive does not silently refit your canvas. `BoltEditor` wires an explicit layer-focus action to fitting the selected node.

## Register UI contributions

```tsx
import { editorUIPlugin, type EditorSlotProps } from 'bolt-flow-react';

function SelectionStatus({ selection }: EditorSlotProps) {
  return <span>{selection.length} selected</span>;
}
runtime.use(editorUIPlugin({
  id: 'acme.editor-ui',
  actions: [
    { id: 'acme.validate', label: 'Validate', shortcut: 'Mod+Shift+V',
      run: () => validateWorkflow(runtime.getDocument()) },
  ],
  slots: {
    'editor.status': [{ id: 'acme.selection', component: SelectionStatus, order: 10 }],
  },
}));
```

This configuration assumes `runtime` and your `validateWorkflow` function already exist. UI contributions are trusted React components and callbacks. They stay outside JSON.

Supported typed slots are `editor.toolbar`, `editor.inspector`, `editor.menu`, `editor.panel`, and `editor.status`. The default shell mounts all except `editor.menu`. Mount a menu slot yourself where your application needs it.

## Override actions and slots

`BoltToolbar` merges contributed actions by ID. Its `actions` prop overrides matching IDs; `hidden` removes IDs from that toolbar. `BoltSlot` merges panels by ID, orders them by `order`, and lets a host replace or hide one contribution.

```tsx
import { BoltSlot, BoltToolbar, type EditorSlotProps } from 'bolt-flow-react';

function MyToolbar(props: EditorSlotProps) {
  return <>
    <BoltToolbar hidden={['acme.validate']} actions={[
      { id: 'app.save', label: 'Save draft', run: saveDraft },
    ]} onError={showError} />
    <BoltSlot name="editor.toolbar" {...props}
      overrides={{ 'vendor.banner': false }} />
  </>;
}
```

Here `saveDraft` and `showError` are application callbacks. Prefer unique namespaced IDs across plugins. An action may use `command` plus `payload`, or `run`; if both are provided, the command path takes precedence. `enabled: false` disables the action. Command actions also consult `runtime.commandStatus()`.

## Shortcuts and focus

`useBoltShortcuts(ref, actions, onError?)` listens on the editor element, not the entire page. It ignores input, textarea, select, role=textbox, contenteditable, prevented events, and IME composition. Supported syntax includes `Mod+S`, `Mod+Shift+Z`, `Ctrl+K`, `Meta+K`, and `Alt+A`.

A command's `shortcut` metadata is descriptive; it does not install a global listener. Register actions with the shortcut hook or default editor to make them functional. Hosts choose whether Save should also work while typing and must implement that policy explicitly.

Keep dialogs keyboard accessible, restore focus after closing, and make icon-only controls discoverable with labels. The playground uses native modal dialogs. Hiding a panel must not remove the only way to reopen it.

## Read-only and viewport behavior

`<BoltProvider readOnly>` blocks built-in mutation commands and marks built-in UI read-only. `<BoltCanvas readOnly>` blocks pointer editing on that canvas. Host callbacks and direct `runtime.updateDocument()` calls remain trusted application code. Apply backend authorization independently.

The canvas fits initially by default. It does not need to refit when opening panels or switching tools. Set `fitView={false}` and provide `defaultViewport` when restoring a saved view, then use `flow.setViewport()` for later loads. Use explicit Fit/Focus actions for navigation; avoid an effect that fits on every document change.
