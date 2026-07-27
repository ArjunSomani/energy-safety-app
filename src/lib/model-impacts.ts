/**
 * US transition model — impacts layer (spec step 3).
 *
 * Turns the model's yearly generation (from runModel) into deaths, CO₂, land and
 * cost, annual AND cumulative, with the SAME per-TWh coefficient bands the
 * descriptive engine uses. Coefficients are never redefined here: this module
 * folds the model's finer technology set onto the engine's source slugs and then
 * calls computeMix, so a constant fleet reproduces the descriptive numbers
 * exactly (see model-impacts.test.ts).
 *
 * Two honesty rules from the spec are enforced here:
 *   - Storage / geothermal / "other" have no engine coefficient. Their
 *     generation is tracked as `unmodeledTwh`, never silently folded into zero.
 *   - Uncertainty widens with horizon. The coefficient band is a fixed fraction
 *     of the central value; a disclosed, adjustable horizon term widens the band
 *     further each year out, so a 2050 figure is visibly less precise than the
 *     base year. At the base year the widening factor is exactly 1, which is why
 *     the reproduction test holds.
 *
 * Pure and deterministic: no Date, no Math.random, no data-file imports beyond
 * the coefficients the engine already owns.
 */
import { bySlug, type ComputeOptions, computeMix, slugs } from './engine';
import type { ModelResult, ModelTech, YearState } from './model';
import type { Band, Mix, SourceSlug, Warning } from './types';

// Canonical model-tech → engine-slug fold. Mirrors scripts/eia-tech-map.ts
// (which keeps its own copy so the build-time fetch stays self-contained). Techs
// that return null have no descriptive coefficient and are handled explicitly.
export function engineSlugForModelTech(tech: ModelTech): SourceSlug | null {
  switch (tech) {
    case 'gas_cc':
    case 'gas_peaker':
      return 'gas';
    case 'coal':
      return 'coal';
    case 'oil':
      return 'oil';
    case 'biomass':
      return 'biomass';
    case 'hydro':
      return 'hydro';
    case 'nuclear':
      return 'nuclear';
    case 'wind':
      return 'wind';
    case 'solar':
      return 'solar';
    // Storage and geothermal have no descriptive coefficient.
    case 'battery':
    case 'geothermal':
    case 'other':
      return null;
  }
}

const zero = (): Band => ({ low: 0, central: 0, high: 0 });
const addBand = (a: Band, b: Band): Band => ({ low: a.low + b.low, central: a.central + b.central, high: a.high + b.high });

// Widen a band around its central value by a factor w (w = 1 leaves it
// unchanged). The low bound is clamped at 0 — a widened deaths/CO₂/cost band
// cannot cross into the physically impossible negative.
function widen(b: Band, w: number): Band {
  if (w <= 1) return b;
  return {
    low: Math.max(0, b.central - (b.central - b.low) * w),
    central: b.central,
    high: b.central + (b.high - b.central) * w,
  };
}

export type MetricBands = {
  deaths: Band; // deaths / yr
  co2Mt: Band; // Mt CO₂ / yr
  landKm2: Band; // km² occupied this year (a stock, not a flow)
  costUsdBn: Band; // billion USD / yr
};

export type YearImpact = {
  year: number;
  horizonWideningFactor: number;
  modeledTwh: number; // generation with a descriptive coefficient
  unmodeledTwh: number; // storage / geothermal / other — no coefficient
  unmodeledByTech: Partial<Record<ModelTech, number>>;
  generationBySlug: Partial<Record<SourceSlug, number>>;
  annual: MetricBands;
  // Path-dependent integrals up to and including this year. Deaths, CO₂ and cost
  // are flows, so these are genuine cumulative totals; land is a stock, so its
  // integral is an area·years exposure, labelled as such in the UI.
  cumulative: {
    deaths: Band;
    co2Mt: Band;
    costUsdBn: Band;
    landKm2Years: Band;
  };
  warnings: Warning[];
};

export type ModelImpacts = {
  years: YearImpact[];
  // Generation that never received a coefficient, summed over the run, so the UI
  // can state plainly how much of the mix the impact figures do not cover.
  unmodeledTechs: ModelTech[];
  options: ImpactOptions;
};

export type ImpactOptions = ComputeOptions & {
  // Extra fractional band-widening applied per year beyond the start year, on top
  // of the fixed coefficient band. Default 0.02 → +2 percentage-points of
  // half-band width per year (about +52% band width at a 26-year horizon). A
  // disclosed site assumption; set 0 to compare against the descriptive engine.
  horizonWideningPerYear?: number;
};

const DEFAULT_HORIZON_WIDENING_PER_YEAR = 0.02;

// Fold one year's generation onto engine slugs and apply the coefficient bands.
function impactsForYear(
  state: YearState,
  startYear: number,
  options: ImpactOptions,
  running: { deaths: Band; co2Mt: Band; costUsdBn: Band; landKm2Years: Band },
): YearImpact {
  const generationBySlug = Object.fromEntries(slugs.map((s) => [s, 0])) as Record<SourceSlug, number>;
  const unmodeledByTech: Partial<Record<ModelTech, number>> = {};
  let modeledTwh = 0;
  let unmodeledTwh = 0;

  for (const [tech, twh] of Object.entries(state.generationTwhByTech) as [ModelTech, number][]) {
    if (twh <= 0) continue;
    const slug = engineSlugForModelTech(tech);
    if (slug == null) {
      unmodeledByTech[tech] = (unmodeledByTech[tech] ?? 0) + twh;
      unmodeledTwh += twh;
    } else {
      generationBySlug[slug] += twh;
      modeledTwh += twh;
    }
  }

  // Reuse the descriptive engine verbatim: pass the folded generation as a
  // normalized mix against the modeled total, so each slug receives exactly its
  // own TWh and the coefficient math (fossil anchoring, dominance, warnings) is
  // identical to /build.
  const mix = (modeledTwh > 0
    ? Object.fromEntries(slugs.map((s) => [s, generationBySlug[s] / modeledTwh]))
    : Object.fromEntries(slugs.map((s) => [s, 0]))) as Mix;
  const computed = computeMix(mix, modeledTwh > 0 ? modeledTwh : 1, options);

  const wideningPerYear = options.horizonWideningPerYear ?? DEFAULT_HORIZON_WIDENING_PER_YEAR;
  const w = 1 + Math.max(0, wideningPerYear) * Math.max(0, state.year - startYear);

  const annual: MetricBands = modeledTwh > 0
    ? {
        deaths: widen(computed.deaths.total, w),
        co2Mt: widen(computed.co2.totalMt, w),
        landKm2: widen(computed.land.km2, w),
        costUsdBn: widen(computed.cost.annualUsdBn, w),
      }
    : { deaths: zero(), co2Mt: zero(), landKm2: zero(), costUsdBn: zero() };

  running.deaths = addBand(running.deaths, annual.deaths);
  running.co2Mt = addBand(running.co2Mt, annual.co2Mt);
  running.costUsdBn = addBand(running.costUsdBn, annual.costUsdBn);
  running.landKm2Years = addBand(running.landKm2Years, annual.landKm2);

  return {
    year: state.year,
    horizonWideningFactor: +w.toFixed(4),
    modeledTwh: +modeledTwh.toFixed(3),
    unmodeledTwh: +unmodeledTwh.toFixed(3),
    unmodeledByTech,
    generationBySlug,
    annual,
    cumulative: {
      deaths: { ...running.deaths },
      co2Mt: { ...running.co2Mt },
      costUsdBn: { ...running.costUsdBn },
      landKm2Years: { ...running.landKm2Years },
    },
    warnings: modeledTwh > 0 ? computed.warnings : [],
  };
}

export function computeModelImpacts(result: ModelResult, options: ImpactOptions = {}): ModelImpacts {
  const running = { deaths: zero(), co2Mt: zero(), costUsdBn: zero(), landKm2Years: zero() };
  const years = result.years.map((state) => impactsForYear(state, result.scenario.startYear, options, running));

  const unmodeled = new Set<ModelTech>();
  for (const y of years) for (const tech of Object.keys(y.unmodeledByTech) as ModelTech[]) unmodeled.add(tech);

  return { years, unmodeledTechs: Array.from(unmodeled), options };
}

// Convenience: the descriptive coefficient band for a single source, so the UI
// can show which coefficient drives a model result without reaching into engine.
export function coefficientFor(slug: SourceSlug) {
  return bySlug[slug];
}
