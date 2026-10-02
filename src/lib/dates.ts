import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays } from 'date-fns';
import type { Frequency, ISODate } from '@/db/types';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1;
}

/** Parses `yyyy-MM-dd` as a local calendar date. */
export function parseISODate(value: ISODate): Date {
  const m = ISO_RE.exec(value);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDaysISO(value: ISODate, days: number): ISODate {
  return toISODate(addDays(parseISODate(value), days));
}

/** Calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISODate(to), parseISODate(from));
}

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bimonthly', label: 'Every 2 months' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannually', label: 'Every 6 months' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * Date of the n-th occurrence (0-based) of a schedule. Computed from the start
 * date each time so month-end dates don't drift (Jan 31 -> Feb 28 -> Mar 31).
 */
export function occurrenceDate(start: ISODate, frequency: Frequency, index: number): ISODate {
  const d = parseISODate(start);
  switch (frequency) {
    case 'weekly':
      return toISODate(addWeeks(d, index));
    case 'biweekly':
      return toISODate(addWeeks(d, index * 2));
    case 'monthly':
      return toISODate(addMonths(d, index));
    case 'bimonthly':
      return toISODate(addMonths(d, index * 2));
    case 'quarterly':
      return toISODate(addMonths(d, index * 3));
    case 'semiannually':
      return toISODate(addMonths(d, index * 6));
    case 'yearly':
      return toISODate(addYears(d, index));
  }
}
