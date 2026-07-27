'use client';

import { STACK_ORDER, TECH_META } from '@/lib/model-run';
import type { ModelTech, YearState } from '@/lib/model';

// Stacked-area generation mix (TWh) over the model horizon, with the demand path
// drawn on top as a dashed line so shortfalls (mix below demand) are legible.
// Pure SVG, no chart library — keeps the static export self-contained.

const W = 640;
const H = 280;
const M = { top: 16, right: 16, bottom: 28, left: 48 };
const iw = W - M.left - M.right;
const ih = H - M.top - M.bottom;

export default function StackedAreaMix({ years, title }: { years: YearState[]; title?: string }) {
  if (!years.length) return null;
  const x0 = years[0].year;
  const x1 = years[years.length - 1].year;
  const techs = STACK_ORDER.filter((t) => years.some((y) => (y.generationTwhByTech[t] ?? 0) > 0.01));

  const peakStack = Math.max(...years.map((y) => techs.reduce((s, t) => s + (y.generationTwhByTech[t] ?? 0), 0)));
  const peakDemand = Math.max(...years.map((y) => y.demandTwh));
  const ymax = Math.max(peakStack, peakDemand) * 1.05 || 1;

  const px = (year: number) => M.left + ((year - x0) / Math.max(1, x1 - x0)) * iw;
  const py = (v: number) => M.top + ih - (v / ymax) * ih;

  // Build a filled band per tech from the running cumulative baseline.
  const baselines = years.map(() => 0);
  const bands: { tech: ModelTech; d: string }[] = [];
  for (const tech of techs) {
    const lower = years.map((y, i) => baselines[i]);
    const upper = years.map((y, i) => baselines[i] + (y.generationTwhByTech[tech] ?? 0));
    const top = upper.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(years[i].year).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    const bottom = lower
      .map((v, i) => `L${px(years[years.length - 1 - i].year).toFixed(1)},${py(lower[lower.length - 1 - i]).toFixed(1)}`)
      .join(' ');
    bands.push({ tech, d: `${top} ${bottom} Z` });
    years.forEach((y, i) => {
      baselines[i] += y.generationTwhByTech[tech] ?? 0;
    });
  }

  const demandPath = years
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${px(y.year).toFixed(1)},${py(y.demandTwh).toFixed(1)}`)
    .join(' ');

  const yTicks = niceTicks(ymax, 4);
  const xTicks = [x0, Math.round((x0 + x1) / 2), x1];

  return (
    <figure style={{ margin: 0 }}>
      {title ? (
        <figcaption className="label" style={{ marginBottom: '0.4rem' }}>
          {title}
        </figcaption>
      ) : null}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label={`Generation mix in terawatt-hours per year${title ? `, ${title}` : ''}`}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={py(t)} y2={py(t)} stroke="var(--chart-gridline)" strokeWidth={1} />
            <text x={M.left - 6} y={py(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
              {t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}
            </text>
          </g>
        ))}
        {bands.map((b) => (
          <path key={b.tech} d={b.d} fill={TECH_META[b.tech].color} fillOpacity={0.9} stroke="var(--surface)" strokeWidth={0.3} />
        ))}
        <path d={demandPath} fill="none" stroke="var(--ink)" strokeWidth={1.6} strokeDasharray="5 3" />
        {xTicks.map((t) => (
          <text key={t} x={px(t)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
            {t}
          </text>
        ))}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem', marginTop: '0.5rem' }}>
        {techs
          .slice()
          .reverse()
          .map((t) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
              <span style={{ width: 10, height: 10, background: TECH_META[t].color, borderRadius: 2, display: 'inline-block' }} />
              {TECH_META[t].label}
            </span>
          ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
          <span style={{ width: 14, height: 0, borderTop: '1.6px dashed var(--ink)', display: 'inline-block' }} /> Demand
        </span>
      </div>
    </figure>
  );
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
