import type { CounterReset, NumberedEntity, NumberingRule } from '@/db/types';
import { NUMBER_PLACEHOLDERS, previewNumber } from '@/lib/numbering';
import { defaultNumbering } from '@/db/defaults';
import { today } from '@/lib/dates';
import { Field, Input, NumberInput, Select } from '@/components/ui/form';
import { SaveBar, SettingsSection, useCompanyDraft } from './shared';

const ENTITIES: { key: NumberedEntity; label: string }[] = [
  { key: 'invoice', label: 'Invoices' },
  { key: 'quote', label: 'Quotes' },
  { key: 'credit', label: 'Credit notes' },
  { key: 'payment', label: 'Payments' },
  { key: 'client', label: 'Clients' },
  { key: 'journal', label: 'Manual journals' },
];

export default function NumberingSettings() {
  const { draft, update, dirty, saving, save, reset } = useCompanyDraft();
  // Companies created before manual journals existed have no rule for them yet.
  const ruleFor = (key: NumberedEntity) => draft.numbering[key] ?? defaultNumbering()[key];
  const setRule = (key: NumberedEntity, patch: Partial<NumberingRule>) =>
    update({ numbering: { ...draft.numbering, [key]: { ...ruleFor(key), ...patch } } });

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Number formats"
        description="How new numbers are built. Numbers already used are skipped automatically."
      >
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="mb-2 font-medium text-slate-700">Placeholders</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {NUMBER_PLACEHOLDERS.map((p) => (
              <li key={p.token}>
                <code className="text-primary-700 rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-slate-200">
                  {p.token}
                </code>{' '}
                {p.description}
              </li>
            ))}
          </ul>
        </div>
        <div className="divide-y divide-slate-100">
          {ENTITIES.map(({ key, label }) => {
            const rule = ruleFor(key);
            const missingCounter = !/\{counter\}/i.test(rule.pattern);
            return (
              <div
                key={key}
                className="grid gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[140px_minmax(0,1fr)_100px_110px_150px]"
              >
                <div className="pt-7">
                  <p className="font-medium text-slate-800">{label}</p>
                  <p className="tabular mt-0.5 text-xs text-slate-500">
                    Next: {previewNumber(rule, today())}
                  </p>
                </div>
                <Field
                  label="Pattern"
                  error={missingCounter ? '{counter} will be added at the end' : undefined}
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={rule.pattern}
                      onChange={(e) => setRule(key, { pattern: e.target.value })}
                      className="font-mono"
                    />
                  )}
                </Field>
                <Field label="Digits">
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={rule.padding}
                      onValueChange={(v) =>
                        setRule(key, { padding: Math.min(10, Math.max(0, Math.round(v))) })
                      }
                      allowNegative={false}
                    />
                  )}
                </Field>
                <Field label="Next counter">
                  {(id) => (
                    <NumberInput
                      id={id}
                      value={rule.next}
                      onValueChange={(v) => setRule(key, { next: Math.max(1, Math.round(v)) })}
                      allowNegative={false}
                    />
                  )}
                </Field>
                <Field label="Restart counter">
                  {(id) => (
                    <Select
                      id={id}
                      value={rule.reset}
                      onChange={(e) =>
                        setRule(key, { reset: e.target.value as CounterReset, period: '' })
                      }
                    >
                      <option value="never">Never</option>
                      <option value="yearly">Every year</option>
                      <option value="monthly">Every month</option>
                    </Select>
                  )}
                </Field>
              </div>
            );
          })}
        </div>
      </SettingsSection>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
