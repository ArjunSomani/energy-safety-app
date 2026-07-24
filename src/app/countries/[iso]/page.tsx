import countries from '@/data/countries.json';
import profiles from '@/data/profiles.json';
import { computeMix, normalizeMix, slugs } from '@/lib/engine';
import { bandText, fmt } from '@/lib/format';
import type { SourceSlug } from '@/lib/types';

export function generateStaticParams() {
  return countries.map((country) => ({ iso: country.iso }));
}

export default async function Page({ params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const country = countries.find((item) => item.iso === iso)!;
  const profile = profiles.find((item) => item.iso === iso);
  const result = computeMix(normalizeMix(country.mix as Record<SourceSlug, number>), country.demandTwh);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-4xl">{country.country}</h1>
      <p className="mono">Latest complete year: {country.year} · population {fmt(country.population)}</p>
      <h2>Electricity mix</h2>
      <div className="grid gap-2">
        {slugs.map((slug) => (
          <p className="panel p-2" key={slug}>{slug}: <span className="mono">{(country.mix as Record<SourceSlug, number>)[slug]}%</span></p>
        ))}
      </div>
      <h2>Estimated annual deaths from generation</h2>
      <p className="mono">{bandText(result.deaths.total, 'per year')}</p>
      <p>These country-level estimates apply global-average rates to a national mix, so they can misstate any specific country.</p>
      <p><a href={`/build?country=${country.iso}`}>Open this mix in the builder →</a></p>
      {profile ? (
        <section className="panel p-4">
          <h2>{profile.energyRelated ? 'Energy-related profile' : 'Worst industrial disaster (not energy-related)'}</h2>
          <p>{profile.event}: {profile.summary}</p>
          <p>Electrocution metric: <span className="mono">{profile.electrocutionDeathsPer100k}</span> deaths per 100k per year. This is end-use electrical accidents, not deaths per TWh.</p>
        </section>
      ) : null}
    </main>
  );
}
