import Link from 'next/link';
import CountedVsModeled from '@/components/CountedVsModeled';
import DivisionGraphic from '@/components/DivisionGraphic';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'How we count — Level',
  description: 'How Level turns deaths and electricity into one comparable number, in plain terms.',
};

// Decorative line icons — always aria-hidden, described by adjacent text.
const ICONS: Record<string, ReactNode> = {
  deaths: <path d="M3 12h4l2 5 4-12 2 7h6" />,
  co2: (
    <>
      <path d="M17.5 19a4.5 4.5 0 1 0-1.2-8.8A6 6 0 0 0 5 12.5 3.5 3.5 0 0 0 6 19h11.5Z" />
    </>
  ),
  land: (
    <>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7 9 4.5V17" />
    </>
  ),
  cost: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10M9.5 9.5c0-1 1.1-1.8 2.5-1.8s2.5.8 2.5 1.8-1.1 1.6-2.5 1.6-2.5.7-2.5 1.7 1.1 1.8 2.5 1.8 2.5-.8 2.5-1.8" />
    </>
  ),
  records: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
  divide: (
    <>
      <path d="M5 12h14" />
      <circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  split: (
    <>
      <path d="M12 4v16M4 8h5M4 12h5M4 16h5" />
      <path d="M15 8h5M15 12h5M15 16h5" strokeDasharray="1.5 2" />
    </>
  ),
  cycle: <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" />,
  range: <path d="M4 12h16M4 9v6M20 9v6M9 12h6" />,
};

function Icon({ name, size = 26 }: { name: string; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const dimensions = [
  ['deaths', 'Deaths'],
  ['co2', 'CO₂'],
  ['land', 'Land'],
  ['cost', 'Cost'],
];

const stats = [
  ['~150,000', 'people’s yearly electricity = 1 TWh'],
  ['~1,000×', 'coal vs solar, per unit'],
  ['8', 'sources, one scale'],
];

const steps: [string, string, string][] = [
  ['records', 'Start with real deaths and real electricity', 'For each source we take the deaths associated with it and the electricity it produced — both measured, not assumed.'],
  ['divide', 'Divide to get a rate', 'Deaths ÷ terawatt-hours gives deaths per unit of electricity. This removes the effect of how much each source happens to produce, so the comparison is fair.'],
  ['split', 'Separate counted from modeled', 'Accidents are counted events. Air-pollution and radiation deaths are modeled statistical estimates. We draw the two differently and never blur them together.'],
  ['cycle', 'Add the whole lifecycle', 'Mining, building, running, fuel, and waste all count — which is why even wind and solar are not exactly zero.'],
  ['range', 'Show the uncertainty as a range', 'Every figure is a low–high band, not a single confident number. Where the science is unsettled, the band is wide.'],
];

const glossary: [string, ReactNode][] = [
  ['Terawatt-hour (TWh)', 'A unit of “how much electricity.” One TWh is very roughly a year of electricity for 150,000 people in the EU.'],
  ['Deaths per TWh', 'The rate we compare. It answers “how many deaths per unit of electricity,” independent of how big a source is.'],
  ['Counted vs modeled', 'Counted deaths are recorded events. Modeled deaths are statistical estimates of pollution or radiation harm. Drawn as solid vs hatched.'],
  ['Attributable death', 'A death assigned to an exposure by a model, rather than a single identified victim. Most of coal’s and nuclear’s numbers are these.'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="my-8">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <p className="kicker">Reading the numbers</p>
      <h1 className="text-4xl">How we count</h1>
      <p className="lede">
        Everything here comes from one idea: count deaths per unit of electricity, not per source in total. Here is
        what that means — in plain terms — and where it breaks down.
      </p>

      <div className="panel p-4 mt-6">
        <p className="label" style={{ marginBottom: '0.6rem' }}>
          Four measures, one scale
        </p>
        <div className="tile-row" style={{ justifyContent: 'space-between' }}>
          {dimensions.map(([icon, label]) => (
            <div className="tile" key={label}>
              <Icon name={icon} />
              <span className="tile-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <Section title="A terawatt-hour, first">
        <p>
          A terawatt-hour (TWh) is the unit of <em>how much electricity</em> — one billion kilowatt-hours, very roughly
          a year of power for 150,000 people in the EU. It is what we divide by, and it is what makes sources
          comparable.
        </p>
        <div className="stat-grid mt-4">
          {stats.map(([num, label]) => (
            <div className="panel p-4" key={label}>
              <div className="stat-num">{num}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Why we divide, with real numbers">
        <p>
          Suppose coal is associated with roughly 250,000 deaths a year worldwide and solar with a few dozen. Coal
          looks catastrophically worse — but coal also generates far more electricity, so most of that gap is just
          scale. Divide each by the electricity produced and the scale cancels out:
        </p>
        <ul className="list-disc pl-6">
          <li>
            Coal: ~250,000 deaths ÷ ~10,000 TWh ≈ <span className="mono">25 deaths/TWh</span>
          </li>
          <li>
            Solar: a few dozen deaths ÷ its far smaller output ≈ <span className="mono">0.02 deaths/TWh</span>
          </li>
        </ul>
        <div className="my-4">
          <DivisionGraphic />
        </div>
        <p>
          Now the comparison is fair: coal is on the order of a thousand times more deadly per unit, and that no longer
          depends on how much of each we build. Comparing raw totals would have flattered solar for a reason that has
          nothing to do with safety — it simply produces less.
        </p>
      </Section>

      <Section title="How the number is built">
        <div className="stepper mt-2">
          {steps.map(([icon, title, body], i) => (
            <div className="step" key={title}>
              <div className="step-rail">
                <div className="step-badge" aria-hidden="true">
                  <Icon name={icon} size={20} />
                </div>
                {i < steps.length - 1 ? <div className="step-line" /> : null}
              </div>
              <div className="step-body">
                <div className="step-title">
                  {i + 1}. {title}
                </div>
                <p className="text-sm text-[var(--ink-soft)] mt-3" style={{ margin: '0.35rem 0 0' }}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Counted vs modeled — the key distinction">
        <p>
          This is the hardest idea on the site, so here it is as a picture. On the left, deaths you could list by name.
          On the right, the same total spread thinly across a whole population.
        </p>
        <CountedVsModeled />
      </Section>

      <Section title="Where these numbers are weakest">
        <p>
          Data vintage differs by source, the fossil rates come from a European baseline generalized worldwide, nuclear
          depends on the contested linear no-threshold model, and none of it models storage, reliability, or
          transmission. Country pages adjust for two of these — hydro&apos;s Banqiao tail and pollution controls — but
          the coefficients stay coarse. When in doubt, read the band, not the midpoint.
        </p>
      </Section>

      <Section title="A few terms you'll see">
        <div className="grid gap-3 md:grid-cols-2">
          {glossary.map(([term, body]) => (
            <div className="panel p-4" key={term}>
              <div className="step-title" style={{ fontSize: '1rem' }}>
                {term}
              </div>
              <p className="text-sm text-[var(--ink-soft)]" style={{ margin: '0.35rem 0 0' }}>
                {body}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6">
          Ready to look? <Link href="/sources">Compare the eight sources →</Link>
        </p>
      </Section>
    </main>
  );
}
