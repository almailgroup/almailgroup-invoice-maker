import type { Client, Company, DocumentType, InvoiceDocument, LineItem } from '@/db/types';
import { createClient, createCompany, createDocument } from '@/db/defaults';
import { addDaysISO, today } from '@/lib/dates';
import { shortId } from '@/lib/ids';

const VAT = { name: 'VAT', rate: 20 };
const ZERO = { name: 'VAT', rate: 0 };

function item(partial: Partial<LineItem>): LineItem {
  return {
    id: shortId(),
    kind: 'item',
    productId: null,
    name: '',
    description: '',
    quantity: 1,
    unit: '',
    unitPrice: 0,
    discount: 0,
    discountType: 'percent',
    taxes: [],
    ...partial,
  };
}

/** Fictional company used when the user has not filled in their own details yet. */
export function sampleCompany(): Company {
  return createCompany({
    id: 'sample-company',
    name: 'Northwind Mail Services',
    legalName: 'Northwind Mail Services Ltd',
    email: 'accounts@northwind-mail.example',
    phone: '+44 161 555 0142',
    website: 'https://www.northwind-mail.example',
    taxIdLabel: 'VAT No.',
    taxId: 'GB 123 4567 89',
    registrationLabel: 'Company No.',
    registrationNumber: '09876543',
    address: {
      line1: 'Unit 4, Riverside Business Park',
      line2: 'Kings Road',
      city: 'Manchester',
      state: '',
      postalCode: 'M1 2AB',
      country: 'GB',
    },
    currency: 'GBP',
    locale: 'en-GB',
    dateFormat: 'd MMM yyyy',
    payment: {
      bankDetails:
        'Northwind Bank plc · Sort code 20-00-00 · Account 12345678\nIBAN GB29 NWBK 6016 1331 9268 19 · BIC NWBKGB2L',
      instructions: 'Please use the invoice number as the payment reference.',
      paymentLink: 'https://pay.example.com/northwind',
      showQrCode: true,
    },
  });
}

export function sampleClient(companyId: string): Client {
  return createClient(companyId, {
    id: 'sample-client',
    number: 'C-0007',
    name: 'Brightside Retail Group',
    contacts: [
      {
        id: 'sample-contact',
        name: 'Sarah Mitchell',
        email: 'accounts@brightside.example',
        phone: '+44 113 555 0199',
        primary: true,
      },
    ],
    email: 'accounts@brightside.example',
    taxId: 'GB 987 6543 21',
    address: {
      line1: '88 Commerce Way',
      line2: 'Floor 3',
      city: 'Leeds',
      state: '',
      postalCode: 'LS1 4AP',
      country: 'GB',
    },
  });
}

export function sampleItems(): LineItem[] {
  return [
    item({
      name: 'Campaign design & artwork',
      description: 'Layout, copy review and two rounds of proofs',
      quantity: 1,
      unit: 'job',
      unitPrice: 450,
      taxes: [VAT],
    }),
    item({
      name: 'Full-colour letter printing',
      description: 'A4, double-sided, 100gsm silk',
      quantity: 12500,
      unit: 'pcs',
      unitPrice: 0.085,
      taxes: [VAT],
    }),
    item({
      name: 'Envelope inserting & sealing',
      description: 'C5 window envelopes, machine inserted',
      quantity: 12500,
      unit: 'pcs',
      unitPrice: 0.032,
      taxes: [VAT],
    }),
    item({
      name: 'Postage — 2nd class letter',
      description: 'Pre-sorted by postcode',
      quantity: 12500,
      unit: 'pcs',
      unitPrice: 0.537,
      taxes: [ZERO],
    }),
    item({
      name: 'Project management',
      quantity: 6,
      unit: 'hrs',
      unitPrice: 65,
      discount: 10,
      taxes: [VAT],
    }),
  ];
}

export function sampleDocument(
  company: Company,
  client: Client,
  type: DocumentType = 'invoice',
  overrides: Partial<InvoiceDocument> = {},
): InvoiceDocument {
  const issue = today();
  const number = { invoice: 'INV-2026-0042', quote: 'QUO-2026-0018', credit: 'CN-2026-0003' }[type];
  return createDocument(company.id, type, {
    id: `sample-${type}`,
    number,
    status: 'sent',
    clientId: client.id,
    issueDate: issue,
    dueDate: addDaysISO(issue, type === 'quote' ? company.defaults.quoteValidDays : 30),
    poNumber: type === 'invoice' ? 'PO-77812' : '',
    currency: client.currency ?? company.currency,
    items: sampleItems(),
    notes:
      type === 'quote'
        ? 'Prices are valid for 30 days. We look forward to working with you.'
        : 'Thank you for your business! It was a pleasure working on this campaign.',
    terms:
      type === 'invoice'
        ? 'Payment is due within 30 days of the invoice date. Late payments may be subject to interest at 1.5% per month.'
        : '',
    footer: company.defaults.footer,
    ...overrides,
  });
}

/** Many lines with section headings, used to check multi-page layouts. */
export function sampleLongItems(): LineItem[] {
  const sections = ['Print production', 'Mail handling', 'Postage & delivery'];
  const rows: LineItem[] = [];
  sections.forEach((section, s) => {
    rows.push(item({ kind: 'heading', name: section }));
    for (let i = 1; i <= 14; i++) {
      rows.push(
        item({
          name: `${section.split(' ')[0]} service ${s + 1}.${i}`,
          description: i % 3 === 0 ? 'Includes quality control and proof approval' : '',
          quantity: 100 * i,
          unit: 'pcs',
          unitPrice: 0.125 + i / 100,
          discount: i % 5 === 0 ? 5 : 0,
          taxes: [VAT],
        }),
      );
    }
  });
  return rows;
}
