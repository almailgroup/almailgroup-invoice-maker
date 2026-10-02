import type { DiscountType, TaxLine } from '@/lib/calc';

export type { DiscountType, TaxLine };

export type ID = string;
/** Calendar date in `yyyy-MM-dd` form (no time zone). */
export type ISODate = string;
/** Full ISO 8601 timestamp. */
export type Timestamp = string;

export interface Address {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2 code, e.g. "US", "GB", "AE". */
  country: string;
}

export type DocumentType = 'invoice' | 'quote' | 'credit';

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'void';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced';
export type CreditStatus = 'draft' | 'sent' | 'partial' | 'applied' | 'void';
export type DocumentStatus = InvoiceStatus | QuoteStatus | CreditStatus;

export type NumberedEntity = DocumentType | 'payment' | 'client';

export type CounterReset = 'never' | 'yearly' | 'monthly';

export interface NumberingRule {
  /** e.g. "INV-{year}-{counter}". See lib/numbering.ts for placeholders. */
  pattern: string;
  /** Next counter value to use. */
  next: number;
  /** Minimum digits of the counter (zero padded). */
  padding: number;
  reset: CounterReset;
  /** Period key ("2026" or "2026-10") the counter was last used in; drives resets. */
  period: string;
}

export type DateFormat =
  | 'locale'
  | 'dd/MM/yyyy'
  | 'MM/dd/yyyy'
  | 'yyyy-MM-dd'
  | 'dd.MM.yyyy'
  | 'd MMM yyyy'
  | 'MMM d, yyyy';

export type PageSize = 'A4' | 'LETTER';

export interface DocumentDefaults {
  /** Days between issue date and due date for new invoices. */
  paymentTermsDays: number;
  /** Days a quote stays valid. */
  quoteValidDays: number;
  invoiceNotes: string;
  invoiceTerms: string;
  quoteNotes: string;
  quoteTerms: string;
  creditNotes: string;
  creditTerms: string;
  footer: string;
  pricesIncludeTax: boolean;
  /** Show per-line tax selection in the editor. */
  lineTaxes: boolean;
  /** Show document-level (whole invoice) taxes in the editor. */
  documentTaxes: boolean;
  /** Tax rates applied automatically to new lines (line mode) or new documents (document mode). */
  defaultTaxRateIds: ID[];
  pageSize: PageSize;
}

export interface Branding {
  /** Hex color used as the accent in templates, e.g. "#4f46e5". */
  accentColor: string;
  /** Default template id (see pdf/templates). */
  templateId: string;
  /** Logo as a data URL (PNG/JPEG), stored locally. */
  logo: string | null;
  /** Font override; null uses the template's own font pairing. */
  fontId: string | null;
}

export interface PaymentSettings {
  /** Free text shown on documents, e.g. bank name, IBAN, SWIFT. */
  bankDetails: string;
  /** Short instruction such as "Please quote the invoice number as reference." */
  instructions: string;
  /** Online payment link (Stripe Payment Link, PayPal.me, ...). */
  paymentLink: string;
  /** Print a QR code for the payment link on documents. */
  showQrCode: boolean;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailTemplates {
  invoice: EmailTemplate;
  quote: EmailTemplate;
  credit: EmailTemplate;
  reminder: EmailTemplate;
  payment: EmailTemplate;
}

export interface Company {
  id: ID;
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  /** Label for the tax number, e.g. "VAT No.", "TRN", "EIN", "GST No.". */
  taxIdLabel: string;
  taxId: string;
  registrationLabel: string;
  registrationNumber: string;
  address: Address;
  currency: string;
  /** BCP 47 locale used for number and date formatting, e.g. "en-US". */
  locale: string;
  dateFormat: DateFormat;
  branding: Branding;
  defaults: DocumentDefaults;
  numbering: Record<NumberedEntity, NumberingRule>;
  payment: PaymentSettings;
  /** Overrides for words printed on documents (see pdf/labels.ts). */
  labels: Record<string, string>;
  emailTemplates: EmailTemplates;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ClientContact {
  id: ID;
  name: string;
  email: string;
  phone: string;
  /** Receives documents by email. */
  primary: boolean;
}

export interface Client {
  id: ID;
  companyId: ID;
  number: string;
  name: string;
  contacts: ClientContact[];
  email: string;
  phone: string;
  website: string;
  taxId: string;
  address: Address;
  shippingAddress: Address | null;
  /** Overrides the company currency for this client's documents. */
  currency: string | null;
  /** Overrides the company payment terms (days). */
  paymentTermsDays: number | null;
  /** Taxes are not applied to this client's documents. */
  taxExempt: boolean;
  /** Internal notes, never printed. */
  notes: string;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TaxRate {
  id: ID;
  companyId: ID;
  name: string;
  rate: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Product {
  id: ID;
  companyId: ID;
  sku: string;
  name: string;
  description: string;
  unitPrice: number;
  unit: string;
  taxRateIds: ID[];
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LineItem {
  id: ID;
  kind: 'item' | 'heading';
  productId: ID | null;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountType: DiscountType;
  /** Snapshot of the taxes at the time they were added. */
  taxes: TaxLine[];
}

export interface Charge {
  id: ID;
  label: string;
  amount: number;
  taxes: TaxLine[];
}

export interface DocumentTotals {
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  paid: number;
  balance: number;
}

export interface InvoiceDocument {
  id: ID;
  companyId: ID;
  type: DocumentType;
  number: string;
  status: DocumentStatus;
  clientId: ID;
  issueDate: ISODate;
  /** Due date for invoices, "valid until" for quotes. */
  dueDate: ISODate | null;
  poNumber: string;
  currency: string;
  items: LineItem[];
  discount: number;
  discountType: DiscountType;
  /** Document-level taxes applied to all items. */
  taxes: TaxLine[];
  charges: Charge[];
  pricesIncludeTax: boolean;
  /** Deposit / partial payment requested up front (0 = none). */
  deposit: number;
  depositDueDate: ISODate | null;
  notes: string;
  terms: string;
  footer: string;
  /** Internal notes, never printed. */
  privateNotes: string;
  /** Template override; null uses the company default. */
  templateId: string | null;
  /** Cached result of the calculation; recomputed on every save. */
  totals: DocumentTotals;
  sentAt: Timestamp | null;
  paidAt: Timestamp | null;
  /** Quote this invoice was created from, or invoice a credit note refers to. */
  sourceId: ID | null;
  /** Invoice created from this quote. */
  convertedToId: ID | null;
  /** Recurring profile that generated this invoice. */
  recurringId: ID | null;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PaymentMethod =
  | 'bank_transfer'
  | 'card'
  | 'cash'
  | 'cheque'
  | 'paypal'
  | 'stripe'
  | 'mobile_money'
  | 'credit_note'
  | 'other';

export interface PaymentAllocation {
  documentId: ID;
  amount: number;
}

export interface Payment {
  id: ID;
  companyId: ID;
  clientId: ID;
  number: string;
  date: ISODate;
  amount: number;
  currency: string;
  method: PaymentMethod;
  /** Transaction / cheque reference. */
  reference: string;
  notes: string;
  allocations: PaymentAllocation[];
  /** Index helper: ids of the documents in `allocations`. */
  documentIds: ID[];
  /** Credit note consumed by this payment (method "credit_note"). */
  creditId: ID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Frequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannually'
  | 'yearly';

export type RecurringStatus = 'active' | 'paused' | 'completed';

export type RecurringTemplate = Pick<
  InvoiceDocument,
  | 'currency'
  | 'items'
  | 'discount'
  | 'discountType'
  | 'taxes'
  | 'charges'
  | 'pricesIncludeTax'
  | 'poNumber'
  | 'notes'
  | 'terms'
  | 'footer'
  | 'privateNotes'
  | 'templateId'
>;

export interface RecurringProfile {
  id: ID;
  companyId: ID;
  clientId: ID;
  /** Internal name, e.g. "Monthly mailing retainer". */
  name: string;
  frequency: Frequency;
  startDate: ISODate;
  /** Next date an invoice will be issued; null when completed. */
  nextIssueDate: ISODate | null;
  /** Number of invoices left to issue; null means no limit. */
  remainingCycles: number | null;
  /** Days between issue date and due date of generated invoices. */
  dueDays: number;
  /** Generated invoices are marked as sent instead of draft. */
  markSent: boolean;
  status: RecurringStatus;
  template: RecurringTemplate;
  issuedCount: number;
  lastIssuedAt: Timestamp | null;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ActivityEntity =
  | 'invoice'
  | 'quote'
  | 'credit'
  | 'payment'
  | 'client'
  | 'product'
  | 'recurring'
  | 'company';

export interface Activity {
  id: ID;
  companyId: ID;
  at: Timestamp;
  entity: ActivityEntity;
  entityId: ID;
  /** Document or client the event relates to, for timelines. */
  clientId: ID | null;
  documentId: ID | null;
  action: string;
  message: string;
}

export interface KeyValue {
  key: string;
  value: unknown;
}
