import { useNavigate } from 'react-router';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteCompany } from '@/db/records';
import { useCompanyContext } from '@/app/company';
import { CompanyLogo } from '@/app/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/overlay';
import { SettingsSection } from './shared';

export default function CompaniesSettings() {
  const { company, companies, switchCompany } = useCompanyContext();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const remove = async (id: string, name: string) => {
    const ok = await confirm({
      title: `Delete ${name}?`,
      description:
        'All of its clients, products, invoices, quotes, payments and settings are permanently deleted from this browser. Download a backup first if you may need them.',
      confirmLabel: 'Delete company',
      danger: true,
    });
    if (!ok) return;
    await deleteCompany(id);
    toast.success(`${name} deleted`);
    navigate('/');
  };

  return (
    <SettingsSection
      title="Companies"
      description="Run several businesses or brands — each with its own clients, numbering and branding."
      actions={
        <Button size="sm" onClick={() => navigate('/setup')}>
          <Plus /> Add company
        </Button>
      }
    >
      <ul className="divide-y divide-slate-100">
        {companies.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-3">
            <CompanyLogo name={c.name} logo={c.branding.logo} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">
                {c.name} {c.id === company.id ? <Badge tone="blue">Current</Badge> : null}
              </p>
              <p className="text-xs text-slate-500">
                {c.currency} · {c.address.country || 'No country set'}
              </p>
            </div>
            {c.id !== company.id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await switchCompany(c.id);
                  navigate('/');
                }}
              >
                Switch
              </Button>
            ) : null}
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} onClick={() => void remove(c.id, c.name)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
