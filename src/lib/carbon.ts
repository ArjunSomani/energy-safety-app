// Valuing carbon — the other externality the electricity market never bills.
// A social cost of carbon and a value of a statistical life are the same kind of
// object: both put a dollar figure on a harm and let you weigh it against the
// bill. Kept parallel to lib/value.ts.
import scc from '@/data/scc.json';
import type { Band } from './types';

export type SccPreset = { key: string; label: string; value: number };

export const SCC_PRESETS = scc.presets as SccPreset[];
export const SCC_MIN = scc.min;
export const SCC_MAX = scc.max;
export const SCC_STEP = scc.step;
export const SCC_SOURCE = scc.source;
export const SCC_UNIT = scc.unit;
export const SCC_NOTE = scc.note;
export const SCC_CENTRAL = SCC_PRESETS.find((p) => p.key === 'central')?.value ?? 190;

// gCO₂eq/kWh → $/MWh: (g/kWh) / 1000 = tonnes CO₂ per MWh, times $/tonne.
export const carbonCostPerMwh = (co2gPerKwh: number, sccValue: number) => (co2gPerKwh / 1000) * sccValue;

export const carbonCostPerMwhBand = (co2: Band, sccValue: number): Band => ({
  low: carbonCostPerMwh(co2.low, sccValue),
  central: carbonCostPerMwh(co2.central, sccValue),
  high: carbonCostPerMwh(co2.high, sccValue),
});

// "$190" — for the social-cost-of-carbon figure itself.
export const formatScc = (value: number) => `$${Math.round(value)}`;
