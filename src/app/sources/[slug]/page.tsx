import RiskRule from '@/components/RiskRule';
import citations from '@/data/citations.json';
import sources from '@/data/sources.json';
import { nullableBandText, peoplePerDeathText } from '@/lib/format';

export function generateStaticParams() {
  return sources.map((source) => ({ slug: source.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const source = sources.find((item) => item.slug === slug)!;
  // Land is stored in km²/TWh/yr and m²/MWh/yr interchangeably (numerically
  // identical); show one unit everywhere so pages don't appear to disagree.
  const measures = [
    ['Deaths', source.deathRate, 'deaths/TWh'],
    ['CO₂', source.lifecycleCO2, 'gCO₂eq/kWh'],
    ['Land', source.landUse, 'km²/TWh/yr'],
    ['Cost', source.lcoe, 'USD/MWh'],
  ] as const;

  const deathRate = source.deathRate as typeof source.deathRate & {
    highBoundDerived?: boolean;
    highBoundNote?: string;
    note?: string;
    howItKills?: string;
    whatDominates?: string;
  };
  const perDeath = peoplePerDeathText(source.deathRate);
  const highDerived = Boolean(deathRate.highBoundDerived);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-4xl">{source.label}</h1>
      <p>{source.description}</p>
      {perDeath ? (
        <p className="lede">
          At this rate, one death corresponds to about <span className="mono">{perDeath}</span>&apos;s annual electricity.
        </p>
      ) : null}
      <RiskRule items={[source]} />
      <section className="my-6 grid gap-3 md:grid-cols-4">
        {measures.map(([label, band, unit]) => (
          <div className="panel p-4" key={label}>
            <h2 style={{ marginTop: 0 }}>{label}</h2>
            <p className="mono">{nullableBandText(band, unit)}</p>
            {'note' in band && band.note ? <p className="text-sm">{band.note}</p> : null}
            <small>{citations[(band.source as keyof typeof citations)].label}</small>
          </div>
        ))}
      </section>

      {highDerived ? (
        <p className="panel p-3 text-sm" style={{ borderLeft: '3px solid var(--warn)', background: 'var(--warn-soft)' }}>
          <b style={{ color: 'var(--warn)' }}>On the upper bound</b> — {deathRate.highBoundNote}
        </p>
      ) : null}

      <h2>How it kills</h2>
      <p>
        {deathRate.howItKills ??
          'Mechanisms span extraction, construction, operation, and modeled health effects where pollutant or radiation exposures are estimated.'}
      </p>

      <h2>What dominates the number</h2>
      <p>{deathRate.whatDominates ?? deathRate.note ?? 'No single term dominates this source record.'}</p>

      <h2>What the estimate does not capture</h2>
      <p>
        Site conditions, country-specific controls, labor practices, reliability, storage, and long-tail waste
        questions are outside this coefficient.
      </p>
      <p>
        <a href={`/build?mix=${source.slug}:100`}>Put this in a grid →</a>
      </p>
    </main>
  );
}
