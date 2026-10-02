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

  constructor(name = 'invoice-maker') {
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

export const db = new InvoiceDatabase();

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

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
