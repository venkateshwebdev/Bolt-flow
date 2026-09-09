import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'bolt-flow-core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      'bolt-flow-react': fileURLToPath(new URL('./packages/react/src/index.tsx', import.meta.url)),
    },
  },
  test: { include: ['packages/**/*.test.ts'], coverage: { provider: 'v8' } },
});