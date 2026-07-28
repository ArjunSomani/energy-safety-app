'use client';

import { useState } from 'react';

// Copies the current URL — which encodes the tool's full state (mix, demand,
// prices, selected sources) — so a reader can share exactly what they're
// looking at. The stateful pages keep window.location in sync via replaceState.
export default function CopyLinkButton({ label = 'Copy link' }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
      onClick={copy}
      aria-live="polite"
    >
      {copied ? '✓ Copied' : `↗ ${label}`}
    </button>
  );
}
