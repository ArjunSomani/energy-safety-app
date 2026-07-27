'use client';

import RiskRule from '@/components/RiskRule';
import BandTimeline, { type BandPoint } from '@/components/model/BandTimeline';
import ReliabilityPanel from '@/components/model/ReliabilityPanel';
import ScenarioControls from '@/components/model/ScenarioControls';
import StackedAreaMix from '@/components/model/StackedAreaMix';
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
import eiaMeta from '@/data/eia-meta.json';

const COLOR_A = 'var(--ink)';
const COLOR_B = '#c2762f';

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
  const [mode, setMode] = useState<'annual' | 'cumulative'>('annual');
  const [relYear, setRelYear] = useState<number>(END_YEAR);

  // Restore scenarios from the URL on first load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length) {
      setA(uiScenarioFromQuery(params, DEFAULT_UI_SCENARIO, ''));
      setB(uiScenarioFromQuery(params, B_DEFAULT, 'B_'));
    }
  }, []);

  const runA = useMemo(() => runScenario(a), [a]);
  const runB = useMemo(() => runScenario(b), [b]);

  // Keep the URL shareable.
  useEffect(() => {
    const pa = uiScenarioToQuery(a, '');
    const pb = uiScenarioToQuery(b, 'B_');
    const merged = new URLSearchParams();
    for (const [k, v] of pa) merged.set(k, v);
    for (const [k, v] of pb) merged.set(k, v);
    window.history.replaceState(null, '', `/model?${merged.toString()}`);
  }, [a, b]);

  const years = runA.model.years.map((y) => y.year);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="kicker">The model · US · to 2050</p>
      <h1 className="text-4xl">A US electricity transition model</h1>

      <div className="panel p-4" style={{ borderLeft: '3px solid var(--accent)', background: 'var(--accent-soft)', marginBottom: '1.25rem', maxWidth: '48rem' }}>
        <p style={{ margin: 0 }}>
          <b>This is a model.</b> Unlike the rest of this site, its outputs depend on assumptions about the future that no
          citation can settle. Every assumption below is adjustable and disclosed. It takes <em>decisions</em> — build
          rates, retirement policy, demand growth — and evolves the fleet; the mix is an output, not an input.
        </p>
        <p className="text-sm" style={{ margin: '0.6rem 0 0', color: 'var(--ink-soft)' }}>
          Base fleet: EIA {BASE_YEAR}, reconciled to {fmt(eiaMeta.nationalCapabilityMw / 1000, 4)} GW national capability
          ({eiaMeta.reconciliationDiffPct}% off). It answers “what would this fleet produce and cost,” not “could this
          happen.” Transmission, market clearing, siting, supply chains and policy feasibility are out of scope. See{' '}
          <a href="/model/assumptions">every assumption, its default and its source</a>.
        </p>
      </div>

      {/* Controls: A vs B */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel p-4">
          <div className="flex items-end justify-between" style={{ marginBottom: '0.6rem' }}>
            <h2 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_A, display: 'inline-block' }} /> Scenario A
            </h2>
          </div>
          <ScenarioControls scenario={a} onChange={setA} accent={COLOR_A} />
        </section>
        <section className="panel p-4">
          <div className="flex items-end justify-between" style={{ marginBottom: '0.6rem' }}>
            <h2 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_B, display: 'inline-block' }} /> Scenario B
            </h2>
          </div>
          <ScenarioControls scenario={b} onChange={setB} accent={COLOR_B} />
        </section>
      </div>

      {/* Generation mix */}
      <h2>Generation mix over time</h2>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem' }}>
        Annual generation by technology, {years[0]}–{years[years.length - 1]}. The dashed line is demand; where the stack
        falls below it, the fleet cannot meet demand on energy alone (the reliability panel below dispatches it hour by
        hour). Storage and geothermal carry no descriptive impact coefficient and are shown but excluded from the impact
        figures.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="panel p-4">
          <StackedAreaMix years={runA.model.years} title="Scenario A" />
        </div>
        <div className="panel p-4">
          <StackedAreaMix years={runB.model.years} title="Scenario B" />
        </div>
      </div>

      {/* Impacts */}
      <div className="flex items-end justify-between" style={{ marginTop: '1.8rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Impacts, as uncertainty bands</h2>
        <div className="scale-toggle" role="group" aria-label="Annual or cumulative">
          <button type="button" aria-pressed={mode === 'annual'} onClick={() => setMode('annual')}>
            Annual
          </button>
          <button type="button" aria-pressed={mode === 'cumulative'} onClick={() => setMode('cumulative')}>
            Cumulative
          </button>
        </div>
      </div>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem' }}>
        Same per-TWh coefficients and low–high bands as the rest of the site, applied to the modeled generation. Bands
        <b> widen with the horizon</b>: a 2050 figure is deliberately less precise than a near-term one. The solid band is
        Scenario A; the dashed line is Scenario B’s central estimate.
      </p>
      <div className="grid gap-6 md:grid-cols-2" style={{ marginTop: '0.5rem' }}>
        <div className="panel p-4">
          <BandTimeline
            a={series(runA, mode, 'deaths')}
            b={series(runB, mode, 'deaths')}
            unit={mode === 'annual' ? 'deaths/yr' : 'deaths, cumulative'}
            title="Deaths"
            colorA={COLOR_A}
          />
        </div>
        <div className="panel p-4">
          <BandTimeline
            a={series(runA, mode, 'co2')}
            b={series(runB, mode, 'co2')}
            unit={mode === 'annual' ? 'Mt CO₂/yr' : 'Mt CO₂, cumulative'}
            title="CO₂"
            colorA={COLOR_A}
          />
        </div>
        <div className="panel p-4">
          <BandTimeline
            a={series(runA, mode, 'cost')}
            b={series(runB, mode, 'cost')}
            unit={mode === 'annual' ? 'USD bn/yr' : 'USD bn, cumulative'}
            title="Cost"
            colorA={COLOR_A}
          />
        </div>
        <div className="panel p-4">
          <BandTimeline a={landSeries(runA)} b={landSeries(runB)} unit="km² (annual footprint)" title="Land" colorA={COLOR_A} />
          <p className="text-xs text-[var(--ink-soft)]" style={{ margin: '0.4rem 0 0' }}>
            Land is a standing footprint, not a flow, so it is always shown annually — a cumulative integral would be
            area·years.
          </p>
        </div>
      </div>

      {/* Reliability */}
      <div className="flex items-end justify-between" style={{ marginTop: '1.8rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Reliability — the centerpiece</h2>
        <label className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Year{' '}
          <select
            className="mono"
            value={relYear}
            onChange={(e) => setRelYear(Number(e.target.value))}
            style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)', padding: '0.2rem 0.4rem' }}
          >
            {years.filter((y) => y % 5 === 0 || y === END_YEAR).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-6 md:grid-cols-2" style={{ marginTop: '0.5rem' }}>
        <ReliabilityPanel d={dispatchFor(runA, relYear)} accent={COLOR_A} />
        <ReliabilityPanel d={dispatchFor(runB, relYear)} accent={COLOR_B} />
      </div>

      {/* Deltas */}
      <h2 style={{ marginTop: '1.8rem' }}>A − B in {END_YEAR}</h2>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem' }}>
        Differences render as signed ranges. When the two scenarios’ uncertainty bands overlap, the honest reading is that
        the difference is <b>smaller than the uncertainty</b> in either estimate — flagged below.
      </p>
      <DeltaTable runA={runA} runB={runB} />

      {/* Context: the risk rule */}
      <h2 style={{ marginTop: '2rem' }}>The coefficients behind the death figures</h2>
      <p className="text-sm text-[var(--ink-soft)]" style={{ maxWidth: '48rem' }}>
        The model reuses these exact per-TWh death rates — the same chart, hatch pattern and log/linear scale as the rest
        of the site. Solid is counted deaths, hatched is modeled.
      </p>
      <RiskRule />

      <p className="text-sm text-[var(--ink-soft)]" style={{ marginTop: '1.5rem' }}>
        Every number here is reproducible from the committed EIA {BASE_YEAR} snapshot and the pure model engines. Nothing
        is fetched at runtime. <a href="/model/assumptions">Assumptions →</a>
      </p>
    </main>
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

  const rows = [
    { label: `Deaths/yr (${END_YEAR})`, a: ia.annual.deaths, b: ib.annual.deaths, unit: '', digits: 3 },
    { label: `CO₂ Mt/yr (${END_YEAR})`, a: ia.annual.co2Mt, b: ib.annual.co2Mt, unit: ' Mt', digits: 3 },
    { label: `Land km² (${END_YEAR})`, a: ia.annual.landKm2, b: ib.annual.landKm2, unit: ' km²', digits: 3 },
    { label: `Cost USD bn/yr (${END_YEAR})`, a: ia.annual.costUsdBn, b: ib.annual.costUsdBn, unit: ' bn', digits: 3 },
    { label: `Cumulative CO₂ (Gt, ${runA.model.years[0].year}–${END_YEAR})`, a: scaleBand(ia.cumulative.co2Mt, 0.001), b: scaleBand(ib.cumulative.co2Mt, 0.001), unit: ' Gt', digits: 3 },
  ];

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Scenario A</th>
            <th>Scenario B</th>
            <th>A − B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const overlap = r.a.low <= r.b.high && r.b.low <= r.a.high;
            const dCentral = r.a.central - r.b.central;
            const dLow = r.a.low - r.b.high;
            const dHigh = r.a.high - r.b.low;
            const sign = (n: number) => `${n > 0 ? '+' : ''}${fmt(n, r.digits)}`;
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="mono">{fmt(r.a.central, r.digits)}{r.unit}</td>
                <td className="mono">{fmt(r.b.central, r.digits)}{r.unit}</td>
                <td className="mono">
                  {sign(dCentral)}
                  {r.unit}
                  <span style={{ color: 'var(--ink-muted)' }}> ({sign(dLow)} to {sign(dHigh)})</span>
                  {overlap ? <div style={{ color: 'var(--ink-muted)', fontSize: '0.72rem' }}>smaller than the uncertainty band</div> : null}
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
