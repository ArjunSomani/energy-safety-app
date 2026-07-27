import { describe, expect, it } from 'vitest';
import { type Cohort, type Scenario, runModel } from './model';
import {
  DEFAULT_ELCC,
  DEFAULT_LEARNING,
  averageElcc,
  computeFeedbacks,
  learnedCapitalPerKw,
  marginalElcc,
} from './model-feedbacks';

describe('model-feedbacks: learning curve', () => {
  const solar = DEFAULT_LEARNING.solar!;

  it('doubling cumulative capacity drops cost by the learning rate', () => {
    const base = learnedCapitalPerKw(solar.baseCumulativeGw, solar);
    const doubled = learnedCapitalPerKw(solar.baseCumulativeGw * 2, solar);
    expect(base).toBeCloseTo(solar.baseCostPerKw, 6);
    expect(doubled).toBeCloseTo(solar.baseCostPerKw * (1 - solar.learningRate), 6);
    // Two doublings ⇒ (1 − LR)².
    const quad = learnedCapitalPerKw(solar.baseCumulativeGw * 4, solar);
    expect(quad).toBeCloseTo(solar.baseCostPerKw * (1 - solar.learningRate) ** 2, 6);
  });

  it('cost falls monotonically as deployment grows', () => {
    let prev = Infinity;
    for (const gw of [100, 200, 400, 800, 1600]) {
      const c = learnedCapitalPerKw(gw, solar);
      expect(c).toBeLessThan(prev);
      prev = c;
    }
  });
});

describe('model-feedbacks: ELCC', () => {
  const solar = DEFAULT_ELCC.solar!;

  it('marginal capacity value starts at peak and declines with penetration', () => {
    expect(marginalElcc(0, solar)).toBeCloseTo(solar.peak, 6);
    expect(marginalElcc(0.05, solar)).toBeLessThan(marginalElcc(0, solar));
    expect(marginalElcc(0.4, solar)).toBeLessThan(marginalElcc(0.1, solar));
    // Stays within the fitted band.
    for (const p of [0, 0.1, 0.3, 0.6, 1]) {
      const e = marginalElcc(p, solar);
      expect(e).toBeGreaterThanOrEqual(solar.floor);
      expect(e).toBeLessThanOrEqual(solar.peak);
    }
  });

  it('average capacity value is at least the marginal at the same penetration', () => {
    for (const p of [0.05, 0.2, 0.5]) {
      expect(averageElcc(p, solar)).toBeGreaterThanOrEqual(marginalElcc(p, solar) - 1e-9);
    }
    expect(averageElcc(0, solar)).toBeCloseTo(solar.peak, 6);
  });
});

describe('model-feedbacks: integration', () => {
  const fleet: Cohort[] = [
    { tech: 'solar', capacityMw: 120_000, commissionYear: 2020, retirementYear: null },
    { tech: 'gas_cc', capacityMw: 100_000, commissionYear: 2010, retirementYear: null },
  ];
  const scenario: Scenario = {
    startYear: 2026,
    endYear: 2050,
    buildRatesGw: { solar: 30, battery: 10 },
    demandGrowth: 0.01,
    initialDemandTwh: 4000,
    techLife: { solar: 500, gas_cc: 500, battery: 500 },
  };

  it('cumulative capex is monotone increasing and equals the sum of annual capex', () => {
    const fb = computeFeedbacks(runModel(fleet, scenario));
    let sum = 0;
    for (let i = 0; i < fb.years.length; i++) {
      sum += fb.years[i].annualCapexUsdBn;
      expect(fb.years[i].cumulativeCapexUsdBn).toBeCloseTo(sum, 1);
      if (i > 0) expect(fb.years[i].cumulativeCapexUsdBn).toBeGreaterThanOrEqual(fb.years[i - 1].cumulativeCapexUsdBn);
    }
  });

  it('sustained solar building drives its learned cost down over the run', () => {
    const fb = computeFeedbacks(runModel(fleet, scenario));
    const first = fb.years[0].capitalPerKwByTech.solar!;
    const last = fb.years[fb.years.length - 1].capitalPerKwByTech.solar!;
    expect(last).toBeLessThan(first);
    // Cumulative solar deployment more than doubles over the run.
    expect(fb.years[fb.years.length - 1].cumulativeGwByTech.solar!).toBeGreaterThan(
      2 * fb.years[0].cumulativeGwByTech.solar!,
    );
  });

  it('solar penetration rises and its marginal ELCC falls as the fleet builds out', () => {
    const fb = computeFeedbacks(runModel(fleet, scenario));
    const early = fb.years[2];
    const late = fb.years[fb.years.length - 1];
    expect(late.penetrationByTech.solar!).toBeGreaterThan(early.penetrationByTech.solar!);
    expect(late.marginalElccByTech.solar!).toBeLessThan(early.marginalElccByTech.solar!);
    expect(late.effectiveCapacityCreditMw).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    const a = computeFeedbacks(runModel(fleet, scenario));
    const b = computeFeedbacks(runModel(fleet, scenario));
    expect(JSON.stringify(a.years)).toBe(JSON.stringify(b.years));
  });
});
