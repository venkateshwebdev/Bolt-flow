import { expect, test, type Page } from '@playwright/test';
async function inspect(page: Page) {
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  return JSON.parse(await page.getByLabel('Document JSON').innerText());
}
for (const mode of ['controlled', 'uncontrolled']) test(`${mode} BoltFlow preserves fast ink, history, JSON and Strict Mode cleanup`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/e2e/flow.html?${mode}`);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.getByRole('button', { name: 'Pen', exact: true }).click();
  const box = (await page.locator('.bolt-canvas').boundingBox())!;
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(box.x + 50 + i * 120, box.y + 250);
    await page.mouse.down();
    await page.mouse.move(box.x + 100 + i * 120, box.y + 300);
    await page.mouse.up();
  }
  await expect(page.locator('[data-drawing-shape=pen]')).toHaveCount(6);
  const doc = await inspect(page);
  expect(doc.nodes).toHaveLength(8);
  expect(doc.nodes[0].data.selected).toBe('user data must survive');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-drawing-shape=pen]')).toHaveCount(5);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('[data-drawing-shape=pen]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('[data-drawing-shape=pen]')).toHaveCount(6);
  expect((await inspect(page)).nodes).toEqual(doc.nodes);
  await page.getByRole('button', { name: 'Check lifecycle' }).click();
  await expect(page.getByLabel('Lifecycle', { exact: true })).toHaveText('1');
  await page.getByRole('button', { name: 'Toggle mount' }).click();
  await page.getByRole('button', { name: 'Check lifecycle' }).click();
  await expect(page.getByLabel('Lifecycle', { exact: true })).toHaveText('0');
  expect(errors).toEqual([]);
});

test('controlled graph accepts external edits, connections, drag and undo without losing state', async ({ page }) => {
  await page.goto('/e2e/flow.html');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(page.locator('.react-flow__node').getByText('Renamed')).toBeVisible();
  expect((await inspect(page)).nodes[0].data.label).toBe('Renamed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.react-flow__node').getByText('Start')).toBeVisible();
  const node = page.locator('.react-flow__node[data-id=a]');
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 70, box.y + 20); await page.mouse.down();
  await page.mouse.move(box.x + 190, box.y + 180, { steps: 10 }); await page.mouse.up();
  const moved = (await inspect(page)).nodes[0].position;
  expect(moved.x).toBeGreaterThan(150); expect(moved.y).toBeGreaterThan(190);
  await expect(node).toHaveCSS('transform', `matrix(1, 0, 0, 1, ${moved.x}, ${moved.y})`);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await inspect(page)).nodes[0].position).toEqual({ x: 60, y: 60 });
  const source = (await node.locator('.source').boundingBox())!;
  const target = (await page.locator('.react-flow__node[data-id=b] .target').boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 }); await page.mouse.up();
  expect((await inspect(page)).edges).toHaveLength(1);
  await page.getByRole('button', { name: 'Remove finish', exact: true }).click();
  expect((await inspect(page)).nodes).toHaveLength(1);
  expect((await inspect(page)).edges).toHaveLength(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await inspect(page)).nodes).toHaveLength(2);
  expect((await inspect(page)).edges).toHaveLength(1);
});

test('controlled attachments follow live dragging and commit with their owner', async ({ page }) => {
  await page.goto('/e2e/flow.html');
  await page.getByRole('button', { name: 'Attach note', exact: true }).click();
  const before = await inspect(page);
  const note = before.nodes.find((node: { anchor?: unknown }) => node.anchor);
  const owner = page.locator('.react-flow__node[data-id=a]');
  const box = (await owner.boundingBox())!;
  await page.mouse.move(box.x + 70, box.y + 20); await page.mouse.down();
  await page.mouse.move(box.x + 170, box.y + 150, { steps: 8 });
  const position = await owner.evaluate(element => {
    const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: transform.m41, y: transform.m42 };
  });
  await expect(page.locator(`.react-flow__node[data-id="${note.id}"]`)).toHaveCSS('transform', `matrix(1, 0, 0, 1, ${position.x + note.anchor.offset.x}, ${position.y + note.anchor.offset.y})`);
  await page.mouse.up();
  const after = await inspect(page);
  const savedNote = after.nodes.find((node: { id: string }) => node.id === note.id);
  expect(savedNote.anchor).toEqual(note.anchor);
  expect(savedNote.position).toEqual({ x: after.nodes[0].position.x + note.anchor.offset.x, y: after.nodes[0].position.y + note.anchor.offset.y });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await inspect(page)).nodes).toEqual(before.nodes);
});
