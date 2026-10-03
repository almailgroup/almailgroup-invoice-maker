import type { Payment } from '@/db/types';

/** Money received from clients, or paid to vendors. */
export type PaymentDirection = 'in' | 'out';

export function paymentDirection(payment: Pick<Payment, 'direction'>): PaymentDirection {
  return payment.direction === 'out' ? 'out' : 'in';
}

export const PAYMENT_COPY = {
  in: {
    title: 'Payments received',
    description: 'Money received and credit notes applied.',
    base: '/payments',
    contactBase: '/clients',
    party: 'Client',
    parties: 'clients',
    docType: 'invoice' as const,
    creditType: 'credit' as const,
    doc: 'invoice',
    docs: 'invoices',
    credit: 'credit note',
    amount: 'Amount received',
    account: 'Deposit to',
    accountHint: 'The bank or cash account the money went into.',
    who: 'Who paid?',
    preposition: 'from',
    unapplied: 'client credit',
    total: 'Received',
    empty: 'Record payments as they arrive to keep invoice balances up to date.',
  },
  out: {
    title: 'Payments made',
    description: 'Money paid to vendors and vendor credits applied.',
    base: '/payments-made',
    contactBase: '/vendors',
    party: 'Vendor',
    parties: 'vendors',
    docType: 'bill' as const,
    creditType: 'vendor_credit' as const,
    doc: 'bill',
    docs: 'bills',
    credit: 'vendor credit',
    amount: 'Amount paid',
    account: 'Paid from',
    accountHint: 'The bank, cash or card account the money came from.',
    who: 'Who did you pay?',
    preposition: 'to',
    unapplied: 'advance to the vendor',
    total: 'Paid',
    empty: 'Record what you pay vendors to keep bill balances up to date.',
  },
};
