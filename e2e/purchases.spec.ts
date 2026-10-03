import { chooseOption, expect, startWithDemoData, test } from './fixtures';

// A 1×1 PNG, enough to stand in for a photo of a receipt.
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeEach(async ({ page }) => {
  await startWithDemoData(page);
});

test('a bill is recorded with its scan, paid, and kept in the books', async ({ page }) => {
  await page.goto('#/bills/new');
  await chooseOption(page, page.getByLabel('Vendor', { exact: true }), {
    placeholder: 'Search vendors…',
    query: 'Cloudline',
    option: 'Cloudline Software Ltd',
  });
  await page.getByLabel("Vendor's invoice number").fill('CL-INV-0101');
  await chooseOption(page, page.getByRole('button', { name: 'Line 1 category' }), {
    placeholder: 'Search accounts…',
    query: 'Software',
    option: '7600 Software and subscriptions',
  });
  await page.getByLabel('Line 1 description').fill('Hosting — October');
  await page.getByLabel('Line 1 rate').fill('100');
  await expect(page.getByLabel('Line 1 amount')).toHaveText('£100.00');
  await page
    .getByLabel('Attach a file')
    .setInputFiles({ name: 'bill-scan.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(page.getByText('bill-scan.png')).toBeVisible();

  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/bills\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Bill BILL-/);
  const title = page.locator('h1').locator('..');
  await expect(title.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText('their ref. CL-INV-0101')).toBeVisible();
  await expect(page.getByText('7600 Software and subscriptions')).toBeVisible();
  await expect(page.getByText('bill-scan.png')).toBeVisible();

  await page.getByRole('button', { name: 'Record payment' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/^Amount/)).toHaveValue(/120/);
  await dialog.getByRole('button', { name: 'Record payment' }).click();
  await expect(dialog).toBeHidden();
  await expect(title.getByText('Paid', { exact: true })).toBeVisible();
  await expect(page.getByText('Balance due').locator('..')).toContainText('£0.00');

  await page.goto('#/payments-made');
  await expect(page.getByRole('row', { name: /Cloudline Software Ltd.*£120\.00/ })).toBeVisible();
  await page.goto('#/payments');
  await expect(page.getByText('Cloudline Software Ltd')).toHaveCount(0);

  await page.goto('#/reports/balance-sheet');
  await expect(page.getByText('Balanced', { exact: true })).toBeVisible();
});

test('an expense is recorded with a photo of the receipt', async ({ page }) => {
  await page.goto('#/expenses');
  await page.getByRole('button', { name: 'Record expense' }).click();
  const dialog = page.getByRole('dialog');
  await chooseOption(page, dialog.getByLabel('Category'), {
    placeholder: 'Search accounts…',
    query: 'Printing',
    option: '7500 Printing, postage and stationery',
  });
  await dialog.getByLabel('Amount paid').fill('36');
  await dialog.getByLabel('Tax included').click();
  await page.getByRole('button', { name: 'VAT 20%' }).click();
  await dialog.getByLabel('Description').fill('Courier envelopes');
  await expect(dialog.getByText('Includes £6.00 tax')).toBeVisible();
  await dialog
    .getByLabel('Attach a file')
    .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(dialog.getByText('receipt.png')).toBeVisible();
  await dialog.getByRole('button', { name: 'Record expense' }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole('row', { name: /Courier envelopes/ });
  await expect(row).toContainText('£36.00');
  await expect(row.getByLabel('Receipt attached')).toBeVisible();

  await row.getByRole('button', { name: 'Courier envelopes' }).click();
  await expect(dialog.getByText('receipt.png')).toBeVisible();
  await expect(dialog.getByText('Includes £6.00 tax')).toBeVisible();
});

test('vendors have their own list, and a contact can be both', async ({ page }) => {
  await page.goto('#/vendors/new');
  await page.getByLabel('Vendor name').fill('Inkwell Toner Co');
  await page.getByRole('button', { name: 'Save vendor' }).first().click();
  await expect(page).toHaveURL(/#\/vendors\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('link', { name: 'New bill' })).toBeVisible();

  await page.goto('#/vendors');
  await expect(page.getByRole('link', { name: 'Inkwell Toner Co' })).toBeVisible();
  await page.goto('#/clients');
  await expect(page.getByRole('link', { name: 'Brightside Retail Group' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inkwell Toner Co' })).toHaveCount(0);

  // Orbit Logistics buys from us and also delivers for us.
  await page.getByRole('link', { name: 'Orbit Logistics Ltd' }).click();
  await page.getByRole('link', { name: 'Also a vendor' }).click();
  await expect(page).toHaveURL(/#\/vendors\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orbit Logistics Ltd');
  await expect(
    page
      .getByText('OL-5520')
      .or(page.getByText(/^BILL-/))
      .first(),
  ).toBeVisible();

  await page.goto('#/reports/payables');
  await expect(page.getByRole('link', { name: 'Swiftpost Business Services' })).toBeVisible();
});
