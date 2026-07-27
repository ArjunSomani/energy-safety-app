import { describe, expect, it } from 'vitest';
import { type LoadProfiles, type VreProfiles, dispatchYear } from './model-dispatch';
import type { ModelTech } from './model';

// Flat demand, 365-day year → 8760 representative hours.
const load: LoadProfiles = {
  seasonDays: { winter: 90, spring: 92, summer: 92, autumn: 91 },
  profiles: {
    winter: new Array(24).fill(1),
    spring: new Array(24).fill(1),
    summer: new Array(24).fill(1),
    autumn: new Array(24).fill(1),
  },
};

// Solar: 0 for the first 12 hours (night), 2.0 for the last 12 (day) → mean 1.0.
// Wind: flat 1.0.
const daySolar = [...new Array(12).fill(0), ...new Array(12).fill(2)];
const vre: VreProfiles = {
  wind: { winter: new Array(24).fill(1), spring: new Array(24).fill(1), summer: new Array(24).fill(1), autumn: new Array(24).fill(1) },
  solar: { winter: daySolar, spring: daySolar, summer: daySolar, autumn: daySolar },
};

const cfs: Partial<Record<ModelTech, number>> = {
  solar: 0.2,
  wind: 0.34,
  nuclear: 0.92,
  gas_cc: 0.56,
  gas_peaker: 0.12,
};

const DEMAND_TWH = 100;

describe('model-dispatch', () => {
  it('served + unserved always equals demand', () => {
    const r = dispatchYear({ solar: 50_000 }, DEMAND_TWH, 2030, load, vre, { capacityFactors: cfs });
    expect(r.servedTwh + r.unservedTwh).toBeCloseTo(DEMAND_TWH, 2);
    expect(r.totalHours).toBe(8760);
  });

  it('is deterministic', () => {
    const args = [{ solar: 50_000, gas_cc: 20_000 }, DEMAND_TWH, 2030, load, vre, { capacityFactors: cfs }] as const;
    expect(JSON.stringify(dispatchYear(...args))).toBe(JSON.stringify(dispatchYear(...args)));
  });

  it('an ample firm fleet serves all load: zero unserved, positive reserve margin', () => {
    // ~30 GW mean demand; 60 GW nuclear + 40 GW gas CC is plenty of firm supply.
    const r = dispatchYear({ nuclear: 40_000, gas_cc: 40_000 }, DEMAND_TWH, 2030, load, vre, { capacityFactors: cfs });
    expect(r.unservedTwh).toBe(0);
    expect(r.shortfallHours).toBe(0);
    expect(r.reserveMarginPct).not.toBeNull();
    expect(r.reserveMarginPct as number).toBeGreaterThan(0);
  });

  it('solar-only with no storage goes unserved, and only at night', () => {
    const r = dispatchYear({ solar: 50_000 }, DEMAND_TWH, 2030, load, vre, { capacityFactors: cfs });
    expect(r.unservedTwh).toBeGreaterThan(0);
    // Night hours (indices 0–11, solar = 0) carry all the unserved energy;
    // day hours (12–23) carry none.
    const night = r.unservedByHourOfDay.slice(0, 12).reduce((a, b) => a + b, 0);
    const day = r.unservedByHourOfDay.slice(12).reduce((a, b) => a + b, 0);
    expect(night).toBeGreaterThan(0);
    expect(day).toBe(0);
    // Some solar is curtailed midday (surplus with nowhere to go).
    expect(r.curtailedTwh).toBeGreaterThan(0);
  });

  it('adding storage shifts solar into the night and cuts unserved energy', () => {
    const noStorage = dispatchYear({ solar: 50_000 }, DEMAND_TWH, 2030, load, vre, { capacityFactors: cfs });
    const withStorage = dispatchYear({ solar: 50_000, battery: 20_000 }, DEMAND_TWH, 2030, load, vre, {
      capacityFactors: cfs,
    });
    expect(withStorage.unservedTwh).toBeLessThan(noStorage.unservedTwh);
    expect(withStorage.equivalentFullCycles).toBeGreaterThan(0);
    expect(withStorage.dispatchedTwhByTech.battery ?? 0).toBeGreaterThan(0);
  });

  it('reports seasonal timing of shortfalls', () => {
    const r = dispatchYear({ solar: 50_000 }, DEMAND_TWH, 2030, load, vre, { capacityFactors: cfs });
    const seasonSum =
      r.unservedBySeason.winter + r.unservedBySeason.spring + r.unservedBySeason.summer + r.unservedBySeason.autumn;
    expect(seasonSum).toBeCloseTo(r.unservedMwh, 0);
  });

  it('cheaper marginal cost dispatches before dearer: gas CC before oil', () => {
    // Demand exceeds what one gas fleet can serve, forcing a second unit on.
    const r = dispatchYear({ gas_cc: 20_000, oil: 20_000 }, DEMAND_TWH, 2030, load, vre, {
      capacityFactors: cfs,
    });
    const gas = r.dispatchedTwhByTech.gas_cc ?? 0;
    const oil = r.dispatchedTwhByTech.oil ?? 0;
    // Gas CC (marginal $30) runs harder than oil (marginal $130).
    expect(gas).toBeGreaterThan(oil);
  });
});
