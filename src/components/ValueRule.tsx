'use client';

import VslControl from '@/components/VslControl';
import sourcesData from '@/data/sources.json';
import { fmt } from '@/lib/format';
import {
  VSL_CENTRAL,
  formatUsdPerMwh,
  mortalityCostPerMwh,
} from '@/lib/value';
import { useMemo, useState } from 'react';

// Same blue "risk ramp" the death-rate risk rule uses, so a source keeps its
// identity between the two charts — this is the same ranking, priced.
const colors = ['#0f2f6b', '#17408c', '#1f52ad', '#3568bd', '#5a83c9', '#85a3d6', '#b0c4e4', '#d7e2f2'];

// Axis runs to $10,000/MWh so that even coal's high band — its deaths/TWh high
// bound valued at the top of the VSL range — stays on the chart.
const logTicks = [0.01, 0.1, 1, 10, 100, 1000, 10000];
const linTicks = [0, 100, 200, 300, 400];
const LOG_MIN = -2;
const LOG_MAX = 4;
const LIN_MAX = 400;
const clamp01 = (f: number) => Math.min(1, Math.max(0, f));

type Src = (typeof sourcesData)[number];

// Descending by death rate == descending by mortality cost (VSL is a common
// scalar), so the order matches the risk rule exactly.
const ordered = [...sourcesData].sort((a, b) => b.deathRate.central - a.deathRate.central);

function ratioText(cost: number, lcoe: number | null): string {
  if (lcoe == null || !(lcoe > 0)) return '—';
  const r = cost / lcoe;
  if (r >= 1) return `${r.toFixed(1)}× the price`;
  if (r >= 0.01) return `${Math.round(r * 100)}% of the price`;
  return '<1% of the price';
}

export default function ValueRule() {
  const [vsl, setVsl] = useState(VSL_CENTRAL);
  const [scale, setScale] = useState<'log' | 'linear'>('log');

  const rows = useMemo(
    () =>
      ordered.map((s: Src) => {
        const dr = s.deathRate;
        const lcoe = (s.lcoe.central as number | null) ?? null;
        return {
          slug: s.slug,
          label: s.label,
          costLow: mortalityCostPerMwh(dr.low, vsl),
          costCentral: mortalityCostPerMwh(dr.central, vsl),
          costHigh: mortalityCostPerMwh(dr.high, vsl),
          modeledShare: dr.modeledShare ?? 0,
          deathCentral: dr.central,
          lcoe,
        };
      }),
    [vsl],
  );

  const x = (v: number) =>
    scale === 'log'
      ? `${clamp01((Math.log10(Math.max(v, 0.01)) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100}%`
      : `${clamp01(Math.min(v, LIN_MAX) / LIN_MAX) * 100}%`;
  const ticks = scale === 'log' ? logTicks : linTicks;

  return (
    <section className="panel p-4 md:p-8" aria-labelledby="value-rule-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker" style={{ marginBottom: '0.35rem' }}>
            The uncounted cost
          </p>
          <h2 id="value-rule-title" className="text-xl" style={{ margin: 0 }}>
            Mortality cost per megawatt-hour
          </h2>
        </div>
        <div className="scale-toggle" role="group" aria-label="Scale">
          <button type="button" aria-pressed={scale === 'log'} onClick={() => setScale('log')}>
            Log
          </button>
          <button type="button" aria-pressed={scale === 'linear'} onClick={() => setScale('linear')}>
            Linear
          </button>
        </div>
      </div>

      <div className="mb-6">
        <VslControl vsl={vsl} onChange={setVsl} />
      </div>

      <div
        className="relative h-[430px] py-8"
        style={{ borderTop: '1px solid var(--chart-gridline)', borderBottom: '1px solid var(--chart-gridline)' }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: 'var(--chart-baseline)' }} />

        {ticks.map((t) => (
          <div key={t} className="absolute top-0 h-full" style={{ left: x(t), borderLeft: '1px solid var(--chart-gridline)' }}>
            <span className="mono absolute -top-6 -translate-x-1/2 text-xs text-[var(--ink-soft)]">
              ${t.toLocaleString()}
            </span>
          </div>
        ))}

        {rows.map((s, i) => {
          const y = 20 + i * 44;
          const countedPct = (1 - s.modeledShare) * 100;
          return (
            <div key={s.slug} className="absolute left-0 right-0" style={{ top: y }}>
              <span className="absolute w-24 text-sm" style={{ fontWeight: 500, lineHeight: 1.1 }}>
                {s.label}
              </span>
              <div className="absolute left-28 right-0 top-2 h-5">
                <div
                  className="h-4 rounded-sm border"
                  title={`${s.label}: ${formatUsdPerMwh(s.costCentral)}/MWh (band ${formatUsdPerMwh(s.costLow)}–${formatUsdPerMwh(s.costHigh)}). ${Math.round(countedPct)}% counted, ${Math.round(s.modeledShare * 100)}% modeled.`}
                  style={{
                    marginLeft: x(s.costLow),
                    width: `calc(${x(s.costHigh)} - ${x(s.costLow)})`,
                    minWidth: '2px',
                    borderColor: 'var(--bar-border)',
                    background: `linear-gradient(90deg, ${colors[i % colors.length]} 0 ${countedPct}%, transparent ${countedPct}%), var(--hatch)`,
                  }}
                />
                <span className="mono ml-2 text-xs text-[var(--ink-soft)]" style={{ position: 'absolute', left: x(s.costHigh), top: -1 }}>
                  {formatUsdPerMwh(s.costCentral)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        Each source&apos;s death rate valued at <span className="mono">{formatUsdPerMwh(vsl / 1e6)}</span> per MWh of exposure —
        i.e. its deaths per TWh priced at the value of a statistical life you chose above. The band is the death-rate
        uncertainty; choosing a different life-value is a second range on top.
      </p>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: '#1f52ad' }} /> counted
        (accident) cost ·{' '}
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: 'var(--hatch)' }} /> modeled
        (pollution / radiation) cost
      </p>

      {/* Comparison to what the market does charge — LCOE. */}
      <h3 style={{ marginTop: '1.6rem' }}>The bill vs the uncounted cost</h3>
      <p className="text-sm text-[var(--ink-soft)]">
        Market price is Lazard&apos;s levelized cost of electricity — what you pay to make the power. Mortality cost is what
        its death toll is worth at the life-value above. Where the last column exceeds one, the uncounted cost is larger
        than the bill.
      </p>
      <div className="overflow-auto">
        <table className="w-full border-collapse" style={{ marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th>Source</th>
              <th>Deaths / TWh</th>
              <th>Mortality cost / MWh</th>
              <th>Market price / MWh</th>
              <th>Uncounted vs bill</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.slug}>
                <td>{s.label}</td>
                <td className="mono">{fmt(s.deathCentral)}</td>
                <td className="mono">{formatUsdPerMwh(s.costCentral)}</td>
                <td className="mono">{s.lcoe == null ? '—' : formatUsdPerMwh(s.lcoe)}</td>
                <td className="mono">{ratioText(s.costCentral, s.lcoe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        Oil, hydro, and biomass show no market price because Lazard 2026 publishes no comparable figure for them; their
        mortality cost still appears. All figures use central estimates.
      </p>
    </section>
  );
}
