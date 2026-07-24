import type { Band } from './types';

export const fmt = (n: number, digits = 2) =>
  new Intl.NumberFormat('en-US', { maximumSignificantDigits: digits }).format(n);

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const bandText = (b: Band, unit = '') =>
  `${fmt(b.low)}–${fmt(b.high)}${unit ? ` ${unit}` : ''}`;

export const nullableBandText = (
  b: { low: number | null; central: number | null; high: number | null },
  unit = '',
) => (b.low == null || b.central == null || b.high == null ? 'no comparable data' : bandText(b as Band, unit));
