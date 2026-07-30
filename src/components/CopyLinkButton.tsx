'use client';

import { useEffect, useRef, useState } from 'react';

// Copies the current URL — which encodes the tool's full state (mix, demand,
// prices, selected sources) — so a reader can share exactly what they're
// looking at. The stateful pages keep window.location in sync via replaceState.
//
// navigator.clipboard is undefined outside a secure context and can reject on
// permission grounds, so the failure path is real, not theoretical. It used to
// be swallowed: the button did nothing at all and said nothing about it. Now a
// failure falls back to showing the URL in a selected field, which is the thing
// the reader was trying to get at.

type State = 'idle' | 'copied' | 'failed';

export default function CopyLinkButton({ label = 'Copy link' }: { label?: string }) {
  const [state, setState] = useState<State>('idle');
  const [url, setUrl] = useState('');
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const href = window.location.href;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(href);
      setState('copied');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), 2400);
    } catch {
      // Surface the URL so it can be copied by hand rather than failing silently.
      setUrl(href);
      setState('failed');
      requestAnimationFrame(() => fieldRef.current?.select());
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
      <button
        type="button"
        className="btn btn-ghost"
        style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
        onClick={copy}
      >
        {state === 'copied' ? '✓ Copied' : state === 'failed' ? '↗ Copy manually' : `↗ ${label}`}
      </button>

      {state === 'failed' ? (
        <input
          ref={fieldRef}
          type="text"
          readOnly
          value={url}
          aria-label="Page link — select and copy"
          onFocus={(e) => e.currentTarget.select()}
          style={{ fontSize: '0.75rem', width: 'min(22rem, 100%)' }}
        />
      ) : null}

      {/* Announced from its own live region rather than by putting aria-live on
          the button, so the status is not conflated with the control's label. */}
      <span className="sr-only" aria-live="polite">
        {state === 'copied'
          ? 'Link copied to clipboard'
          : state === 'failed'
            ? 'Could not copy automatically. The link is in the field beside the button; select and copy it.'
            : ''}
      </span>
    </span>
  );
}
