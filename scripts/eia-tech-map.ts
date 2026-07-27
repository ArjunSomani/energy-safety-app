// Mapping from EIA vocabulary to Level's model technologies.
//
// The model tracks a slightly finer set than the descriptive engine (it splits
// gas into combined-cycle vs peaker and adds battery), because construction
// lead time and capacity factor differ sharply between them. When applying
// Level's per-TWh coefficients, model.ts folds these back to engine slugs.

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

// EIA-860 "technology" string → model technology.
export function techFromEia(technology: string): ModelTech {
  const t = technology.toLowerCase();
  // Pumped storage reports as "Hydroelectric Pumped Storage" — it is storage,
  // not a generator, so it must be caught before the generic 'hydro' rule.
  if (t.includes('pumped storage')) return 'battery';
  if (t.includes('coal') || t.includes('petroleum coke')) return 'coal';
  if (t.includes('combined cycle')) return 'gas_cc';
  if (t.includes('combustion turbine') || t.includes('internal combustion') || t.includes('gas fired steam') || t.includes('natural gas steam'))
    return 'gas_peaker';
  if (t.includes('nuclear')) return 'nuclear';
  if (t.includes('wind')) return 'wind';
  if (t.includes('solar')) return 'solar';
  if (t.includes('hydroelectric') || t.includes('hydro')) return 'hydro';
  if (t.includes('batter')) return 'battery';
  if (t.includes('petroleum') || t.includes('oil')) return 'oil';
  if (t.includes('wood') || t.includes('biomass') || t.includes('landfill') || t.includes('municipal solid waste') || t.includes('waste'))
    return 'biomass';
  if (t.includes('geothermal')) return 'geothermal';
  return 'other';
}

// EIA fuel-type id (electric-power-operational-data / EIA-930) → model technology.
// Used for capacity factors and hourly generation shapes.
export function techFromFuelType(fuelTypeId: string): ModelTech | null {
  switch (fuelTypeId.toUpperCase()) {
    case 'COW': // coal
      return 'coal';
    case 'NG': // natural gas (930 does not split CC vs CT; treated as gas fleet)
      return 'gas_cc';
    case 'NUC':
      return 'nuclear';
    case 'WND':
      return 'wind';
    case 'SUN':
    case 'SPV':
      return 'solar';
    case 'HYC': // conventional hydro
      return 'hydro';
    case 'HPS': // pumped storage
      return 'battery';
    case 'PEL': // petroleum liquids
    case 'PC': // petroleum coke
      return 'oil';
    case 'WWW': // wood & wood-derived
    case 'WAS': // other biomass / waste
      return 'biomass';
    case 'GEO':
      return 'geothermal';
    default:
      return null;
  }
}

// Fold a model technology onto the descriptive engine's source slug, so the
// model reuses the exact same per-TWh coefficients. Returns null for things the
// engine has no coefficient for (storage), which the model handles explicitly.
export function engineSlugForTech(tech: ModelTech): string | null {
  switch (tech) {
    case 'gas_cc':
    case 'gas_peaker':
      return 'gas';
    case 'battery':
    case 'geothermal':
    case 'other':
      return null;
    default:
      return tech; // coal, nuclear, wind, solar, hydro, oil, biomass
  }
}
