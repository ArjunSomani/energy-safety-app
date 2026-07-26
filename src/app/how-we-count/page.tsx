export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-4xl">How we count</h1>
      <p className="lede">
        Everything on this site comes from one idea: count deaths per unit of electricity, not per source in total.
        Here is what that means, and where it breaks down.
      </p>

      <section className="my-8">
        <h2>What a terawatt-hour is</h2>
        <p>
          A terawatt-hour (TWh) is one billion kilowatt-hours — very roughly the annual electricity use of about
          150,000 people in the EU. It is the unit of &ldquo;how much electricity,&rdquo; and it is what we divide by.
        </p>
      </section>

      <section className="my-8">
        <h2>Why we divide by energy, not count totals</h2>
        <p>
          Suppose coal is associated with something like 250,000 deaths a year worldwide, and solar with a few dozen.
          Coal looks catastrophically worse. But coal also generates something like <span className="mono">10,000</span>{' '}
          TWh a year while solar generates a small fraction of that, so most of that gap is just a difference in how
          much electricity each one makes.
        </p>
        <p>Divide each by the electricity produced and the scale cancels out, leaving the rate:</p>
        <ul className="list-disc pl-6">
          <li>
            Coal: ~250,000 deaths ÷ ~10,000 TWh ≈ <span className="mono">25 deaths/TWh</span>
          </li>
          <li>
            Solar: a few dozen deaths ÷ its far smaller output ≈ <span className="mono">0.02 deaths/TWh</span>
          </li>
        </ul>
        <p>
          Now the comparison is fair: coal is on the order of a thousand times more deadly per unit of electricity,
          and that conclusion no longer depends on how much of each we happen to build. Comparing raw totals would have
          flattered solar for a reason that has nothing to do with safety — it simply produces less.
        </p>
      </section>

      <section className="my-8">
        <h2>Two very different kinds of death</h2>
        <p>
          Accident deaths are counted events: a fall, a mine collapse, a dam failure. Air-pollution and radiation
          deaths are modeled attributions — statistical estimates of how many extra deaths an exposure causes across a
          population. These are not the same kind of number, so the risk rule draws counted deaths as solid fill and
          modeled deaths as hatching. For coal and gas, almost the whole bar is hatched.
        </p>
      </section>

      <section className="my-8">
        <h2>Accidents are the small part</h2>
        <p>
          For fossil fuels, chronic air pollution — not accidents — dominates. Coal&apos;s number is overwhelmingly
          people downwind breathing fine particulates for years, a modeled public-health estimate rather than an
          accident ledger. Nuclear is the mirror image: its number is mostly modeled long-term cancer projections, not
          the counted casualties of Chernobyl and Fukushima.
        </p>
      </section>

      <section className="my-8">
        <h2>What lifecycle includes</h2>
        <p>
          Rates cover mining, construction, operation, fuel supply, maintenance, and waste where the source involves
          it. That is why wind and solar are not zero: manufacturing and installation carry real, if small, risk.
        </p>
      </section>

      <section className="my-8">
        <h2>Where these numbers are weakest</h2>
        <p>
          Data vintage differs by source, the fossil rates come from a European baseline generalized worldwide, nuclear
          depends on the contested linear no-threshold model, and none of it models storage, reliability, or
          transmission. Country pages adjust for two of these — hydro&apos;s Banqiao tail and pollution controls — but
          the coefficients remain coarse.
        </p>
      </section>

      <section className="my-8">
        <h2>Glossary</h2>
        <p>
          <span className="mono">TWh</span> — terawatt-hour. <span className="mono">LNT</span> — linear no-threshold
          radiation model. <span className="mono">Attributable death</span> — a statistical estimate assigned to an
          exposure rather than a single identified victim.
        </p>
      </section>
    </main>
  );
}
