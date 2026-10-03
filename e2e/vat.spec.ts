import { expect, startWithDemoData, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await startWithDemoData(page);
});

test('a VAT return is reviewed, filed, paid and undone', async ({ page }) => {
  await page.goto('#/vat');
  // The demo has filed its earlier quarters; the last one is waiting.
  await expect(page.getByText('Filed', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Review return' }).click();
  await expect(page).toHaveURL(/#\/vat\/\d{4}-\d{2}-01$/);
  await expect(page.getByText('Ready to file')).toBeVisible();
  await expect(page.getByText('VAT due on sales and other outputs')).toBeVisible();

  // Every figure can be traced back to its documents.
  await page.getByRole('button', { name: 'Box 4 transactions' }).click();
  await expect(page.getByRole('link', { name: /^Bill BILL-/ }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Mark as filed' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reference').fill('MTD-0001');
  await dialog.getByRole('button', { name: 'Mark as filed' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('h1').locator('..').getByText('Filed', { exact: true })).toBeVisible();
  await expect(page.getByText(/ref\. MTD-0001/)).toBeVisible();
  const filedReturn = page.url();

  const settle = page.getByRole('button', { name: /^Record (payment|refund)$/ });
  if (await settle.isVisible()) {
    await settle.click();
    await dialog.getByRole('button', { name: /^Record (payment|refund)$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/^(Paid|Received) on /)).toBeVisible();
  }

  // The closing entry is in the journals, and the books still balance.
  await page.goto('#/journals');
  await expect(page.getByText('VAT return', { exact: true }).first()).toBeVisible();
  await page.goto('#/reports/balance-sheet');
  await expect(page.getByText('Balanced', { exact: true })).toBeVisible();

  // Filing locked the period: undoing needs the lock removed first.
  await page.goto(filedReturn);
  await page.getByRole('button', { name: 'Undo filing' }).click();
  await dialog.getByRole('button', { name: 'Undo filing' }).click();
  await expect(page.getByText(/This period is locked/)).toBeVisible();

  await page.goto('#/settings/accounting');
  await page.getByRole('button', { name: 'Remove lock' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Remove lock' })).toBeHidden();
  await page.goto(filedReturn);
  await page.getByRole('button', { name: 'Undo filing' }).click();
  await dialog.getByRole('button', { name: 'Undo filing' }).click();
  await expect(page.getByText('Ready to file')).toBeVisible();
});

test('tax rates have a kind that decides where they are reported', async ({ page }) => {
  await page.goto('#/settings/taxes');
  await expect(page.getByLabel('Kind of No VAT')).toHaveValue('out_of_scope');
  await page.goto('#/settings/accounting');
  await expect(page.getByLabel('Return', { exact: true })).toHaveValue('uk');
});
