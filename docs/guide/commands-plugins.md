# Commands & plugins

Plugins add capabilities without changing the kernel. Commands provide named entry points, while contribution slots connect optional UI and renderers to a host layout.

## Write a plugin

This complete example registers a validated rename command and stores portable settings under a namespaced extension key.

```ts
import type { BoltPlugin } from 'bolt-flow-core';

export function projectPlugin(): BoltPlugin {
  return {
    id: 'acme.project', name: 'Project tools', version: '1.0.0',
    setup(ctx) {
      ctx.registerCommand({
        id: 'acme.project.rename', title: 'Rename project',
        execute(name: string) {
          if (typeof name !== 'string' || !name.trim()) throw new Error('A name is required.');
          ctx.updateDocument(draft => {
            draft.name = name.trim();
            draft.extensions['acme.project'] = { version: 1 };
          }, { source: 'acme.project.rename', group: 'project.name' });
        },
      });
    },
  };
}
```

Install it with `runtime.use(projectPlugin())`, then call `runtime.execute('acme.project.rename', 'Release plan')`. Validate payloads at the command boundary, even when TypeScript callers are typed: imported data, JavaScript callers, and UI state can still be invalid.

## Plugin context

| Method | Responsibility |
| --- | --- |
| `getDocument()` | Read the current frozen document |
| `getDocumentRevision()` | Read the committed document revision |
| `updateDocument(callback, meta?)` | Apply one validated draft transaction |
| `replaceDocument(document, meta?)` | Replace a complete validated document |
| `onDocumentChange(listener)` | Subscribe; automatically cleaned up on plugin removal |
| `registerCommand(command)` | Register a command owned by this plugin |
| `contribute(slot, value)` | Add a contribution owned by this plugin |

The registration methods return disposer functions when you need to remove an owned resource early. Context-owned registrations and subscriptions are automatically cleaned up. Return a function from `setup` to clean up timers, sockets, DOM listeners, or external subscriptions that you create yourself.

```ts
setup(ctx) {
  const stop = subscribeToYourService(message => {
    // Validate and apply the host-defined message here.
  });
  return () => stop();
}
```

`subscribeToYourService` is application code, not a Bolt export. Do not serialize service clients or credentials into extensions.

## Load optional features

```ts
await runtime.load('layout', async () => {
  const { layoutPlugin } = await import('bolt-flow-plugin-layout');
  return layoutPlugin({ direction: 'LR', nodeGap: 70, rankGap: 90 });
});
runtime.execute('layout.arrange', { direction: 'TB' });
runtime.remove('layout');
```

Use static import expressions so bundlers can create optional chunks. `load` deduplicates simultaneous loads, checks the returned plugin ID, and permits retries after failure. `use` is synchronous and does not merge a new configuration into an existing plugin with the same ID.

A setup failure rolls back provisional plugin registrations and document changes. A plugin can declare `requires: ['history']`; install dependencies first. Removing a dependency still required by another plugin is blocked. Dependency versions are not negotiated at runtime.

Removing drawing leaves saved annotations intact. Removing history discards its in-memory undo stack. Removing the new manual persistence controller cancels its work without saving. The legacy storage plugin has different flush behavior described in [storage](persistence.md).

## Command status and guards

```ts
runtime.use({
  id: 'acme.validate', name: 'Validation', version: '1.0.0',
  setup(ctx) {
    ctx.registerCommand({
      id: 'acme.validate.run', title: 'Validate workflow',
      enabled: () => ctx.getDocument().nodes.length > 0 || 'Add a node first.',
      execute: () => ({ valid: true }),
    });
  },
});
const status = runtime.commandStatus('acme.validate.run');
// true means enabled; false or a string means disabled.
```

The example's validation result is illustrative; implement actual workflow validation in your host. A command's `enabled` function takes no payload. Runtime guards can inspect the command ID and payload:

```ts
const removeGuard = runtime.beforeCommand((id, payload) => {
  if (id === 'acme.project.rename' && !canRenameProject) return 'Renaming is disabled.';
  return true;
});
// Later: removeGuard();
```

Here `canRenameProject` is host policy. `execute` enforces command status before invoking the command. Direct draft mutations remain available to trusted code. Guards are not a sandbox or a substitute for backend authorization.

## UI and renderer contributions

Core accepts arbitrary string slots. The React package consumes:

| Slot | Value |
| --- | --- |
| `canvas.nodeTypes` | A map from node type IDs to React renderers |
| `canvas.edgeTypes` | A map from edge type IDs to React renderers |
| `canvas.tools` | `{ id, component }` receiving `CanvasToolProps` |
| `canvas.overlay` | `{ id, component }` mounted inside the canvas provider |
| `draw.fonts` | Drawing font metadata arrays |
| `editor.actions` | `BoltAction` contributions |
| `editor.toolbar`, `editor.inspector`, `editor.menu`, `editor.panel`, `editor.status` | Typed editor panel contributions |
| `storage.controller` | Persistence controller from `persistencePlugin` |

Prefer `editorUIPlugin()` for typed action/panel registration. Use `ctx.contribute` directly for canvas components or application-specific slots. The host must render a slot for a UI contribution to be visible. Contributing an `editor.menu` panel does not create a menu automatically.

## Editing command pack

Install `editingPlugin()` from core for shared organization commands:

```ts
runtime.execute('editor.group', ['task-a', 'task-b']);
runtime.execute('editor.align', { ids: ['task-a', 'task-b'], axis: 'left' });
runtime.execute('editor.order', { ids: ['task-a'], direction: 'front' });
runtime.execute('editor.layer', { ids: ['task-b'], locked: true });
```

Other commands are `editor.ungroup`, `editor.duplicate`, and `editor.delete`, which accept node ID arrays. Alignment axes are `left`, `top`, `center-x`, and `center-y`. Layer commands accept optional `hidden` and `locked` booleans. See [API reference](api-reference.md) for all built-in commands.

## Package author checklist

Keep runtime dependencies appropriate to the feature. A headless plugin should not import React or DOM APIs. Export types and ESM entry points, declare peer packages, and publish styles as explicit public exports when needed. Avoid relying on the playground's source aliases in consumer examples.

Write behavior tests for registration, failure cleanup, removal, invalid input, and portable round-trips. Validate public declarations and assets through the built-consumer test. Keep plugin code trusted and local; importing remote code is not part of this plugin system.
