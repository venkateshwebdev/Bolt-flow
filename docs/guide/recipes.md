# Integration recipes

These patterns connect the public APIs into common product features. Each recipe assumes an existing stable runtime and the packages described in the quickstart.

## A review-only editor

```tsx
import { BoltProvider, BoltEditor } from 'bolt-flow-react';

function Review({ runtime }: { runtime: import('bolt-flow-core').BoltRuntime }) {
  return <BoltProvider runtime={runtime} readOnly>
    <div style={{ height: 650 }}>
      <BoltEditor panels={{ inspector: false }} canvas={{ showMinimap: true }} />
    </div>
  </BoltProvider>;
}
```

Built-in editing controls and mutation commands are blocked. Your custom buttons, renderers, and direct draft calls must honor the same policy. Read-only UI is not server authorization. If reviewers should add comments but not edit workflow nodes, implement that narrower policy with custom controls and guards rather than enabling all built-in editing.

## A host Save action

```tsx
import { BoltEditor } from 'bolt-flow-react';
import type { PersistenceController } from 'bolt-flow-plugin-storage';

function EditorWithSave({ persistence }: { persistence: PersistenceController }) {
  return <BoltEditor actions={[
    { id: 'app.save', label: 'Save', shortcut: 'Mod+S',
      run: () => persistence.save() },
  ]} onError={error => console.error(error)} />;
}
```

Mount under the provider and create the controller once at the owning boundary. Display controller status separately, as shown in [saving and storage](persistence.md). A false result is a reported persistence failure, not necessarily a rejected promise; read the controller's error state.

## A Generate action with explicit acceptance

```ts
import { parseCanvas, insertCanvas } from 'bolt-flow-core';

async function previewGenerated(prompt: string) {
  const response = await fetch('/api/generate-canvas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) throw new Error('Generation failed');
  return parseCanvas(await response.text());
}
function acceptInsert(candidate: import('bolt-flow-core').BoltDocument) {
  const next = insertCanvas(runtime.getDocument(), candidate);
  runtime.replaceDocument(next.document, { source: 'generation.insert' });
}
```

The endpoint is yours to implement. Keep its result in preview state until the user accepts it. Validate your domain schema as well as Bolt JSON. Do not have generation call Save, Run, or Publish unless the product flow explicitly requests those actions.

## Toolbar-only annotation review

```tsx
import { useState } from 'react';
import { BoltCanvas, BoltTools } from 'bolt-flow-react';
import type { Json } from 'bolt-flow-core';

function AnnotationWorkspace() {
  const [tool, onToolChange] = useState('select');
  const [options, onOptionsChange] = useState<Record<string, Json>>({ text: '' });
  const interaction = { tool, options, onToolChange, onOptionsChange };
  return <div data-bolt-editor style={{ height: 600 }}>
    <BoltTools {...interaction} />
    <div style={{ height: 500 }}><BoltCanvas interaction={interaction} /></div>
  </div>;
}
```

Install drawing initially with `tools: ['text', 'comment', 'arrow']` to restrict available annotation types. Supply your own toolbar or a custom inspector when the default settings are too broad. Keep Select and Pan accessible.

## Fit only after an intentional action

```tsx
import { useBolt, useReactFlow } from 'bolt-flow-react';

function ArrangeButton() {
  const runtime = useBolt(), flow = useReactFlow();
  return <button onClick={async () => {
    if (!runtime.hasPlugin('layout')) {
      await runtime.load('layout', async () =>
        (await import('bolt-flow-plugin-layout')).layoutPlugin());
    }
    runtime.execute('layout.arrange', { direction: 'LR' });
    requestAnimationFrame(() => { void flow.fitView({ padding: 0.15 }); });
  }}>Arrange workflow</button>;
}
```

Catch and display load errors in your application's action boundary. Avoid subscribing to every document update and calling fit: it would pan/zoom after text edits and interfere with dragging. Restore a saved viewport explicitly instead of also fitting it.

## Two independent editors

Create separate runtimes and providers. Give each editor a nonzero size and a unique document ID/storage key. The default shell scopes shortcuts to its own root. Shared module-level mutable tool state or global keydown handlers defeat that isolation.

```tsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
  <BoltProvider runtime={leftRuntime}><div style={{ height: 600 }}><BoltEditor /></div></BoltProvider>
  <BoltProvider runtime={rightRuntime}><div style={{ height: 600 }}><BoltEditor /></div></BoltProvider>
</div>
```

This JSX assumes `BoltProvider`, `BoltEditor`, and the two runtimes from the quickstart. Sharing one runtime between editors intentionally shares its document and plugin policies; it is not two independent sessions.

## Preserve application metadata

```ts
runtime.updateDocument(draft => {
  draft.extensions['acme.workflow'] = {
    version: 1, workspaceId: 'team-design', templateId: 'approval-v2',
  };
}, { source: 'acme.metadata' });
```

Use namespaced keys and version your custom payload. Preserve unknown keys during host migrations. Do not put secrets in a document that users can export. If workspace IDs or domain references are sensitive, decide which fields belong in the backend rather than portable JSON.

## Add a reusable custom inspector

Start with `BoltInspector.fields` for direct data keys. For richer forms, resolve the selected ID from the slot props, use `useBoltSnapshot()` to subscribe, validate user input, and call `updateDocument` with a descriptive source/group.

Keep per-keystroke history grouping local to the field, for example `task.<id>.label`. Use one transaction for multi-field actions. Show a useful empty state when selection disappears after deletion or import. Avoid capturing a stale node object and mutating it later; locate it by ID in the current draft.
