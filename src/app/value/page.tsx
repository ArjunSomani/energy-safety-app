import Link from 'next/link';
import ValueRule from '@/components/ValueRule';
import citations from '@/data/citations.json';
import { VSL_NOTE, VSL_PRESETS, VSL_SOURCE, formatVsl } from '@/lib/value';

export const metadata = {
  title: 'What a life is worth — Level',
  description:
    'The death toll of electricity, priced. Level values each source’s deaths at the published range for a statistical life — shown as a range, not a verdict.',
};

const cite = citations[VSL_SOURCE as keyof typeof citations];

const faqs: [string, string][] = [
  [
    'Isn’t putting a dollar value on a life wrong?',
    'A price gets set either way. Every time a society declines to spend without limit on safety — a speed limit, a hospital budget, a workplace rule — it has already priced a statistical life implicitly. This page only makes that number explicit and lets you move it. It is not the price of any particular person’s life, and the site does not tell you which value is right.',
  ],
  [
    'Whose number is this?',
    'The presets are the range US Health and Human Services publishes for regulatory analysis. It comes from what people are actually observed to pay to avoid small risks — wage premiums for dangerous work, spending on safety equipment — scaled up to one statistical death. Different agencies and countries use different figures, which is why it is shown as a range.',
  ],
  [
    'Why is the mortality cost sometimes larger than the electricity price?',
    'For coal and oil, most of the death toll is air-pollution mortality that the electricity market never charges for. At a central life-value, that uncounted cost per unit of energy can exceed the plant’s running cost. For nuclear, wind, and solar it is a rounding error next to the bill. That gap is the whole point of the comparison.',
  ],
  [
    'Does this discount future deaths?',
    'No. A death prevented in 2050 is weighted the same as one prevented today. Discounting future harm is a common and contested choice in cost-benefit analysis; this page does not make it, so the figures are undiscounted.',
  ],
];

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <p className="kicker">The uncounted cost</p>
      <h1 className="text-4xl">What a life is worth</h1>
      <p className="lede">
        Deaths per terawatt-hour tell you how dangerous each source is. They do not tell you what that danger is worth
        against the electricity bill, or against a price on carbon. To ask that, you have to attach a dollar figure to a
        statistical death — and regulators already do.
      </p>

      <section className="my-8">
        <h2>The cost the price leaves out</h2>
        <p>
          The market charges for fuel, for building the plant, for keeping it running. It never charges for the death
          toll — the mining and drilling accidents, and far larger, the air pollution that shortens lives downwind. A
          mortality price and a carbon price are the same kind of object: both take a harm the market ignores, put a
          number on it, and let you see what it would cost.
        </p>
        <p>
          That number is the <b>value of a statistical life</b> (VSL): what preventing one death is treated as worth. US
          Health and Human Services publishes a range for it — not a single figure.
        </p>

        <div className="grid gap-3 md:grid-cols-3 mt-4">
          {VSL_PRESETS.map((preset) => (
            <div className="panel p-4" key={preset.key} style={{ textAlign: 'center' }}>
              <div className="stat-num">{formatVsl(preset.value)}</div>
              <div className="stat-label">{preset.label} · per statistical death</div>
            </div>
          ))}
        </div>
        <p className="mt-3">
          <small>
            {cite.label} ({cite.year}). Constant 2025 dollars.{' '}
            <a href={cite.url} target="_blank" rel="noreferrer">
              Source
            </a>
            .
          </small>
        </p>
      </section>

      <ValueRule />

      <section className="panel p-4 my-8" style={{ background: 'var(--accent-soft)' }}>
        <p className="label" style={{ marginBottom: '0.4rem' }}>
          A moral choice, not a technical one
        </p>
        <p style={{ margin: 0 }}>{VSL_NOTE}</p>
      </section>

      <section className="my-8">
        <h2>Read the band, twice</h2>
        <p>
          Every figure here carries two ranges, not one. The first is scientific: how deadly each source is, reported
          low to high because the underlying epidemiology is genuinely uncertain. The second is the life-value itself,
          which HHS publishes as a range. A priced mortality cost inherits both. The honest read is the width of those
          bands, not any single midpoint — and the site never lets you rank nuclear, wind, and solar apart, because
          their ranges overlap.
        </p>
      </section>

      <section className="my-8">
        <h2>Questions people ask</h2>
        <div className="grid gap-3">
          {faqs.map(([q, a]) => (
            <details className="panel p-4" key={q}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>{q}</summary>
              <p className="text-sm text-[var(--ink-soft)]" style={{ margin: '0.6rem 0 0' }}>
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <p>
        See it on a whole grid: <Link href="/build">build a mix and read its mortality cost →</Link> or compare the{' '}
        <Link href="/sources">eight sources</Link>.
      </p>
    </main>
  );
}
