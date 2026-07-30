import type { Warning } from '@/lib/types';

export default function WarningStrip({ warnings }: { warnings: Warning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="grid gap-2" role="status">
      {warnings.map((w) => (
        <p
          key={w.id}
          className="panel p-3 text-sm"
          style={{ background: 'var(--warn-soft)' }}
        >
          <b style={{ color: 'var(--warn)' }}>{w.title}</b>
          {' — '}
          {w.message}
        </p>
      ))}
    </div>
  );
}
