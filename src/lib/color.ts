/**
 * Colour maths for verifying the design system: WCAG relative luminance and
 * contrast, plus colour-vision-deficiency simulation.
 *
 * This exists so the quantitative claims in globals.css and model-viz.ts are
 * checked by the test suite rather than asserted in a comment. Those files state
 * that the risk ramp clears 3:1 in both themes, that it is monotonic, and that
 * the generation-mix palette is colourblind-safe in its stack order — all true
 * when written, none of it enforced, and all of it a single token edit away from
 * silently breaking.
 */

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1:1 to 21:1. Order-independent. */
export function contrast(a: string | Rgb, b: string | Rgb): number {
  const ra = typeof a === 'string' ? parseHex(a) : a;
  const rb = typeof b === 'string' ? parseHex(b) : b;
  const [hi, lo] = [relativeLuminance(ra), relativeLuminance(rb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Machado et al. (2009) severity-1.0 CVD transforms, applied in linear light. */
const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

export type CvdType = keyof typeof CVD_MATRICES;
export const CVD_TYPES = Object.keys(CVD_MATRICES) as CvdType[];

export function simulateCvd(hex: string, kind: CvdType): Rgb {
  const lin = parseHex(hex).map(toLinear);
  const m = CVD_MATRICES[kind];
  return m.map((row) => clamp01(toSrgb(clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])))) as Rgb;
}

/** CIE L*a*b* under D65, for perceptual distance. */
export function toLab(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(toLinear);
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIE76 colour difference. Below ~10 two colours are easily confused at a glance. */
export function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
