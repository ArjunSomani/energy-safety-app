'use client';

import type { ScenarioRun } from '@/lib/model-run';
import Term from './Term';

// Turns the current scenario into a plain-language read before any chart: four
// stat tiles (reliability, deaths, CO₂, cost) each compared with "today", plus a
// one-line summary. Neutral wording — it states what happens, never whether it is
// good or bad.

const fmt = (n: number, digits = 2) => new Intl.NumberFormat('en-US', { maximumSignificantDigits: digits }).format(n);

function changeText(now: number, then: number): { text: string; dir: 'down' | 'up' | 'flat' } {
  if (then <= 0) return { text: 'no baseline', dir: 'flat' };
  const r = now / then;
  if (r < 0.92) return { text: `down ${Math.round((1 - r) * 100)}% vs today`, dir: 'down' };
  if (r > 1.08) return { text: `up ${Math.round((r - 1) * 100)}% vs today`, dir: 'up' };
  return { text: 'about the same as today', dir: 'flat' };
}

const arrow = (dir: 'down' | 'up' | 'flat') => (dir === 'down' ? '↓' : dir === 'up' ? '↑' : '→');

export default function HeadlineSummary({ run, endYear }: { run: ScenarioRun; endYear: number }) {
  const first = run.impacts.years[0];
  const lastI = run.impacts.years[run.impacts.years.length - 1];
  const lastD = run.dispatchByYear.find((d) => d.year === endYear) ?? run.dispatchByYear[run.dispatchByYear.length - 1];
  const lastF = run.feedbacks.years[run.feedbacks.years.length - 1];

  const unservedPct = lastD.demandTwh > 0 ? (lastD.unservedTwh / lastD.demandTwh) * 100 : 0;
  const shortHoursPct = lastD.totalHours > 0 ? (lastD.shortfallHours / lastD.totalHours) * 100 : 0;
  const reliabilityValue = unservedPct < 0.3 ? 'meets ~all demand' : `${unservedPct.toFixed(0)}% unmet`;
  const reliabilitySub =
    unservedPct < 0.3 ? 'the fleet keeps up in almost every hour' : `short in ~${shortHoursPct.toFixed(0)}% of hours, mostly evenings`;

  const deaths = changeText(lastI.annual.deaths.central, first.annual.deaths.central);
  const co2 = changeText(lastI.annual.co2Mt.central, first.annual.co2Mt.central);
  const cumCo2Gt = lastI.cumulative.co2Mt.central / 1000;

  const tiles = [
    {
      icon: <BoltIcon />,
      label: <>Keeping the lights on</>,
      value: reliabilityValue,
      sub: reliabilitySub,
      term: 'unserved energy' as const,
    },
    {
      icon: <HeartIcon />,
      label: <>Deaths per year</>,
      value: `~${fmt(lastI.annual.deaths.central)}`,
      sub: `${arrow(deaths.dir)} ${deaths.text}`,
      term: undefined,
    },
    {
      icon: <CloudIcon />,
      label: <>Climate pollution</>,
      value: `~${fmt(lastI.annual.co2Mt.central)} Mt`,
      sub: `${arrow(co2.dir)} ${co2.text}`,
      term: undefined,
    },
    {
      icon: <CoinIcon />,
      label: <>Cost to run the fleet</>,
      value: `~$${fmt(lastI.annual.costUsdBn.central)} bn/yr`,
      sub: `${fmt(lastF.cumulativeCapexUsdBn / 1000, 2)} $tn built ${run.model.years[0].year}–${endYear}`,
      term: undefined,
    },
  ];

  return (
    <section className="panel p-4" aria-label="Plain-language summary of the current scenario">
      <p style={{ margin: '0 0 0.9rem', maxWidth: '52rem' }}>
        In <b>{endYear}</b>, this scenario {unservedPct < 0.3 ? 'keeps up with' : 'falls short of'} demand
        {unservedPct < 0.3 ? '' : ` about ${unservedPct.toFixed(0)}% of the time`}, with air-pollution and accident deaths{' '}
        <b>{deaths.text}</b> and climate pollution <b>{co2.text}</b>. Every figure is a central estimate inside a range —
        the charts below show the full <Term k="uncertainty band">uncertainty</Term>.
      </p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.75rem' }}>
        {tiles.map((t, i) => (
          <div key={i} className="panel p-3" style={{ background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent)' }}>
              {t.icon}
              <span className="label" style={{ margin: 0 }}>
                {t.term ? <Term k={t.term}>{t.label}</Term> : t.label}
              </span>
            </div>
            <div className="mono" style={{ fontSize: '1.35rem', margin: '0.3rem 0 0.1rem', fontWeight: 600 }}>{t.value}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--ink-soft)' }}>{t.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Small line icons in the site's stroke style.
const svg = (children: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const BoltIcon = () => svg(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />);
const HeartIcon = () => svg(<path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z" />);
const CloudIcon = () => svg(<path d="M6 18h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6 18z" />);
const CoinIcon = () => svg(<><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.4-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5" /></>);
