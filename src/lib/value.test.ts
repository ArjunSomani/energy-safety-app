import { describe, expect, it } from 'vitest';
import {
  VSL_CENTRAL,
  VSL_PRESETS,
  costOfDeaths,
  formatUsdBig,
  formatUsdPerMwh,
  formatVsl,
  mortalityCostPerMwh,
} from './value';

describe('value of a statistical life', () => {
  it('publishes HHS low/central/high presets', () => {
    expect(VSL_PRESETS.map((p) => p.value)).toEqual([6_600_000, 14_100_000, 21_500_000]);
    expect(VSL_CENTRAL).toBe(14_100_000);
  });

  it('prices a death rate per MWh: deaths/TWh x VSL / 1e6', () => {
    // Coal at 24.6 deaths/TWh, central VSL, lands near $347/MWh — larger than its bill.
    expect(mortalityCostPerMwh(24.6, VSL_CENTRAL)).toBeCloseTo(346.86, 2);
    // Gas at 2.8 deaths/TWh ~ $39/MWh.
    expect(mortalityCostPerMwh(2.8, VSL_CENTRAL)).toBeCloseTo(39.48, 2);
    // Solar at 0.02 deaths/TWh is a fraction of a cent per MWh.
    expect(mortalityCostPerMwh(0.02, VSL_CENTRAL)).toBeCloseTo(0.282, 3);
  });

  it('scales linearly with the chosen life-value', () => {
    expect(mortalityCostPerMwh(24.6, 0)).toBe(0);
    expect(mortalityCostPerMwh(10, 7_000_000)).toBe(mortalityCostPerMwh(10, 14_000_000) / 2);
  });

  it('costs a whole death toll at the chosen value', () => {
    expect(costOfDeaths(1000, VSL_CENTRAL)).toBe(14_100_000_000);
    expect(costOfDeaths(0, VSL_CENTRAL)).toBe(0);
  });

  it('formats figures at the right magnitude', () => {
    expect(formatVsl(14_100_000)).toBe('$14.1M');
    expect(formatVsl(0)).toBe('$0');
    expect(formatUsdPerMwh(346.86)).toBe('$347');
    expect(formatUsdPerMwh(39.48)).toBe('$39');
    expect(formatUsdPerMwh(2235)).toBe('$2,235');
    expect(formatUsdPerMwh(0.282)).toBe('$0.28');
    expect(formatUsdPerMwh(0.004)).toBe('<$0.01');
    expect(formatUsdBig(14_100_000_000)).toBe('$14.1B');
    expect(formatUsdBig(2_500_000_000_000)).toBe('$2.50T');
  });
});
