'use client';

import type { ModelTech } from '@/lib/model';
import { BUILDABLE_TECHS, PRESETS, type RetirementPolicy, TECH_META, type UiScenario } from '@/lib/model-run';
import { groupColorForTech } from '@/lib/model-viz';
import type { ControlsTier } from '@/lib/types';
import { useState } from 'react';

// One scenario's controls. Every knob is a disclosed assumption; none is labelled
// recommended or realistic (neutrality #1). The big levers are always visible;
// the finer assumptions hide behind "advanced" so a first-timer is not flooded.

const HELP: Partial<Record<ModelTech, string>> = {
  solar: 'panels — cheap, but only makes power in daylight',
  wind: 'turbines — variable, a bit stronger at night',
  battery: 'stores a few hours of power for the evening',
  nuclear: 'always-on, but takes ~7 years to build',
  gas_cc: 'the workhorse gas plant — flexible, burns fuel',
  gas_peaker: 'gas plant for short demand spikes',
};

export default function ScenarioControls({
  scenario,
  onChange,
  accent,
}: {
  scenario: UiScenario;
  onChange: (next: UiScenario) => void;
  accent: string;
}) {
  const [advanced, setAdvanced] = useState(false);
  const setBuild = (tech: ModelTech, gw: number) =>
    onChange({ ...scenario, label: 'Custom', buildRatesGw: { ...scenario.buildRatesGw, [tech]: gw } });

  return (
    <div className="grid" style={{ gap: '0.9rem' }}>
      <label style={{ display: 'block' }}>
        <span className="label">Start from a preset</span>
        <select
          className="mono"
          style={{ width: '100%', marginTop: '0.25rem' }}
          value={PRESETS.some((p) => p.label === scenario.label) ? scenario.label : 'Custom'}
          onChange={(e) => {
            const p = PRESETS.find((x) => x.label === e.target.value);
            if (p) onChange({ ...p });
          }}
        >
          {!PRESETS.some((p) => p.label === scenario.label) ? <option value="Custom">Custom (your own settings)</option> : null}
          {PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="label">How much to build each year (GW)</span>
        <p style={{ margin: '0.15rem 0 0.4rem', fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
          A big new power plant is roughly 1 GW. Drag to add more or less of each per year.
        </p>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {BUILDABLE_TECHS.map((t) => {
            const v = scenario.buildRatesGw[t] ?? 0;
            const max = t === 'gas_peaker' || t === 'nuclear' ? 30 : 100;
            return (
              <div key={t}>
                <label style={{ display: 'grid', gridTemplateColumns: '5.5rem 1fr 3rem', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: groupColorForTech(t), display: 'inline-block' }} />
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
                    aria-valuetext={`${v} gigawatts per year`}
                  />
                  <span className="mono" style={{ fontSize: '0.78rem', textAlign: 'right' }}>{v}</span>
                </label>
                {HELP[t] ? <p style={{ margin: '0 0 0 6rem', fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{HELP[t]}</p> : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* A <label> may only contain phrasing content, so the explanatory note is
          a sibling <div> rather than a <p> nested inside the label. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3.4rem', alignItems: 'center', gap: '0.5rem' }}>
        <label className="label" htmlFor="demand-growth">
          How fast demand grows (%/yr)
        </label>
        <span className="mono" style={{ textAlign: 'right', fontSize: '0.82rem' }}>{(scenario.demandGrowth * 100).toFixed(1)}%</span>
        <input
          id="demand-growth"
          type="range"
          min={-1}
          max={4}
          step={0.1}
          value={scenario.demandGrowth * 100}
          onChange={(e) => onChange({ ...scenario, label: 'Custom', demandGrowth: Number(e.target.value) / 100 })}
          style={{ gridColumn: '1 / -1', accentColor: accent }}
          aria-label="Demand growth percent per year"
          aria-valuetext={`${(scenario.demandGrowth * 100).toFixed(1)} percent per year`}
        />
        <div style={{ gridColumn: '1 / -1', fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
          US demand has grown ~1%/yr; data centres and electric cars could push it higher.
        </div>
      </div>

      <div>
        <span className="label">When to retire old plants</span>
        <div className="scale-toggle" style={{ marginTop: '0.35rem', display: 'flex' }} role="group" aria-label="Retirement policy">
          {(
            [
              ['announced-and-age', 'At end of life'],
              ['announced-only', 'Only if already announced'],
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

      <button
        type="button"
        className="btn btn-ghost"
        style={{ justifySelf: 'start', padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}
        aria-expanded={advanced}
        aria-controls="advanced-assumptions"
        onClick={() => setAdvanced((v) => !v)}
      >
        {advanced ? '− Hide advanced assumptions' : '+ Show advanced assumptions'}
      </button>

      {advanced ? (
        <div id="advanced-assumptions" className="grid" style={{ gap: '0.9rem', paddingLeft: '0.8rem' }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
            <label style={{ display: 'block' }}>
              <span className="label">Solar cost fall</span>
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
                  aria-valuetext={`${Math.round(scenario.solarLearningRate * 100)} percent per doubling`}
                />
                <span className="mono" style={{ fontSize: '0.76rem', width: '2.6rem', textAlign: 'right' }}>{Math.round(scenario.solarLearningRate * 100)}%</span>
              </div>
            </label>
            <label style={{ display: 'block' }}>
              <span className="label">Battery cost fall</span>
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
                  aria-valuetext={`${Math.round(scenario.batteryLearningRate * 100)} percent per doubling`}
                />
                <span className="mono" style={{ fontSize: '0.76rem', width: '2.6rem', textAlign: 'right' }}>{Math.round(scenario.batteryLearningRate * 100)}%</span>
              </div>
            </label>
          </div>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            How much cheaper solar and batteries get each time the world doubles how much it has built.
          </p>
          <label style={{ display: 'block' }}>
            <span className="label">Fossil pollution controls (death-rate anchor)</span>
            <select
              className="mono"
              style={{ width: '100%', marginTop: '0.25rem' }}
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
      ) : null}
    </div>
  );
}
