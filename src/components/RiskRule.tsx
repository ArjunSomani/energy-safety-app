import sources from '@/data/sources.json';

// Warm sequential "risk" ramp — rows are ordered high→low death rate, so the
// darkest/hottest bar (coal) is the most dangerous and the palest (solar) the
// least. Deliberately off-accent so the chart never competes with the blue UI.
const colors = ['#7f1d1d', '#9a2f1a', '#b4442a', '#c26a2e', '#cf8a3f', '#dba85f', '#e6c489', '#eddcb6'];
const ticks = [0.01, 0.1, 1, 10, 100, 1000];
const min = -2;
const max = 3;
const x = (v: number) => `${((Math.log10(Math.max(v, 0.01)) - min) / (max - min)) * 100}%`;

export default function RiskRule({ items = sources }: { items?: typeof sources }) {
  return (
    <section className="panel p-4 md:p-8" aria-labelledby="risk-rule-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker" style={{ marginBottom: '0.35rem' }}>
            The risk rule
          </p>
          <h2 id="risk-rule-title" className="text-xl" style={{ margin: 0 }}>
            Deaths per terawatt-hour
          </h2>
        </div>
        <p className="mono text-sm text-[var(--ink-soft)]">0.01 → 1,000 deaths/TWh · logarithmic</p>
      </div>

      <div className="relative h-[430px] py-8" style={{ borderTop: '1px solid var(--chart-gridline)', borderBottom: '1px solid var(--chart-gridline)' }}>
        {/* baseline */}
        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: 'var(--chart-baseline)' }} />

        {/* gridlines + tick labels */}
        {ticks.map((t) => (
          <div key={t} className="absolute top-0 h-full" style={{ left: x(t), borderLeft: '1px solid var(--chart-gridline)' }}>
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
              <span className="absolute w-24 text-sm" style={{ fontWeight: 500 }}>
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
                <span className="mono ml-2 text-xs text-[var(--ink-soft)]" style={{ position: 'absolute', left: x(hi), top: -1 }}>
                  {lo}–{hi}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: '#b4442a' }} /> counted
        deaths ·{' '}
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: 'var(--hatch)' }} /> modeled
        deaths
      </p>
    </section>
  );
}
