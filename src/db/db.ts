import Dexie, { type Table } from 'dexie';
import type {
  Activity,
  Client,
  Company,
  InvoiceDocument,
  KeyValue,
  Payment,
  Product,
  RecurringProfile,
  TaxRate,
} from './types';
import { APP_NAME } from '@/lib/brand';

/**
 * All data lives in the browser's IndexedDB. Nothing is sent to a server,
 * which is what lets the app run from GitHub Pages.
 */
export class InvoiceDatabase extends Dexie {
  companies!: Table<Company, string>;
  clients!: Table<Client, string>;
  products!: Table<Product, string>;
  taxRates!: Table<TaxRate, string>;
  documents!: Table<InvoiceDocument, string>;
  payments!: Table<Payment, string>;
  recurring!: Table<RecurringProfile, string>;
  activities!: Table<Activity, string>;
  meta!: Table<KeyValue, string>;

  constructor(name = APP_NAME) {
    super(name);
    this.version(1).stores({
      companies: 'id, name',
      clients: 'id, companyId, name, number',
      products: 'id, companyId, name',
      taxRates: 'id, companyId',
      documents:
        'id, companyId, [companyId+type], [companyId+type+number], clientId, issueDate, status, recurringId',
      payments: 'id, companyId, clientId, date, creditId, *documentIds',
      recurring: 'id, companyId, clientId, nextIssueDate',
      activities: 'id, companyId, [companyId+at], entityId, clientId, documentId',
      meta: 'key',
    });
  }
}

export const DATA_TABLES = [
  'companies',
  'clients',
  'products',
  'taxRates',
  'documents',
  'payments',
  'recurring',
  'activities',
] as const;

export type DataTable = (typeof DATA_TABLES)[number];

const ALL_TABLES = [...DATA_TABLES, 'meta'];

/**
 * Data saved by an earlier build may sit in a database with another name
 * (the database is named after the app). When this database has no company
 * yet, the first database on this site with the same tables and some data is
 * copied in and then deleted.
 */
async function adoptEarlierDatabase(target: Dexie): Promise<void> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return;
  if ((await target.table('companies').count()) > 0) return;
  const names = (await indexedDB.databases())
    .map((info) => info.name)
    .filter((name): name is string => Boolean(name) && name !== target.name);
  for (const name of names) {
    const earlier = new Dexie(name);
    try {
      await earlier.open();
      const tables = new Set(earlier.tables.map((table) => table.name));
      if (!ALL_TABLES.every((table) => tables.has(table))) continue;
      if ((await earlier.table('companies').count()) === 0) continue;
      const rows = await Promise.all(ALL_TABLES.map((table) => earlier.table(table).toArray()));
      await target.transaction('rw', ALL_TABLES, async () => {
        for (const [i, table] of ALL_TABLES.entries()) await target.table(table).bulkPut(rows[i]);
      });
      earlier.close();
      // Not awaited: a tab still running the earlier build delays the delete.
      void Dexie.delete(name).catch(() => undefined);
      return;
    } catch {
      // Unreadable or not ours: leave it untouched.
    } finally {
      earlier.close();
    }
  }
}

export const db = new InvoiceDatabase();
// Runs on every open, before any other query.
db.on('ready', (vipDb) => adoptEarlierDatabase(vipDb), true);

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
