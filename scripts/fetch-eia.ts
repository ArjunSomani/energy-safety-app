/**
 * Build-time fetch for the US transition model (step 1 of the model spec).
 *
 * Pulls directly from the EIA API v2 (JSON, no Excel):
 *   - operating-generator-capacity          → generator-level operating fleet
 *   - state-electricity-profiles/capability  → independent national capacity total
 *                                              (net summer, for reconciliation + CF denominator)
 *   - electric-power-operational-data        → national net generation by fuel (CF numerator)
 *   - electricity/rto/region-data            → hourly US48 demand → seasonal load shapes
 *
 * Requires EIA_API_KEY as a build-time env var. The key must NEVER be committed
 * or shipped to the client — this runs at build time only, and the processed
 * output (fleet.json etc.) is what gets committed, same three-tier pattern as
 * fetch-owid.ts.
 *
 * Reconciliation is like-for-like: the fleet is summed on NET SUMMER capacity and
 * compared to EIA's published national net-summer capability for the same year.
 * (Nameplate is also reported, for reference, but is ~7% higher and is not the
 * reconciliation basis.) The fleet snapshot is taken at December of the latest
 * year for which the national capability figure exists, so both sides describe
 * the same instant.
 *
 * Usage:  EIA_API_KEY=xxxx npx tsx scripts/fetch-eia.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { engineSlugForTech, type ModelTech, techFromEia } from './eia-tech-map';

const API = 'https://api.eia.gov/v2';
const KEY = process.env.EIA_API_KEY;
const PAGE = 5000; // EIA max rows per request
const THROTTLE_MS = 250; // stay well under the per-second rate limit
const HOURS_PER_YEAR = 8760;

if (!KEY) {
  console.error('EIA_API_KEY is not set. Get a free key at https://www.eia.gov/opendata/ and export it.');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type EiaResponse<T> = {
  response: { total?: number | string; data: T[]; warnings?: unknown[] };
};

// Single GET against the EIA API. `params` values may repeat (e.g. multiple
// data[] columns), so we accept an array of [key, value] pairs. Transient 5xx
// and network errors are retried with exponential backoff — the public API
// occasionally returns a 500 under load.
async function eiaGet<T>(route: string, params: [string, string][], attempt = 0): Promise<EiaResponse<T>> {
  const usp = new URLSearchParams();
  usp.set('api_key', KEY as string);
  for (const [k, v] of params) usp.append(k, v);
  const url = `${API}${route}?${usp.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status >= 500 && attempt < 4) {
        await sleep(1000 * 2 ** attempt);
        return eiaGet<T>(route, params, attempt + 1);
      }
      throw new Error(`EIA ${route} → HTTP ${res.status} ${res.statusText}\n${await res.text()}`);
    }
    return (await res.json()) as EiaResponse<T>;
  } catch (err) {
    if (attempt < 4) {
      await sleep(1000 * 2 ** attempt);
      return eiaGet<T>(route, params, attempt + 1);
    }
    throw err;
  }
}

// Fetch every page of a data route, respecting the rate limit.
async function eiaGetAll<T>(route: string, params: [string, string][]): Promise<T[]> {
  const first = await eiaGet<T>(route, [...params, ['offset', '0'], ['length', String(PAGE)]]);
  const total = Number(first.response.total ?? first.response.data.length);
  const rows = [...first.response.data];
  for (let offset = PAGE; offset < total; offset += PAGE) {
    await sleep(THROTTLE_MS);
    const page = await eiaGet<T>(route, [...params, ['offset', String(offset)], ['length', String(PAGE)]]);
    rows.push(...page.response.data);
  }
  return rows;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ---- 1. Latest year for which a national capability figure exists ----
// This becomes the model's base year: the fleet snapshot and every reconciled
// figure describe this year, so nothing is compared across time.
async function latestCapabilityYear(): Promise<number> {
  const res = await eiaGet<{ period: string }>('/electricity/state-electricity-profiles/capability/data/', [
    ['data[]', 'capability'],
    ['facets[stateId][]', 'US'],
    ['facets[producertypeid][]', 'TOT'],
    ['facets[energysourceid][]', 'ALL'],
    ['sort[0][column]', 'period'],
    ['sort[0][direction]', 'desc'],
    ['length', '1'],
  ]);
  const year = Number(res.response.data[0]?.period);
  if (!Number.isFinite(year)) throw new Error('Could not determine latest capability year from EIA.');
  return year;
}

type GeneratorRow = {
  period: string;
  stateid?: string;
  technology?: string;
  prime_mover_code?: string;
  status?: string;
  balancing_authority_code?: string | null;
  'nameplate-capacity-mw'?: string | number;
  'net-summer-capacity-mw'?: string | number;
  'operating-year-month'?: string;
  'planned-retirement-year-month'?: string | null;
};

type FleetGenerator = {
  tech: ModelTech;
  engineSlug: string | null;
  capacityMw: number; // net summer — the basis for reconciliation and generation
  nameplateMw: number;
  commissionYear: number | null;
  retirementYear: number | null;
  ba: string | null;
  state: string | null;
};

function yearFromYm(ym?: string | null): number | null {
  if (!ym) return null;
  const y = Number(String(ym).slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : null;
}

// ---- 2. Operating fleet, one row per generator, at the base-year December ----
async function fetchFleet(period: string): Promise<FleetGenerator[]> {
  const rows = await eiaGetAll<GeneratorRow>('/electricity/operating-generator-capacity/data/', [
    ['frequency', 'monthly'],
    // Data columns must be requested explicitly; facets (technology, status,
    // prime_mover_code, balancing_authority_code, stateid) come back automatically.
    ['data[]', 'nameplate-capacity-mw'],
    ['data[]', 'net-summer-capacity-mw'],
    ['data[]', 'operating-year-month'],
    ['data[]', 'planned-retirement-year-month'],
    ['start', period],
    ['end', period],
  ]);

  const fleet: FleetGenerator[] = [];
  for (const r of rows) {
    // Operating units only (status "OP"). Standby (SB), out-of-service (OS/OA)
    // are excluded from the reconciled operating total.
    if ((r.status ?? '').toUpperCase() !== 'OP') continue;
    const capacityMw = num(r['net-summer-capacity-mw']);
    if (capacityMw <= 0) continue;
    const tech = techFromEia(r.technology ?? r.prime_mover_code ?? '');
    fleet.push({
      tech,
      engineSlug: engineSlugForTech(tech),
      capacityMw,
      nameplateMw: num(r['nameplate-capacity-mw']),
      commissionYear: yearFromYm(r['operating-year-month']),
      retirementYear: yearFromYm(r['planned-retirement-year-month']),
      ba: r.balancing_authority_code ?? null,
      state: r.stateid ?? null,
    });
  }
  if (fleet.length === 0) throw new Error(`No operating generators returned for period ${period}.`);
  return fleet;
}

// ---- 3. Independent national net-summer capability (for reconciliation) ----
async function fetchNationalCapability(year: number): Promise<{ totalMw: number; byEnergySource: Record<string, number> }> {
  // state-electricity-profiles/capability, US aggregate row, all producer types,
  // one row per energy source. energysourceid=ALL is the national total.
  const rows = await eiaGetAll<{ energysourceid?: string; capability?: string | number }>(
    '/electricity/state-electricity-profiles/capability/data/',
    [
      ['data[]', 'capability'],
      ['facets[stateId][]', 'US'],
      ['facets[producertypeid][]', 'TOT'],
      ['start', String(year)],
      ['end', String(year)],
    ],
  );
  const byEnergySource: Record<string, number> = {};
  let totalMw = 0;
  for (const r of rows) {
    const id = (r.energysourceid ?? '').toUpperCase();
    const mw = num(r.capability);
    if (id === 'ALL') totalMw = mw;
    else byEnergySource[id] = mw;
  }
  if (totalMw <= 0) throw new Error(`No national capability total (energysourceid=ALL) for ${year}.`);
  return { totalMw, byEnergySource };
}

// ---- 4. National net generation by fuel (CF numerator) ----
// electric-power-operational-data has no capacity column, only generation; we
// pair it with the fleet's net-summer capacity to get realized capacity factors.
async function fetchGenerationByTech(year: number): Promise<Record<string, number>> {
  const rows = await eiaGetAll<{ fueltypeid?: string; generation?: string | number }>(
    '/electricity/electric-power-operational-data/data/',
    [
      ['frequency', 'annual'],
      ['data[]', 'generation'],
      ['facets[location][]', 'US'],
      ['facets[sectorid][]', '99'], // all sectors
      ['start', String(year)],
      ['end', String(year)],
    ],
  );
  // Raw generation (TWh) keyed by EIA fuel-type id. Values are thousand MWh (GWh).
  const raw: Record<string, number> = {};
  for (const r of rows) {
    const id = (r.fueltypeid ?? '').toUpperCase();
    raw[id] = num(r.generation) / 1000; // GWh → TWh
  }

  // Fold the non-overlapping leaf fuel codes onto model techs. Aggregate codes
  // (ALL, FOS, REN, AOR, PET, BIO …) are deliberately ignored to avoid double
  // counting. Petroleum coke (PC) is folded into coal, matching techFromEia,
  // which classifies "Petroleum Coke" generators as coal.
  const gen: Record<string, number> = {};
  const put = (tech: string, twh: number) => {
    if (twh) gen[tech] = (gen[tech] ?? 0) + twh;
  };
  put('coal', (raw.COW ?? 0) + (raw.PC ?? 0));
  put('gas', raw.NG ?? 0); // total gas; split into CC/peaker in computeCapacityFactors
  put('nuclear', raw.NUC ?? 0);
  put('wind', raw.WND ?? 0);
  put('solar', raw.SUN ?? 0); // utility-scale (matches capability's SOL); excludes DPV
  put('hydro', raw.HYC ?? 0);
  put('oil', raw.PEL ?? 0);
  put('biomass', (raw.WWW ?? 0) + (raw.WAS ?? 0));
  put('geothermal', raw.GEO ?? 0);
  return gen;
}

// Combustion turbines / IC engines / gas steam run as peakers; a full-year
// realized CF for them cannot be isolated from national data (generation is not
// reported CC-vs-peaker), so peakers use this disclosed site assumption and the
// combined-cycle CF is the residual that makes total gas generation reconcile.
const GAS_PEAKER_CF_ASSUMPTION = 0.12;

// ---- 5. Realized capacity factors by model tech ----
// CF = full-year generation / (base-year net-summer capacity × 8760). Using the
// same net-summer capacity the model carries means the model's year-0 generation
// reproduces EIA's actual generation for the base year, per tech.
function computeCapacityFactors(
  genByTech: Record<string, number>,
  fleetCapByTech: Record<string, number>,
): { cf: Record<string, number>; gasBlendedCf: number } {
  const cf: Record<string, number> = {};
  const capTwhDivisor = (mw: number) => (mw * HOURS_PER_YEAR) / 1e6; // MW → TWh at 100% CF
  for (const tech of ['coal', 'nuclear', 'wind', 'solar', 'hydro', 'oil', 'biomass', 'geothermal']) {
    const gen = genByTech[tech] ?? 0;
    const cap = fleetCapByTech[tech] ?? 0;
    if (cap > 0 && gen > 0) cf[tech] = +(gen / capTwhDivisor(cap)).toFixed(4);
  }

  // Gas: total generation (genByTech.gas) is split across the fleet's CC and
  // peaker capacity. Peakers take the disclosed assumption; CC absorbs the
  // residual so CC_gen + peaker_gen == total gas generation exactly.
  const gasGen = genByTech.gas ?? 0;
  const ccCap = fleetCapByTech.gas_cc ?? 0;
  const peakCap = fleetCapByTech.gas_peaker ?? 0;
  const gasBlendedCf = ccCap + peakCap > 0 ? +(gasGen / capTwhDivisor(ccCap + peakCap)).toFixed(4) : 0;
  if (peakCap > 0) cf.gas_peaker = GAS_PEAKER_CF_ASSUMPTION;
  if (ccCap > 0) {
    const peakerGen = capTwhDivisor(peakCap) * GAS_PEAKER_CF_ASSUMPTION;
    const ccGen = Math.max(0, gasGen - peakerGen);
    cf.gas_cc = +(ccGen / capTwhDivisor(ccCap)).toFixed(4);
  }
  return { cf, gasBlendedCf };
}

type HourlyRow = { period: string; value?: string | number };

// ---- 6. Hourly demand → representative seasonal-diurnal profiles ----
// Compress a full year of US48 hourly demand into 4 seasons × 24 hours of shape,
// normalized so the mean over ALL 8,760 hours is 1.0. Seasonal magnitude is thus
// preserved (summer hours sit above 1.0, spring below), which the dispatch step
// needs. The client never sees the raw 8,760-point series.
async function fetchLoadProfiles(year: number): Promise<{
  year: number;
  region: string;
  annualMeanMw: number;
  seasonDays: Record<string, number>;
  profiles: Record<string, number[]>;
}> {
  const rows = await eiaGetAll<HourlyRow>('/electricity/rto/region-data/data/', [
    ['frequency', 'hourly'],
    ['data[]', 'value'],
    ['facets[respondent][]', 'US48'],
    ['facets[type][]', 'D'], // demand
    ['start', `${year}-01-01T00`],
    ['end', `${year}-12-31T23`],
  ]);

  const seasons = ['winter', 'spring', 'summer', 'autumn'] as const;
  const sums: Record<string, number[]> = Object.fromEntries(seasons.map((s) => [s, new Array(24).fill(0)]));
  const counts: Record<string, number[]> = Object.fromEntries(seasons.map((s) => [s, new Array(24).fill(0)]));
  // month is 0-indexed: Dec/Jan/Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn.
  const seasonOf = (m: number) => (m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn');
  const daysSeen: Record<string, Set<string>> = Object.fromEntries(seasons.map((s) => [s, new Set<string>()]));

  let grandSum = 0;
  let grandCount = 0;
  for (const r of rows) {
    const value = Number(r.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    const p = String(r.period); // "YYYY-MM-DDTHH"
    const month = Number(p.slice(5, 7)) - 1;
    const hour = Number(p.slice(11, 13));
    if (!Number.isFinite(month) || !Number.isFinite(hour)) continue;
    const s = seasonOf(month);
    sums[s][hour] += value;
    counts[s][hour] += 1;
    daysSeen[s].add(p.slice(0, 10));
    grandSum += value;
    grandCount += 1;
  }
  if (grandCount === 0) throw new Error(`No hourly demand returned for ${year}.`);
  const annualMeanMw = grandSum / grandCount;

  const profiles: Record<string, number[]> = {};
  for (const s of seasons) {
    profiles[s] = sums[s].map((sum, h) => +(counts[s][h] ? sum / counts[s][h] / annualMeanMw : 0).toFixed(4));
  }
  const seasonDays = Object.fromEntries(seasons.map((s) => [s, daysSeen[s].size]));
  return { year, region: 'US48', annualMeanMw: +annualMeanMw.toFixed(0), seasonDays, profiles };
}

// ---- 7. Hourly wind & solar shape (EIA-930 generation by fuel) ----
// Representative season × 24-hour shapes for the variable renewables, each
// normalized so its own annual-mean hour is 1.0. Multiplying a shape by
// (capacity × capacity factor) reconstructs hourly output whose annual energy
// equals the stock-and-flow generation exactly, while capturing when the energy
// actually arrives — solar zero at night, wind flatter. Same UTC hour indexing
// as the demand profile, so supply and demand line up hour-for-hour in dispatch.
async function fetchVreShapes(
  year: number,
  seasonDays: Record<string, number>,
): Promise<Record<'wind' | 'solar', Record<string, number[]>>> {
  const seasons = ['winter', 'spring', 'summer', 'autumn'] as const;
  const seasonOf = (m: number) => (m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn');
  const totalHours = seasons.reduce((a, s) => a + (seasonDays[s] ?? 0) * 24, 0);
  const out: Record<'wind' | 'solar', Record<string, number[]>> = { wind: {}, solar: {} };

  for (const [tech, fuel] of [
    ['wind', 'WND'],
    ['solar', 'SUN'],
  ] as const) {
    const rows = await eiaGetAll<{ period: string; value?: string | number }>('/electricity/rto/fuel-type-data/data/', [
      ['frequency', 'hourly'],
      ['data[]', 'value'],
      ['facets[respondent][]', 'US48'],
      ['facets[fueltype][]', fuel],
      ['start', `${year}-01-01T00`],
      ['end', `${year}-12-31T23`],
    ]);
    const sums: Record<string, number[]> = Object.fromEntries(seasons.map((s) => [s, new Array(24).fill(0)]));
    const counts: Record<string, number[]> = Object.fromEntries(seasons.map((s) => [s, new Array(24).fill(0)]));
    for (const r of rows) {
      const value = Number(r.value);
      if (!Number.isFinite(value) || value < 0) continue; // storage-hour negatives excluded
      const p = String(r.period);
      const month = Number(p.slice(5, 7)) - 1;
      const hour = Number(p.slice(11, 13));
      if (!Number.isFinite(month) || !Number.isFinite(hour)) continue;
      const s = seasonOf(month);
      sums[s][hour] += value;
      counts[s][hour] += 1;
    }
    // Hour-of-day averages within each season (robust to data gaps).
    const avg: Record<string, number[]> = Object.fromEntries(
      seasons.map((s) => [s, sums[s].map((sum, h) => (counts[s][h] ? sum / counts[s][h] : 0))]),
    );
    // Normalize by the DAY-WEIGHTED mean (the same seasonDays the dispatch uses),
    // so Σ shape[s][h]·seasonDays[s] = totalHours exactly. This makes the
    // dispatch's reconstructed VRE energy equal the stock-and-flow generation
    // (capacity × capacity factor × hours), rather than drifting when hours are
    // missing from EIA's raw series.
    const weightedMean =
      totalHours > 0
        ? seasons.reduce((acc, s) => acc + avg[s].reduce((a, b) => a + b, 0) * (seasonDays[s] ?? 0), 0) / totalHours
        : 0;
    for (const s of seasons) {
      out[tech][s] = avg[s].map((v) => +(weightedMean ? v / weightedMean : 0).toFixed(4));
    }
    await sleep(THROTTLE_MS);
  }
  return out;
}

async function main() {
  console.log('Fetching EIA data (direct API v2)…');
  const baseYear = await latestCapabilityYear();
  const period = `${baseYear}-12`;
  console.log(`Base year: ${baseYear} (fleet snapshot ${period}, all figures net summer)`);

  await sleep(THROTTLE_MS);
  const fleet = await fetchFleet(period);
  const fleetTotalMw = fleet.reduce((s, g) => s + g.capacityMw, 0);
  const fleetNameplateMw = fleet.reduce((s, g) => s + g.nameplateMw, 0);
  const byTech: Record<string, number> = {};
  for (const g of fleet) byTech[g.tech] = +((byTech[g.tech] ?? 0) + g.capacityMw).toFixed(1);
  console.log(`Fleet: ${fleet.length} operating generators, ${(fleetTotalMw / 1000).toFixed(1)} GW net summer.`);

  await sleep(THROTTLE_MS);
  const national = await fetchNationalCapability(baseYear);

  await sleep(THROTTLE_MS);
  const genByTech = await fetchGenerationByTech(baseYear);

  await sleep(THROTTLE_MS);
  const { cf: capacityFactors, gasBlendedCf } = computeCapacityFactors(genByTech, byTech);

  await sleep(THROTTLE_MS);
  const loadProfiles = await fetchLoadProfiles(baseYear);

  await sleep(THROTTLE_MS);
  const vreShapes = await fetchVreShapes(baseYear, loadProfiles.seasonDays);

  // Reconciliation, reported up front (the model spec's gate). Net summer vs
  // net summer, same year — the difference should be small.
  const diffPct = national.totalMw > 0 ? ((fleetTotalMw - national.totalMw) / national.totalMw) * 100 : NaN;
  console.log('\n=== FLEET RECONCILIATION ===');
  console.log(`  Fleet sum (operating, net summer): ${(fleetTotalMw / 1000).toFixed(1)} GW`);
  console.log(`  EIA national capability (${baseYear}): ${(national.totalMw / 1000).toFixed(1)} GW`);
  console.log(`  Difference: ${diffPct.toFixed(2)}%  ${Math.abs(diffPct) <= 2 ? '✓ within 2%' : '✗ exceeds 2%'}`);
  console.log(`  (fleet nameplate ${(fleetNameplateMw / 1000).toFixed(1)} GW — not the reconciliation basis)`);
  console.log('\n  Fleet by technology (net summer GW):');
  for (const [t, mw] of Object.entries(byTech).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t.padEnd(11)} ${(mw / 1000).toFixed(1).padStart(7)}   CF ${capacityFactors[t] != null ? capacityFactors[t] : '  —'}`);
  }
  console.log('');

  await mkdir('src/data', { recursive: true });

  // Aggregate the fleet into cohorts for a compact committed artifact: group by
  // (tech, commissionYear, retirementYear) and sum net-summer capacity.
  const cohortMap = new Map<
    string,
    { tech: ModelTech; engineSlug: string | null; commissionYear: number | null; retirementYear: number | null; capacityMw: number; count: number }
  >();
  for (const g of fleet) {
    const key = `${g.tech}|${g.commissionYear ?? '?'}|${g.retirementYear ?? '?'}`;
    const c =
      cohortMap.get(key) ??
      { tech: g.tech, engineSlug: g.engineSlug, commissionYear: g.commissionYear, retirementYear: g.retirementYear, capacityMw: 0, count: 0 };
    c.capacityMw += g.capacityMw;
    c.count += 1;
    cohortMap.set(key, c);
  }
  const cohorts = Array.from(cohortMap.values())
    .map((c) => ({ ...c, capacityMw: +c.capacityMw.toFixed(1) }))
    .sort((a, b) => b.capacityMw - a.capacityMw);

  const generationTwhByTech: Record<string, number> = {};
  for (const [k, v] of Object.entries(genByTech)) generationTwhByTech[k] = +v.toFixed(1);

  await writeFile(
    'src/data/fleet.json',
    `${JSON.stringify({ baseYear, period, capacityBasis: 'net-summer-mw', totalMw: +fleetTotalMw.toFixed(1), totalNameplateMw: +fleetNameplateMw.toFixed(1), byTech, cohorts }, null, 2)}\n`,
  );
  await writeFile('src/data/capacity-factors.json', `${JSON.stringify(capacityFactors, null, 2)}\n`);
  await writeFile('src/data/load-profiles.json', `${JSON.stringify(loadProfiles, null, 2)}\n`);
  await writeFile(
    'src/data/vre-profiles.json',
    `${JSON.stringify({ year: loadProfiles.year, region: 'US48', normalization: 'annual-mean hour = 1.0', wind: vreShapes.wind, solar: vreShapes.solar }, null, 2)}\n`,
  );
  await writeFile(
    'src/data/eia-meta.json',
    `${JSON.stringify(
      {
        eiaFetchDate: new Date().toISOString().slice(0, 10),
        baseYear,
        generatorPeriod: period,
        capacityBasis: 'net-summer capacity (MW)',
        nationalCapabilityYear: baseYear,
        nationalCapabilityMw: +national.totalMw.toFixed(1),
        fleetTotalMw: +fleetTotalMw.toFixed(1),
        fleetNameplateMw: +fleetNameplateMw.toFixed(1),
        reconciliationDiffPct: +diffPct.toFixed(2),
        loadProfileYear: loadProfiles.year,
        nationalGenerationTwh: +Object.values(genByTech).reduce((a, b) => a + b, 0).toFixed(1),
        generationTwhByTech,
        gasBlendedCf,
        notes: {
          reconciliation:
            'Fleet net-summer sum vs EIA state-electricity-profiles national capability (energysourceid=ALL), same year. Nameplate is ~7% higher and is not the basis.',
          gasCapacityFactor: `Gas generation is not reported combined-cycle vs peaker at national scale. Peakers use a disclosed assumption of CF=${GAS_PEAKER_CF_ASSUMPTION}; the combined-cycle CF is the residual so total gas generation reconciles exactly. Blended gas CF was ${gasBlendedCf}.`,
          solarCapacityFactor:
            'Capacity factors use base-year net-summer capacity as the denominator so the model reproduces EIA base-year generation exactly. For fast-growing resources (solar, battery) this yields a fleet-average realized CF below the per-unit CF of a plant that operated the full year.',
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote fleet.json (${cohorts.length} cohorts), capacity-factors.json, load-profiles.json, eia-meta.json.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
