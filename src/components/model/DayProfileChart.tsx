'use client';

import type { DispatchResult } from '@/lib/model-dispatch';
import { useId, useState } from 'react';
import { CHART_TYPE, chartDensity, useChartWidth } from './useChartWidth';

// The single most intuitive picture of reliability: one representative day, hour
// by hour. Supply stacks up from the bottom; the dashed line is demand. Where the
// coloured supply can't reach the line, the gap is hatched — that is unserved
// energy, made visible instead of stated as a number. Typically the gap opens in
// the evening/overnight, when solar has faded but demand has not.
//
// The dispatch series are indexed in UTC; here they are shifted to US-local time
// (Central) and labelled by time of day, so solar peaks at midday as a reader
// expects rather than at a confusing UTC hour.
//
// The viewBox is sized in CSS pixels from the measured container width (see
// useChartWidth) so axis type stays legible on a phone and in the two-column
// comparison view. The hour readout is reachable by pointer, touch and keyboard,
// and the same figures are available as a table for assistive tech.

const M = { top: 16, right: 14, bottom: 34, left: 46 };

// US Central offset from UTC (~UTC−5/−6). The US48 aggregate smears four time
// zones, so this is representative, not exact.
const UTC_TO_CENTRAL = 6;

const LAYERS = [
  { key: 'baseloadMw', label: 'Always-on (nuclear, hydro…)', color: 'var(--mix-nuclear)', mix: 'nuclear' },
  { key: 'thermalMw', label: 'Gas & coal', color: 'var(--mix-fossil)', mix: 'fossil' },
  { key: 'windMw', label: 'Wind', color: 'var(--mix-wind)', mix: 'wind' },
  { key: 'solarMw', label: 'Solar', color: 'var(--mix-solar)', mix: 'solar' },
  { key: 'storageMw', label: 'Battery', color: 'var(--mix-other)', mix: 'other' },
] as const;

const gw = (mw: number) => `${(mw / 1000).toFixed(0)} GW`;
const clockLabel = (localHour: number) => {
  const h12 = localHour % 12 === 0 ? 12 : localHour % 12;
  return `${h12}${localHour < 12 ? 'am' : 'pm'}`;
};

export default function DayProfileChart({ d, accent = 'var(--ink)' }: { d: DispatchResult; accent?: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const { ref, width: W } = useChartWidth();
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const hatchId = `daygap-hatch-${uid}`;
  const hintId = `dayprofile-hint-${uid}`;
  const utc = d.focusDay.hours;

  // Taller relative shape when narrow, so a phone gets a chart rather than a
  // sliver: a fixed 640x260 ratio would be 120px tall at 295px wide.
  const H = Math.round(Math.max(215, Math.min(300, W * 0.44)));
  const iw = Math.max(1, W - M.left - M.right);
  const ih = Math.max(1, H - M.top - M.bottom);
  const density = chartDensity(W);

  if (!utc.length) return null;

  // Reindex to local time: position i (0 = local midnight) shows the UTC hour that
  // falls at local hour i.
  const hours = Array.from({ length: 24 }, (_, i) => utc[(i + UTC_TO_CENTRAL) % 24]);

  const stackTotal = (h: (typeof hours)[number]) => h.baseloadMw + h.thermalMw + h.windMw + h.solarMw + h.storageMw;
  const ymax = Math.max(...hours.map((h) => Math.max(h.demandMw, stackTotal(h)))) * 1.05 || 1;
  const px = (i: number) => M.left + (i / 23) * iw;
  const py = (v: number) => M.top + ih - (v / ymax) * ih;

  const cum = hours.map(() => 0);
  const layerPaths = LAYERS.map((layer) => {
    const top = hours.map((h, i) => cum[i] + (h[layer.key] as number));
    const path = `${hours.map((_, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(top[i]).toFixed(1)}`).join(' ')} ${hours
      .map((_, i) => hours.length - 1 - i)
      .map((i) => `L${px(i).toFixed(1)},${py(cum[i]).toFixed(1)}`)
      .join(' ')} Z`;
    hours.forEach((h, i) => {
      cum[i] += h[layer.key] as number;
    });
    return { ...layer, d: path };
  });

  const gapPath = `${hours.map((h, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(h.demandMw).toFixed(1)}`).join(' ')} ${hours
    .map((_, i) => hours.length - 1 - i)
    .map((i) => `L${px(i).toFixed(1)},${py(cum[i]).toFixed(1)}`)
    .join(' ')} Z`;
  const hasGap = hours.some((h) => h.unservedMw > 100);

  const demandPath = hours.map((h, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(h.demandMw).toFixed(1)}`).join(' ');
  const yTicks = niceTicks(ymax, density.yTickCount);
  const hourTicks = Array.from({ length: Math.ceil(24 / density.hourTickStep) }, (_, i) => i * density.hourTickStep);
  const dayparts: [number, string][] = [
    [3, 'night'],
    [9, 'morning'],
    [15, 'afternoon'],
    [21, 'evening'],
  ];
  const H2 = sel != null ? hours[sel] : null;

  // Arrow keys walk the hours; Home/End jump to the ends; Escape clears.
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      setSel((prev) => {
        const next = (prev == null ? (step > 0 ? 0 : 23) : prev + step) % 24;
        return next < 0 ? next + 24 : next;
      });
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setSel(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSel(23);
    } else if (e.key === 'Escape') {
      setSel(null);
    }
  }

  const summary = `Supply versus demand across a representative ${d.focusDay.season} day in ${d.year}, US local time`;
  const readout = H2
    ? `${clockLabel(sel as number)} local: demand ${gw(H2.demandMw)}. ` +
      LAYERS.map((l) => `${l.label} ${gw(H2[l.key] as number)}`).join(', ') +
      (H2.unservedMw > 100 ? `. Not served ${gw(H2.unservedMw)}` : '')
    : '';

  return (
    <figure style={{ margin: 0 }}>
      <div
        ref={ref}
        style={{ position: 'relative' }}
        tabIndex={0}
        role="group"
        aria-label={summary}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onBlur={() => setSel(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ height: 'auto', display: 'block', touchAction: 'pan-y' }}
          role="img"
          aria-label={summary}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setSel(null);
          }}
        >
          <defs>
            <pattern id={hatchId} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="var(--surface-2)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-soft)" strokeWidth="1.4" />
            </pattern>
          </defs>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={py(t)} y2={py(t)} stroke="var(--chart-gridline)" strokeWidth={1} />
              <text
                x={M.left - 6}
                y={py(t) + 3}
                textAnchor="end"
                fontSize={CHART_TYPE.axis}
                fill="var(--ink-soft)"
                fontFamily="var(--font-mono)"
              >
                {(t / 1000).toFixed(0)}
              </text>
            </g>
          ))}
          <text
            x={M.left - 6}
            y={M.top - 5}
            textAnchor="end"
            fontSize={CHART_TYPE.unit}
            fill="var(--ink-muted)"
            fontFamily="var(--font-mono)"
          >
            GW
          </text>
          {layerPaths.map((l) => (
            <path
              key={l.key}
              className={`mix-band mix-band-${l.mix}`}
              d={l.d}
              fill={l.color}
              fillOpacity={0.92}
              stroke="var(--surface)"
              strokeWidth={0.5}
            />
          ))}
          {hasGap ? <path d={gapPath} fill={`url(#${hatchId})`} stroke="var(--ink-soft)" strokeWidth={0.5} /> : null}
          <path d={demandPath} fill="none" stroke="var(--ink)" strokeWidth={1.8} strokeDasharray="5 3" />
          {H2 ? (
            <line
              x1={px(sel as number)}
              x2={px(sel as number)}
              y1={M.top}
              y2={M.top + ih}
              stroke="var(--ink)"
              strokeWidth={1.5}
              strokeDasharray="2 2"
              opacity={0.7}
            />
          ) : null}
          {hourTicks.map((i) => (
            <text
              key={i}
              x={px(i)}
              y={H - (density.showSecondaryLabels ? 16 : 4)}
              textAnchor="middle"
              fontSize={CHART_TYPE.axis}
              fill="var(--ink-soft)"
              fontFamily="var(--font-mono)"
            >
              {clockLabel(i)}
            </text>
          ))}
          {density.showSecondaryLabels
            ? dayparts.map(([i, label]) => (
                <text key={label} x={px(i)} y={H - 3} textAnchor="middle" fontSize={CHART_TYPE.unit} fill="var(--ink-muted)">
                  {label}
                </text>
              ))
            : null}
          {hours.map((_, i) => {
            const bw = iw / 23;
            return (
              <rect
                key={i}
                x={px(i) - bw / 2}
                y={M.top}
                width={bw}
                height={ih}
                fill="transparent"
                onPointerEnter={() => setSel(i)}
                onPointerDown={() => setSel(i)}
              />
            );
          })}
        </svg>
        {H2 ? (
          <div
            className="panel"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 4,
              left: `${(px(sel as number) / W) * 100}%`,
              transform: (sel as number) > 11 ? 'translateX(-105%)' : 'translateX(5%)',
              padding: '0.5rem 0.6rem',
              fontSize: '0.72rem',
              pointerEvents: 'none',
              boxShadow: 'var(--shadow-md)',
              minWidth: '9rem',
              zIndex: 2,
            }}
          >
            <div className="mono" style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              {clockLabel(sel as number)} local
            </div>
            {LAYERS.slice()
              .reverse()
              .map((l) => (
                <Row key={l.key} color={l.color} label={l.label} v={gw(H2[l.key] as number)} />
              ))}
            {H2.unservedMw > 100 ? <Row color="var(--ink-soft)" label="Not served" v={gw(H2.unservedMw)} hatch /> : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '0.6rem',
                borderTop: '1px solid var(--rule)',
                marginTop: '0.25rem',
                paddingTop: '0.2rem',
              }}
            >
              <span>Demand</span>
              <span className="mono">{gw(H2.demandMw)}</span>
            </div>
          </div>
        ) : null}
      </div>
      <p className="sr-only" id={hintId}>
        Interactive chart. Use the left and right arrow keys to move through the 24 hours, Home and End for the first and
        last hour, and Escape to clear. The same figures are available as a table below.
      </p>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {readout}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem', marginTop: '0.5rem' }}>
        {LAYERS.map((l) => (
          <Legend key={l.key} color={l.color} label={l.label} />
        ))}
        {hasGap ? <Legend color="var(--ink-soft)" label="Not served" hatch /> : null}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
          <span style={{ width: 14, height: 0, borderTop: '1.8px dashed var(--ink)', display: 'inline-block' }} /> Demand
        </span>
      </div>
      {/* The same figures as text: the readout above is a pointer/keyboard
          affordance, this is the durable alternative for assistive tech. */}
      <details style={{ marginTop: '0.5rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--accent)' }}>Hour-by-hour figures as a table</summary>
        <div className="overflow-auto" style={{ marginTop: '0.4rem' }}>
          <table className="w-full border-collapse" style={{ fontSize: '0.72rem' }}>
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr>
                <th scope="col">Local time</th>
                {LAYERS.map((l) => (
                  <th key={l.key} scope="col">
                    {l.label}
                  </th>
                ))}
                <th scope="col">Demand</th>
                {hasGap ? <th scope="col">Not served</th> : null}
              </tr>
            </thead>
            <tbody>
              {hours.map((h, i) => (
                <tr key={i}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {clockLabel(i)}
                  </th>
                  {LAYERS.map((l) => (
                    <td key={l.key} className="mono">
                      {gw(h[l.key] as number)}
                    </td>
                  ))}
                  <td className="mono">{gw(h.demandMw)}</td>
                  {hasGap ? <td className="mono">{gw(h.unservedMw)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function Legend({ color, label, hatch }: { color: string; label: string; hatch?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
      <span
        className="mix-key"
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          display: 'inline-block',
          background: hatch ? 'var(--surface-2)' : color,
          backgroundImage: hatch ? 'repeating-linear-gradient(45deg, var(--ink-soft) 0 1.4px, transparent 1.4px 4px)' : undefined,
          border: hatch ? '1px solid var(--rule-strong)' : undefined,
        }}
      />
      {label}
    </span>
  );
}
function Row({ color, label, v, hatch }: { color: string; label: string; v: string; hatch?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            display: 'inline-block',
            background: hatch ? 'var(--surface-2)' : color,
            backgroundImage: hatch ? 'repeating-linear-gradient(45deg, var(--ink-soft) 0 1.2px, transparent 1.2px 3.5px)' : undefined,
          }}
        />{' '}
        {label}
      </span>
      <span className="mono">{v}</span>
    </div>
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
