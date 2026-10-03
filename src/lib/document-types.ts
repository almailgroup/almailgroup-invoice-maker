import type { DocumentType, PurchaseDocumentType, SalesDocumentType } from '@/db/types';

export function isPurchaseType(type: DocumentType): type is PurchaseDocumentType {
  return type === 'bill' || type === 'vendor_credit';
}

/** Narrows to a sales document type; purchase documents have no PDF or email template. */
export function salesType(type: DocumentType): SalesDocumentType {
  if (isPurchaseType(type)) throw new Error(`${type} is not a sales document`);
  return type;
}
