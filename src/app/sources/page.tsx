import MetricLadder from '@/components/MetricLadder';
import sources from '@/data/sources.json';
import SourceCards from './SourceCards';

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-4xl">Sources</h1>
      <p className="my-4">
        Eight electricity sources on one ranked scale. Switch the measure — deaths, CO₂, land, cost, or the priced
        mortality cost — and watch the order reshuffle: the safest source isn&apos;t the cheapest or the lowest-carbon.
        The cards below can be sorted by death rate or alphabetically.
      </p>
      <MetricLadder />
      <SourceCards sources={sources} />
    </main>
  );
}
