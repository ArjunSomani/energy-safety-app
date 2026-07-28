import { describe, expect, it } from 'vitest';
import { SCC_CENTRAL, SCC_PRESETS, carbonCostPerMwh, formatScc } from './carbon';

describe('social cost of carbon', () => {
  it('publishes the EPA 2023 low/central/high range', () => {
    expect(SCC_PRESETS.map((p) => p.value)).toEqual([120, 190, 340]);
    expect(SCC_CENTRAL).toBe(190);
  });

  it('prices CO₂ per MWh: (g/kWh) / 1000 tonnes/MWh x $/tonne', () => {
    // Coal at 820 g/kWh, central SCC → ~$156/MWh, comparable to its LCOE.
    expect(carbonCostPerMwh(820, SCC_CENTRAL)).toBeCloseTo(155.8, 1);
    // Gas at 490 g/kWh → ~$93/MWh.
    expect(carbonCostPerMwh(490, SCC_CENTRAL)).toBeCloseTo(93.1, 1);
    // Solar at 48 g/kWh → a few dollars.
    expect(carbonCostPerMwh(48, SCC_CENTRAL)).toBeCloseTo(9.12, 2);
    expect(carbonCostPerMwh(820, 0)).toBe(0);
  });

  it('formats the SCC figure as whole dollars', () => {
    expect(formatScc(190)).toBe('$190');
  });
});
