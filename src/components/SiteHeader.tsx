'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const links = [
  ['How we count', '/how-we-count'],
  ['Sources', '/sources'],
  ['Build', '/build'],
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

  useEffect(() => {
    setMounted(true);
    const stored = document.documentElement.dataset.theme;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('cs-theme', next);
    } catch {
      /* ignore */
    }
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="brand" href="/" aria-label="Common Scale home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Common Scale</span>
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
      </div>
    </header>
  );
}
