import { db } from './db';
import { logActivity } from './activity';
import { createJournal, newJournalLine, saveJournal } from './accounting';
import { createPayment, savePayment } from './payments';
import { createExpense, saveExpense } from './purchases';
import { nowStamp } from './defaults';
import type { BankMatch, BankTransaction, ID, ISODate, ManualJournal, TaxLine } from './types';
import { fingerprints, type StatementLine } from '@/lib/banking/statement';
import { newId } from '@/lib/ids';
import { currencyPrecision, round } from '@/lib/money';

export class BankingError extends Error {}

/**
 * Adds statement lines to a bank account, skipping lines already imported
 * (overlapping statements are normal).
 */
export async function importStatement(
  companyId: ID,
  accountId: ID,
  lines: StatementLine[],
  fileName: string,
): Promise<{ added: number; duplicates: number; transactions: BankTransaction[] }> {
  return db.transaction(
    'rw',
    [db.bankTransactions, db.companies, db.accounts, db.activities],
    async () => {
      const company = await db.companies.get(companyId);
      const account = await db.accounts.get(accountId);
      if (!company || !account || account.companyId !== companyId) {
        throw new BankingError('Choose the account the statement belongs to.');
      }
      const precision = currencyPrecision(company.currency);
      const keys = fingerprints(accountId, lines);
      const existing = new Set(
        (await db.bankTransactions.where('accountId').equals(accountId).toArray()).map(
          (t) => t.fingerprint,
        ),
      );
      const importId = newId();
      const stamp = nowStamp();
      const rows: BankTransaction[] = [];
      lines.forEach((line, i) => {
        if (existing.has(keys[i])) return;
        rows.push({
          id: newId(),
          companyId,
          accountId,
          date: line.date,
          description: line.description.trim(),
          reference: line.reference.trim(),
          amount: round(line.amount, precision),
          balance: line.balance === null ? null : round(line.balance, precision),
          fingerprint: keys[i],
          importId,
          position: i,
          match: null,
          ignored: false,
          createdAt: stamp,
          updatedAt: stamp,
        });
      });
      if (rows.length) await db.bankTransactions.bulkAdd(rows);
      await logActivity(
        companyId,
        'bank',
        importId,
        'imported',
        `${rows.length} statement ${rows.length === 1 ? 'line' : 'lines'} imported into ${account.name}${fileName ? ` from ${fileName}` : ''}`,
      );
      return { added: rows.length, duplicates: lines.length - rows.length, transactions: rows };
    },
  );
}

async function setMatch(id: ID, match: BankMatch | null, ignored = false) {
  const tx = await db.bankTransactions.get(id);
  if (!tx) throw new BankingError('Statement line not found.');
  await db.bankTransactions.put({ ...tx, match, ignored, updatedAt: nowStamp() });
}

export async function matchTransaction(id: ID, match: BankMatch): Promise<void> {
  const taken = await db.bankTransactions
    .filter((t) => t.id !== id && t.match?.source === match.source && t.match.id === match.id)
    .first();
  if (taken) throw new BankingError('That transaction is already matched to another line.');
  await setMatch(id, match);
}

export async function unmatchTransaction(id: ID): Promise<void> {
  await setMatch(id, null);
}

export async function ignoreTransaction(id: ID, ignored: boolean): Promise<void> {
  await setMatch(id, null, ignored);
}

export async function deleteTransaction(id: ID): Promise<void> {
  await db.bankTransactions.delete(id);
}

/** Moves money between two of the company's own accounts. */
export async function saveTransfer(input: {
  companyId: ID;
  from: ID;
  to: ID;
  date: ISODate;
  amount: number;
  reference?: string;
}): Promise<ManualJournal> {
  if (input.from === input.to) throw new BankingError('Choose two different accounts.');
  if (!(input.amount > 0)) throw new BankingError('Enter the amount transferred.');
  const [from, to] = await db.accounts.bulkGet([input.from, input.to]);
  if (!from || !to) throw new BankingError('Choose both accounts.');
  return saveJournal(
    createJournal(input.companyId, {
      date: input.date,
      kind: 'transfer',
      reference: input.reference?.trim() || `Transfer from ${from.name} to ${to.name}`,
      status: 'posted',
      lines: [
        newJournalLine({ accountId: to.id, debit: input.amount, description: `From ${from.name}` }),
        newJournalLine({ accountId: from.id, credit: input.amount, description: `To ${to.name}` }),
      ],
    }),
  );
}

/** What a statement line can become when the books don't have it yet. */
export type CreateAction =
  | { kind: 'document'; documentId: ID }
  | { kind: 'expense'; accountId: ID; taxes: TaxLine[]; vendorId: ID | null }
  | { kind: 'transfer'; otherAccountId: ID }
  | { kind: 'account'; accountId: ID };

/** Records the statement line in the books and matches it to what was created. */
export async function createFromTransaction(id: ID, action: CreateAction): Promise<BankMatch> {
  const tx = await db.bankTransactions.get(id);
  if (!tx) throw new BankingError('Statement line not found.');
  const company = await db.companies.get(tx.companyId);
  if (!company) throw new Error('Company not found');
  const amount = Math.abs(tx.amount);
  const memo = tx.reference || tx.description;
  let match: BankMatch;

  if (action.kind === 'document') {
    const doc = await db.documents.get(action.documentId);
    if (!doc || doc.companyId !== company.id) throw new BankingError('Document not found.');
    const out = doc.type === 'bill';
    if (out !== tx.amount < 0) {
      throw new BankingError(
        out ? 'Bills are paid with money going out.' : 'Invoices are paid with money coming in.',
      );
    }
    const payment = await savePayment(
      createPayment(company.id, {
        direction: out ? 'out' : 'in',
        clientId: doc.clientId,
        date: tx.date,
        amount,
        currency: company.currency,
        accountId: tx.accountId,
        method: 'bank_transfer',
        reference: memo.slice(0, 120),
        allocations: [
          { documentId: doc.id, amount: Math.min(amount, Math.max(0, doc.totals.balance)) },
        ],
      }),
    );
    match = { source: 'payment', id: payment.id };
  } else if (action.kind === 'expense') {
    if (tx.amount >= 0) throw new BankingError('An expense is money going out.');
    const expense = await saveExpense(
      createExpense(company.id, {
        date: tx.date,
        accountId: action.accountId,
        description: tx.description.slice(0, 200),
        amount,
        taxes: action.taxes,
        currency: company.currency,
        paidFromAccountId: tx.accountId,
        vendorId: action.vendorId,
        reference: tx.reference,
      }),
    );
    match = { source: 'expense', id: expense.id };
  } else {
    const other = action.kind === 'transfer' ? action.otherAccountId : action.accountId;
    const into = tx.amount > 0;
    const journal =
      action.kind === 'transfer'
        ? await saveTransfer({
            companyId: company.id,
            from: into ? other : tx.accountId,
            to: into ? tx.accountId : other,
            date: tx.date,
            amount,
            reference: memo,
          })
        : await saveJournal(
            createJournal(company.id, {
              date: tx.date,
              reference: memo.slice(0, 120) || 'Bank transaction',
              status: 'posted',
              lines: [
                newJournalLine({
                  accountId: tx.accountId,
                  debit: into ? amount : 0,
                  credit: into ? 0 : amount,
                  description: tx.description,
                }),
                newJournalLine({
                  accountId: other,
                  debit: into ? 0 : amount,
                  credit: into ? amount : 0,
                  description: tx.description,
                }),
              ],
            }),
          );
    match = { source: 'journal', id: journal.id };
  }
  await setMatch(tx.id, match);
  return match;
}
