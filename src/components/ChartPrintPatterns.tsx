/**
 * Greyscale hatch patterns for the categorical generation-mix bands, used only
 * when printing.
 *
 * The mix palette is separated by hue, not luminance: adjacent bands in the
 * stack sit between 1.00:1 and 1.32:1 apart. That is deliberate and it survives
 * colour-vision deficiency (see model-viz.ts), but it means a greyscale printer
 * renders the whole stack as one near-uniform grey. Since this site ships a
 * designed print stylesheet — it is meant to be citable on paper — each band
 * also needs a texture.
 *
 * The patterns live in one hidden SVG mounted once in the root layout rather
 * than in each chart's own <defs>. `fill="url(#id)"` resolves against the whole
 * document, so every chart can reference these, and defining them once avoids
 * duplicate element IDs when several charts render on the same page.
 */
const PATTERNS = [
  { key: 'nuclear', d: 'M0,0 l8,8 M-2,6 l4,4 M6,-2 l4,4' }, // diagonal, up
  { key: 'other', d: 'M8,0 l-8,8 M2,-2 l-4,4 M10,6 l-4,4' }, // diagonal, down
  { key: 'hydro', d: 'M0,4 h8' }, // horizontal
  { key: 'fossil', d: 'M0,0 l8,8 M8,0 l-8,8' }, // cross
  { key: 'wind', d: 'M4,0 v8' }, // vertical
  { key: 'solar', d: 'M2,2 h1 v1 h-1 z M6,5 h1 v1 h-1 z' }, // dots
] as const;

export default function ChartPrintPatterns() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        {PATTERNS.map(({ key, d }) => (
          <pattern key={key} id={`print-mix-${key}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#fff" />
            <path d={d} stroke="#333" strokeWidth="0.9" fill="#333" />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}
