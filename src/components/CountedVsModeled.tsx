// The hardest idea on the site, drawn once. Left: a few identifiable deaths you
// could list by name. Right: a small raised risk spread across a whole downwind
// population — real deaths in the aggregate, but no single one is identifiable.
// After seeing this, the hatch pattern on every chart is self-explanatory.

export default function CountedVsModeled({ compact = false }: { compact?: boolean }) {
  const pop: { x: number; y: number }[] = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) pop.push({ x: 14 + c * 14, y: 16 + r * 13 });

  return (
    <div className={compact ? '' : 'panel p-4'}>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Counted */}
        <figure style={{ margin: 0 }}>
          <svg viewBox="0 0 180 96" width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label="A few identifiable, counted deaths">
            {[30, 62, 94, 126, 84].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy={i === 4 ? 60 : 40} r={7} fill="#1f52ad" />
              </g>
            ))}
          </svg>
          <figcaption style={{ marginTop: '0.4rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="swatch" style={{ background: '#1f52ad' }} /> <b>Counted</b>
            </span>
            <p className="text-sm text-[var(--ink-soft)]" style={{ margin: '0.25rem 0 0' }}>
              A fall, a mine collapse, a dam failure. Identifiable people — you could list them.
            </p>
          </figcaption>
        </figure>

        {/* Modeled */}
        <figure style={{ margin: 0 }}>
          <svg viewBox="0 0 180 96" width="100%" style={{ height: 'auto', display: 'block' }} role="img" aria-label="A raised risk spread across a whole population">
            <defs>
              <pattern id="cvm-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill="transparent" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-soft)" strokeWidth="1.3" />
              </pattern>
            </defs>
            {pop.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--ink-soft)" opacity={0.4} />
            ))}
            <rect x={4} y={6} width={172} height={84} fill="url(#cvm-hatch)" opacity={0.9} />
          </svg>
          <figcaption style={{ marginTop: '0.4rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="swatch" style={{ background: 'var(--surface)', backgroundImage: 'repeating-linear-gradient(45deg, var(--ink-soft) 0 1.3px, transparent 1.3px 5px)' }} /> <b>Modeled</b>
            </span>
            <p className="text-sm text-[var(--ink-soft)]" style={{ margin: '0.25rem 0 0' }}>
              A slightly raised risk across everyone downwind. Real deaths in the aggregate — but no single one is
              identifiable as coal’s.
            </p>
          </figcaption>
        </figure>
      </div>
      {!compact ? (
        <p className="text-sm text-[var(--ink-soft)]" style={{ margin: '0.9rem 0 0' }}>
          That’s why the charts draw them differently — solid for counted, hatched for modeled — and never blur the two.
          For coal and gas almost the whole bar is hatched; for nuclear, most of the number is modeled cancer
          projections rather than the counted casualties of Chernobyl and Fukushima.
        </p>
      ) : null}
    </div>
  );
}
