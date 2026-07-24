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
  const sum = Object.values(country.mix).reduce((a: any, b: any) => a + b, 0);
  if (Math.abs(sum - 100) > 0.5) fail(`${country.iso} mix sums ${sum}`);
}

if ((Date.now() - Date.parse((meta as any).owidFetchDate)) / 864e5 > 400) fail('countries.json older than 400 days');
if (failed) process.exit(1);
console.log('data validation passed');
