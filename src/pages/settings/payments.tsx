import type { PaymentSettings } from '@/db/types';
import { Field, Input, Switch, Textarea } from '@/components/ui/form';
import { SaveBar, SettingsSection, useCompanyDraft } from './shared';

export default function PaymentSettingsPage() {
  const { draft, update, dirty, saving, save, reset } = useCompanyDraft();
  const p = draft.payment;
  const set = (patch: Partial<PaymentSettings>) => update({ payment: { ...p, ...patch } });
  const linkInvalid =
    p.paymentLink.trim() !== '' && !/^https?:\/\/\S+$/i.test(p.paymentLink.trim());

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Payment details"
        description="Printed on invoices while a balance is due."
      >
        <Field
          label="Bank details"
          hint="Bank name, account name, account number / IBAN, SWIFT/BIC, sort code…"
        >
          {(id) => (
            <Textarea
              id={id}
              value={p.bankDetails}
              onChange={(e) => set({ bankDetails: e.target.value })}
              rows={4}
              placeholder={'Bank: …\nAccount name: …\nIBAN: …  ·  SWIFT: …'}
            />
          )}
        </Field>
        <Field label="Payment instructions" optional>
          {(id) => (
            <Input
              id={id}
              value={p.instructions}
              onChange={(e) => set({ instructions: e.target.value })}
              placeholder="Please use the invoice number as the payment reference."
            />
          )}
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Online payment link"
        description="A link where clients can pay by card, e.g. a Stripe Payment Link, PayPal.me or your bank's pay page."
      >
        <Field
          label="Payment link"
          optional
          error={linkInvalid ? 'Enter a full link starting with https://' : undefined}
        >
          {(id) => (
            <Input
              id={id}
              value={p.paymentLink}
              onChange={(e) => set({ paymentLink: e.target.value })}
              placeholder="https://buy.stripe.com/…"
              aria-invalid={linkInvalid}
            />
          )}
        </Field>
        <Switch
          checked={p.showQrCode}
          onChange={(showQrCode) => set({ showQrCode })}
          label="Print a QR code"
          description="Clients can scan it with their phone to open the payment link."
        />
      </SettingsSection>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
