/**
 * Display groupings for the /model charts.
 *
 * The model tracks 12 technologies, but a first-time reader does not need 12
 * colors to follow the story. The charts fold them into six intuitive groups
 * whose colors are a colorblind-safe categorical palette (validated in the stack
 * order below, both themes — see globals.css --mix-*). Coal, gas and oil read as
 * one "Fossil fuels" band; the per-source detail lives in the impact figures and
 * on the assumptions page.
 */
import type { ModelTech } from './model';

export type MixGroupKey = 'nuclear' | 'other' | 'hydro' | 'fossil' | 'wind' | 'solar';

export type MixGroup = {
  key: MixGroupKey;
  label: string;
  short: string;
  cssVar: string; // theme-aware color, defined in globals.css
  techs: ModelTech[];
};

// Bottom → top stacking order. This order is what the palette validator was run
// against; keep nuclear (violet) and hydro (blue) non-adjacent.
export const MIX_GROUPS: MixGroup[] = [
  { key: 'nuclear', label: 'Nuclear', short: 'Nuclear', cssVar: 'var(--mix-nuclear)', techs: ['nuclear'] },
  {
    key: 'other',
    label: 'Other (biomass, geothermal, storage)',
    short: 'Other',
    cssVar: 'var(--mix-other)',
    techs: ['biomass', 'geothermal', 'battery', 'other'],
  },
  { key: 'hydro', label: 'Hydro', short: 'Hydro', cssVar: 'var(--mix-hydro)', techs: ['hydro'] },
  { key: 'fossil', label: 'Fossil fuels (coal, gas, oil)', short: 'Fossil fuels', cssVar: 'var(--mix-fossil)', techs: ['coal', 'gas_cc', 'gas_peaker', 'oil'] },
  { key: 'wind', label: 'Wind', short: 'Wind', cssVar: 'var(--mix-wind)', techs: ['wind'] },
  { key: 'solar', label: 'Solar', short: 'Solar', cssVar: 'var(--mix-solar)', techs: ['solar'] },
];

export const GROUP_FOR_TECH: Record<ModelTech, MixGroup> = (() => {
  const m = {} as Record<ModelTech, MixGroup>;
  for (const g of MIX_GROUPS) for (const t of g.techs) m[t] = g;
  return m;
})();

export function groupColorForTech(tech: ModelTech): string {
  return GROUP_FOR_TECH[tech]?.cssVar ?? 'var(--ink-soft)';
}

// Sum a per-tech record into the six display groups.
export function toGroups(byTech: Partial<Record<ModelTech, number>>): Record<MixGroupKey, number> {
  const out = { nuclear: 0, other: 0, hydro: 0, fossil: 0, wind: 0, solar: 0 } as Record<MixGroupKey, number>;
  for (const [tech, v] of Object.entries(byTech) as [ModelTech, number][]) {
    const g = GROUP_FOR_TECH[tech];
    if (g && v) out[g.key] += v;
  }
  return out;
}
