'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// useLayoutEffect measures before the browser paints, so the chart never shows a
// frame at the 640px fallback geometry and then snap to its real size. It warns
// if called during SSR, so fall back to useEffect on the server (where it is a
// no-op anyway).
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Measure a chart's rendered width so its SVG viewBox can be expressed in CSS
 * pixels instead of arbitrary units.
 *
 * The charts used to declare a fixed `viewBox="0 0 640 260"` with `width="100%"`.
 * That makes every unit — including font sizes — scale with the container, so
 * axis labels set at `fontSize={10}` rendered at:
 *
 *     375px viewport, 1 column   -> 4.6px
 *     768px viewport, 2 columns  -> 4.9px
 *    1280px viewport, 2 columns  -> 7.9px
 *
 * Only the single-column desktop case was legible, and the two-column case is
 * the scenario-comparison view — the reason the page exists.
 *
 * With the viewBox sized to the measured pixel width, one unit equals one CSS
 * pixel, so `fontSize={11}` is 11px at every viewport and the chart reflows by
 * redrawing rather than by shrinking.
 */
export function useChartWidth(fallbackWidth = 640) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Initialised identically on server and client so first paint matches during
  // hydration; the observer corrects it immediately after mount.
  const [width, setWidth] = useState(fallbackWidth);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w: number) => {
      if (w > 0) setWidth((prev) => (Math.abs(prev - w) < 1 ? prev : Math.round(w)));
    };
    measure(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) measure(box.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

/**
 * Fixed pixel type sizes for chart furniture. Kept together so all three charts
 * stay consistent, and so there is one place to check against the 11px floor.
 */
export const CHART_TYPE = {
  axis: 11,
  axisSmall: 10,
  unit: 10,
} as const;

/** Drop optional annotations when there is not enough room to place them. */
export function chartDensity(width: number) {
  return {
    /** Secondary "night / morning / afternoon / evening" style band labels. */
    showSecondaryLabels: width >= 420,
    /** Number of y-axis gridlines. */
    yTickCount: width < 360 ? 3 : 4,
    /** Number of x-axis labels for the 24-hour charts. */
    hourTickStep: width < 420 ? 8 : 6,
  };
}
