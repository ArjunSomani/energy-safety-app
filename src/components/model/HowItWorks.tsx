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
    // A visible <h2> rather than an aria-label: these steps use <h3>, and with no
    // h2 above them the /model page went straight from h1 to h3, which breaks
    // heading navigation (WCAG 1.3.1).
    //
    // Rendered with the site's own .stepper idiom (the one /how-we-count uses)
    // rather than three equally-weighted cards in a grid. These steps are an
    // ordered sequence — you decide, the model runs, you read the result — and a
    // connected rail says that; three side-by-side cards say the opposite, that
    // the items are parallel and interchangeable.
    <section style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ marginTop: '1.4rem' }}>How this model works</h2>
      <ol className="stepper mt-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map((s, i) => (
          <li className="step" key={s.n}>
            <div className="step-rail">
              <div className="step-badge" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {s.icon}
                </svg>
              </div>
              {i < steps.length - 1 ? <div className="step-line" /> : null}
            </div>
            <div className="step-body">
              <h3 className="step-title" style={{ margin: 0, fontSize: '1.02rem' }}>
                {s.n}. {s.title}
              </h3>
              <p className="text-sm" style={{ margin: '0.35rem 0 0', color: 'var(--ink-soft)' }}>
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
