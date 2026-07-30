import Link from 'next/link';

// Next's built-in 404 ships no <main> landmark and no way back into the site.
// This one is an ordinary page of the site: same header and footer from the root
// layout, a real landmark, and the routes a reader is most likely to have been
// looking for.

export const metadata = {
  title: 'Page not found — Level',
};

const suggestions: [string, string, string][] = [
  ['/sources', 'The eight sources', 'Every source on one deaths-per-terawatt-hour scale.'],
  ['/how-we-count', 'How we count', 'What counts as a death, and who counted it.'],
  ['/data', 'The data', 'Every coefficient the site runs on, sortable, with citations.'],
  ['/methodology', 'Methodology', 'Where each number comes from and what it excludes.'],
];

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-4xl">Page not found</h1>
      <p className="lede">
        That address doesn&apos;t match anything on this site. It may have moved, or the link may have been mistyped.
      </p>

      <h2>Try one of these</h2>
      <ul className="grid gap-3" style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
        {suggestions.map(([href, title, body]) => (
          <li key={href}>
            <Link className="panel p-4" href={href}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h3>
              <p className="mt-3 text-sm text-[var(--ink-soft)]" style={{ margin: '0.35rem 0 0' }}>
                {body} <span className="card-arrow" />
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-[var(--ink-soft)]">
        Or go back to <Link href="/">the front page</Link>.
      </p>
    </main>
  );
}
