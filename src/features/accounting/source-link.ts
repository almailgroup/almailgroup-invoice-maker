import type { LedgerLine, LedgerSource } from '@/lib/accounting/ledger';

const SOURCE_ROUTES: Record<LedgerSource, string> = {
  invoice: '/invoices',
  credit: '/credits',
  bill: '/bills',
  vendor_credit: '/vendor-credits',
  payment: '/payments',
  expense: '/expenses',
  journal: '/journals',
};

export const SOURCE_LABELS: Record<LedgerSource, string> = {
  invoice: 'Invoice',
  credit: 'Credit note',
  bill: 'Bill',
  vendor_credit: 'Vendor credit',
  payment: 'Payment',
  expense: 'Expense',
  journal: 'Journal',
};

/** Where the document behind a ledger line is shown. */
export function sourceLink(line: Pick<LedgerLine, 'source' | 'sourceId'>): string {
  // Expenses open in a dialog on their list; payments made redirect from /payments.
  if (line.source === 'expense') return `/expenses?open=${line.sourceId}`;
  return `${SOURCE_ROUTES[line.source]}/${line.sourceId}`;
}
