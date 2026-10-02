import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  BarChart3,
  Building2,
  ChevronsUpDown,
  CreditCard,
  FileMinus,
  FileText,
  LayoutDashboard,
  Menu as MenuIcon,
  Package,
  Palette,
  Plus,
  Repeat,
  ScrollText,
  Settings,
  Users,
  X,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCompanyContext } from './company';
import { Button } from '@/components/ui/button';
import {
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/overlay';
import { Spinner } from '@/components/ui/misc';
import { toast } from 'sonner';
import { generateDueInvoices } from '@/db/recurring';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const NAV: { title?: string; items: NavItem[] }[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: <LayoutDashboard />, end: true }] },
  {
    title: 'Sales',
    items: [
      { to: '/invoices', label: 'Invoices', icon: <FileText /> },
      { to: '/quotes', label: 'Quotes', icon: <ScrollText /> },
      { to: '/credits', label: 'Credit notes', icon: <FileMinus /> },
      { to: '/recurring', label: 'Recurring', icon: <Repeat /> },
      { to: '/payments', label: 'Payments', icon: <CreditCard /> },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { to: '/clients', label: 'Clients', icon: <Users /> },
      { to: '/products', label: 'Products & services', icon: <Package /> },
    ],
  },
  {
    title: 'Business',
    items: [
      { to: '/reports', label: 'Reports', icon: <BarChart3 /> },
      { to: '/templates', label: 'Templates', icon: <Palette /> },
      { to: '/settings', label: 'Settings', icon: <Settings /> },
    ],
  },
];

function CompanyLogo({
  name,
  logo,
  className,
}: {
  name: string;
  logo: string | null;
  className?: string;
}) {
  if (logo) {
    return (
      <span
        className={cn(
          'flex size-8 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-slate-200',
          className,
        )}
      >
        <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cn(
        'bg-primary-600 flex size-8 items-center justify-center rounded-md text-xs font-semibold text-white',
        className,
      )}
    >
      {initials || <Building2 className="size-4" />}
    </span>
  );
}

function CompanySwitcher() {
  const { company, companies, switchCompany } = useCompanyContext();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-100"
          aria-label="Switch company"
        >
          <CompanyLogo name={company.name} logo={company.branding.logo} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {company.name}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {company.currency} · Invoice Maker
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-64">
        <DropdownLabel>Companies</DropdownLabel>
        {companies.map((c) => (
          <DropdownItem
            key={c.id}
            onSelect={() => {
              void switchCompany(c.id);
              navigate('/');
            }}
            icon={c.id === company.id ? <Check /> : <span className="inline-block size-4" />}
          >
            <span className="truncate">{c.name}</span>
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem icon={<Plus />} onSelect={() => navigate('/setup')}>
          Add company
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <CompanySwitcher />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.title ? (
              <p className="px-2 pb-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors [&_svg]:size-4.5',
                        isActive
                          ? 'bg-primary-50 text-primary-700 [&_svg]:text-primary-600'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 [&_svg]:text-slate-400',
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-400">
        Data is stored in this browser.{' '}
        <Link
          to="/settings/data"
          onClick={onNavigate}
          className="font-medium text-slate-500 underline-offset-2 hover:underline"
        >
          Back up
        </Link>
      </div>
    </div>
  );
}

function NewMenu() {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <Button size="sm">
          <Plus /> New
        </Button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem icon={<FileText />} onSelect={() => navigate('/invoices/new')}>
          Invoice
        </DropdownItem>
        <DropdownItem icon={<ScrollText />} onSelect={() => navigate('/quotes/new')}>
          Quote
        </DropdownItem>
        <DropdownItem icon={<FileMinus />} onSelect={() => navigate('/credits/new')}>
          Credit note
        </DropdownItem>
        <DropdownItem icon={<Repeat />} onSelect={() => navigate('/recurring/new')}>
          Recurring invoice
        </DropdownItem>
        <DropdownItem icon={<CreditCard />} onSelect={() => navigate('/payments/new')}>
          Payment
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem icon={<Users />} onSelect={() => navigate('/clients/new')}>
          Client
        </DropdownItem>
        <DropdownItem icon={<Package />} onSelect={() => navigate('/products?new=1')}>
          Product or service
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}

// Recurring invoices are generated client-side, once per company per visit.
const recurringChecked = new Set<string>();

function useRecurringGeneration() {
  const { company } = useCompanyContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (recurringChecked.has(company.id)) return;
    recurringChecked.add(company.id);
    void generateDueInvoices(company.id)
      .then((created) => {
        if (created.length === 0) return;
        toast.success(
          `${created.length} recurring invoice${created.length === 1 ? '' : 's'} created`,
          { action: { label: 'View', onClick: () => navigate('/invoices') } },
        );
      })
      .catch(() => {
        recurringChecked.delete(company.id);
      });
  }, [company.id, navigate]);
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  useRecurringGeneration();
  const location = useLocation();
  // Full-width pages (the document editor) manage their own layout.
  const wide =
    /\/(new|edit)$/.test(location.pathname) ||
    /^\/(invoices|quotes|credits)\/[^/]+$/.test(location.pathname);

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Main navigation
            </DialogPrimitive.Description>
            <DialogPrimitive.Close className="absolute top-3 -right-11 rounded-md bg-white p-1.5 text-slate-500">
              <X className="size-5" />
              <span className="sr-only">Close menu</span>
            </DialogPrimitive.Close>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </Button>
          <div className="flex-1" />
          <NewMenu />
        </header>
        <main
          className={cn('mx-auto px-4 py-6 sm:px-6 lg:py-8', wide ? 'max-w-[1600px]' : 'max-w-7xl')}
        >
          <Suspense fallback={<Spinner className="py-24" label="Loading…" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export { CompanyLogo };
