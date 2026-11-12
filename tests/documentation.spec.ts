import { expect, test } from '@playwright/test';

const slugs = ['overview', 'quickstart', 'react-flow', 'playground', 'document-model', 'react-editor', 'nodes-edges', 'drawing', 'styling', 'commands-plugins', 'persistence', 'workflow-json', 'export', 'recipes', 'api-reference', 'troubleshooting'];

test('documentation routes serve every guide and valid table-of-contents anchors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/docs$/);
  for (const slug of slugs) {
    await page.goto(`/docs/${slug}`);
    await expect(page.locator('.docs-article h1')).toHaveCount(1);
    expect((await page.locator('.docs-article').innerText()).length).toBeGreaterThan(2000);
    expect(await page.locator('.docs-toc nav a').evaluateAll(links => links.every(link => {
      const id = (link as HTMLAnchorElement).hash.slice(1);
      return !!document.getElementById(decodeURIComponent(id));
    }))).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('search, code copy, deep links and missing pages are usable', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/docs');
  await page.getByRole('searchbox', { name: 'Search documentation' }).fill('ETag');
  await page.locator('.docs-search-results').getByRole('link', { name: /Saving & storage/ }).click();
  await expect(page).toHaveURL(/\/docs\/persistence$/);
  const firstCode = page.locator('.docs-code').first();
  const expected = (await firstCode.locator('pre').innerText()).replace(/\n$/, '');
  await firstCode.getByRole('button', { name: 'Copy code' }).click();
  await expect(firstCode).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  const heading = page.locator('.docs-toc nav a').nth(1);
  const hash = await heading.getAttribute('href');
  await heading.click();
  await expect(page).toHaveURL(new RegExp(`${hash}$`));
  await page.reload();
  await expect(page.locator(`h2${hash}`)).toBeInViewport();
  await page.goto('/docs/missing');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('mobile docs navigation closes after choosing a guide and content stays within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs');
  const toggle = page.getByRole('button', { name: 'Browse documentation' });
  await toggle.click();
  await page.getByRole('navigation', { name: 'Reference', exact: true }).getByRole('link', { name: 'API reference', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.docs-article h1')).toHaveText('API reference');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('visiting documentation preserves an unsaved playground document and history', async ({ page }) => {
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Idea', exact: true }).click();
  await expect(page.locator('.flow-card')).toHaveCount(7);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page.locator('.docs-article h1')).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Playground', exact: true }).click();
  await expect(page.locator('.flow-card')).toHaveCount(7);
  await page.getByRole('button', { name: 'Undo (⌘Z)', exact: true }).click();
  await expect(page.locator('.flow-card')).toHaveCount(6);
});

test('playground dialogs trap keyboard focus, close with Escape and return focus', async ({ page }) => {
  await page.goto('/playground');
  const trigger = page.getByRole('button', { name: 'Customize workspace', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
