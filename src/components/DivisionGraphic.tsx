// The site's central idea, drawn: total deaths ÷ electricity = a fair rate. Coal
// above solar. The payoff is the pair of ratios underneath — normalizing shrinks
// the gap from ~6,000x to ~1,000x, but coal is still far worse. The number
// changes; the conclusion survives.

const rows = [
  { label: 'Coal', deaths: '~250,000', deathsW: 100, power: '~10,000 TWh', powerW: 100, rate: '25', rateW: 100, color: 'var(--mix-fossil)' },
  { label: 'Solar', deaths: '~40', deathsW: 1.5, power: '~2,000 TWh', powerW: 20, rate: '0.02', rateW: 0.6, color: 'var(--mix-solar)' },
] as const;

function Bar({ w, color, value, unit }: { w: number; color: string; value: string; unit?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span style={{ flex: 1, height: 12, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.max(w, 1.2)}%`, background: color, borderRadius: 3 }} />
      </span>
      <span className="mono" style={{ fontSize: '0.72rem', width: unit ? '5.6rem' : '3rem', textAlign: 'right', color: 'var(--ink-soft)' }}>
        {value}
        {unit ? <span style={{ color: 'var(--ink-muted)' }}> {unit}</span> : null}
      </span>
    </div>
  );
}

export default function DivisionGraphic() {
  return (
    <div className="panel p-4">
      {/* The fixed columns total 10.7rem; add the gaps and a 375px phone leaves
          ~38px for each 1fr, which the "= Deaths / TWh" heading and the "25 /TWh"
          figures cannot shrink into — they pushed the page 22px wider than the
          viewport. minmax(0, 1fr) lets the flexible columns actually shrink, and
          the whole grid scrolls inside the panel rather than the page if the
          minimums still do not fit. */}
      <div className="overflow-auto">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '3.2rem minmax(0, 1fr) 1.1rem minmax(0, 1fr) 0.9rem minmax(4.2rem, 5.5rem)',
          gap: '0.5rem 0.6rem',
          alignItems: 'center',
          minWidth: 'min(100%, 17rem)',
        }}
      >
        <span />
        <span className="label" style={{ margin: 0 }}>Deaths / year</span>
        <span />
        <span className="label" style={{ margin: 0 }}>Electricity</span>
        <span />
        <span className="label" style={{ margin: 0 }}>= Deaths / TWh</span>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'contents' }}>
            <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{r.label}</span>
            <Bar w={r.deathsW} color={r.color} value={r.deaths} />
            <span className="mono" style={{ textAlign: 'center', color: 'var(--ink-muted)' }}>÷</span>
            <Bar w={r.powerW} color={r.color} value={r.power} />
            <span className="mono" style={{ textAlign: 'center', color: 'var(--ink-muted)' }}>=</span>
            <span className="mono" style={{ fontSize: '1rem', fontWeight: 600 }}>{r.rate}<span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}> /TWh</span></span>
          </div>
        ))}
      </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2" style={{ marginTop: '1rem' }}>
        <div className="panel p-3" style={{ background: 'var(--surface-2)' }}>
          <p className="label" style={{ margin: 0 }}>On raw totals</p>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Coal looks about <b>6,000× worse</b> — but coal also makes far more electricity, so most of that gap is just size.</p>
        </div>
        <div className="panel p-3" style={{ background: 'var(--accent-soft)' }}>
          <p className="label" style={{ margin: 0, color: 'var(--accent)' }}>Per unit of electricity</p>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Coal is about <b>1,000× worse</b>. The gap shrinks — but the verdict holds. Normalizing changes the number, not the conclusion.</p>
        </div>
      </div>
    </div>
  );
}
