'use client';

import Link from 'next/link';
import RiskRule from '@/components/RiskRule';
import BandTimeline, { type BandPoint } from '@/components/model/BandTimeline';
import DayProfileChart from '@/components/model/DayProfileChart';
import HeadlineSummary from '@/components/model/HeadlineSummary';
import HowItWorks from '@/components/model/HowItWorks';
import ReliabilityPanel from '@/components/model/ReliabilityPanel';
import ScenarioControls from '@/components/model/ScenarioControls';
import StackedAreaMix from '@/components/model/StackedAreaMix';
import Term, { GLOSSARY } from '@/components/model/Term';
import { pairedDelta } from '@/lib/model-impacts';
import {
  BASE_YEAR,
  DEFAULT_UI_SCENARIO,
  END_YEAR,
  type ScenarioRun,
  type UiScenario,
  runScenario,
  uiScenarioFromQuery,
  uiScenarioToQuery,
} from '@/lib/model-run';
import type { Band } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

const COLOR_A = 'var(--ink)';
const COLOR_B = 'var(--series-2)';

const B_DEFAULT: UiScenario = {
  label: 'Announced retirements only, no new build',
  buildRatesGw: {},
  demandGrowth: 0.01,
  retirementPolicy: 'announced-only',
  solarLearningRate: 0.2,
  batteryLearningRate: 0.18,
};

function fmt(n: number, digits = 3) {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: digits }).format(n);
}

export default function ModelPage() {
  const [a, setA] = useState<UiScenario>(DEFAULT_UI_SCENARIO);
  const [b, setB] = useState<UiScenario>(B_DEFAULT);
  const [showB, setShowB] = useState(false);
  const [mode, setMode] = useState<'annual' | 'cumulative'>('annual');
  const [relYear, setRelYear] = useState<number>(END_YEAR);

  // Restore scenarios from the URL on first load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length) {
      setA(uiScenarioFromQuery(params, DEFAULT_UI_SCENARIO, ''));
      if ([...params.keys()].some((k) => k.startsWith('B_'))) {
        setB(uiScenarioFromQuery(params, B_DEFAULT, 'B_'));
        setShowB(true);
      }
    }
  }, []);

  const runA = useMemo(() => runScenario(a), [a]);
  const runB = useMemo(() => runScenario(b), [b]);

  // Keep the URL shareable (B only once revealed).
  useEffect(() => {
    const merged = new URLSearchParams();
    for (const [k, v] of uiScenarioToQuery(a, '')) merged.set(k, v);
    if (showB) for (const [k, v] of uiScenarioToQuery(b, 'B_')) merged.set(k, v);
    window.history.replaceState(null, '', `/model?${merged.toString()}`);
  }, [a, b, showB]);

  const years = runA.model.years.map((y) => y.year);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="kicker">The model · US · to 2050</p>
      <h1 className="text-4xl">A US electricity transition model</h1>

      <div className="panel p-4" style={{ background: 'var(--accent-soft)', marginBottom: '1.25rem', maxWidth: '48rem' }}>
        <p style={{ margin: 0 }}>
          <b>This is a model.</b> Unlike the rest of this site, its outputs depend on assumptions about the future that no
          citation can settle. Every assumption below is adjustable and disclosed. It takes <em>decisions</em> — build
          rates, retirement policy, demand growth — and evolves the fleet; the mix is an output, not an input.
        </p>
        <p className="text-sm" style={{ margin: '0.6rem 0 0', color: 'var(--ink-soft)' }}>
          It starts from the real US power fleet (EIA {BASE_YEAR}) and answers “what would this fleet produce and cost,”
          not “could this happen” — transmission, markets, permitting and supply chains are out of scope. The base data
          is checked against EIA’s national totals; see <Link href="/model/assumptions">every assumption, its source, and
          how the fleet reconciles</Link>.
        </p>
      </div>

      <HowItWorks />

      {/* Controls — Scenario A always; B revealed on demand (progressive disclosure) */}
      <div className={`grid gap-6 ${showB ? 'md:grid-cols-2' : ''}`}>
        <section className="panel p-4">
          <div className="flex items-end justify-between" style={{ marginBottom: '0.6rem' }}>
            <h2 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              {showB ? <span style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_A, display: 'inline-block' }} /> : null}
              {showB ? 'Scenario A' : 'Your scenario'}
            </h2>
          </div>
          <ScenarioControls scenario={a} onChange={setA} accent={COLOR_A} />
        </section>
        {showB ? (
          <section className="panel p-4">
            <div className="flex items-end justify-between" style={{ marginBottom: '0.6rem' }}>
              <h2 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_B, display: 'inline-block' }} /> Scenario B
              </h2>
              <button type="button" className="btn btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }} onClick={() => setShowB(false)}>
                Hide
              </button>
            </div>
            <ScenarioControls scenario={b} onChange={setB} accent={COLOR_B} />
          </section>
        ) : null}
      </div>
      {!showB ? (
        <button type="button" className="btn btn-ghost" style={{ marginTop: '0.8rem' }} onClick={() => setShowB(true)}>
          + Compare against a second scenario
        </button>
      ) : null}

      {/* Plain-language headline for the primary scenario */}
      <h2>In plain terms — {showB ? 'Scenario A' : 'your scenario'}</h2>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem', marginTop: '-0.2rem' }}>
        The short version of what the settings above produce. Dotted words have plain definitions — hover or tap them.
      </p>
      <HeadlineSummary run={runA} endYear={END_YEAR} />

      {/* Generation mix */}
      <h2>What the grid is made of, over time</h2>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem' }}>
        Each coloured band is how much electricity a group of sources makes each year, stacked up. The dashed line is
        total demand. <b>Where the colours stop below the dashed line, there isn’t enough</b> — the fleet can’t meet
        demand. Select any year — pointer, tap or arrow keys — to read the numbers. (“Fossil fuels” combines coal, gas and oil; per-source detail is in
        the harm figures below.)
      </p>
      <div className={`grid gap-6 ${showB ? 'md:grid-cols-2' : ''}`}>
        <div className="panel p-4">
          <StackedAreaMix years={runA.model.years} title={showB ? 'Scenario A' : undefined} />
        </div>
        {showB ? (
          <div className="panel p-4">
            <StackedAreaMix years={runB.model.years} title="Scenario B" />
          </div>
        ) : null}
      </div>

      {/* Impacts */}
      <div className="flex items-end justify-between" style={{ marginTop: '1.8rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>The harms and the cost</h2>
        <div className="scale-toggle" role="group" aria-label="Per year or added up">
          <button type="button" aria-pressed={mode === 'annual'} onClick={() => setMode('annual')}>
            Per year
          </button>
          <button type="button" aria-pressed={mode === 'cumulative'} onClick={() => setMode('cumulative')}>
            Added up
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem' }}>
        The model applies the same per-source figures as the rest of the site to the electricity above. Each result is a
        shaded <Term k="uncertainty band">range, not one number</Term>, and the range <b>widens further into the future</b>,
        where less is knowable.{showB ? ' The solid band is Scenario A; the dashed line is Scenario B.' : ''} Switch to “Added up” to see
        the <Term k="cumulative">cumulative</Term> total over all years.
      </p>
      <div className="grid gap-6 md:grid-cols-2" style={{ marginTop: '0.5rem' }}>
        <div className="panel p-4">
          <BandTimeline
            a={series(runA, mode, 'deaths')}
            b={showB ? series(runB, mode, 'deaths') : undefined}
            unit={mode === 'annual' ? 'deaths/yr' : 'deaths, cumulative'}
            title="Deaths"
            colorA={COLOR_A}
          />
        </div>
        <div className="panel p-4">
          <BandTimeline
            a={series(runA, mode, 'co2')}
            b={showB ? series(runB, mode, 'co2') : undefined}
            unit={mode === 'annual' ? 'Mt CO₂/yr' : 'Mt CO₂, cumulative'}
            title="CO₂"
            colorA={COLOR_A}
          />
        </div>
        <div className="panel p-4">
          <BandTimeline
            a={series(runA, mode, 'cost')}
            b={showB ? series(runB, mode, 'cost') : undefined}
            unit={mode === 'annual' ? 'USD bn/yr' : 'USD bn, cumulative'}
            title="Cost"
            colorA={COLOR_A}
          />
        </div>
        <div className="panel p-4">
          <BandTimeline a={landSeries(runA)} b={showB ? landSeries(runB) : undefined} unit="km² (annual footprint)" title="Land" colorA={COLOR_A} />
          <p className="text-xs text-[var(--ink-soft)]" style={{ margin: '0.4rem 0 0' }}>
            Land is a standing footprint, not a flow, so it is always shown annually — a cumulative integral would be
            area·years.
          </p>
        </div>
      </div>

      {/* Reliability */}
      <div className="flex items-end justify-between" style={{ marginTop: '1.8rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Can it keep the lights on?</h2>
        <label className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Year{' '}
          <select
            className="mono"
            value={relYear}
            onChange={(e) => setRelYear(Number(e.target.value))}
            style={{ padding: '0.2rem 0.4rem' }}
          >
            {years.filter((y) => y % 5 === 0 || y === END_YEAR).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem' }}>
        The real test isn’t the yearly total — it’s every hour. Below is one <b>typical summer day</b> in {relYear}.
        Supply stacks up from the bottom; the dashed line is demand. <b>Where the colours can’t reach the line, that
        hatched gap is </b>
        <Term k="unserved energy">unserved energy</Term> — the lights flicker. Notice how solar vanishes through the evening
        and overnight just as demand stays high.
      </p>
      <div className={`grid gap-6 ${showB ? 'md:grid-cols-2' : ''}`} style={{ marginTop: '0.5rem' }}>
        <div className="panel p-4">
          {showB ? (
            <p className="label" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOR_A, display: 'inline-block' }} /> Scenario A · a day in {relYear}
            </p>
          ) : null}
          <DayProfileChart d={dispatchFor(runA, relYear)} accent={COLOR_A} />
        </div>
        {showB ? (
          <div className="panel p-4">
            <p className="label" style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOR_B, display: 'inline-block' }} /> Scenario B · a day in {relYear}
            </p>
            <DayProfileChart d={dispatchFor(runB, relYear)} accent={COLOR_B} />
          </div>
        ) : null}
      </div>
      <div className={`grid gap-6 ${showB ? 'md:grid-cols-2' : ''}`} style={{ marginTop: '1rem' }}>
        <ReliabilityPanel d={dispatchFor(runA, relYear)} accent={COLOR_A} />
        {showB ? <ReliabilityPanel d={dispatchFor(runB, relYear)} accent={COLOR_B} /> : null}
      </div>

      {/* Deltas — only meaningful once B is revealed */}
      {showB ? (
        <>
          <h2 style={{ marginTop: '1.8rem' }}>A vs B — the trade-off</h2>
          <PlainCompare runA={runA} runB={runB} />
          <details style={{ marginTop: '0.8rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--accent)' }}>Show the exact numbers (A − B in {END_YEAR})</summary>
            <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem', marginTop: '0.6rem' }}>
              The two scenarios share the <b>same</b> per-source coefficients — coal’s death rate is one number applied to
              two different amounts of coal — so this is a <b>paired</b> comparison: the coefficient uncertainty largely
              cancels, and the difference is far more certain than either scenario’s own range. Where the paired range
              still crosses zero, the difference is genuinely <b>smaller than the uncertainty</b> — flagged in the last
              column. (Horizon uncertainty, which widens toward 2050, is scenario-specific and is shown on the charts
              above, not differenced here.)
            </p>
            <DeltaTable runA={runA} runB={runB} />
          </details>
        </>
      ) : null}

      {/* Context: the risk rule */}
      <h2 style={{ marginTop: '2rem' }}>The coefficients behind the death figures</h2>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem' }}>
        The model reuses these exact per-TWh death rates — the same chart, hatch pattern and log/linear scale as the rest
        of the site. Solid is counted deaths, hatched is modeled.
      </p>
      <RiskRule />

      {/* Glossary */}
      <h2 style={{ marginTop: '2rem' }}>Plain-language glossary</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(GLOSSARY).map(([k, { term, plain }]) => (
          <div key={k} className="panel p-3">
            <p className="mono" style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem' }}>
              {term}
            </p>
            <p className="text-sm" style={{ margin: '0.2rem 0 0', color: 'var(--ink-soft)' }}>
              {plain}
            </p>
          </div>
        ))}
      </div>

      <p className="text-sm text-[var(--ink-soft)]" style={{ marginTop: '1.5rem' }}>
        Every number here is reproducible from the committed EIA {BASE_YEAR} snapshot and the pure model engines. Nothing
        is fetched at runtime. <Link href="/model/assumptions">See every assumption →</Link>
      </p>
    </main>
  );
}

// Plain-language A/B comparison: which scenario comes out lower on each measure,
// and by how much — with "about the same" when the ranges overlap. Neutral: it
// reports which is lower, never which is better.
function PlainCompare({ runA, runB }: { runA: ScenarioRun; runB: ScenarioRun }) {
  const ia = last(runA.impacts.years);
  const ib = last(runB.impacts.years);
  const da = dispatchFor(runA, END_YEAR);
  const db = dispatchFor(runB, END_YEAR);

  // Paired: "about the same" only when the shared-coefficient difference can't
  // even resolve the sign (its range crosses zero).
  const crossesZero = (a: Band, b: Band) => {
    const d = pairedDelta(a, b);
    return d.low <= 0 && d.high >= 0;
  };
  const rows: { label: string; aVal: number; bVal: number; overlap: boolean }[] = [
    { label: 'Deaths per year', aVal: ia.annualCoef.deaths.central, bVal: ib.annualCoef.deaths.central, overlap: crossesZero(ia.annualCoef.deaths, ib.annualCoef.deaths) },
    { label: 'Climate pollution (CO₂/yr)', aVal: ia.annualCoef.co2Mt.central, bVal: ib.annualCoef.co2Mt.central, overlap: crossesZero(ia.annualCoef.co2Mt, ib.annualCoef.co2Mt) },
    { label: 'Unmet demand', aVal: da.unservedTwh, bVal: db.unservedTwh, overlap: false },
    { label: 'Cost to run per year', aVal: ia.annualCoef.costUsdBn.central, bVal: ib.annualCoef.costUsdBn.central, overlap: crossesZero(ia.annualCoef.costUsdBn, ib.annualCoef.costUsdBn) },
  ];

  return (
    <div className="panel p-4" style={{ maxWidth: '48rem' }}>
      <p className="text-sm" style={{ marginTop: 0 }}>
        In <b>{END_YEAR}</b>, neither scenario wins on everything — each is lower on some measures and higher on others.
        That trade-off is the whole point of the model.
      </p>
      <div className="grid" style={{ gap: '0.4rem' }}>
        {rows.map((r) => {
          const lowerIsA = r.aVal < r.bVal;
          const hi = Math.max(r.aVal, r.bVal);
          const lo = Math.min(r.aVal, r.bVal);
          const pct = hi > 0 ? Math.round(((hi - lo) / hi) * 100) : 0;
          return (
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '11rem 1fr', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--ink-soft)' }}>{r.label}</span>
              <span>
                {r.overlap || pct < 3 ? (
                  <span style={{ color: 'var(--ink-muted)' }}>about the same in both{r.overlap ? ' (within the range)' : ''}</span>
                ) : (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: lowerIsA ? COLOR_A : COLOR_B, display: 'inline-block' }} />
                      <b>Scenario {lowerIsA ? 'A' : 'B'}</b> is lower
                    </span>
                    <span style={{ color: 'var(--ink-muted)' }}> — by about {pct}%</span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// --- series extractors ---

function series(run: ScenarioRun, mode: 'annual' | 'cumulative', metric: 'deaths' | 'co2' | 'cost'): BandPoint[] {
  return run.impacts.years.map((y) => {
    let band: Band;
    if (mode === 'annual') {
      band = metric === 'deaths' ? y.annual.deaths : metric === 'co2' ? y.annual.co2Mt : y.annual.costUsdBn;
    } else {
      band = metric === 'deaths' ? y.cumulative.deaths : metric === 'co2' ? y.cumulative.co2Mt : y.cumulative.costUsdBn;
    }
    return { year: y.year, band };
  });
}

function landSeries(run: ScenarioRun): BandPoint[] {
  return run.impacts.years.map((y) => ({ year: y.year, band: y.annual.landKm2 }));
}

function dispatchFor(run: ScenarioRun, year: number) {
  return run.dispatchByYear.find((d) => d.year === year) ?? run.dispatchByYear[run.dispatchByYear.length - 1];
}

// --- delta table ---

function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

function DeltaTable({ runA, runB }: { runA: ScenarioRun; runB: ScenarioRun }) {
  const ia = last(runA.impacts.years);
  const ib = last(runB.impacts.years);
  const da = dispatchFor(runA, END_YEAR);
  const db = dispatchFor(runB, END_YEAR);
  const fa = last(runA.feedbacks.years);
  const fb = last(runB.feedbacks.years);

  // Difference the coefficient-only bands with a PAIRED draw (pairedDelta) — the
  // shared coefficient cancels, so the delta is far tighter and keeps its sign.
  const rows = [
    { label: `Deaths/yr (${END_YEAR})`, a: ia.annualCoef.deaths, b: ib.annualCoef.deaths, unit: '', digits: 3 },
    { label: `CO₂ Mt/yr (${END_YEAR})`, a: ia.annualCoef.co2Mt, b: ib.annualCoef.co2Mt, unit: ' Mt', digits: 3 },
    { label: `Land km² (${END_YEAR})`, a: ia.annualCoef.landKm2, b: ib.annualCoef.landKm2, unit: ' km²', digits: 3 },
    { label: `Cost USD bn/yr (${END_YEAR})`, a: ia.annualCoef.costUsdBn, b: ib.annualCoef.costUsdBn, unit: ' bn', digits: 3 },
    { label: `Cumulative CO₂ (Gt, ${runA.model.years[0].year}–${END_YEAR})`, a: scaleBand(ia.cumulativeCoef.co2Mt, 0.001), b: scaleBand(ib.cumulativeCoef.co2Mt, 0.001), unit: ' Gt', digits: 3 },
  ];

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Scenario A minus Scenario B in the final year, by impact.</caption>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Scenario A</th>
            <th scope="col">Scenario B</th>
            <th scope="col">A − B (paired)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const delta = pairedDelta(r.a, r.b);
            const includesZero = delta.low <= 0 && delta.high >= 0;
            const sign = (n: number) => `${n > 0 ? '+' : ''}${fmt(n, r.digits)}`;
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="mono">{fmt(r.a.central, r.digits)}{r.unit}</td>
                <td className="mono">{fmt(r.b.central, r.digits)}{r.unit}</td>
                <td className="mono">
                  {sign(delta.central)}
                  {r.unit}
                  <span style={{ color: 'var(--ink-muted)' }}> ({sign(delta.low)} to {sign(delta.high)})</span>
                  {includesZero ? <div style={{ color: 'var(--ink-muted)', fontSize: '0.72rem' }}>smaller than the uncertainty band</div> : null}
                </td>
              </tr>
            );
          })}
          <tr>
            <td>Unserved energy (TWh/yr, {END_YEAR})</td>
            <td className="mono">{fmt(da.unservedTwh, 3)}</td>
            <td className="mono">{fmt(db.unservedTwh, 3)}</td>
            <td className="mono">{da.unservedTwh - db.unservedTwh > 0 ? '+' : ''}{fmt(da.unservedTwh - db.unservedTwh, 3)}</td>
          </tr>
          <tr>
            <td>Cumulative capital (USD bn)</td>
            <td className="mono">{fmt(fa.cumulativeCapexUsdBn, 3)}</td>
            <td className="mono">{fmt(fb.cumulativeCapexUsdBn, 3)}</td>
            <td className="mono">{fa.cumulativeCapexUsdBn - fb.cumulativeCapexUsdBn > 0 ? '+' : ''}{fmt(fa.cumulativeCapexUsdBn - fb.cumulativeCapexUsdBn, 3)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-[var(--ink-soft)]" style={{ marginTop: '0.6rem' }}>
        Unserved energy and capital are single-path model outputs (no coefficient band), so their deltas are point
        differences. The banded metrics carry both coefficient and horizon uncertainty.
      </p>
    </div>
  );
}

function scaleBand(band: Band, k: number): Band {
  return { low: band.low * k, central: band.central * k, high: band.high * k };
}
