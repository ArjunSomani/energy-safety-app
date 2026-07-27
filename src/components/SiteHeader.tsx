'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const links = [
  ['How we count', '/how-we-count'],
  ['Sources', '/sources'],
  ['Build', '/build'],
  ['Model', '/model'],
  ['Countries', '/countries'],
  ['Data', '/data'],
  ['Methodology', '/methodology'],
  ['About', '/about'],
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname() || '/';
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = document.documentElement.dataset.theme;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    // Enable the 2s cross-fade for the duration of the switch, then remove it
    // so it never affects ordinary hover/interaction transitions.
    root.classList.add('theme-transition');
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => root.classList.remove('theme-transition'), 2000);
    setTheme(next);
    root.dataset.theme = next;
    try {
      localStorage.setItem('cs-theme', next);
    } catch {
      /* ignore */
    }
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="/" onClick={() => setOpen(false)}>
          Level
        </a>
        <nav className="site-nav" aria-label="Primary">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="nav-link"
              aria-current={isActive(pathname, href) ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {mounted ? (theme === 'dark' ? '☀' : '☾') : '☾'}
        </button>
        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            {open ? (
              <path strokeLinecap="round" d="M4 4l12 12M16 4L4 16" />
            ) : (
              <path strokeLinecap="round" d="M3 5h14M3 10h14M3 15h14" />
            )}
          </svg>
        </button>
      </div>
      {open ? (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="nav-link"
              aria-current={isActive(pathname, href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
