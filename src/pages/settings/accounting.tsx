import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { LockOpen } from 'lucide-react';
import { db } from '@/db/db';
import type { AccountRole } from '@/db/types';
import { accountingSettings } from '@/db/chart-setup';
import { roleMap } from '@/db/accounting';
import { CHART_TEMPLATES } from '@/lib/accounting/charts';
import { fiscalYearEnd, fiscalYearStart } from '@/lib/accounting/statements';
import { today } from '@/lib/dates';
import { useFormat } from '@/app/company';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { SaveBar, SettingsSection, useCompanyDraft } from './shared';

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2024, i, 1).toLocaleString('en', { month: 'long' }),
);

const ROLE_LABELS: Partial<Record<AccountRole, string>> = {
  receivable: 'Money owed by clients',
  bank: 'Payments received (default)',
  cash: 'Cash payments',
  sales: 'Sales (unless a product says otherwise)',
  charges: 'Delivery and other charges',
  output_tax: 'Tax charged on sales',
  input_tax: 'Tax paid on purchases',
  fx: 'Exchange gains and losses',
  capital: 'Owner or share capital',
  retained_earnings: 'Retained earnings',
};

export default function AccountingSettings() {
  const fmt = useFormat();
  const { draft, update, dirty, saving, save, reset } = useCompanyDraft();
  const settings = accountingSettings(draft);
  const setSettings = (patch: Partial<typeof settings>) =>
    update({ accounting: { ...settings, ...patch } });
  const accounts = useLiveQuery(
    () => db.accounts.where('companyId').equals(draft.id).toArray(),
    [draft.id],
  );
  const roles = accounts ? roleMap(accounts) : {};
  const { month, day } = settings.fiscalYearEnd;
  const daysInMonth = new Date(2023, month, 0).getDate();
  const now = today();

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Financial year"
        description="Reports use it for “this year”, and income and expenses start again at zero each year."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Year ends on (month)">
            {(id) => (
              <Select
                id={id}
                value={month}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setSettings({
                    fiscalYearEnd: { month: m, day: Math.min(day, new Date(2023, m, 0).getDate()) },
                  });
                }}
              >
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Day">
            {(id) => (
              <Select
                id={id}
                value={day}
                onChange={(e) =>
                  setSettings({ fiscalYearEnd: { month, day: Number(e.target.value) } })
                }
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <p className="text-sm text-slate-500">
          Current financial year: {fmt.date(fiscalYearStart(now, settings.fiscalYearEnd))} –{' '}
          {fmt.date(fiscalYearEnd(now, settings.fiscalYearEnd))}
        </p>
      </SettingsSection>

      <SettingsSection
        title="Lock date"
        description="Once a period is reported or filed, lock it so nothing dated on or before the lock date can be added, changed or deleted."
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Lock transactions up to and including">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={settings.lockDate ?? ''}
                onChange={(e) => setSettings({ lockDate: e.target.value || null })}
                className="w-52"
              />
            )}
          </Field>
          {settings.lockDate ? (
            <Button variant="outline" onClick={() => setSettings({ lockDate: null })}>
              <LockOpen /> Remove lock
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-slate-500">
          Draft invoices and quotes stay editable. Issued invoices, credit notes, payments and
          journals in the locked period are protected.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Chart of accounts"
        description={`Started from the ${CHART_TEMPLATES[settings.template].name} chart. Rename accounts or add new ones in the chart of accounts.`}
        actions={
          <Link to="/accounts" className="text-primary-700 text-sm font-medium hover:underline">
            Open chart of accounts
          </Link>
        }
      >
        <div className="divide-y divide-slate-100 text-sm">
          {(Object.keys(ROLE_LABELS) as AccountRole[]).map((role) => {
            const account = accounts?.find((a) => a.id === roles[role]);
            return (
              <div key={role} className="flex items-center justify-between gap-4 py-2">
                <span className="text-slate-600">{ROLE_LABELS[role]}</span>
                <span className="font-medium text-slate-900">
                  {account ? (
                    <>
                      <span className="tabular mr-2 text-slate-400">{account.code}</span>
                      {account.name}
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
