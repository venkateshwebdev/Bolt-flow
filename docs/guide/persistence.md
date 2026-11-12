# Saving & storage

Your application owns the save policy and destination. The new persistence controller defaults to manual mode and writes only when explicitly triggered.

## Create a controller

```ts
import {
  createPersistenceController, localStorageAdapter,
} from 'bolt-flow-plugin-storage';

const persistence = createPersistenceController(runtime, {
  adapter: localStorageAdapter(window.localStorage, id => `acme:canvas:${id}`),
  mode: 'manual',
  debounce: 600,
  onError: error => console.error('Persistence failed', error),
});
```

Create one controller per runtime/destination lifecycle. This snippet assumes your existing runtime. Do not construct it on each React render. Manual mode does not restore on installation, run background writes, save on pagehide, or flush on disposal.

`restoreOnInstall: true` explicitly opts into loading over the initial document. Use it only when that replacement is intended. In autosave mode, a newly created dirty controller may schedule its initial document for saving when restore is not requested.

## Connect a Save button and status

```tsx
import { useSyncExternalStore } from 'react';
import type { PersistenceController } from 'bolt-flow-plugin-storage';

export function SaveControls({ persistence }: { persistence: PersistenceController }) {
  const state = useSyncExternalStore(
    persistence.subscribe, persistence.getSnapshot, persistence.getSnapshot,
  );
  return <div>
    <button disabled={state.status === 'saving' || state.status === 'loading'}
      onClick={() => void persistence.save()}>Save</button>
    <span role="status">{state.error ?? (state.dirty ? 'Unsaved changes' : 'Saved')}</span>
  </div>;
}
```

`save()` returns `Promise<boolean>`. `true` acknowledges the submitted snapshot; newer edits may still be dirty. Use the observable state to decide what to tell the user. Do not announce “all changes saved” before checking `dirty`.

## State fields

| Field | Meaning |
| --- | --- |
| `status` | `dirty`, `saving`, `saved`, `loading`, `error`, or `conflict` |
| `dirty` | The live revision is not the acknowledged saved revision |
| `mode` | `manual` or `autosave` |
| `documentId` | Current controller document identity |
| `revision` | Current document revision |
| `savedRevision` | Last acknowledged document revision, or null |
| `savedAt` | Local acknowledgment time in milliseconds, or null |
| `error` | Displayable error text, or null |

Plugin registration does not change document revision. Downloads are a separate destination and do not mark storage saved. For local draft recovery and remote persistence, use separately labeled controllers/statuses rather than merging their acknowledgments.

## Load without losing edits

```ts
async function openSaved() {
  if (persistence.getSnapshot().dirty) {
    const discard = window.confirm('Replace unsaved changes with the saved canvas?');
    if (!discard) return;
  }
  const opened = await persistence.load({ discardChanges: true });
  if (!opened) return; // The controller exposes the error.
  // Apply any saved viewport through the React Flow instance here.
}
```

Calling `load()` without `discardChanges: true` refuses to replace a dirty document. A load also refuses to overwrite changes made while its request was in flight. It validates the result before replacement and establishes a new history baseline.

A controller serializes its writes and waits for older writes before loading. Adapters should honor abort signals promptly. Switching document IDs invalidates old responses and resets destination concurrency state. A rejected or missing load leaves the current canvas available.

## Opt into autosave

```ts
persistence.setMode('autosave');
// Debounced document edits are now saved.
persistence.setMode('manual');
// Pending automatic work is canceled; explicit Save remains available.
```

The default debounce is 600 ms. Queued autosaves behind a slow write are coalesced, and switching back to manual prevents queued automatic writes from starting. An already-started backend write cannot be undone merely by changing the mode.

Failures preserve dirty state and surface errors. Resolve a conflict or reload before resuming writes. Browser unload is not a reliable time for asynchronous network saving; do not promise shutdown persistence without a separately designed recovery strategy.

## Implement an HTTP adapter

This is an example protocol you can implement in your backend. Bolt Flow does not supply these endpoints. The backend must authenticate requests, authorize the document, validate data, and enforce concurrency tokens.

```ts
import {
  PersistenceConflict, type PersistenceAdapter,
} from 'bolt-flow-plugin-storage';

export const httpAdapter: PersistenceAdapter = {
  async load({ documentId, signal }) {
    const response = await fetch(`/api/canvases/${encodeURIComponent(documentId)}`, {
      signal, credentials: 'same-origin',
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Load failed (${response.status})`);
    return {
      snapshot: await response.json(),
      etag: response.headers.get('ETag') ?? undefined,
    };
  },
  async save({ documentId, snapshot, etag, signal }) {
    const response = await fetch(`/api/canvases/${encodeURIComponent(documentId)}`, {
      method: 'PUT', signal, credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(etag ? { 'If-Match': etag } : { 'If-None-Match': '*' }),
      },
      body: JSON.stringify(snapshot),
    });
    if (response.status === 409 || response.status === 412) {
      throw new PersistenceConflict('This canvas changed on the server. Reload or save a copy.');
    }
    if (!response.ok) throw new Error(`Save failed (${response.status})`);
    return { etag: response.headers.get('ETag') ?? undefined };
  },
};
```

This example uses a conditional create when no ETag is known. To edit an existing remote document, load it first to obtain its ETag. A different API can use explicit versions instead, but must enforce them server-side. Cross-origin adapters must also configure CORS and expose the ETag response header.

`SaveRequest` includes `documentId`, immutable `snapshot`, document `revision`, optional `etag`, and `signal`. Revision is local runtime bookkeeping; it is not a replacement for a server concurrency token. Adapters return `{ etag }` when the destination supports one.

## Conflicts and errors

Throw `PersistenceConflict` for a stale write. The controller exposes conflict state and blocks further writes until a successful load or a document switch. A failed reload does not remove that barrier. It does not automatically merge documents.

For a save-copy workflow, let the user choose a new document identity and destination, then call Save. A multi-document picker, naming collisions, file ownership, and version-history UI remain host responsibilities.

Storage quota errors and unavailable browser storage also surface through the controller. Keep the live document and offer export/retry rather than discarding it. Avoid storing large image binaries in localStorage.

## Plugin-owned persistence

```ts
import { persistencePlugin, localStorageAdapter } from 'bolt-flow-plugin-storage';

runtime.use(persistencePlugin({
  mode: 'manual', adapter: localStorageAdapter(localStorage, 'acme:current-canvas'),
}));
await runtime.execute<undefined, Promise<boolean>>('storage.save');
const state = runtime.execute('storage.status');
runtime.execute('storage.mode', 'autosave');
```

The plugin owns controller cleanup and contributes `storage.controller`. Commands include `storage.save`, `storage.load`, `storage.status`, and `storage.mode`. `storage.load` accepts `{ discardChanges?: boolean }`.

## Legacy storage and disposal

The older `storagePlugin()` retains its original synchronous restore/autosave/pagehide/removal-flush behavior for compatibility. It is not manual mode. It uses the same plugin ID as `persistencePlugin`; install only one of them.

For a directly created controller, unsubscribe UI listeners and call `dispose()` when its owning editor/destination is permanently destroyed. Disposal cancels pending work and does not save. Create a fresh controller for a new lifecycle; do not reuse a disposed instance.
