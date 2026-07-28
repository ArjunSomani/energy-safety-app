'use client';

import citations from '@/data/citations.json';
import sourcesData from '@/data/sources.json';
import { fmt } from '@/lib/format';
import { VSL_CENTRAL, formatUsdPerMwh, mortalityCostPerMwh } from '@/lib/value';
import { useMemo, useState } from 'react';

type Src = (typeof sourcesData)[number];
type Cite = keyof typeof citations;

// A sortable read of every coefficient the site uses, with its citation, plus a
// CSV download — the same numbers the charts and builder run on, in one table
// you can order however you like. Replaces the old raw-JSON dump.

const band = (b: { low: number | null; central: number | null; high: number | null }) =>
  b.central == null ? '—' : `${fmt(b.central)}`;
const sub = (b: { low: number | null; high: number | null }) =>
  b.low == null || b.high == null ? '' : `${fmt(b.low)}–${fmt(b.high)}`;

type Col = {
  key: string;
  label: string;
  numeric: boolean;
  sortVal: (s: Src) => number | string | null;
  render: (s: Src) => React.ReactNode;
};

const cols: Col[] = [
  { key: 'label', label: 'Source', numeric: false, sortVal: (s) => s.label, render: (s) => <b>{s.label}</b> },
  {
    key: 'deaths',
    label: 'Deaths / TWh',
    numeric: true,
    sortVal: (s) => s.deathRate.central,
    render: (s) => cell(band(s.deathRate), sub(s.deathRate)),
  },
  {
    key: 'modeled',
    label: 'Modeled %',
    numeric: true,
    sortVal: (s) => s.deathRate.modeledShare ?? 0,
    render: (s) => `${Math.round((s.deathRate.modeledShare ?? 0) * 100)}%`,
  },
  {
    key: 'co2',
    label: 'CO₂ g/kWh',
    numeric: true,
    sortVal: (s) => s.lifecycleCO2.central,
    render: (s) => cell(band(s.lifecycleCO2), sub(s.lifecycleCO2)),
  },
  {
    key: 'land',
    label: 'Land km²/TWh',
    numeric: true,
    sortVal: (s) => s.landUse.central,
    render: (s) => cell(band(s.landUse), sub(s.landUse)),
  },
  {
    key: 'cost',
    label: 'Cost $/MWh',
    numeric: true,
    sortVal: (s) => s.lcoe.central,
    render: (s) => cell(s.lcoe.central == null ? '—' : formatUsdPerMwh(s.lcoe.central), sub(s.lcoe)),
  },
  {
    key: 'mortality',
    label: 'Mortality $/MWh',
    numeric: true,
    sortVal: (s) => mortalityCostPerMwh(s.deathRate.central, VSL_CENTRAL),
    render: (s) => formatUsdPerMwh(mortalityCostPerMwh(s.deathRate.central, VSL_CENTRAL)),
  },
  {
    key: 'source',
    label: 'Death-rate source',
    numeric: false,
    sortVal: (s) => s.deathRate.source,
    render: (s) => {
      const c = citations[s.deathRate.source as Cite];
      return (
        <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>
          {c.label.split(',')[0]}
        </a>
      );
    },
  },
];

function cell(main: string, small: string) {
  return (
    <>
      {main}
      {small ? <div className="text-xs text-[var(--ink-muted)]">{small}</div> : null}
    </>
  );
}

function toCsv(): string {
  const header = [
    'slug',
    'label',
    'deaths_low',
    'deaths_central',
    'deaths_high',
    'modeled_share',
    'co2_low',
    'co2_central',
    'co2_high',
    'land_low',
    'land_central',
    'land_high',
    'lcoe_low',
    'lcoe_central',
    'lcoe_high',
    'mortality_usd_per_mwh_central_vsl',
    'death_rate_source',
  ];
  const v = (n: number | null | undefined) => (n == null ? '' : String(n));
  const lines = sourcesData.map((s) =>
    [
      s.slug,
      s.label,
      v(s.deathRate.low),
      v(s.deathRate.central),
      v(s.deathRate.high),
      v(s.deathRate.modeledShare),
      v(s.lifecycleCO2.low),
      v(s.lifecycleCO2.central),
      v(s.lifecycleCO2.high),
      v(s.landUse.low),
      v(s.landUse.central),
      v(s.landUse.high),
      v(s.lcoe.low),
      v(s.lcoe.central),
      v(s.lcoe.high),
      v(Number(mortalityCostPerMwh(s.deathRate.central, VSL_CENTRAL).toFixed(3))),
      s.deathRate.source,
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export default function DataExplorer() {
  const [sortKey, setSortKey] = useState('deaths');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const rows = useMemo(() => {
    const col = cols.find((c) => c.key === sortKey)!;
    const sorted = [...sourcesData].sort((a, b) => {
      const va = col.sortVal(a);
      const vb = col.sortVal(b);
      // Nulls (e.g. oil's cost) always sort to the bottom, regardless of direction.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb));
      return va - vb;
    });
    return dir === 'desc' ? sorted.reverse() : sorted;
  }, [sortKey, dir]);

  function sortBy(key: string) {
    if (key === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDir(key === 'label' || key === 'source' ? 'asc' : 'desc');
    }
  }

  function downloadCsv() {
    const blob = new Blob([toCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'level-source-coefficients.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="my-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className="label" style={{ margin: 0 }}>
          {sourcesData.length} sources · click a column to sort
        </p>
        <button type="button" className="btn btn-ghost" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={downloadCsv}>
          ↓ Download CSV
        </button>
      </div>
      <div className="overflow-auto panel">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  onClick={() => sortBy(c.key)}
                  aria-sort={sortKey === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                  title="Sort by this column"
                >
                  {c.label}
                  <span style={{ color: 'var(--accent)' }}>{sortKey === c.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.slug}>
                {cols.map((c) => (
                  <td key={c.key} className={c.numeric ? 'mono' : undefined} style={{ whiteSpace: 'nowrap' }}>
                    {c.render(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        Central estimate shown large, the low–high band beneath. Mortality cost values each source&apos;s deaths at the
        central value of a statistical life. Land mixes two methodologies; see <a href="/methodology">Methodology</a>.
      </p>
    </section>
  );
}
