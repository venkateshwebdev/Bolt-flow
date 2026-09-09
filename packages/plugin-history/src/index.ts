import type { BoltDocument, BoltPlugin } from '@bolt-flow/core';

export function historyPlugin({ limit = 100, mergeWindow = 500 }: { limit?: number; mergeWindow?: number } = {}): BoltPlugin {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('History limit must be a positive integer.');
  return {
    id: 'history', name: 'Time machine', version: '0.1.0',
    setup(context) {
      const undo: BoltDocument[] = [];
      const redo: BoltDocument[] = [];
      let lastGroup: string | undefined;
      let lastTime = 0;
      context.onDocumentChange((_next, previous, meta) => {
        if (meta.source === 'history') return;
        if (meta.history === 'ignore') { undo.length = 0; redo.length = 0; lastGroup = undefined; return; }
        const now = Date.now();
        if (!meta.group || meta.group !== lastGroup || now - lastTime > mergeWindow) {
          undo.push(previous);
          if (undo.length > limit) undo.shift();
        }
        redo.length = 0;
        lastGroup = meta.group;
        lastTime = now;
      });
      context.registerCommand({ id: 'history.undo', title: 'Undo last change', shortcut: '⌘Z', execute() {
        const previous = undo.pop();
        if (!previous) return false;
        redo.push(context.getDocument());
        lastGroup = undefined;
        context.replaceDocument(previous, { source: 'history', history: 'ignore' });
        return true;
      } });
      context.registerCommand({ id: 'history.redo', title: 'Redo last change', shortcut: '⌘⇧Z', execute() {
        const next = redo.pop();
        if (!next) return false;
        undo.push(context.getDocument());
        lastGroup = undefined;
        context.replaceDocument(next, { source: 'history', history: 'ignore' });
        return true;
      } });
      context.registerCommand({ id: 'history.status', title: 'History status', execute: () => ({ undo: undo.length, redo: redo.length }) });
    },
  };
}