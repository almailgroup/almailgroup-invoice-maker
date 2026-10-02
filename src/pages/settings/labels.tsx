import type { DocumentLanguage } from '@/db/types';
import { getLabels, LABEL_DESCRIPTIONS, LABEL_KEYS, LANGUAGES, type LabelKey } from '@/pdf/labels';
import { Field, Input, Select } from '@/components/ui/form';
import { SaveBar, SettingsSection, useCompanyDraft } from './shared';

const HUMAN: Record<LabelKey, string> = {
  invoice: 'Invoice title',
  quote: 'Quote title',
  credit: 'Credit note title',
  invoiceNumber: 'Invoice number',
  quoteNumber: 'Quote number',
  creditNumber: 'Credit note number',
  issueDate: 'Issue date',
  dueDate: 'Due date',
  validUntil: 'Valid until',
  poNumber: 'PO number',
  from: 'From',
  billTo: 'Bill to',
  quoteTo: 'Prepared for',
  shipTo: 'Ship to',
  description: 'Description column',
  quantity: 'Quantity column',
  unitPrice: 'Unit price column',
  discount: 'Discount',
  tax: 'Tax column',
  amount: 'Amount column',
  subtotal: 'Subtotal',
  total: 'Total',
  paid: 'Amount paid',
  balanceDue: 'Balance due',
  amountDue: 'Amount due',
  creditRemaining: 'Credit remaining',
  depositDue: 'Deposit due',
  includes: 'Includes (tax-inclusive)',
  notes: 'Notes',
  terms: 'Terms',
  paymentDetails: 'Payment details',
  payOnline: 'Pay online',
  scanToPay: 'Scan to pay',
  page: 'Page',
  of: 'of',
  paidStamp: 'Paid stamp',
  voidStamp: 'Void stamp',
  overdueStamp: 'Overdue stamp',
  acceptedStamp: 'Accepted stamp',
};

export default function LabelSettings() {
  const { draft, update, dirty, saving, save, reset } = useCompanyDraft();
  const defaults = getLabels(draft.language);

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Document language"
        description="Language of the words printed on invoices, quotes and credit notes."
      >
        <Field label="Language" hint="Clients can have their own language (Clients → edit).">
          {(id) => (
            <Select
              id={id}
              value={draft.language}
              onChange={(e) => update({ language: e.target.value as DocumentLanguage })}
              className="max-w-xs"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Custom wording"
        description="Override any printed word — e.g. “Tax Invoice” instead of “Invoice”, or “Estimate” instead of “Quote”. Leave empty to use the default."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LABEL_KEYS.map((key) => (
            <Field key={key} label={HUMAN[key]} hint={LABEL_DESCRIPTIONS[key]}>
              {(id) => (
                <Input
                  id={id}
                  value={draft.labels[key] ?? ''}
                  placeholder={defaults[key]}
                  onChange={(e) => {
                    const labels = { ...draft.labels };
                    if (e.target.value) labels[key] = e.target.value;
                    else delete labels[key];
                    update({ labels });
                  }}
                />
              )}
            </Field>
          ))}
        </div>
      </SettingsSection>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
