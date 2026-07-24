export type SourceSlug = 'coal' | 'oil' | 'gas' | 'biomass' | 'hydro' | 'nuclear' | 'wind' | 'solar';

export type Band = { low: number; central: number; high: number };
export type NullableBand = { low: number | null; central: number | null; high: number | null };
export type Mix = Record<SourceSlug, number>;

export type WarningId =
  | 'W_HYDRO_BANQIAO'
  | 'W_LOW_TIER_OVERLAP'
  | 'W_COAL_VINTAGE'
  | 'W_NUCLEAR_LNT'
  | 'W_WIND_LAND_DUAL'
  | 'W_MISSING_DATA';

export type Warning = { id: WarningId; message: string };
