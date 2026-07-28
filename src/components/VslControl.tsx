'use client';

import { VSL_MAX, VSL_MIN, VSL_PRESETS, VSL_STEP, formatVsl } from '@/lib/value';

// Shared control for choosing a value of a statistical life. Preset buttons snap
// to HHS's published low/central/high; the slider fills the space between. Kept
// presentational (state lives in the parent) so /value and /build can share it.
export default function VslControl({
  vsl,
  onChange,
  compact = false,
}: {
  vsl: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label" style={{ marginBottom: '0.2rem' }}>
            Value of a statistical life
          </p>
          {!compact ? (
            <p className="text-sm text-[var(--ink-soft)]" style={{ margin: 0 }}>
              What society treats one prevented death as worth. Presets are HHS&apos;s published range.
            </p>
          ) : null}
        </div>
        <span className="mono text-xl" aria-live="polite" style={{ fontWeight: 500 }}>
          {formatVsl(vsl)}
        </span>
      </div>

      <div className="scale-toggle" role="group" aria-label="VSL preset">
        {VSL_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            aria-pressed={vsl === preset.value}
            onClick={() => onChange(preset.value)}
          >
            {preset.label} · {formatVsl(preset.value)}
          </button>
        ))}
      </div>

      <input
        className="mt-3 w-full"
        type="range"
        min={VSL_MIN}
        max={VSL_MAX}
        step={VSL_STEP}
        value={vsl}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Value of a statistical life, US dollars"
        aria-valuetext={formatVsl(vsl)}
      />
    </div>
  );
}
