import { validateDocument, type BoltPlugin } from 'bolt-flow-core';

export function exportPlugin({ maxImportBytes = 25 * 1024 * 1024 }: { maxImportBytes?: number } = {}): BoltPlugin {
  return {
    id: 'export', name: 'Portable canvas', version: '0.1.0',
    setup(context) {
      context.registerCommand({ id: 'export.json', title: 'Export canvas as JSON', execute: () => JSON.stringify(context.getDocument(), null, 2) });
      context.registerCommand({ id: 'import.json', title: 'Import a canvas', execute(input: string) {
        if (new TextEncoder().encode(input).length > maxImportBytes) throw new Error('This document exceeds the configured import size limit.');
        const document = validateDocument(JSON.parse(input));
        context.replaceDocument(document, { source: 'import' });
      } });
      context.registerCommand({ id: 'export.download', title: 'Download canvas', execute() {
        if (typeof document === 'undefined') throw new Error('Download requires a browser. Use export.json on the server.');
        const canvas = context.getDocument();
        const url = URL.createObjectURL(new Blob([JSON.stringify(canvas, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${canvas.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'canvas'}.bolt.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } });
    },
  };
}