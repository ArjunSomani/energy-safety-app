import RiskRule from '@/components/RiskRule';

const entries = [
  ['Compare the sources', 'Eight electricity sources on one measured scale.', '/sources'],
  ['Build a grid', 'Mix sources and see the deaths, CO₂, land, and cost bands.', '/build'],
  ['Find your country', 'Apply the rates to a real national electricity mix.', '/countries'],
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <section className="my-6">
        <p className="eyebrow">Deaths per terawatt-hour · a neutral reference</p>
        <h1 className="text-4xl md:text-6xl">Common Scale</h1>
        <p className="lede mt-4">
          Electricity sources placed on one measured scale, using deaths per unit of electricity
          generated — with the uncertainty shown, not hidden.
        </p>
      </section>

      <RiskRule />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {entries.map(([title, blurb, href]) => (
          <a className="panel p-6" href={href} key={href}>
            <h2 className="card-arrow text-xl">{title}</h2>
            <p className="text-sm text-[var(--ink-soft)]">{blurb}</p>
          </a>
        ))}
      </div>

      <p className="mt-6">
        <a href="/how-we-count">New to this? Start with how we count →</a>
      </p>
    </main>
  );
}
