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
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th>Country</th>
            <th>Year</th>
            <th>Generation</th>
            <th>Controls</th>
            <th>Estimated deaths</th>
            <th>CO₂ intensity</th>
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
                <td>
                  <a href={`/countries/${country.iso}`}>{country.country}</a>
                </td>
                <td>{country.year}</td>
                <td>{fmt(country.demandTwh)} TWh</td>
                <td className="mono text-xs">{tier}</td>
                <td>
                  {fmt(result.deaths.total.low)}–{fmt(result.deaths.total.high)}
                </td>
                <td>{fmt(result.co2.gPerKwh.central)} g/kWh</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
