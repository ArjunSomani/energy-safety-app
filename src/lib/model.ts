/**
 * US electricity transition model — pure fleet stock-and-flow (spec step 2).
 *
 * This file is the model engine: no React, no data-file imports, fully
 * deterministic given a scenario. It evolves a fleet of generator cohorts year
 * by year under three dynamics — retirements, lead-time-delayed additions, and
 * generation from empirical capacity factors. Impacts (deaths/CO₂/land/cost),
 * hourly dispatch, and the learning/ELCC feedbacks are later steps and are NOT
 * here yet.
 *
 * The model consumes a fleet in the normalized cohort shape emitted by
 * scripts/fetch-eia.ts, so it runs identically on real EIA data or a fixture.
 */

export type ModelTech =
  | 'coal'
  | 'gas_cc'
  | 'gas_peaker'
  | 'nuclear'
  | 'wind'
  | 'solar'
  | 'hydro'
  | 'battery'
  | 'oil'
  | 'biomass'
  | 'geothermal'
  | 'other';

export const MODEL_TECHS: ModelTech[] = [
  'coal',
  'gas_cc',
  'gas_peaker',
  'nuclear',
  'wind',
  'solar',
  'hydro',
  'battery',
  'oil',
  'biomass',
  'geothermal',
  'other',
];

export type Cohort = {
  tech: ModelTech;
  capacityMw: number;
  commissionYear: number | null;
  retirementYear: number | null;
};

export type TechMap<T> = Partial<Record<ModelTech, T>>;

// --- Adjustable assumptions (all disclosed in the UI later) ---

// Typical service life (years) for unannounced retirement of a cohort that has
// no scheduled retirement date. Site assumptions, adjustable per scenario.
export const DEFAULT_TECH_LIFE: Record<ModelTech, number> = {
  coal: 50,
  gas_cc: 35,
  gas_peaker: 40,
  nuclear: 60,
  wind: 25,
  solar: 30,
  hydro: 100,
  battery: 15,
  oil: 50,
  biomass: 45,
  geothermal: 40,
  other: 40,
};

// Construction lead time (years): capacity ordered in year t arrives at t+n.
// The single most important dynamic in the model. Roughly per Lazard's
// published construction times.
export const DEFAULT_LEAD_TIME: Record<ModelTech, number> = {
  coal: 4,
  gas_cc: 3,
  gas_peaker: 2,
  nuclear: 7,
  wind: 2,
  solar: 1,
  hydro: 6,
  battery: 1,
  oil: 3,
  biomass: 3,
  geothermal: 4,
  other: 3,
};

// Fallback capacity factors when EIA-923 actuals are unavailable. Batteries are
// storage: their net annual energy contribution is ~0, so 0 here for generation.
export const DEFAULT_CAPACITY_FACTORS: Record<ModelTech, number> = {
  coal: 0.42,
  gas_cc: 0.56,
  gas_peaker: 0.12,
  nuclear: 0.93,
  wind: 0.35,
  solar: 0.24,
  hydro: 0.38,
  battery: 0,
  oil: 0.1,
  biomass: 0.55,
  geothermal: 0.71,
  other: 0.3,
};

export type Scenario = {
  startYear: number;
  endYear: number;
  // Annual build rate ordered each year, in GW/yr, per technology.
  buildRatesGw: TechMap<number>;
  // Fractional demand growth per year (e.g. 0.02 = 2%/yr).
  demandGrowth: number;
  initialDemandTwh: number;
  // Optional overrides for the adjustable assumptions.
  techLife?: TechMap<number>;
  leadTime?: TechMap<number>;
  capacityFactors?: TechMap<number>;
};

const emptyByTech = (): Record<ModelTech, number> =>
  Object.fromEntries(MODEL_TECHS.map((t) => [t, 0])) as Record<ModelTech, number>;

export type YearState = {
  year: number;
  capacityMwByTech: Record<ModelTech, number>;
  generationTwhByTech: Record<ModelTech, number>;
  totalGenerationTwh: number;
  demandTwh: number;
  addedMw: number;
  retiredMw: number;
  pipelineMw: number; // capacity ordered but not yet arrived
};

export type ModelResult = {
  scenario: Scenario;
  years: YearState[];
};

type PendingBuild = { tech: ModelTech; capacityMw: number; arriveYear: number };

// Resolve an assumption for a tech from scenario overrides, else the default.
function resolve(map: Record<ModelTech, number>, override: TechMap<number> | undefined, tech: ModelTech): number {
  const o = override?.[tech];
  return o == null ? map[tech] : o;
}

export function runModel(initialFleet: Cohort[], scenario: Scenario): ModelResult {
  // Clone the fleet so the input is never mutated (determinism + purity).
  let fleet: Cohort[] = initialFleet.map((c) => ({ ...c }));
  const pending: PendingBuild[] = [];
  const years: YearState[] = [];

  const techLife = (t: ModelTech) => resolve(DEFAULT_TECH_LIFE, scenario.techLife, t);
  const leadTime = (t: ModelTech) => resolve(DEFAULT_LEAD_TIME, scenario.leadTime, t);
  const capacityFactor = (t: ModelTech) => resolve(DEFAULT_CAPACITY_FACTORS, scenario.capacityFactors, t);

  for (let year = scenario.startYear; year <= scenario.endYear; year += 1) {
    let addedMw = 0;
    let retiredMw = 0;

    // 1. Retirements — announced (scheduled year reached) and unannounced
    //    (cohort age has reached its technology's typical service life).
    const survivors: Cohort[] = [];
    for (const c of fleet) {
      const announced = c.retirementYear != null && c.retirementYear <= year;
      const aged = c.commissionYear != null && year - c.commissionYear >= techLife(c.tech);
      if (announced || aged) retiredMw += c.capacityMw;
      else survivors.push(c);
    }
    fleet = survivors;

    // 2. Additions — pending orders whose lead time has elapsed arrive now.
    const stillPending: PendingBuild[] = [];
    for (const p of pending) {
      if (p.arriveYear === year) {
        fleet.push({
          tech: p.tech,
          capacityMw: p.capacityMw,
          commissionYear: year,
          retirementYear: year + techLife(p.tech),
        });
        addedMw += p.capacityMw;
      } else if (p.arriveYear > year) {
        stillPending.push(p);
      }
      // arriveYear < year should never happen; such orders are dropped.
    }
    pending.length = 0;
    pending.push(...stillPending);

    // 3. Generation — capacity × capacity factor × 8,760 h, in TWh.
    const capacityMwByTech = emptyByTech();
    for (const c of fleet) capacityMwByTech[c.tech] += c.capacityMw;
    const generationTwhByTech = emptyByTech();
    let totalGenerationTwh = 0;
    for (const t of MODEL_TECHS) {
      const gen = (capacityMwByTech[t] * capacityFactor(t) * 8760) / 1_000_000;
      generationTwhByTech[t] = gen;
      totalGenerationTwh += gen;
    }

    // 4. Place this year's new orders (arrive after the lead time).
    for (const t of MODEL_TECHS) {
      const gw = scenario.buildRatesGw[t] ?? 0;
      if (gw > 0) pending.push({ tech: t, capacityMw: gw * 1000, arriveYear: year + leadTime(t) });
    }

    // 5. Demand for the year (compounded from the start).
    const demandTwh = scenario.initialDemandTwh * (1 + scenario.demandGrowth) ** (year - scenario.startYear);

    years.push({
      year,
      capacityMwByTech,
      generationTwhByTech,
      totalGenerationTwh,
      demandTwh,
      addedMw,
      retiredMw,
      pipelineMw: pending.reduce((s, p) => s + p.capacityMw, 0),
    });
  }

  return { scenario, years };
}

// Serialize a scenario to a compact URL query string so runs are shareable
// without a backend (same pattern as /build). Overrides are omitted when empty.
export function scenarioToQuery(s: Scenario): string {
  const params = new URLSearchParams();
  params.set('y', `${s.startYear}-${s.endYear}`);
  params.set('d', String(s.initialDemandTwh));
  params.set('g', String(s.demandGrowth));
  const builds = MODEL_TECHS.filter((t) => (s.buildRatesGw[t] ?? 0) > 0).map((t) => `${t}:${s.buildRatesGw[t]}`);
  if (builds.length) params.set('b', builds.join(','));
  return params.toString();
}

export function scenarioFromQuery(query: string, base: Scenario): Scenario {
  const p = new URLSearchParams(query);
  const next: Scenario = { ...base, buildRatesGw: { ...base.buildRatesGw } };
  const y = p.get('y');
  if (y && /^\d+-\d+$/.test(y)) {
    const [a, b] = y.split('-').map(Number);
    next.startYear = a;
    next.endYear = b;
  }
  const d = Number(p.get('d'));
  if (Number.isFinite(d) && d > 0) next.initialDemandTwh = d;
  const g = Number(p.get('g'));
  if (Number.isFinite(g)) next.demandGrowth = g;
  const b = p.get('b');
  if (b) {
    next.buildRatesGw = {};
    for (const pair of b.split(',')) {
      const [tech, gw] = pair.split(':');
      if ((MODEL_TECHS as string[]).includes(tech) && Number.isFinite(Number(gw))) {
        next.buildRatesGw[tech as ModelTech] = Number(gw);
      }
    }
  }
  return next;
}
