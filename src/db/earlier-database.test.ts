import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { db, InvoiceDatabase } from './db';
import type { Company } from './types';
import { CURRENT_COMPANY_KEY, setupCompany } from './records';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const databaseNames = async () => (await indexedDB.databases()).map((info) => info.name);

/** A database left by an earlier build, which used a different name. */
async function earlierBuild(name: string, company: Partial<Company>): Promise<void> {
  const earlier = new InvoiceDatabase(name);
  await earlier.open();
  await earlier.companies.put(company as Company);
  await earlier.meta.put({ key: CURRENT_COMPANY_KEY, value: company.id });
  earlier.close();
}

async function reopen(): Promise<void> {
  db.close();
  await db.open();
}

describe('data saved by an earlier build', () => {
  it('moves into an empty database and the old copy is removed', async () => {
    await earlierBuild('earlier-build', { id: 'co1', name: 'Earlier Co' });
    await reopen();
    expect(await db.companies.get('co1')).toMatchObject({ name: 'Earlier Co' });
    expect(await db.meta.get(CURRENT_COMPANY_KEY)).toMatchObject({ value: 'co1' });
    await expect.poll(databaseNames).not.toContain('earlier-build');
  });

  it('never replaces data already in this database', async () => {
    await setupCompany({ name: 'Current Co' });
    await earlierBuild('earlier-build-2', { id: 'co2', name: 'Earlier Co' });
    await reopen();
    expect(await db.companies.get('co2')).toBeUndefined();
    expect(await databaseNames()).toContain('earlier-build-2');
    await Dexie.delete('earlier-build-2');
  });

  it('ignores databases of other apps on the same site', async () => {
    const other = new Dexie('other-app');
    other.version(1).stores({ companies: 'id', notes: 'id' });
    await other.open();
    await other.table('companies').put({ id: 'x', name: 'Not ours' });
    other.close();
    await reopen();
    expect(await db.companies.count()).toBe(0);
    expect(await databaseNames()).toContain('other-app');
    await Dexie.delete('other-app');
  });
});
