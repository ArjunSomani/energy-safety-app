'use client';

import sourcesData from '@/data/sources.json';
import { fmt } from '@/lib/format';
import { VSL_CENTRAL, formatUsdPerMwh, formatVsl, mortalityCostPerMwhBand } from '@/lib/value';
import { useState } from 'react';
import type { Band } from '@/lib/types';

// The same ranked ladder as the risk rule, but the measure is switchable — so a
// reader can watch the ranking reshuffle: coal leads on deaths and CO₂, nuclear
// on cost, biomass on land. Reuses the site's sources.json; no new data. Kept
// separate from RiskRule so the many deaths-only usages stay untouched.

type Src = (typeof sourcesData)[number];
type MetricRow = { slug: string; label: string; band: Band | null; modeledShare: number | null };

type Metric = {
  key: string;
  label: string;
  title: string;
  band: (s: Src) => Band | null;
  modeled?: (s: Src) => number; // counted/modeled split, deaths-derived measures only
  fmtVal: (v: number) => string;
  dollar: boolean; // prefix axis ticks with $
  logMin: number;
  logMax: number;
  logTicks: number[];
  linMax: number;
  linTicks: number[];
  caption: string;
};

const nn = (b: { low: number | null; central: number | null; high: number | null }): Band | null =>
  b.low == null || b.central == null || b.high == null ? null : { low: b.low, central: b.central, high: b.high };

const METRICS: Metric[] = [
  {
    key: 'deaths',
    label: 'Deaths',
    title: 'Deaths per terawatt-hour',
    band: (s) => nn(s.deathRate),
    modeled: (s) => s.deathRate.modeledShare ?? 0,
    fmtVal: (v) => fmt(v),
    dollar: false,
    logMin: -2,
    logMax: 3,
    logTicks: [0.01, 0.1, 1, 10, 100, 1000],
    linMax: 250,
    linTicks: [0, 50, 100, 150, 200, 250],
    caption: 'Deaths per unit of electricity. Solid is counted (accidents); hatched is modeled (pollution / radiation).',
  },
  {
    key: 'co2',
    label: 'CO₂',
    title: 'Lifecycle CO₂ per kilowatt-hour',
    band: (s) => nn(s.lifecycleCO2),
    fmtVal: (v) => fmt(v),
    dollar: false,
    logMin: 0,
    logMax: 3,
    logTicks: [1, 10, 100, 1000],
    linMax: 1000,
    linTicks: [0, 250, 500, 750, 1000],
    caption: 'Grams of CO₂-equivalent per kWh, whole lifecycle (IPCC AR5 medians). This is climate pollution, not a death rate.',
  },
  {
    key: 'land',
    label: 'Land',
    title: 'Land footprint per terawatt-hour',
    band: (s) => nn(s.landUse),
    fmtVal: (v) => fmt(v),
    dollar: false,
    logMin: -1,
    logMax: 3,
    logTicks: [0.1, 1, 10, 100, 1000],
    linMax: 450,
    linTicks: [0, 150, 300, 450],
    caption: 'Land occupied per unit of yearly output. Two source methodologies are mixed (UNECE and van Zalk & Behrens), so cross-source land carries extra uncertainty — see Methodology.',
  },
  {
    key: 'cost',
    label: 'Cost',
    title: 'Levelized cost per megawatt-hour',
    band: (s) => nn(s.lcoe),
    fmtVal: (v) => formatUsdPerMwh(v),
    dollar: true,
    logMin: 1,
    logMax: 3,
    logTicks: [10, 100, 1000],
    linMax: 300,
    linTicks: [0, 100, 200, 300],
    caption: 'Lazard 2026 levelized cost — the market price of the electricity. Oil, hydro, and biomass have no comparable figure and are listed apart.',
  },
  {
    key: 'mortality',
    label: 'Mortality $',
    title: 'Mortality cost per megawatt-hour',
    band: (s) => mortalityCostPerMwhBand(s.deathRate, VSL_CENTRAL),
    modeled: (s) => s.deathRate.modeledShare ?? 0,
    fmtVal: (v) => formatUsdPerMwh(v),
    dollar: true,
    logMin: -2,
    logMax: 4,
    logTicks: [0.01, 0.1, 1, 10, 100, 1000, 10000],
    linMax: 400,
    linTicks: [0, 100, 200, 300, 400],
    caption: `Each source's deaths valued at the central life-value (${formatVsl(VSL_CENTRAL)}) — the cost the electricity bill leaves out. Solid counted, hatched modeled.`,
  },
];

const colors = ['#0f2f6b', '#17408c', '#1f52ad', '#3568bd', '#5a83c9', '#85a3d6', '#b0c4e4', '#d7e2f2'];
const clamp01 = (f: number) => Math.min(1, Math.max(0, f));

export default function MetricLadder() {
  const [metricKey, setMetricKey] = useState('deaths');
  const [scale, setScale] = useState<'log' | 'linear'>('log');
  const metric = METRICS.find((m) => m.key === metricKey)!;

  // Rank by central value, descending; sources with no figure (e.g. oil's cost)
  // drop to the bottom and render without a bar rather than as a silent zero.
  const rows: MetricRow[] = sourcesData
    .map((s) => ({ slug: s.slug, label: s.label, band: metric.band(s), modeledShare: metric.modeled ? metric.modeled(s) : null }))
    .sort((a, b) => (b.band?.central ?? -1) - (a.band?.central ?? -1));

  const x = (v: number) =>
    scale === 'log'
      ? `${clamp01((Math.log10(Math.max(v, 10 ** metric.logMin)) - metric.logMin) / (metric.logMax - metric.logMin)) * 100}%`
      : `${clamp01(Math.min(v, metric.linMax) / metric.linMax) * 100}%`;
  const ticks = scale === 'log' ? metric.logTicks : metric.linTicks;
  const hasBars = rows.some((r) => r.band);

  // Nuclear, wind and solar sit within each other's uncertainty on the two
  // death-based measures — the engine already refuses to rank them apart, so
  // mark that zone rather than implying an order. Only shown where it's true.
  const OVERLAP = new Set(['nuclear', 'wind', 'solar']);
  const overlapMetric = metric.key === 'deaths' || metric.key === 'mortality';
  const overlapIdx = overlapMetric ? rows.map((r, i) => (OVERLAP.has(r.slug) ? i : -1)).filter((i) => i >= 0) : [];
  const overlapBand =
    overlapIdx.length >= 2
      ? { top: 20 + Math.min(...overlapIdx) * 44 - 10, height: (Math.max(...overlapIdx) - Math.min(...overlapIdx)) * 44 + 34 }
      : null;

  return (
    <section className="panel p-4 md:p-8" aria-labelledby="metric-ladder-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker" style={{ marginBottom: '0.35rem' }}>
            One ladder, every measure
          </p>
          <h2 id="metric-ladder-title" className="text-xl" style={{ margin: 0 }} aria-live="polite">
            {metric.title}
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

      <div className="scale-toggle mb-6" role="group" aria-label="Measure" style={{ flexWrap: 'wrap' }}>
        {METRICS.map((m) => (
          <button key={m.key} type="button" aria-pressed={m.key === metricKey} onClick={() => setMetricKey(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      <div
        className="relative h-[430px] py-8"
        style={{ borderTop: '1px solid var(--chart-gridline)', borderBottom: '1px solid var(--chart-gridline)' }}
      >
        {overlapBand ? (
          <div
            className="absolute left-0 right-0 rounded-sm"
            aria-hidden="true"
            style={{ top: overlapBand.top, height: overlapBand.height, background: 'var(--accent-soft)', opacity: 0.6, pointerEvents: 'none' }}
          />
        ) : null}

        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: 'var(--chart-baseline)' }} />

        {ticks.map((t) => (
          <div key={t} className="absolute top-0 h-full" style={{ left: x(t), borderLeft: '1px solid var(--chart-gridline)' }}>
            <span className="mono absolute -top-6 -translate-x-1/2 text-xs text-[var(--ink-soft)]">
              {metric.dollar ? '$' : ''}
              {t.toLocaleString()}
            </span>
          </div>
        ))}

        {rows.map((r, i) => {
          const y = 20 + i * 44;
          const countedPct = r.modeledShare == null ? 100 : (1 - r.modeledShare) * 100;
          return (
            <div key={r.slug} className="absolute left-0 right-0" style={{ top: y }}>
              <span className="absolute w-24 text-sm" style={{ fontWeight: 500, lineHeight: 1.1 }}>
                {r.label}
              </span>
              <div className="absolute left-28 right-0 top-2 h-5">
                {r.band ? (
                  <>
                    <div
                      className="h-4 rounded-sm border"
                      title={`${r.label}: ${metric.fmtVal(r.band.central)} (band ${metric.fmtVal(r.band.low)}–${metric.fmtVal(r.band.high)})`}
                      style={{
                        marginLeft: x(r.band.low),
                        width: `calc(${x(r.band.high)} - ${x(r.band.low)})`,
                        minWidth: '2px',
                        borderColor: 'var(--bar-border)',
                        background:
                          r.modeledShare == null
                            ? colors[i % colors.length]
                            : `linear-gradient(90deg, ${colors[i % colors.length]} 0 ${countedPct}%, transparent ${countedPct}%), var(--hatch)`,
                      }}
                    />
                    <span className="mono ml-2 text-xs text-[var(--ink-soft)]" style={{ position: 'absolute', left: x(r.band.high), top: -1 }}>
                      {metric.fmtVal(r.band.central)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-[var(--ink-muted)]" style={{ position: 'absolute', left: 0, top: 1 }}>
                    no comparable data
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-[var(--ink-soft)]">{metric.caption}</p>
      {overlapBand ? (
        <p className="mt-3 text-sm text-[var(--ink-soft)]">
          <span
            style={{ display: 'inline-block', width: '0.85rem', height: '0.85rem', borderRadius: 3, background: 'var(--accent-soft)', border: '1px solid var(--rule-strong)', verticalAlign: 'middle', marginRight: '0.4rem' }}
          />
          The three lowest — nuclear, wind and solar — sit within each other&apos;s uncertainty. This site doesn&apos;t rank
          them apart.
        </p>
      ) : null}
      {metric.modeled ? (
        <p className="mt-3 text-sm text-[var(--ink-soft)]">
          <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: '#1f52ad' }} /> counted ·{' '}
          <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: 'var(--hatch)' }} /> modeled
        </p>
      ) : null}
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        {hasBars
          ? scale === 'log'
            ? 'Log scale: each step right is ten times the last, so the visual gap understates how far apart the extremes really are.'
            : 'Linear scale: faithful to the true gaps, but it collapses the smallest sources onto the axis.'
          : null}{' '}
        The ranking changes with the measure — the safest source is not the cheapest or the lowest-carbon.
      </p>
    </section>
  );
}
