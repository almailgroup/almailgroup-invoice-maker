import { lazy, Suspense } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import {
  Building2,
  Database,
  FileCog,
  Hash,
  Languages,
  Layers,
  Mail,
  Percent,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader, Spinner } from '@/components/ui/misc';

const CompanySettings = lazy(() => import('./company'));
const DocumentSettings = lazy(() => import('./documents'));
const NumberingSettings = lazy(() => import('./numbering'));
const TaxSettings = lazy(() => import('./taxes'));
const PaymentSettingsPage = lazy(() => import('./payments'));
const EmailSettings = lazy(() => import('./emails'));
const LabelSettings = lazy(() => import('./labels'));
const DataSettings = lazy(() => import('./data'));
const CompaniesSettings = lazy(() => import('./companies'));

const SECTIONS = [
  { path: 'company', label: 'Company profile', icon: <Building2 /> },
  { path: 'documents', label: 'Invoice defaults', icon: <FileCog /> },
  { path: 'numbering', label: 'Numbering', icon: <Hash /> },
  { path: 'taxes', label: 'Taxes', icon: <Percent /> },
  { path: 'payments', label: 'Payment details', icon: <Wallet /> },
  { path: 'emails', label: 'Email templates', icon: <Mail /> },
  { path: 'labels', label: 'Language & wording', icon: <Languages /> },
  { path: 'data', label: 'Backup & data', icon: <Database /> },
  { path: 'companies', label: 'Companies', icon: <Layers /> },
];

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Your company details and how your documents are created." />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => (
              <li key={s.path} className="shrink-0">
                <NavLink
                  to={`/settings/${s.path}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap [&_svg]:size-4',
                      isActive
                        ? 'bg-white text-primary-700 shadow-xs ring-1 ring-slate-200 [&_svg]:text-primary-600'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 [&_svg]:text-slate-400',
                    )
                  }
                >
                  {s.icon}
                  {s.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Suspense fallback={<Spinner className="py-24" label="Loading…" />}>
            <Routes>
              <Route index element={<Navigate to="company" replace />} />
              <Route path="company" element={<CompanySettings />} />
              <Route path="documents" element={<DocumentSettings />} />
              <Route path="numbering" element={<NumberingSettings />} />
              <Route path="taxes" element={<TaxSettings />} />
              <Route path="payments" element={<PaymentSettingsPage />} />
              <Route path="emails" element={<EmailSettings />} />
              <Route path="labels" element={<LabelSettings />} />
              <Route path="data" element={<DataSettings />} />
              <Route path="companies" element={<CompaniesSettings />} />
              <Route path="*" element={<Navigate to="company" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
