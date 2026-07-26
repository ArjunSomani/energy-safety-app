import sources from '@/data/sources.json';
import type { Band, ControlsTier, Mix, SourceSlug, Warning } from './types';

export const slugs = ['coal', 'oil', 'gas', 'biomass', 'hydro', 'nuclear', 'wind', 'solar'] as const;

// Combustion sources whose death rate is dominated by air pollution, so a
// country's siting + emissions controls decide which end of the range applies.
const fossilSlugs = new Set<SourceSlug>(['coal', 'oil', 'gas']);

// Roughly the number of EU residents whose annual electricity use equals 1 TWh
// (see /how-we-count). Used to express rates as "people per death".
export const PEOPLE_PER_TWH = 150_000;

export const bySlug = Object.fromEntries(sources.map((source) => [source.slug, source])) as Record<
  SourceSlug,
  (typeof sources)[number]
>;

type MaybeBand = { low?: number | null; central?: number | null; high?: number | null; modeledShare?: number };

const zero = (): Band => ({ low: 0, central: 0, high: 0 });
const add = (a: Band, b: Band): Band => ({ low: a.low + b.low, central: a.central + b.central, high: a.high + b.high });
const scale = (b: Band, k: number): Band => ({ low: b.low * k, central: b.central * k, high: b.high * k });
const band = (value: MaybeBand): Band | null =>
  value.low == null || value.central == null || value.high == null
    ? null
    : { low: value.low, central: value.central, high: value.high };

// Re-anchor a fossil source's global death range to a country's controls tier.
// The global range spans the European-standard baseline (low) to plants sited
// near dense population with limited controls (high). The geometric mean is the
// interior split point.
export function anchorFossilRate(
  rate: { low: number; central: number; high: number; modeledShare?: number },
  tier: ControlsTier,
): { low: number; central: number; high: number; modeledShare?: number } {
  const mid = Math.sqrt(rate.low * rate.high);
  const shape =
    tier === 'stringent'
      ? { low: rate.low, central: rate.low, high: mid }
      : tier === 'limited'
        ? { low: mid, central: rate.high, high: rate.high }
        : { low: rate.low, central: mid, high: rate.high };
  return { ...shape, modeledShare: rate.modeledShare };
}

// Ex-Banqiao hydro rate: the 1975 dam failure dominates the global aggregate and
// does not describe routine operation, so country pages use this instead.
const HYDRO_EX_BANQIAO = { low: 0.02, central: 0.04, high: 0.06, modeledShare: 0.02 };

export function normalizeMix(percent: Partial<Record<SourceSlug, number>>): Mix {
  const total = slugs.reduce((sum, slug) => sum + Math.max(0, percent[slug] ?? 0), 0) || 1;
  return Object.fromEntries(slugs.map((slug) => [slug, Math.max(0, percent[slug] ?? 0) / total])) as Mix;
}

export type ComputeOptions = {
  includeFirmingCost?: boolean;
  excludeBanqiao?: boolean;
  fossilControls?: ControlsTier;
};

export function computeMix(mix: Mix, demandTwh: number, options: ComputeOptions = {}) {
  const { includeFirmingCost = false, excludeBanqiao = false, fossilControls } = options;
  const warnings: Warning[] = [];
  const deaths = { total: zero(), counted: zero(), modeled: zero(), perSource: {} as Record<SourceSlug, Band> };
  let co2TotalMt = zero();
  let landTotalKm2 = zero();
  const landPerSource = {} as Record<SourceSlug, Band>;
  let costUsd = zero();
  const missing = new Set<string>();

  for (const slug of slugs) {
    const share = mix[slug] ?? 0;
    const generationTwh = demandTwh * share;
    const source = bySlug[slug];

    let deathRate: MaybeBand = source.deathRate;
    if (slug === 'hydro' && excludeBanqiao) deathRate = HYDRO_EX_BANQIAO;
    if (fossilControls && fossilSlugs.has(slug)) deathRate = anchorFossilRate(source.deathRate, fossilControls);

    const deathBand = band(deathRate);
    if (deathBand) {
      const value = scale(deathBand, generationTwh);
      const modeledShare = deathRate.modeledShare ?? 0;
      deaths.perSource[slug] = value;
      deaths.total = add(deaths.total, value);
      deaths.modeled = add(deaths.modeled, scale(value, modeledShare));
      deaths.counted = add(deaths.counted, scale(value, 1 - modeledShare));
    } else if (share > 0) {
      missing.add(`${slug} deaths`);
    }

    const co2Band = band(source.lifecycleCO2);
    if (co2Band) {
      co2TotalMt = add(co2TotalMt, scale(co2Band, generationTwh / 1000));
    } else if (share > 0) {
      missing.add(`${slug} CO₂`);
    }

    const landBand = band(source.landUse);
    if (landBand) {
      // m²/MWh/yr and km²/TWh/yr are numerically identical, so generation TWh × stored value = km².
      const landValue = scale(landBand, generationTwh);
      landPerSource[slug] = landValue;
      landTotalKm2 = add(landTotalKm2, landValue);
    } else if (share > 0) {
      missing.add(`${slug} land`);
    }

    const lcoeBand = band(source.lcoe);
    if (lcoeBand) {
      const firmingBand = includeFirmingCost ? band((source as typeof source & { firmingCost?: MaybeBand }).firmingCost ?? {}) : null;
      const allInLcoe = firmingBand ? add(lcoeBand, firmingBand) : lcoeBand;
      costUsd = add(costUsd, scale(allInLcoe, generationTwh * 1_000_000));
    } else if (share > 0) {
      missing.add(`${slug} cost`);
    }
  }

  if (mix.hydro > 0 && !excludeBanqiao) {
    warnings.push({
      id: 'W_HYDRO_BANQIAO',
      title: 'Hydro dominated by one 1975 event',
      message: "Hydro's global death rate is dominated by the 1975 Banqiao Dam failure; excluding it, the rate is about 0.04 deaths/TWh.",
    });
  }
  if (mix.nuclear + mix.wind + mix.solar > 0) {
    warnings.push({
      id: 'W_LOW_TIER_OVERLAP',
      title: 'The safest sources cannot be ranked apart',
      message: 'Nuclear, wind, and solar cannot be reliably ranked against one another; their uncertainty ranges overlap.',
    });
  }
  if (mix.coal > 0 || mix.oil > 0) {
    warnings.push({
      id: 'W_COAL_VINTAGE',
      title: 'Fossil rates come from an older European study',
      message: 'Fossil death rates derive from a 2007 study using European pollution controls; newer global air-pollution research suggests higher impacts.',
    });
  }
  if (mix.nuclear > 0) {
    warnings.push({
      id: 'W_NUCLEAR_LNT',
      title: 'Nuclear deaths are modeled, not counted',
      message: 'Nuclear cancer deaths use the linear no-threshold model, a contested assumption.',
    });
  }
  if (mix.wind > 0) {
    warnings.push({
      id: 'W_WIND_LAND_DUAL',
      title: 'Wind land is a dual figure',
      message: 'Wind land use is shown as a dual figure: total wind-farm area includes turbine spacing, while direct land occupation is much smaller.',
    });
  }

  // Dominance: when a single source drives most of a panel, the aggregate is
  // really a statement about that one source. Naming it prevents misreading.
  const deathsDom = dominantSource(deaths.perSource, deaths.total.central);
  if (deathsDom) {
    warnings.push({
      id: 'W_DOMINANCE_DEATHS',
      title: 'One source drives the death total',
      message: `${bySlug[deathsDom.slug].label} accounts for about ${deathsDom.pct}% of the deaths in this mix — the total mostly reflects that one source, not the grid as a whole.`,
    });
  }
  const landDom = dominantSource(landPerSource, landTotalKm2.central);
  if (landDom) {
    warnings.push({
      id: 'W_DOMINANCE_LAND',
      title: 'One source drives the land total',
      message: `${bySlug[landDom.slug].label} accounts for about ${landDom.pct}% of the land in this mix — the total is really a statement about that source's footprint.`,
    });
  }

  if (missing.size) {
    warnings.push({
      id: 'W_MISSING_DATA',
      title: 'Some coefficients are missing, not zero',
      message: `Missing coefficients omitted rather than zeroed: ${Array.from(missing).join(', ')}.`,
    });
  }

  return {
    deaths,
    co2: {
      totalMt: co2TotalMt,
      gPerKwh: scale(co2TotalMt, 1000 / demandTwh),
    },
    land: { km2: landTotalKm2, perSource: landPerSource },
    cost: {
      usdPerMwh: scale(costUsd, 1 / (demandTwh * 1_000_000)),
      annualUsdBn: scale(costUsd, 1 / 1e9),
    },
    warnings,
  };
}

function dominantSource(perSource: Record<string, Band>, total: number): { slug: SourceSlug; pct: number } | null {
  if (!(total > 0)) return null;
  let top: { slug: SourceSlug; central: number } | null = null;
  for (const [slug, value] of Object.entries(perSource)) {
    if (!top || value.central > top.central) top = { slug: slug as SourceSlug, central: value.central };
  }
  if (!top) return null;
  const share = top.central / total;
  return share > 0.6 ? { slug: top.slug, pct: Math.round(share * 100) } : null;
}
