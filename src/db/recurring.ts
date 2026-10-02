import { db } from './db';
import { createDocument, emptyTotals, nowStamp } from './defaults';
import { markSent, saveDocument } from './documents';
import { logActivity } from './activity';
import type { ID, InvoiceDocument, ISODate, RecurringProfile } from './types';
import { addDaysISO, occurrenceDate, today } from '@/lib/dates';
import { replaceDatePlaceholders } from '@/lib/placeholders';
import { shortId } from '@/lib/ids';

/** Builds (without saving) the invoice a profile produces for `issueDate`. */
export function invoiceFromProfile(
  profile: RecurringProfile,
  issueDate: ISODate,
  locale: string,
): InvoiceDocument {
  const t = profile.template;
  const fill = (s: string) => replaceDatePlaceholders(s, issueDate, locale);
  return createDocument(profile.companyId, 'invoice', {
    clientId: profile.clientId,
    issueDate,
    dueDate: addDaysISO(issueDate, profile.dueDays),
    currency: t.currency,
    items: t.items.map((i) => ({ ...i, id: shortId(), name: fill(i.name), description: fill(i.description) })),
    discount: t.discount,
    discountType: t.discountType,
    taxes: t.taxes,
    charges: t.charges.map((c) => ({ ...c, id: shortId(), label: fill(c.label) })),
    pricesIncludeTax: t.pricesIncludeTax,
    poNumber: fill(t.poNumber),
    notes: fill(t.notes),
    terms: fill(t.terms),
    footer: t.footer,
    privateNotes: t.privateNotes,
    templateId: t.templateId,
    recurringId: profile.id,
    totals: emptyTotals(),
  });
}

/** Moves a profile forward by one issued invoice. */
export function advanceProfile(profile: RecurringProfile): RecurringProfile {
  const issuedCount = profile.issuedCount + 1;
  const remainingCycles = profile.remainingCycles === null ? null : Math.max(0, profile.remainingCycles - 1);
  const done = remainingCycles === 0;
  return {
    ...profile,
    issuedCount,
    remainingCycles,
    status: done ? 'completed' : profile.status,
    nextIssueDate: done ? null : occurrenceDate(profile.startDate, profile.frequency, issuedCount),
    lastIssuedAt: nowStamp(),
    updatedAt: nowStamp(),
  };
}

/** Issues the next invoice of a profile right away. */
export async function issueNow(profileId: ID): Promise<InvoiceDocument | null> {
  const profile = await db.recurring.get(profileId);
  if (!profile || profile.status === 'completed' || !profile.nextIssueDate) return null;
  const company = await db.companies.get(profile.companyId);
  if (!company) return null;
  const issueDate = profile.nextIssueDate <= today() ? profile.nextIssueDate : today();
  const invoice = await saveDocument(invoiceFromProfile(profile, issueDate, company.locale));
  if (profile.markSent) await markSent(invoice.id);
  await db.recurring.put(advanceProfile(profile));
  await logActivity(company.id, 'recurring', profile.id, 'issued', `Recurring invoice ${invoice.number} created from “${profile.name || 'recurring profile'}”`, {
    clientId: profile.clientId || null,
    documentId: invoice.id,
  });
  return invoice;
}

/**
 * Creates every invoice that is due (catching up missed periods) for active
 * profiles. Runs when the app opens, since there is no server to schedule it.
 */
export async function generateDueInvoices(companyId: ID, asOf: ISODate = today()): Promise<InvoiceDocument[]> {
  const created: InvoiceDocument[] = [];
  const profiles = await db.recurring.where('companyId').equals(companyId).toArray();
  for (const p of profiles) {
    let profile: RecurringProfile | undefined = p;
    // Guard against runaway loops (e.g. a weekly profile left for years).
    for (let i = 0; i < 120 && profile; i++) {
      if (profile.status !== 'active' || profile.archived || !profile.clientId) break;
      if (!profile.nextIssueDate || profile.nextIssueDate > asOf) break;
      if (profile.remainingCycles !== null && profile.remainingCycles <= 0) break;
      const invoice = await issueNow(profile.id);
      if (!invoice) break;
      created.push(invoice);
      profile = await db.recurring.get(profile.id);
    }
  }
  return created;
}

export const FREQUENCY_LABEL: Record<RecurringProfile['frequency'], string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  bimonthly: 'Every 2 months',
  quarterly: 'Quarterly',
  semiannually: 'Every 6 months',
  yearly: 'Yearly',
};
