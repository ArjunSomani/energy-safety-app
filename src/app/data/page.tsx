import DataExplorer from './DataExplorer';
import citations from '@/data/citations.json';
import countries from '@/data/countries.json';
import meta from '@/data/meta.json';
import profiles from '@/data/profiles.json';
import sources from '@/data/sources.json';

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-4xl">Data</h1>
      <p>
        Every coefficient the site runs on, in one sortable table. OWID fetch date:{' '}
        <span className="mono">{meta.owidFetchDate}</span>. File hash: <span className="mono">{meta.owidHash}</span>. Cost
        data uses Lazard 2026 only; oil, hydro, and biomass carry no comparable cost figure.
      </p>

      <DataExplorer />

      <h2>Full source, as stored</h2>
      <p className="text-sm text-[var(--ink-soft)]">
        The raw JSON behind the table and the rest of the site, for full transparency and copy-paste.
      </p>
      {[
        ['Source coefficients', sources],
        ['Country mix', countries],
        ['Profiles', profiles],
        ['Citations', citations],
      ].map(([title, data]) => (
        <details className="my-3" key={title as string}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>{title as string}</summary>
          <pre className="panel overflow-auto p-4 text-xs" style={{ marginTop: '0.5rem' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      ))}
    </main>
  );
}
