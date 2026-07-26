import sources from '@/data/sources.json';

// Sequential blue ramp (low → high death rate). Bars carry an ink border, so
// these read on both the light "paper" and dark grounds.
const colors = ['#dce7f2', '#c8d8ea', '#b4c9e1', '#9fb9d7', '#89a8cc', '#7397c0', '#5c84b2', '#456f9f'];
const ticks = [0.01, 0.1, 1, 10, 100, 1000];
const min = -2;
const max = 3;
const x = (v: number) => `${((Math.log10(Math.max(v, 0.01)) - min) / (max - min)) * 100}%`;

export default function RiskRule({ items = sources }: { items?: typeof sources }) {
  return (
    <section className="panel p-4 md:p-8" aria-labelledby="risk-rule-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">The risk rule</p>
          <h2 id="risk-rule-title" className="text-xl" style={{ margin: '0.25rem 0 0' }}>
            Deaths per terawatt-hour
          </h2>
        </div>
        <p className="mono text-sm text-[var(--ink-soft)]">0.01 → 1,000 deaths/TWh · logarithmic</p>
      </div>

      <div className="relative h-[430px] border-y border-[var(--rule)] py-8">
        {/* baseline */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--rule)]" />

        {/* gridlines + tick labels */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-0 h-full border-l border-[var(--rule)]"
            style={{ left: x(t) }}
          >
            <span className="mono absolute -top-6 -translate-x-1/2 text-xs text-[var(--ink-soft)]">
              {t.toLocaleString()}
            </span>
          </div>
        ))}

        {/* one bar per source */}
        {items.map((s, i) => {
          const y = 20 + i * 44;
          const lo = s.deathRate.low;
          const hi = s.deathRate.high;
          const countedPct = (1 - s.deathRate.modeledShare) * 100;
          return (
            <div key={s.slug} className="absolute left-0 right-0" style={{ top: y }}>
              <span className="label absolute w-24 text-sm" style={{ textTransform: 'none' }}>
                {s.label}
              </span>
              <div className="absolute left-28 right-0 top-2 h-5">
                <div
                  className="h-4 rounded-sm border"
                  style={{
                    marginLeft: x(lo),
                    width: `calc(${x(hi)} - ${x(lo)})`,
                    borderColor: 'var(--bar-border)',
                    background: `linear-gradient(90deg, ${colors[i % colors.length]} 0 ${countedPct}%, transparent ${countedPct}%), var(--hatch)`,
                  }}
                />
                <span
                  className="mono ml-2 text-xs text-[var(--ink-soft)]"
                  style={{ position: 'absolute', left: x(hi), top: -1 }}
                >
                  {lo}–{hi}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" /> counted
        deaths ·{' '}
        <span
          className="inline-block h-3 w-6 rounded-sm border border-black align-middle"
          style={{ background: 'var(--hatch)' }}
        />{' '}
        modeled deaths
      </p>
    </section>
  );
}
