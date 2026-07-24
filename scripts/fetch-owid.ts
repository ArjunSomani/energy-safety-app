import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const OWID_CSV_URL = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
const SOURCE_COLUMNS = {
  coal: ['coal_electricity', 'coal_share_elec'],
  oil: ['oil_electricity', 'oil_share_elec'],
  gas: ['gas_electricity', 'gas_share_elec'],
  biomass: ['biofuel_electricity', 'biofuel_share_elec'],
  hydro: ['hydro_electricity', 'hydro_share_elec'],
  nuclear: ['nuclear_electricity', 'nuclear_share_elec'],
  wind: ['wind_electricity', 'wind_share_elec'],
  solar: ['solar_electricity', 'solar_share_elec'],
} as const;

const AGGREGATE_ISO_CODES = new Set(['OWID_WRL', 'OWID_EUR', 'OWID_AFR', 'OWID_ASI', 'OWID_NAM', 'OWID_SAM', 'OWID_OCE']);

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])));
}

function numberOrNull(value: string) {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasCompleteMix(row: Row) {
  return Object.values(SOURCE_COLUMNS).every(([generationColumn, shareColumn]) => {
    const generation = numberOrNull(row[generationColumn]);
    const share = numberOrNull(row[shareColumn]);
    return generation != null && share != null;
  });
}

function isCountry(row: Row) {
  const iso = row.iso_code;
  return /^[A-Z]{3}$/.test(iso) && !AGGREGATE_ISO_CODES.has(iso);
}

function countryRecord(row: Row) {
  const mix = Object.fromEntries(
    Object.entries(SOURCE_COLUMNS).map(([slug, [, shareColumn]]) => [slug, numberOrNull(row[shareColumn]) ?? 0]),
  );
  const generation = numberOrNull(row.electricity_generation) ?? Object.values(SOURCE_COLUMNS).reduce((sum, [generationColumn]) => sum + (numberOrNull(row[generationColumn]) ?? 0), 0);

  return {
    iso: row.iso_code,
    country: row.country,
    year: Number(row.year),
    population: numberOrNull(row.population),
    demandTwh: generation,
    demandPerCapitaKwh: numberOrNull(row.electricity_demand_per_capita),
    mix,
  };
}

async function main() {
  const response = await fetch(OWID_CSV_URL);
  if (!response.ok) throw new Error(`Failed to fetch OWID CSV: ${response.status} ${response.statusText}`);
  const csv = await response.text();
  const hash = createHash('sha256').update(csv).digest('hex');
  const latestByIso = new Map<string, Row>();
  const regions: Row[] = [];

  for (const row of parseCsv(csv)) {
    if (!hasCompleteMix(row)) continue;
    if (!isCountry(row)) {
      if (row.iso_code) regions.push(row);
      continue;
    }
    const current = latestByIso.get(row.iso_code);
    if (!current || Number(row.year) > Number(current.year)) latestByIso.set(row.iso_code, row);
  }

  const countries = Array.from(latestByIso.values()).map(countryRecord).sort((a, b) => a.country.localeCompare(b.country));
  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/countries.json', `${JSON.stringify(countries, null, 2)}\n`);
  await writeFile('src/data/regions.json', `${JSON.stringify(regions.map((row) => ({ iso: row.iso_code, region: row.country, year: Number(row.year) })), null, 2)}\n`);
  await writeFile('src/data/meta.json', `${JSON.stringify({ owidFetchDate: new Date().toISOString().slice(0, 10), owidHash: hash, owidUrl: OWID_CSV_URL }, null, 2)}\n`);
  console.log(`Wrote ${countries.length} country records from OWID energy data (${hash.slice(0, 12)}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
