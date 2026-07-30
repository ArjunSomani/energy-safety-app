'use client';

import { useId, useState } from 'react';

// Inline glossary. A dotted-underlined term reveals a plain-language definition on
// hover, focus or tap — so a first-time reader never hits an undefined word. Also
// exported as GLOSSARY for the standalone glossary panel.

export const GLOSSARY: Record<string, { term: string; plain: string }> = {
  capacity: {
    term: 'capacity',
    plain: 'How much electricity a power plant CAN make at full tilt, measured in gigawatts (GW). Different from how much it actually makes over a year.',
  },
  generation: {
    term: 'generation',
    plain: 'The electricity a plant actually produces over time, measured in terawatt-hours (TWh). One TWh powers roughly 90,000 US homes for a year.',
  },
  'capacity factor': {
    term: 'capacity factor',
    plain: 'The share of the time a plant runs, averaged over a year. Solar is ~20% (only in daylight); nuclear is ~90% (almost always on).',
  },
  'unserved energy': {
    term: 'unserved energy',
    plain: 'Electricity that demand called for but the fleet could not supply in that hour. The model reports it plainly — it is the reliability cost of a scenario.',
  },
  'reserve margin': {
    term: 'reserve margin',
    plain: 'How much dependable, weather-independent capacity the grid has above its highest-demand hour. Positive is a cushion; negative means the firm fleet alone cannot meet the peak.',
  },
  'firm capacity': {
    term: 'firm capacity',
    plain: 'Capacity you can count on regardless of weather — nuclear, hydro, gas, coal, batteries. Wind and solar are not firm, because a calm night can zero them out.',
  },
  elcc: {
    term: 'ELCC',
    plain: 'Effective Load Carrying Capability — how much a wind, solar or battery fleet counts toward keeping the lights on. It falls as you build more of the same thing (the 10th solar farm helps the evening peak far less than the 1st).',
  },
  'learning rate': {
    term: 'learning rate',
    plain: 'How fast a technology gets cheaper as the world builds more of it. A 20% learning rate means every doubling of total installed capacity cuts the price about 20%.',
  },
  'uncertainty band': {
    term: 'uncertainty band',
    plain: 'A low-to-high range instead of a single number, because the underlying science is a range. The band is wider further into the future, where less is knowable.',
  },
  cumulative: {
    term: 'cumulative',
    plain: 'Added up over all years so far, rather than a single year. Cumulative CO₂ is what matters for the climate; a single year is just one slice.',
  },
  curtailment: {
    term: 'curtailment',
    plain: 'Clean electricity that was available but thrown away because there was more than demand needed and nowhere (no battery) to store it.',
  },
  'net-summer capacity': {
    term: 'net-summer capacity',
    plain: "A plant's dependable output on a hot summer afternoon — a bit below its nameplate rating. The standard basis US grid planners use.",
  },
};

export default function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const entry = GLOSSARY[k];
  if (!entry) return <>{children}</>;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="term-btn"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          color: 'inherit',
          cursor: 'help',
          textDecoration: 'underline dotted',
          textDecorationColor: 'var(--accent)',
          textUnderlineOffset: '3px',
        }}
      >
        {children ?? entry.term}
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="panel"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '0.35rem',
            width: 'min(20rem, 78vw)',
            padding: '0.6rem 0.7rem',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            fontFamily: 'var(--font-sans)',
            fontWeight: 400,
            color: 'var(--ink)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 20,
            textDecoration: 'none',
          }}
        >
          <b style={{ textTransform: 'none' }}>{entry.term}</b> — {entry.plain}
        </span>
      ) : null}
    </span>
  );
}
