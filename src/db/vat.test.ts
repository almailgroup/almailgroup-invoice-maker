import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { seedDemoCompany } from './demo';
import { deleteJournal, JournalError, loadLedger } from './accounting';
import { computeVatReturn, fileVatReturn, recordVatPayment, undoVatReturn, VatError } from './vat';
import { vatPeriodOf } from '@/lib/accounting/vat';
import { addDaysISO, today } from '@/lib/dates';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

/** The demo files every return before the last ended quarter; that one is left to file. */
function latestEnded() {
  const schedule = { frequency: 'quarterly' as const, startMonth: 1 };
  return vatPeriodOf(addDaysISO(vatPeriodOf(today(), schedule).start, -1), schedule);
}

const balance = (lines: { accountId: string; amount: number }[], accountId: string) =>
  lines.filter((l) => l.accountId === accountId).reduce((s, l) => s + l.amount, 0);

describe('filing a VAT return', () => {
  it('keeps the boxes, moves the VAT to the liability account and locks the period', async () => {
    const company = await seedDemoCompany();
    // The last full quarter of the demo's activity.
    const period = latestEnded();
    // Earlier quarters of the demo are already filed and paid.
    const history = await db.vatReturns.toArray();
    expect(history.length).toBeGreaterThan(0);
    expect(history.every((r) => r.periodEnd < period.start)).toBe(true);
    const live = await computeVatReturn(company, period);
    expect(live.format).toBe('uk');
    expect(live.boxes.find((b) => b.id === '1')!.amount).toBeGreaterThan(0);

    const record = await fileVatReturn(company.id, period, {
      filedOn: today(),
      reference: 'HMRC-123',
      lock: true,
    });
    expect(record).toMatchObject({
      periodStart: period.start,
      net: live.net,
      reference: 'HMRC-123',
    });
    expect(record.boxes).toEqual(
      live.boxes.map(({ id, label, amount, vat }) => ({
        id,
        label,
        amount,
        ...(vat !== undefined ? { vat } : {}),
      })),
    );

    const stored = (await db.companies.get(company.id))!;
    expect(stored.accounting?.lockDate).toBe(period.end);

    // The closing entry does not change the return, and the VAT owed sits in the liability account.
    expect((await computeVatReturn(stored, period)).net).toBe(live.net);
    const { accounts, lines } = await loadLedger(stored);
    const liability = accounts.find((a) => a.role === 'tax_settlement')!;
    expect(-balance(lines, liability.id)).toBe(live.net);
    await expect(
      fileVatReturn(company.id, period, { filedOn: today(), reference: '', lock: false }),
    ).rejects.toThrow(VatError);

    // The closing entry can only go with the return.
    await expect(deleteJournal(record.journalId!)).rejects.toThrow();
    await expect(undoVatReturn(record.id)).rejects.toThrow('This period is locked');
  });

  it('records the payment and can be undone once unlocked', async () => {
    const company = await seedDemoCompany();
    const period = latestEnded();
    const record = await fileVatReturn(company.id, period, {
      filedOn: today(),
      reference: '',
      lock: false,
    });
    const accounts = await db.accounts.where('companyId').equals(company.id).toArray();
    const bank = accounts.find((a) => a.role === 'bank')!;
    const liability = accounts.find((a) => a.role === 'tax_settlement')!;
    const paid = await recordVatPayment(record.id, { date: today(), accountId: bank.id });
    expect(paid.paymentJournalId).toBeTruthy();
    const { lines } = await loadLedger((await db.companies.get(company.id))!);
    expect(balance(lines, liability.id)).toBe(0);
    await expect(
      recordVatPayment(record.id, { date: today(), accountId: bank.id }),
    ).rejects.toThrow(VatError);

    await undoVatReturn(record.id);
    expect(await db.vatReturns.get(record.id)).toBeUndefined();
    expect(await db.journals.get(record.journalId!)).toBeUndefined();
    expect(await db.journals.get(paid.paymentJournalId!)).toBeUndefined();
  });

  it('refuses edits to the closing entry', async () => {
    const company = await seedDemoCompany();
    const period = latestEnded();
    const record = await fileVatReturn(company.id, period, {
      filedOn: today(),
      reference: '',
      lock: false,
    });
    await expect(deleteJournal(record.journalId!)).rejects.toThrow(JournalError);
  });
});
