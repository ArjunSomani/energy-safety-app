import Link from 'next/link';
import RiskRule from '@/components/RiskRule';

export default function Home() {
  return (
    <main>
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
            <Link className="btn btn-primary" href="/sources">
              Compare the sources →
            </Link>
            <Link className="btn btn-ghost" href="/how-we-count">
              How we count
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--ink-soft)]">
            Or <Link href="/build">build your own grid</Link> and see the deaths, CO₂, land, and cost bands.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl p-6">
        <RiskRule />

        {/* Prose with real hierarchy rather than three identically-sized cards
            numbered 01/02/03. The three points are not a sequence, so numbering
            them was scaffolding; and the one that actually matters — that counted
            and modeled deaths are different kinds of claim — deserves more weight
            than the other two, which a uniform grid cannot give it. */}
        <section className="mt-6 read-more">
          <h2>How to read this</h2>
          <p>
            Eight electricity sources sit on one deaths-per-terawatt-hour scale, each drawn as the band its evidence
            supports rather than a single confident number. Where a band is wide, the underlying literature disagrees,
            and the chart says so.
          </p>
          <p>
            The distinction that matters most is <b>what kind of death is being counted</b>. A dam failure or a roof fall
            is a counted event with a date and a body count. Air-pollution and radiation deaths are modeled
            attributions — a statistical excess spread across a population, never traceable to one person. Both belong on
            the same scale, but they are not the same kind of claim, so the bars draw them differently: solid for counted,
            hatched for modeled.
          </p>
          <p className="text-sm text-[var(--ink-soft)]">
            From there you can <Link href="/build">mix sources into a grid</Link>,{' '}
            <Link href="/countries">apply the rates to a real national mix</Link>, or read{' '}
            <Link href="/how-we-count">how each number was assembled</Link>.
          </p>
        </section>

        <Link className="panel p-6 mt-6" href="/value">
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>What is that death toll worth?</h3>
          <p className="mt-3 text-sm text-[var(--ink-soft)]" style={{ margin: '0.5rem 0 0' }}>
            Price each source&apos;s deaths at the value society already places on a statistical life, and see the cost
            the electricity bill leaves out — for coal, often larger than the bill itself. <span className="card-arrow" />
          </p>
        </Link>
      </div>
    </main>
  );
}
