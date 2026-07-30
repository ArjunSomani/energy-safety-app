'use client';

import sourcesData from '@/data/sources.json';
import { peoplePerDeath } from '@/lib/format';
import { useState } from 'react';

// Compact people count for the tight risk-rule label: 6,000 → "6k", 2.5M → "2.5M".
const compactPeople = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`;

// Blue sequential "risk" ramp — rows are ordered high→low death rate, so the
// darkest bar (coal) is the most dangerous and the palest (solar) the least.
const colors = Array.from({ length: 8 }, (_, i) => `var(--risk-${i + 1})`);

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

      <div className="ladder-wrap">
        <div
          className="ladder py-8"
          style={{
            // Height follows the row count. This was a fixed 430px, which left
            // ~390px of dead space wherever a single row is rendered.
            height: items.length * 44 + 40,
            borderTop: '1px solid var(--chart-gridline)',
            borderBottom: '1px solid var(--chart-gridline)',
          }}
        >
        <div className="ladder-track top-1/2 h-px" style={{ background: 'var(--chart-baseline)' }} />

        {/* Gridlines share the .ladder-track box with the bars, so a value's
            line and its bar resolve to the same pixel. */}
        <div className="ladder-track top-0 h-full" aria-hidden="true">
          {ticks.map((t) => (
            <div key={t} className="absolute top-0 h-full" style={{ left: x(t), borderLeft: '1px solid var(--chart-gridline)' }}>
              <span className="mono absolute -top-6 -translate-x-1/2 text-xs text-[var(--ink-soft)]">{t.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {items.map((s, i) => {
          const y = 20 + i * 44;
          const lo = s.deathRate.low;
          const hi = s.deathRate.high;
          const countedPct = (1 - s.deathRate.modeledShare) * 100;
          const pp = peoplePerDeath(s.deathRate);
          const anchor = pp.low != null && pp.high != null ? `${compactPeople(pp.low)}–${compactPeople(pp.high)}` : null;
          return (
            <div key={s.slug} className="absolute left-0 right-0" style={{ top: y }}>
              <span className="absolute ladder-gutter text-sm" style={{ fontWeight: 500, lineHeight: 1.1 }}>
                {s.label}
                {anchor ? (
                  <span className="mono ladder-anchor" style={{ display: 'block', fontSize: '0.62rem', color: 'var(--ink-muted)', fontWeight: 400 }}>
                    1 death / {anchor}
                  </span>
                ) : null}
              </span>
              <div className="ladder-track top-2 h-5">
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
                <span className="mono ml-2 text-xs text-[var(--ink-soft)] ladder-range" style={{ position: 'absolute', left: x(hi), top: -1 }}>
                  {lo}–{hi}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        {scale === 'log'
          ? 'This scale is logarithmic: each step to the right is ten times the previous one, so the visual distance understates how much larger the fossil numbers really are.'
          : 'This scale is linear, which is faithful to the true gaps — but it collapses nuclear, wind, solar, and hydro onto the axis, because they are hundreds of times smaller than coal.'}
      </p>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: 'var(--risk-3)' }} /> counted
        deaths ·{' '}
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: 'var(--hatch)' }} /> modeled
        deaths
      </p>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        The small grey figure under each source is the same rate turned human: roughly how many people’s yearly
        electricity corresponds to one death. Coal, about 700–6,000 people; solar, a few million.
      </p>

      {/* The numbers as text. The bars are positioned divs with no accessible
          value of their own, and the inline low–high label is dropped on narrow
          tracks (see .ladder-range) — without this, every viewport under ~768px
          showed bars carrying no figures at all. */}
      <details className="mt-3">
        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--accent)' }}>The figures as a table</summary>
        <div className="overflow-auto mt-3">
          <table className="w-full border-collapse table-responsive" style={{ fontSize: '0.8rem' }}>
            <caption className="sr-only">Deaths per terawatt-hour by source, low to high, with the counted and modeled split.</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Low</th>
                <th scope="col">High</th>
                <th scope="col">Modeled</th>
                <th scope="col">1 death per</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const pp = peoplePerDeath(s.deathRate);
                return (
                  <tr key={s.slug}>
                    <th scope="row" data-label="Source" style={{ fontWeight: 500 }}>
                      {s.label}
                    </th>
                    <td className="mono" data-label="Low">
                      {s.deathRate.low}
                    </td>
                    <td className="mono" data-label="High">
                      {s.deathRate.high}
                    </td>
                    <td className="mono" data-label="Modeled">
                      {Math.round(s.deathRate.modeledShare * 100)}%
                    </td>
                    <td className="mono" data-label="1 death per">
                      {pp.low != null && pp.high != null ? `${compactPeople(pp.low)}–${compactPeople(pp.high)} people` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
