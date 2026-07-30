import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CVD_TYPES, contrast, deltaE, parseHex, relativeLuminance, simulateCvd } from './color';
import { MIX_GROUPS } from './model-viz';

/**
 * The design system's numeric guarantees, enforced.
 *
 * globals.css states that the risk ramp clears 3:1 against both surfaces in both
 * themes and stays monotonic, that the comparison series does the same, and that
 * the generation-mix palette is colourblind-safe in the stack order MIX_GROUPS
 * declares. Those were true when measured and nothing kept them true — a single
 * token edit could have reintroduced the dark-mode failure where the top three
 * risk bars fell to 1.36:1 and the counted-vs-modeled split stopped being
 * readable on coal, oil and biomass.
 *
 * Tokens are read out of globals.css rather than duplicated here, so the test
 * fails if the stylesheet drifts, not if a copy of it does.
 */

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

type Theme = 'light' | 'dark';

/** Read `--name: light-dark(#aaa, #bbb);` out of globals.css. */
function themedToken(name: string): Record<Theme, string> {
  const m = CSS.match(new RegExp(`--${name}:\\s*light-dark\\(\\s*(#[0-9a-fA-F]{3,8})\\s*,\\s*(#[0-9a-fA-F]{3,8})\\s*\\)`));
  if (!m) throw new Error(`token --${name} not found as light-dark() in globals.css`);
  return { light: m[1], dark: m[2] };
}

const ramp = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => themedToken(`${prefix}-${i + 1}`));

const ground = themedToken('ground');
const surface = themedToken('surface');
const ink = themedToken('ink');
const inkSoft = themedToken('ink-soft');
const inkMuted = themedToken('ink-muted');
const accent = themedToken('accent');
const accentInk = themedToken('accent-ink');
const accentSoft = themedToken('accent-soft');
const fieldBorder = themedToken('field-border');

const RISK = ramp('risk', 8);
const SERIES = ramp('series', 4);
const THEMES: Theme[] = ['light', 'dark'];

describe('token parsing', () => {
  it('finds every themed token as a light-dark() pair', () => {
    expect(RISK).toHaveLength(8);
    expect(SERIES).toHaveLength(4);
    for (const t of [...RISK, ...SERIES, ground, surface, ink, fieldBorder]) {
      expect(() => parseHex(t.light)).not.toThrow();
      expect(() => parseHex(t.dark)).not.toThrow();
    }
  });
});

describe('text contrast (WCAG 1.4.3 AA = 4.5:1 for body text)', () => {
  const pairs: [string, Record<Theme, string>, Record<Theme, string>][] = [
    ['ink on ground', ink, ground],
    ['ink-soft on ground', inkSoft, ground],
    ['ink-soft on surface', inkSoft, surface],
    ['ink-muted on ground', inkMuted, ground],
    ['ink-muted on surface', inkMuted, surface],
    ['accent on ground', accent, ground],
    ['accent on surface', accent, surface],
    ['accent-ink on accent', accentInk, accent],
    ['accent on accent-soft', accent, accentSoft],
    ['ink-soft on accent-soft', inkSoft, accentSoft],
  ];

  for (const theme of THEMES) {
    for (const [label, fg, bg] of pairs) {
      it(`${theme}: ${label}`, () => {
        expect(contrast(fg[theme], bg[theme])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('UI component contrast (WCAG 1.4.11 = 3:1)', () => {
  for (const theme of THEMES) {
    // A field's border is the only thing identifying it as a control: its fill
    // matches the panel behind it. --rule sits at ~1.24:1 and is deliberately
    // NOT used here.
    it(`${theme}: field-border against the field fill`, () => {
      expect(contrast(fieldBorder[theme], surface[theme])).toBeGreaterThanOrEqual(3);
    });
    it(`${theme}: field-border against the page ground`, () => {
      expect(contrast(fieldBorder[theme], ground[theme])).toBeGreaterThanOrEqual(3);
    });
    it(`${theme}: focus ring against the page ground`, () => {
      expect(contrast(accent[theme], ground[theme])).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('risk ramp', () => {
  for (const theme of THEMES) {
    it(`${theme}: every step is >=3:1 against surface and ground`, () => {
      RISK.forEach((step, i) => {
        expect(contrast(step[theme], surface[theme]), `--risk-${i + 1} vs surface`).toBeGreaterThanOrEqual(3);
        expect(contrast(step[theme], ground[theme]), `--risk-${i + 1} vs ground`).toBeGreaterThanOrEqual(3);
      });
    });

    it(`${theme}: luminance is strictly monotonic, so it reads as one ordered scale`, () => {
      const lums = RISK.map((s) => relativeLuminance(parseHex(s[theme])));
      // Step 1 is the highest death rate and always carries the most visual
      // weight: darkest on the light ground, brightest on the dark one.
      for (let i = 1; i < lums.length; i++) {
        if (theme === 'light') expect(lums[i], `step ${i + 1}`).toBeGreaterThan(lums[i - 1]);
        else expect(lums[i], `step ${i + 1}`).toBeLessThan(lums[i - 1]);
      }
    });

    it(`${theme}: endpoints are far enough apart to read as a gradient`, () => {
      expect(contrast(RISK[0][theme], RISK[7][theme])).toBeGreaterThanOrEqual(2.5);
    });
  }
});

describe('comparison series palette', () => {
  for (const theme of THEMES) {
    it(`${theme}: every series colour is >=3:1 against surface and ground`, () => {
      SERIES.forEach((s, i) => {
        expect(contrast(s[theme], surface[theme]), `--series-${i + 1} vs surface`).toBeGreaterThanOrEqual(3);
        expect(contrast(s[theme], ground[theme]), `--series-${i + 1} vs ground`).toBeGreaterThanOrEqual(3);
      });
    });

    it(`${theme}: series colours stay apart from each other`, () => {
      for (let i = 0; i < SERIES.length; i++) {
        for (let j = i + 1; j < SERIES.length; j++) {
          const d = deltaE(parseHex(SERIES[i][theme]), parseHex(SERIES[j][theme]));
          expect(d, `series ${i + 1} vs ${j + 1}`).toBeGreaterThan(20);
        }
      }
    });

    it(`${theme}: series colours avoid the accent, which is reserved for UI chrome`, () => {
      // globals.css: "accent — UI chrome only ... never in charts". /compare used
      // to hard-code the light accent as its first series colour.
      for (const s of SERIES) {
        expect(deltaE(parseHex(s[theme]), parseHex(accent[theme]))).toBeGreaterThan(20);
      }
    });
  }
});

describe('generation-mix palette', () => {
  // model-viz.ts: "validated in the stack order below ... keep nuclear (violet)
  // and hydro (blue) non-adjacent". Both halves of that claim are checked here.
  const mixToken = (key: string) => themedToken(`mix-${key}`);
  const stack = MIX_GROUPS.map((g) => g.key);

  it('MIX_GROUPS keeps nuclear and hydro non-adjacent', () => {
    const n = stack.indexOf('nuclear');
    const h = stack.indexOf('hydro');
    expect(Math.abs(n - h)).toBeGreaterThan(1);
  });

  for (const theme of THEMES) {
    for (const cvd of CVD_TYPES) {
      it(`${theme}/${cvd}: adjacent bands in the stack stay distinguishable`, () => {
        for (let i = 0; i < stack.length - 1; i++) {
          const a = simulateCvd(mixToken(stack[i])[theme], cvd);
          const b = simulateCvd(mixToken(stack[i + 1])[theme], cvd);
          expect(deltaE(a, b), `${stack[i]} vs ${stack[i + 1]}`).toBeGreaterThan(20);
        }
      });
    }

    it(`${theme}: every band is visible against the panel`, () => {
      for (const key of stack) {
        expect(contrast(mixToken(key)[theme], surface[theme]), key).toBeGreaterThanOrEqual(2);
      }
    });
  }
});

describe('ladder charts share one coordinate space', () => {
  // The gridline layer and every bar row must both be positioned by
  // .ladder-track. When they were not, gridlines resolved against the full
  // container while bars resolved against a container inset by the label gutter:
  // the two scales agreed only at 100%, and at phone width coal's low bound
  // (24.6/TWh) rendered exactly on the "100" line.
  const files = ['RiskRule', 'MetricLadder', 'ValueRule'];

  for (const name of files) {
    const src = readFileSync(join(__dirname, '..', 'components', `${name}.tsx`), 'utf8');

    it(`${name}: positions nothing with the old ad-hoc inset`, () => {
      expect(src).not.toMatch(/left-28/);
      expect(src).not.toMatch(/absolute w-24/);
    });

    it(`${name}: gridlines and bars are both inside .ladder-track`, () => {
      // one track for the gridline layer, one per bar row, plus the baseline
      expect(src.match(/ladder-track/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    });

    it(`${name}: offers the figures as text, since bars carry no accessible value`, () => {
      expect(src).toMatch(/<table/);
    });
  }

  it('globals.css derives the track and the gutter from one token', () => {
    expect(CSS).toMatch(/\.ladder-track\s*\{[^}]*left:\s*var\(--ladder-gutter\)/);
    expect(CSS).toMatch(/\.ladder-gutter\s*\{[^}]*var\(--ladder-gutter\)/);
  });
});

describe('chart type stays legible at every viewport', () => {
  // The SVG charts size their viewBox in CSS pixels from the measured container
  // width, so font sizes are literal pixels. With a fixed 640-unit viewBox they
  // scaled with the container and rendered at 3.7-4.9px on a phone.
  const hook = readFileSync(join(__dirname, '..', 'components', 'model', 'useChartWidth.ts'), 'utf8');
  const sizes = [...hook.matchAll(/(?:axis|axisSmall|unit):\s*(\d+)/g)].map((m) => Number(m[1]));

  it('declares chart type sizes', () => {
    expect(sizes.length).toBeGreaterThanOrEqual(3);
  });

  it('never specifies chart type below 10px', () => {
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(10);
  });

  for (const name of ['DayProfileChart', 'StackedAreaMix', 'BandTimeline']) {
    const src = readFileSync(join(__dirname, '..', 'components', 'model', `${name}.tsx`), 'utf8');

    it(`${name}: sizes its viewBox from the measured width, not a constant`, () => {
      expect(src).toMatch(/useChartWidth/);
      expect(src).not.toMatch(/^const W = \d+;/m);
    });

    it(`${name}: uses the shared type scale rather than ad-hoc font sizes`, () => {
      expect(src).toMatch(/CHART_TYPE\./);
      expect(src).not.toMatch(/fontSize=\{(?:[0-9]|[0-9]\.[0-9])\}/);
    });
  }
});
