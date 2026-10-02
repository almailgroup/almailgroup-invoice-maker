import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, Mail, MoreHorizontal, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/db/db';
import { deleteClient, saveClient } from '@/db/records';
import { paymentMethodLabel } from '@/db/payments';
import type { DocumentType } from '@/db/types';
import { DOCUMENT_ROUTES, useCompany, useFormat } from '@/app/company';
import { formatAddressLines, isAddressEmpty } from '@/lib/geo';
import { displayStatus } from '@/lib/status';
import { today } from '@/lib/dates';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, Segmented, Spinner, Stat, StatusBadge } from '@/components/ui/misc';
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
  useConfirm,
} from '@/components/ui/overlay';

type Tab = DocumentType | 'payments';

export default function ClientDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const company = useCompany();
  const fmt = useFormat();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('invoice');

  const client = useLiveQuery(() => db.clients.get(id), [id]);
  const docs = useLiveQuery(() => db.documents.where('clientId').equals(id).toArray(), [id]);
  const payments = useLiveQuery(() => db.payments.where('clientId').equals(id).toArray(), [id]);

  const currency = client?.currency ?? company.currency;
  const stats = useMemo(() => {
    if (!docs) return null;
    const now = today();
    const invoices = docs.filter((d) => d.type === 'invoice' && d.status !== 'draft' && d.status !== 'void' && d.currency === currency);
    const credits = docs.filter((d) => d.type === 'credit' && (d.status === 'sent' || d.status === 'partial') && d.currency === currency);
    return {
      invoiced: invoices.reduce((s, d) => s + d.totals.total, 0),
      paid: invoices.reduce((s, d) => s + d.totals.paid, 0),
      outstanding: invoices.filter((d) => d.status === 'sent' || d.status === 'partial').reduce((s, d) => s + d.totals.balance, 0),
      overdue: invoices.filter((d) => displayStatus(d, now) === 'overdue').reduce((s, d) => s + d.totals.balance, 0),
      credit: credits.reduce((s, d) => s + d.totals.balance, 0),
    };
  }, [docs, currency]);

  if (client === undefined || !docs || !payments) return <Spinner className="py-24" label="Loading…" />;
  if (!client || client.companyId !== company.id) {
    return (
      <Card className="p-10 text-center">
        <p className="text-slate-600">This client could not be found.</p>
        <Link to="/clients" className="mt-4 inline-block text-sm font-medium text-primary-700">
          Back to clients
        </Link>
      </Card>
    );
  }

  const now = today();
  const listed = tab === 'payments' ? [] : docs.filter((d) => d.type === tab).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const counts = {
    invoice: docs.filter((d) => d.type === 'invoice').length,
    quote: docs.filter((d) => d.type === 'quote').length,
    credit: docs.filter((d) => d.type === 'credit').length,
    payments: payments.length,
  };

  const toggleArchive = async () => {
    await saveClient({ ...client, archived: !client.archived });
    toast.success(client.archived ? 'Client restored' : 'Client archived');
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${client.name}?`,
      description: 'This cannot be undone. Clients with documents or payments can only be archived.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteClient(client.id);
      toast.success('Client deleted');
      navigate('/clients');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the client.');
    }
  };

  const address = formatAddressLines(client.address, fmt.locale);
  const shipping = client.shippingAddress && !isAddressEmpty(client.shippingAddress) ? formatAddressLines(client.shippingAddress, fmt.locale) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-sm text-slate-500">
            <Link to="/clients" className="hover:text-slate-700">
              Clients
            </Link>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{client.name}</h1>
            {client.archived ? <Badge tone="slate">Archived</Badge> : null}
            {client.taxExempt ? <Badge tone="amber">Tax exempt</Badge> : null}
            {client.currency ? <Badge tone="blue">{client.currency}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">{client.number}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/quotes/new?client=${client.id}`} variant="outline">
            New quote
          </ButtonLink>
          <ButtonLink to={`/invoices/new?client=${client.id}`}>
            <Plus /> New invoice
          </ButtonLink>
          <Button variant="outline" onClick={() => navigate(`/clients/${client.id}/edit`)}>
            <Pencil /> Edit
          </Button>
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem icon={<Plus />} onSelect={() => navigate(`/credits/new?client=${client.id}`)}>
                New credit note
              </DropdownItem>
              <DropdownItem icon={<Plus />} onSelect={() => navigate(`/payments/new?client=${client.id}`)}>
                Record payment
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={client.archived ? <ArchiveRestore /> : <Archive />} onSelect={() => void toggleArchive()}>
                {client.archived ? 'Restore' : 'Archive'}
              </DropdownItem>
              <DropdownItem icon={<Trash2 />} danger onSelect={() => void remove()}>
                Delete
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>
        </div>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Invoiced" value={fmt.money(stats.invoiced, currency)} />
          <Stat label="Paid" value={fmt.money(stats.paid, currency)} tone={stats.paid > 0 ? 'success' : 'default'} />
          <Stat label="Outstanding" value={fmt.money(stats.outstanding, currency)} />
          <Stat
            label="Overdue"
            value={fmt.money(stats.overdue, currency)}
            tone={stats.overdue > 0 ? 'danger' : 'default'}
            hint={stats.credit > 0 ? `${fmt.money(stats.credit, currency)} unused credit` : undefined}
          />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="border-b border-slate-100 p-4">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'invoice', label: 'Invoices', count: counts.invoice },
                { value: 'quote', label: 'Quotes', count: counts.quote },
                { value: 'credit', label: 'Credit notes', count: counts.credit },
                { value: 'payments', label: 'Payments', count: counts.payments },
              ]}
            />
          </div>
          {tab === 'payments' ? (
            payments.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...payments]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((p) => (
                    <li key={p.id}>
                      <Link to={`/payments/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                        <span>
                          <span className="block text-sm font-medium text-slate-800">
                            {p.number} · {fmt.date(p.date)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {paymentMethodLabel(p.method)}
                            {p.reference ? ` · ${p.reference}` : ''}
                          </span>
                        </span>
                        <span className="tabular text-sm font-semibold text-emerald-700">{fmt.money(p.amount, p.currency)}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )
          ) : listed.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Nothing here yet.{' '}
              <Link to={`${DOCUMENT_ROUTES[tab]}/new?client=${client.id}`} className="font-medium text-primary-700">
                Create one
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {listed.map((d) => (
                <li key={d.id}>
                  <Link to={`${DOCUMENT_ROUTES[d.type]}/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{d.number}</span>
                      <span className="text-xs text-slate-500">
                        {fmt.date(d.issueDate)}
                        {d.dueDate ? ` · due ${fmt.date(d.dueDate)}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tabular text-sm font-semibold text-slate-900">{fmt.money(d.totals.total, d.currency)}</span>
                      <StatusBadge status={displayStatus(d, now)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Details" />
          <CardBody className="space-y-5 text-sm">
            {client.contacts.length > 0 ? (
              <div className="space-y-3">
                {client.contacts.map((c) => (
                  <div key={c.id}>
                    <p className="font-medium text-slate-800">
                      {c.name || 'Contact'}
                      {c.primary && client.contacts.length > 1 ? <span className="ml-2 text-xs font-normal text-slate-400">Primary</span> : null}
                    </p>
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-primary-700 hover:underline">
                        <Mail className="size-3.5" /> {c.email}
                      </a>
                    ) : null}
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-slate-600">
                        <Phone className="size-3.5" /> {c.phone}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {address.length ? (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Billing address</p>
                <p className="whitespace-pre-line text-slate-700">{address.join('\n')}</p>
              </div>
            ) : null}
            {shipping.length ? (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Shipping address</p>
                <p className="whitespace-pre-line text-slate-700">{shipping.join('\n')}</p>
              </div>
            ) : null}
            {client.taxId ? (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{company.taxIdLabel || 'Tax ID'}</p>
                <p className="text-slate-700">{client.taxId}</p>
              </div>
            ) : null}
            {client.paymentTermsDays !== null ? (
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Payment terms</p>
                <p className="text-slate-700">{client.paymentTermsDays} days</p>
              </div>
            ) : null}
            {client.notes ? (
              <p className="rounded-md bg-amber-50 p-3 text-xs whitespace-pre-line text-amber-900">{client.notes}</p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
