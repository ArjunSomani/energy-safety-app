import { describe, expect, it } from 'vitest';
import { anchorFossilRate, computeMix, normalizeMix } from './engine';
import { peoplePerDeath } from './format';

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
    expect(computeMix(mix, 1, { includeFirmingCost: true }).cost.usdPerMwh.central).toBe(68);
  });

  it('emits warning triggers without treating reliability as a warning', () => {
    const result = computeMix(normalizeMix({ hydro: 20, nuclear: 20, wind: 30, solar: 30 }), 10);
    const ids = result.warnings.map((warning) => warning.id);
    expect(ids).toContain('W_HYDRO_BANQIAO');
    expect(ids).toContain('W_WIND_LAND_DUAL');
    expect(ids).not.toContain('W_NO_STORAGE');
  });

  it('excludes Banqiao from hydro and suppresses its warning when asked', () => {
    const mix = normalizeMix({ hydro: 100 });
    const withBanqiao = computeMix(mix, 100);
    const exBanqiao = computeMix(mix, 100, { excludeBanqiao: true });
    expect(exBanqiao.deaths.total.central).toBeLessThan(withBanqiao.deaths.total.central);
    expect(exBanqiao.deaths.total.central).toBeCloseTo(4); // 0.04 * 100 TWh
    expect(exBanqiao.warnings.map((w) => w.id)).not.toContain('W_HYDRO_BANQIAO');
  });

  it('anchors fossil rates to the controls tier', () => {
    const coal = { low: 24.6, central: 24.6, high: 224, modeledShare: 0.95 };
    const mid = Math.sqrt(24.6 * 224);
    expect(anchorFossilRate(coal, 'stringent')).toMatchObject({ low: 24.6, central: 24.6, high: mid });
    expect(anchorFossilRate(coal, 'limited')).toMatchObject({ low: mid, central: 224, high: 224 });
    expect(anchorFossilRate(coal, 'moderate')).toMatchObject({ low: 24.6, central: mid, high: 224 });
  });

  it('stringent controls pull a coal-heavy country band well below the global high', () => {
    const mix = normalizeMix({ coal: 100 });
    const global = computeMix(mix, 100);
    const stringent = computeMix(mix, 100, { fossilControls: 'stringent' });
    expect(stringent.deaths.total.high).toBeLessThan(global.deaths.total.high);
  });

  it('names a dominant source in the deaths panel', () => {
    const result = computeMix(normalizeMix({ coal: 90, solar: 10 }), 100);
    expect(result.warnings.map((w) => w.id)).toContain('W_DOMINANCE_DEATHS');
  });

  it('expresses a rate as people per death', () => {
    const p = peoplePerDeath({ low: 24.6, central: 24.6, high: 224 });
    expect(p.low).toBeCloseTo(150000 / 224);
    expect(p.high).toBeCloseTo(150000 / 24.6);
  });
});
