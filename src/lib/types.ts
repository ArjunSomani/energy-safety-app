export type SourceSlug = 'coal' | 'oil' | 'gas' | 'biomass' | 'hydro' | 'nuclear' | 'wind' | 'solar';

export type Band = { low: number; central: number; high: number };
export type NullableBand = { low: number | null; central: number | null; high: number | null };
export type Mix = Record<SourceSlug, number>;

// Coarse three-way flag for a country's air-pollution controls / plant siting.
// Selects which end of the fossil death range anchors that country's estimate.
export type ControlsTier = 'stringent' | 'moderate' | 'limited';

export type WarningId =
  | 'W_HYDRO_BANQIAO'
  | 'W_LOW_TIER_OVERLAP'
  | 'W_COAL_VINTAGE'
  | 'W_NUCLEAR_LNT'
  | 'W_WIND_LAND_DUAL'
  | 'W_DOMINANCE_DEATHS'
  | 'W_DOMINANCE_LAND'
  | 'W_MISSING_DATA';

// `title` is the human-readable label shown in the UI; `id` stays stable for
// tests and internal wiring and is never rendered to users.
export type Warning = { id: WarningId; title: string; message: string };
