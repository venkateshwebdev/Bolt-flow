import { test, expect, type Page } from '@playwright/test';
import type { BoltDocument } from '../packages/core/src/index';
async function start(page: Page) { await page.goto('/playground'); await expect(page.locator('.flow-card')).toHaveCount(6); }
async function exported(page: Page): Promise<BoltDocument> {
  const next = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export canvas', exact: true }).click();
  const stream = await (await next).createReadStream(); const parts: Buffer[] = [];
  for await (const chunk of stream!) parts.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(parts).toString());
}
const fixture = (): BoltDocument => ({ schemaVersion: 2, id: 'drawing-example', name: 'Drawing example', edges: [], extensions: {}, nodes: [
  { id: 'owner', type: 'bolt', position: { x: 0, y: 0 }, width: 240, height: 148, data: { label: 'Workflow step', kind: 'idea' } },
  { id: 'arrow', type: 'bolt-drawing', role: 'annotation', position: { x: 300, y: 0 }, width: 180, height: 80, anchor: { nodeId: 'owner', offset: { x: 300, y: 0 } }, data: { shape: 'arrow', points: [[8, 8, .5], [160, 60, .5]], originalWidth: 180, originalHeight: 80, color: '#7963d2', size: 3, fill: 'none', label: 'Arrow' } },
  { id: 'note', type: 'bolt-drawing', role: 'annotation', position: { x: 300, y: 150 }, width: 240, height: 100, anchor: { nodeId: 'arrow', offset: { x: 0, y: 150 } }, data: { shape: 'text', label: 'Editable note', color: 'auto', fontSize: 22 } },
] });
async function loadFixture(page: Page) {
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'drawing.bolt.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture())) });
  await expect(page.locator('.bolt-rich-display').filter({ hasText: 'Editable note' })).toBeVisible();
  await page.locator('.react-flow__node[data-id=owner]').click({ trial: true });
}
test('manual Save is explicit, load restores, and plugin removal does not write', async ({ page }) => {
  await start(page);
  await page.getByRole('textbox', { name: 'Canvas name', exact: true }).fill('Manual save example');
  expect(await page.evaluate(() => localStorage.getItem('bolt-flow:playground:v1'))).toBeNull();
  await page.getByRole('button', { name: 'Save canvas', exact: true }).click();
  await expect(page.locator('.save-state')).toHaveText('Saved in this browser');
  await page.getByRole('textbox', { name: 'Canvas name', exact: true }).fill('Still unsaved');
  await expect(page.locator('.save-state')).toHaveText('Unsaved changes');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bolt-flow:playground:v1')!).name)).toBe('Manual save example');
  page.once('dialog', dialog => dialog.accept()); await page.getByLabel('Save options', { exact: true }).click(); await page.getByRole('button', { name: 'Open saved', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Canvas name', exact: true })).toHaveValue('Manual save example');
  await page.getByRole('textbox', { name: 'Canvas name', exact: true }).fill('Not flushed');
  await page.getByRole('button', { name: 'Open plugin settings', exact: true }).click();
  await page.locator('.plugin-card').filter({ hasText: 'Canvas persistence' }).getByRole('button', { name: 'Enabled', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bolt-flow:playground:v1')!).name)).toBe('Manual save example');
});
test('inline rich text commits one undoable change and survives JSON', async ({ page }) => {
  await start(page); await loadFixture(page);
  await page.locator('[data-id=note] .bolt-rich-display').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit annotation text' });
  await editor.fill('Formatted note'); await editor.press('ControlOrMeta+a');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(editor).toHaveCount(0);
  const doc = await exported(page);
  const rich = doc.nodes.find(n => n.id === 'note')!.data.richText as { blocks: { runs: { text: string; bold?: boolean }[] }[] };
  expect(rich.blocks[0].runs[0]).toMatchObject({ text: 'Formatted note', bold: true });
  await page.getByRole('button', { name: 'Undo (⌘Z)', exact: true }).click();
  await expect(page.locator('[data-id=note] .bolt-rich-display')).toHaveText('Editable note');
});
test('Save view restores the viewport and the save shortcut respects the option', async ({ page }) => {
  await start(page);
  await page.getByLabel('Save options', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Save view', exact: true }).check();
  await page.getByRole('button', { name: 'Save canvas', exact: true }).click();
  await expect(page.locator('.save-state')).toHaveText('Saved in this browser');
  const before = await page.locator('.react-flow__viewport').getAttribute('style');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.react-flow__viewport')).not.toHaveAttribute('style', before!);
  await page.getByLabel('Save options', { exact: true }).click();
  await page.getByRole('button', { name: 'Open saved', exact: true }).click();
  await expect(page.locator('.react-flow__viewport')).toHaveAttribute('style', before!);
  await page.getByLabel('Save options', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Save view', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Save view', exact: true }).press('ControlOrMeta+s');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bolt-flow:playground:v1')!).view)).toBeUndefined();
});
test('layer groups, hide and lock persist and prevent canvas editing', async ({ page }) => {
  await start(page); await loadFixture(page);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Arrow', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select Editable note', exact: true }).check();
  await page.getByRole('button', { name: 'Group', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Editable note', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Select Editable note', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Hide Arrow', exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id=arrow]')).toHaveCount(0);
  const doc = await exported(page), note = doc.nodes.find(n => n.id === 'note')!, arrow = doc.nodes.find(n => n.id === 'arrow')!;
  expect(note.groupId).toBeTruthy(); expect(note.groupId).toBe(arrow.groupId); expect(note.locked).toBe(true); expect(arrow.hidden).toBe(true);
  await page.getByRole('button', { name: 'Show Arrow', exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id=arrow]')).toBeVisible();
});
test('two-level attachments follow live dragging and preserve offsets after commit', async ({ page }) => {
  await start(page); await loadFixture(page);
  const owner = page.locator('.react-flow__node[data-id=owner]'), note = page.locator('.react-flow__node[data-id=note]');
  const before = await owner.boundingBox(), noteBefore = await note.boundingBox();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + 25); await page.mouse.down();
  await page.mouse.move(before!.x + before!.width / 2 + 50, before!.y + 60, { steps: 10 });
  const during = await note.boundingBox(); expect(during!.x - noteBefore!.x).toBeGreaterThan(30);
  await page.mouse.up();
  const doc = await exported(page), a = doc.nodes.find(n => n.id === 'arrow')!, n = doc.nodes.find(n => n.id === 'note')!;
  expect(n.position).toEqual({ x: a.position.x + n.anchor!.offset.x, y: a.position.y + n.anchor!.offset.y });
});
test('workspace customization hides tools and round-trips presets', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Customize workspace' }).click();
  await page.getByRole('checkbox', { name: 'pen', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save preset', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pen tool', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rectangle tool', exact: true })).toBeVisible();
  const doc = await exported(page);
  expect((doc.extensions.drawing as { hiddenTools: string[] }).hiddenTools).toContain('pen');
  expect(doc.extensions.workspacePresets).toHaveLength(1);
});
test('PNG export captures the full canvas without changing the viewport', async ({ page }, testInfo) => {
  await start(page);
  const before = await page.locator('.react-flow__viewport').getAttribute('style');
  const next = page.waitForEvent('download'); await page.getByRole('button', { name: 'PNG', exact: true }).click();
  const download = await next; expect(download.suggestedFilename()).toMatch(/\.png$/);
  const stream = await download.createReadStream(); const parts: Buffer[] = [];
  for await (const chunk of stream!) parts.push(Buffer.from(chunk));
  const image = Buffer.concat(parts); expect(image.subarray(1, 4).toString()).toBe('PNG');
  expect(image.readUInt32BE(16)).toBeGreaterThan(2000);
  expect(await page.locator('.react-flow__viewport').getAttribute('style')).toBe(before);
  await download.saveAs(testInfo.outputPath('canvas.png'));
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  const fromCode = page.waitForEvent('download'); await page.getByRole('button', { name: 'PNG', exact: true }).click();
  const codeStream = await (await fromCode).createReadStream(); const codeParts: Buffer[] = [];
  for await (const chunk of codeStream!) codeParts.push(Buffer.from(chunk));
  expect(Buffer.concat(codeParts)).toEqual(image);
});

test('JSON studio validates generated canvases and inserts them with fresh IDs', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'JSON studio', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Canvas JSON' });
  await input.fill('{invalid'); await page.getByRole('button', { name: 'Preview JSON' }).click();
  await expect(page.getByRole('button', { name: 'Replace canvas' })).toBeDisabled();
  await input.fill(JSON.stringify(fixture())); await page.getByRole('button', { name: 'Preview JSON' }).click();
  await page.getByRole('button', { name: 'Insert objects' }).click();
  const doc = await exported(page);
  expect(doc.nodes).toHaveLength(9);
  const note = doc.nodes.find(n => n.data.label === 'Editable note')!;
  expect(note.id).not.toBe('note'); expect(doc.nodes.some(n => n.id === note.anchor!.nodeId)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('bolt-flow:playground:v1'))).toBeNull();
});
test('an unfilled ellipse allows the workflow step beneath it to be selected', async ({ page }) => {
  await start(page); await loadFixture(page);
  const owner = await page.locator('.react-flow__node[data-id=owner]').boundingBox();
  await page.getByRole('button', { name: 'Ellipse tool', exact: true }).click();
  await page.mouse.move(owner!.x - 8, owner!.y - 8); await page.mouse.down();
  await page.mouse.move(owner!.x + owner!.width + 8, owner!.y + owner!.height + 8, { steps: 10 }); await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Select tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-drawing-shape=ellipse]')).toHaveCount(1);
  await page.locator('.react-flow__node[data-id=owner]').click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Workflow step');
});

test('editable edge waypoints can be added and round-trip as JSON', async ({ page }) => {
  await start(page);
  const doc = fixture();
  doc.nodes = doc.nodes.filter(node => node.role !== 'annotation');
  doc.nodes.push({ id: 'end', type: 'bolt', position: { x: 700, y: 0 }, width: 240, height: 148, data: { label: 'End step' } });
  doc.edges.push({ id: 'route', source: 'owner', target: 'end', type: 'bolt-waypoint', data: { points: [] } });
  await page.locator('input[type=file]').setInputFiles({ name: 'route.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  const edge = page.locator('.react-flow__edge[data-id=route] .react-flow__edge-interaction');
  await expect(edge).toHaveCount(1);
  // A horizontal SVG path has zero bounding-box height; click its painted stroke.
  await expect(page.locator('.react-flow__node[data-id=end]')).toBeVisible();
  await page.locator('.react-flow__node[data-id=end]').click({ trial: true });
  const midpoint = await edge.evaluate(element => {
    const path = element as SVGPathElement;
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    return new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()!);
  });
  await page.mouse.dblclick(midpoint.x, midpoint.y);
  await expect(page.getByRole('button', { name: 'Waypoint 1', exact: true })).toBeVisible();
  const saved = await exported(page);
  expect(saved.edges[0].data!.points).toHaveLength(1);
});
