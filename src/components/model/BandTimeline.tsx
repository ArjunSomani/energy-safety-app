'use client';

import type { Band } from '@/lib/types';
import { useState } from 'react';

// A metric's low/central/high over the horizon, drawn as a shaded uncertainty
// band with a central line. The band widens with the horizon (see model-impacts),
// so a 2050 estimate visibly carries more uncertainty than the near term. An
// optional second scenario is overlaid as a comparison central line + faint band.
// Reuses the site's log/linear scale toggle idiom.

export type BandPoint = { year: number; band: Band };

const W = 640;
const H = 240;
const M = { top: 14, right: 16, bottom: 26, left: 56 };
const iw = W - M.left - M.right;
const ih = H - M.top - M.bottom;

export default function BandTimeline({
  a,
  b,
  unit,
  title,
  colorA = 'var(--ink)',
  allowLog = true,
}: {
  a: BandPoint[];
  b?: BandPoint[];
  unit: string;
  title: string;
  colorA?: string;
  allowLog?: boolean;
}) {
  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  if (!a.length) return null;

  const x0 = a[0].year;
  const x1 = a[a.length - 1].year;
  const all = [...a, ...(b ?? [])];
  const rawMax = Math.max(...all.map((p) => p.band.high), 1e-9);
  const rawMin = Math.min(...all.map((p) => p.band.low), rawMax);
  const useLog = scale === 'log' && allowLog && rawMax > 0;
  const lo = useLog ? Math.max(rawMin, rawMax / 1e4) : 0;
  const hi = rawMax * 1.05;

  const px = (year: number) => M.left + ((year - x0) / Math.max(1, x1 - x0)) * iw;
  const py = (v: number) => {
    if (useLog) {
      const l = Math.log10(Math.max(v, lo));
      const lmin = Math.log10(lo);
      const lmax = Math.log10(hi);
      return M.top + ih - ((l - lmin) / (lmax - lmin)) * ih;
    }
    return M.top + ih - ((v - 0) / (hi - 0)) * ih;
  };

  const bandArea = (pts: BandPoint[]) => {
    const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.year).toFixed(1)},${py(p.band.high).toFixed(1)}`).join(' ');
    const bottom = pts
      .slice()
      .reverse()
      .map((p) => `L${px(p.year).toFixed(1)},${py(p.band.low).toFixed(1)}`)
      .join(' ');
    return `${top} ${bottom} Z`;
  };
  const centralLine = (pts: BandPoint[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.year).toFixed(1)},${py(p.band.central).toFixed(1)}`).join(' ');

  const yTicks = useLog ? logTicks(lo, hi) : linTicks(hi, 4);
  const xTicks = [x0, Math.round((x0 + x1) / 2), x1];
  const fmtY = (t: number) => (t >= 1000 ? `${(t / 1000).toFixed(t >= 10000 ? 0 : 1)}k` : t < 1 ? t.toPrecision(1) : `${Math.round(t)}`);

  return (
    <figure style={{ margin: 0 }}>
      <div className="flex items-end justify-between" style={{ gap: '0.5rem', marginBottom: '0.35rem' }}>
        <figcaption className="label" style={{ margin: 0 }}>
          {title} <span style={{ textTransform: 'none', color: 'var(--ink-muted)' }}>({unit})</span>
        </figcaption>
        {allowLog ? (
          <div className="scale-toggle" role="group" aria-label={`${title} scale`}>
            <button type="button" aria-pressed={scale === 'linear'} onClick={() => setScale('linear')}>
              Linear
            </button>
            <button type="button" aria-pressed={scale === 'log'} onClick={() => setScale('log')}>
              Log
            </button>
          </div>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label={`${title} over time, low to high band, in ${unit}`}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={py(t)} y2={py(t)} stroke="var(--chart-gridline)" strokeWidth={1} />
            <text x={M.left - 6} y={py(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
              {fmtY(t)}
            </text>
          </g>
        ))}
        {b ? <path d={bandArea(b)} fill="var(--ink-soft)" fillOpacity={0.1} /> : null}
        <path d={bandArea(a)} fill={colorA} fillOpacity={0.16} />
        {b ? <path d={centralLine(b)} fill="none" stroke="var(--ink-soft)" strokeWidth={1.4} strokeDasharray="4 3" /> : null}
        <path d={centralLine(a)} fill="none" stroke={colorA} strokeWidth={1.8} />
        {xTicks.map((t) => (
          <text key={t} x={px(t)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
            {t}
          </text>
        ))}
      </svg>
    </figure>
  );
}

function linTicks(max: number, count: number): number[] {
  const step = niceStep(max / count);
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}
function logTicks(lo: number, hi: number): number[] {
  const ticks: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    const v = 10 ** e;
    if (v >= lo * 0.999 && v <= hi) ticks.push(v);
  }
  return ticks.length ? ticks : [lo, hi];
}
function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
