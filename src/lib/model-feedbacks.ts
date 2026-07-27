/**
 * US transition model — feedbacks (spec step 5).
 *
 * What separates a model from a projection: outputs that bend the inputs.
 *
 *   1. Learning curve. Solar and battery overnight capital cost falls with
 *      cumulative deployment (Wright's law), at a published, adjustable learning
 *      rate. Every other tech holds at its reference capital cost.
 *   2. ELCC cannibalization. The marginal capacity value of wind, solar and
 *      short-duration storage falls as their penetration rises — a fitted
 *      declining curve, not a constant. The published spread across US ISOs
 *      (solar ~51% at low penetration down to ~12% at high) anchors the fit.
 *   3. Cumulative stocks. Capital spent is integrated over the run, the same way
 *      deaths and CO₂ are in the impacts layer, so the path — not just the 2050
 *      snapshot — is visible.
 *
 * Pure and deterministic. Every constant here is a disclosed site assumption
 * (see /model/assumptions); the ELCC anchors are the only ones with an external
 * citation, and even those are fitted, not measured for this fleet.
 */
import type { ModelResult, ModelTech } from './model';

// --- 1. Learning curves ------------------------------------------------------

export type LearningParams = {
  learningRate: number; // fractional cost drop per doubling of cumulative capacity
  baseCumulativeGw: number; // cumulative deployment at the reference cost
  baseCostPerKw: number; // reference overnight capital cost, $/kW
};

// NREL ATB 2024-class reference points; learning rates from the published solar
// and battery experience curves (~20% and ~18% per doubling). Site assumptions.
export const DEFAULT_LEARNING: Partial<Record<ModelTech, LearningParams>> = {
  solar: { learningRate: 0.2, baseCumulativeGw: 123.4, baseCostPerKw: 1100 },
  battery: { learningRate: 0.18, baseCumulativeGw: 48.7, baseCostPerKw: 1400 },
};

// Reference overnight capital cost ($/kW) for techs without a learning curve, so
// total build-out capital can be integrated. Site assumptions (NREL ATB / Lazard).
export const DEFAULT_CAPITAL_PER_KW: Record<ModelTech, number> = {
  coal: 4000,
  gas_cc: 1250,
  gas_peaker: 1100,
  nuclear: 7000,
  wind: 1400,
  solar: 1100,
  hydro: 5500,
  battery: 1400,
  oil: 1100,
  biomass: 4200,
  geothermal: 5500,
  other: 3000,
};

// Wright's law: cost(C) = cost0 · (C / C0)^(−b), with b = −log2(1 − learningRate).
// Doubling cumulative capacity multiplies cost by (1 − learningRate).
export function learnedCapitalPerKw(cumulativeGw: number, p: LearningParams): number {
  if (!(p.baseCumulativeGw > 0) || !(cumulativeGw > 0)) return p.baseCostPerKw;
  const b = -Math.log2(1 - Math.max(0, Math.min(0.9, p.learningRate)));
  return p.baseCostPerKw * (cumulativeGw / p.baseCumulativeGw) ** -b;
}

// Capital cost for a tech at a given cumulative deployment: learned for solar and
// battery, flat otherwise.
export function capitalPerKw(
  tech: ModelTech,
  cumulativeGw: number,
  learning: Partial<Record<ModelTech, LearningParams>>,
): number {
  const lp = learning[tech];
  return lp ? learnedCapitalPerKw(cumulativeGw, lp) : DEFAULT_CAPITAL_PER_KW[tech];
}

// --- 2. ELCC cannibalization -------------------------------------------------

export type ElccParams = {
  peak: number; // marginal capacity value at zero penetration
  floor: number; // asymptotic value at high penetration
  tau: number; // penetration scale of the decline
};

// Exponential decay from `peak` at zero penetration to `floor` at high
// penetration: elcc(p) = floor + (peak − floor)·exp(−p / tau). The solar anchors
// (0.51 → 0.12) bracket the published marginal ELCC across MISO, CAISO, SPP, PJM,
// ERCOT and NYISO; wind is higher and flatter; a 4-hour battery starts high but
// saturates the net-peak quickly. Penetration is the tech's generation share of
// demand (storage: throughput share). Fitted, adjustable site assumptions.
export const DEFAULT_ELCC: Partial<Record<ModelTech, ElccParams>> = {
  solar: { peak: 0.51, floor: 0.12, tau: 0.1 },
  wind: { peak: 0.4, floor: 0.15, tau: 0.15 },
  battery: { peak: 0.95, floor: 0.1, tau: 0.06 },
};

// Marginal capacity value of the next increment at penetration p (0..1).
export function marginalElcc(penetration: number, p: ElccParams): number {
  const pen = Math.max(0, penetration);
  return p.floor + (p.peak - p.floor) * Math.exp(-pen / Math.max(1e-6, p.tau));
}

// Average capacity value of the whole fleet at penetration p — the integral of
// the marginal curve divided by p. What actually counts toward firm capacity.
//   (1/p)·∫₀ᵖ elcc(x)dx = floor + (peak−floor)·(tau/p)·(1 − e^(−p/tau))
export function averageElcc(penetration: number, p: ElccParams): number {
  const pen = Math.max(0, penetration);
  if (pen < 1e-9) return p.peak;
  const tau = Math.max(1e-6, p.tau);
  return p.floor + (p.peak - p.floor) * (tau / pen) * (1 - Math.exp(-pen / tau));
}

// --- 3. Per-year feedbacks + cumulative capital ------------------------------

export type FeedbackOptions = {
  learning?: Partial<Record<ModelTech, LearningParams>>;
  capitalPerKw?: Partial<Record<ModelTech, number>>;
  elcc?: Partial<Record<ModelTech, ElccParams>>;
};

export type YearFeedback = {
  year: number;
  // Cumulative installed capacity (GW) driving the learning curve, per tech.
  cumulativeGwByTech: Partial<Record<ModelTech, number>>;
  capitalPerKwByTech: Partial<Record<ModelTech, number>>;
  // Generation share of demand, per tech (penetration for ELCC).
  penetrationByTech: Partial<Record<ModelTech, number>>;
  marginalElccByTech: Partial<Record<ModelTech, number>>;
  averageElccByTech: Partial<Record<ModelTech, number>>;
  // Firm-equivalent capacity credited to VRE + storage at this penetration (MW).
  effectiveCapacityCreditMw: number;
  annualCapexUsdBn: number; // capital committed by this year's new builds
  cumulativeCapexUsdBn: number; // integral of capex over the run
};

export type ModelFeedbacks = {
  years: YearFeedback[];
  options: Required<Pick<FeedbackOptions, 'learning' | 'elcc'>> & { capitalPerKw: Record<ModelTech, number> };
};

const ELCC_TECHS: ModelTech[] = ['wind', 'solar', 'battery'];

export function computeFeedbacks(result: ModelResult, options: FeedbackOptions = {}): ModelFeedbacks {
  const learning = { ...DEFAULT_LEARNING, ...options.learning };
  const elcc = { ...DEFAULT_ELCC, ...options.elcc };
  const capital = { ...DEFAULT_CAPITAL_PER_KW, ...options.capitalPerKw };
  const build = result.scenario.buildRatesGw;

  // Cumulative deployment ever built, seeded from the base-year fleet so the
  // learning curve starts at the real current installed base. Grows each year by
  // the scenario's build orders (manufacturing drives learning), which is also
  // when capital is committed.
  const cumulativeGw: Partial<Record<ModelTech, number>> = {};
  const seed = result.years[0]?.capacityMwByTech;
  if (seed) for (const [t, mw] of Object.entries(seed) as [ModelTech, number][]) cumulativeGw[t] = mw / 1000;

  let cumulativeCapexUsdBn = 0;
  const years: YearFeedback[] = result.years.map((state) => {
    // This year's build orders: priced at the learned cost for the current
    // cumulative deployment, then deployment grows by the orders.
    let annualCapexUsdBn = 0;
    for (const t of Object.keys(build) as ModelTech[]) {
      const gw = build[t] ?? 0;
      if (gw <= 0) continue;
      const costPerKw = lp(t, cumulativeGw, learning, capital);
      annualCapexUsdBn += (gw * 1e6 * costPerKw) / 1e9; // GW·1e6 kW·$/kW ÷1e9 = $bn
      cumulativeGw[t] = (cumulativeGw[t] ?? 0) + gw;
    }
    cumulativeCapexUsdBn += annualCapexUsdBn;

    // Learned prices (post-order) and ELCC at this year's penetration.
    const capitalPerKwByTech: Partial<Record<ModelTech, number>> = {};
    for (const t of Object.keys(state.capacityMwByTech) as ModelTech[]) {
      capitalPerKwByTech[t] = +lp(t, cumulativeGw, learning, capital).toFixed(1);
    }

    const penetrationByTech: Partial<Record<ModelTech, number>> = {};
    const marginalElccByTech: Partial<Record<ModelTech, number>> = {};
    const averageElccByTech: Partial<Record<ModelTech, number>> = {};
    let effectiveCapacityCreditMw = 0;
    for (const t of ELCC_TECHS) {
      const pen = state.demandTwh > 0 ? (state.generationTwhByTech[t] ?? 0) / state.demandTwh : 0;
      penetrationByTech[t] = +pen.toFixed(4);
      const ep = elcc[t];
      if (ep) {
        marginalElccByTech[t] = +marginalElcc(pen, ep).toFixed(4);
        const avg = averageElcc(pen, ep);
        averageElccByTech[t] = +avg.toFixed(4);
        effectiveCapacityCreditMw += (state.capacityMwByTech[t] ?? 0) * avg;
      }
    }

    return {
      year: state.year,
      cumulativeGwByTech: Object.fromEntries(Object.entries(cumulativeGw).map(([k, v]) => [k, +v.toFixed(2)])),
      capitalPerKwByTech,
      penetrationByTech,
      marginalElccByTech,
      averageElccByTech,
      effectiveCapacityCreditMw: +effectiveCapacityCreditMw.toFixed(1),
      annualCapexUsdBn: +annualCapexUsdBn.toFixed(2),
      cumulativeCapexUsdBn: +cumulativeCapexUsdBn.toFixed(2),
    };
  });

  return { years, options: { learning, elcc, capitalPerKw: capital } };
}

// Learned or reference capital cost ($/kW) for a tech at the current cumulative
// deployment. Local helper so the per-year loop stays flat.
function lp(
  tech: ModelTech,
  cumulativeGw: Partial<Record<ModelTech, number>>,
  learning: Partial<Record<ModelTech, LearningParams>>,
  capital: Record<ModelTech, number>,
): number {
  const params = learning[tech];
  return params ? learnedCapitalPerKw(cumulativeGw[tech] ?? 0, params) : capital[tech];
}
