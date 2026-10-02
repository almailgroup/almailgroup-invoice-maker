import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { createClient } from './defaults';
import { exportBackup, importBackup, parseBackup, BackupError, summarizeBackup } from './backup';
import { saveClient, setupCompany, getCurrentCompanyId } from './records';
import { seedDemoCompany } from './demo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('backup', () => {
  it('round-trips everything through JSON', async () => {
    const demo = await seedDemoCompany();
    const backup = await exportBackup();
    const counts = summarizeBackup(backup);
    expect(counts.companies).toBe(1);
    expect(counts.documents).toBeGreaterThan(10);
    expect(counts.payments).toBeGreaterThan(3);

    const text = JSON.stringify(backup);
    await db.delete();
    await db.open();
    await importBackup(parseBackup(text), 'replace');

    expect(await db.documents.count()).toBe(counts.documents);
    expect(await db.payments.count()).toBe(counts.payments);
    expect(await getCurrentCompanyId()).toBe(demo.id);
    const restored = await db.documents.where('companyId').equals(demo.id).first();
    expect(restored?.totals.total).toBeGreaterThan(0);
  });

  it('exports a single company', async () => {
    const a = await setupCompany({ name: 'A' });
    const b = await setupCompany({ name: 'B' });
    await saveClient(createClient(a.id, { name: 'Client A' }));
    await saveClient(createClient(b.id, { name: 'Client B' }));
    const backup = await exportBackup(a.id);
    expect(backup.data.companies.map((c) => c.id)).toEqual([a.id]);
    expect(backup.data.clients).toHaveLength(1);
  });

  it('merges without deleting existing data', async () => {
    const a = await setupCompany({ name: 'A' });
    const backup = await exportBackup(a.id);
    await setupCompany({ name: 'B' });
    await importBackup(backup, 'merge');
    expect(await db.companies.count()).toBe(2);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow(BackupError);
    expect(() =>
      parseBackup(
        JSON.stringify({
          app: 'invoice-maker',
          format: 99,
          exportedAt: '',
          data: { companies: [] },
        }),
      ),
    ).toThrow(/newer version/);
  });

  it('sanitizes logos on import', async () => {
    const a = await setupCompany({ name: 'A' });
    await db.companies.update(a.id, {
      branding: { ...a.branding, logo: 'data:image/png;base64,broken' },
    });
    const backup = await exportBackup();
    await importBackup(backup, 'replace', async () => null);
    expect((await db.companies.get(a.id))?.branding.logo).toBeNull();
  });
});
