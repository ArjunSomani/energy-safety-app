import { existsSync, readFileSync } from 'node:fs';
import citations from '../src/data/citations.json';
import countries from '../src/data/countries.json';
import meta from '../src/data/meta.json';
import sources from '../src/data/sources.json';

let failed = false;
const citationIds = new Set(Object.keys(citations));
const fail = (message: string) => { console.error(message); failed = true; };

for (const source of sources as any[]) {
  for (const key of ['deathRate', 'lifecycleCO2', 'landUse', 'lcoe']) {
    const band = source[key];
    if (band.status === 'TO_SOURCE') fail(`${source.slug}.${key} has TO_SOURCE`);
    if (!citationIds.has(band.source)) fail(`${source.slug}.${key} bad source`);
    const allNull = band.low == null && band.central == null && band.high == null && band.status === 'NO_COMPARABLE_DATA';
    const ordered = band.low != null && band.central != null && band.high != null && band.low <= band.central && band.central <= band.high;
    if (!allNull && !ordered) fail(`${source.slug}.${key} invalid band`);
  }
  if (source.firmingCost && !citationIds.has(source.firmingCost.source)) fail(`${source.slug}.firmingCost bad source`);
}

for (const country of countries as any[]) {
  const sum = (Object.values(country.mix) as number[]).reduce((a: number, b: number) => a + b, 0);
  if (Math.abs(sum - 100) > 0.5) fail(`${country.iso} mix sums ${sum}`);
}

if ((Date.now() - Date.parse((meta as any).owidFetchDate)) / 864e5 > 400) fail('countries.json older than 400 days');

// ---- Model data gate (EIA) — only enforced once the fetch has run ----
// The fleet must reconcile against EIA's published national total before any
// model code is trusted. Until fetch-eia.ts has produced these files, the
// checks are skipped so the descriptive build stays green.
if (existsSync('src/data/eia-meta.json')) {
  const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const eiaMeta = read('src/data/eia-meta.json');
  const fleet = read('src/data/fleet.json');
  const cf = read('src/data/capacity-factors.json');

  if (Math.abs(eiaMeta.reconciliationDiffPct) > 2) {
    fail(`EIA fleet reconciliation off by ${eiaMeta.reconciliationDiffPct}% (limit 2%)`);
  }
  const needCf = ['coal', 'gas_cc', 'gas_peaker', 'nuclear', 'wind', 'solar', 'hydro', 'oil', 'biomass'];
  for (const tech of Object.keys(fleet.byTech ?? {})) {
    if (!needCf.includes(tech)) continue;
    const key = tech === 'gas_peaker' ? 'gas_cc' : tech; // 930 does not split gas CC vs CT
    if (cf[key] == null) fail(`capacity factor missing for ${tech}`);
  }
  if ((Date.now() - Date.parse(eiaMeta.eiaFetchDate)) / 864e5 > 400) fail('EIA data older than 400 days');
  if (!failed) console.log(`EIA model data validated (fleet reconciles within ${Math.abs(eiaMeta.reconciliationDiffPct)}%)`);
} else {
  console.log('EIA model data not present yet (run scripts/fetch-eia.ts) — skipping model validation');
}

if (failed) process.exit(1);
console.log('data validation passed');
