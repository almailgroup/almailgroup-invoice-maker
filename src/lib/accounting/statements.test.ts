import { describe, expect, it } from 'vitest';
import type { Account, AccountType } from '@/db/types';
import type { LedgerLine } from './ledger';
import {
  balanceSheet,
  fiscalYearEnd,
  fiscalYearStart,
  generalLedger,
  profitAndLoss,
  trialBalance,
} from './statements';

const account = (id: string, code: string, type: AccountType): Account => ({
  id,
  companyId: 'co',
  code,
  name: id,
  type,
  description: '',
  role: null,
  bank: null,
  archived: false,
  createdAt: '',
  updatedAt: '',
});

const ACCOUNTS = [
  account('bank', '1000', 'asset_cash'),
  account('ar', '1100', 'asset_receivable'),
  account('ap', '2000', 'liability_payable'),
  account('vat', '2100', 'liability_current'),
  account('capital', '3000', 'equity'),
  account('sales', '4000', 'income'),
  account('interest', '4500', 'income_other'),
  account('cogs', '5000', 'expense_direct_cost'),
  account('rent', '6040', 'expense'),
];

let seq = 0;
/** One balanced entry: [account, amount in major units][]. */
function entry(date: string, parts: [string, number][]): LedgerLine[] {
  seq += 1;
  return parts.map(([accountId, amount]) => ({
    date,
    accountId,
    amount: Math.round(amount * 100),
    source: 'journal' as const,
    sourceId: `e${seq}`,
    number: `E${seq}`,
    contactId: null,
    description: '',
  }));
}

const DEC = { month: 12, day: 31 };

// Last year: capital in, a sale, rent. This year: a sale, its payment, stock and interest.
const LINES = [
  ...entry('2025-01-05', [
    ['bank', 10000],
    ['capital', -10000],
  ]),
  ...entry('2025-06-01', [
    ['ar', 1200],
    ['sales', -1000],
    ['vat', -200],
  ]),
  ...entry('2025-07-01', [
    ['rent', 400],
    ['bank', -400],
  ]),
  ...entry('2026-02-01', [
    ['ar', 2400],
    ['sales', -2000],
    ['vat', -400],
  ]),
  ...entry('2026-02-20', [
    ['bank', 2400],
    ['ar', -2400],
  ]),
  ...entry('2026-03-01', [
    ['cogs', 500],
    ['ap', -500],
  ]),
  ...entry('2026-03-31', [
    ['bank', 25],
    ['interest', -25],
  ]),
];

describe('financial year', () => {
  it('finds the start and end for calendar and non-calendar years', () => {
    expect(fiscalYearStart('2026-10-03', DEC)).toBe('2026-01-01');
    expect(fiscalYearEnd('2026-10-03', DEC)).toBe('2026-12-31');
    const march = { month: 3, day: 31 };
    expect(fiscalYearStart('2026-03-31', march)).toBe('2025-04-01');
    expect(fiscalYearStart('2026-04-01', march)).toBe('2026-04-01');
    expect(fiscalYearEnd('2026-04-01', march)).toBe('2027-03-31');
    expect(fiscalYearStart('2025-03-01', { month: 2, day: 29 })).toBe('2025-03-01');
  });
});

describe('statements', () => {
  it('builds the profit and loss for a period', () => {
    const pl = profitAndLoss(LINES, ACCOUNTS, { from: '2026-01-01', to: '2026-12-31' });
    expect(pl.income.total).toBe(200000);
    expect(pl.costOfSales.total).toBe(50000);
    expect(pl.grossProfit).toBe(150000);
    expect(pl.otherIncome.total).toBe(2500);
    expect(pl.expenses.rows).toEqual([]);
    expect(pl.netProfit).toBe(152500);
  });

  it('balances the balance sheet, splitting this year and earlier years', () => {
    const bs = balanceSheet(LINES, ACCOUNTS, '2026-06-30', DEC);
    expect(bs.totalAssets).toBe(1202500 + 120000); // bank 12,025 + receivable 1,200
    expect(bs.totalLiabilities).toBe(50000 + 60000); // payable 500 + VAT 600
    expect(bs.currentYearEarnings).toBe(152500);
    expect(bs.previousYearsEarnings).toBe(60000); // 1,000 sale − 400 rent
    expect(bs.totalEquity).toBe(1000000 + 152500 + 60000);
    expect(bs.difference).toBe(0);
  });

  it('balances the trial balance with an earlier-years line', () => {
    const tb = trialBalance(LINES, ACCOUNTS, '2026-06-30', DEC);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    const earlier = tb.rows.find((r) => r.account === null);
    expect(earlier).toMatchObject({ credit: 60000, debit: 0 });
    expect(tb.rows.find((r) => r.account?.id === 'rent')).toBeUndefined();
  });

  it('runs balances through the general ledger', () => {
    const [bank] = generalLedger(
      LINES,
      ACCOUNTS,
      { from: '2026-01-01', to: '2026-12-31' },
      DEC,
      'bank',
    );
    expect(bank.opening).toBe(960000);
    expect(bank.lines.map((l) => l.balance)).toEqual([1200000, 1202500]);
    expect(bank.closing).toBe(1202500);
    const [rent] = generalLedger(
      LINES,
      ACCOUNTS,
      { from: '2025-07-01', to: '2025-12-31' },
      DEC,
      'rent',
    );
    expect(rent).toMatchObject({ opening: 0, debit: 40000, closing: 40000 });
    // Income and expense accounts start the new year at zero.
    expect(
      generalLedger(LINES, ACCOUNTS, { from: '2026-01-01', to: '2026-12-31' }, DEC, 'rent'),
    ).toEqual([]);
  });
});
