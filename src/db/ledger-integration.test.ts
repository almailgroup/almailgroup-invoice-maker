import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { seedDemoCompany } from './demo';
import { loadLedger, LockedPeriodError } from './accounting';
import { saveDocument } from './documents';
import { setupCompany } from './records';
import { createDocument } from './defaults';
import { balanceSheet, profitAndLoss, trialBalance } from '@/lib/accounting/statements';
import { today } from '@/lib/dates';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const DEC = { month: 12, day: 31 };

describe('books of the demo company', () => {
  it('are complete and balanced', async () => {
    const company = await seedDemoCompany();
    expect(company.accounting?.template).toBe('uk');
    const { accounts, lines, problems } = await loadLedger(company);
    expect(problems).toEqual([]);
    expect(lines.reduce((sum, l) => sum + l.amount, 0)).toBe(0);

    const bs = balanceSheet(lines, accounts, today(), DEC);
    expect(bs.difference).toBe(0);
    const tb = trialBalance(lines, accounts, today(), DEC);
    expect(tb.totalDebit).toBe(tb.totalCredit);

    // Receivables in the ledger equal what clients still owe on invoices,
    // less money received that isn't applied yet.
    const receivable = accounts.find((a) => a.role === 'receivable')!;
    const arBalance = lines
      .filter((l) => l.accountId === receivable.id)
      .reduce((s, l) => s + l.amount, 0);
    const docs = await db.documents.where('companyId').equals(company.id).toArray();
    const open = docs
      .filter(
        (d) =>
          d.type === 'invoice' &&
          (d.status === 'sent' || d.status === 'partial') &&
          d.currency === 'GBP',
      )
      .reduce((s, d) => s + Math.round(d.totals.balance * 100), 0);
    const credits = docs
      .filter((d) => d.type === 'credit' && (d.status === 'sent' || d.status === 'partial'))
      .reduce((s, d) => s + Math.round(d.totals.balance * 100), 0);
    expect(arBalance).toBe(open - credits);

    // The euro invoice was paid at a better rate: a small exchange gain.
    const fx = accounts.find((a) => a.role === 'fx')!;
    expect(
      lines.filter((l) => l.accountId === fx.id).reduce((s, l) => s + l.amount, 0),
    ).toBeLessThan(0);

    // Payables equal what is still owed on bills, less unused vendor credits.
    const payable = accounts.find((a) => a.role === 'payable')!;
    const apBalance = lines
      .filter((l) => l.accountId === payable.id)
      .reduce((s, l) => s + l.amount, 0);
    const openBills = docs
      .filter((d) => d.type === 'bill' && (d.status === 'sent' || d.status === 'partial'))
      .reduce((s, d) => s + Math.round(d.totals.balance * 100), 0);
    const vendorCredits = docs
      .filter((d) => d.type === 'vendor_credit' && (d.status === 'sent' || d.status === 'partial'))
      .reduce((s, d) => s + Math.round(d.totals.balance * 100), 0);
    expect(openBills).toBeGreaterThan(0);
    expect(apBalance).toBe(-(openBills - vendorCredits));

    const year = profitAndLoss(lines, accounts, { from: '0000-01-01', to: today() });
    expect(year.income.total).toBeGreaterThan(0);
    // Paper, postage and subcontractors, less the returned paper; the draft bill is left out.
    expect(year.costOfSales.total).toBe((1680 + 3280 + 4310 - 252 + 5125 + 380) * 100);
    // Rent, energy, accountants and the expenses without their VAT (advertising is
    // reverse charge, so its VAT is not part of what was paid).
    expect(year.expenses.total).toBe(
      (6 * 1250 + 612.4 + 1450) * 100 + 8640 + 3800 + 6480 + 1200 + 1583 + 25000,
    );
  });
});

describe('lock date', () => {
  it('stops changes to issued documents in closed periods', async () => {
    const company = await setupCompany({ name: 'Locked Co', currency: 'GBP' });
    await db.companies.update(company.id, {
      accounting: { ...company.accounting!, lockDate: '2026-03-31' },
    });
    const invoice = createDocument(company.id, 'invoice', {
      clientId: 'c',
      currency: 'GBP',
      status: 'sent',
      issueDate: '2026-03-15',
    });
    await expect(saveDocument(invoice)).rejects.toThrow(LockedPeriodError);
    // Drafts are not in the books, so they can still be saved.
    await expect(saveDocument({ ...invoice, status: 'draft' })).resolves.toMatchObject({
      status: 'draft',
    });
    await expect(
      saveDocument({ ...invoice, id: 'later', issueDate: '2026-04-01' }),
    ).resolves.toBeTruthy();
  });
});
