import { db } from './db';
import { logActivity } from './activity';
import { accountingSettings } from './chart-setup';
import { defaultNumbering, nowStamp } from './defaults';
import type {
  Account,
  AccountRole,
  Company,
  ID,
  ISODate,
  JournalLine,
  ManualJournal,
} from './types';
import {
  buildLedger,
  type LedgerContext,
  type LedgerLine,
  type LedgerProblem,
} from '@/lib/accounting/ledger';
import { currencyPrecision, dec, round } from '@/lib/money';
import { allocateNumber } from '@/lib/numbering';
import { newId } from '@/lib/ids';
import { today } from '@/lib/dates';

/* -------------------------------------------------------------------------- */
/* Lock date                                                                  */
/* -------------------------------------------------------------------------- */

export class LockedPeriodError extends Error {
  constructor(lockDate: ISODate) {
    super(
      `The books are locked up to ${lockDate}. Change the lock date in Settings → Accounting to edit earlier transactions.`,
    );
  }
}

/** Throws when any of the dates falls on or before the company's lock date. */
export function assertUnlocked(company: Company, ...dates: (ISODate | null | undefined)[]): void {
  const lock = accountingSettings(company).lockDate;
  if (!lock) return;
  if (dates.some((d) => d && d <= lock)) throw new LockedPeriodError(lock);
}

/* -------------------------------------------------------------------------- */
/* Accounts                                                                   */
/* -------------------------------------------------------------------------- */

/** The account for each automatic posting (active accounts first). */
export function roleMap(accounts: Account[]): Partial<Record<AccountRole, ID>> {
  const roles: Partial<Record<AccountRole, ID>> = {};
  const ordered = [...accounts].sort((a, b) => Number(a.archived) - Number(b.archived));
  for (const a of ordered) if (a.role && !roles[a.role]) roles[a.role] = a.id;
  return roles;
}

export function createAccount(companyId: ID, overrides: Partial<Account> = {}): Account {
  const stamp = nowStamp();
  return {
    id: newId(),
    companyId,
    code: '',
    name: '',
    type: 'expense',
    description: '',
    role: null,
    bank: null,
    archived: false,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

export class AccountError extends Error {}

export async function saveAccount(input: Account): Promise<Account> {
  return db.transaction('rw', [db.accounts, db.activities], async () => {
    const account: Account = { ...input, code: input.code.trim(), name: input.name.trim() };
    if (!account.name) throw new AccountError('Enter a name for the account.');
    if (!account.code) throw new AccountError('Enter a code for the account.');
    const sameCode = await db.accounts
      .where('[companyId+code]')
      .equals([account.companyId, account.code])
      .filter((a) => a.id !== account.id)
      .count();
    if (sameCode)
      throw new AccountError(`Code ${account.code} is already used by another account.`);
    const existing = await db.accounts.get(account.id);
    if (existing?.role && existing.type !== account.type) {
      throw new AccountError('The type of an account used for automatic postings cannot change.');
    }
    if (existing?.role && account.archived) {
      throw new AccountError('Accounts used for automatic postings cannot be archived.');
    }
    account.updatedAt = nowStamp();
    await db.accounts.put(account);
    await logActivity(
      account.companyId,
      'account',
      account.id,
      existing ? 'updated' : 'created',
      `Account ${account.code} ${account.name} ${existing ? 'updated' : 'created'}`,
    );
    return account;
  });
}

/** Whether any transaction or setting refers to the account. */
export async function accountInUse(account: Account): Promise<boolean> {
  if (account.role) return true;
  const id = account.id;
  const [journals, payments, products, documents, expenses] = await Promise.all([
    db.journals
      .where('companyId')
      .equals(account.companyId)
      .filter((j) => j.lines.some((l) => l.accountId === id))
      .count(),
    db.payments
      .where('companyId')
      .equals(account.companyId)
      .filter((p) => p.accountId === id)
      .count(),
    db.products
      .where('companyId')
      .equals(account.companyId)
      .filter((p) => p.incomeAccountId === id)
      .count(),
    db.documents
      .where('companyId')
      .equals(account.companyId)
      .filter((d) => d.items.some((i) => i.accountId === id))
      .count(),
    db.expenses
      .where('companyId')
      .equals(account.companyId)
      .filter((e) => e.accountId === id || e.paidFromAccountId === id)
      .count(),
  ]);
  return journals + payments + products + documents + expenses > 0;
}

export async function deleteAccount(id: ID): Promise<void> {
  const account = await db.accounts.get(id);
  if (!account) return;
  if (await accountInUse(account)) {
    throw new AccountError('This account is used by transactions or settings. Archive it instead.');
  }
  await db.accounts.delete(id);
  await logActivity(
    account.companyId,
    'account',
    id,
    'deleted',
    `Account ${account.code} ${account.name} deleted`,
  );
}

/* -------------------------------------------------------------------------- */
/* Manual journals                                                            */
/* -------------------------------------------------------------------------- */

export function newJournalLine(overrides: Partial<JournalLine> = {}): JournalLine {
  return {
    id: newId(),
    accountId: '',
    description: '',
    debit: 0,
    credit: 0,
    contactId: null,
    ...overrides,
  };
}

export function createJournal(
  companyId: ID,
  overrides: Partial<ManualJournal> = {},
): ManualJournal {
  const stamp = nowStamp();
  return {
    id: newId(),
    companyId,
    number: '',
    date: today(),
    reference: '',
    notes: '',
    status: 'posted',
    lines: [newJournalLine(), newJournalLine()],
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

export class JournalError extends Error {}

/** Totals of a journal in the company currency (debit, credit, difference). */
export function journalTotals(lines: JournalLine[], precision: number) {
  const debit = lines.reduce((acc, l) => acc.plus(dec(l.debit)), dec(0));
  const credit = lines.reduce((acc, l) => acc.plus(dec(l.credit)), dec(0));
  return {
    debit: round(debit, precision),
    credit: round(credit, precision),
    difference: round(debit.minus(credit), precision),
  };
}

export async function saveJournal(input: ManualJournal): Promise<ManualJournal> {
  return db.transaction('rw', [db.journals, db.companies, db.accounts, db.activities], async () => {
    const company = await db.companies.get(input.companyId);
    if (!company) throw new Error('Company not found');
    const existing = await db.journals.get(input.id);
    assertUnlocked(company, input.date, existing?.date);

    const lines = input.lines.filter((l) => l.accountId && (l.debit !== 0 || l.credit !== 0));
    if (lines.some((l) => l.debit < 0 || l.credit < 0)) {
      throw new JournalError('Amounts must be positive. Use the other column to reverse.');
    }
    if (lines.some((l) => l.debit !== 0 && l.credit !== 0)) {
      throw new JournalError('A line can have a debit or a credit, not both.');
    }
    if (lines.length < 2)
      throw new JournalError('A journal needs at least two lines with amounts.');
    const totals = journalTotals(lines, currencyPrecision(company.currency));
    if (totals.difference !== 0) throw new JournalError('Debits and credits must be equal.');
    const accounts = await db.accounts.bulkGet(lines.map((l) => l.accountId));
    if (accounts.some((a) => !a || a.companyId !== company.id)) {
      throw new JournalError('Choose an account on every line.');
    }

    let journal: ManualJournal = { ...input, lines, number: input.number.trim() };
    if (!journal.number) {
      const rule = company.numbering.journal ?? defaultNumbering().journal;
      const taken = new Set(
        (await db.journals.where('companyId').equals(company.id).toArray())
          .filter((j) => j.id !== journal.id)
          .map((j) => j.number.toLowerCase()),
      );
      const allocated = allocateNumber(rule, journal.date, (n) => taken.has(n.toLowerCase()));
      journal.number = allocated.number;
      await db.companies.put({
        ...company,
        numbering: { ...company.numbering, journal: allocated.rule },
      });
    }
    journal = { ...journal, updatedAt: nowStamp() };
    if (!existing) journal.createdAt = journal.updatedAt;
    await db.journals.put(journal);
    await logActivity(
      company.id,
      'journal',
      journal.id,
      existing ? 'updated' : 'created',
      `Journal ${journal.number} ${existing ? 'updated' : 'created'}`,
    );
    return journal;
  });
}

export async function deleteJournal(id: ID): Promise<void> {
  await db.transaction('rw', [db.journals, db.companies, db.activities], async () => {
    const journal = await db.journals.get(id);
    if (!journal) return;
    const company = await db.companies.get(journal.companyId);
    if (company) assertUnlocked(company, journal.date);
    await db.journals.delete(id);
    await logActivity(
      journal.companyId,
      'journal',
      id,
      'deleted',
      `Journal ${journal.number} deleted`,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Ledger                                                                     */
/* -------------------------------------------------------------------------- */

export interface CompanyLedger {
  accounts: Account[];
  lines: LedgerLine[];
  problems: LedgerProblem[];
}

/** Builds the general ledger of a company from its documents, payments and journals. */
export async function loadLedger(company: Company): Promise<CompanyLedger> {
  const [accounts, documents, payments, journals, expenses, products, clients] = await Promise.all([
    db.accounts.where('companyId').equals(company.id).toArray(),
    db.documents.where('companyId').equals(company.id).toArray(),
    db.payments.where('companyId').equals(company.id).toArray(),
    db.journals.where('companyId').equals(company.id).toArray(),
    db.expenses.where('companyId').equals(company.id).toArray(),
    db.products.where('companyId').equals(company.id).toArray(),
    db.clients.where('companyId').equals(company.id).toArray(),
  ]);
  const exempt = new Set(clients.filter((c) => c.taxExempt).map((c) => c.id));
  const ctx: LedgerContext = {
    companyCurrency: company.currency,
    precision: currencyPrecision(company.currency),
    roles: roleMap(accounts),
    accountIds: new Set(accounts.map((a) => a.id)),
    productAccounts: new Map(products.map((p) => [p.id, p.incomeAccountId])),
    taxExempt: (id) => exempt.has(id),
    documents: new Map(documents.map((d) => [d.id, d])),
  };
  const { lines, problems } = buildLedger({ documents, payments, journals, expenses }, ctx);
  return { accounts, lines, problems };
}
