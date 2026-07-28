import { fmt } from '@/lib/format';
import type { Band } from '@/lib/types';

// A single bar split into counted (solid) vs modeled (hatched) deaths — the same
// encoding the risk rule uses, applied to a whole mix. The engine already keeps
// these two totals apart; this simply shows them. Uses central estimates for the
// proportion, with both counts labelled.
export default function DeathsSplitBar({ counted, modeled }: { counted: Band; modeled: Band }) {
  const c = Math.max(0, counted.central);
  const m = Math.max(0, modeled.central);
  const total = c + m;
  if (!(total > 0)) return null;
  const countedPct = (c / total) * 100;

  return (
    <div>
      <div
        className="h-3 rounded-sm border"
        role="img"
        aria-label={`${fmt(c)} counted deaths and ${fmt(m)} modeled deaths per year`}
        style={{
          borderColor: 'var(--bar-border)',
          background: `linear-gradient(90deg, var(--accent) 0 ${countedPct}%, transparent ${countedPct}%), var(--hatch)`,
        }}
      />
      <p className="mt-3 text-sm text-[var(--ink-soft)]" style={{ margin: '0.4rem 0 0' }}>
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: 'var(--accent)' }} />{' '}
        counted, about <span className="mono">{fmt(c)}</span>/yr ·{' '}
        <span className="inline-block h-3 w-6 rounded-sm border border-black align-middle" style={{ background: 'var(--hatch)' }} />{' '}
        modeled, about <span className="mono">{fmt(m)}</span>/yr
      </p>
    </div>
  );
}
