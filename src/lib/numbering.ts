import type { CounterReset, ISODate, NumberingRule } from '@/db/types';

export const NUMBER_PLACEHOLDERS = [
  { token: '{counter}', description: 'Sequential counter, zero padded (required)' },
  { token: '{year}', description: 'Year of the document date, e.g. 2026' },
  { token: '{yy}', description: 'Two-digit year, e.g. 26' },
  { token: '{month}', description: 'Two-digit month, e.g. 09' },
  { token: '{day}', description: 'Two-digit day, e.g. 05' },
  { token: '{client}', description: "The client's number" },
] as const;

export function periodKey(reset: CounterReset, date: ISODate): string {
  if (reset === 'yearly') return date.slice(0, 4);
  if (reset === 'monthly') return date.slice(0, 7);
  return '';
}

/** Counter to use for a document dated `date`, honouring yearly/monthly resets. */
export function currentCounter(rule: NumberingRule, date: ISODate): number {
  const key = periodKey(rule.reset, date);
  if (rule.reset !== 'never' && rule.period && rule.period !== key) return 1;
  return Math.max(1, Math.trunc(rule.next) || 1);
}

export function formatNumber(
  rule: Pick<NumberingRule, 'pattern' | 'padding'>,
  counter: number,
  date: ISODate,
  clientNumber = '',
): string {
  const padded = String(counter).padStart(Math.max(0, Math.min(12, rule.padding)), '0');
  let pattern = rule.pattern.trim() || '{counter}';
  if (!/\{counter\}/i.test(pattern)) pattern = `${pattern}{counter}`;
  const [year = '', month = '', day = ''] = date.split('-');
  const values: Record<string, string> = {
    counter: padded,
    year,
    yy: year.slice(-2),
    month,
    day,
    client: clientNumber,
  };
  return pattern.replace(/\{(\w+)\}/g, (match, token: string) => {
    const value = values[token.toLowerCase()];
    return value === undefined ? match : value;
  });
}

/**
 * Picks the next free number for a document dated `date`. Numbers already in
 * use (e.g. typed in manually) are skipped. Returns the number and the rule
 * to store back on the company.
 */
export function allocateNumber(
  rule: NumberingRule,
  date: ISODate,
  isTaken: (candidate: string) => boolean,
  clientNumber = '',
): { number: string; rule: NumberingRule } {
  let counter = currentCounter(rule, date);
  let number = formatNumber(rule, counter, date, clientNumber);
  for (let guard = 0; isTaken(number) && guard < 100000; guard++) {
    counter += 1;
    number = formatNumber(rule, counter, date, clientNumber);
  }
  return {
    number,
    rule: { ...rule, next: counter + 1, period: periodKey(rule.reset, date) },
  };
}

export function previewNumber(rule: NumberingRule, date: ISODate, clientNumber = 'C-0001'): string {
  return formatNumber(rule, currentCounter(rule, date), date, clientNumber);
}
