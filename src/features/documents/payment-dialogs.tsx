import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { db } from '@/db/db';
import type { Company, InvoiceDocument, PaymentMethod } from '@/db/types';
import { createPayment, PAYMENT_METHODS, savePayment } from '@/db/payments';
import { today } from '@/lib/dates';
import { formatDate, formatMoney } from '@/lib/format';
import { round, currencyPrecision } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Field, Input, NumberInput, Select, Textarea } from '@/components/ui/form';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/overlay';
import { MoneyAccountSelect, useAccounts } from '@/features/accounting/account-pickers';

/** Records a payment against one invoice (money in) or bill (money out). */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  company,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDocument;
  company: Company;
}) {
  const [amount, setAmount] = useState(Math.max(0, invoice.totals.balance));
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const accounts = useAccounts();
  const out = invoice.type === 'bill';
  const money = (n: number) => formatMoney(n, invoice.currency, company.locale);
  const overpaid = amount > invoice.totals.balance + 1e-9;

  const save = async () => {
    if (amount <= 0) {
      toast.error(out ? 'Enter the amount paid.' : 'Enter the amount received.');
      return;
    }
    setSaving(true);
    try {
      const applied = Math.min(amount, Math.max(0, invoice.totals.balance));
      await savePayment(
        createPayment(company.id, {
          direction: out ? 'out' : 'in',
          clientId: invoice.clientId,
          accountId,
          date,
          amount,
          currency: invoice.currency,
          // Same rate as the invoice unless the user records it differently later.
          exchangeRate: invoice.exchangeRate,
          method,
          reference: reference.trim(),
          notes: notes.trim(),
          allocations:
            applied > 0
              ? [
                  {
                    documentId: invoice.id,
                    amount: round(applied, currencyPrecision(invoice.currency)),
                  },
                ]
              : [],
        }),
      );
      toast.success(`Payment of ${money(amount)} recorded`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Record payment"
        description={`${invoice.number} · balance ${money(invoice.totals.balance)}`}
      >
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`Amount (${invoice.currency})`}
              hint={
                overpaid
                  ? `The extra ${money(amount - invoice.totals.balance)} stays as ${out ? 'an advance to the vendor' : 'client credit'}.`
                  : undefined
              }
            >
              {(id) => (
                <NumberInput
                  id={id}
                  value={amount}
                  onValueChange={setAmount}
                  allowNegative={false}
                  autoFocus
                />
              )}
            </Field>
            <Field label="Date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || today())}
                />
              )}
            </Field>
            <Field label="Method">
              {(id) => (
                <Select
                  id={id}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.filter((m) => m.value !== 'credit_note').map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={out ? 'Paid from' : 'Deposit to'}>
              {(id) => (
                <MoneyAccountSelect
                  id={id}
                  value={accountId}
                  onChange={setAccountId}
                  accounts={accounts ?? []}
                  use={out ? 'payment' : 'deposit'}
                  defaultRole={method === 'cash' ? 'cash' : 'bank'}
                />
              )}
            </Field>
            <Field label="Reference" optional>
              {(id) => (
                <Input
                  id={id}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Transaction ID, cheque no."
                />
              )}
            </Field>
          </div>
          <Field label="Notes" optional>
            {(id) => (
              <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            )}
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Applies a credit note to an open invoice, or a vendor credit to an open bill. */
export function ApplyCreditDialog({
  open,
  onOpenChange,
  credit,
  company,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: InvoiceDocument;
  company: Company;
}) {
  const out = credit.type === 'vendor_credit';
  const target = out ? 'bill' : 'invoice';
  const invoices = useLiveQuery(
    () =>
      db.documents
        .where('clientId')
        .equals(credit.clientId)
        .filter(
          (d) =>
            d.type === target &&
            (d.status === 'sent' || d.status === 'partial') &&
            d.totals.balance > 0 &&
            d.currency === credit.currency,
        )
        .toArray(),
    [credit.clientId, credit.currency, target],
  );
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const money = (n: number) => formatMoney(n, credit.currency, company.locale);
  const selected = useMemo(
    () => invoices?.find((i) => i.id === invoiceId) ?? null,
    [invoices, invoiceId],
  );
  const max = selected
    ? Math.min(credit.totals.balance, selected.totals.balance)
    : credit.totals.balance;

  const save = async () => {
    if (!selected || amount <= 0) {
      toast.error(`Choose ${out ? 'a bill' : 'an invoice'} and an amount.`);
      return;
    }
    setSaving(true);
    try {
      const value = Math.min(amount, max);
      await savePayment(
        createPayment(company.id, {
          direction: out ? 'out' : 'in',
          clientId: credit.clientId,
          date: today(),
          amount: value,
          currency: credit.currency,
          method: 'credit_note',
          creditId: credit.id,
          reference: credit.number,
          allocations: [{ documentId: selected.id, amount: value }],
        }),
      );
      toast.success(`${money(value)} applied to ${selected.number}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply the credit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={out ? 'Apply vendor credit' : 'Apply credit note'}
        description={`${credit.number} · ${money(credit.totals.balance)} available`}
      >
        <DialogBody>
          {invoices && invoices.length === 0 ? (
            <p className="text-sm text-slate-600">
              {out
                ? `This vendor has no open bills in ${credit.currency}.`
                : `This client has no open invoices in ${credit.currency}.`}
            </p>
          ) : (
            <>
              <Field label={out ? 'Bill' : 'Invoice'}>
                {(id) => (
                  <Select
                    id={id}
                    value={invoiceId}
                    onChange={(e) => {
                      setInvoiceId(e.target.value);
                      const inv = invoices?.find((i) => i.id === e.target.value);
                      if (inv) setAmount(Math.min(credit.totals.balance, inv.totals.balance));
                    }}
                  >
                    <option value="">{out ? 'Choose a bill…' : 'Choose an invoice…'}</option>
                    {invoices?.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.number} ·{' '}
                        {formatDate(inv.issueDate, company.dateFormat, company.locale)} · balance{' '}
                        {money(inv.totals.balance)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Amount to apply" hint={`Up to ${money(max)}`}>
                {(id) => (
                  <NumberInput
                    id={id}
                    value={amount}
                    onValueChange={setAmount}
                    allowNegative={false}
                  />
                )}
              </Field>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!selected}>
            Apply credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
