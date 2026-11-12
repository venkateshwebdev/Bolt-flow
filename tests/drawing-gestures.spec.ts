import { expect, test } from '@playwright/test';

test('fast gestures survive host rerenders and preserve their release point in JSON and history', async ({ page }) => {
  await page.goto('/e2e/drawing.html');
  const canvas = page.locator('.bolt-canvas');
  await expect(page.getByTestId('drawing-overlay')).toBeVisible();
  const box = (await canvas.boundingBox())!;
  for (const tool of ['Pen', 'Rectangle']) {
    await page.getByRole('button', { name: tool, exact: true }).click();
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(box.x + 40, box.y + 50 + i * 60);
      await page.mouse.down();
      await page.mouse.move(box.x + 170, box.y + 65 + i * 60);
      // A single move re-renders the host and replaces its inline callback.
      await page.mouse.up();
    }
  }
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(8);
  await page.getByRole('button', { name: 'Inspect JSON' }).click();
  const doc = JSON.parse(await page.getByLabel('Document JSON').innerText());
  expect(doc.nodes).toHaveLength(8);
  for (const node of doc.nodes) {
    const end = node.data.points.at(-1);
    expect(node.position.x + end[0]).toBeCloseTo(170, 1);
  }
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(7);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(8);
});

test('coalesced fast pen samples survive a loop back to the starting point', async ({ page }) => {
  await page.goto('/e2e/drawing.html');
  const overlay = page.getByTestId('drawing-overlay');
  await expect(overlay).toBeVisible();
  const box = (await overlay.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 60);
  await page.mouse.down();
  await overlay.evaluate((element, box) => {
    const pointer = (x: number, y: number) => new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: box.x + x, clientY: box.y + y });
    const move = pointer(40, 60);
    Object.defineProperty(move, 'getCoalescedEvents', { value: () => [pointer(180, 80), pointer(180, 160), pointer(40, 60)] });
    element.dispatchEvent(move);
  }, box);
  await page.mouse.up();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(1);
  await page.getByRole('button', { name: 'Inspect JSON' }).click();
  const node = JSON.parse(await page.getByLabel('Document JSON').innerText()).nodes[0];
  const positions = node.data.points.map((p: number[]) => [p[0] + node.position.x, p[1] + node.position.y]);
  expect(positions).toContainEqual([180, 80]);
  expect(positions).toContainEqual([180, 160]);
  expect(node.width).toBeGreaterThan(140);
});

test('release outside the canvas commits, but cancel and tool changes discard only the draft', async ({ page }) => {
  await page.goto('/e2e/drawing.html');
  await expect(page.getByTestId('drawing-overlay')).toBeVisible();
  const box = (await page.locator('.bolt-canvas').boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + box.height + 30);
  await page.mouse.up();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(1);
  await page.mouse.move(box.x + 40, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 130);
  await page.getByTestId('drawing-overlay').dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(1);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 160);
  await page.getByRole('button', { name: 'Select', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await page.mouse.up();
  await expect(page.locator('.bolt-drawing-node')).toHaveCount(1);
});
