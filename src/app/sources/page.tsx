import RiskRule from '@/components/RiskRule';
import sources from '@/data/sources.json';
import SourceCards from './SourceCards';

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-4xl">Sources</h1>
      <p className="my-4">
        Eight electricity sources on the same risk rule. The chart is ordered by death rate; the cards below can be
        sorted by rate or alphabetically, so the default ranking isn&apos;t the only way to read them.
      </p>
      <RiskRule />
      <SourceCards sources={sources} />
    </main>
  );
}
