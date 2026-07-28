// Valuing mortality — the "uncounted cost" lens.
//
// Deaths per TWh answer "how dangerous," but not "how much is that danger
// worth against the electricity bill, or against a carbon price." To ask that
// you need a dollar figure on a statistical death. US regulators already set
// one: HHS publishes a VSL *range* (low / central / high), not a point. We
// present that published range and let the reader choose within it — the choice
// is a moral one this site does not make. A mortality price and a carbon price
// are the same kind of object: both attach a dollar figure to a harm the
// electricity market never charges for.
import vsl from '@/data/vsl.json';
import type { Band } from './types';

export type VslPreset = { key: string; label: string; value: number };

export const VSL_PRESETS = vsl.presets as VslPreset[];
export const VSL_MIN = vsl.min;
export const VSL_MAX = vsl.max;
export const VSL_STEP = vsl.step;
export const VSL_ESCALATION_YEARLY = vsl.escalationYearly;
export const VSL_SOURCE = vsl.source;
export const VSL_UNIT = vsl.unit;
export const VSL_NOTE = vsl.note;

export const VSL_CENTRAL = VSL_PRESETS.find((p) => p.key === 'central')?.value ?? 14_100_000;

const MWH_PER_TWH = 1_000_000;

// The mortality cost of one MWh of a source: its death rate (deaths/TWh) valued
// at the chosen VSL. deaths/TWh ÷ 1e6 = deaths/MWh, times $/death = $/MWh. This
// is the figure directly comparable to LCOE — the price the electricity market
// does charge — so a reader can see whether the uncounted cost is larger or
// smaller than the bill.
export const mortalityCostPerMwh = (deathsPerTwh: number, vslValue: number) =>
  (deathsPerTwh / MWH_PER_TWH) * vslValue;

// Same, as a band, so uncertainty propagates: the death-rate band times a single
// chosen VSL. (Choosing a different VSL is a second, separate range.)
export const mortalityCostPerMwhBand = (rate: Band, vslValue: number): Band => ({
  low: mortalityCostPerMwh(rate.low, vslValue),
  central: mortalityCostPerMwh(rate.central, vslValue),
  high: mortalityCostPerMwh(rate.high, vslValue),
});

// The annual dollar cost of a number of deaths at the chosen VSL.
export const costOfDeaths = (deaths: number, vslValue: number) => deaths * vslValue;
export const costOfDeathsBand = (deaths: Band, vslValue: number): Band => ({
  low: costOfDeaths(deaths.low, vslValue),
  central: costOfDeaths(deaths.central, vslValue),
  high: costOfDeaths(deaths.high, vslValue),
});

// "$14.1M", "$6.6M", "$0" — for VSL figures themselves.
export const formatVsl = (value: number) =>
  value === 0 ? '$0' : `$${(value / 1_000_000).toFixed(1)}M`;

// Large annual sums: $X.XT / $X.XB / $X.XM / $N.
export const formatUsdBig = (value: number) => {
  if (!(value > 0)) return '$0';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}k`;
  return `$${Math.round(value)}`;
};

// Per-MWh dollar costs. Whole dollars at or above $1 (with thousands
// separators), cents below — one consistent style so a column of them reads
// cleanly: $347, $39, $2,235, $0.28, <$0.01. Rounding to the dollar is honest
// here: the death-rate band spans an order of magnitude, so trailing cents
// imply a precision the underlying figure does not have.
export const formatUsdPerMwh = (value: number) => {
  if (!(value > 0)) return '$0';
  if (value >= 1) return `$${Math.round(value).toLocaleString('en-US')}`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  return '<$0.01';
};

export const bigBandText = (b: Band, unit = '') =>
  `${formatUsdBig(b.low)}–${formatUsdBig(b.high)}${unit ? ` ${unit}` : ''}`;

export const perMwhBandText = (b: Band, unit = '/MWh') =>
  `${formatUsdPerMwh(b.low)}–${formatUsdPerMwh(b.high)}${unit}`;
