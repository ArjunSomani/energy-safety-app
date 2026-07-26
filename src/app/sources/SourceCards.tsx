'use client';

import sourcesData from '@/data/sources.json';
import { useState } from 'react';

type Sort = 'rate' | 'alpha';

export default function SourceCards({ sources }: { sources: typeof sourcesData }) {
  const [sort, setSort] = useState<Sort>('rate');
  const ordered =
    sort === 'alpha' ? [...sources].sort((a, b) => a.label.localeCompare(b.label)) : sources;

  return (
    <div>
      <div className="mt-6 mb-3 flex items-end justify-between gap-4">
        <p className="label" style={{ margin: 0 }}>
          {sources.length} sources
        </p>
        <div className="scale-toggle" role="group" aria-label="Sort order">
          <button type="button" aria-pressed={sort === 'rate'} onClick={() => setSort('rate')}>
            By death rate
          </button>
          <button type="button" aria-pressed={sort === 'alpha'} onClick={() => setSort('alpha')}>
            A–Z
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {ordered.map((source) => (
          <a className="panel p-4" href={`/sources/${source.slug}`} key={source.slug}>
            <h2 style={{ marginTop: 0 }}>{source.label}</h2>
            <p className="text-sm" style={{ margin: 0 }}>
              {source.description}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
