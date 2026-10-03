import { NavLink, useNavigate, useParams } from 'react-router';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/misc';
import { Select } from '@/components/ui/form';
import {
  BalanceSheetReport,
  GeneralLedgerReport,
  ProfitAndLossReport,
  TrialBalanceReport,
} from './financial';
import { SalesReports, type SalesReportId } from './sales';

const GROUPS = [
  {
    title: 'Financial statements',
    items: [
      { id: 'profit-and-loss', label: 'Profit and loss' },
      { id: 'balance-sheet', label: 'Balance sheet' },
      { id: 'trial-balance', label: 'Trial balance' },
      { id: 'general-ledger', label: 'General ledger' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { id: 'aging', label: 'Receivables aging' },
      { id: 'tax', label: 'Tax summary' },
      { id: 'sales', label: 'Sales by client' },
      { id: 'payments', label: 'Payments received' },
    ],
  },
];

const SALES: SalesReportId[] = ['aging', 'tax', 'sales', 'payments'];

export default function ReportsPage() {
  const { report = 'profit-and-loss' } = useParams();
  const navigate = useNavigate();
  const known = GROUPS.some((g) => g.items.some((i) => i.id === report));
  const current = known ? report : 'profit-and-loss';

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Financial statements and sales reports, from your own books."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Reports" className="hidden lg:block">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {group.title}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={`/reports/${item.id}`}
                  className={() =>
                    cn(
                      'block rounded-lg px-3 py-1.5 text-sm',
                      current === item.id
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          <div className="mb-4 lg:hidden">
            <Select
              aria-label="Report"
              value={current}
              onChange={(e) => navigate(`/reports/${e.target.value}`)}
            >
              {GROUPS.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
          {current === 'profit-and-loss' ? <ProfitAndLossReport /> : null}
          {current === 'balance-sheet' ? <BalanceSheetReport /> : null}
          {current === 'trial-balance' ? <TrialBalanceReport /> : null}
          {current === 'general-ledger' ? <GeneralLedgerReport /> : null}
          {SALES.includes(current as SalesReportId) ? (
            <SalesReports report={current as SalesReportId} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
