import { Field, Input, NumberInput, Select, Textarea } from '@/components/ui/form';
import { CurrencySelect, DateFormatSelect, LocaleSelect } from '@/components/fields';
import { formatDate, formatMoney } from '@/lib/format';
import { today } from '@/lib/dates';
import type { DocumentDefaults, PageSize } from '@/db/types';
import { SaveBar, SettingsSection, useCompanyDraft } from './shared';

export default function DocumentSettings() {
  const { draft, update, dirty, saving, save, reset } = useCompanyDraft();
  const d = draft.defaults;
  const setDefaults = (patch: Partial<DocumentDefaults>) =>
    update({ defaults: { ...d, ...patch } });

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Regional format"
        description="Currency and how numbers and dates are written."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default currency" hint="Clients can override it.">
            {(id) => (
              <CurrencySelect
                id={id}
                value={draft.currency}
                onChange={(currency) => update({ currency })}
              />
            )}
          </Field>
          <Field label="Number format">
            {(id) => (
              <LocaleSelect
                id={id}
                value={draft.locale}
                onChange={(locale) => update({ locale })}
              />
            )}
          </Field>
          <Field label="Date format">
            {(id) => (
              <DateFormatSelect
                id={id}
                value={draft.dateFormat}
                onChange={(dateFormat) => update({ dateFormat })}
              />
            )}
          </Field>
          <Field label="Paper size">
            {(id) => (
              <Select
                id={id}
                value={d.pageSize}
                onChange={(e) => setDefaults({ pageSize: e.target.value as PageSize })}
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="LETTER">US Letter (8.5 × 11 in)</option>
              </Select>
            )}
          </Field>
        </div>
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Preview:{' '}
          <strong className="tabular">
            {formatMoney(1234567.891, draft.currency, draft.locale)}
          </strong>{' '}
          · <strong>{formatDate(today(), draft.dateFormat, draft.locale)}</strong>
        </p>
      </SettingsSection>

      <SettingsSection title="Due dates">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Invoice payment terms (days)"
            hint="Due date = issue date + this many days. 0 = due on receipt."
          >
            {(id) => (
              <NumberInput
                id={id}
                value={d.paymentTermsDays}
                onValueChange={(v) => setDefaults({ paymentTermsDays: Math.max(0, Math.round(v)) })}
                allowNegative={false}
              />
            )}
          </Field>
          <Field label="Quotes valid for (days)">
            {(id) => (
              <NumberInput
                id={id}
                value={d.quoteValidDays}
                onValueChange={(v) => setDefaults({ quoteValidDays: Math.max(0, Math.round(v)) })}
                allowNegative={false}
              />
            )}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Default text"
        description="Pre-filled on new documents; you can still edit them per document."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Invoice notes">
            {(id) => (
              <Textarea
                id={id}
                value={d.invoiceNotes}
                onChange={(e) => setDefaults({ invoiceNotes: e.target.value })}
                rows={3}
              />
            )}
          </Field>
          <Field label="Invoice terms">
            {(id) => (
              <Textarea
                id={id}
                value={d.invoiceTerms}
                onChange={(e) => setDefaults({ invoiceTerms: e.target.value })}
                rows={3}
              />
            )}
          </Field>
          <Field label="Quote notes">
            {(id) => (
              <Textarea
                id={id}
                value={d.quoteNotes}
                onChange={(e) => setDefaults({ quoteNotes: e.target.value })}
                rows={3}
              />
            )}
          </Field>
          <Field label="Quote terms">
            {(id) => (
              <Textarea
                id={id}
                value={d.quoteTerms}
                onChange={(e) => setDefaults({ quoteTerms: e.target.value })}
                rows={3}
              />
            )}
          </Field>
          <Field label="Credit note notes">
            {(id) => (
              <Textarea
                id={id}
                value={d.creditNotes}
                onChange={(e) => setDefaults({ creditNotes: e.target.value })}
                rows={3}
              />
            )}
          </Field>
          <Field label="Credit note terms">
            {(id) => (
              <Textarea
                id={id}
                value={d.creditTerms}
                onChange={(e) => setDefaults({ creditTerms: e.target.value })}
                rows={3}
              />
            )}
          </Field>
        </div>
        <Field
          label="Footer"
          hint="Small print at the bottom of every page, e.g. registered office or legal notice."
        >
          {(id) => (
            <Input
              id={id}
              value={d.footer}
              onChange={(e) => setDefaults({ footer: e.target.value })}
            />
          )}
        </Field>
      </SettingsSection>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
