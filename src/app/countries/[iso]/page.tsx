import countries from '@/data/countries.json';
import profiles from '@/data/profiles.json';
import { computeMix, normalizeMix, slugs } from '@/lib/engine';
import { bandText, fmt, peoplePerDeathForMix } from '@/lib/format';
import type { ControlsTier, SourceSlug } from '@/lib/types';

// Aggregates (e.g. World) are not countries and are excluded from the country routes.
const realCountries = countries.filter((c) => !('aggregate' in c && c.aggregate));

export function generateStaticParams() {
  return realCountries.map((country) => ({ iso: country.iso }));
}

const tierLabel: Record<ControlsTier, string> = {
  stringent: 'stringent (European-standard) air-pollution controls',
  moderate: 'moderate air-pollution controls',
  limited: 'limited air-pollution controls',
};

export default async function Page({ params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const country = countries.find((item) => item.iso === iso)!;
  const profile = profiles.find((item) => item.iso === iso);
  const tier = (country.pollutionControls ?? 'moderate') as ControlsTier;
  const result = computeMix(normalizeMix(country.mix as Record<SourceSlug, number>), country.demandTwh, {
    excludeBanqiao: true,
    fossilControls: tier,
  });
  const peoplePerDeath = peoplePerDeathForMix(result.deaths.total, country.demandTwh);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-4xl">{country.country}</h1>
      <p className="mono text-sm text-[var(--ink-soft)]">
        Latest complete year: {country.year} · population {fmt(country.population)} · {tierLabel[tier]}
      </p>

      <h2>Electricity mix</h2>
      <div className="grid gap-2">
        {slugs.map((slug) => (
          <p className="panel p-2" key={slug}>
            {slug}: <span className="mono">{(country.mix as Record<SourceSlug, number>)[slug]}%</span>
          </p>
        ))}
      </div>

      <h2>Estimated annual deaths from generation</h2>
      <p className="mono">{bandText(result.deaths.total, 'per year')}</p>
      {peoplePerDeath ? (
        <p>≈ one death for every {peoplePerDeath}&apos;s annual electricity.</p>
      ) : null}

      <p>
        This estimate is country-adjusted in two ways. Hydro uses the rate excluding the 1975 Banqiao
        Dam failure, which dominates the global figure but does not describe routine operation. Fossil
        rates are anchored to this country&apos;s pollution-controls tier: the high end of the global
        range reflects plants sited near dense population with limited emissions controls; the low end
        reflects European-standard controls. Which end is closer to {country.country} depends on its
        plant siting and regulation, which this coarse estimate does not model directly.
      </p>

      <p>
        <a href={`/build?country=${country.iso}`}>Open this mix in the builder →</a>
      </p>

      {profile ? (
        <section className="panel p-4">
          <h2 style={{ marginTop: 0 }}>
            {profile.energyRelated ? 'Energy-related profile' : 'Worst industrial disaster (not energy-related)'}
          </h2>
          <p>
            {profile.event}: {profile.summary}
          </p>
          <p>
            Electrocution metric: <span className="mono">{profile.electrocutionDeathsPer100k}</span> deaths per 100k per
            year. This is end-use electrical accidents, not deaths per TWh.
          </p>
        </section>
      ) : null}
    </main>
  );
}
