import type { AccountRole, ID, ISODate, InvoiceDocument, ManualJournal, Payment } from '@/db/types';
import { computeDocument } from '@/lib/document-calc';
import { Decimal, dec, toMinor } from '@/lib/money';

/**
 * The general ledger is derived from the business documents: every issued
 * invoice, credit note, payment and posted manual journal turns into balanced
 * debit/credit lines here. Nothing is stored twice, so the books always match
 * the documents; the lock date protects closed periods.
 */

export type LedgerSource = 'invoice' | 'credit' | 'payment' | 'journal';

export interface LedgerLine {
  date: ISODate;
  accountId: ID;
  /** Company-currency minor units; positive is a debit, negative a credit. */
  amount: number;
  source: LedgerSource;
  sourceId: ID;
  /** Document number shown in reports, e.g. "INV-2026-0001". */
  number: string;
  contactId: ID | null;
  description: string;
}

export interface LedgerProblem {
  source: LedgerSource;
  sourceId: ID;
  number: string;
  message: string;
}

export interface LedgerContext {
  companyCurrency: string;
  /** Minor-unit digits of the company currency. */
  precision: number;
  /** Account used for each automatic posting. */
  roles: Partial<Record<AccountRole, ID>>;
  /** Accounts that exist (and may be used); overrides pointing elsewhere fall back. */
  accountIds: Set<ID>;
  productAccounts: Map<ID, ID | null | undefined>;
  taxExempt: (clientId: ID) => boolean;
  /** All documents by id, so payments can use the invoice's exchange rate. */
  documents: Map<ID, InvoiceDocument>;
}

export class UnbalancedEntryError extends Error {}

/** Company-currency value of one unit of the document currency. */
export function rateOf(
  item: { currency: string; exchangeRate?: number },
  ctx: Pick<LedgerContext, 'companyCurrency'>,
): number {
  if (item.currency === ctx.companyCurrency) return 1;
  const rate = item.exchangeRate;
  return rate && Number.isFinite(rate) && rate > 0 ? rate : 1;
}

export function needsRate(
  item: { currency: string; exchangeRate?: number },
  ctx: Pick<LedgerContext, 'companyCurrency'>,
): boolean {
  if (item.currency === ctx.companyCurrency) return false;
  return !(item.exchangeRate && Number.isFinite(item.exchangeRate) && item.exchangeRate > 0);
}

/** Documents that are part of the books (issued, not void). */
export function isPosted(doc: Pick<InvoiceDocument, 'type' | 'status'>): boolean {
  if (doc.type === 'quote') return false;
  return doc.status !== 'draft' && doc.status !== 'void';
}

function role(ctx: LedgerContext, name: AccountRole, fallback?: AccountRole): ID {
  const id = ctx.roles[name] ?? (fallback ? ctx.roles[fallback] : undefined);
  if (!id) throw new Error(`No account is set up for "${name}".`);
  return id;
}

function usable(ctx: LedgerContext, id: ID | null | undefined): ID | null {
  return id && ctx.accountIds.has(id) ? id : null;
}

/**
 * Splits `total` minor units over weights. Each share is rounded and the
 * remainder goes to the largest weight, so the parts always add up exactly.
 */
export function allocate(total: number, weights: Decimal[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((acc, w) => acc.plus(w), new Decimal(0));
  if (sum.isZero()) return weights.map((_, i) => (i === 0 ? total : 0));
  const parts = weights.map((w) => toMinor(dec(total).times(w).dividedBy(sum), 0));
  const diff = total - parts.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let largest = 0;
    weights.forEach((w, i) => {
      if (w.abs().gt(weights[largest].abs())) largest = i;
    });
    parts[largest] += diff;
  }
  return parts;
}

function balanced(lines: LedgerLine[]): boolean {
  return lines.reduce((acc, l) => acc + l.amount, 0) === 0;
}

/** Ledger lines of an invoice or credit note. */
export function postDocument(doc: InvoiceDocument, ctx: LedgerContext): LedgerLine[] {
  if (!isPosted(doc) || (doc.type !== 'invoice' && doc.type !== 'credit')) return [];
  const sign = doc.type === 'credit' ? -1 : 1;
  const exempt = doc.clientId ? ctx.taxExempt(doc.clientId) : false;
  const result = computeDocument(doc, { taxExempt: exempt });
  const rate = rateOf(doc, ctx);
  const p = ctx.precision;

  const total = toMinor(dec(result.total).times(rate), p);
  const taxes = result.taxes.map((t) => ({ ...t, minor: toMinor(dec(t.amount).times(rate), p) }));
  const income = total - taxes.reduce((acc, t) => acc + t.minor, 0);

  // Weight of each line in the net income: its share after the document
  // discount, without tax (prices that include tax have it backed out).
  const ratio =
    result.subtotal === 0
      ? new Decimal(1)
      : dec(result.subtotal).minus(dec(result.discount)).dividedBy(dec(result.subtotal));
  const rateSum = (list: { rate: number }[]) =>
    list
      .reduce((acc, t) => acc.plus(dec(t.rate)), new Decimal(0))
      .dividedBy(100)
      .plus(1);
  const docTaxes = exempt ? [] : doc.taxes;
  const groups = new Map<ID, { weight: Decimal; label: string }>();
  const add = (accountId: ID, weight: Decimal, label: string) => {
    const g = groups.get(accountId);
    if (g) g.weight = g.weight.plus(weight);
    else groups.set(accountId, { weight, label });
  };
  doc.items.forEach((item, i) => {
    if (item.kind === 'heading') return;
    const taxesOnLine = exempt ? [] : [...item.taxes, ...docTaxes];
    let weight = dec(result.lines[i].net).times(ratio);
    if (doc.pricesIncludeTax && taxesOnLine.length) weight = weight.dividedBy(rateSum(taxesOnLine));
    const account =
      usable(ctx, item.accountId) ??
      usable(ctx, item.productId ? ctx.productAccounts.get(item.productId) : null) ??
      role(ctx, 'sales');
    add(account, weight, item.name);
  });
  for (const charge of doc.charges) {
    const taxesOnCharge = exempt ? [] : charge.taxes;
    let weight = dec(charge.amount);
    if (doc.pricesIncludeTax && taxesOnCharge.length)
      weight = weight.dividedBy(rateSum(taxesOnCharge));
    add(role(ctx, 'charges', 'sales'), weight, charge.label);
  }
  if (groups.size === 0) add(role(ctx, 'sales'), new Decimal(1), '');

  const base = {
    date: doc.issueDate,
    source: doc.type as LedgerSource,
    sourceId: doc.id,
    number: doc.number,
    contactId: doc.clientId || null,
  };
  const noun = doc.type === 'credit' ? 'Credit note' : 'Invoice';
  const lines: LedgerLine[] = [
    {
      ...base,
      accountId: role(ctx, 'receivable'),
      amount: sign * total,
      description: `${noun} ${doc.number}`,
    },
  ];
  const entries = [...groups.entries()];
  allocate(
    income,
    entries.map(([, g]) => g.weight),
  ).forEach((minor, i) => {
    const [accountId, g] = entries[i];
    lines.push({
      ...base,
      accountId,
      amount: -sign * minor,
      description:
        entries.length === 1 ? `${noun} ${doc.number}` : g.label || `${noun} ${doc.number}`,
    });
  });
  for (const t of taxes) {
    lines.push({
      ...base,
      accountId: role(ctx, 'output_tax'),
      amount: -sign * t.minor,
      description: `${t.name} ${t.rate}%`,
    });
  }
  const kept = lines.filter((l) => l.amount !== 0);
  if (!balanced(kept)) throw new UnbalancedEntryError(`${noun} ${doc.number} does not balance`);
  return kept;
}

/** Ledger lines of a payment received. Credit-note applications move no money. */
export function postPayment(payment: Payment, ctx: LedgerContext): LedgerLine[] {
  if (payment.method === 'credit_note') return [];
  const p = ctx.precision;
  const rate = rateOf(payment, ctx);
  const received = toMinor(dec(payment.amount).times(rate), p);
  if (received === 0) return [];

  // Receivable is cleared at each invoice's own rate; any difference is an
  // exchange gain or loss.
  let cleared = 0;
  let allocated = new Decimal(0);
  for (const a of payment.allocations) {
    const doc = ctx.documents.get(a.documentId);
    cleared += toMinor(dec(a.amount).times(doc ? rateOf(doc, ctx) : rate), p);
    allocated = allocated.plus(dec(a.amount));
  }
  const unapplied = dec(payment.amount).minus(allocated);
  if (unapplied.gt(0)) cleared += toMinor(unapplied.times(rate), p);

  const bank =
    usable(ctx, payment.accountId) ??
    role(ctx, payment.method === 'cash' ? 'cash' : 'bank', 'bank');
  const base = {
    date: payment.date,
    source: 'payment' as const,
    sourceId: payment.id,
    number: payment.number,
    contactId: payment.clientId || null,
  };
  const label = `Payment ${payment.number}`;
  const lines: LedgerLine[] = [
    { ...base, accountId: bank, amount: received, description: label },
    { ...base, accountId: role(ctx, 'receivable'), amount: -cleared, description: label },
  ];
  const fx = received - cleared;
  if (fx !== 0) {
    lines.push({
      ...base,
      accountId: role(ctx, 'fx'),
      amount: -fx,
      description: `Exchange difference ${payment.number}`,
    });
  }
  return lines.filter((l) => l.amount !== 0);
}

/** Ledger lines of a posted manual journal. */
export function postJournal(journal: ManualJournal, ctx: LedgerContext): LedgerLine[] {
  if (journal.status !== 'posted') return [];
  const lines = journal.lines
    .map((l) => ({
      date: journal.date,
      accountId: l.accountId,
      amount: toMinor(l.debit, ctx.precision) - toMinor(l.credit, ctx.precision),
      source: 'journal' as const,
      sourceId: journal.id,
      number: journal.number,
      contactId: l.contactId,
      description: l.description || journal.reference || `Journal ${journal.number}`,
    }))
    .filter((l) => l.amount !== 0);
  if (!balanced(lines))
    throw new UnbalancedEntryError(`Journal ${journal.number} does not balance`);
  return lines;
}

/**
 * Builds the ledger for a company. Documents that can't be posted (for
 * example a missing account) are reported as problems instead of failing.
 */
export function buildLedger(
  data: { documents: InvoiceDocument[]; payments: Payment[]; journals: ManualJournal[] },
  ctx: LedgerContext,
): { lines: LedgerLine[]; problems: LedgerProblem[] } {
  const lines: LedgerLine[] = [];
  const problems: LedgerProblem[] = [];
  const attempt = (source: LedgerSource, id: ID, number: string, post: () => LedgerLine[]) => {
    try {
      lines.push(...post());
    } catch (error) {
      problems.push({
        source,
        sourceId: id,
        number,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
  for (const doc of data.documents) {
    if (!isPosted(doc) || (doc.type !== 'invoice' && doc.type !== 'credit')) continue;
    if (needsRate(doc, ctx)) {
      problems.push({
        source: doc.type,
        sourceId: doc.id,
        number: doc.number,
        message: `No exchange rate for ${doc.currency}; 1:1 was used.`,
      });
    }
    attempt(doc.type, doc.id, doc.number, () => postDocument(doc, ctx));
  }
  for (const payment of data.payments) {
    if (payment.method !== 'credit_note' && needsRate(payment, ctx)) {
      problems.push({
        source: 'payment',
        sourceId: payment.id,
        number: payment.number,
        message: `No exchange rate for ${payment.currency}; 1:1 was used.`,
      });
    }
    attempt('payment', payment.id, payment.number, () => postPayment(payment, ctx));
  }
  for (const journal of data.journals) {
    attempt('journal', journal.id, journal.number, () => postJournal(journal, ctx));
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  return { lines, problems };
}
