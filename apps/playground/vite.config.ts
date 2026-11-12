import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { exampleSandboxPlugin } from './sandbox-plugin';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const source = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));
const require = createRequire(import.meta.url);
export default defineConfig({
  plugins: [react(), exampleSandboxPlugin(), {
    name: 'font-license',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'licenses/gochi-hand.txt', source: readFileSync(require.resolve('@fontsource/gochi-hand/LICENSE'), 'utf8') });
    },
  }],
  optimizeDeps: { include: ['@dagrejs/dagre'] },
  resolve: {
    alias: [
      { find: 'bolt-flow-plugin-draw/style.css', replacement: source('plugin-draw/src/style.css') },
      { find: 'bolt-flow-react/style.css', replacement: source('react/src/style.css') },
      { find: 'bolt-flow-core', replacement: source('core/src/index.ts') },
      { find: 'bolt-flow-react', replacement: source('react/src/index.tsx') },
      ...['draw', 'history', 'layout', 'storage', 'export', 'image-export'].map((id) => ({
        find: `bolt-flow-plugin-${id}`, replacement: source(`plugin-${id}/src/index.ts`),
      })),
    ],
    dedupe: ['react', 'react-dom', '@xyflow/react'],
  },
  server: { port: 5173 },
});