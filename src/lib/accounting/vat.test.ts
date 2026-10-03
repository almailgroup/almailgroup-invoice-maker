import { describe, expect, it } from 'vitest';
import { createDocument } from '@/db/defaults';
import type { Expense, InvoiceDocument, LineItem, ManualJournal, TaxLine } from '@/db/types';
import { postDocument, postExpense, postJournal, type LedgerContext } from './ledger';
import {
  emirateFromAddress,
  vatBoxLines,
  vatDueDate,
  vatPeriodOf,
  vatPeriods,
  vatReturn,
  type VatContext,
} from './vat';

const STANDARD: TaxLine = { name: 'VAT', rate: 20, kind: 'standard' };
const ZERO: TaxLine = { name: 'VAT', rate: 0, kind: 'zero' };
const EXEMPT: TaxLine = { name: 'Exempt', rate: 0, kind: 'exempt' };
const REVERSE: TaxLine = { name: 'VAT', rate: 20, kind: 'reverse_charge' };

const roles = {
  receivable: 'ar',
  payable: 'ap',
  sales: 'sales',
  charges: 'sales',
  expense: 'expenses',
  output_tax: 'vat-out',
  input_tax: 'vat-in',
  bank: 'bank',
  fx: 'fx',
};
const ledgerCtx: LedgerContext = {
  companyCurrency: 'GBP',
  precision: 2,
  roles,
  accountIds: new Set(Object.values(roles)),
  productAccounts: new Map(),
  taxExempt: () => false,
  documents: new Map(),
};
const vatCtx: VatContext = { roles, precision: 2, emirate: 'DU' };
const Q3 = { start: '2026-07-01', end: '2026-09-30' };

function line(unitPrice: number, taxes: TaxLine[]): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'item',
    productId: null,
    name: 'Line',
    description: '',
    quantity: 1,
    unit: '',
    unitPrice,
    discount: 0,
    discountType: 'percent',
    taxes,
  };
}

function doc(type: InvoiceDocument['type'], issueDate: string, items: LineItem[]): InvoiceDocument {
  return createDocument('co', type, {
    number: `${type}-${issueDate}`,
    clientId: 'c',
    currency: 'GBP',
    status: 'sent',
    issueDate,
    items,
  });
}

function journal(date: string, lines: [string, number][], vatReturnId?: string): ManualJournal {
  return {
    id: `j-${date}`,
    companyId: 'co',
    number: 'JE',
    date,
    reference: '',
    notes: '',
    status: 'posted',
    vatReturnId,
    lines: lines.map(([accountId, amount], i) => ({
      id: String(i),
      accountId,
      description: '',
      debit: Math.max(0, amount),
      credit: Math.max(0, -amount),
      contactId: null,
    })),
    createdAt: '',
    updatedAt: '',
  };
}

const expense: Expense = {
  id: 'e',
  companyId: 'co',
  number: 'EXP-1',
  date: '2026-09-10',
  vendorId: null,
  accountId: 'expenses',
  description: 'Stationery',
  amount: 120,
  taxes: [STANDARD],
  currency: 'GBP',
  paidFromAccountId: null,
  reference: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
};

const lines = [
  ...postDocument(doc('invoice', '2026-07-10', [line(1000, [STANDARD])]), ledgerCtx),
  ...postDocument(
    doc('invoice', '2026-08-05', [line(500, [ZERO]), line(200, [EXEMPT])]),
    ledgerCtx,
  ),
  ...postDocument(doc('credit', '2026-09-01', [line(100, [STANDARD])]), ledgerCtx),
  ...postDocument(doc('invoice', '2026-10-02', [line(9999, [STANDARD])]), ledgerCtx),
  ...postDocument(doc('bill', '2026-07-20', [line(300, [STANDARD])]), ledgerCtx),
  ...postDocument(doc('bill', '2026-08-20', [line(1000, [REVERSE])]), ledgerCtx),
  ...postExpense(expense, ledgerCtx),
  // A correction to input VAT, and the entry closing an earlier return.
  ...postJournal(
    journal('2026-09-15', [
      ['vat-in', 5],
      ['bank', -5],
    ]),
    ledgerCtx,
  ),
  ...postJournal(
    journal(
      '2026-09-30',
      [
        ['vat-out', 999],
        ['bank', -999],
      ],
      'earlier',
    ),
    ledgerCtx,
  ),
];

const box = (result: ReturnType<typeof vatReturn>, id: string) =>
  result.boxes.find((b) => b.id === id)!;

describe('UK VAT return', () => {
  const r = vatReturn(lines, Q3, 'uk', vatCtx);

  it('takes the tax boxes from the VAT accounts, reverse charge included', () => {
    expect(box(r, '1').amount).toBe(38000); // 200 − 20 + 200 reverse charge
    expect(box(r, '3').amount).toBe(38000);
    expect(box(r, '4').amount).toBe(28500); // 60 + 200 + 20 + 5 correction
    expect(box(r, '5').amount).toBe(9500);
    expect(r.net).toBe(9500);
  });

  it('takes the value boxes from sales and purchases, in whole pounds', () => {
    // 1000 + 500 + 200 − 100, plus services bought under reverse charge.
    expect(box(r, '6').amount).toBe(260000);
    expect(box(r, '7').amount).toBe(140000); // 300 + 1000 + 100
    expect(box(r, '8').amount).toBe(0);
    expect(box(r, '9').amount).toBe(0);
  });

  it('counts sales under the reverse charge in box 6 only', () => {
    const sale = postDocument(doc('invoice', '2026-07-03', [line(400, [REVERSE])]), ledgerCtx);
    const r2 = vatReturn(sale, Q3, 'uk', vatCtx);
    expect(box(r2, '6').amount).toBe(40000);
    expect(box(r2, '1').amount).toBe(0);
  });

  it('rounds the value boxes down to whole pounds', () => {
    const odd = postDocument(doc('invoice', '2026-07-01', [line(10.99, [STANDARD])]), ledgerCtx);
    expect(box(vatReturn(odd, Q3, 'uk', vatCtx), '6').amount).toBe(1000);
  });

  it('lists the transactions behind a box', () => {
    const behind = vatBoxLines(lines, Q3, 'uk', vatCtx, '4');
    expect(behind.map((x) => x.amount).sort((a, b) => a - b)).toEqual([500, 2000, 6000, 20000]);
  });
});

describe('UAE VAT 201', () => {
  const r = vatReturn(lines, Q3, 'ae', vatCtx);

  it('reports standard rated supplies in the business emirate', () => {
    expect(box(r, '1b')).toMatchObject({ amount: 90000, vat: 18000 });
    expect(box(r, '1a')).toMatchObject({ amount: 0, vat: 0 });
    expect(vatBoxLines(lines, Q3, 'ae', vatCtx, '1a')).toEqual([]);
    expect(vatBoxLines(lines, Q3, 'ae', vatCtx, '1b')).toHaveLength(4);
  });

  it('fills reverse charge, zero-rated, exempt and expense boxes', () => {
    expect(box(r, '3')).toMatchObject({ amount: 100000, vat: 20000 });
    expect(box(r, '4').amount).toBe(50000);
    expect(box(r, '5').amount).toBe(20000);
    expect(box(r, '8')).toMatchObject({ amount: 260000, vat: 38000 });
    expect(box(r, '9')).toMatchObject({ amount: 40000, vat: 8500 });
    expect(box(r, '10')).toMatchObject({ amount: 100000, vat: 20000 });
    expect(box(r, '11')).toMatchObject({ amount: 140000, vat: 28500 });
    expect(box(r, '12').amount).toBe(38000);
    expect(box(r, '13').amount).toBe(28500);
    expect(box(r, '14').amount).toBe(9500);
  });
});

describe('summary return', () => {
  it('splits sales and purchases by kind', () => {
    const r = vatReturn(lines, Q3, 'generic', vatCtx);
    expect(box(r, 'sales-taxed')).toMatchObject({ amount: 90000, vat: 18000 });
    expect(box(r, 'sales-zero').amount).toBe(50000);
    expect(box(r, 'sales-exempt').amount).toBe(20000);
    expect(box(r, 'purchases-taxed')).toMatchObject({ amount: 40000, vat: 8500 });
    expect(box(r, 'reverse')).toMatchObject({ amount: 100000, vat: 20000 });
    expect(box(r, 'net').amount).toBe(9500);
  });

  it('flags sales and purchases without a tax rate', () => {
    const untaxed = postDocument(doc('invoice', '2026-07-02', [line(50, [])]), ledgerCtx);
    const r = vatReturn([...lines, ...untaxed], Q3, 'generic', vatCtx);
    expect(r.untaxed).toHaveLength(1);
    expect(box(r, 'sales-none').amount).toBe(5000);
  });
});

describe('periods', () => {
  it('follow calendar quarters, other staggers, or months', () => {
    expect(vatPeriodOf('2026-10-03', { frequency: 'quarterly', startMonth: 1 })).toEqual({
      start: '2026-10-01',
      end: '2026-12-31',
    });
    expect(vatPeriodOf('2026-10-03', { frequency: 'quarterly', startMonth: 2 })).toEqual({
      start: '2026-08-01',
      end: '2026-10-31',
    });
    expect(vatPeriodOf('2026-01-15', { frequency: 'quarterly', startMonth: 3 })).toEqual({
      start: '2025-12-01',
      end: '2026-02-28',
    });
    expect(vatPeriodOf('2028-02-10', { frequency: 'monthly', startMonth: 1 })).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('list every period between two dates', () => {
    const periods = vatPeriods(
      { frequency: 'quarterly', startMonth: 1 },
      '2026-02-01',
      '2026-10-01',
    );
    expect(periods.map((p) => p.start)).toEqual([
      '2026-01-01',
      '2026-04-01',
      '2026-07-01',
      '2026-10-01',
    ]);
  });

  it('are due a month and seven days later in the UK, 28 days later in the UAE', () => {
    expect(vatDueDate(Q3, 'uk')).toBe('2026-11-07');
    expect(vatDueDate({ start: '2026-01-01', end: '2026-01-31' }, 'uk')).toBe('2026-03-07');
    expect(vatDueDate(Q3, 'ae')).toBe('2026-10-28');
  });

  it('find the emirate in an address', () => {
    expect(emirateFromAddress({ state: '', city: 'Dubai' })).toBe('DU');
    expect(emirateFromAddress({ state: 'Ras Al Khaimah', city: '' })).toBe('RK');
    expect(emirateFromAddress({ state: '', city: 'Al Ain' })).toBe('AZ');
    expect(emirateFromAddress({ state: '', city: 'London' })).toBeNull();
  });
});
