import { describe, expect, it } from 'vitest';
import {
  type Cohort,
  DEFAULT_LEAD_TIME,
  type Scenario,
  runModel,
  scenarioFromQuery,
  scenarioToQuery,
} from './model';

// Synthetic fleet fixture — stands in for EIA data until the live fetch runs.
// Deliberately small and legible, not a claim about the real US fleet.
const fixture: Cohort[] = [
  { tech: 'coal', capacityMw: 200_000, commissionYear: 1990, retirementYear: null }, // ages out at 2040 (life 50)
  { tech: 'gas_cc', capacityMw: 300_000, commissionYear: 2010, retirementYear: null },
  { tech: 'nuclear', capacityMw: 95_000, commissionYear: 1985, retirementYear: 2035 }, // announced
  { tech: 'wind', capacityMw: 150_000, commissionYear: 2015, retirementYear: null },
  { tech: 'solar', capacityMw: 100_000, commissionYear: 2020, retirementYear: null },
];

const baseScenario: Scenario = {
  startYear: 2026,
  endYear: 2050,
  buildRatesGw: {},
  demandGrowth: 0.01,
  initialDemandTwh: 4000,
};

describe('model', () => {
  it('is deterministic and does not mutate the input fleet', () => {
    const before = JSON.stringify(fixture);
    const a = runModel(fixture, baseScenario);
    const b = runModel(fixture, baseScenario);
    expect(JSON.stringify(fixture)).toBe(before);
    expect(JSON.stringify(a.years)).toBe(JSON.stringify(b.years));
    expect(a.years).toHaveLength(2050 - 2026 + 1);
  });

  it('null scenario: with zero builds, generation declines to retirement', () => {
    const result = runModel(fixture, baseScenario);
    const first = result.years[0].totalGenerationTwh;
    const last = result.years[result.years.length - 1].totalGenerationTwh;
    expect(last).toBeLessThan(first);
    // The announced nuclear retirement (2035) must remove all nuclear capacity.
    const y2036 = result.years.find((y) => y.year === 2036)!;
    expect(y2036.capacityMwByTech.nuclear).toBe(0);
    // The 1990 coal cohort ages out at 2040 (50-yr life).
    const y2041 = result.years.find((y) => y.year === 2041)!;
    expect(y2041.capacityMwByTech.coal).toBe(0);
  });

  it('lead time: nuclear ordered in the final years never arrives', () => {
    const scenario: Scenario = {
      ...baseScenario,
      startYear: 2026,
      endYear: 2030, // 5-year run, shorter than nuclear's 7-yr lead time
      buildRatesGw: { nuclear: 5 },
    };
    const result = runModel(fixture, scenario);
    const start = result.years[0].capacityMwByTech.nuclear;
    // Nuclear capacity only shrinks (no arrivals within the horizon), and there
    // is a pipeline of unbuilt orders at the end.
    for (const y of result.years) expect(y.capacityMwByTech.nuclear).toBeLessThanOrEqual(start);
    expect(result.years[result.years.length - 1].pipelineMw).toBeGreaterThan(0);
    expect(DEFAULT_LEAD_TIME.nuclear).toBe(7);
  });

  it('additions arrive exactly after the lead time and then generate', () => {
    const scenario: Scenario = {
      ...baseScenario,
      endYear: 2040,
      buildRatesGw: { solar: 10 }, // 1-yr lead time
    };
    const result = runModel([], scenario);
    // Ordered in 2026, arrives 2027.
    expect(result.years.find((y) => y.year === 2026)!.capacityMwByTech.solar).toBe(0);
    expect(result.years.find((y) => y.year === 2027)!.capacityMwByTech.solar).toBe(10_000);
    // And by 2027 solar is generating (10 GW × 0.24 × 8760 / 1e6 ≈ 21 TWh).
    expect(result.years.find((y) => y.year === 2027)!.generationTwhByTech.solar).toBeCloseTo(21.02, 1);
  });

  it('demand compounds at the growth rate', () => {
    const result = runModel(fixture, { ...baseScenario, demandGrowth: 0.02 });
    expect(result.years[0].demandTwh).toBeCloseTo(4000);
    expect(result.years.find((y) => y.year === 2036)!.demandTwh).toBeCloseTo(4000 * 1.02 ** 10, 0);
  });

  it('serializes a scenario to a query string and back', () => {
    const scenario: Scenario = { ...baseScenario, buildRatesGw: { solar: 20, nuclear: 4 } };
    const round = scenarioFromQuery(scenarioToQuery(scenario), baseScenario);
    expect(round.startYear).toBe(2026);
    expect(round.endYear).toBe(2050);
    expect(round.buildRatesGw.solar).toBe(20);
    expect(round.buildRatesGw.nuclear).toBe(4);
  });
});
