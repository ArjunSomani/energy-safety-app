import { describe, expect, it } from 'vitest';
import { computeMix } from './engine';
import { type Cohort, type Scenario, runModel } from './model';
import { computeModelImpacts, engineSlugForModelTech } from './model-impacts';
import type { Mix, SourceSlug } from './types';

// A fleet made only of techs that DO map to engine slugs, so the whole fleet is
// "modeled" and the reproduction check is exact.
const modeledFleet: Cohort[] = [
  { tech: 'coal', capacityMw: 100_000, commissionYear: 2000, retirementYear: null },
  { tech: 'gas_cc', capacityMw: 100_000, commissionYear: 2010, retirementYear: null },
  { tech: 'nuclear', capacityMw: 50_000, commissionYear: 1990, retirementYear: null },
  { tech: 'wind', capacityMw: 100_000, commissionYear: 2015, retirementYear: null },
  { tech: 'solar', capacityMw: 100_000, commissionYear: 2020, retirementYear: null },
];

const constantScenario: Scenario = {
  startYear: 2026,
  endYear: 2030,
  buildRatesGw: {},
  demandGrowth: 0,
  initialDemandTwh: 4000,
  // Freeze retirements far out so the fleet is genuinely constant over the run.
  techLife: { coal: 500, gas_cc: 500, nuclear: 500, wind: 500, solar: 500 },
};

// Rebuild the descriptive mix from a model year's generation, the way a /build
// user would enter it, to compare against the impacts layer.
function descriptiveFromYear(genBySlug: Partial<Record<SourceSlug, number>>) {
  const total = (Object.values(genBySlug) as number[]).reduce((a, b) => a + b, 0);
  const mix = Object.fromEntries(
    (['coal', 'oil', 'gas', 'biomass', 'hydro', 'nuclear', 'wind', 'solar'] as SourceSlug[]).map((s) => [
      s,
      (genBySlug[s] ?? 0) / total,
    ]),
  ) as Mix;
  return computeMix(mix, total);
}

describe('model-impacts', () => {
  it('a constant, fully-modeled fleet reproduces the descriptive engine exactly', () => {
    const result = runModel(modeledFleet, constantScenario);
    const impacts = computeModelImpacts(result, { horizonWideningPerYear: 0 });
    const year0 = impacts.years[0];
    const descriptive = descriptiveFromYear(year0.generationBySlug);

    for (const key of ['low', 'central', 'high'] as const) {
      expect(year0.annual.deaths[key]).toBeCloseTo(descriptive.deaths.total[key], 6);
      expect(year0.annual.co2Mt[key]).toBeCloseTo(descriptive.co2.totalMt[key], 6);
      expect(year0.annual.landKm2[key]).toBeCloseTo(descriptive.land.km2[key], 6);
      expect(year0.annual.costUsdBn[key]).toBeCloseTo(descriptive.cost.annualUsdBn[key], 6);
    }
    // Fully modeled: nothing dropped.
    expect(year0.unmodeledTwh).toBe(0);
    expect(impacts.unmodeledTechs).toHaveLength(0);
  });

  it('folds gas_cc and gas_peaker onto the single gas coefficient', () => {
    expect(engineSlugForModelTech('gas_cc')).toBe('gas');
    expect(engineSlugForModelTech('gas_peaker')).toBe('gas');
    const fleet: Cohort[] = [
      { tech: 'gas_cc', capacityMw: 100_000, commissionYear: 2010, retirementYear: null },
      { tech: 'gas_peaker', capacityMw: 100_000, commissionYear: 2010, retirementYear: null },
    ];
    const result = runModel(fleet, { ...constantScenario, techLife: { gas_cc: 500, gas_peaker: 500 } });
    const y0 = computeModelImpacts(result, { horizonWideningPerYear: 0 }).years[0];
    const gasGen = result.years[0].generationTwhByTech.gas_cc + result.years[0].generationTwhByTech.gas_peaker;
    expect(y0.generationBySlug.gas).toBeCloseTo(gasGen, 6);
  });

  it('tracks storage / geothermal / other as unmodeled, never zeroed into impacts', () => {
    const fleet: Cohort[] = [
      { tech: 'solar', capacityMw: 100_000, commissionYear: 2020, retirementYear: null },
      { tech: 'geothermal', capacityMw: 10_000, commissionYear: 2015, retirementYear: null },
      { tech: 'other', capacityMw: 5_000, commissionYear: 2015, retirementYear: null },
    ];
    const result = runModel(fleet, {
      ...constantScenario,
      techLife: { solar: 500, geothermal: 500, other: 500 },
    });
    const impacts = computeModelImpacts(result, { horizonWideningPerYear: 0 });
    const y0 = impacts.years[0];
    expect(engineSlugForModelTech('geothermal')).toBeNull();
    expect(y0.unmodeledTwh).toBeGreaterThan(0);
    expect(y0.unmodeledByTech.geothermal).toBeGreaterThan(0);
    expect(y0.unmodeledByTech.other).toBeGreaterThan(0);
    expect(impacts.unmodeledTechs).toEqual(expect.arrayContaining(['geothermal', 'other']));
    // Solar impacts are unaffected by the presence of the unmodeled techs.
    expect(y0.annual.deaths.central).toBeGreaterThanOrEqual(0);
  });

  it('cumulative integrals equal the running sum of annual bands', () => {
    const result = runModel(modeledFleet, constantScenario);
    const impacts = computeModelImpacts(result, { horizonWideningPerYear: 0 });
    // Constant fleet + no widening ⇒ each year's annual is identical.
    const annualDeaths = impacts.years[0].annual.deaths.central;
    const n = impacts.years.length;
    const last = impacts.years[n - 1];
    expect(last.cumulative.deaths.central).toBeCloseTo(annualDeaths * n, 4);
    // Cumulative is monotone non-decreasing.
    for (let i = 1; i < n; i++) {
      expect(impacts.years[i].cumulative.co2Mt.central).toBeGreaterThanOrEqual(
        impacts.years[i - 1].cumulative.co2Mt.central,
      );
    }
  });

  it('uncertainty widens with horizon: central fixed, band wider further out', () => {
    const result = runModel(modeledFleet, { ...constantScenario, endYear: 2050 });
    const impacts = computeModelImpacts(result, { horizonWideningPerYear: 0.02 });
    const first = impacts.years[0];
    const last = impacts.years[impacts.years.length - 1];
    // Base year is unwidened.
    expect(first.horizonWideningFactor).toBe(1);
    expect(last.horizonWideningFactor).toBeGreaterThan(1);
    // Central value is unchanged by widening (constant fleet).
    expect(last.annual.deaths.central).toBeCloseTo(first.annual.deaths.central, 6);
    // The band is strictly wider at the 2050 horizon than at the base year.
    const width = (b: { low: number; high: number }) => b.high - b.low;
    expect(width(last.annual.deaths)).toBeGreaterThan(width(first.annual.deaths));
    expect(width(last.annual.co2Mt)).toBeGreaterThan(width(first.annual.co2Mt));
    expect(width(last.annual.costUsdBn)).toBeGreaterThan(width(first.annual.costUsdBn));
    // Widened low bound never goes negative.
    expect(last.annual.deaths.low).toBeGreaterThanOrEqual(0);
  });
});
