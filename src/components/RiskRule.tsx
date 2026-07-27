'use client';

import sourcesData from '@/data/sources.json';
import { peoplePerDeath } from '@/lib/format';
import { useState } from 'react';

// Compact people count for the tight risk-rule label: 6,000 → "6k", 2.5M → "2.5M".
const compactPeople = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`;

// Blue sequential "risk" ramp — rows are ordered high→low death rate, so the
// darkest bar (coal) is the most dangerous and the palest (solar) the least.
const colors = ['#0f2f6b', '#17408c', '#1f52ad', '#3568bd', '#5a83c9', '#85a3d6', '#b0c4e4', '#d7e2f2'];

const logTicks = [0.01, 0.1, 1, 10, 100, 1000];
const linTicks = [0, 50, 100, 150, 200, 250];
const LOG_MIN = -2;
const LOG_MAX = 3;
const LIN_MAX = 250;

export default function RiskRule({ items = sourcesData }: { items?: typeof sourcesData }) {
  const [scale, setScale] = useState<'log' | 'linear'>('log');
  const showToggle = items.length > 1;

  const x = (v: number) =>
    scale === 'log'
      ? `${((Math.log10(Math.max(v, 0.01)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100}%`
      : `${(Math.min(v, LIN_MAX) / LIN_MAX) * 100}%`;
  const ticks = scale === 'log' ? logTicks : linTicks;

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
        {showToggle ? (
          <div className="scale-toggle" role="group" aria-label="Scale">
            <button type="button" aria-pressed={scale === 'log'} onClick={() => setScale('log')}>
              Log
            </button>
            <button type="button" aria-pressed={scale === 'linear'} onClick={() => setScale('linear')}>
              Linear
            </button>
          </div>
        ) : null}
      </div>

      <div
        className="relative h-[430px] py-8"
        style={{ borderTop: '1px solid var(--chart-gridline)', borderBottom: '1px solid var(--chart-gridline)' }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: 'var(--chart-baseline)' }} />

        {ticks.map((t) => (
          <div key={t} className="absolute top-0 h-full" style={{ left: x(t), borderLeft: '1px solid var(--chart-gridline)' }}>
            <span className="mono absolute -top-6 -translate-x-1/2 text-xs text-[var(--ink-soft)]">{t.toLocaleString()}</span>
          </div>
        ))}

        {items.map((s, i) => {
          const y = 20 + i * 44;
          const lo = s.deathRate.low;
          const hi = s.deathRate.high;
          const countedPct = (1 - s.deathRate.modeledShare) * 100;
          const pp = peoplePerDeath(s.deathRate);
          const anchor = pp.low != null && pp.high != null ? `${compactPeople(pp.low)}–${compactPeople(pp.high)}` : null;
          return (
            <div key={s.slug} className="absolute left-0 right-0" style={{ top: y }}>
              <span className="absolute w-24 text-sm" style={{ fontWeight: 500, lineHeight: 1.1 }}>
                {s.label}
                {anchor ? (
                  <span className="mono" style={{ display: 'block', fontSize: '0.62rem', color: 'var(--ink-muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                    1 death / {anchor}
                  </span>
                ) : null}
              </span>
              <div className="absolute left-28 right-0 top-2 h-5">
                <div
                  className="h-4 rounded-sm border"
                  style={{
                    marginLeft: x(lo),
                    width: `calc(${x(hi)} - ${x(lo)})`,
                    minWidth: '2px',
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
        {scale === 'log'
          ? 'This scale is logarithmic: each step to the right is ten times the previous one, so the visual distance understates how much larger the fossil numbers really are.'
          : 'This scale is linear, which is faithful to the true gaps — but it collapses nuclear, wind, solar, and hydro onto the axis, because they are hundreds of times smaller than coal.'}
      </p>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: '#1f52ad' }} /> counted
        deaths ·{' '}
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: 'var(--hatch)' }} /> modeled
        deaths
      </p>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        The small grey figure under each source is the same rate turned human: roughly how many people’s yearly
        electricity corresponds to one death. Coal, about 700–6,000 people; solar, a few million.
      </p>
    </section>
  );
}
