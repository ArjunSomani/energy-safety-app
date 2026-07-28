import RiskRule from '@/components/RiskRule';

const cards = [
  ['01', 'One measured scale', 'Eight electricity sources placed on a single deaths-per-terawatt-hour scale, with the uncertainty shown.'],
  ['02', 'Counted vs modeled', 'Accident deaths are counted events; air-pollution and radiation deaths are modeled attributions. The two are drawn differently.'],
  ['03', 'Build and compare', 'Mix sources into a grid, or apply the rates to a real national electricity mix, and watch the bands move.'],
] as const;

export default function Home() {
  return (
    <div>
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="mx-auto max-w-4xl p-6" style={{ paddingTop: '5rem', paddingBottom: '1rem', textAlign: 'center' }}>
          <p className="kicker">Deaths per terawatt-hour · a neutral reference</p>
          <h1 className="text-4xl md:text-6xl">The safety of electricity, on one scale</h1>
          <p className="lede mx-auto mt-4" style={{ maxWidth: '36rem' }}>
            Every source of electricity carries some risk. Level places them side by side using deaths
            per unit of electricity generated — with the uncertainty shown, not hidden.
          </p>
          <div className="mt-6 flex gap-3" style={{ justifyContent: 'center' }}>
            <a className="btn btn-primary" href="/sources">
              Compare the sources →
            </a>
            <a className="btn btn-ghost" href="/how-we-count">
              How we count
            </a>
          </div>
          <p className="mt-4 text-sm text-[var(--ink-soft)]">
            Or{' '}
            <a href="/build">build your own grid</a> and see the deaths, CO₂, land, and cost bands.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl p-6">
        <RiskRule />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {cards.map(([n, title, body]) => (
            <div className="panel p-6" key={n}>
              <span className="card-num">{n}</span>
              <h3 style={{ marginTop: '0.25rem' }}>{title}</h3>
              <p className="mt-3 text-sm text-[var(--ink-soft)]" style={{ margin: 0 }}>
                {body}
              </p>
            </div>
          ))}
        </div>

        <a className="panel p-6 mt-4" href="/value" style={{ display: 'block' }}>
          <span className="kicker" style={{ margin: 0 }}>
            The uncounted cost
          </span>
          <h3 style={{ marginTop: '0.35rem', marginBottom: 0 }}>
            What is that death toll worth?
          </h3>
          <p className="mt-3 text-sm text-[var(--ink-soft)]" style={{ margin: '0.5rem 0 0' }}>
            Price each source&apos;s deaths at the value society already places on a statistical life, and see the cost
            the electricity bill leaves out — for coal, often larger than the bill itself.{' '}
            <span className="card-arrow" />
          </p>
        </a>
      </div>
    </div>
  );
}
