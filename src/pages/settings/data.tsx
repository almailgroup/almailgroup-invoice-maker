import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Download, HardDrive, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { db, getMeta } from '@/db/db';
import {
  backupFileName,
  exportBackup,
  importBackup,
  LAST_BACKUP_KEY,
  markBackedUp,
  parseBackup,
  summarizeBackup,
  wipeAllData,
  type Backup,
} from '@/db/backup';
import { useCompany, useFormat } from '@/app/company';
import { normalizeImage } from '@/lib/image';
import { APP_NAME } from '@/lib/brand';
import { formatBytes, requestPersistentStorage, storageStatus } from '@/lib/storage';
import { daysBetween, today } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  useConfirm,
} from '@/components/ui/overlay';
import { SettingsSection } from './shared';

function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const TABLE_LABELS: Record<string, string> = {
  companies: 'Companies',
  clients: 'Clients',
  products: 'Products',
  taxRates: 'Tax rates',
  documents: 'Invoices, quotes & credit notes',
  payments: 'Payments',
  recurring: 'Recurring invoices',
  activities: 'Activity entries',
  accounts: 'Chart of accounts',
  journals: 'Manual journals',
  expenses: 'Expenses',
  attachments: 'Receipts and files',
  vatReturns: 'VAT returns',
};

export default function DataSettings() {
  const company = useCompany();
  const fmt = useFormat();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof storageStatus>> | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const lastBackup = useLiveQuery(() => getMeta<string | null>(LAST_BACKUP_KEY, null), []);
  const companyCount = useLiveQuery(() => db.companies.count(), []);

  useEffect(() => {
    void storageStatus().then(setStatus);
  }, []);

  const backup = async (all: boolean) => {
    setBusy(all ? 'all' : 'one');
    try {
      const data = await exportBackup(all ? undefined : company.id);
      downloadJson(data, backupFileName(all ? undefined : company));
      await markBackedUp();
      toast.success('Backup downloaded. Keep it somewhere safe (e.g. cloud drive).');
    } finally {
      setBusy(null);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read the file.');
    }
  };

  const restore = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace all data?',
        description:
          'Everything currently stored in this browser is deleted and replaced by the backup.',
        confirmLabel: 'Replace everything',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(mode);
    try {
      await importBackup(pending, mode, (logo) => normalizeImage(logo));
      toast.success('Backup restored');
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Restore failed.');
    } finally {
      setBusy(null);
    }
  };

  const wipe = async () => {
    const ok = await confirm({
      title: 'Delete all data in this browser?',
      description:
        'All companies, clients, invoices and payments stored here are removed permanently. Download a backup first.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    await wipeAllData();
    window.location.reload();
  };

  const age = lastBackup ? daysBetween(lastBackup.slice(0, 10), today()) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Your data lives only in this browser.</p>
        <p className="mt-1">
          Nothing is uploaded to a server — that keeps it private, but clearing browser data or
          switching computers loses it. Download a backup regularly and restore it on another device
          when needed.
        </p>
      </div>

      <SettingsSection
        title="Back up"
        description={
          lastBackup ? (
            <>
              Last backup: {fmt.dateTime(lastBackup)}{' '}
              {age !== null && age > 14 ? <Badge tone="amber">{age} days ago</Badge> : null}
            </>
          ) : (
            'No backup made yet from this browser.'
          )
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => backup(false)} loading={busy === 'one'}>
            <Download /> Back up {company.name}
          </Button>
          {(companyCount ?? 0) > 1 ? (
            <Button variant="outline" onClick={() => backup(true)} loading={busy === 'all'}>
              <Download /> Back up all companies
            </Button>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Restore"
        description={`Load a backup file made with ${APP_NAME} (.json).`}
      >
        <Button variant="outline" onClick={() => input.current?.click()}>
          <Upload /> Choose backup file…
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            void chooseFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </SettingsSection>

      <SettingsSection title="Storage">
        {status ? (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <HardDrive className="size-4 text-slate-400" />
              {status.usage !== null ? `${formatBytes(status.usage)} used` : 'Usage unknown'}
            </span>
            {status.persisted ? (
              <Badge tone="green">
                <ShieldCheck className="size-3" /> Protected from automatic clean-up
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const ok = await requestPersistentStorage();
                  setStatus(await storageStatus());
                  toast[ok ? 'success' : 'message'](
                    ok
                      ? 'Storage is now protected.'
                      : 'Your browser decides this automatically (bookmarking or installing the app helps).',
                  );
                }}
              >
                <ShieldCheck /> Protect my data
              </Button>
            )}
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Danger zone">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Remove every company and record from this browser.
          </p>
          <Button variant="danger" onClick={() => void wipe()}>
            <AlertTriangle /> Delete all data
          </Button>
        </div>
      </SettingsSection>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        {pending ? (
          <DialogContent
            title="Restore backup"
            description={`Created ${fmt.dateTime(pending.exportedAt)}`}
          >
            <DialogBody>
              <ul className="divide-y divide-slate-100 text-sm">
                {Object.entries(summarizeBackup(pending)).map(([table, count]) => (
                  <li key={table} className="flex justify-between py-1.5">
                    <span className="text-slate-600">{TABLE_LABELS[table] ?? table}</span>
                    <span className="tabular font-medium text-slate-900">{count}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-500">
                <strong>Merge</strong> adds the backup to what is already here (records with the
                same id are updated). <strong>Replace</strong> deletes everything first.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => void restore('merge')}
                loading={busy === 'merge'}
              >
                Merge
              </Button>
              <Button
                variant="danger"
                onClick={() => void restore('replace')}
                loading={busy === 'replace'}
              >
                Replace everything
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
