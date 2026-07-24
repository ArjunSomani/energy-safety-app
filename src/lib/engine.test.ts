import { describe, expect, it } from 'vitest';
import { computeMix, normalizeMix } from './engine';

describe('engine', () => {
  it('normalizes percent mixes and computes bands', () => {
    const mix = normalizeMix({ coal: 50, solar: 50 });
    const result = computeMix(mix, 100);
    expect(result.deaths.total.low).toBeCloseTo(1230.5);
    expect(result.co2.gPerKwh.central).toBeCloseTo(434);
  });

  it('adds firming cost only when requested', () => {
    const mix = normalizeMix({ solar: 100 });
    expect(computeMix(mix, 1).cost.usdPerMwh.central).toBe(46);
    expect(computeMix(mix, 1, true).cost.usdPerMwh.central).toBe(68);
  });

  it('emits warning triggers without treating reliability as a warning', () => {
    const result = computeMix(normalizeMix({ hydro: 20, nuclear: 20, wind: 30, solar: 30 }), 10);
    const ids = result.warnings.map((warning) => warning.id);
    expect(ids).toContain('W_HYDRO_BANQIAO');
    expect(ids).toContain('W_WIND_LAND_DUAL');
    expect(ids).not.toContain('W_NO_STORAGE');
  });
});
