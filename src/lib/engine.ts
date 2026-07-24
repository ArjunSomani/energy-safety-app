import sources from '@/data/sources.json';
import type { Band, Mix, SourceSlug, Warning } from './types';

export const slugs = ['coal', 'oil', 'gas', 'biomass', 'hydro', 'nuclear', 'wind', 'solar'] as const;

export const bySlug = Object.fromEntries(sources.map((source) => [source.slug, source])) as Record<
  SourceSlug,
  (typeof sources)[number]
>;

type MaybeBand = { low?: number | null; central?: number | null; high?: number | null };

const zero = (): Band => ({ low: 0, central: 0, high: 0 });
const add = (a: Band, b: Band): Band => ({ low: a.low + b.low, central: a.central + b.central, high: a.high + b.high });
const band = (value: MaybeBand): Band | null =>
  value.low == null || value.central == null || value.high == null
    ? null
    : { low: value.low, central: value.central, high: value.high };

export function normalizeMix(percent: Partial<Record<SourceSlug, number>>): Mix {
  const total = slugs.reduce((sum, slug) => sum + Math.max(0, percent[slug] ?? 0), 0) || 1;
  return Object.fromEntries(slugs.map((slug) => [slug, Math.max(0, percent[slug] ?? 0) / total])) as Mix;
}

export function computeMix(mix: Mix, demandTwh: number, includeFirmingCost = false, excludeBanqiao = false) {
  const warnings: Warning[] = [];
  const deaths = { total: zero(), counted: zero(), modeled: zero(), perSource: {} as Record<SourceSlug, Band> };
  let co2TotalMt = zero();
  let landTotalKm2 = zero();
  let costUsd = zero();
  const missing = new Set<string>();

  for (const slug of slugs) {
    const share = mix[slug] ?? 0;
    const generationTwh = demandTwh * share;
    const source = bySlug[slug];
    const deathRate = excludeBanqiao && slug === 'hydro'
      ? { low: 0.04, central: 0.04, high: 0.04, modeledShare: 0.02 }
      : source.deathRate;

    const deathBand = band(deathRate);
    if (deathBand) {
      const value = {
        low: generationTwh * deathBand.low,
        central: generationTwh * deathBand.central,
        high: generationTwh * deathBand.high,
      };
      const modeledShare = deathRate.modeledShare ?? 0;
      deaths.perSource[slug] = value;
      deaths.total = add(deaths.total, value);
      deaths.modeled = add(deaths.modeled, {
        low: value.low * modeledShare,
        central: value.central * modeledShare,
        high: value.high * modeledShare,
      });
      deaths.counted = add(deaths.counted, {
        low: value.low * (1 - modeledShare),
        central: value.central * (1 - modeledShare),
        high: value.high * (1 - modeledShare),
      });
    } else if (share > 0) {
      missing.add(`${slug} deaths`);
    }

    const co2Band = band(source.lifecycleCO2);
    if (co2Band) {
      co2TotalMt = add(co2TotalMt, {
        low: (generationTwh * co2Band.low) / 1000,
        central: (generationTwh * co2Band.central) / 1000,
        high: (generationTwh * co2Band.high) / 1000,
      });
    } else if (share > 0) {
      missing.add(`${slug} CO₂`);
    }

    const landBand = band(source.landUse);
    if (landBand) {
      // m²/MWh/yr and km²/TWh/yr are numerically identical, so generation TWh × stored value = km².
      landTotalKm2 = add(landTotalKm2, {
        low: generationTwh * landBand.low,
        central: generationTwh * landBand.central,
        high: generationTwh * landBand.high,
      });
    } else if (share > 0) {
      missing.add(`${slug} land`);
    }

    const lcoeBand = band(source.lcoe);
    if (lcoeBand) {
      const firmingBand = includeFirmingCost ? band((source as typeof source & { firmingCost?: MaybeBand }).firmingCost ?? {}) : null;
      const allInLcoe = firmingBand ? add(lcoeBand, firmingBand) : lcoeBand;
      costUsd = add(costUsd, {
        low: generationTwh * 1_000_000 * allInLcoe.low,
        central: generationTwh * 1_000_000 * allInLcoe.central,
        high: generationTwh * 1_000_000 * allInLcoe.high,
      });
    } else if (share > 0) {
      missing.add(`${slug} cost`);
    }
  }

  if (mix.hydro > 0) {
    warnings.push({
      id: 'W_HYDRO_BANQIAO',
      message: "Hydro's global death rate is dominated by the 1975 Banqiao Dam failure; excluding it, the rate is about 0.04 deaths/TWh.",
    });
  }
  if (mix.nuclear + mix.wind + mix.solar > 0) {
    warnings.push({
      id: 'W_LOW_TIER_OVERLAP',
      message: 'Nuclear, wind, and solar cannot be reliably ranked against one another; their uncertainty ranges overlap.',
    });
  }
  if (mix.coal > 0 || mix.oil > 0) {
    warnings.push({
      id: 'W_COAL_VINTAGE',
      message: 'Fossil death rates derive from a 2007 study using European pollution controls; newer global air-pollution research suggests higher impacts.',
    });
  }
  if (mix.nuclear > 0) {
    warnings.push({ id: 'W_NUCLEAR_LNT', message: 'Nuclear cancer deaths use the linear no-threshold model, a contested assumption.' });
  }
  if (mix.wind > 0) {
    warnings.push({
      id: 'W_WIND_LAND_DUAL',
      message: 'Wind land use is shown as a dual figure: total wind-farm area includes turbine spacing, while direct land occupation is much smaller.',
    });
  }
  if (missing.size) {
    warnings.push({
      id: 'W_MISSING_DATA',
      message: `Missing coefficients omitted rather than zeroed: ${Array.from(missing).join(', ')}.`,
    });
  }

  return {
    deaths,
    co2: {
      totalMt: co2TotalMt,
      gPerKwh: {
        low: (co2TotalMt.low * 1000) / demandTwh,
        central: (co2TotalMt.central * 1000) / demandTwh,
        high: (co2TotalMt.high * 1000) / demandTwh,
      },
    },
    land: { km2: landTotalKm2 },
    cost: {
      usdPerMwh: {
        low: costUsd.low / (demandTwh * 1_000_000),
        central: costUsd.central / (demandTwh * 1_000_000),
        high: costUsd.high / (demandTwh * 1_000_000),
      },
      annualUsdBn: { low: costUsd.low / 1e9, central: costUsd.central / 1e9, high: costUsd.high / 1e9 },
    },
    warnings,
  };
}
