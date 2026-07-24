import countries from '@/data/countries.json';
import { computeMix, normalizeMix } from '@/lib/engine';
import { fmt } from '@/lib/format';
import type { SourceSlug } from '@/lib/types';

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-4xl">Countries</h1>
      <p>Seed country index with generation, mix summary, estimated generation deaths, and data vintage.</p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr><th>Country</th><th>Year</th><th>Generation</th><th>Estimated deaths</th><th>CO₂ intensity</th></tr>
        </thead>
        <tbody>
          {countries.map((country) => {
            const result = computeMix(normalizeMix(country.mix as Record<SourceSlug, number>), country.demandTwh);
            return (
              <tr className="border-t" key={country.iso}>
                <td><a href={`/countries/${country.iso}`}>{country.country}</a></td>
                <td>{country.year}</td>
                <td>{fmt(country.demandTwh)} TWh</td>
                <td>{fmt(result.deaths.total.low)}–{fmt(result.deaths.total.high)}</td>
                <td>{fmt(result.co2.gPerKwh.central)} g/kWh</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
