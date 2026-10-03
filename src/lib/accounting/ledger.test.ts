import { describe, expect, it } from 'vitest';
import { createDocument } from '@/db/defaults';
import { createPayment } from '@/db/payments';
import type { InvoiceDocument, LineItem, ManualJournal, TaxLine } from '@/db/types';
import { dec } from '@/lib/money';
import {
  allocate,
  buildLedger,
  postDocument,
  postJournal,
  postPayment,
  UnbalancedEntryError,
  type LedgerContext,
  type LedgerLine,
} from './ledger';

const VAT20: TaxLine = { name: 'VAT', rate: 20 };
const VAT0: TaxLine = { name: 'VAT', rate: 0 };

function item(
  quantity: number,
  unitPrice: number,
  taxes: TaxLine[],
  extra: Partial<LineItem> = {},
): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'item',
    productId: null,
    name: 'Item',
    description: '',
    quantity,
    unit: '',
    unitPrice,
    discount: 0,
    discountType: 'percent',
    taxes,
    ...extra,
  };
}

function doc(overrides: Partial<InvoiceDocument>): InvoiceDocument {
  return createDocument('co', overrides.type ?? 'invoice', {
    number: 'INV-1',
    clientId: 'client',
    currency: 'GBP',
    status: 'sent',
    issueDate: '2026-10-02',
    ...overrides,
  });
}

function context(overrides: Partial<LedgerContext> = {}): LedgerContext {
  const roles = {
    receivable: 'ar',
    sales: 'sales',
    charges: 'charges',
    output_tax: 'vat',
    bank: 'bank',
    cash: 'cash',
    fx: 'fx',
  };
  return {
    companyCurrency: 'GBP',
    precision: 2,
    roles,
    accountIds: new Set([...Object.values(roles), 'services']),
    productAccounts: new Map([['consulting', 'services']]),
    taxExempt: () => false,
    documents: new Map(),
    ...overrides,
  };
}

/** Lines as { account: amount } with amounts in major units, for readable assertions. */
const byAccount = (lines: LedgerLine[]) => {
  const out: Record<string, number> = {};
  for (const l of lines) out[l.accountId] = (out[l.accountId] ?? 0) + l.amount / 100;
  return out;
};
const total = (lines: LedgerLine[]) => lines.reduce((a, l) => a + l.amount, 0);

describe('invoices and credit notes', () => {
  it('posts receivable, income per line and VAT (line discount, two VAT rates)', () => {
    const invoice = doc({
      items: [item(10, 100, [VAT20], { discount: 10 }), item(2, 25, [VAT0])],
    });
    const lines = postDocument(invoice, context());
    expect(byAccount(lines)).toEqual({ ar: 1130, sales: -950, vat: -180 });
    expect(total(lines)).toBe(0);
  });

  it('reverses everything on a credit note', () => {
    const credit = doc({
      type: 'credit',
      number: 'CN-1',
      items: [item(2, 100, [VAT20], { discount: 10 })],
    });
    expect(byAccount(postDocument(credit, context()))).toEqual({ ar: -216, sales: 180, vat: 36 });
  });

  it('spreads a document discount into the income and VAT', () => {
    const invoice = doc({
      items: [item(10, 100, [VAT20], { discount: 10 }), item(2, 25, [VAT0])],
      discount: 10,
    });
    expect(byAccount(postDocument(invoice, context()))).toEqual({
      ar: 1017,
      sales: -855,
      vat: -162,
    });
  });

  it('backs tax out of prices that include it, matching the printed totals', () => {
    const invoice = doc({
      pricesIncludeTax: true,
      items: [item(1, 10, [VAT20]), item(1, 10, [VAT20]), item(1, 10, [VAT20])],
    });
    expect(byAccount(postDocument(invoice, context()))).toEqual({ ar: 30, sales: -25, vat: -5 });
  });

  it('uses product income accounts and the charges account', () => {
    const invoice = doc({
      items: [item(1, 100, [VAT20]), item(2, 50, [VAT20], { productId: 'consulting' })],
      charges: [{ id: 'c', label: 'Delivery', amount: 10, taxes: [VAT20] }],
    });
    expect(byAccount(postDocument(invoice, context()))).toEqual({
      ar: 252,
      sales: -100,
      services: -100,
      charges: -10,
      vat: -42,
    });
  });

  it('posts nothing for drafts, void documents and quotes', () => {
    const items = [item(1, 100, [VAT20])];
    expect(postDocument(doc({ status: 'draft', items }), context())).toEqual([]);
    expect(postDocument(doc({ status: 'void', items }), context())).toEqual([]);
    expect(postDocument(doc({ type: 'quote', items }), context())).toEqual([]);
  });

  it('leaves VAT off for tax-exempt clients', () => {
    const invoice = doc({ items: [item(1, 100, [VAT20])] });
    expect(byAccount(postDocument(invoice, context({ taxExempt: () => true })))).toEqual({
      ar: 100,
      sales: -100,
    });
  });

  it('converts foreign-currency documents at their exchange rate', () => {
    const invoice = doc({ currency: 'EUR', exchangeRate: 0.86, items: [item(1, 1000, [])] });
    expect(byAccount(postDocument(invoice, context()))).toEqual({ ar: 860, sales: -860 });
  });
});

describe('payments', () => {
  it('debits the bank and clears the receivable', () => {
    const payment = createPayment('co', {
      number: 'PAY-1',
      amount: 914,
      currency: 'GBP',
      method: 'bank_transfer',
    });
    expect(byAccount(postPayment(payment, context()))).toEqual({ bank: 914, ar: -914 });
  });

  it('puts cash payments in the cash account and honours the chosen account', () => {
    const cash = createPayment('co', { amount: 50, currency: 'GBP', method: 'cash' });
    expect(byAccount(postPayment(cash, context()))).toEqual({ cash: 50, ar: -50 });
    const chosen = createPayment('co', {
      amount: 50,
      currency: 'GBP',
      method: 'cash',
      accountId: 'bank',
    });
    expect(byAccount(postPayment(chosen, context()))).toEqual({ bank: 50, ar: -50 });
  });

  it('moves no money when a credit note is applied', () => {
    const applied = createPayment('co', { amount: 216, currency: 'GBP', method: 'credit_note' });
    expect(postPayment(applied, context())).toEqual([]);
  });

  it('books the exchange difference between invoice and payment rates', () => {
    const invoice = doc({
      id: 'eur-inv',
      currency: 'EUR',
      exchangeRate: 0.86,
      items: [item(1, 1000, [])],
    });
    const payment = createPayment('co', {
      amount: 1000,
      currency: 'EUR',
      exchangeRate: 0.87,
      method: 'bank_transfer',
      allocations: [{ documentId: 'eur-inv', amount: 1000 }],
    });
    const lines = postPayment(payment, context({ documents: new Map([['eur-inv', invoice]]) }));
    expect(byAccount(lines)).toEqual({ bank: 870, ar: -860, fx: -10 });
  });

  it('keeps an overpayment as customer credit in receivables', () => {
    const payment = createPayment('co', {
      amount: 1200,
      currency: 'GBP',
      method: 'bank_transfer',
      allocations: [{ documentId: 'x', amount: 1130 }],
    });
    expect(byAccount(postPayment(payment, context()))).toEqual({ bank: 1200, ar: -1200 });
  });
});

describe('manual journals', () => {
  const journal = (
    lines: ManualJournal['lines'],
    status: ManualJournal['status'] = 'posted',
  ): ManualJournal => ({
    id: 'j',
    companyId: 'co',
    number: 'JE-1',
    date: '2026-01-01',
    reference: 'Owner investment',
    notes: '',
    status,
    lines,
    createdAt: '',
    updatedAt: '',
  });
  const line = (accountId: string, debit: number, credit: number) => ({
    id: accountId,
    accountId,
    description: '',
    debit,
    credit,
    contactId: null,
  });

  it('posts balanced journals and ignores drafts', () => {
    const lines = [line('bank', 5000, 0), line('capital', 0, 5000)];
    expect(byAccount(postJournal(journal(lines), context()))).toEqual({
      bank: 5000,
      capital: -5000,
    });
    expect(postJournal(journal(lines, 'draft'), context())).toEqual([]);
  });

  it('refuses unbalanced journals', () => {
    expect(() => postJournal(journal([line('bank', 10, 0)]), context())).toThrow(
      UnbalancedEntryError,
    );
  });
});

describe('ledger', () => {
  it('splits amounts exactly, giving the remainder to the largest share', () => {
    expect(allocate(100, [dec(1), dec(1), dec(1)])).toEqual([34, 33, 33]);
    expect(allocate(-1001, [dec(2), dec(1)])).toEqual([-667, -334]);
    expect(allocate(5, [dec(0), dec(0)])).toEqual([5, 0]);
  });

  it('reports documents it cannot post instead of failing', () => {
    const invoice = doc({ items: [item(1, 100, [])], currency: 'EUR' });
    const ctx = context({ roles: { sales: 'sales' } });
    const { lines, problems } = buildLedger(
      { documents: [invoice], payments: [], journals: [] },
      ctx,
    );
    expect(lines).toEqual([]);
    expect(problems.map((p) => p.message)).toEqual([
      'No exchange rate for EUR; 1:1 was used.',
      'No account is set up for "receivable".',
    ]);
  });
});
