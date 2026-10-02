import { readFile } from 'node:fs/promises';
import { test as base, expect, type Download, type Locator, type Page } from '@playwright/test';

/** Every test fails if the page throws or logs an error. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(`Uncaught: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`Console: ${message.text()}`);
      });
      await use(errors);
      expect(errors, 'errors reported by the page').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Opens the app on a fresh browser profile and loads the demo company. */
export async function startWithDemoData(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Explore with demo data' }).click();
  await expect(page.getByText('Invoiced vs collected')).toBeVisible();
}

/** Runs `action` and returns the file the app downloads because of it. */
export async function downloadFrom(
  page: Page,
  action: () => Promise<void>,
): Promise<{ file: Download; content: Buffer }> {
  const pending = page.waitForEvent('download');
  await action();
  const file = await pending;
  return { file, content: await readFile(await file.path()) };
}

/** Picks an option in one of the app's searchable selects. */
export async function chooseOption(
  page: Page,
  trigger: Locator,
  search: { placeholder: string; query: string; option?: string },
) {
  await trigger.click();
  await page.getByPlaceholder(search.placeholder).fill(search.query);
  await page
    .getByRole('option', { name: search.option ?? search.query })
    .first()
    .click();
}
