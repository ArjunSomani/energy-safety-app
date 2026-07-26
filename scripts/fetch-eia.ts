/**
 * Build-time fetch for the US transition model (step 1 of the model spec).
 *
 * Pulls directly from the EIA API v2 (JSON, no Excel):
 *   - operating-generator-capacity  → generator-level fleet (EIA-860M equivalent)
 *   - electric-power-operational-data → national capacity total + capacity factors
 *   - electricity/rto/region-data     → hourly demand shapes (EIA-930)
 *
 * Requires EIA_API_KEY as a build-time env var. The key must NEVER be committed
 * or shipped to the client — this runs at build time only, and the processed
 * output (fleet.json etc.) is what gets committed, same three-tier pattern as
 * fetch-owid.ts.
 *
 * NOTE: This script has not yet been run against the live API from this
 * environment (api.eia.gov is blocked by the current network egress policy), so
 * exact response field names should be confirmed on the first successful run
 * and adjusted here if EIA's schema differs. The structure, pagination, and
 * throttling are production-shaped.
 *
 * Usage:  EIA_API_KEY=xxxx npx tsx scripts/fetch-eia.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { engineSlugForTech, type ModelTech, techFromEia, techFromFuelType } from './eia-tech-map';

const API = 'https://api.eia.gov/v2';
const KEY = process.env.EIA_API_KEY;
const PAGE = 5000; // EIA max rows per request
const THROTTLE_MS = 300; // stay well under the per-second rate limit

if (!KEY) {
  console.error('EIA_API_KEY is not set. Get a free key at https://www.eia.gov/opendata/ and export it.');
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type EiaResponse<T> = {
  response: { total?: number | string; data: T[]; warnings?: unknown[] };
};

// Single GET against the EIA API. `params` values may repeat (e.g. multiple
// data[] columns), so we accept an array of [key, value] pairs.
async function eiaGet<T>(route: string, params: [string, string][]): Promise<EiaResponse<T>> {
  const usp = new URLSearchParams();
  usp.set('api_key', KEY as string);
  for (const [k, v] of params) usp.append(k, v);
  const url = `${API}${route}?${usp.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`EIA ${route} → HTTP ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as EiaResponse<T>;
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

// ---- 1. Latest available period for the monthly generator dataset ----
async function latestGeneratorPeriod(): Promise<string> {
  const res = await eiaGet<{ period: string }>('/electricity/operating-generator-capacity/data/', [
    ['frequency', 'monthly'],
    ['data[]', 'nameplate-capacity-mw'],
    ['sort[0][column]', 'period'],
    ['sort[0][direction]', 'desc'],
    ['length', '1'],
  ]);
  const period = res.response.data[0]?.period;
  if (!period) throw new Error('Could not determine latest generator period from EIA.');
  return period;
}

type GeneratorRow = {
  period: string;
  stateid?: string;
  plantid?: string | number;
  generatorid?: string;
  technology?: string;
  'prime-mover-code'?: string;
  'energy-source-code'?: string;
  status?: string;
  statusDescription?: string;
  'balancing-authority-code'?: string;
  'nameplate-capacity-mw'?: string | number;
  'operating-year-month'?: string;
  'planned-retirement-year-month'?: string;
};

type FleetGenerator = {
  tech: ModelTech;
  engineSlug: string | null;
  capacityMw: number;
  commissionYear: number | null;
  retirementYear: number | null;
  ba: string | null;
  state: string | null;
};

function yearFromYm(ym?: string): number | null {
  if (!ym) return null;
  const y = Number(String(ym).slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : null;
}

// ---- 2. Operating fleet, one row per generator ----
async function fetchFleet(period: string): Promise<FleetGenerator[]> {
  const rows = await eiaGetAll<GeneratorRow>('/electricity/operating-generator-capacity/data/', [
    ['frequency', 'monthly'],
    ['data[]', 'nameplate-capacity-mw'],
    ['start', period],
    ['end', period],
  ]);

  const fleet: FleetGenerator[] = [];
  for (const r of rows) {
    // Operating units only (status "OP"); standby/retired are excluded from the
    // reconciled operating total.
    const status = (r.status ?? '').toUpperCase();
    if (status && status !== 'OP') continue;
    const capacityMw = Number(r['nameplate-capacity-mw']);
    if (!Number.isFinite(capacityMw) || capacityMw <= 0) continue;
    const tech = techFromEia(r.technology ?? r['prime-mover-code'] ?? '');
    fleet.push({
      tech,
      engineSlug: engineSlugForTech(tech),
      capacityMw,
      commissionYear: yearFromYm(r['operating-year-month']),
      retirementYear: yearFromYm(r['planned-retirement-year-month']),
      ba: r['balancing-authority-code'] ?? null,
      state: r.stateid ?? null,
    });
  }
  return fleet;
}

// ---- 3. Independent national capacity total (for reconciliation) ----
async function fetchNationalCapacityMw(): Promise<{ year: number; totalMw: number }> {
  // electric-power-operational-data, "capability" (existing net summer capacity),
  // all sectors (99), all fuels, US total, latest annual.
  const rows = await eiaGetAll<{ period: string; capability?: string | number; fueltypeid?: string }>(
    '/electricity/electric-power-operational-data/data/',
    [
      ['frequency', 'annual'],
      ['data[]', 'capability'],
      ['facets[location][]', 'US'],
      ['facets[sectorid][]', '99'],
      ['sort[0][column]', 'period'],
      ['sort[0][direction]', 'desc'],
      ['length', '500'],
    ],
  );
  const latestYear = Math.max(...rows.map((r) => Number(r.period)).filter(Number.isFinite));
  const totalMw = rows
    .filter((r) => Number(r.period) === latestYear && (r.fueltypeid ?? '').toUpperCase() === 'ALL')
    .reduce((sum, r) => sum + (Number(r.capability) || 0), 0);
  return { year: latestYear, totalMw };
}

// ---- 4. Empirical capacity factors by technology ----
async function fetchCapacityFactors(): Promise<Record<string, number>> {
  // Net generation (GWh) and capability (MW) by fuel type, US, latest annual.
  const rows = await eiaGetAll<{ period: string; fueltypeid?: string; generation?: string; capability?: string }>(
    '/electricity/electric-power-operational-data/data/',
    [
      ['frequency', 'annual'],
      ['data[]', 'generation'],
      ['data[]', 'capability'],
      ['facets[location][]', 'US'],
      ['facets[sectorid][]', '99'],
      ['sort[0][column]', 'period'],
      ['sort[0][direction]', 'desc'],
      ['length', '5000'],
    ],
  );
  const latestYear = Math.max(...rows.map((r) => Number(r.period)).filter(Number.isFinite));
  const byTech: Record<string, { genMwh: number; capMw: number }> = {};
  for (const r of rows) {
    if (Number(r.period) !== latestYear) continue;
    const tech = techFromFuelType(r.fueltypeid ?? '');
    if (!tech) continue;
    const genMwh = (Number(r.generation) || 0) * 1000; // GWh → MWh
    const capMw = Number(r.capability) || 0;
    byTech[tech] ??= { genMwh: 0, capMw: 0 };
    byTech[tech].genMwh += genMwh;
    byTech[tech].capMw += capMw;
  }
  const cf: Record<string, number> = {};
  for (const [tech, { genMwh, capMw }] of Object.entries(byTech)) {
    if (capMw > 0) cf[tech] = +(genMwh / (capMw * 8760)).toFixed(4);
  }
  return cf;
}

type HourlyRow = { period: string; value?: string | number; respondent?: string };

// ---- 5. Hourly demand → representative seasonal-diurnal profiles ----
// Compress a recent full year of US48 hourly demand into 4 seasons × 24 hours of
// normalized shape (mean demand = 1.0). The client never sees raw 8,760 series.
async function fetchLoadProfiles(): Promise<{ year: number; region: string; profiles: Record<string, number[]> }> {
  const now = new Date(); // build-time only; not used inside the pure model
  const year = now.getUTCFullYear() - 1;
  const rows = await eiaGetAll<HourlyRow>('/electricity/rto/region-data/data/', [
    ['frequency', 'hourly'],
    ['data[]', 'value'],
    ['facets[respondent][]', 'US48'],
    ['facets[type][]', 'D'], // demand
    ['start', `${year}-01-01T00`],
    ['end', `${year}-12-31T23`],
    ['length', '5000'],
  ]);

  const seasons = ['winter', 'spring', 'summer', 'autumn'] as const;
  const sums: Record<string, number[]> = Object.fromEntries(seasons.map((s) => [s, new Array(24).fill(0)]));
  const counts: Record<string, number[]> = Object.fromEntries(seasons.map((s) => [s, new Array(24).fill(0)]));
  const seasonOf = (month: number) => (month <= 1 || month === 11 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'autumn');

  for (const r of rows) {
    const value = Number(r.value);
    if (!Number.isFinite(value)) continue;
    // EIA hourly period format: "YYYY-MM-DDTHH"
    const p = String(r.period);
    const month = Number(p.slice(5, 7)) - 1;
    const hour = Number(p.slice(11, 13));
    if (!Number.isFinite(month) || !Number.isFinite(hour)) continue;
    const s = seasonOf(month);
    sums[s][hour] += value;
    counts[s][hour] += 1;
  }

  const profiles: Record<string, number[]> = {};
  for (const s of seasons) {
    const avg = sums[s].map((sum, h) => (counts[s][h] ? sum / counts[s][h] : 0));
    const mean = avg.reduce((a, b) => a + b, 0) / (avg.filter((x) => x > 0).length || 1);
    profiles[s] = avg.map((x) => +(mean ? x / mean : 0).toFixed(4)); // normalized shape
  }
  return { year, region: 'US48', profiles };
}

async function main() {
  console.log('Fetching EIA data (direct API v2)…');
  const period = await latestGeneratorPeriod();
  console.log(`Latest generator period: ${period}`);

  await sleep(THROTTLE_MS);
  const fleet = await fetchFleet(period);
  const fleetTotalMw = fleet.reduce((s, g) => s + g.capacityMw, 0);
  console.log(`Fleet: ${fleet.length} operating generators, ${(fleetTotalMw / 1000).toFixed(1)} GW total.`);

  await sleep(THROTTLE_MS);
  const national = await fetchNationalCapacityMw();

  await sleep(THROTTLE_MS);
  const capacityFactors = await fetchCapacityFactors();

  await sleep(THROTTLE_MS);
  const loadProfiles = await fetchLoadProfiles();

  // Reconciliation, reported up front (the model spec's gate).
  const diffPct = national.totalMw > 0 ? ((fleetTotalMw - national.totalMw) / national.totalMw) * 100 : NaN;
  console.log('\n=== FLEET RECONCILIATION ===');
  console.log(`  Fleet sum (operating nameplate): ${(fleetTotalMw / 1000).toFixed(1)} GW`);
  console.log(`  EIA national capability (${national.year}): ${(national.totalMw / 1000).toFixed(1)} GW`);
  console.log(`  Difference: ${diffPct.toFixed(2)}%  ${Math.abs(diffPct) <= 2 ? '✓ within 2%' : '✗ exceeds 2%'}`);
  console.log('  (nameplate vs net-summer capability differ by design; 2% is a loose sanity gate)\n');

  await mkdir('src/data', { recursive: true });

  // Aggregate the fleet into cohorts for a compact committed artifact: group by
  // (tech, commissionYear, retirementYear) and sum capacity.
  const cohortMap = new Map<string, { tech: ModelTech; engineSlug: string | null; commissionYear: number | null; retirementYear: number | null; capacityMw: number; count: number }>();
  for (const g of fleet) {
    const key = `${g.tech}|${g.commissionYear ?? '?'}|${g.retirementYear ?? '?'}`;
    const c = cohortMap.get(key) ?? { tech: g.tech, engineSlug: g.engineSlug, commissionYear: g.commissionYear, retirementYear: g.retirementYear, capacityMw: 0, count: 0 };
    c.capacityMw += g.capacityMw;
    c.count += 1;
    cohortMap.set(key, c);
  }
  const cohorts = Array.from(cohortMap.values())
    .map((c) => ({ ...c, capacityMw: +c.capacityMw.toFixed(1) }))
    .sort((a, b) => b.capacityMw - a.capacityMw);

  const byTech: Record<string, number> = {};
  for (const c of cohorts) byTech[c.tech] = +(((byTech[c.tech] ?? 0) + c.capacityMw)).toFixed(1);

  await writeFile('src/data/fleet.json', `${JSON.stringify({ period, totalMw: +fleetTotalMw.toFixed(1), byTech, cohorts }, null, 2)}\n`);
  await writeFile('src/data/capacity-factors.json', `${JSON.stringify(capacityFactors, null, 2)}\n`);
  await writeFile('src/data/load-profiles.json', `${JSON.stringify(loadProfiles, null, 2)}\n`);
  await writeFile(
    'src/data/eia-meta.json',
    `${JSON.stringify(
      {
        eiaFetchDate: new Date().toISOString().slice(0, 10),
        generatorPeriod: period,
        nationalCapabilityYear: national.year,
        nationalCapabilityMw: +national.totalMw.toFixed(1),
        fleetTotalMw: +fleetTotalMw.toFixed(1),
        reconciliationDiffPct: +diffPct.toFixed(2),
        loadProfileYear: loadProfiles.year,
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
