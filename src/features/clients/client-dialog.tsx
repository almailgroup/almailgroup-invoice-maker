import { useState } from 'react';
import { toast } from 'sonner';
import type { Client, Company } from '@/db/types';
import { createClient } from '@/db/defaults';
import { saveClient } from '@/db/records';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/overlay';
import { ClientForm, newContact, validateClient } from './client-form';
import { CONTACT_COPY, contactRoles, type ContactKind } from './contact-kind';

/** Quick "new client" (or vendor) dialog used from the editors and payments. */
export function ClientDialog({
  open,
  onOpenChange,
  company,
  initialName = '',
  onSaved,
  kind = 'customer',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  initialName?: string;
  onSaved: (client: Client) => void;
  kind?: ContactKind;
}) {
  const copy = CONTACT_COPY[kind];
  const [client, setClient] = useState<Client>(() =>
    createClient(company.id, {
      ...contactRoles(kind),
      name: initialName,
      contacts: [newContact(true)],
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: company.address.country,
      },
    }),
  );
  const [errors, setErrors] = useState<Partial<Record<'name', string>>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const found = validateClient(client);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const saved = await saveClient({
        ...client,
        contacts: client.contacts.filter((c) => c.name || c.email || c.phone),
      });
      toast.success(`${copy.column} ${saved.name} added`);
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not save the ${copy.singular}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`New ${copy.singular}`}
        description={`You can add more details later from the ${copy.title} page.`}
        size="lg"
      >
        <DialogBody>
          <ClientForm
            value={client}
            onChange={setClient}
            company={company}
            compact
            errors={errors}
            kind={kind}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save {copy.singular}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
