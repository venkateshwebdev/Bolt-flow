import { test, expect, type Page } from '@playwright/test';
import type { BoltDocument } from '../packages/core/src/index';

async function enable(page: Page, name: string) {
  await page.getByRole('button', { name: 'Open plugin settings', exact: true }).click();
  const card = page.locator('.plugin-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await card.getByRole('button', { name: 'Enable', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Enabled', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
}
async function downloadJson(page: Page): Promise<BoltDocument> {
  const next = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export canvas', exact: true }).click();
  const stream = await (await next).createReadStream();
  if (!stream) throw new Error('No download stream');
  const parts: Buffer[] = [];
  for await (const chunk of stream) parts.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(parts).toString());
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}
async function start(page: Page) {
  await page.goto('/');
  await expect(page.locator('.flow-card')).toHaveCount(6);
  await expect(page.getByRole('button', { name: '1 plugins', exact: true })).toBeVisible();
}

test('graph editing, shared history, layout, and plugin unloading', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await page.getByRole('button', { name: 'Add idea node (N)', exact: true }).click();
  await expect(page.locator('.flow-card')).toHaveCount(7);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A tested idea');
  await page.getByRole('textbox', { name: 'Title', exact: true }).blur();
  await page.getByRole('button', { name: 'Undo (⌘Z)', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Your next big idea');
  await page.getByRole('button', { name: 'Redo (⌘⇧Z)', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('A tested idea');
  await page.getByRole('button', { name: 'Auto layout', exact: true }).click();
  await expect(page.locator('.toast[role="status"]')).toContainText('Layout updated');
  await page.getByRole('button', { name: 'Open plugin settings', exact: true }).click();
  await page.locator('.plugin-card').filter({ hasText: 'Time machine' }).getByRole('button', { name: 'Enabled', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo (⌘Z)', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('ink is a native graph object, stays visible in Flow, and uses the same undo', async ({ page }) => {
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await start(page);
  expect(requests.some((url) => url.includes('perfect-freehand') || url.includes('perfect_freehand'))).toBe(false);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Pen tool', exact: true }).click();
  await expect(page.getByTestId('drawing-overlay')).toBeVisible();
  const stage = await page.locator('.canvas-stage').boundingBox(); if (!stage) throw new Error('Missing canvas');
  await drag(page, { x: stage.x + 180, y: stage.y + 120 }, { x: stage.x + 360, y: stage.y + 210 });
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(1);
  await expect(page.locator('.flow-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Flow', exact: true }).click();
  await expect(page.locator('.bolt-drawing-node')).toBeVisible();
  await expect(page.getByTestId('drawing-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo (⌘Z)', exact: true }).click();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo (⌘⇧Z)', exact: true }).click();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(1);
  const doc = await downloadJson(page);
  expect(doc.nodes.find((node) => node.role === 'annotation')?.data.shape).toBe('pen');
  expect(requests.some((url) => url.includes('excalidraw'))).toBe(false);
  expect(errors).toEqual([]);
});

test('connected comments follow node dragging, support replies, and retain offsets through layout', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Comment tool', exact: true }).click();
  await page.getByLabel('Attach new annotations to').selectOption('research');
  await page.getByRole('textbox', { name: 'New annotation text', exact: true }).fill('Check the accessibility requirements');
  const stage = await page.locator('.canvas-stage').boundingBox(); if (!stage) throw new Error('Missing canvas');
  await page.mouse.click(stage.x + 430, stage.y + 280);
  await expect(page.locator('.bolt-comment-node')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Reply', exact: true }).fill('Include keyboard navigation');
  await page.getByRole('button', { name: 'Add reply', exact: true }).click();
  await expect(page.locator('.reply')).toContainText('Include keyboard navigation');
  await page.getByRole('button', { name: 'Flow', exact: true }).click();
  const commentBefore = await page.locator('.bolt-comment-node').boundingBox();
  const owner = await page.locator('.react-flow__node[data-id="research"]').boundingBox();
  if (!owner || !commentBefore) throw new Error('Missing graph objects');
  await drag(page, { x: owner.x + owner.width / 2, y: owner.y + 25 }, { x: owner.x + owner.width / 2 + 65, y: owner.y + 65 });
  const commentAfter = await page.locator('.bolt-comment-node').boundingBox();
  const ownerAfter = await page.locator('.react-flow__node[data-id="research"]').boundingBox();
  expect(ownerAfter!.x - owner.x).toBeGreaterThan(40);
  expect(commentAfter!.x - commentBefore.x).toBeCloseTo(ownerAfter!.x - owner.x, 0);
  expect(commentAfter!.y - commentBefore.y).toBeCloseTo(ownerAfter!.y - owner.y, 0);
  await page.getByRole('button', { name: 'Auto layout', exact: true }).click();
  const doc = await downloadJson(page);
  const annotation = doc.nodes.find((node) => node.type === 'bolt-comment')!, parent = doc.nodes.find((node) => node.id === 'research')!;
  expect(annotation.anchor?.nodeId).toBe('research');
  expect(annotation.position.x).toBe(parent.position.x + annotation.anchor!.offset.x);
  expect(annotation.data.replies).toHaveLength(1);
});

test('smart arrows become styled real graph connections', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Smart arrow tool', exact: true }).click();
  const source = await page.locator('.react-flow__node[data-id="idea"]').boundingBox(), target = await page.locator('.react-flow__node[data-id="launch"]').boundingBox();
  if (!source || !target) throw new Error('Missing workflow steps');
  await drag(page, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, { x: target.x + target.width / 2, y: target.y + target.height / 2 });
  await expect(page.locator('.toast[role="status"]')).toContainText('real workflow edge');
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Edge label', exact: true }).fill('Fast track');
  await page.getByLabel('Edge routing', { exact: true }).selectOption('straight');
  await page.getByRole('checkbox', { name: 'Dashed edge', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Animate edge', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Arrowhead', exact: true }).uncheck();
  const doc = await downloadJson(page);
  expect(doc.edges).toHaveLength(7);
  expect(doc.edges.find((edge) => edge.label === 'Fast track')).toMatchObject({ source: 'idea', target: 'launch', type: 'straight', animated: true, markerEnd: false, style: { strokeDasharray: '8 5' } });
});

test('node style controls persist and promoted sketches retain their identity', async ({ page }) => {
  await start(page);
  await page.locator('.flow-card').first().click();
  await page.getByRole('spinbutton', { name: 'Node width', exact: true }).fill('300');
  await page.getByRole('slider', { name: 'Corner radius', exact: true }).focus();
  await page.keyboard.press('End');
  await page.getByRole('textbox', { name: 'CSS class', exact: true }).fill('my-custom-card');
  const doc = await downloadJson(page);
  expect(doc.nodes[0]).toMatchObject({ width: 300, className: 'my-custom-card', style: { borderRadius: 60 } });
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle tool', exact: true }).click();
  const stage = await page.locator('.canvas-stage').boundingBox(); if (!stage) throw new Error('Missing canvas');
  await drag(page, { x: stage.x + 300, y: stage.y + 160 }, { x: stage.x + 470, y: stage.y + 260 });
  await page.getByRole('button', { name: 'Select tool', exact: true }).click();
  await page.getByRole('button', { name: 'Promote to workflow step', exact: true }).click();
  await expect(page.locator('.flow-card')).toHaveCount(7);
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(0);
});

test('local persistence and plugin choices restore on reload', async ({ page }) => {
  await start(page);
  await enable(page, 'Local autosave');
  await page.getByRole('textbox', { name: 'Canvas name', exact: true }).fill('Saved browser canvas');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bolt-flow:playground:v1') ?? '{}').name)).toBe('Saved browser canvas');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Canvas name', exact: true })).toHaveValue('Saved browser canvas');
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }, { width: 390, height: 844 }]) {
  test(`viewport ${viewport.width}×${viewport.height} keeps the canvas and controls on screen`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await start(page);
    await page.getByRole('button', { name: 'Draw', exact: true }).click();
    await expect(page.getByRole('toolbar', { name: 'Drawing tool selection' })).toBeVisible();
    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector('.canvas-stage')!.getBoundingClientRect();
      const status = document.querySelector('.workbench-status')!.getBoundingClientRect();
      return { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, canvasHeight: canvas.height, bottom: status.bottom };
    });
    expect(metrics.width).toBe(viewport.width);
    expect(metrics.height).toBe(viewport.height);
    expect(metrics.canvasHeight).toBeGreaterThan(180);
    expect(metrics.bottom).toBeLessThanOrEqual(viewport.height);
    await expect.poll(() => page.evaluate(() => {
      const canvas = document.querySelector('.canvas-stage')!.getBoundingClientRect();
      return [...document.querySelectorAll('.flow-card')].every((node) => {
        const box = node.getBoundingClientRect();
        return box.top >= canvas.top && box.bottom <= canvas.bottom && box.left >= canvas.left && box.right <= canvas.right;
      });
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('native-canvas.png') });
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('textbox', { name: 'Search commands', exact: true }).fill('Add an idea');
    await page.getByRole('button', { name: 'Add an idea node N', exact: true }).click();
    await expect(page.locator('.flow-card')).toHaveCount(7);
    await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
    await expect(page.locator('.inspector')).toHaveCount(0);
  });
}

test('cancelled gestures leave no ink; zoomed shapes resize and erase with undo', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Pen tool', exact: true }).click();
  await expect(page.getByTestId('drawing-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Reset zoom to 100 percent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset zoom to 100 percent', exact: true })).toHaveText('100%');
  const box = await page.locator('.canvas-stage').boundingBox(); if (!box) throw new Error('No canvas');
  const from = { x: box.x + 250, y: box.y + 120 }, to = { x: box.x + 410, y: box.y + 220 };
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ellipse tool', exact: true }).click();
  await drag(page, from, to);
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(1);
  await page.getByRole('button', { name: 'Select tool', exact: true }).click();
  const shape = page.locator('.react-flow__node-bolt-drawing');
  const before = await shape.boundingBox(); if (!before) throw new Error('No shape');
  expect(before.width).toBeCloseTo(176, 0);
  expect(before.height).toBeCloseTo(116, 0);
  const handle = await shape.locator('.react-flow__resize-control.handle.bottom.right').boundingBox();
  if (!handle) throw new Error('No resize handle');
  await drag(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { x: handle.x + handle.width / 2 + 60, y: handle.y + handle.height / 2 + 35 });
  await expect.poll(async () => (await shape.boundingBox())!.width).toBeGreaterThan(before.width + 40);
  const doc = await downloadJson(page);
  expect(doc.nodes.find((node) => node.role === 'annotation')!.width).toBeGreaterThan(216);
  await page.getByRole('button', { name: 'Eraser tool', exact: true }).click();
  await page.mouse.click(before.x + 20, before.y + 20);
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(0);
  await expect(page.locator('.flow-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Undo (⌘Z)', exact: true }).click();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(1);
});

test('comment resolution and JSON reload preserve native data across plugin removal', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Comment tool', exact: true }).click();
  await page.getByRole('textbox', { name: 'New annotation text', exact: true }).fill('A portable discussion');
  const box = await page.locator('.canvas-stage').boundingBox(); if (!box) throw new Error('No canvas');
  await page.mouse.click(box.x + 350, box.y + 330);
  await page.getByRole('button', { name: 'Resolve discussion', exact: true }).click();
  await expect(page.locator('.bolt-comment-node')).toHaveClass(/is-resolved/);
  await page.getByRole('button', { name: 'Reopen discussion', exact: true }).click();
  await expect(page.locator('.bolt-comment-node')).not.toHaveClass(/is-resolved/);
  const doc = await downloadJson(page);
  await page.getByRole('button', { name: 'Open plugin settings', exact: true }).click();
  await page.locator('.plugin-card').filter({ has: page.getByRole('heading', { name: 'Connected ink', exact: true }) }).getByRole('button', { name: 'Enabled', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.locator('.bolt-missing-node')).toHaveCount(1);
  await page.locator('input[type="file"]').setInputFiles({ name: 'native.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.toast')).toContainText('Canvas imported');
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await expect(page.locator('.bolt-comment-node')).toContainText('A portable discussion');
  await expect(page.locator('.bolt-missing-node')).toHaveCount(0);
  expect((await downloadJson(page)).nodes).toEqual(doc.nodes);
});

test('global and per-object styles affect rendered nodes and edges', async ({ page }) => {
  await start(page);
  await page.getByLabel('Default node background', { exact: true }).fill('#dbeafe');
  await expect(page.locator('.react-flow__node').first()).toHaveCSS('background-color', 'rgb(219, 234, 254)');
  await page.getByLabel('Default edge color', { exact: true }).fill('#123456');
  await expect(page.locator('.react-flow__edge-path').first()).toHaveCSS('stroke', 'rgb(18, 52, 86)');
  await page.locator('.flow-card').first().click();
  await page.getByLabel('Node background', { exact: true }).fill('#fef3c7');
  await expect(page.locator('.react-flow__node').first()).toHaveCSS('background-color', 'rgb(254, 243, 199)');
  await page.getByRole('button', { name: 'Canvas style settings', exact: true }).click();
  await page.getByLabel('Default node background', { exact: true }).fill('#dcfce7');
  await expect(page.locator('.react-flow__node').first()).toHaveCSS('background-color', 'rgb(254, 243, 199)');
  await expect(page.locator('.react-flow__node').nth(1)).toHaveCSS('background-color', 'rgb(220, 252, 231)');
});

test('Draw opens in Select and moving nodes never pans or refits the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page);
  const viewport = () => page.locator('.react-flow__viewport').evaluate((el) => (el as HTMLElement).style.transform);
  const initial = await viewport();
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('drawing-overlay')).toHaveCount(0);
  expect(await viewport()).toBe(initial);
  const node = page.locator('.react-flow__node[data-id="idea"]');
  await node.click();
  expect(await viewport()).toBe(initial);
  const before = (await node.boundingBox())!;
  await drag(page, { x: before.x + 60, y: before.y + 55 }, { x: before.x + 125, y: before.y + 95 });
  expect((await node.boundingBox())!.x - before.x).toBeGreaterThan(50);
  expect(await viewport()).toBe(initial);
  await expect(page.locator('.inspector')).toBeVisible();
  await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
  expect(await viewport()).toBe(initial);
  await page.getByRole('button', { name: 'Pen tool', exact: true }).click();
  const canvas = (await page.locator('.canvas-stage').boundingBox())!;
  await drag(page, { x: canvas.x + 220, y: canvas.y + 220 }, { x: canvas.x + 310, y: canvas.y + 300 });
  await expect(page.getByRole('button', { name: 'Select tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await viewport()).toBe(initial);
  await page.getByRole('button', { name: 'Pan tool', exact: true }).click();
  await drag(page, { x: canvas.x + 90, y: canvas.y + 330 }, { x: canvas.x + 140, y: canvas.y + 370 });
  expect(await viewport()).not.toBe(initial);
});

test('host shapes and fonts appear automatically and round-trip as portable data', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Triangle tool', exact: true }).click();
  const box = (await page.locator('.canvas-stage').boundingBox())!;
  await drag(page, { x: box.x + 240, y: box.y + 240 }, { x: box.x + 410, y: box.y + 350 });
  await expect(page.locator('[data-drawing-shape="triangle"] path')).toHaveAttribute('d', /M.*L.*Z/);
  await page.getByRole('button', { name: 'Text tool', exact: true }).click();
  const fonts = page.getByRole('combobox', { name: 'Drawing font', exact: true });
  await expect(fonts.locator('option')).toHaveText(['Normal', 'Handwritten', 'Code', 'Editorial']);
  await fonts.selectOption({ label: 'Handwritten' });
  await page.getByRole('textbox', { name: 'New annotation text', exact: true }).fill('Sketch an idea. Make it real.');
  await page.mouse.click(box.x + 460, box.y + 370);
  await expect(page.locator('.bolt-ink-text')).toHaveCSS('font-family', '"Gochi Hand", cursive');
  expect(await page.evaluate(async () => { await document.fonts.load('22px "Gochi Hand"'); return document.fonts.check('22px "Gochi Hand"'); })).toBe(true);
  await page.getByRole('combobox', { name: 'Font family', exact: true }).selectOption({ label: 'Code' });
  await expect(page.locator('.bolt-ink-text')).toHaveCSS('font-family', /monospace/);
  await page.getByRole('combobox', { name: 'Font family', exact: true }).selectOption({ label: 'Handwritten' });
  await page.screenshot({ path: testInfo.outputPath('custom-shapes-and-fonts.png') });
  const doc = await downloadJson(page);
  expect(doc.nodes.find((node) => node.data.shape === 'triangle')?.data.customPath).toMatch(/M.*L.*Z/);
  expect(doc.nodes.find((node) => node.data.shape === 'text')?.data.fontFamily).toContain('Gochi Hand');
  await page.locator('input[type="file"]').setInputFiles({ name: 'custom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('[data-drawing-shape="triangle"]')).toHaveCount(1);
  await expect(page.locator('.bolt-ink-text')).toHaveText('Sketch an idea. Make it real.');
  expect(errors).toEqual([]);
});