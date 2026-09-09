import { build, preview } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const outDir = await mkdtemp(join(tmpdir(), 'bolt-consumer-'));
let server, browser;
try {
  const config = { root: fileURLToPath(new URL('.', import.meta.url)), configFile: false, plugins: [react()], build: { outDir, emptyOutDir: true }, preview: { host: '127.0.0.1', port: 0 } };
  await build(config);
  server = await preview(config);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [], fonts = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (/\.woff2?(\?|$)/.test(response.url())) fonts.push(response); });
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.locator('[data-drawing-shape="triangle"] path').waitFor();
  assert.match(await page.locator('[data-drawing-shape="triangle"] path').getAttribute('d'), /M.*L.*Z/);
  const shape = await page.locator('[data-drawing-shape="triangle"] svg').getAttribute('viewBox');
  assert.equal(shape, '0 0 176 116'); // Original geometry scales inside the resized 300×180 node.
  await page.locator('.bolt-ink-text').waitFor();
  assert.equal(await page.locator('.bolt-ink-text').innerText(), 'Built handwritten font');
  assert.equal(await page.evaluate(async () => { const loaded = await document.fonts.load('22px "Gochi Hand"'); return loaded.length > 0 && document.fonts.check('22px "Gochi Hand"'); }), true);
  assert.ok(fonts.length > 0 && fonts.every((response) => response.ok()), 'Self-hosted font assets load successfully');
  assert.equal(await page.locator('.react-flow__node').first().evaluate((node) => getComputedStyle(node).position), 'absolute');
  assert.deepEqual(errors, []);
  console.log('Built consumer smoke passed: public CSS, local fonts, resized custom SVG fallback, no page errors.');
} finally {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  await rm(outDir, { recursive: true, force: true });
}