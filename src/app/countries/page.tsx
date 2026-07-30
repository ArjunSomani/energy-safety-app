import Link from 'next/link';
import countries from '@/data/countries.json';
import { computeMix, normalizeMix } from '@/lib/engine';
import { fmt } from '@/lib/format';
import type { ControlsTier, SourceSlug } from '@/lib/types';

const realCountries = countries.filter((c) => !('aggregate' in c && c.aggregate));

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-4xl">Countries</h1>
      <p>
        Seed country index with generation, mix summary, estimated generation deaths, and data vintage. Country
        estimates use the hydro rate excluding Banqiao and anchor fossil rates to each country&apos;s pollution-controls
        tier, so they read differently from the global source table.
      </p>
      <div className="overflow-auto">
        <table className="mt-4 w-full border-collapse text-sm table-responsive">
        <caption className="sr-only">Electricity mix and modelled death rate for each country in the dataset.</caption>
        <thead>
          <tr>
            <th scope="col">Country</th>
            <th scope="col">Year</th>
            <th scope="col">Generation</th>
            <th scope="col">Controls</th>
            <th scope="col">Estimated deaths</th>
            <th scope="col">CO₂ intensity</th>
          </tr>
        </thead>
        <tbody>
          {realCountries.map((country) => {
            const tier = (country.pollutionControls ?? 'moderate') as ControlsTier;
            const result = computeMix(normalizeMix(country.mix as Record<SourceSlug, number>), country.demandTwh, {
              excludeBanqiao: true,
              fossilControls: tier,
            });
            return (
              <tr className="border-t" key={country.iso}>
                <td data-label="Country">
                  <Link href={`/countries/${country.iso}`}>{country.country}</Link>
                </td>
                <td data-label="Year">{country.year}</td>
                <td data-label="Generation">{fmt(country.demandTwh)} TWh</td>
                <td className="mono text-xs" data-label="Controls">{tier}</td>
                <td data-label="Estimated deaths">
                  {fmt(result.deaths.total.low)}–{fmt(result.deaths.total.high)}
                </td>
                <td data-label="CO₂ intensity">{fmt(result.co2.gPerKwh.central)} g/kWh</td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </main>
  );
}
