import { expect, test } from './fixtures';

test.use({ serviceWorkers: 'allow' });

test('keeps working without a connection once loaded', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByText('Almail Books now works offline')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome to Almail Books' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore with demo data' }).click();
  await expect(page.getByText('Invoiced vs collected')).toBeVisible();

  // Lazily loaded pages, the PDF engine and its fonts all come from the cache.
  await page.goto('#/invoices');
  await page.getByRole('link', { name: /^INV-/ }).first().click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
});
