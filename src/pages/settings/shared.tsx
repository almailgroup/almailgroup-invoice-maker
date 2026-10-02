import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Company } from '@/db/types';
import { saveCompany } from '@/db/records';
import { useCompany } from '@/app/company';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';

/** Local editable copy of the company with save/reset and a leave guard. */
export function useCompanyDraft() {
  const company = useCompany();
  const [draft, setDraft] = useState<Company>(company);
  const [base, setBase] = useState(company);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  useUnsavedGuard(dirty && !saving);

  // Pick up changes made elsewhere (another tab, logo upload…) when nothing is
  // pending. Adjusting state during render is React's recommended pattern here.
  if (company !== base && !dirty) {
    setBase(company);
    setDraft(company);
  }

  /** Saves the draft with `patch` applied (also used for one-click changes). */
  const saveWith = async (patch: Partial<Company> = {}, message = 'Settings saved') => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setSaving(true);
    try {
      const saved = await saveCompany(next);
      setDraft(saved);
      setBase(saved);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return {
    draft,
    setDraft,
    update: (patch: Partial<Company>) => setDraft((d) => ({ ...d, ...patch })),
    dirty,
    saving,
    save: () => saveWith(),
    saveWith,
    reset: () => setDraft(base),
  };
}

export function SettingsSection({
  title,
  description,
  children,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </Card>
  );
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
      <p className="text-sm text-slate-600">You have unsaved changes.</p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onReset} disabled={saving}>
          Discard
        </Button>
        <Button onClick={onSave} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
