'use client';

import type { YearState } from '@/lib/model';
import { MIX_GROUPS, type MixGroupKey, toGroups } from '@/lib/model-viz';
import { useState } from 'react';

// Stacked-area generation mix over the model horizon, folded into six intuitive
// groups (colorblind-safe palette). The dashed line is demand; where the stack
// falls below it, the fleet cannot meet demand on energy alone. Hover reads out
// any year. Pure SVG — the static export stays self-contained.

const W = 640;
const H = 280;
const M = { top: 16, right: 16, bottom: 28, left: 48 };
const iw = W - M.left - M.right;
const ih = H - M.top - M.bottom;

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

export default function StackedAreaMix({ years, title }: { years: YearState[]; title?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!years.length) return null;

  const x0 = years[0].year;
  const x1 = years[years.length - 1].year;
  const grouped = years.map((y) => ({ year: y.year, groups: toGroups(y.generationTwhByTech), demand: y.demandTwh }));

  const activeGroups = MIX_GROUPS.filter((g) => grouped.some((y) => y.groups[g.key] > 0.01));
  const peakStack = Math.max(...grouped.map((y) => sum(y.groups)));
  const peakDemand = Math.max(...grouped.map((y) => y.demand));
  const ymax = Math.max(peakStack, peakDemand) * 1.05 || 1;

  const px = (year: number) => M.left + ((year - x0) / Math.max(1, x1 - x0)) * iw;
  const py = (v: number) => M.top + ih - (v / ymax) * ih;

  const baselines = grouped.map(() => 0);
  const bands: { key: MixGroupKey; color: string; d: string }[] = [];
  for (const g of activeGroups) {
    const upper = grouped.map((y, i) => baselines[i] + y.groups[g.key]);
    const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(grouped[i].year).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    const bottom = grouped
      .map((_, i) => grouped.length - 1 - i)
      .map((i) => `L${px(grouped[i].year).toFixed(1)},${py(baselines[i]).toFixed(1)}`)
      .join(' ');
    bands.push({ key: g.key, color: g.cssVar, d: `${top} ${bottom} Z` });
    grouped.forEach((y, i) => {
      baselines[i] += y.groups[g.key];
    });
  }

  const demandPath = grouped.map((y, i) => `${i === 0 ? 'M' : 'L'}${px(y.year).toFixed(1)},${py(y.demand).toFixed(1)}`).join(' ');
  const yTicks = niceTicks(ymax, 4);
  const xTicks = [x0, Math.round((x0 + x1) / 2), x1];
  const h = hover != null ? grouped[hover] : null;

  return (
    <figure style={{ margin: 0 }}>
      {title ? (
        <figcaption className="label" style={{ marginBottom: '0.4rem' }}>
          {title}
        </figcaption>
      ) : null}
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Generation mix in terawatt-hours per year${title ? `, ${title}` : ''}. Demand shown as a dashed line.`}
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={py(t)} y2={py(t)} stroke="var(--chart-gridline)" strokeWidth={1} />
              <text x={M.left - 6} y={py(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
                {fmt(t)}
              </text>
            </g>
          ))}
          {bands.map((b) => (
            <path key={b.key} d={b.d} fill={b.color} fillOpacity={0.92} stroke="var(--surface)" strokeWidth={0.4} />
          ))}
          <path d={demandPath} fill="none" stroke="var(--ink)" strokeWidth={1.6} strokeDasharray="5 3" />
          {h ? <line x1={px(h.year)} x2={px(h.year)} y1={M.top} y2={M.top + ih} stroke="var(--ink)" strokeWidth={1} strokeDasharray="2 2" opacity={0.6} /> : null}
          {xTicks.map((t) => (
            <text key={t} x={px(t)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
              {t}
            </text>
          ))}
          {/* Hover hit targets: one column per year. */}
          {grouped.map((y, i) => {
            const bw = iw / Math.max(1, grouped.length - 1);
            return (
              <rect key={y.year} x={px(y.year) - bw / 2} y={M.top} width={bw} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
            );
          })}
        </svg>
        {h ? (
          <div
            className="panel"
            style={{
              position: 'absolute',
              top: 4,
              left: `${(px(h.year) / W) * 100}%`,
              transform: px(h.year) > W / 2 ? 'translateX(-105%)' : 'translateX(5%)',
              padding: '0.5rem 0.6rem',
              fontSize: '0.72rem',
              pointerEvents: 'none',
              boxShadow: 'var(--shadow-md)',
              minWidth: '8.5rem',
              zIndex: 2,
            }}
          >
            <div className="mono" style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{h.year}</div>
            {activeGroups
              .slice()
              .reverse()
              .map((g) => (
                <div key={g.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: g.cssVar, display: 'inline-block' }} /> {g.short}
                  </span>
                  <span className="mono">{fmt(h.groups[g.key])}</span>
                </div>
              ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', borderTop: '1px solid var(--rule)', marginTop: '0.25rem', paddingTop: '0.2rem' }}>
              <span>Demand</span>
              <span className="mono">{fmt(h.demand)}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem', marginTop: '0.5rem' }}>
        {activeGroups
          .slice()
          .reverse()
          .map((g) => (
            <span key={g.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
              <span style={{ width: 10, height: 10, background: g.cssVar, borderRadius: 2, display: 'inline-block' }} />
              {g.short}
            </span>
          ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
          <span style={{ width: 14, height: 0, borderTop: '1.6px dashed var(--ink)', display: 'inline-block' }} /> Demand
        </span>
      </div>
    </figure>
  );
}

function sum(g: Record<MixGroupKey, number>): number {
  return g.nuclear + g.other + g.hydro + g.fossil + g.wind + g.solar;
}
function niceTicks(max: number, count: number): number[] {
  const step = niceStep(max / count);
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}
function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
