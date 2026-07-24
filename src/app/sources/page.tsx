import RiskRule from '@/components/RiskRule';
import sources from '@/data/sources.json';

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-4xl">Sources</h1>
      <p className="my-4">Eight electricity sources are shown on the same risk rule. Alphabetical sorting is available by reading the cards below.</p>
      <RiskRule />
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {sources.map((source) => (
          <a className="panel p-4" href={`/sources/${source.slug}`} key={source.slug}>
            <h2>{source.label}</h2>
            <p className="text-sm">{source.description}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
