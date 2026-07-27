'use client';

import type { ModelTech } from '@/lib/model';
import { BUILDABLE_TECHS, PRESETS, type RetirementPolicy, TECH_META, type UiScenario } from '@/lib/model-run';
import type { ControlsTier } from '@/lib/types';

// One scenario's controls. Every knob here is a disclosed assumption; none is
// labelled recommended or realistic (neutrality #1). Reused for both A and B.

export default function ScenarioControls({
  scenario,
  onChange,
  accent,
}: {
  scenario: UiScenario;
  onChange: (next: UiScenario) => void;
  accent: string;
}) {
  const setBuild = (tech: ModelTech, gw: number) =>
    onChange({ ...scenario, label: 'Custom', buildRatesGw: { ...scenario.buildRatesGw, [tech]: gw } });

  return (
    <div className="grid" style={{ gap: '0.9rem' }}>
      <label style={{ display: 'block' }}>
        <span className="label">Preset</span>
        <select
          className="mono"
          style={{ width: '100%', padding: '0.4rem', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem' }}
          value={PRESETS.some((p) => p.label === scenario.label) ? scenario.label : 'Custom'}
          onChange={(e) => {
            const p = PRESETS.find((x) => x.label === e.target.value);
            if (p) onChange({ ...p });
          }}
        >
          {!PRESETS.some((p) => p.label === scenario.label) ? <option value="Custom">Custom</option> : null}
          {PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="label">Build rate — GW ordered per year</span>
        <div style={{ marginTop: '0.4rem', display: 'grid', gap: '0.45rem' }}>
          {BUILDABLE_TECHS.map((t) => {
            const v = scenario.buildRatesGw[t] ?? 0;
            const max = t === 'gas_peaker' || t === 'nuclear' ? 30 : 100;
            return (
              <label key={t} style={{ display: 'grid', gridTemplateColumns: '5.5rem 1fr 3rem', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: TECH_META[t].color, display: 'inline-block' }} />
                  {TECH_META[t].label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={1}
                  value={v}
                  onChange={(e) => setBuild(t, Number(e.target.value))}
                  style={{ accentColor: accent }}
                  aria-label={`${TECH_META[t].label} build rate, gigawatts per year`}
                />
                <span className="mono" style={{ fontSize: '0.78rem', textAlign: 'right' }}>{v}</span>
              </label>
            );
          })}
        </div>
      </div>

      <label style={{ display: 'grid', gridTemplateColumns: '1fr 3.4rem', alignItems: 'center', gap: '0.5rem' }}>
        <span className="label">Demand growth (%/yr)</span>
        <span className="mono" style={{ textAlign: 'right', fontSize: '0.82rem' }}>{(scenario.demandGrowth * 100).toFixed(1)}%</span>
        <input
          type="range"
          min={-1}
          max={4}
          step={0.1}
          value={scenario.demandGrowth * 100}
          onChange={(e) => onChange({ ...scenario, label: 'Custom', demandGrowth: Number(e.target.value) / 100 })}
          style={{ gridColumn: '1 / -1', accentColor: accent }}
          aria-label="Demand growth percent per year"
        />
      </label>

      <div>
        <span className="label">Retirement policy</span>
        <div className="scale-toggle" style={{ marginTop: '0.35rem', display: 'flex' }} role="group" aria-label="Retirement policy">
          {(
            [
              ['announced-and-age', 'Announced + end-of-life'],
              ['announced-only', 'Announced only'],
            ] as [RetirementPolicy, string][]
          ).map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              aria-pressed={scenario.retirementPolicy === val}
              onClick={() => onChange({ ...scenario, label: 'Custom', retirementPolicy: val })}
              style={scenario.retirementPolicy === val ? { background: accent, color: 'var(--accent-ink)' } : undefined}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
        <label style={{ display: 'block' }}>
          <span className="label">Solar learning</span>
          <div className="flex" style={{ alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="range"
              min={0}
              max={35}
              step={1}
              value={scenario.solarLearningRate * 100}
              onChange={(e) => onChange({ ...scenario, label: 'Custom', solarLearningRate: Number(e.target.value) / 100 })}
              style={{ accentColor: accent }}
              aria-label="Solar learning rate percent per doubling"
            />
            <span className="mono" style={{ fontSize: '0.76rem', width: '2.6rem', textAlign: 'right' }}>{Math.round(scenario.solarLearningRate * 100)}%</span>
          </div>
        </label>
        <label style={{ display: 'block' }}>
          <span className="label">Battery learning</span>
          <div className="flex" style={{ alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="range"
              min={0}
              max={35}
              step={1}
              value={scenario.batteryLearningRate * 100}
              onChange={(e) => onChange({ ...scenario, label: 'Custom', batteryLearningRate: Number(e.target.value) / 100 })}
              style={{ accentColor: accent }}
              aria-label="Battery learning rate percent per doubling"
            />
            <span className="mono" style={{ fontSize: '0.76rem', width: '2.6rem', textAlign: 'right' }}>{Math.round(scenario.batteryLearningRate * 100)}%</span>
          </div>
        </label>
      </div>

      <label style={{ display: 'block' }}>
        <span className="label">Fossil pollution controls (death-rate anchor)</span>
        <select
          className="mono"
          style={{ width: '100%', padding: '0.4rem', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem' }}
          value={scenario.fossilControls ?? 'global'}
          onChange={(e) => {
            const val = e.target.value;
            onChange({ ...scenario, label: 'Custom', fossilControls: val === 'global' ? undefined : (val as ControlsTier) });
          }}
        >
          <option value="global">Global central (default)</option>
          <option value="stringent">Stringent controls</option>
          <option value="moderate">Moderate controls</option>
          <option value="limited">Limited controls</option>
        </select>
      </label>
    </div>
  );
}
