'use client';

import type { DispatchResult, SeasonKey } from '@/lib/model-dispatch';
import Term from './Term';
import type { ReactNode } from 'react';

// The dispatch/reliability read for a single year. Unserved energy is the
// model's most important output and is shown as a neutral reported quantity —
// no red, no alarm iconography, no "failure" framing (neutrality #5). It sits
// with equal weight beside the impact numbers a scenario does well on.

const SEASON_LABEL: Record<SeasonKey, string> = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' };

function fmt(n: number, digits = 3) {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: digits }).format(n);
}

export default function ReliabilityPanel({ d, accent = 'var(--ink)' }: { d: DispatchResult; accent?: string }) {
  const seasons: SeasonKey[] = ['winter', 'spring', 'summer', 'autumn'];
  const maxSeason = Math.max(...seasons.map((s) => d.unservedBySeason[s]), 1);
  const maxHour = Math.max(...d.unservedByHourOfDay, 1);
  const unservedPct = d.demandTwh > 0 ? (d.unservedTwh / d.demandTwh) * 100 : 0;

  return (
    <div className="panel p-4">
      <div className="flex items-end justify-between" style={{ gap: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Reliability in {d.year}</h3>
        <span className="label" style={{ margin: 0 }}>
          hourly dispatch
        </span>
      </div>

      <div className="stat-grid" style={{ marginTop: '0.9rem', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '0.9rem', textAlign: 'left' }}>
        <Metric label={<Term k="unserved energy">Unserved energy</Term>} value={`${fmt(d.unservedTwh)} TWh`} sub={`${unservedPct.toFixed(1)}% of demand went unmet`} accent={accent} />
        <Metric label="Hours short" value={`${fmt(d.shortfallHours)} h`} sub={`of ${fmt(d.totalHours)} h in the year`} />
        <Metric label={<Term k="curtailment">Clean energy wasted</Term>} value={`${fmt(d.curtailedTwh)} TWh`} sub="available but nowhere to put it" />
        <Metric
          label={<Term k="reserve margin">Cushion at peak</Term>}
          value={d.reserveMarginPct == null ? '—' : `${d.reserveMarginPct > 0 ? '+' : ''}${d.reserveMarginPct.toFixed(0)}%`}
          sub={`${fmt(d.firmCapacityMw / 1000, 3)} GW dependable · ${fmt(d.peakDemandMw / 1000, 3)} GW peak`}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginTop: '1.2rem' }}>
        <div>
          <p className="label" style={{ marginBottom: '0.5rem' }}>
            When shortfalls fall — by season
          </p>
          {seasons.map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ width: '3.4rem', fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{SEASON_LABEL[s]}</span>
              <span style={{ flex: 1, height: 10, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(d.unservedBySeason[s] / maxSeason) * 100}%`, background: accent, opacity: 0.75 }} />
              </span>
              <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-soft)', width: '4.5rem', textAlign: 'right' }}>
                {fmt(d.unservedBySeason[s] / 1e6, 2)} TWh
              </span>
            </div>
          ))}
        </div>
        <div>
          <p className="label" style={{ marginBottom: '0.5rem' }}>
            When shortfalls fall — by hour (UTC)
          </p>
          <svg viewBox="0 0 240 90" width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label="Unserved energy by hour of day">
            {d.unservedByHourOfDay.map((v, h) => {
              const bw = 240 / 24;
              const bh = (v / maxHour) * 74;
              return <rect key={h} x={h * bw + 1} y={80 - bh} width={bw - 1.5} height={Math.max(0, bh)} fill={accent} opacity={0.7} />;
            })}
            <line x1={0} x2={240} y1={80} y2={80} stroke="var(--chart-baseline)" strokeWidth={1} />
            <text x={0} y={90} fontSize={8} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
              0h
            </text>
            <text x={240} y={90} textAnchor="end" fontSize={8} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
              23h
            </text>
          </svg>
        </div>
      </div>

      <p className="text-sm text-[var(--ink-soft)]" style={{ marginTop: '0.9rem', marginBottom: 0 }}>
        Unserved energy is the gap between demand and what this fleet can dispatch, hour by hour. It is reported, not judged:
        a scenario with little unserved energy may carry high deaths or CO₂, and vice-versa. Dispatch uses representative
        seasonal days, so it captures timing, not the single worst hour of a real year.
      </p>
    </div>
  );
}

function Metric({ label, value, sub, accent }: { label: ReactNode; value: string; sub: string; accent?: string }) {
  return (
    <div>
      <p className="label" style={{ margin: 0 }}>
        {label}
      </p>
      <p className="mono" style={{ margin: '0.15rem 0 0', fontSize: '1.2rem', color: accent ?? 'var(--ink)' }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>{sub}</p>
    </div>
  );
}
