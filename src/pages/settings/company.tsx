import { Field, Input } from '@/components/ui/form';
import { AddressFields, LogoUpload } from '@/components/fields';
import { SaveBar, SettingsSection, useCompanyDraft } from './shared';

export default function CompanySettings() {
  const { draft, update, dirty, saving, save, reset } = useCompanyDraft();

  return (
    <div className="space-y-6">
      <SettingsSection title="Company profile" description="Printed at the top of every document.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" hint="Used in the app and in emails.">
            {(id) => (
              <Input
                id={id}
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Legal name"
            optional
            hint="Printed on documents when set, e.g. “AL Mail Group Ltd”."
          >
            {(id) => (
              <Input
                id={id}
                value={draft.legalName}
                onChange={(e) => update({ legalName: e.target.value })}
              />
            )}
          </Field>
          <Field label="Email">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={draft.email}
                onChange={(e) => update({ email: e.target.value })}
              />
            )}
          </Field>
          <Field label="Phone">
            {(id) => (
              <Input
                id={id}
                value={draft.phone}
                onChange={(e) => update({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field label="Website" optional className="sm:col-span-2">
            {(id) => (
              <Input
                id={id}
                value={draft.website}
                onChange={(e) => update({ website: e.target.value })}
                placeholder="https://"
              />
            )}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Logo">
        <LogoUpload
          value={draft.branding.logo}
          onChange={(logo) => update({ branding: { ...draft.branding, logo } })}
        />
      </SettingsSection>

      <SettingsSection title="Address">
        <AddressFields value={draft.address} onChange={(address) => update({ address })} />
      </SettingsSection>

      <SettingsSection
        title="Registration"
        description="Tax and company registration numbers printed on documents."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax number label" hint="e.g. VAT No., TRN, EIN, GSTIN">
            {(id) => (
              <Input
                id={id}
                value={draft.taxIdLabel}
                onChange={(e) => update({ taxIdLabel: e.target.value })}
              />
            )}
          </Field>
          <Field label="Tax number" optional>
            {(id) => (
              <Input
                id={id}
                value={draft.taxId}
                onChange={(e) => update({ taxId: e.target.value })}
              />
            )}
          </Field>
          <Field label="Registration label" hint="e.g. Company No., CR, Trade licence">
            {(id) => (
              <Input
                id={id}
                value={draft.registrationLabel}
                onChange={(e) => update({ registrationLabel: e.target.value })}
              />
            )}
          </Field>
          <Field label="Registration number" optional>
            {(id) => (
              <Input
                id={id}
                value={draft.registrationNumber}
                onChange={(e) => update({ registrationNumber: e.target.value })}
              />
            )}
          </Field>
        </div>
      </SettingsSection>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
