import { validateDocument, type BoltPlugin } from '@bolt-flow/core';

export interface StorageAdapter { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface StorageOptions { key?: string; debounce?: number; storage?: StorageAdapter; onError?: (error: unknown) => void }
export function storagePlugin({ key = 'bolt-flow:document', debounce = 600, storage, onError = console.error }: StorageOptions = {}): BoltPlugin {
  return {
    id: 'storage', name: 'Local autosave', version: '0.1.0',
    setup(context) {
      let adapter = storage;
      if (!adapter) {
        try { if (typeof window !== 'undefined') adapter = window.localStorage; } catch (error) { onError(error); }
      }
      if (!adapter) throw new Error('Persistence needs a storage adapter or browser localStorage.');
      let timer: ReturnType<typeof setTimeout> | undefined;
      let state: { savedAt: number | null; error: string | null } = { savedAt: null, error: null };
      const fail = (error: unknown) => { state = { ...state, error: error instanceof Error ? error.message : String(error) }; onError(error); };
      try {
        const saved = adapter.getItem(key);
        if (saved) context.replaceDocument(validateDocument(JSON.parse(saved)), { source: 'storage.restore', history: 'ignore' });
      } catch (error) { fail(error); }
      const save = () => {
        clearTimeout(timer);
        try {
          adapter.setItem(key, JSON.stringify(context.getDocument()));
          state = { savedAt: Date.now(), error: null };
          return true;
        } catch (error) { fail(error); return false; }
      };
      context.onDocumentChange(() => { clearTimeout(timer); timer = setTimeout(save, debounce); });
      context.registerCommand({ id: 'storage.save', title: 'Save to this browser', shortcut: '⌘S', execute: save });
      context.registerCommand({ id: 'storage.status', title: 'Autosave status', execute: () => state });
      if (typeof window !== 'undefined') window.addEventListener('pagehide', save);
      return () => { save(); if (typeof window !== 'undefined') window.removeEventListener('pagehide', save); };
    },
  };
}