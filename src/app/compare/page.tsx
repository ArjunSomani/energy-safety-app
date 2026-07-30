'use client';

import Link from 'next/link';
import CopyLinkButton from '@/components/CopyLinkButton';
import sourcesData from '@/data/sources.json';
import { SCC_CENTRAL, carbonCostPerMwhBand, formatScc } from '@/lib/carbon';
import { fmt } from '@/lib/format';
import type { Band } from '@/lib/types';
import { VSL_CENTRAL, formatUsdPerMwh, formatVsl, mortalityCostPerMwh, mortalityCostPerMwhBand } from '@/lib/value';
import { useEffect, useMemo, useState } from 'react';

// Head-to-head: pick 2–4 sources and see every measure side by side, each on its
// own scale (you can't put deaths and dollars on one axis). Each source keeps one
// identity colour across all the cards. Shareable via ?s=coal,nuclear.

type Src = (typeof sourcesData)[number];
// Off-accent by design: charts never borrow the UI accent (see globals.css).
const PALETTE = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
const MAX = 4;
const MIN = 2;

const nn = (b: { low: number | null; central: number | null; high: number | null }): Band | null =>
  b.low == null || b.central == null || b.high == null ? null : { low: b.low, central: b.central, high: b.high };

type Measure = {
  key: string;
  label: string;
  unit: string;
  band: (s: Src) => Band | null;
  fmtVal: (v: number) => string;
};

const MEASURES: Measure[] = [
  { key: 'deaths', label: 'Deaths', unit: 'per TWh', band: (s) => nn(s.deathRate), fmtVal: fmt },
  { key: 'co2', label: 'CO₂', unit: 'g/kWh, lifecycle', band: (s) => nn(s.lifecycleCO2), fmtVal: fmt },
  { key: 'land', label: 'Land', unit: 'km²/TWh/yr', band: (s) => nn(s.landUse), fmtVal: fmt },
  { key: 'cost', label: 'Cost', unit: '$/MWh, Lazard', band: (s) => nn(s.lcoe), fmtVal: formatUsdPerMwh },
  {
    key: 'carbon',
    label: 'Carbon cost',
    unit: `$/MWh at ${formatScc(SCC_CENTRAL)}/t`,
    band: (s) => carbonCostPerMwhBand(nn(s.lifecycleCO2)!, SCC_CENTRAL),
    fmtVal: formatUsdPerMwh,
  },
  {
    key: 'mortality',
    label: 'Mortality cost',
    unit: `$/MWh at ${formatVsl(VSL_CENTRAL)}`,
    band: (s) => mortalityCostPerMwhBand(s.deathRate, VSL_CENTRAL),
    fmtVal: formatUsdPerMwh,
  },
];

const bySlug = Object.fromEntries(sourcesData.map((s) => [s.slug, s])) as Record<string, Src>;

export default function Page() {
  const [selected, setSelected] = useState<string[]>(['coal', 'gas', 'nuclear', 'solar']);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('s');
    if (s) {
      const picked = s.split(',').filter((slug) => bySlug[slug]).slice(0, MAX);
      if (picked.length >= MIN) setSelected(picked);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('s', selected.join(','));
    window.history.replaceState(null, '', `/compare?${params.toString()}`);
  }, [selected]);

  const chosen = useMemo(() => selected.map((slug) => bySlug[slug]).filter(Boolean), [selected]);
  const colorOf = (slug: string) => PALETTE[selected.indexOf(slug) % PALETTE.length];

  function toggle(slug: string) {
    setSelected((cur) => {
      if (cur.includes(slug)) return cur.length > MIN ? cur.filter((x) => x !== slug) : cur;
      return cur.length < MAX ? [...cur, slug] : cur;
    });
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl" style={{ marginBottom: 0 }}>Compare</h1>
        <CopyLinkButton label="Copy this comparison" />
      </div>
      <p className="my-4" style={{ maxWidth: '42rem' }}>
        Put two to four sources head to head across every measure at once. Each measure has its own scale — you can&apos;t
        weigh deaths and dollars on one axis — and each source keeps one colour throughout. The winner changes with the
        measure.
      </p>

      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Choose sources to compare">
        {sourcesData.map((s) => {
          const on = selected.includes(s.slug);
          const atMax = selected.length >= MAX && !on;
          const atMin = selected.length <= MIN && on;
          return (
            <button
              key={s.slug}
              type="button"
              aria-pressed={on}
              disabled={atMax || atMin}
              onClick={() => toggle(s.slug)}
              className="panel px-3"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderColor: on ? colorOf(s.slug) : 'var(--rule)',
                background: on ? 'var(--surface-2)' : 'var(--surface)',
                opacity: atMax ? 0.5 : 1,
                cursor: atMax || atMin ? 'default' : 'pointer',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: on ? colorOf(s.slug) : 'var(--rule-strong)', display: 'inline-block' }} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MEASURES.map((m) => {
          const vals = chosen.map((s) => m.band(s)?.central ?? null);
          const max = Math.max(...vals.filter((v): v is number => v != null), 0);
          return (
            <div className="panel p-4" key={m.key}>
              <div className="flex items-end justify-between" style={{ marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{m.label}</h2>
                <span className="label" style={{ margin: 0 }}>
                  {m.unit}
                </span>
              </div>
              <div className="grid" style={{ gap: '0.6rem' }}>
                {chosen.map((s) => {
                  const b = m.band(s);
                  const width = b && max > 0 ? Math.max(2, (b.central / max) * 100) : 0;
                  return (
                    <div key={s.slug} style={{ display: 'grid', gridTemplateColumns: '5rem 1fr auto', alignItems: 'center', gap: '0.6rem' }}>
                      <span className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: colorOf(s.slug), display: 'inline-block', flexShrink: 0 }} />
                        {s.label}
                      </span>
                      {b ? (
                        <>
                          <div className="h-4 rounded-sm" style={{ background: 'var(--surface-2)', overflow: 'hidden' }}>
                            <div className="h-4" style={{ width: `${width}%`, background: colorOf(s.slug) }} />
                          </div>
                          <span className="mono text-sm" style={{ whiteSpace: 'nowrap' }} title={`band ${m.fmtVal(b.low)}–${m.fmtVal(b.high)}`}>
                            {m.fmtVal(b.central)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-[var(--ink-muted)]">no comparable data</span>
                          <span />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{ marginTop: '2rem' }}>What drives each</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {chosen.map((s) => {
          const dr = s.deathRate as typeof s.deathRate & { whatDominates?: string };
          return (
            <div className="panel p-4" key={s.slug}>
              <h3 style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: colorOf(s.slug), display: 'inline-block' }} />
                {s.label}
              </h3>
              <p className="text-sm text-[var(--ink-soft)]" style={{ margin: 0 }}>
                {dr.whatDominates ?? s.description}
              </p>
              <p className="text-sm" style={{ margin: '0.5rem 0 0' }}>
                <a href={`/sources/${s.slug}`}>Full source page →</a>
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-[var(--ink-soft)]">
        Bars are each measure&apos;s central estimate, scaled within that card; hover a value for its low–high band.
        Carbon and mortality costs value CO₂ and deaths at the central published figures — see{' '}
        <Link href="/value">Value of a life</Link> and <Link href="/methodology">Methodology</Link>.
      </p>
    </main>
  );
}
