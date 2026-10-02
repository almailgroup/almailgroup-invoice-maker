import { addMonths, addWeeks, addYears, getISOWeek } from 'date-fns';
import type { ISODate } from '@/db/types';
import { parseISODate } from './dates';

/**
 * Replaces date placeholders in recurring invoice text, relative to the
 * invoice date. Supported: :DAY, :WEEK, :MONTH, :MONTHYEAR, :QUARTER, :YEAR,
 * each optionally with an offset, e.g. ":MONTH+1" (next month) or ":YEAR-1".
 */
export function replaceDatePlaceholders(text: string, date: ISODate, locale = 'en-US'): string {
  if (!text.includes(':')) return text;
  const base = parseISODate(date);
  return text.replace(
    /:(MONTHYEAR|MONTH|QUARTER|YEAR|WEEK|DAY)([+-]\d+)?\b/g,
    (_m, token: string, off?: string) => {
      const offset = off ? Number(off) : 0;
      switch (token) {
        case 'DAY':
          return String(base.getDate() + offset);
        case 'WEEK':
          return String(getISOWeek(addWeeks(base, offset)));
        case 'MONTH':
          return new Intl.DateTimeFormat(locale, { month: 'long' }).format(addMonths(base, offset));
        case 'MONTHYEAR':
          return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
            addMonths(base, offset),
          );
        case 'QUARTER': {
          const d = addMonths(base, offset * 3);
          return `Q${Math.floor(d.getMonth() / 3) + 1}`;
        }
        case 'YEAR':
          return String(addYears(base, offset).getFullYear());
        default:
          return _m;
      }
    },
  );
}

export const DATE_PLACEHOLDERS = [
  { token: ':MONTH', example: 'October' },
  { token: ':MONTHYEAR', example: 'October 2026' },
  { token: ':QUARTER', example: 'Q4' },
  { token: ':YEAR', example: '2026' },
  { token: ':MONTH+1', example: 'next month' },
] as const;
