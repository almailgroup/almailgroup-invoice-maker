import { useMemo, useState } from 'react';
import { Copy, Mail, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Client, Company, InvoiceDocument } from '@/db/types';
import { markSent } from '@/db/documents';
import { logActivity } from '@/db/activity';
import { fillTemplate, isValidEmail, mailtoLink } from '@/lib/email';
import { formatDate, formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/overlay';
import { downloadBlob } from '@/pdf/client';
import { salesType } from '@/lib/document-types';

export type EmailKind = 'document' | 'reminder';

export function emailValues(doc: InvoiceDocument, company: Company, client: Client | null) {
  const contact = client?.contacts.find((c) => c.primary) ?? client?.contacts[0];
  const money = (n: number) => formatMoney(n, doc.currency, company.locale);
  return {
    client: client?.name ?? '',
    contact: contact?.name || client?.name || 'there',
    number: doc.number,
    amount: money(doc.totals.total),
    balance: money(doc.totals.balance),
    issueDate: formatDate(doc.issueDate, company.dateFormat, company.locale),
    dueDate: formatDate(doc.dueDate, company.dateFormat, company.locale) || '—',
    company: company.name,
    paymentLink: company.payment.paymentLink ? `Pay online: ${company.payment.paymentLink}` : '',
  };
}

export function SendDialog({
  open,
  onOpenChange,
  doc,
  company,
  client,
  kind = 'document',
  getPdf,
  fileName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: InvoiceDocument;
  company: Company;
  client: Client | null;
  kind?: EmailKind;
  getPdf: () => Promise<Blob>;
  fileName: string;
}) {
  const template =
    kind === 'reminder'
      ? company.emailTemplates.reminder
      : company.emailTemplates[salesType(doc.type)];
  const values = useMemo(() => emailValues(doc, company, client), [doc, company, client]);
  const contacts = (client?.contacts ?? []).filter((c) => c.email);
  const [to, setTo] = useState(
    contacts.find((c) => c.primary)?.email ?? contacts[0]?.email ?? client?.email ?? '',
  );
  const [subject, setSubject] = useState(fillTemplate(template.subject, values));
  const [body, setBody] = useState(fillTemplate(template.body, values));
  const [markAsSent, setMarkAsSent] = useState(doc.status === 'draft');
  const [busy, setBusy] = useState<'mail' | 'share' | null>(null);

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'test.pdf', { type: 'application/pdf' })] });

  const recipients = to
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = recipients.filter((r) => !isValidEmail(r));

  const afterSend = async (via: string) => {
    if (markAsSent && doc.status === 'draft') await markSent(doc.id);
    await logActivity(
      company.id,
      doc.type,
      doc.id,
      kind === 'reminder' ? 'reminded' : 'emailed',
      `${kind === 'reminder' ? 'Reminder for' : 'Sent'} ${doc.number}${recipients.length ? ` to ${recipients.join(', ')}` : ''} (${via})`,
      { clientId: doc.clientId || null, documentId: doc.id },
    );
  };

  const openMail = async () => {
    setBusy('mail');
    try {
      // Email links cannot carry attachments, so download the PDF to attach.
      downloadBlob(await getPdf(), fileName);
      window.location.assign(mailtoLink({ to: recipients, subject, body }));
      await afterSend('email app');
      toast.success('PDF downloaded — attach it to the email that just opened.');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare the email.');
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    try {
      const file = new File([await getPdf()], fileName, { type: 'application/pdf' });
      await navigator.share({ files: [file], title: subject, text: body });
      await afterSend('share');
      onOpenChange(false);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.error('Sharing failed. Try “Open email app” instead.');
      }
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`${subject}\n\n${body}`);
    toast.success('Email text copied');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={kind === 'reminder' ? 'Send a payment reminder' : `Send ${doc.number}`}
        description="Opens your email app with the message ready. The PDF is downloaded so you can attach it."
        size="lg"
      >
        <DialogBody>
          <Field
            label="To"
            error={invalid.length ? `Check: ${invalid.join(', ')}` : undefined}
            hint="Separate several addresses with commas."
          >
            {(id) => (
              <Input
                id={id}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@example.com"
              />
            )}
          </Field>
          {contacts.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200"
                  onClick={() =>
                    setTo((t) =>
                      t.includes(c.email) ? t : [t, c.email].filter(Boolean).join(', '),
                    )
                  }
                >
                  + {c.name || c.email}
                </button>
              ))}
            </div>
          ) : null}
          <Field label="Subject">
            {(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}
          </Field>
          <Field label="Message">
            {(id) => (
              <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} rows={9} />
            )}
          </Field>
          {doc.status === 'draft' ? (
            <Checkbox
              checked={markAsSent}
              onChange={(e) => setMarkAsSent(e.target.checked)}
              label="Mark as sent"
              description="Moves the document out of drafts."
            />
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={copy}>
            <Copy /> Copy text
          </Button>
          {canShare ? (
            <Button
              variant="outline"
              onClick={share}
              loading={busy === 'share'}
              disabled={busy !== null}
            >
              <Share2 /> Share PDF…
            </Button>
          ) : null}
          <Button
            onClick={openMail}
            loading={busy === 'mail'}
            disabled={busy !== null || invalid.length > 0}
          >
            <Mail /> Open email app
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
