import Decimal from 'decimal.js-light';

Decimal.config({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type Numeric = number | string | Decimal;

export function dec(value: Numeric | null | undefined): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === '') return new Decimal(0);
  if (typeof value === 'number') {
    // String(n) gives the shortest round-trip representation, so 0.1 stays 0.1.
    return Number.isFinite(value) ? new Decimal(String(value)) : new Decimal(0);
  }
  const trimmed = value.trim();
  try {
    return new Decimal(trimmed === '' ? 0 : trimmed);
  } catch {
    return new Decimal(0);
  }
}

/** Rounds half away from zero, which is what invoices conventionally use. */
export function round(value: Numeric, places: number): number {
  const n = dec(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toNumber();
  return Object.is(n, -0) ? 0 : n;
}

export function sum(values: Numeric[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0));
}

const precisionCache = new Map<string, number>();

/** Number of minor-unit digits for an ISO 4217 currency (USD 2, JPY 0, KWD 3). */
export function currencyPrecision(currency: string): number {
  const code = currency.toUpperCase();
  const cached = precisionCache.get(code);
  if (cached !== undefined) return cached;
  let digits: number;
  try {
    digits =
      new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    digits = 2;
  }
  precisionCache.set(code, digits);
  return digits;
}

/** Parses user input such as "1,234.50" or "12.5%" into a number (0 when invalid). */
export function parseAmount(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (!input) return 0;
  const cleaned = input.replace(/[\s,%]/g, '').replace(/[^\d.+-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Converts an amount to integer minor units (pence, fils, cents), rounding
 * half away from zero. Ledger sums use these so they are exact.
 */
export function toMinor(value: Numeric, places: number): number {
  const n = dec(value)
    .times(new Decimal(10).pow(places))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
  return Object.is(n, -0) ? 0 : n;
}

/** Converts integer minor units back to an amount with `places` decimals. */
export function fromMinor(minor: number, places: number): number {
  const n = new Decimal(minor).dividedBy(new Decimal(10).pow(places)).toNumber();
  return Object.is(n, -0) ? 0 : n;
}
