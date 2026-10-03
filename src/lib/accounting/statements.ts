import type { Account, AccountType, ID, ISODate } from '@/db/types';
import { addDaysISO, parseISODate, toISODate } from '@/lib/dates';
import { isProfitAndLoss } from './account-types';
import type { LedgerLine } from './ledger';

export interface FiscalYearEnd {
  month: number;
  day: number;
}

/** Last day of the financial year that ends in `year` (Feb 29 clamps to Feb 28). */
function yearEndIn(year: number, end: FiscalYearEnd): ISODate {
  const lastDay = new Date(year, end.month, 0).getDate();
  return toISODate(new Date(year, end.month - 1, Math.min(end.day, lastDay)));
}

/** First day of the financial year containing `date`. */
export function fiscalYearStart(date: ISODate, end: FiscalYearEnd): ISODate {
  const year = parseISODate(date).getFullYear();
  const endThisYear = yearEndIn(year, end);
  return date <= endThisYear ? addDaysISO(yearEndIn(year - 1, end), 1) : addDaysISO(endThisYear, 1);
}

/** Last day of the financial year containing `date`. */
export function fiscalYearEnd(date: ISODate, end: FiscalYearEnd): ISODate {
  const year = parseISODate(date).getFullYear();
  const endThisYear = yearEndIn(year, end);
  return date <= endThisYear ? endThisYear : yearEndIn(year + 1, end);
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/** Sum of line amounts per account, for lines matching `include`. */
function balances(lines: LedgerLine[], include: (l: LedgerLine) => boolean): Map<ID, number> {
  const out = new Map<ID, number>();
  for (const l of lines) {
    if (!include(l)) continue;
    out.set(l.accountId, (out.get(l.accountId) ?? 0) + l.amount);
  }
  return out;
}

export interface AccountAmount {
  account: Account;
  /** Minor units, signed so the section's normal side is positive. */
  amount: number;
}

export interface StatementSection {
  key: string;
  label: string;
  rows: AccountAmount[];
  total: number;
}

function section(
  key: string,
  label: string,
  accounts: Account[],
  types: AccountType[],
  amounts: Map<ID, number>,
  sign: 1 | -1,
): StatementSection {
  const rows = accounts
    .filter((a) => types.includes(a.type))
    .map((account) => ({ account, amount: sign * (amounts.get(account.id) ?? 0) }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code, undefined, { numeric: true }));
  return { key, label, rows, total: rows.reduce((acc, r) => acc + r.amount, 0) };
}

/* -------------------------------------------------------------------------- */
/* Profit and loss                                                            */
/* -------------------------------------------------------------------------- */

export interface ProfitAndLoss {
  income: StatementSection;
  costOfSales: StatementSection;
  grossProfit: number;
  otherIncome: StatementSection;
  expenses: StatementSection;
  depreciation: StatementSection;
  otherExpenses: StatementSection;
  netProfit: number;
}

export function profitAndLoss(
  lines: LedgerLine[],
  accounts: Account[],
  range: DateRange,
): ProfitAndLoss {
  const amounts = balances(lines, (l) => l.date >= range.from && l.date <= range.to);
  const income = section('income', 'Income', accounts, ['income'], amounts, -1);
  const costOfSales = section(
    'cost',
    'Cost of sales',
    accounts,
    ['expense_direct_cost'],
    amounts,
    1,
  );
  const otherIncome = section(
    'other-income',
    'Other income',
    accounts,
    ['income_other'],
    amounts,
    -1,
  );
  const expenses = section('expenses', 'Expenses', accounts, ['expense'], amounts, 1);
  const depreciation = section(
    'depreciation',
    'Depreciation',
    accounts,
    ['expense_depreciation'],
    amounts,
    1,
  );
  const otherExpenses = section(
    'other-expenses',
    'Other expenses',
    accounts,
    ['expense_other'],
    amounts,
    1,
  );
  const grossProfit = income.total - costOfSales.total;
  return {
    income,
    costOfSales,
    grossProfit,
    otherIncome,
    expenses,
    depreciation,
    otherExpenses,
    netProfit:
      grossProfit + otherIncome.total - expenses.total - depreciation.total - otherExpenses.total,
  };
}

/** Net profit (minor units) of the lines in a date range. */
function profitBetween(
  lines: LedgerLine[],
  types: Map<ID, AccountType>,
  from: ISODate | null,
  to: ISODate,
): number {
  let sum = 0;
  for (const l of lines) {
    const type = types.get(l.accountId);
    if (!type || !isProfitAndLoss(type)) continue;
    if ((from === null || l.date >= from) && l.date <= to) sum += l.amount;
  }
  return -sum;
}

/* -------------------------------------------------------------------------- */
/* Balance sheet                                                              */
/* -------------------------------------------------------------------------- */

export interface BalanceSheet {
  asOf: ISODate;
  assets: StatementSection[];
  totalAssets: number;
  liabilities: StatementSection[];
  totalLiabilities: number;
  equity: StatementSection;
  /** Profit of the current financial year up to `asOf`. */
  currentYearEarnings: number;
  /** Profit of earlier years not moved to retained earnings by a journal. */
  previousYearsEarnings: number;
  totalEquity: number;
  /** Assets minus liabilities and equity; 0 when the books balance. */
  difference: number;
}

export function balanceSheet(
  lines: LedgerLine[],
  accounts: Account[],
  asOf: ISODate,
  yearEnd: FiscalYearEnd,
): BalanceSheet {
  const amounts = balances(lines, (l) => l.date <= asOf);
  const types = new Map(accounts.map((a) => [a.id, a.type]));
  const fyStart = fiscalYearStart(asOf, yearEnd);

  const assets = [
    section('cash', 'Bank and cash', accounts, ['asset_cash'], amounts, 1),
    section('receivable', 'Accounts receivable', accounts, ['asset_receivable'], amounts, 1),
    section(
      'current',
      'Other current assets',
      accounts,
      ['asset_current', 'asset_prepayments'],
      amounts,
      1,
    ),
    section('fixed', 'Fixed assets', accounts, ['asset_fixed'], amounts, 1),
    section('non-current', 'Non-current assets', accounts, ['asset_non_current'], amounts, 1),
  ];
  const liabilities = [
    section('payable', 'Accounts payable', accounts, ['liability_payable'], amounts, -1),
    section(
      'current-liabilities',
      'Current liabilities',
      accounts,
      ['liability_credit_card', 'liability_current'],
      amounts,
      -1,
    ),
    section(
      'non-current-liabilities',
      'Non-current liabilities',
      accounts,
      ['liability_non_current'],
      amounts,
      -1,
    ),
  ];
  const equity = section('equity', 'Equity', accounts, ['equity'], amounts, -1);
  const currentYearEarnings = profitBetween(lines, types, fyStart, asOf);
  const previousYearsEarnings = profitBetween(lines, types, null, addDaysISO(fyStart, -1));

  const totalAssets = assets.reduce((acc, s) => acc + s.total, 0);
  const totalLiabilities = liabilities.reduce((acc, s) => acc + s.total, 0);
  const totalEquity = equity.total + currentYearEarnings + previousYearsEarnings;
  return {
    asOf,
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    currentYearEarnings,
    previousYearsEarnings,
    totalEquity,
    difference: totalAssets - totalLiabilities - totalEquity,
  };
}

/* -------------------------------------------------------------------------- */
/* Trial balance                                                              */
/* -------------------------------------------------------------------------- */

export interface TrialBalanceRow {
  account: Account | null;
  /** Shown instead of an account for the synthetic earlier-years line. */
  label: string;
  debit: number;
  credit: number;
}

/**
 * Balances as of a date: balance-sheet accounts from the beginning, income
 * and expenses from the start of the financial year. Earlier years' profit is
 * shown on its own line so debits equal credits.
 */
export function trialBalance(
  lines: LedgerLine[],
  accounts: Account[],
  asOf: ISODate,
  yearEnd: FiscalYearEnd,
): { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number } {
  const fyStart = fiscalYearStart(asOf, yearEnd);
  const types = new Map(accounts.map((a) => [a.id, a.type]));
  const amounts = balances(lines, (l) => {
    if (l.date > asOf) return false;
    const type = types.get(l.accountId);
    return type && isProfitAndLoss(type) ? l.date >= fyStart : true;
  });
  const rows: TrialBalanceRow[] = accounts
    .map((account) => {
      const amount = amounts.get(account.id) ?? 0;
      return {
        account,
        label: account.name,
        debit: Math.max(amount, 0),
        credit: Math.max(-amount, 0),
      };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0)
    .sort((a, b) => a.account!.code.localeCompare(b.account!.code, undefined, { numeric: true }));
  const earlier = profitBetween(lines, types, null, addDaysISO(fyStart, -1));
  if (earlier !== 0) {
    rows.push({
      account: null,
      label: "Previous years' earnings",
      debit: Math.max(-earlier, 0),
      credit: Math.max(earlier, 0),
    });
  }
  return {
    rows,
    totalDebit: rows.reduce((acc, r) => acc + r.debit, 0),
    totalCredit: rows.reduce((acc, r) => acc + r.credit, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* General ledger                                                             */
/* -------------------------------------------------------------------------- */

export interface LedgerAccountActivity {
  account: Account;
  opening: number;
  lines: (LedgerLine & { balance: number })[];
  debit: number;
  credit: number;
  closing: number;
}

/** Every account's movements in a range, with opening and running balances. */
export function generalLedger(
  lines: LedgerLine[],
  accounts: Account[],
  range: DateRange,
  yearEnd: FiscalYearEnd,
  accountId?: ID,
): LedgerAccountActivity[] {
  const fyStart = fiscalYearStart(range.from, yearEnd);
  return accounts
    .filter((a) => !accountId || a.id === accountId)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((account) => {
      const pl = isProfitAndLoss(account.type);
      const own = lines.filter((l) => l.accountId === account.id);
      const opening = own
        .filter((l) => l.date < range.from && (!pl || l.date >= fyStart))
        .reduce((acc, l) => acc + l.amount, 0);
      let running = opening;
      let debit = 0;
      let credit = 0;
      const inRange = own
        .filter((l) => l.date >= range.from && l.date <= range.to)
        .map((l) => {
          running += l.amount;
          if (l.amount > 0) debit += l.amount;
          else credit -= l.amount;
          return { ...l, balance: running };
        });
      return { account, opening, lines: inRange, debit, credit, closing: running };
    })
    .filter((a) => a.opening !== 0 || a.lines.length > 0);
}
