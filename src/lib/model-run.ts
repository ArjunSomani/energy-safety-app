/**
 * US transition model — run orchestrator + presets (feeds the /model UI).
 *
 * Loads the committed EIA base data (fleet, capacity factors, load and VRE
 * profiles) and ties the four pure engines together — stock-and-flow, impacts,
 * dispatch, feedbacks — into one result a scenario produces. Everything below is
 * deterministic given a scenario; the JSON it imports is the build-time EIA
 * snapshot, never a live call.
 */
import capacityFactors from '@/data/capacity-factors.json';
import eiaMeta from '@/data/eia-meta.json';
import fleetData from '@/data/fleet.json';
import loadProfiles from '@/data/load-profiles.json';
import vreProfiles from '@/data/vre-profiles.json';
import {
  type Cohort,
  DEFAULT_CAPACITY_FACTORS,
  type ModelResult,
  type ModelTech,
  type Scenario,
  type TechMap,
  runModel,
} from './model';
import { type DispatchResult, type LoadProfiles, type VreProfiles, dispatchYear } from './model-dispatch';
import { type ImpactOptions, type ModelImpacts, computeModelImpacts } from './model-impacts';
import { type FeedbackOptions, type ModelFeedbacks, computeFeedbacks } from './model-feedbacks';
import type { ControlsTier } from './types';

export const BASE_YEAR = eiaMeta.baseYear;
export const START_YEAR = BASE_YEAR + 1;
export const END_YEAR = 2050;
export const BASE_DEMAND_TWH = Math.round(eiaMeta.nationalGenerationTwh);

// The committed fleet, as model cohorts. count/engineSlug are dropped — the model
// recomputes the engine fold itself.
export const BASE_FLEET: Cohort[] = fleetData.cohorts.map((c) => ({
  tech: c.tech as ModelTech,
  capacityMw: c.capacityMw,
  commissionYear: c.commissionYear,
  retirementYear: c.retirementYear,
}));

// Empirical capacity factors override the model defaults where EIA gives a clean
// signal; the rest fall back to the model's published defaults.
export const EIA_CAPACITY_FACTORS: TechMap<number> = capacityFactors as TechMap<number>;
export const MERGED_CAPACITY_FACTORS: Partial<Record<ModelTech, number>> = {
  ...DEFAULT_CAPACITY_FACTORS,
  ...(capacityFactors as TechMap<number>),
};

export const LOAD: LoadProfiles = loadProfiles as unknown as LoadProfiles;
export const VRE: VreProfiles = vreProfiles as unknown as VreProfiles;

// Techs the UI exposes as build-rate controls, in display order.
export const BUILDABLE_TECHS: ModelTech[] = ['solar', 'wind', 'battery', 'nuclear', 'gas_cc', 'gas_peaker'];

export type RetirementPolicy = 'announced-and-age' | 'announced-only';

// A scenario as the UI holds it: model knobs plus the disclosed feedback and
// impact assumptions the user can turn.
export type UiScenario = {
  label: string;
  buildRatesGw: TechMap<number>;
  demandGrowth: number;
  retirementPolicy: RetirementPolicy;
  solarLearningRate: number;
  batteryLearningRate: number;
  fossilControls?: ControlsTier;
};

// Techs with a very long life so only *announced* retirements fire.
const NEVER_AGES: TechMap<number> = {
  coal: 1000,
  gas_cc: 1000,
  gas_peaker: 1000,
  nuclear: 1000,
  wind: 1000,
  solar: 1000,
  hydro: 1000,
  battery: 1000,
  oil: 1000,
  biomass: 1000,
  geothermal: 1000,
  other: 1000,
};

export function toScenario(ui: UiScenario): Scenario {
  return {
    startYear: START_YEAR,
    endYear: END_YEAR,
    buildRatesGw: ui.buildRatesGw,
    demandGrowth: ui.demandGrowth,
    initialDemandTwh: BASE_DEMAND_TWH,
    capacityFactors: EIA_CAPACITY_FACTORS,
    techLife: ui.retirementPolicy === 'announced-only' ? NEVER_AGES : undefined,
  };
}

export type ScenarioRun = {
  ui: UiScenario;
  scenario: Scenario;
  model: ModelResult;
  impacts: ModelImpacts;
  feedbacks: ModelFeedbacks;
  dispatchByYear: DispatchResult[];
};

// Default horizon-uncertainty widening (see model-impacts). Exposed so the UI and
// the assumptions page name the same number.
export const HORIZON_WIDENING_PER_YEAR = 0.02;

export function runScenario(ui: UiScenario): ScenarioRun {
  const scenario = toScenario(ui);
  const model = runModel(BASE_FLEET, scenario);

  const impactOptions: ImpactOptions = {
    fossilControls: ui.fossilControls,
    horizonWideningPerYear: HORIZON_WIDENING_PER_YEAR,
  };
  const impacts = computeModelImpacts(model, impactOptions);

  const feedbackOptions: FeedbackOptions = {
    learning: {
      solar: { learningRate: ui.solarLearningRate, baseCumulativeGw: fleetData.byTech.solar / 1000, baseCostPerKw: 1100 },
      battery: {
        learningRate: ui.batteryLearningRate,
        baseCumulativeGw: fleetData.byTech.battery / 1000,
        baseCostPerKw: 1400,
      },
    },
  };
  const feedbacks = computeFeedbacks(model, feedbackOptions);

  const dispatchByYear = model.years.map((y) =>
    dispatchYear(y.capacityMwByTech, y.demandTwh, y.year, LOAD, VRE, { capacityFactors: MERGED_CAPACITY_FACTORS }),
  );

  return { ui, scenario, model, impacts, feedbacks, dispatchByYear };
}

// --- Presets (neutrality #1: named for what they DO, never optimal/realistic) ---

export const DEFAULT_UI_SCENARIO: UiScenario = {
  label: 'Recent build rates continue',
  buildRatesGw: { solar: 45, wind: 10, battery: 25, gas_cc: 12, nuclear: 2 },
  demandGrowth: 0.01,
  retirementPolicy: 'announced-and-age',
  solarLearningRate: 0.2,
  batteryLearningRate: 0.18,
};

export const PRESETS: UiScenario[] = [
  DEFAULT_UI_SCENARIO,
  {
    label: 'Announced retirements only, no new build',
    buildRatesGw: {},
    demandGrowth: 0.01,
    retirementPolicy: 'announced-only',
    solarLearningRate: 0.2,
    batteryLearningRate: 0.18,
  },
  {
    label: 'No new fossil',
    buildRatesGw: { solar: 65, wind: 18, battery: 35, nuclear: 2 },
    demandGrowth: 0.01,
    retirementPolicy: 'announced-and-age',
    solarLearningRate: 0.2,
    batteryLearningRate: 0.18,
  },
  {
    label: 'High demand growth, mixed build',
    buildRatesGw: { solar: 85, wind: 22, battery: 50, gas_cc: 28, nuclear: 3 },
    demandGrowth: 0.035,
    retirementPolicy: 'announced-and-age',
    solarLearningRate: 0.2,
    batteryLearningRate: 0.18,
  },
  {
    label: 'Gas-forward build',
    buildRatesGw: { gas_cc: 18, gas_peaker: 4, solar: 20, battery: 5 },
    demandGrowth: 0.01,
    retirementPolicy: 'announced-and-age',
    solarLearningRate: 0.2,
    batteryLearningRate: 0.18,
  },
  {
    label: 'Nuclear-forward build',
    buildRatesGw: { nuclear: 12, solar: 25, wind: 8, battery: 15, gas_cc: 5 },
    demandGrowth: 0.01,
    retirementPolicy: 'announced-and-age',
    solarLearningRate: 0.2,
    batteryLearningRate: 0.18,
  },
];

// --- Per-tech display metadata for charts. Colors avoid the UI accent blue, per
// the site's charts-never-use-accent rule, and read in both themes. ---
export const TECH_META: Record<ModelTech, { label: string; color: string }> = {
  solar: { label: 'Solar', color: '#d9a441' },
  wind: { label: 'Wind', color: '#4f9d8f' },
  hydro: { label: 'Hydro', color: '#2f6f8f' },
  nuclear: { label: 'Nuclear', color: '#6a4d9c' },
  gas_cc: { label: 'Gas (CC)', color: '#8c6d4a' },
  gas_peaker: { label: 'Gas (peaker)', color: '#b89a72' },
  coal: { label: 'Coal', color: '#3f3a34' },
  oil: { label: 'Oil', color: '#6b5544' },
  biomass: { label: 'Biomass', color: '#7a8b4a' },
  geothermal: { label: 'Geothermal', color: '#a55a4a' },
  battery: { label: 'Battery', color: '#9aa0a6' },
  other: { label: 'Other', color: '#b7b3ab' },
};

// Stacking order for the generation-mix area chart (bottom → top).
export const STACK_ORDER: ModelTech[] = [
  'nuclear',
  'hydro',
  'geothermal',
  'biomass',
  'coal',
  'gas_cc',
  'gas_peaker',
  'oil',
  'wind',
  'solar',
  'battery',
  'other',
];

// Compact scenario serialization for shareable URLs + A/B links.
export function uiScenarioToQuery(ui: UiScenario, prefix = ''): URLSearchParams {
  const p = new URLSearchParams();
  const k = (s: string) => `${prefix}${s}`;
  const builds = BUILDABLE_TECHS.filter((t) => (ui.buildRatesGw[t] ?? 0) > 0).map((t) => `${t}:${ui.buildRatesGw[t]}`);
  if (builds.length) p.set(k('b'), builds.join(','));
  p.set(k('g'), String(ui.demandGrowth));
  p.set(k('r'), ui.retirementPolicy === 'announced-only' ? 'a' : 'g');
  p.set(k('ls'), String(ui.solarLearningRate));
  p.set(k('lb'), String(ui.batteryLearningRate));
  if (ui.fossilControls) p.set(k('fc'), ui.fossilControls);
  return p;
}

export function uiScenarioFromQuery(params: URLSearchParams, base: UiScenario, prefix = ''): UiScenario {
  const k = (s: string) => `${prefix}${s}`;
  const next: UiScenario = { ...base, buildRatesGw: { ...base.buildRatesGw }, label: 'Custom' };
  const b = params.get(k('b'));
  if (b != null) {
    next.buildRatesGw = {};
    for (const pair of b.split(',')) {
      const [tech, gw] = pair.split(':');
      if ((BUILDABLE_TECHS as string[]).includes(tech) && Number.isFinite(Number(gw))) {
        next.buildRatesGw[tech as ModelTech] = Number(gw);
      }
    }
  }
  const g = Number(params.get(k('g')));
  if (Number.isFinite(g)) next.demandGrowth = g;
  const r = params.get(k('r'));
  if (r === 'a') next.retirementPolicy = 'announced-only';
  else if (r === 'g') next.retirementPolicy = 'announced-and-age';
  const ls = Number(params.get(k('ls')));
  if (Number.isFinite(ls) && ls > 0) next.solarLearningRate = ls;
  const lb = Number(params.get(k('lb')));
  if (Number.isFinite(lb) && lb > 0) next.batteryLearningRate = lb;
  const fc = params.get(k('fc'));
  if (fc === 'stringent' || fc === 'moderate' || fc === 'limited') next.fossilControls = fc;
  return next;
}
