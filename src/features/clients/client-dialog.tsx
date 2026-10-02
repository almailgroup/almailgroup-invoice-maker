import { useState } from 'react';
import { toast } from 'sonner';
import type { Client, Company } from '@/db/types';
import { createClient } from '@/db/defaults';
import { saveClient } from '@/db/records';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/overlay';
import { ClientForm, newContact, validateClient } from './client-form';

/** Quick "new client" dialog used from the document editor and payments. */
export function ClientDialog({
  open,
  onOpenChange,
  company,
  initialName = '',
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  initialName?: string;
  onSaved: (client: Client) => void;
}) {
  const [client, setClient] = useState<Client>(() =>
    createClient(company.id, {
      name: initialName,
      contacts: [newContact(true)],
      address: { line1: '', line2: '', city: '', state: '', postalCode: '', country: company.address.country },
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
      toast.success(`Client ${saved.name} added`);
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the client.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New client" description="You can add more details later from the Clients page." size="lg">
        <DialogBody>
          <ClientForm value={client} onChange={setClient} company={company} compact errors={errors} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
