'use client';

// A three-step orientation for first-time readers: what you do, what the model
// does, what you get back. Kept deliberately plain and visual.

const steps = [
  {
    n: '1',
    title: 'You make the decisions',
    body: 'How fast to build solar, wind, gas, nuclear and batteries. Whether to retire ageing plants. How fast demand grows.',
    icon: (
      <>
        <line x1="4" y1="7" x2="20" y2="7" />
        <circle cx="9" cy="7" r="2" fill="var(--surface)" />
        <line x1="4" y1="14" x2="20" y2="14" />
        <circle cx="15" cy="14" r="2" fill="var(--surface)" />
      </>
    ),
  },
  {
    n: '2',
    title: 'The model runs the fleet to 2050',
    body: 'Year by year: old plants retire, new ones take years to build, and each source makes power on its own schedule — solar by day, nuclear around the clock.',
    icon: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8v4l3 2" />
      </>
    ),
  },
  {
    n: '3',
    title: 'You see what it produces',
    body: 'The electricity mix over time, the deaths, CO₂, land and cost it implies — and whether it can actually keep the lights on, hour by hour.',
    icon: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 16l3-4 3 2 4-6" />
      </>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section aria-label="How the model works" style={{ marginBottom: '1.5rem' }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))', gap: '0.75rem' }}>
        {steps.map((s) => (
          <div key={s.n} className="panel p-4" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <span
                aria-hidden="true"
                style={{ color: 'var(--accent)', display: 'inline-flex' }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {s.icon}
                </svg>
              </span>
              <span className="card-num" aria-hidden="true">
                Step {s.n}
              </span>
            </div>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.02rem' }}>{s.title}</h3>
            <p className="text-sm" style={{ margin: 0, color: 'var(--ink-soft)' }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
