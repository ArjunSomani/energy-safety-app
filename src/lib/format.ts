import { PEOPLE_PER_TWH } from './engine';
import type { Band } from './types';

export const fmt = (n: number, digits = 3) =>
  new Intl.NumberFormat('en-US', { maximumSignificantDigits: digits }).format(n);

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const bandText = (b: Band, unit = '') =>
  `${fmt(b.low)}–${fmt(b.high)}${unit ? ` ${unit}` : ''}`;

export const nullableBandText = (
  b: { low: number | null; central: number | null; high: number | null },
  unit = '',
) => (b.low == null || b.central == null || b.high == null ? 'no comparable data' : bandText(b as Band, unit));

// Express a death rate (deaths/TWh) as its human-scale inverse: how many
// people's annual electricity corresponds to one death. Arithmetically
// identical to the rate — it adds no editorial content, only legibility.
// The low death rate gives the *high* people figure and vice-versa.
export const peoplePerDeath = (rate: Band) => ({
  low: rate.high > 0 ? PEOPLE_PER_TWH / rate.high : null,
  high: rate.low > 0 ? PEOPLE_PER_TWH / rate.low : null,
});

const roundPeople = (n: number) => {
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 2)} million`;
  if (n >= 1000) return `${fmt(Math.round(n / 1000) * 1000, 2)}`;
  return `${Math.round(n)}`;
};

// "one death per X–Y people's annual electricity", both bounds.
export const peoplePerDeathText = (rate: Band) => {
  const p = peoplePerDeath(rate);
  if (p.low == null || p.high == null) return null;
  return `${roundPeople(p.low)}–${roundPeople(p.high)} people`;
};

// Anchor a large land area (km²) to something a reader can hold: the nearest
// well-known country by area, plus its share of global land.
const GLOBAL_LAND_KM2 = 149_000_000;
const LAND_REFS: [string, number][] = [
  ['Belgium', 30_500],
  ['Ireland', 70_000],
  ['Iceland', 103_000],
  ['Greece', 132_000],
  ['the United Kingdom', 244_000],
  ['Germany', 357_000],
  ['Japan', 378_000],
  ['France', 552_000],
  ['Thailand', 513_000],
  ['Egypt', 1_010_000],
  ['Iran', 1_650_000],
  ['Mongolia', 1_560_000],
  ['India', 3_290_000],
];

export const landAnchor = (km2: number) => {
  if (!(km2 > 0)) return 'No land is used at this mix.';
  const nearest = LAND_REFS.reduce((best, ref) =>
    Math.abs(Math.log(ref[1] / km2)) < Math.abs(Math.log(best[1] / km2)) ? ref : best,
  );
  const share = (km2 / GLOBAL_LAND_KM2) * 100;
  const shareText = share >= 0.1 ? `about ${fmt(share, 2)}% of global land area` : 'a small fraction of global land area';
  return `At the high end, roughly the area of ${nearest[0]} — ${shareText}.`;
};

// Deaths measured against a fixed demand → people per death for a whole mix.
export const peoplePerDeathForMix = (deaths: Band, demandTwh: number) => {
  const people = demandTwh * PEOPLE_PER_TWH;
  const low = deaths.high > 0 ? people / deaths.high : null;
  const high = deaths.low > 0 ? people / deaths.low : null;
  if (low == null || high == null) return null;
  return `${roundPeople(low)}–${roundPeople(high)} people`;
};
