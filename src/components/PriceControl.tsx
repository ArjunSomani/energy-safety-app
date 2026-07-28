'use client';

// Generic slider + preset control for pricing an externality (VSL, social cost
// of carbon, …). Presentational — state lives in the parent — so one component
// serves both externalities in the true-cost panel.
export default function PriceControl({
  label,
  value,
  onChange,
  presets,
  min,
  max,
  step,
  format,
  ariaLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  presets: { key: string; label: string; value: number }[];
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  ariaLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="label" style={{ margin: 0 }}>
          {label}
        </p>
        <span className="mono" aria-live="polite" style={{ fontWeight: 500 }}>
          {format(value)}
        </span>
      </div>
      <div className="scale-toggle" role="group" aria-label={`${label} preset`} style={{ flexWrap: 'wrap' }}>
        {presets.map((preset) => (
          <button key={preset.key} type="button" aria-pressed={value === preset.value} onClick={() => onChange(preset.value)}>
            {preset.label}
          </button>
        ))}
      </div>
      <input
        className="mt-2 w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={ariaLabel}
        aria-valuetext={format(value)}
      />
    </div>
  );
}
