import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { guideSnippets } from '../apps/playground/src/sandbox/guide-snippets';
const guides = ['react-flow', 'quickstart', 'document-model', 'react-editor', 'nodes-edges', 'drawing', 'styling', 'commands-plugins', 'persistence', 'workflow-json', 'export', 'recipes', 'troubleshooting'];
for (const slug of guides) test(`every ${slug} example opens a working isolated sandbox`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/docs/${slug}`);
  await expect(page.locator('.docs-article h1')).toBeVisible();
  const snippets = guideSnippets(readFileSync(`docs/guide/${slug}.md`, 'utf8'));
  const indices = snippets.flatMap((snippet, index) => ['sh', 'bash', 'nginx', 'text'].includes(snippet.language) ? [] : [index]);
  const count = indices.length;
  await expect(page.getByRole('tab', { name: 'Preview', exact: true })).toHaveCount(count);
  for (const i of indices) {
    const example = page.locator(`[data-example="${slug}-${i}"]`);
    await example.getByRole('tab', { name: 'Preview', exact: true }).click();
    await expect(example.locator('.sandbox-toolbar [role=status]'), `${slug}:${i}`).toHaveText(/^(Running|Example error|Could not load sandbox)$/, { timeout: 30000 });
    await expect(example.locator('.sandbox-error'), `${slug}:${i}`).toHaveCount(0);
    const frame = example.locator('iframe');
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-downloads');
    await expect(frame.contentFrame().locator('.bolt-canvas').first(), `${slug}:${i}`).toBeVisible();
    await expect(frame.contentFrame().getByRole('alert')).toHaveCount(0);
    await example.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(frame).toHaveCount(0);
  }
});

test('editing, rerunning, errors and reset use the actual example source', async ({ page }) => {
  await page.goto('/docs/quickstart');
  const example = page.locator('[data-example="quickstart-3"]');
  await example.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(example.locator('.sandbox-toolbar [role=status]')).toHaveText('Running');
  await example.getByRole('tab', { name: 'Code', exact: true }).click();
  const editor = example.getByRole('textbox', { name: 'Runnable example code' });
  await expect(example.getByRole('tab', { name: 'Split', exact: true })).toHaveCount(0);
  const frameSession = await example.locator('iframe').getAttribute('srcdoc');
  await example.getByRole('tab', { name: 'Preview', exact: true }).click();
  await example.getByRole('tab', { name: 'Code', exact: true }).click();
  expect(await example.locator('iframe').getAttribute('srcdoc')).toBe(frameSession);
  await editor.fill((await editor.inputValue()).replace("label: 'Sign up'", "label: 'Changed in the sandbox'"));
  await example.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(example.locator('iframe').contentFrame().locator('.react-flow__node').getByText('Changed in the sandbox', { exact: true })).toBeVisible();
  await example.getByRole('tab', { name: 'Code', exact: true }).click();
  await editor.fill('export default function Broken( {');
  await example.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(example.getByRole('alert')).toContainText('Unexpected token');
  await example.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(example.locator('iframe').contentFrame().locator('.react-flow__node').getByText('Sign up', { exact: true })).toBeVisible();
  await expect(example.getByRole('alert')).toHaveCount(0);
  expect(await example.locator('iframe').contentFrame().locator('body').evaluate(() => {
    try { return !!parent.document; } catch { return false; }
  })).toBe(false);
});

test('save and conflict controls exercise isolated storage adapters', async ({ page }) => {
  await page.goto('/docs/persistence');
  const manual = page.locator('[data-example="persistence-0"]');
  await manual.getByRole('tab', { name: 'Preview', exact: true }).click();
  const frame = manual.locator('iframe').contentFrame();
  await frame.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(frame.getByRole('status')).toHaveText('Saved');
  await frame.getByRole('button', { name: 'Add task' }).click();
  await expect(frame.getByRole('status')).toHaveText('Unsaved changes');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await manual.getByRole('button', { name: 'Stop', exact: true }).click();
  const http = page.locator('[data-example="persistence-4"]');
  await http.getByRole('tab', { name: 'Preview', exact: true }).click();
  const mock = http.locator('iframe').contentFrame();
  await mock.getByRole('button', { name: 'Save to mock server' }).click();
  await expect(http.locator('.sandbox-output')).toContainText('saved');
  await mock.getByRole('button', { name: 'Simulate competing save' }).click();
  await mock.getByRole('button', { name: 'Save to mock server' }).click();
  await expect(http.locator('.sandbox-output')).toContainText('This canvas changed on the server');
});

test('sandbox JSON and PNG exports produce files and generated acceptance changes the canvas', async ({ page }) => {
  await page.goto('/docs/export');
  const jsonExample = page.locator('[data-example="export-1"]');
  await jsonExample.getByRole('tab', { name: 'Preview', exact: true }).click();
  const jsonDownload = page.waitForEvent('download');
  await jsonExample.locator('iframe').contentFrame().getByRole('button', { name: 'Download JSON' }).click();
  expect((await jsonDownload).suggestedFilename()).toMatch(/\.json$/);
  await jsonExample.getByRole('button', { name: 'Stop', exact: true }).click();
  const pngExample = page.locator('[data-example="export-3"]');
  await pngExample.getByRole('tab', { name: 'Preview', exact: true }).click();
  const pngDownload = page.waitForEvent('download');
  await pngExample.locator('iframe').contentFrame().getByRole('button', { name: 'Download PNG' }).click();
  expect((await pngDownload).suggestedFilename()).toBe('approval-flow.png');
  await page.goto('/docs/recipes');
  const generated = page.locator('[data-example="recipes-2"]');
  await generated.getByRole('tab', { name: 'Preview', exact: true }).click();
  const frame = generated.locator('iframe').contentFrame();
  await frame.getByRole('button', { name: 'Preview generated data' }).click();
  await expect(frame.locator('.react-flow__node')).toHaveCount(2);
  await frame.getByRole('button', { name: 'Accept insertion' }).click();
  await expect(frame.locator('.react-flow__node')).toHaveCount(3);
});

test('sandboxes preserve responsive docs layout and CSS edits affect their preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs/styling');
  const example = page.locator('[data-example="styling-0"]');
  await example.getByRole('tab', { name: 'Preview', exact: true }).click();
  await expect(example.locator('.sandbox-toolbar [role=status]')).toHaveText('Running');
  await example.getByRole('tab', { name: 'Code', exact: true }).click();
  await example.getByRole('combobox', { name: 'Source file' }).selectOption('css');
  await example.getByRole('textbox', { name: 'Example CSS' }).fill('.example-demo { background-color: rgb(240, 253, 244); }');
  await example.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(example.locator('iframe').contentFrame().locator('.example-demo')).toHaveCSS('background-color', 'rgb(240, 253, 244)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});


test('drawing toolbar and React Flow panel actions work together, with support source exposed', async ({ page }) => {
  await page.goto('/docs/react-flow');
  const example = page.locator('[data-example="react-flow-1"]');
  await example.getByRole('tab', { name: 'Preview', exact: true }).click();
  const frame = example.locator('iframe').contentFrame();
  await frame.getByRole('button', { name: 'Select tool', exact: true }).click();
  await frame.getByRole('button', { name: 'Pen tool', exact: true }).click();
  await frame.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.goto('/docs/persistence');
  const storage = page.locator('[data-example="persistence-0"]');
  await storage.getByRole('tab', { name: 'Preview', exact: true }).click();
  await storage.getByRole('tab', { name: 'Code', exact: true }).click();
  await storage.getByRole('combobox', { name: 'Source file' }).selectOption('demo.tsx');
  await expect(storage.getByRole('textbox', { name: 'demo.tsx' })).toHaveValue(/export function createDemo/);
  await expect(storage.getByRole('textbox', { name: 'demo.tsx' })).toHaveAttribute('readonly', '');
});
