import { describe, expect, it } from 'vitest';
import { createClient, createDocument } from '@/db/defaults';
import type { InvoiceDocument } from '@/db/types';
import { applyTotals } from '@/db/documents';
import { agingReport, presetRange, salesByClient, taxReport } from './reports';

const client = createClient('co', { id: 'c1', name: 'Acme' });

function invoice(overrides: Partial<InvoiceDocument>, price = 100, paid = 0): InvoiceDocument {
  const doc = createDocument('co', overrides.type ?? 'invoice', {
    clientId: 'c1',
    currency: 'USD',
    status: 'sent',
    items: [
      {
        id: 'i',
        kind: 'item',
        productId: null,
        name: 'x',
        description: '',
        quantity: 1,
        unit: '',
        unitPrice: price,
        discount: 0,
        discountType: 'percent',
        taxes: [{ name: 'VAT', rate: 20 }],
      },
    ],
    ...overrides,
  });
  return applyTotals(doc, paid, null);
}

describe('reports', () => {
  it('computes date presets', () => {
    expect(presetRange('this-month', '2026-02-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(presetRange('last-month', '2026-01-10')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(presetRange('this-quarter', '2026-05-10')).toEqual({
      from: '2026-04-01',
      to: '2026-06-30',
    });
    expect(presetRange('last-quarter', '2026-02-10')).toEqual({
      from: '2025-10-01',
      to: '2025-12-31',
    });
    expect(presetRange('last-year', '2026-02-10')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    });
  });

  it('buckets open invoices by days overdue', () => {
    const docs = [
      invoice({ dueDate: '2026-03-20' }), // current
      invoice({ dueDate: '2026-03-01' }), // 9 days late
      invoice({ dueDate: '2026-01-01' }), // 68 days late
      invoice({ dueDate: '2025-10-01' }, 100, 20), // 160 days, partially paid
      invoice({ dueDate: '2025-10-01', status: 'paid' }, 100, 120),
    ];
    const r = agingReport(docs, [client], 'USD', '2026-03-10');
    expect(r.totals).toEqual([120, 120, 0, 120, 100]);
    expect(r.total).toBe(460);
    expect(r.rows[0]).toMatchObject({ clientName: 'Acme', total: 460 });
  });

  it('summarizes tax minus credit notes within the range', () => {
    const docs = [
      invoice({ issueDate: '2026-04-02' }, 100),
      invoice({ issueDate: '2026-04-20' }, 50),
      invoice({ issueDate: '2026-05-01' }, 1000), // outside
      invoice({ issueDate: '2026-04-05', status: 'draft' }, 1000), // draft
      invoice({ issueDate: '2026-04-25', type: 'credit' }, 30),
    ];
    const r = taxReport(docs, [client], 'USD', { from: '2026-04-01', to: '2026-04-30' });
    expect(r.rows).toEqual([
      expect.objectContaining({ name: 'VAT', rate: 20, base: 120, tax: 24 }),
    ]);
    expect(r).toMatchObject({ net: 120, tax: 24, gross: 144, documents: 3 });
  });

  it('totals sales per client', () => {
    const docs = [
      invoice({ issueDate: '2026-04-02' }, 100, 50),
      invoice({ issueDate: '2026-04-03' }, 100),
    ];
    const r = salesByClient(docs, [client], 'USD', { from: '2026-04-01', to: '2026-04-30' });
    expect(r.totals).toEqual({ invoices: 2, invoiced: 240, paid: 50, outstanding: 190 });
  });
});
