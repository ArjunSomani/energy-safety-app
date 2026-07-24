import citations from '@/data/citations.json';
import countries from '@/data/countries.json';
import meta from '@/data/meta.json';
import profiles from '@/data/profiles.json';
import sources from '@/data/sources.json';

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-4xl">Data</h1>
      <p>OWID fetch date: <span className="mono">{meta.owidFetchDate}</span>. File hash: <span className="mono">{meta.owidHash}</span>.</p>
      <p>Cost data uses Lazard 2026 only; oil, hydro, and biomass intentionally render as no comparable data.</p>
      {[
        ['Source coefficients', sources],
        ['Country mix', countries],
        ['Profiles', profiles],
        ['Citations', citations],
      ].map(([title, data]) => (
        <section className="my-6" key={title as string}>
          <h2>{title as string}</h2>
          <pre className="panel overflow-auto p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
        </section>
      ))}
    </main>
  );
}
