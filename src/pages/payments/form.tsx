import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/db/db';
import { createPayment, PAYMENT_METHODS, savePayment } from '@/db/payments';
import type { InvoiceDocument, Payment, PaymentMethod } from '@/db/types';
import { useCompany, useFormat } from '@/app/company';
import { currencyPrecision, round } from '@/lib/money';
import { today } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader, Spinner } from '@/components/ui/misc';
import { Field, Input, NumberInput, Select, Textarea } from '@/components/ui/form';
import { Combobox } from '@/components/ui/combobox';
import { CurrencySelect } from '@/components/fields';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';

export default function PaymentFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const company = useCompany();
  const fmt = useFormat();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [original, setOriginal] = useState('');
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded: Payment | undefined;
      if (id) {
        loaded = await db.payments.get(id);
        if (!loaded || loaded.companyId !== company.id) {
          if (!cancelled) setMissing(true);
          return;
        }
      } else {
        const clientId = params.get('client') ?? '';
        const client = clientId ? await db.clients.get(clientId) : undefined;
        loaded = createPayment(company.id, {
          clientId,
          currency: client?.currency ?? company.currency,
        });
      }
      if (!cancelled) {
        setPayment(loaded);
        setOriginal(JSON.stringify(loaded));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, company.id, company.currency, params]);

  const clients = useLiveQuery(
    () => db.clients.where('companyId').equals(company.id).toArray(),
    [company.id],
  );
  const moneyAccounts = useLiveQuery(
    () =>
      db.accounts
        .where('companyId')
        .equals(company.id)
        .filter((a) => a.type === 'asset_cash' && !a.archived)
        .toArray(),
    [company.id],
  );
  const clientId = payment?.clientId ?? '';
  const clientDocs = useLiveQuery(
    () =>
      clientId
        ? db.documents.where('clientId').equals(clientId).toArray()
        : Promise.resolve([] as InvoiceDocument[]),
    [clientId],
  );

  const dirty = payment !== null && JSON.stringify(payment) !== original;
  const allowNavigation = useUnsavedGuard(dirty && !saving);

  // The payment as stored before editing; what it already holds is available again.
  const before = useMemo(() => (original ? (JSON.parse(original) as Payment) : null), [original]);
  const previous = useMemo(
    () => new Map((before?.allocations ?? []).map((a) => [a.documentId, a.amount] as const)),
    [before],
  );

  const invoices = useMemo(() => {
    if (!clientDocs || !payment) return [];
    return clientDocs
      .filter(
        (d) =>
          d.type === 'invoice' &&
          d.currency === payment.currency &&
          (d.status === 'sent' ||
            d.status === 'partial' ||
            d.status === 'draft' ||
            previous.has(d.id)),
      )
      .map((d) => ({
        doc: d,
        available: round(
          d.totals.balance + (previous.get(d.id) ?? 0),
          currencyPrecision(d.currency),
        ),
      }))
      .filter((x) => x.available > 0 || previous.has(x.doc.id))
      .sort((a, b) =>
        (a.doc.dueDate ?? a.doc.issueDate).localeCompare(b.doc.dueDate ?? b.doc.issueDate),
      );
  }, [clientDocs, payment, previous]);

  const credits = useMemo(() => {
    if (!clientDocs || !payment) return [];
    return clientDocs.filter(
      (d) =>
        d.type === 'credit' &&
        d.currency === payment.currency &&
        (d.status === 'sent' || d.status === 'partial' || before?.creditId === d.id),
    );
  }, [clientDocs, payment, before]);

  if (missing) {
    return (
      <Card className="p-10 text-center">
        <p className="text-slate-600">This payment could not be found.</p>
        <Link to="/payments" className="text-primary-700 mt-4 inline-block text-sm font-medium">
          Back to payments
        </Link>
      </Card>
    );
  }
  if (!payment || !clients) return <Spinner className="py-24" label="Loading…" />;

  const set = (patch: Partial<Payment>) => setPayment((p) => (p ? { ...p, ...patch } : p));
  const precision = currencyPrecision(payment.currency);
  const allocationFor = (docId: string) =>
    payment.allocations.find((a) => a.documentId === docId)?.amount ?? 0;
  const setAllocation = (docId: string, amount: number) =>
    set({
      allocations: [
        ...payment.allocations.filter((a) => a.documentId !== docId),
        ...(amount !== 0 ? [{ documentId: docId, amount }] : []),
      ],
    });
  const allocated = payment.allocations.reduce((s, a) => s + a.amount, 0);
  const unapplied = round(payment.amount - allocated, precision);
  const isCredit = payment.method === 'credit_note';
  const selectedCredit = credits.find((c) => c.id === payment.creditId) ?? null;
  const creditAvailable = selectedCredit
    ? round(
        selectedCredit.totals.balance +
          (before?.creditId === selectedCredit.id ? before.amount : 0),
        precision,
      )
    : 0;

  const autoApply = () => {
    let remaining = payment.amount;
    const next: Payment['allocations'] = [];
    for (const { doc, available } of invoices) {
      if (remaining <= 0) break;
      const amount = round(Math.min(available, remaining), precision);
      if (amount > 0) {
        next.push({ documentId: doc.id, amount });
        remaining = round(remaining - amount, precision);
      }
    }
    set({ allocations: next });
  };

  const save = async () => {
    if (!payment.clientId) return toast.error('Choose a client.');
    if (!(payment.amount > 0)) return toast.error('Enter the amount received.');
    if (allocated - payment.amount > 1e-9)
      return toast.error('More is applied to invoices than the payment amount.');
    for (const { doc, available } of invoices) {
      if (allocationFor(doc.id) - available > 1e-9)
        return toast.error(
          `${doc.number} only has ${fmt.money(available, doc.currency)} left to pay.`,
        );
    }
    if (isCredit) {
      if (!selectedCredit) return toast.error('Choose the credit note to apply.');
      if (payment.amount - creditAvailable > 1e-9)
        return toast.error(
          `The credit note only has ${fmt.money(creditAvailable, payment.currency)} available.`,
        );
    }
    setSaving(true);
    try {
      const saved = await savePayment({ ...payment, creditId: isCredit ? payment.creditId : null });
      toast.success(`Payment ${saved.number} saved`);
      allowNavigation();
      navigate(`/payments/${saved.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the payment.');
      setSaving(false);
    }
  };

  const clientOptions = clients
    .filter((c) => !c.archived || c.id === payment.clientId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name, detail: c.number }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        breadcrumb={<Link to="/payments">Payments</Link>}
        title={id ? `Edit payment ${payment.number}` : 'Record a payment'}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save payment
            </Button>
          </>
        }
      />

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" className="sm:col-span-2">
            {(fid) => (
              <Combobox
                id={fid}
                value={payment.clientId || null}
                onChange={(value) => {
                  const client = clients.find((c) => c.id === value);
                  set({
                    clientId: value,
                    allocations: [],
                    creditId: null,
                    currency: client?.currency ?? company.currency,
                  });
                }}
                options={clientOptions}
                placeholder="Who paid?"
                searchPlaceholder="Search clients…"
              />
            )}
          </Field>
          <Field label="Amount received">
            {(fid) => (
              <NumberInput
                id={fid}
                value={payment.amount}
                onValueChange={(amount) => set({ amount })}
                allowNegative={false}
              />
            )}
          </Field>
          <Field label="Currency">
            {(fid) => (
              <CurrencySelect
                id={fid}
                value={payment.currency}
                onChange={(currency) => set({ currency, allocations: [], creditId: null })}
              />
            )}
          </Field>
          <Field label="Date">
            {(fid) => (
              <Input
                id={fid}
                type="date"
                value={payment.date}
                onChange={(e) => set({ date: e.target.value || today() })}
              />
            )}
          </Field>
          <Field label="Method">
            {(fid) => (
              <Select
                id={fid}
                value={payment.method}
                onChange={(e) => set({ method: e.target.value as PaymentMethod, creditId: null })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {!isCredit ? (
            <Field label="Deposit to" hint="The bank or cash account the money went into.">
              {(fid) => (
                <Select
                  id={fid}
                  value={payment.accountId ?? ''}
                  onChange={(e) => set({ accountId: e.target.value || null })}
                >
                  <option value="">
                    {(() => {
                      const role = payment.method === 'cash' ? 'cash' : 'bank';
                      const auto = moneyAccounts?.find((a) => a.role === role);
                      return auto ? `${auto.name} (default)` : 'Default account';
                    })()}
                  </option>
                  {[...(moneyAccounts ?? [])]
                    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} {a.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          ) : null}
          {!isCredit && payment.currency !== company.currency ? (
            <Field
              label="Exchange rate"
              hint={`1 ${payment.currency} = ${payment.exchangeRate || '?'} ${company.currency} on the payment date`}
            >
              {(fid) => (
                <NumberInput
                  id={fid}
                  value={payment.exchangeRate ?? 0}
                  onValueChange={(exchangeRate) => set({ exchangeRate })}
                  allowNegative={false}
                />
              )}
            </Field>
          ) : null}
          {isCredit ? (
            <Field
              label="Credit note"
              className="sm:col-span-2"
              hint={
                selectedCredit
                  ? `${fmt.money(creditAvailable, payment.currency)} available`
                  : undefined
              }
            >
              {(fid) => (
                <Select
                  id={fid}
                  value={payment.creditId ?? ''}
                  onChange={(e) => {
                    const credit = credits.find((c) => c.id === e.target.value);
                    set({
                      creditId: e.target.value || null,
                      reference: credit?.number ?? payment.reference,
                      amount: credit ? credit.totals.balance : payment.amount,
                    });
                  }}
                >
                  <option value="">
                    {credits.length
                      ? 'Choose a credit note…'
                      : 'This client has no open credit notes'}
                  </option>
                  {credits.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.number} · {fmt.money(c.totals.balance, c.currency)} available
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
          <Field label="Reference" optional>
            {(fid) => (
              <Input
                id={fid}
                value={payment.reference}
                onChange={(e) => set({ reference: e.target.value })}
                placeholder="Transaction ID, cheque number…"
              />
            )}
          </Field>
          <Field label="Notes" optional className="sm:col-span-2">
            {(fid) => (
              <Textarea
                id={fid}
                value={payment.notes}
                onChange={(e) => set({ notes: e.target.value })}
                rows={2}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Apply to invoices"
          description="Split the payment across the client's open invoices."
          actions={
            invoices.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={autoApply}
                disabled={!(payment.amount > 0)}
              >
                <Wand2 /> Apply oldest first
              </Button>
            ) : null
          }
        />
        {!payment.clientId ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Choose a client to see their open invoices.
          </p>
        ) : invoices.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No open invoices in {payment.currency}. The payment will be kept as client credit.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3 text-right">Open balance</th>
                  <th className="w-40 px-5 py-3 text-right">Apply</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map(({ doc, available }) => (
                  <tr key={doc.id}>
                    <td className="px-5 py-2.5">
                      <Link
                        to={`/invoices/${doc.id}`}
                        className="hover:text-primary-700 font-medium text-slate-900"
                      >
                        {doc.number}
                      </Link>
                      {doc.status === 'draft' ? (
                        <span className="ml-2 text-xs text-slate-400">(draft)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{fmt.date(doc.dueDate) || '—'}</td>
                    <td className="tabular px-3 py-2.5 text-right text-slate-700">
                      {fmt.money(available, doc.currency)}
                    </td>
                    <td className="px-5 py-2.5">
                      <NumberInput
                        aria-label={`Amount applied to ${doc.number}`}
                        value={allocationFor(doc.id)}
                        onValueChange={(v) => setAllocation(doc.id, v)}
                        allowNegative={false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-slate-100 px-5 py-3 text-sm">
          <span className="text-slate-500">
            Applied{' '}
            <strong className="tabular text-slate-900">
              {fmt.money(allocated, payment.currency)}
            </strong>
          </span>
          <span className={unapplied < 0 ? 'text-red-600' : 'text-slate-500'}>
            Unapplied <strong className="tabular">{fmt.money(unapplied, payment.currency)}</strong>
          </span>
        </div>
      </Card>
    </div>
  );
}
