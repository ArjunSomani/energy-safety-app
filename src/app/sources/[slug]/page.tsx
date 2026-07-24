import RiskRule from '@/components/RiskRule';
import citations from '@/data/citations.json';
import sources from '@/data/sources.json';
import { nullableBandText } from '@/lib/format';

export function generateStaticParams() {
  return sources.map((source) => ({ slug: source.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const source = sources.find((item) => item.slug === slug)!;
  const measures = [
    ['Deaths', source.deathRate, 'deaths/TWh'],
    ['CO₂', source.lifecycleCO2, 'gCO₂eq/kWh'],
    ['Land', source.landUse, source.slug === 'wind' ? 'km²/TWh/yr' : 'm²/MWh/yr'],
    ['Cost', source.lcoe, 'USD/MWh'],
  ] as const;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-4xl">{source.label}</h1>
      <p>{source.description}</p>
      <RiskRule items={[source]} />
      <section className="my-6 grid gap-3 md:grid-cols-4">
        {measures.map(([label, band, unit]) => (
          <div className="panel p-4" key={label}>
            <h2>{label}</h2>
            <p className="mono">{nullableBandText(band, unit)}</p>
            {'note' in band && band.note ? <p className="text-sm">{band.note}</p> : null}
            <small>{citations[(band.source as keyof typeof citations)].label}</small>
          </div>
        ))}
      </section>
      <h2>How it kills</h2>
      <p>Mechanisms include accidents in extraction, construction, operation, and modeled health effects where pollutants or radiation exposures are estimated.</p>
      <h2>What dominates the number</h2>
      <p>{source.deathRate.note ?? 'No single note dominates this source record.'}</p>
      <h2>What the estimate does not capture</h2>
      <p>Site conditions, country-specific controls, labor practices, reliability, storage, and long-tail waste questions are outside this coefficient.</p>
      <p><a href={`/build?mix=${source.slug}:100`}>Put this in a grid →</a></p>
    </main>
  );
}
