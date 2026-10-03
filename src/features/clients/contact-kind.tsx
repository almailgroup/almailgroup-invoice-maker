import { Truck, Users } from 'lucide-react';
import type { Client } from '@/db/types';

/** Clients buy from you; vendors sell to you. One contact can be both. */
export type ContactKind = 'customer' | 'vendor';

/** Wording and routes for the two kinds of contact. */
export const CONTACT_COPY = {
  customer: {
    title: 'Clients',
    description: 'The people and companies you bill.',
    base: '/clients',
    singular: 'client',
    plural: 'clients',
    column: 'Client',
    docType: 'invoice' as const,
    amountLabel: 'Invoiced',
    empty: 'Add the people and companies you work with to invoice them in seconds.',
    icon: <Users />,
  },
  vendor: {
    title: 'Vendors',
    description: 'The suppliers you buy from.',
    base: '/vendors',
    singular: 'vendor',
    plural: 'vendors',
    column: 'Vendor',
    docType: 'bill' as const,
    amountLabel: 'Billed',
    empty: 'Add the suppliers you buy from to record their bills and what you pay them.',
    icon: <Truck />,
  },
};

/** Role flags for a new contact of this kind. */
export function contactRoles(kind: ContactKind): Pick<Client, 'isCustomer' | 'isVendor'> {
  return kind === 'vendor' ? { isCustomer: false, isVendor: true } : { isCustomer: true };
}
