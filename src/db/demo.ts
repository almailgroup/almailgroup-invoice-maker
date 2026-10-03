import { db } from './db';
import { createClient, createProduct, createRecurring } from './defaults';
import { draftDocument, markSent, saveDocument, setDocumentStatus } from './documents';
import { createPayment, savePayment } from './payments';
import { saveClient, saveProduct, setupCompany } from './records';
import { createJournal, loadLedger, newJournalLine, saveJournal } from './accounting';
import { createExpense, saveExpense } from './purchases';
import { fileVatReturn, recordVatPayment } from './vat';
import { importStatement, matchTransaction } from './banking';
import { bookEntries } from '@/lib/banking/match';
import type { StatementLine } from '@/lib/banking/statement';
import { fromMinor } from '@/lib/money';
import { vatDueDate, vatPeriodOf, vatPeriods } from '@/lib/accounting/vat';
import type {
  Account,
  Client,
  Company,
  InvoiceDocument,
  LineItem,
  Product,
  TaxLine,
} from './types';
import { addDaysISO, parseISODate, toISODate, today } from '@/lib/dates';
import { shortId } from '@/lib/ids';
import { regionDefaults } from '@/lib/regions';

const VAT: TaxLine = { name: 'VAT', rate: 20, kind: 'standard' };
const FIVE: TaxLine = { name: 'VAT', rate: 5, kind: 'reduced' };
const ZERO: TaxLine = { name: 'VAT', rate: 0, kind: 'zero' };
const REVERSE: TaxLine = { name: 'VAT', rate: 20, kind: 'reverse_charge' };
/** For costs VAT doesn't apply to, or can't be reclaimed on (like client entertaining). */
const NO_VAT: TaxLine = { name: 'No VAT', rate: 0, kind: 'out_of_scope' };

const CLIENTS: Partial<Client>[] = [
  {
    name: 'Brightside Retail Group',
    contacts: [
      {
        id: 'c1',
        name: 'Sarah Mitchell',
        email: 'accounts@brightside.example',
        phone: '+44 113 555 0199',
        primary: true,
      },
    ],
    address: {
      line1: '88 Commerce Way',
      line2: 'Floor 3',
      city: 'Leeds',
      state: '',
      postalCode: 'LS1 4AP',
      country: 'GB',
    },
    taxId: 'GB 987 6543 21',
  },
  {
    name: 'Harbor & Pine Legal LLP',
    contacts: [
      {
        id: 'c2',
        name: 'James Okafor',
        email: 'finance@harborpine.example',
        phone: '+44 20 5550 1188',
        primary: true,
      },
    ],
    address: {
      line1: '14 Chancery Lane',
      line2: '',
      city: 'London',
      state: '',
      postalCode: 'WC2A 1PL',
      country: 'GB',
    },
  },
  {
    name: 'Maple Street Clinics',
    contacts: [
      {
        id: 'c3',
        name: 'Dr. Aisha Rahman',
        email: 'admin@maplestreet.example',
        phone: '+44 161 555 0177',
        primary: true,
      },
    ],
    address: {
      line1: '3 Maple Street',
      line2: '',
      city: 'Manchester',
      state: '',
      postalCode: 'M4 6BF',
      country: 'GB',
    },
    paymentTermsDays: 14,
  },
  {
    name: 'Orbit Logistics Ltd',
    contacts: [
      {
        id: 'c4',
        name: 'Tom Becker',
        email: 'ap@orbitlogistics.example',
        phone: '+44 121 555 0123',
        primary: true,
      },
    ],
    address: {
      line1: 'Unit 9, Gateway Park',
      line2: '',
      city: 'Birmingham',
      state: '',
      postalCode: 'B7 4AA',
      country: 'GB',
    },
  },
  {
    name: 'Sunrise Charity Trust',
    contacts: [
      {
        id: 'c5',
        name: 'Grace Lin',
        email: 'hello@sunrisetrust.example',
        phone: '',
        primary: true,
      },
    ],
    address: {
      line1: '22 Hope Street',
      line2: '',
      city: 'Liverpool',
      state: '',
      postalCode: 'L1 9BQ',
      country: 'GB',
    },
    taxExempt: true,
  },
  {
    name: 'Kestrel Software GmbH',
    contacts: [
      {
        id: 'c6',
        name: 'Lena Vogel',
        email: 'billing@kestrel.example',
        phone: '+49 30 5550 4411',
        primary: true,
      },
    ],
    address: {
      line1: 'Torstraße 115',
      line2: '',
      city: 'Berlin',
      state: '',
      postalCode: '10119',
      country: 'DE',
    },
    currency: 'EUR',
    taxId: 'DE 123456789',
  },
];

/** Suppliers. Orbit Logistics (a client) also becomes a vendor further down. */
const VENDORS: Partial<Client>[] = [
  {
    name: 'PaperMill Supplies Ltd',
    contacts: [
      {
        id: 'v1',
        name: 'Priya Shah',
        email: 'orders@papermill.example',
        phone: '+44 1274 555 0142',
        primary: true,
      },
    ],
    address: {
      line1: '5 Mill Lane',
      line2: '',
      city: 'Bradford',
      state: '',
      postalCode: 'BD1 3AA',
      country: 'GB',
    },
    taxId: 'GB 555 1212 33',
    paymentTermsDays: 30,
  },
  {
    name: 'Swiftpost Business Services',
    contacts: [
      {
        id: 'v2',
        name: 'Account team',
        email: 'billing@swiftpost.example',
        phone: '+44 345 555 0100',
        primary: true,
      },
    ],
    address: {
      line1: '1 Sorting Office Road',
      line2: '',
      city: 'Warrington',
      state: '',
      postalCode: 'WA1 1AA',
      country: 'GB',
    },
    paymentTermsDays: 30,
  },
  {
    name: 'Northern Power & Gas',
    contacts: [
      {
        id: 'v3',
        name: 'Business accounts',
        email: 'business@northernpower.example',
        phone: '',
        primary: true,
      },
    ],
    address: {
      line1: 'PO Box 4410',
      line2: '',
      city: 'Newcastle',
      state: '',
      postalCode: 'NE1 4ZZ',
      country: 'GB',
    },
    paymentTermsDays: 14,
  },
  {
    name: 'Peak & Partners Accountants',
    contacts: [
      {
        id: 'v4',
        name: 'Daniel Peak',
        email: 'daniel@peakpartners.example',
        phone: '+44 161 555 0190',
        primary: true,
      },
    ],
    address: {
      line1: '40 King Street',
      line2: '',
      city: 'Manchester',
      state: '',
      postalCode: 'M2 4WU',
      country: 'GB',
    },
    taxId: 'GB 777 3344 55',
    paymentTermsDays: 30,
  },
  {
    name: 'Cloudline Software Ltd',
    contacts: [
      {
        id: 'v5',
        name: 'Subscriptions',
        email: 'invoices@cloudline.example',
        phone: '',
        primary: true,
      },
    ],
    address: {
      line1: '2 Harbour Exchange',
      line2: '',
      city: 'London',
      state: '',
      postalCode: 'E14 9GE',
      country: 'GB',
    },
    paymentTermsDays: 0,
  },
];

const PRODUCTS: Partial<Product>[] = [
  {
    sku: 'DM-SETUP',
    name: 'Direct mail campaign setup',
    description: 'Artwork checks, data merge and proofs',
    unitPrice: 450,
    unit: 'job',
  },
  {
    sku: 'PR-A4C',
    name: 'A4 letter printing — full colour',
    description: 'Double-sided, 100gsm silk',
    unitPrice: 0.085,
    unit: 'pcs',
  },
  {
    sku: 'FUL-INS',
    name: 'Envelope inserting & sealing',
    description: 'C5 window envelopes, machine inserted',
    unitPrice: 0.032,
    unit: 'pcs',
  },
  {
    sku: 'POST-2C',
    name: 'Postage — 2nd class letter',
    description: 'Pre-sorted by postcode',
    unitPrice: 0.537,
    unit: 'pcs',
  },
  {
    sku: 'POST-1C',
    name: 'Postage — 1st class letter',
    description: '',
    unitPrice: 0.85,
    unit: 'pcs',
  },
  {
    sku: 'CR-NXT',
    name: 'Courier — next-day delivery',
    description: 'Tracked, signed for',
    unitPrice: 18.5,
    unit: 'parcel',
  },
  {
    sku: 'DATA-CL',
    name: 'Data cleansing & deduplication',
    description: 'Per 1,000 records',
    unitPrice: 12,
    unit: 'batch',
  },
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

/** EUR→GBP rates for the demo's euro client (paid later at a slightly better rate). */
const EUR_RATE_AT_INVOICE = 0.86;
const EUR_RATE_AT_PAYMENT = 0.87;

/** Opening capital and monthly rent, so the statements have some substance. */
async function bookkeeping(company: Company) {
  const accounts = await db.accounts.where('companyId').equals(company.id).toArray();
  const bank = accounts.find((a) => a.role === 'bank')!;
  const capital = accounts.find((a) => a.role === 'capital')!;
  const rent =
    accounts.find((a) => a.code === '7000') ?? accounts.find((a) => a.role === 'expense')!;
  await saveJournal(
    createJournal(company.id, {
      date: addDaysISO(today(), -200),
      reference: 'Share capital introduced',
      lines: [
        newJournalLine({
          accountId: bank.id,
          debit: 15000,
          description: 'Funds from shareholders',
        }),
        newJournalLine({ accountId: capital.id, credit: 15000, description: 'Ordinary shares' }),
      ],
    }),
  );
  const month = parseISODate(today());
  for (let back = 5; back >= 0; back--) {
    const first = new Date(month.getFullYear(), month.getMonth() - back, 1);
    const date = toISODate(first);
    const label = first.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    await saveJournal(
      createJournal(company.id, {
        date,
        reference: `Workshop rent — ${label}`,
        lines: [
          newJournalLine({ accountId: rent.id, debit: 1250 }),
          newJournalLine({ accountId: bank.id, credit: 1250 }),
        ],
      }),
    );
  }
}

function billLine(
  accountId: string,
  name: string,
  quantity: number,
  unitPrice: number,
  taxes: TaxLine[] = [VAT],
): LineItem {
  return {
    id: shortId(),
    kind: 'item',
    productId: null,
    name,
    description: '',
    quantity,
    unit: '',
    unitPrice,
    discount: 0,
    discountType: 'percent',
    taxes,
    accountId,
  };
}

async function bill(
  company: Company,
  vendor: Client,
  type: 'bill' | 'vendor_credit',
  daysAgo: number,
  vendorReference: string,
  items: LineItem[],
  status: 'draft' | 'sent' = 'sent',
): Promise<InvoiceDocument> {
  const draft = await draftDocument(company, type, vendor);
  const issueDate = addDaysISO(today(), -daysAgo);
  return saveDocument({
    ...draft,
    issueDate,
    dueDate:
      type === 'bill'
        ? addDaysISO(issueDate, vendor.paymentTermsDays ?? company.defaults.paymentTermsDays)
        : null,
    vendorReference,
    items,
    status,
  });
}

async function payBill(
  company: Company,
  doc: InvoiceDocument,
  amount: number,
  daysAgo: number,
  method: 'bank_transfer' | 'card' = 'bank_transfer',
) {
  await savePayment(
    createPayment(company.id, {
      direction: 'out',
      clientId: doc.clientId,
      date: addDaysISO(today(), -daysAgo),
      amount,
      currency: doc.currency,
      method,
      reference: doc.vendorReference ?? '',
      allocations: [{ documentId: doc.id, amount }],
    }),
  );
}

/** Supplier bills, what was paid on them, and everyday expenses. */
async function purchases(company: Company, alsoVendor: Client) {
  const accounts = await db.accounts.where('companyId').equals(company.id).toArray();
  const byCode = (code: string) =>
    (accounts.find((a) => a.code === code) ?? accounts.find((a) => a.role === 'expense')!).id;
  const role = (name: Account['role']) => accounts.find((a) => a.role === name)!.id;

  const vendors: Client[] = [];
  for (const v of VENDORS) {
    vendors.push(
      await saveClient(createClient(company.id, { ...v, isCustomer: false, isVendor: true })),
    );
  }
  const [paperMill, swiftpost, power, peak, cloudline] = vendors;
  const orbit = await saveClient({ ...alsoVendor, isVendor: true });

  const paper1 = await bill(company, paperMill, 'bill', 150, 'PM-20418', [
    billLine(byCode('5000'), 'Silk 100gsm A4 — 20 boxes', 20, 84),
  ]);
  await payBill(company, paper1, paper1.totals.total, 125);

  const post1 = await bill(company, swiftpost, 'bill', 140, 'SP-77812', [
    billLine(byCode('5200'), 'Pre-sorted postage — Brightside campaign', 8000, 0.41, [ZERO]),
  ]);
  await payBill(company, post1, post1.totals.total, 118);

  const energy = await bill(company, power, 'bill', 70, 'NPG-118204', [
    billLine(byCode('7100'), 'Electricity — quarter to date', 1, 612.4, [FIVE]),
  ]);
  await payBill(company, energy, energy.totals.total, 58);

  const paper2 = await bill(company, paperMill, 'bill', 60, 'PM-20977', [
    billLine(byCode('5000'), 'Silk 100gsm A4 — 40 boxes', 40, 84),
    billLine(byCode('5000'), 'C5 window envelopes — per 1,000', 25, 38),
  ]);
  await payBill(company, paper2, 2000, 30);

  // Damaged stock sent back: a vendor credit, used against the same bill.
  const returned = await bill(company, paperMill, 'vendor_credit', 40, 'PM-CN-311', [
    billLine(byCode('5000'), 'Damaged boxes returned', 3, 84),
  ]);
  await savePayment(
    createPayment(company.id, {
      direction: 'out',
      clientId: paperMill.id,
      date: addDaysISO(today(), -39),
      amount: returned.totals.total,
      currency: returned.currency,
      method: 'credit_note',
      creditId: returned.id,
      reference: returned.number,
      allocations: [{ documentId: paper2.id, amount: returned.totals.total }],
    }),
  );

  await bill(company, swiftpost, 'bill', 48, 'SP-80144', [
    billLine(byCode('5200'), 'Pre-sorted postage — Brightside mailing', 12500, 0.41, [ZERO]),
  ]);
  await bill(company, peak, 'bill', 35, 'PK-2291', [
    billLine(byCode('7800'), 'Year-end accounts preparation', 1, 1450),
  ]);
  await bill(company, orbit, 'bill', 25, 'OL-5520', [
    billLine(byCode('5100'), 'Courier subcontracting — overflow deliveries', 1, 380),
  ]);
  await bill(
    company,
    cloudline,
    'bill',
    2,
    'CL-INV-0093',
    [billLine(byCode('7600'), 'Design software — annual licence', 1, 576)],
    'draft',
  );

  const card = role('credit_card');
  const cash = role('cash');
  // A float for the petty cash tin, drawn from the bank.
  await saveJournal(
    createJournal(company.id, {
      date: addDaysISO(today(), -90),
      reference: 'Petty cash float',
      lines: [
        newJournalLine({ accountId: cash, debit: 150, description: 'Cash for the petty cash tin' }),
        newJournalLine({ accountId: role('bank'), credit: 150 }),
      ],
    }),
  );
  const spent: [
    daysAgo: number,
    code: string,
    text: string,
    amount: number,
    taxes: TaxLine[],
    from: string,
  ][] = [
    [80, '7400', 'Train to Leeds — Brightside meeting', 86.4, [ZERO], card],
    [55, '7500', 'Printer toner', 45.6, [VAT], card],
    [33, '8150', 'Client lunch — Harbor & Pine', 64.8, [NO_VAT], card],
    [12, '7450', 'Parking — Manchester city centre', 12, [NO_VAT], cash],
    [6, '7500', 'Stationery', 18.99, [VAT], cash],
    // Bought from abroad: the VAT is accounted for under the reverse charge.
    [40, '7700', 'Online advertising — overseas platform', 250, [REVERSE], card],
  ];
  for (const [daysAgo, code, description, amount, taxes, paidFromAccountId] of spent) {
    await saveExpense(
      createExpense(company.id, {
        date: addDaysISO(today(), -daysAgo),
        accountId: byCode(code),
        description,
        amount,
        taxes,
        currency: company.currency,
        paidFromAccountId,
      }),
    );
  }
}

async function invoice(
  company: Company,
  client: Client,
  type: InvoiceDocument['type'],
  daysAgo: number,
  items: LineItem[],
): Promise<InvoiceDocument> {
  const draft = await draftDocument(company, type, client);
  if (draft.currency !== company.currency) draft.exchangeRate = EUR_RATE_AT_INVOICE;
  const issueDate = addDaysISO(today(), -daysAgo);
  const terms = client.paymentTermsDays ?? company.defaults.paymentTermsDays;
  return saveDocument({
    ...draft,
    issueDate,
    dueDate:
      type === 'invoice'
        ? addDaysISO(issueDate, terms)
        : type === 'quote'
          ? addDaysISO(issueDate, 30)
          : null,
    items,
  });
}

async function pay(
  company: Company,
  doc: InvoiceDocument,
  amount: number,
  daysAgo: number,
  method: 'bank_transfer' | 'card' = 'bank_transfer',
) {
  await savePayment(
    createPayment(company.id, {
      clientId: doc.clientId,
      date: addDaysISO(today(), -daysAgo),
      amount,
      currency: doc.currency,
      exchangeRate: doc.currency !== company.currency ? EUR_RATE_AT_PAYMENT : 1,
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
    [
      db.companies,
      db.clients,
      db.products,
      db.taxRates,
      db.documents,
      db.payments,
      db.recurring,
      db.activities,
      db.accounts,
      db.journals,
      db.expenses,
      db.vatReturns,
      db.bankTransactions,
      db.meta,
    ],
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
      address: {
        line1: 'Unit 4, Riverside Business Park',
        line2: 'Kings Road',
        city: 'Manchester',
        state: '',
        postalCode: 'M1 2AB',
        country: 'GB',
      },
      currency: region.currency,
      locale: region.locale,
      dateFormat: 'd MMM yyyy',
      payment: {
        bankDetails:
          'Northwind Bank plc · Sort code 20-00-00 · Account 12345678\nIBAN GB29 NWBK 6016 1331 9268 19 · BIC NWBKGB2L',
        instructions: 'Please use the invoice number as the payment reference.',
        paymentLink: 'https://pay.example.com/northwind',
        showQrCode: true,
      },
    },
    [VAT, FIVE, ZERO, REVERSE, NO_VAT],
  );
  const fresh = (await db.companies.get(company.id))!;
  fresh.defaults.invoiceTerms =
    'Payment is due within 30 days. Late payments may incur interest at 1.5% per month.';
  fresh.defaults.footer =
    'Northwind Mail Services Ltd · Registered in England & Wales No. 09876543';
  await db.companies.put(fresh);

  const clients: Client[] = [];
  for (const c of CLIENTS) clients.push(await saveClient(createClient(company.id, c)));
  const products: Product[] = [];
  for (const p of PRODUCTS) {
    const taxRates = await db.taxRates.where('companyId').equals(company.id).toArray();
    const zero = taxRates.find((t) => t.kind === 'zero');
    const standard = taxRates.find((t) => t.kind === 'standard' && t.rate === 20);
    const taxRateIds = p.sku?.startsWith('POST')
      ? zero
        ? [zero.id]
        : []
      : standard
        ? [standard.id]
        : [];
    products.push(await saveProduct(createProduct(company.id, { ...p, taxRateIds })));
  }
  const [setup, print, insert, post2, post1, courier, data, pm] = products;
  const [brightside, harbor, maple, orbit, sunrise, kestrel] = clients;
  await bookkeeping((await db.companies.get(company.id))!);
  await purchases((await db.companies.get(company.id))!, orbit);
  const co = (await db.companies.get(company.id))!;

  // Invoices across the last six months.
  const paidOld = await invoice(co, brightside, 'invoice', 160, [
    line(setup, 1),
    line(print, 8000),
    line(insert, 8000),
    line(post2, 8000, [ZERO]),
  ]);
  await markSent(paidOld.id);
  await pay(co, paidOld, paidOld.totals.total, 140);

  const paid2 = await invoice(co, harbor, 'invoice', 128, [
    line(print, 2500),
    line(post1, 2500, [ZERO]),
    line(pm, 3),
  ]);
  await markSent(paid2.id);
  await pay(co, paid2, paid2.totals.total, 101, 'card');

  const paid3 = await invoice(co, orbit, 'invoice', 96, [
    line(courier, 42),
    line(pm, 4, [VAT], 10),
  ]);
  await markSent(paid3.id);
  await pay(co, paid3, paid3.totals.total, 70);

  const paid4 = await invoice(co, maple, 'invoice', 75, [
    line(data, 6),
    line(print, 4200),
    line(insert, 4200),
    line(post2, 4200, [ZERO]),
  ]);
  await markSent(paid4.id);
  await pay(co, paid4, paid4.totals.total, 60);

  const partial = await invoice(co, brightside, 'invoice', 52, [
    line(setup, 1),
    line(print, 12500),
    line(insert, 12500),
    line(post2, 12500, [ZERO]),
    line(pm, 6, [VAT], 10),
  ]);
  await markSent(partial.id);
  await pay(co, partial, 5000, 30);

  const overdue = await invoice(co, harbor, 'invoice', 48, [
    line(courier, 12),
    line(print, 1500),
    line(post1, 1500, [ZERO]),
  ]);
  await markSent(overdue.id);

  const kestrelInv = await invoice(co, kestrel, 'invoice', 34, [line(setup, 1), line(data, 3)]);
  await markSent(kestrelInv.id);
  await pay(co, kestrelInv, kestrelInv.totals.total, 20, 'card');

  const sunriseInv = await invoice(co, sunrise, 'invoice', 21, [
    line(print, 3000),
    line(insert, 3000),
    line(post2, 3000, [ZERO]),
  ]);
  await markSent(sunriseInv.id);

  const recent = await invoice(co, orbit, 'invoice', 9, [line(courier, 28), line(pm, 2)]);
  await markSent(recent.id);

  const recentMaple = await invoice(co, maple, 'invoice', 4, [line(data, 2), line(pm, 3)]);
  await markSent(recentMaple.id);

  await invoice(co, brightside, 'invoice', 1, [
    line(print, 6000),
    line(insert, 6000),
    line(post2, 6000, [ZERO]),
  ]);

  // Quotes.
  const q1 = await invoice(co, orbit, 'quote', 15, [
    line(setup, 1),
    line(print, 20000),
    line(insert, 20000),
    line(post2, 20000, [ZERO]),
  ]);
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
          {
            ...line(print, 1800),
            name: 'Appointment reminder letters — :MONTH :YEAR',
            description: 'Printed, folded and inserted',
          },
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

  await vatHistory((await db.companies.get(company.id))!);
  await bankStatement((await db.companies.get(company.id))!);
  return (await db.companies.get(company.id))!;
}

/**
 * The last six weeks of the bank statement: what the books already hold
 * (matched), plus a few lines still to deal with.
 */
async function bankStatement(company: Company) {
  const { accounts, lines } = await loadLedger(company);
  const bank = accounts.find((a) => a.role === 'bank')!;
  const clients = await db.clients.where('companyId').equals(company.id).toArray();
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const from = addDaysISO(today(), -42);
  const entries = bookEntries(lines, bank.id)
    .filter((e) => e.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date));
  const statement: (StatementLine & { entry?: (typeof entries)[number] })[] = entries.map(
    (entry) => ({
      date: entry.date,
      description: `${(entry.contactId ? names.get(entry.contactId) : '') || entry.description} ${
        entry.source === 'payment' ? entry.number : ''
      }`
        .trim()
        .toUpperCase(),
      reference: '',
      amount: fromMinor(entry.amount, 2),
      balance: null,
      entry,
    }),
  );
  // Still to match: a client paying an open invoice, the card bill and a bank fee.
  const open = (await db.documents.where('companyId').equals(company.id).toArray())
    .filter((d) => d.type === 'invoice' && d.status === 'sent' && d.currency === company.currency)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0];
  if (open) {
    statement.push({
      date: addDaysISO(today(), -2),
      description: `${(names.get(open.clientId) ?? '').toUpperCase()} ${open.number}`,
      reference: 'FPS',
      amount: open.totals.balance,
      balance: null,
    });
  }
  statement.push(
    {
      date: addDaysISO(today(), -5),
      description: 'COMPANY CREDIT CARD REPAYMENT',
      reference: 'DD',
      amount: -150,
      balance: null,
    },
    {
      date: addDaysISO(today(), -3),
      description: 'MONTHLY ACCOUNT FEE',
      reference: '',
      amount: -12.5,
      balance: null,
    },
  );
  statement.sort((a, b) => a.date.localeCompare(b.date));
  // Running balance, starting from the books on the day before.
  let balance = lines
    .filter((l) => l.accountId === bank.id && l.date < from)
    .reduce((s, l) => s + l.amount, 0);
  for (const line of statement) {
    balance += Math.round(line.amount * 100);
    line.balance = fromMinor(balance, 2);
  }
  const { transactions } = await importStatement(
    company.id,
    bank.id,
    statement.map(({ date, description, reference, amount, balance: b }) => ({
      date,
      description,
      reference,
      amount,
      balance: b,
    })),
    'Demo statement',
  );
  for (const tx of transactions) {
    const entry = statement[tx.position].entry;
    if (entry) await matchTransaction(tx.id, { source: entry.source, id: entry.id });
  }
}

/** Files and pays the VAT returns before the latest one, which is left to file. */
async function vatHistory(company: Company) {
  const schedule = { frequency: 'quarterly' as const, startMonth: 1 };
  const latest = vatPeriodOf(addDaysISO(vatPeriodOf(today(), schedule).start, -1), schedule);
  const { accounts, lines } = await loadLedger(company);
  const bank = accounts.find((a) => a.role === 'bank')!;
  const first = lines.reduce((min, l) => (l.date < min ? l.date : min), today());
  for (const period of vatPeriods(schedule, first, addDaysISO(latest.start, -1))) {
    const record = await fileVatReturn(company.id, period, {
      filedOn: addDaysISO(period.end, 21),
      reference: '',
      lock: false,
    });
    if (record.net !== 0) {
      await recordVatPayment(record.id, { date: vatDueDate(period, 'uk'), accountId: bank.id });
    }
  }
}
