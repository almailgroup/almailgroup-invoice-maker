import { db } from './db';
import { createClient, createProduct, createRecurring } from './defaults';
import { draftDocument, markSent, saveDocument, setDocumentStatus } from './documents';
import { createPayment, savePayment } from './payments';
import { saveClient, saveProduct, setupCompany } from './records';
import type { Client, Company, InvoiceDocument, LineItem, Product } from './types';
import { addDaysISO, today } from '@/lib/dates';
import { shortId } from '@/lib/ids';
import { regionDefaults } from '@/lib/regions';

const VAT = { name: 'VAT', rate: 20 };
const ZERO = { name: 'VAT', rate: 0 };

const CLIENTS: Partial<Client>[] = [
  {
    name: 'Brightside Retail Group',
    contacts: [{ id: 'c1', name: 'Sarah Mitchell', email: 'accounts@brightside.example', phone: '+44 113 555 0199', primary: true }],
    address: { line1: '88 Commerce Way', line2: 'Floor 3', city: 'Leeds', state: '', postalCode: 'LS1 4AP', country: 'GB' },
    taxId: 'GB 987 6543 21',
  },
  {
    name: 'Harbor & Pine Legal LLP',
    contacts: [{ id: 'c2', name: 'James Okafor', email: 'finance@harborpine.example', phone: '+44 20 5550 1188', primary: true }],
    address: { line1: '14 Chancery Lane', line2: '', city: 'London', state: '', postalCode: 'WC2A 1PL', country: 'GB' },
  },
  {
    name: 'Maple Street Clinics',
    contacts: [{ id: 'c3', name: 'Dr. Aisha Rahman', email: 'admin@maplestreet.example', phone: '+44 161 555 0177', primary: true }],
    address: { line1: '3 Maple Street', line2: '', city: 'Manchester', state: '', postalCode: 'M4 6BF', country: 'GB' },
    paymentTermsDays: 14,
  },
  {
    name: 'Orbit Logistics Ltd',
    contacts: [{ id: 'c4', name: 'Tom Becker', email: 'ap@orbitlogistics.example', phone: '+44 121 555 0123', primary: true }],
    address: { line1: 'Unit 9, Gateway Park', line2: '', city: 'Birmingham', state: '', postalCode: 'B7 4AA', country: 'GB' },
  },
  {
    name: 'Sunrise Charity Trust',
    contacts: [{ id: 'c5', name: 'Grace Lin', email: 'hello@sunrisetrust.example', phone: '', primary: true }],
    address: { line1: '22 Hope Street', line2: '', city: 'Liverpool', state: '', postalCode: 'L1 9BQ', country: 'GB' },
    taxExempt: true,
  },
  {
    name: 'Kestrel Software GmbH',
    contacts: [{ id: 'c6', name: 'Lena Vogel', email: 'billing@kestrel.example', phone: '+49 30 5550 4411', primary: true }],
    address: { line1: 'Torstraße 115', line2: '', city: 'Berlin', state: '', postalCode: '10119', country: 'DE' },
    currency: 'EUR',
    taxId: 'DE 123456789',
  },
];

const PRODUCTS: Partial<Product>[] = [
  { sku: 'DM-SETUP', name: 'Direct mail campaign setup', description: 'Artwork checks, data merge and proofs', unitPrice: 450, unit: 'job' },
  { sku: 'PR-A4C', name: 'A4 letter printing — full colour', description: 'Double-sided, 100gsm silk', unitPrice: 0.085, unit: 'pcs' },
  { sku: 'FUL-INS', name: 'Envelope inserting & sealing', description: 'C5 window envelopes, machine inserted', unitPrice: 0.032, unit: 'pcs' },
  { sku: 'POST-2C', name: 'Postage — 2nd class letter', description: 'Pre-sorted by postcode', unitPrice: 0.537, unit: 'pcs' },
  { sku: 'POST-1C', name: 'Postage — 1st class letter', description: '', unitPrice: 0.85, unit: 'pcs' },
  { sku: 'CR-NXT', name: 'Courier — next-day delivery', description: 'Tracked, signed for', unitPrice: 18.5, unit: 'parcel' },
  { sku: 'DATA-CL', name: 'Data cleansing & deduplication', description: 'Per 1,000 records', unitPrice: 12, unit: 'batch' },
  { sku: 'PM-HR', name: 'Project management', description: '', unitPrice: 65, unit: 'hrs' },
];

function line(product: Product, quantity: number, taxes = [VAT], discount = 0): LineItem {
  return {
    id: shortId(),
    kind: 'item',
    productId: product.id,
    name: product.name,
    description: product.description,
    quantity,
    unit: product.unit,
    unitPrice: product.unitPrice,
    discount,
    discountType: 'percent',
    taxes,
  };
}

async function invoice(
  company: Company,
  client: Client,
  type: InvoiceDocument['type'],
  daysAgo: number,
  items: LineItem[],
): Promise<InvoiceDocument> {
  const draft = await draftDocument(company, type, client);
  const issueDate = addDaysISO(today(), -daysAgo);
  const terms = client.paymentTermsDays ?? company.defaults.paymentTermsDays;
  return saveDocument({
    ...draft,
    issueDate,
    dueDate: type === 'invoice' ? addDaysISO(issueDate, terms) : type === 'quote' ? addDaysISO(issueDate, 30) : null,
    items,
  });
}

async function pay(company: Company, doc: InvoiceDocument, amount: number, daysAgo: number, method: 'bank_transfer' | 'card' = 'bank_transfer') {
  await savePayment(
    createPayment(company.id, {
      clientId: doc.clientId,
      date: addDaysISO(today(), -daysAgo),
      amount,
      currency: doc.currency,
      method,
      reference: `REF-${doc.number}`,
      allocations: [{ documentId: doc.id, amount }],
    }),
  );
}

/**
 * Creates a fully populated demo company to explore the app with. Runs as one
 * transaction so the app only switches over once everything is in place.
 */
export async function seedDemoCompany(): Promise<Company> {
  return db.transaction(
    'rw',
    [db.companies, db.clients, db.products, db.taxRates, db.documents, db.payments, db.recurring, db.activities, db.meta],
    seed,
  );
}

async function seed(): Promise<Company> {
  const region = regionDefaults('GB');
  const company = await setupCompany(
    {
      name: 'Northwind Mail Services (Demo)',
      legalName: 'Northwind Mail Services Ltd',
      email: 'accounts@northwind-mail.example',
      phone: '+44 161 555 0142',
      website: 'https://www.northwind-mail.example',
      taxIdLabel: region.taxIdLabel,
      taxId: 'GB 123 4567 89',
      registrationNumber: '09876543',
      address: { line1: 'Unit 4, Riverside Business Park', line2: 'Kings Road', city: 'Manchester', state: '', postalCode: 'M1 2AB', country: 'GB' },
      currency: region.currency,
      locale: region.locale,
      dateFormat: 'd MMM yyyy',
      payment: {
        bankDetails: 'Northwind Bank plc · Sort code 20-00-00 · Account 12345678\nIBAN GB29 NWBK 6016 1331 9268 19 · BIC NWBKGB2L',
        instructions: 'Please use the invoice number as the payment reference.',
        paymentLink: 'https://pay.example.com/northwind',
        showQrCode: true,
      },
    },
    [VAT, { name: 'VAT', rate: 5 }, ZERO],
  );
  const fresh = (await db.companies.get(company.id))!;
  fresh.defaults.invoiceTerms = 'Payment is due within 30 days. Late payments may incur interest at 1.5% per month.';
  fresh.defaults.footer = 'Northwind Mail Services Ltd · Registered in England & Wales No. 09876543';
  await db.companies.put(fresh);

  const clients: Client[] = [];
  for (const c of CLIENTS) clients.push(await saveClient(createClient(company.id, c)));
  const products: Product[] = [];
  for (const p of PRODUCTS) {
    const taxRates = await db.taxRates.where('companyId').equals(company.id).toArray();
    const zero = taxRates.find((t) => t.rate === 0);
    const standard = taxRates.find((t) => t.rate === 20);
    const taxRateIds = p.sku?.startsWith('POST') ? (zero ? [zero.id] : []) : standard ? [standard.id] : [];
    products.push(await saveProduct(createProduct(company.id, { ...p, taxRateIds })));
  }
  const [setup, print, insert, post2, post1, courier, data, pm] = products;
  const [brightside, harbor, maple, orbit, sunrise, kestrel] = clients;
  const co = (await db.companies.get(company.id))!;

  // Invoices across the last six months.
  const paidOld = await invoice(co, brightside, 'invoice', 160, [line(setup, 1), line(print, 8000), line(insert, 8000), line(post2, 8000, [ZERO])]);
  await markSent(paidOld.id);
  await pay(co, paidOld, paidOld.totals.total, 140);

  const paid2 = await invoice(co, harbor, 'invoice', 128, [line(print, 2500), line(post1, 2500, [ZERO]), line(pm, 3)]);
  await markSent(paid2.id);
  await pay(co, paid2, paid2.totals.total, 101, 'card');

  const paid3 = await invoice(co, orbit, 'invoice', 96, [line(courier, 42), line(pm, 4, [VAT], 10)]);
  await markSent(paid3.id);
  await pay(co, paid3, paid3.totals.total, 70);

  const paid4 = await invoice(co, maple, 'invoice', 75, [line(data, 6), line(print, 4200), line(insert, 4200), line(post2, 4200, [ZERO])]);
  await markSent(paid4.id);
  await pay(co, paid4, paid4.totals.total, 60);

  const partial = await invoice(co, brightside, 'invoice', 52, [line(setup, 1), line(print, 12500), line(insert, 12500), line(post2, 12500, [ZERO]), line(pm, 6, [VAT], 10)]);
  await markSent(partial.id);
  await pay(co, partial, 5000, 30);

  const overdue = await invoice(co, harbor, 'invoice', 48, [line(courier, 12), line(print, 1500), line(post1, 1500, [ZERO])]);
  await markSent(overdue.id);

  const kestrelInv = await invoice(co, kestrel, 'invoice', 34, [line(setup, 1), line(data, 3)]);
  await markSent(kestrelInv.id);
  await pay(co, kestrelInv, kestrelInv.totals.total, 20, 'card');

  const sunriseInv = await invoice(co, sunrise, 'invoice', 21, [line(print, 3000), line(insert, 3000), line(post2, 3000, [ZERO])]);
  await markSent(sunriseInv.id);

  const recent = await invoice(co, orbit, 'invoice', 9, [line(courier, 28), line(pm, 2)]);
  await markSent(recent.id);

  const recentMaple = await invoice(co, maple, 'invoice', 4, [line(data, 2), line(pm, 3)]);
  await markSent(recentMaple.id);

  await invoice(co, brightside, 'invoice', 1, [line(print, 6000), line(insert, 6000), line(post2, 6000, [ZERO])]);

  // Quotes.
  const q1 = await invoice(co, orbit, 'quote', 15, [line(setup, 1), line(print, 20000), line(insert, 20000), line(post2, 20000, [ZERO])]);
  await setDocumentStatus(q1.id, 'accepted');
  const q2 = await invoice(co, kestrel, 'quote', 6, [line(data, 10), line(pm, 8)]);
  await markSent(q2.id);
  await invoice(co, sunrise, 'quote', 2, [line(print, 5000), line(post2, 5000, [ZERO])]);

  // A credit note applied to the partially paid invoice.
  const credit = await invoice(co, brightside, 'credit', 25, [
    { ...line(print, 500), name: 'Reprint credit', description: 'Misprinted batch (500 letters)' },
  ]);
  await markSent(credit.id);
  await savePayment(
    createPayment(co.id, {
      clientId: brightside.id,
      date: addDaysISO(today(), -24),
      amount: credit.totals.total,
      currency: credit.currency,
      method: 'credit_note',
      creditId: credit.id,
      reference: credit.number,
      allocations: [{ documentId: partial.id, amount: credit.totals.total }],
    }),
  );

  // A monthly retainer.
  const monthStart = today().slice(0, 8) + '01';
  await db.recurring.put(
    createRecurring(co.id, {
      clientId: maple.id,
      name: 'Monthly patient mailing',
      frequency: 'monthly',
      startDate: addDaysISO(monthStart, 0),
      nextIssueDate: addDaysISO(monthStart, 31).slice(0, 8) + '01',
      dueDays: 14,
      template: {
        currency: co.currency,
        items: [
          { ...line(print, 1800), name: 'Appointment reminder letters — :MONTH :YEAR', description: 'Printed, folded and inserted' },
          line(post2, 1800, [ZERO]),
        ],
        discount: 0,
        discountType: 'percent',
        taxes: [],
        charges: [],
        pricesIncludeTax: false,
        poNumber: '',
        notes: 'Thank you for your continued business.',
        terms: '',
        footer: co.defaults.footer,
        privateNotes: '',
        templateId: null,
      },
    }),
  );

  return (await db.companies.get(company.id))!;
}
