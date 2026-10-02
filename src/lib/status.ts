import type { DocumentStatus, DocumentType, InvoiceDocument, ISODate } from '@/db/types';

export type DisplayStatus = DocumentStatus | 'overdue' | 'expired';

export type StatusTone = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'violet' | 'slate';

export const STATUS_META: Record<DisplayStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Draft', tone: 'gray' },
  sent: { label: 'Sent', tone: 'blue' },
  partial: { label: 'Partially paid', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  void: { label: 'Void', tone: 'slate' },
  overdue: { label: 'Overdue', tone: 'red' },
  accepted: { label: 'Accepted', tone: 'green' },
  declined: { label: 'Declined', tone: 'red' },
  invoiced: { label: 'Invoiced', tone: 'violet' },
  expired: { label: 'Expired', tone: 'amber' },
  applied: { label: 'Applied', tone: 'green' },
};

export const STATUSES_BY_TYPE: Record<DocumentType, DocumentStatus[]> = {
  invoice: ['draft', 'sent', 'partial', 'paid', 'void'],
  quote: ['draft', 'sent', 'accepted', 'declined', 'invoiced'],
  credit: ['draft', 'sent', 'partial', 'applied', 'void'],
};

type StatusInput = Pick<InvoiceDocument, 'type' | 'status' | 'dueDate'> & {
  totals: Pick<InvoiceDocument['totals'], 'balance'>;
};

/** Status shown to the user; adds the time-based "overdue" and "expired" states. */
export function displayStatus(doc: StatusInput, todayIso: ISODate): DisplayStatus {
  if (
    doc.type === 'invoice' &&
    (doc.status === 'sent' || doc.status === 'partial') &&
    doc.dueDate &&
    doc.dueDate < todayIso &&
    doc.totals.balance > 0
  ) {
    return 'overdue';
  }
  if (doc.type === 'quote' && doc.status === 'sent' && doc.dueDate && doc.dueDate < todayIso) {
    return 'expired';
  }
  return doc.status;
}

/** Invoice / credit status after its paid amount changed. */
export function settledStatus(
  doc: Pick<InvoiceDocument, 'type' | 'status'>,
  total: number,
  paid: number,
): DocumentStatus {
  if (doc.type === 'quote' || doc.status === 'void') return doc.status;
  const balance = total - paid;
  const done = doc.type === 'credit' ? 'applied' : 'paid';
  if (paid !== 0 && balance < 1e-9) return done;
  if (paid !== 0) return 'partial';
  return doc.status === 'draft' ? 'draft' : 'sent';
}

/** Documents that still expect money (used by dashboards and reminders). */
export function isOutstanding(doc: Pick<InvoiceDocument, 'type' | 'status'>): boolean {
  return doc.type === 'invoice' && (doc.status === 'sent' || doc.status === 'partial');
}
