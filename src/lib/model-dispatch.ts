/**
 * US transition model — hourly dispatch + unserved energy (spec step 4).
 *
 * The centerpiece: dispatch a fleet against representative load, hour by hour,
 * and report how much demand goes UNSERVED, how many hours fall short, and WHEN
 * in the season and day the shortfalls land. Unserved energy is a neutral,
 * reported quantity — a consequence of the fleet the scenario built — never a
 * styled failure state.
 *
 * Representative hours: 4 seasons × 24 hours of day, each standing for
 * `seasonDays[season]` real hours across the year. Supply and demand share the
 * same UTC hour indexing (both from EIA-930), so solar peaks line up with the
 * demand they meet.
 *
 * Merit order each hour:
 *   1. Variable renewables (wind, solar) — must-take, shaped by the hourly VRE
 *      profile, so solar is zero at night.
 *   2. Inflexible baseload (nuclear, hydro, geothermal, biomass) — flat output at
 *      each tech's realized capacity factor.
 *   3. Flexible thermal (gas CC, coal, gas peaker, oil) — dispatched cheapest
 *      marginal cost first, up to an availability-derated capacity.
 *   4. Storage — charges on surplus (excess VRE/baseload), discharges to cover
 *      the residual deficit. Simulated as a converged daily cycle.
 *   5. Whatever deficit remains is unserved energy.
 *
 * Pure and deterministic: profiles and assumptions are passed in; no Date, no
 * Math.random, no data-file imports. The /model UI supplies the real EIA
 * profiles; tests supply fixtures.
 */
import type { ModelTech } from './model';

export type SeasonKey = 'winter' | 'spring' | 'summer' | 'autumn';
export const SEASONS: SeasonKey[] = ['winter', 'spring', 'summer', 'autumn'];

// Demand shape (normalized so the annual-mean hour is 1.0) + how many real days
// each season stands for. Shape of scripts/fetch-eia.ts → load-profiles.json.
export type LoadProfiles = {
  seasonDays: Record<SeasonKey, number>;
  profiles: Record<SeasonKey, number[]>; // [24] per season
};

// Wind & solar shapes, normalized the same way (annual-mean hour = 1.0).
export type VreProfiles = {
  wind: Record<SeasonKey, number[]>;
  solar: Record<SeasonKey, number[]>;
};

// --- Disclosed, adjustable dispatch assumptions (surfaced on /model/assumptions) ---

// Marginal (fuel + variable O&M) cost, $/MWh, deciding flexible merit order.
export const DEFAULT_MARGINAL_COST: Partial<Record<ModelTech, number>> = {
  gas_cc: 30,
  coal: 32,
  gas_peaker: 60,
  oil: 130,
};

// Flexible thermal, cheapest first. Nuclear/hydro/geothermal/biomass are treated
// as inflexible baseload and dispatched before these, at their capacity factor.
const FLEXIBLE_ORDER: ModelTech[] = ['gas_cc', 'coal', 'gas_peaker', 'oil'];
const BASELOAD_TECHS: ModelTech[] = ['nuclear', 'hydro', 'geothermal', 'biomass'];

// Maximum share of nameplate a dispatchable tech can deliver in an hour, after
// forced-outage / maintenance derating. Site assumptions.
export const DEFAULT_AVAILABILITY: Partial<Record<ModelTech, number>> = {
  gas_cc: 0.87,
  coal: 0.85,
  gas_peaker: 0.9,
  oil: 0.9,
};

export type StorageAssumptions = {
  durationHours: number; // energy (MWh) per MW of storage power
  roundTripEfficiency: number; // 0..1
};

export const DEFAULT_STORAGE: StorageAssumptions = {
  durationHours: 4,
  roundTripEfficiency: 0.85,
};

export type DispatchAssumptions = {
  marginalCost?: Partial<Record<ModelTech, number>>;
  availability?: Partial<Record<ModelTech, number>>;
  capacityFactors: Partial<Record<ModelTech, number>>; // realized CF, for baseload + VRE energy
  storage?: StorageAssumptions;
};

export type DispatchResult = {
  year: number;
  demandTwh: number;
  totalHours: number;
  servedTwh: number;
  unservedTwh: number;
  unservedMwh: number;
  shortfallHours: number; // real hours/yr with any unserved energy
  peakUnservedMw: number;
  curtailedTwh: number;
  unservedBySeason: Record<SeasonKey, number>; // MWh
  unservedByHourOfDay: number[]; // [24] MWh, summed across seasons
  dispatchedTwhByTech: Partial<Record<ModelTech, number>>;
  storageThroughputTwh: number;
  equivalentFullCycles: number;
  // Firm (weather-independent) capacity vs the single highest demand hour, a
  // quick planning-reserve read that does not depend on the hourly simulation.
  peakDemandMw: number;
  firmCapacityMw: number;
  reserveMarginPct: number | null;
};

const STEADY_STATE_PASSES = 3; // iterate each representative day to converge storage

function get<T extends ModelTech>(map: Partial<Record<T, number>> | undefined, tech: T, fallback: number): number {
  const v = map?.[tech];
  return v == null ? fallback : v;
}

export function dispatchYear(
  capacityMwByTech: Partial<Record<ModelTech, number>>,
  demandTwh: number,
  year: number,
  load: LoadProfiles,
  vre: VreProfiles,
  assumptions: DispatchAssumptions,
): DispatchResult {
  const cap = (t: ModelTech) => capacityMwByTech[t] ?? 0;
  const cf = (t: ModelTech) => assumptions.capacityFactors[t] ?? 0;
  const avail = (t: ModelTech) => get(assumptions.availability, t, DEFAULT_AVAILABILITY[t] ?? 0.9);
  const mc = (t: ModelTech) => get(assumptions.marginalCost, t, DEFAULT_MARGINAL_COST[t] ?? 1000);
  const storage = assumptions.storage ?? DEFAULT_STORAGE;

  const totalHours = SEASONS.reduce((s, k) => s + load.seasonDays[k] * 24, 0);
  const meanHourlyDemandMw = (demandTwh * 1e6) / totalHours;

  // Flexible thermal sorted by marginal cost (stable, cheapest first).
  const flexible = [...FLEXIBLE_ORDER].sort((a, b) => mc(a) - mc(b));

  // Inflexible baseload: flat MW at realized CF.
  const baseloadMw = BASELOAD_TECHS.reduce((s, t) => s + cap(t) * cf(t), 0);

  // Storage sizing (battery folds pumped storage in the fleet mapping).
  const storagePowerMw = cap('battery');
  const storageEnergyMwh = storagePowerMw * storage.durationHours;
  const legEff = Math.sqrt(Math.max(0, Math.min(1, storage.roundTripEfficiency)));

  const unservedBySeason: Record<SeasonKey, number> = { winter: 0, spring: 0, summer: 0, autumn: 0 };
  const unservedByHourOfDay = new Array(24).fill(0);
  const dispatchedMwhByTech: Partial<Record<ModelTech, number>> = {};
  const addDispatch = (t: ModelTech, mwh: number) => {
    if (mwh) dispatchedMwhByTech[t] = (dispatchedMwhByTech[t] ?? 0) + mwh;
  };

  let unservedMwh = 0;
  let curtailedMwh = 0;
  let servedMwh = 0;
  let peakUnservedMw = 0;
  let shortfallHours = 0;
  let chargeMwh = 0;
  let peakDemandMw = 0;

  for (const season of SEASONS) {
    const days = load.seasonDays[season];
    const demandShape = load.profiles[season];
    const windShape = vre.wind[season];
    const solarShape = vre.solar[season];

    // Precompute the 24-hour supply/demand for this representative day.
    const hours = Array.from({ length: 24 }, (_, h) => {
      const demandMw = demandShape[h] * meanHourlyDemandMw;
      const windMw = cap('wind') * cf('wind') * (windShape?.[h] ?? 0);
      const solarMw = cap('solar') * cf('solar') * (solarShape?.[h] ?? 0);
      const vreMw = windMw + solarMw;
      peakDemandMw = Math.max(peakDemandMw, demandMw);
      return { demandMw, windMw, solarMw, vreMw };
    });

    // Simulate the day repeatedly so storage reaches a periodic steady state,
    // then record from the final pass.
    let stateMwh = storageEnergyMwh * 0.5;
    for (let pass = 0; pass < STEADY_STATE_PASSES; pass += 1) {
      const record = pass === STEADY_STATE_PASSES - 1;
      for (let h = 0; h < 24; h += 1) {
        const { demandMw, windMw, solarMw, vreMw } = hours[h];
        let netLoad = demandMw - vreMw - baseloadMw; // MW for one hour ⇒ MWh
        const flexUsed: Partial<Record<ModelTech, number>> = {};

        if (netLoad > 0) {
          // Flexible thermal, cheapest first.
          for (const t of flexible) {
            if (netLoad <= 0) break;
            const availableMw = cap(t) * avail(t);
            const used = Math.min(netLoad, availableMw);
            if (used > 0) {
              flexUsed[t] = used;
              netLoad -= used;
            }
          }
          // Storage discharge to cover the remaining deficit.
          const dischargeable = Math.min(netLoad, storagePowerMw, stateMwh * legEff);
          const discharge = Math.max(0, dischargeable);
          if (discharge > 0) {
            stateMwh -= discharge / legEff;
            netLoad -= discharge;
            if (record) addDispatch('battery', discharge);
          }
        }

        if (record) {
          // VRE + baseload actually consumed (not curtailed) contribute to served
          // energy; curtailment is only the surplus that could not be stored.
          servedMwh += (demandMw - Math.max(0, netLoad)) * days;
          addDispatch('wind', windMw * days);
          addDispatch('solar', solarMw * days);
          for (const t of BASELOAD_TECHS) addDispatch(t, cap(t) * cf(t) * days);
          for (const [t, mw] of Object.entries(flexUsed) as [ModelTech, number][]) addDispatch(t, mw * days);
        }

        if (netLoad > 0) {
          // Deficit that nothing could cover: unserved energy.
          if (record) {
            unservedMwh += netLoad * days;
            unservedBySeason[season] += netLoad * days;
            unservedByHourOfDay[h] += netLoad * days;
            peakUnservedMw = Math.max(peakUnservedMw, netLoad);
            shortfallHours += days;
          }
        } else {
          // Surplus: charge storage, curtail the rest.
          const surplus = -netLoad;
          const roomMwh = storageEnergyMwh - stateMwh;
          const charge = Math.max(0, Math.min(surplus, storagePowerMw, roomMwh / legEff));
          stateMwh += charge * legEff;
          if (record) {
            chargeMwh += charge * days;
            curtailedMwh += (surplus - charge) * days;
          }
        }
      }
    }
  }

  // Firm (weather-independent) capacity: baseload at CF + flexible at availability
  // + storage power. VRE contributes 0 here on purpose — this is the worst-hour
  // read, complementary to the ELCC-based capacity value used elsewhere.
  const firmCapacityMw =
    baseloadMw + flexible.reduce((s, t) => s + cap(t) * avail(t), 0) + storagePowerMw;

  const twh = (mwh: number) => +(mwh / 1e6).toFixed(4);
  const dispatchedTwhByTech: Partial<Record<ModelTech, number>> = {};
  for (const [t, mwh] of Object.entries(dispatchedMwhByTech) as [ModelTech, number][]) dispatchedTwhByTech[t] = twh(mwh);

  return {
    year,
    demandTwh,
    totalHours,
    servedTwh: twh(servedMwh),
    unservedTwh: twh(unservedMwh),
    unservedMwh: +unservedMwh.toFixed(1),
    shortfallHours: Math.round(shortfallHours),
    peakUnservedMw: +peakUnservedMw.toFixed(1),
    curtailedTwh: twh(curtailedMwh),
    unservedBySeason: {
      winter: +unservedBySeason.winter.toFixed(1),
      spring: +unservedBySeason.spring.toFixed(1),
      summer: +unservedBySeason.summer.toFixed(1),
      autumn: +unservedBySeason.autumn.toFixed(1),
    },
    unservedByHourOfDay: unservedByHourOfDay.map((v) => +v.toFixed(1)),
    dispatchedTwhByTech,
    storageThroughputTwh: twh(chargeMwh),
    equivalentFullCycles: storageEnergyMwh > 0 ? +(chargeMwh / storageEnergyMwh).toFixed(1) : 0,
    peakDemandMw: +peakDemandMw.toFixed(1),
    firmCapacityMw: +firmCapacityMw.toFixed(1),
    reserveMarginPct: peakDemandMw > 0 ? +(((firmCapacityMw - peakDemandMw) / peakDemandMw) * 100).toFixed(1) : null,
  };
}
