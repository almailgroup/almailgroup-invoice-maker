import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { db } from '@/db/db';
import { createRecurring } from '@/db/defaults';
import { defaultTaxes as loadDefaultTaxes, newLineItem } from '@/db/documents';
import { FREQUENCY_LABEL, generateDueInvoices, invoiceFromProfile } from '@/db/recurring';
import type { Frequency, InvoiceDocument, RecurringProfile, TaxLine } from '@/db/types';
import { useCompany, useFormat } from '@/app/company';
import { computeDocument } from '@/lib/document-calc';
import { FREQUENCIES, occurrenceDate, today } from '@/lib/dates';
import { currencySymbol, formatUnitPrice } from '@/lib/format';
import { DATE_PLACEHOLDERS } from '@/lib/placeholders';
import { TEMPLATE_META } from '@/pdf/template-meta';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader, Spinner } from '@/components/ui/misc';
import { Field, Input, NumberInput, Select, Switch, Textarea } from '@/components/ui/form';
import { Combobox } from '@/components/ui/combobox';
import { CurrencySelect } from '@/components/fields';
import { PdfPreview } from '@/components/pdf/pdf-preview';
import { useLivePdf } from '@/components/pdf/use-pdf';
import { LineItemsEditor } from '@/features/editor/line-items';
import { TotalsPanel } from '@/features/editor/totals-panel';
import { ClientDialog } from '@/features/clients/client-dialog';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';

export default function RecurringEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const company = useCompany();
  const fmt = useFormat();
  const [profile, setProfile] = useState<RecurringProfile | null>(null);
  const [original, setOriginal] = useState('');
  const [defaultTaxes, setDefaultTaxes] = useState<TaxLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const [clientDialog, setClientDialog] = useState<{ open: boolean; name: string }>({
    open: false,
    name: '',
  });

  const clients = useLiveQuery(
    () => db.clients.where('companyId').equals(company.id).toArray(),
    [company.id],
  );
  const products = useLiveQuery(
    () => db.products.where('companyId').equals(company.id).toArray(),
    [company.id],
  );
  const taxRates = useLiveQuery(
    () => db.taxRates.where('companyId').equals(company.id).toArray(),
    [company.id],
  );
  const currentCompany = useEffectEvent(() => company);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = currentCompany();
      const taxes = await loadDefaultTaxes(c);
      let loaded: RecurringProfile | undefined;
      if (id) {
        loaded = await db.recurring.get(id);
        if (!loaded || loaded.companyId !== c.id) {
          if (!cancelled) setMissing(true);
          return;
        }
      } else {
        const base = createRecurring(c.id);
        loaded = {
          ...base,
          dueDays: c.defaults.paymentTermsDays,
          template: {
            ...base.template,
            currency: c.currency,
            pricesIncludeTax: c.defaults.pricesIncludeTax,
            taxes: c.defaults.documentTaxes ? taxes : [],
            items: [newLineItem(c.defaults.lineTaxes ? taxes : [])],
            notes: c.defaults.invoiceNotes,
            terms: c.defaults.invoiceTerms,
            footer: c.defaults.footer,
          },
        };
      }
      if (!cancelled) {
        setDefaultTaxes(taxes);
        setProfile(loaded);
        setOriginal(JSON.stringify(loaded));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, company.id]);

  const client = useMemo(
    () => (profile && clients ? (clients.find((c) => c.id === profile.clientId) ?? null) : null),
    [profile, clients],
  );
  const nextDate = profile ? (profile.nextIssueDate ?? profile.startDate) : today();

  // The invoice the profile will produce next, with placeholders filled in.
  const preview = useMemo(
    () => (profile ? invoiceFromProfile(profile, nextDate, company.locale) : null),
    [profile, nextDate, company.locale],
  );
  const pdf = useLivePdf(
    preview ? { ...preview, number: 'Next' } : null,
    company,
    client,
    profile?.template.templateId ?? company.branding.templateId,
  );

  const dirty = profile !== null && JSON.stringify(profile) !== original;
  const allowNavigation = useUnsavedGuard(dirty && !saving);

  if (missing) {
    return (
      <Card className="p-10 text-center">
        <p className="text-slate-600">This recurring invoice could not be found.</p>
        <Link to="/recurring" className="text-primary-700 mt-4 inline-block text-sm font-medium">
          Back
        </Link>
      </Card>
    );
  }
  if (!profile || !preview || !clients || !products || !taxRates)
    return <Spinner className="py-24" label="Loading…" />;

  const set = (patch: Partial<RecurringProfile>) => setProfile((p) => (p ? { ...p, ...patch } : p));
  const setTemplate = (patch: Partial<RecurringProfile['template']>) =>
    setProfile((p) => (p ? { ...p, template: { ...p.template, ...patch } } : p));

  // Totals are computed on the raw template (placeholders don't change amounts).
  const templateDoc: InvoiceDocument = {
    ...preview,
    items: profile.template.items,
    charges: profile.template.charges,
  };
  const result = computeDocument(templateDoc, { taxExempt: client?.taxExempt });
  const money = (n: number) => fmt.money(n, profile.template.currency);
  const showLineTaxes =
    company.defaults.lineTaxes || profile.template.items.some((i) => i.taxes.length > 0);

  const reschedule = (patch: Partial<RecurringProfile>) => {
    const next = { ...profile, ...patch };
    set({
      ...patch,
      nextIssueDate:
        next.status === 'completed'
          ? null
          : occurrenceDate(next.startDate, next.frequency, next.issuedCount),
    });
  };

  const save = async () => {
    if (!profile.clientId) return toast.error('Choose a client.');
    if (
      !profile.template.items.some((i) => i.kind === 'item' && (i.name.trim() || i.unitPrice !== 0))
    ) {
      return toast.error('Add at least one item.');
    }
    setSaving(true);
    try {
      await db.recurring.put({ ...profile, updatedAt: new Date().toISOString() });
      const created = await generateDueInvoices(company.id);
      toast.success(
        created.length
          ? `Saved — ${created.length} invoice${created.length === 1 ? '' : 's'} created now`
          : `Saved — next invoice on ${fmt.date(profile.nextIssueDate)}`,
      );
      allowNavigation();
      navigate('/recurring');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save.');
      setSaving(false);
    }
  };

  const ends = profile.remainingCycles === null ? 'never' : 'after';

  return (
    <div>
      <PageHeader
        breadcrumb={<Link to="/recurring">Recurring invoices</Link>}
        title={id ? `Edit ${profile.name || 'recurring invoice'}` : 'New recurring invoice'}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Schedule"
              description={`${FREQUENCY_LABEL[profile.frequency]} · next invoice ${fmt.date(profile.nextIssueDate) || '—'}`}
            />
            <CardBody className="grid gap-4 md:grid-cols-2">
              <Field label="Name" hint="Only for you, e.g. “Monthly retainer”.">
                {(fid) => (
                  <Input
                    id={fid}
                    value={profile.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Client">
                {(fid) => (
                  <Combobox
                    id={fid}
                    value={profile.clientId || null}
                    onChange={(clientId) => {
                      const c = clients.find((x) => x.id === clientId);
                      set({ clientId });
                      if (c) setTemplate({ currency: c.currency || company.currency });
                    }}
                    options={clients
                      .filter((c) => !c.archived)
                      .map((c) => ({ value: c.id, label: c.name, detail: c.number }))}
                    placeholder="Choose a client…"
                    onCreate={(name) => setClientDialog({ open: true, name })}
                    createLabel="New client"
                  />
                )}
              </Field>
              <Field label="Frequency">
                {(fid) => (
                  <Select
                    id={fid}
                    value={profile.frequency}
                    onChange={(e) => reschedule({ frequency: e.target.value as Frequency })}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="First invoice date">
                {(fid) => (
                  <Input
                    id={fid}
                    type="date"
                    value={profile.startDate}
                    onChange={(e) => e.target.value && reschedule({ startDate: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Ends">
                {(fid) => (
                  <div className="flex gap-2">
                    <Select
                      id={fid}
                      value={ends}
                      onChange={(e) =>
                        set({
                          remainingCycles:
                            e.target.value === 'never'
                              ? null
                              : Math.max(1, profile.remainingCycles ?? 12),
                        })
                      }
                      className="w-36"
                    >
                      <option value="never">Never</option>
                      <option value="after">After</option>
                    </Select>
                    {ends === 'after' ? (
                      <div className="flex items-center gap-2">
                        <NumberInput
                          aria-label="Number of invoices left"
                          value={profile.remainingCycles ?? 1}
                          onValueChange={(n) =>
                            set({
                              remainingCycles: Math.max(0, Math.round(n)),
                              status:
                                Math.round(n) > 0 && profile.status === 'completed'
                                  ? 'active'
                                  : profile.status,
                            })
                          }
                          allowNegative={false}
                          className="w-20"
                        />
                        <span className="text-sm text-slate-500">more</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </Field>
              <Field label="Payment due (days after issue)">
                {(fid) => (
                  <NumberInput
                    id={fid}
                    value={profile.dueDays}
                    onValueChange={(n) => set({ dueDays: Math.max(0, Math.round(n)) })}
                    allowNegative={false}
                  />
                )}
              </Field>
              <Field label="Currency">
                {(fid) => (
                  <CurrencySelect
                    id={fid}
                    value={profile.template.currency}
                    onChange={(currency) => setTemplate({ currency })}
                  />
                )}
              </Field>
              <Field label="Template">
                {(fid) => (
                  <Select
                    id={fid}
                    value={profile.template.templateId ?? ''}
                    onChange={(e) => setTemplate({ templateId: e.target.value || null })}
                  >
                    <option value="">Company default</option>
                    {TEMPLATE_META.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="space-y-3 md:col-span-2">
                <Switch
                  checked={profile.markSent}
                  onChange={(markSent) => set({ markSent })}
                  label="Mark new invoices as sent"
                  description="Otherwise they are created as drafts for you to review and send."
                />
                {profile.status !== 'completed' ? (
                  <Switch
                    checked={profile.status === 'active'}
                    onChange={(on) => set({ status: on ? 'active' : 'paused' })}
                    label="Active"
                    description="Pause to stop creating invoices without deleting the schedule."
                  />
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Items"
              description={
                <>
                  Use {DATE_PLACEHOLDERS.map((p) => p.token).join(', ')} in text to insert the
                  invoice’s period.
                </>
              }
            />
            <CardBody>
              <LineItemsEditor
                items={profile.template.items}
                onChange={(items) => setTemplate({ items })}
                lines={result.lines}
                products={products}
                taxRates={taxRates}
                showTaxes={showLineTaxes}
                defaultTaxes={company.defaults.lineTaxes ? defaultTaxes : []}
                currencySymbol={currencySymbol(profile.template.currency, fmt.locale)}
                formatMoney={money}
                formatPrice={(amount) =>
                  formatUnitPrice(amount, profile.template.currency, fmt.locale)
                }
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Totals" />
            <CardBody>
              <TotalsPanel
                doc={templateDoc}
                onChange={(patch) => {
                  const { discount, discountType, taxes, charges, pricesIncludeTax } = patch;
                  setTemplate({
                    ...(discount !== undefined ? { discount } : {}),
                    ...(discountType !== undefined ? { discountType } : {}),
                    ...(taxes !== undefined ? { taxes } : {}),
                    ...(charges !== undefined ? { charges } : {}),
                    ...(pricesIncludeTax !== undefined ? { pricesIncludeTax } : {}),
                  });
                }}
                result={result}
                taxRates={taxRates}
                showDocumentTaxes={company.defaults.documentTaxes}
                showLineTaxes={showLineTaxes}
                defaultTaxes={defaultTaxes}
                currencySymbol={currencySymbol(profile.template.currency, fmt.locale)}
                money={money}
                percent={fmt.percent}
                taxExempt={Boolean(client?.taxExempt)}
                allowDeposit={false}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes & terms" />
            <CardBody className="space-y-4">
              <Field label="Notes">
                {(fid) => (
                  <Textarea
                    id={fid}
                    value={profile.template.notes}
                    onChange={(e) => setTemplate({ notes: e.target.value })}
                    rows={3}
                  />
                )}
              </Field>
              <Field label="Terms & conditions">
                {(fid) => (
                  <Textarea
                    id={fid}
                    value={profile.template.terms}
                    onChange={(e) => setTemplate({ terms: e.target.value })}
                    rows={3}
                  />
                )}
              </Field>
              <Field label="PO / reference" optional>
                {(fid) => (
                  <Input
                    id={fid}
                    value={profile.template.poNumber}
                    onChange={(e) => setTemplate({ poNumber: e.target.value })}
                  />
                )}
              </Field>
            </CardBody>
          </Card>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-20 space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Next invoice ({fmt.date(nextDate)})
            </p>
            <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-xl bg-slate-200/60 p-4">
              <PdfPreview blob={pdf.blob} loading={pdf.loading} error={pdf.error} />
            </div>
          </div>
        </aside>
      </div>

      {clientDialog.open ? (
        <ClientDialog
          open
          onOpenChange={(open) => setClientDialog((s) => ({ ...s, open }))}
          company={company}
          initialName={clientDialog.name}
          onSaved={(saved) => {
            set({ clientId: saved.id });
            setTemplate({ currency: saved.currency || company.currency });
          }}
        />
      ) : null}
    </div>
  );
}
