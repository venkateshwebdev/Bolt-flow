import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// Inline the runtime and CSS into an opaque-origin iframe. No CDN or registry
// installation is needed: examples run the same local package sources as the app.
export function exampleSandboxPlugin(): Plugin {
  const id = '\0virtual:example-sandbox';
  let cached: Promise<string> | undefined;
  const root = fileURLToPath(new URL('../../', import.meta.url));
  return {
    name: 'example-sandbox',
    resolveId(source) { if (source === 'virtual:example-sandbox') return id; },
    async load(source) {
      if (source !== id) return;
      cached ??= (async () => {
        const result = await build({
          absWorkingDir: root, entryPoints: ['apps/playground/src/sandbox/runtime.tsx'],
          bundle: true, write: false, outdir: 'sandbox', format: 'iife', platform: 'browser',
          target: 'es2022', minify: true, jsx: 'automatic',
          define: { 'process.env.NODE_ENV': '"production"' },
          alias: {
            'bolt-flow-plugin-draw/style.css': `${root}packages/plugin-draw/src/style.css`,
            'bolt-flow-react/style.css': `${root}packages/react/src/style.css`,
            'bolt-flow-core': `${root}packages/core/src/index.ts`,
            'bolt-flow-react': `${root}packages/react/src/index.tsx`,
            ...Object.fromEntries(['draw', 'history', 'layout', 'storage', 'export', 'image-export'].map(name => [`bolt-flow-plugin-${name}`, `${root}packages/plugin-${name}/src/index.ts`])),
          },
          loader: { '.woff': 'dataurl', '.woff2': 'dataurl' },
        });
        const js = result.outputFiles.find(file => file.path.endsWith('.js'))!.text;
        const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
        return `export default ${JSON.stringify({ js, css })};`;
      })().catch(error => { cached = undefined; throw error; });
      return cached;
    },
    configureServer(server) {
      server.watcher.on('change', file => {
        if (!file.includes('/packages/') && !file.includes('/src/sandbox/')) return;
        cached = undefined;
        const module = server.moduleGraph.getModuleById(id);
        if (module) server.moduleGraph.invalidateModule(module);
      });
    },
  };
}
