import type { AccountType } from '@/db/types';

export type AccountGroup = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface AccountTypeInfo {
  label: string;
  group: AccountGroup;
  /** Shown under the type when picking it. */
  hint: string;
}

/** Ordered as they appear in the chart of accounts and the statements. */
export const ACCOUNT_TYPES: Record<AccountType, AccountTypeInfo> = {
  asset_cash: { label: 'Bank & cash', group: 'asset', hint: 'Bank accounts, cash on hand' },
  asset_receivable: {
    label: 'Accounts receivable',
    group: 'asset',
    hint: 'Money customers owe you',
  },
  asset_current: {
    label: 'Other current asset',
    group: 'asset',
    hint: 'Stock, deposits, VAT to reclaim',
  },
  asset_prepayments: { label: 'Prepayment', group: 'asset', hint: 'Costs paid in advance' },
  asset_fixed: { label: 'Fixed asset', group: 'asset', hint: 'Equipment, vehicles, property' },
  asset_non_current: {
    label: 'Non-current asset',
    group: 'asset',
    hint: 'Long-term investments and other assets',
  },
  liability_payable: {
    label: 'Accounts payable',
    group: 'liability',
    hint: 'Money you owe suppliers',
  },
  liability_credit_card: { label: 'Credit card', group: 'liability', hint: 'Company cards' },
  liability_current: {
    label: 'Current liability',
    group: 'liability',
    hint: 'VAT due, wages payable, accruals',
  },
  liability_non_current: {
    label: 'Non-current liability',
    group: 'liability',
    hint: 'Loans repayable after a year',
  },
  equity: { label: 'Equity', group: 'equity', hint: 'Capital, drawings, retained earnings' },
  income: { label: 'Income', group: 'income', hint: 'Sales of goods and services' },
  income_other: { label: 'Other income', group: 'income', hint: 'Interest, grants, gains' },
  expense_direct_cost: {
    label: 'Cost of sales',
    group: 'expense',
    hint: 'Direct costs of what you sell',
  },
  expense: { label: 'Expense', group: 'expense', hint: 'Running costs of the business' },
  expense_depreciation: {
    label: 'Depreciation',
    group: 'expense',
    hint: 'Wear of fixed assets',
  },
  expense_other: { label: 'Other expense', group: 'expense', hint: 'Interest, tax, FX losses' },
};

export const ACCOUNT_TYPE_ORDER = Object.keys(ACCOUNT_TYPES) as AccountType[];

export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

export function accountGroup(type: AccountType): AccountGroup {
  return ACCOUNT_TYPES[type].group;
}

/** Income and expense accounts restart every financial year; the rest carry forward. */
export function isProfitAndLoss(type: AccountType): boolean {
  const group = accountGroup(type);
  return group === 'income' || group === 'expense';
}

/** Accounts money is paid into or out of. */
export function isMoneyAccount(type: AccountType): boolean {
  return type === 'asset_cash' || type === 'liability_credit_card';
}

/** Natural balance side, used to show balances as positive figures. */
export function isDebitNormal(type: AccountType): boolean {
  const group = accountGroup(type);
  return group === 'asset' || group === 'expense';
}
