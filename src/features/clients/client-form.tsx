import { useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import type { Client, ClientContact, Company } from '@/db/types';
import { emptyAddress, isAddressEmpty } from '@/lib/geo';
import { shortId } from '@/lib/ids';
import { LANGUAGES } from '@/pdf/labels';
import { Button } from '@/components/ui/button';
import { Field, Input, NumberInput, Select, Switch, Textarea } from '@/components/ui/form';
import { AddressFields, CurrencySelect } from '@/components/fields';
import { isCustomer, isVendor } from '@/db/purchases';
import type { ContactKind } from './contact-kind';

export function newContact(primary = false): ClientContact {
  return { id: shortId(), name: '', email: '', phone: '', primary };
}

/** Client or vendor fields. `compact` hides the less common options (quick create). */
export function ClientForm({
  value,
  onChange,
  company,
  compact = false,
  errors = {},
  kind = 'customer',
}: {
  value: Client;
  onChange: (client: Client) => void;
  company: Company;
  compact?: boolean;
  errors?: Partial<Record<'name', string>>;
  kind?: ContactKind;
}) {
  const [showShipping, setShowShipping] = useState(!isAddressEmpty(value.shippingAddress));
  const set = (patch: Partial<Client>) => onChange({ ...value, ...patch });
  const contacts = value.contacts.length ? value.contacts : [newContact(true)];
  const setContact = (index: number, patch: Partial<ClientContact>) =>
    set({ contacts: contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  const customer = isCustomer(value);
  const vendor = isVendor(value);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={kind === 'vendor' ? 'Vendor name' : 'Client name'}
          className="sm:col-span-2"
          error={errors.name}
          hint={
            kind === 'vendor'
              ? 'Company or person you buy from.'
              : 'Company or person you are billing.'
          }
        >
          {(id) => (
            <Input
              id={id}
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
              autoFocus
              aria-invalid={Boolean(errors.name)}
            />
          )}
        </Field>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Contacts</h3>
        {contacts.map((contact, index) => (
          <div
            key={contact.id}
            className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Field label="Name">
              {(id) => (
                <Input
                  id={id}
                  value={contact.name}
                  onChange={(e) => setContact(index, { name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact(index, { email: e.target.value })}
                />
              )}
            </Field>
            <Field label="Phone">
              {(id) => (
                <Input
                  id={id}
                  value={contact.phone}
                  onChange={(e) => setContact(index, { phone: e.target.value })}
                />
              )}
            </Field>
            <div className="flex items-end gap-1 pb-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                title={contact.primary ? 'Primary contact' : 'Make primary'}
                aria-label={contact.primary ? 'Primary contact' : 'Make primary contact'}
                onClick={() =>
                  set({ contacts: contacts.map((c, i) => ({ ...c, primary: i === index })) })
                }
              >
                <Star className={contact.primary ? 'fill-amber-400 text-amber-500' : ''} />
              </Button>
              {contacts.length > 1 ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove contact"
                  onClick={() => set({ contacts: contacts.filter((_, i) => i !== index) })}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => set({ contacts: [...contacts, newContact(false)] })}
        >
          <Plus /> Add contact
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {customer ? 'Billing address' : 'Address'}
        </h3>
        <AddressFields value={value.address} onChange={(address) => set({ address })} />
        {customer ? (
          <Switch
            checked={showShipping}
            onChange={(on) => {
              setShowShipping(on);
              set({
                shippingAddress: on
                  ? (value.shippingAddress ?? emptyAddress(value.address.country))
                  : null,
              });
            }}
            label="Different shipping address"
          />
        ) : null}
        {customer && showShipping && value.shippingAddress ? (
          <AddressFields
            value={value.shippingAddress}
            onChange={(shippingAddress) => set({ shippingAddress })}
          />
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={company.taxIdLabel || 'Tax ID'} optional>
          {(id) => (
            <Input id={id} value={value.taxId} onChange={(e) => set({ taxId: e.target.value })} />
          )}
        </Field>
        <Field label="Phone (main)" optional>
          {(id) => (
            <Input id={id} value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
          )}
        </Field>
        {!compact ? (
          <>
            <Field label="Website" optional>
              {(id) => (
                <Input
                  id={id}
                  value={value.website}
                  onChange={(e) => set({ website: e.target.value })}
                />
              )}
            </Field>
            <Field label="Currency" hint={`Leave as default to use ${company.currency}.`}>
              {(id) => (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CurrencySelect
                      id={id}
                      value={value.currency ?? company.currency}
                      onChange={(currency) =>
                        set({ currency: currency === company.currency ? null : currency })
                      }
                    />
                  </div>
                  {value.currency ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={() => set({ currency: null })}
                    >
                      Default
                    </Button>
                  ) : null}
                </div>
              )}
            </Field>
            <Field
              label="Payment terms (days)"
              hint={`Default: ${company.defaults.paymentTermsDays} days`}
            >
              {(id) => (
                <div className="flex gap-2">
                  <NumberInput
                    id={id}
                    value={value.paymentTermsDays ?? company.defaults.paymentTermsDays}
                    onValueChange={(days) =>
                      set({ paymentTermsDays: Math.max(0, Math.round(days)) })
                    }
                    allowNegative={false}
                  />
                  {value.paymentTermsDays !== null ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={() => set({ paymentTermsDays: null })}
                    >
                      Default
                    </Button>
                  ) : null}
                </div>
              )}
            </Field>
            {customer ? (
              <Field label="Document language">
                {(id) => (
                  <Select
                    id={id}
                    value={value.language ?? ''}
                    onChange={(e) =>
                      set({ language: (e.target.value || null) as Client['language'] })
                    }
                  >
                    <option value="">Company default</option>
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
            <div className="sm:col-span-2">
              <Switch
                checked={value.taxExempt}
                onChange={(taxExempt) => set({ taxExempt })}
                label="Tax exempt"
                description={
                  vendor && !customer
                    ? 'Not registered for tax: their bills never include tax.'
                    : 'Taxes are never applied to their documents.'
                }
              />
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 p-3 sm:col-span-2">
              <Switch
                checked={customer}
                // A contact always keeps at least one role.
                disabled={customer && !vendor}
                onChange={(on) => set({ isCustomer: on })}
                label="Client"
                description="You send them quotes and invoices."
              />
              <Switch
                checked={vendor}
                disabled={vendor && !customer}
                onChange={(on) => set({ isVendor: on })}
                label="Vendor"
                description="You record their bills and pay them."
              />
            </div>
            <Field label="Internal notes" className="sm:col-span-2" hint="Only visible to you.">
              {(id) => (
                <Textarea
                  id={id}
                  value={value.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  rows={3}
                />
              )}
            </Field>
          </>
        ) : null}
      </section>
    </div>
  );
}

export function validateClient(client: Client): Partial<Record<'name', string>> {
  return client.name.trim() ? {} : { name: 'Please enter a name.' };
}
