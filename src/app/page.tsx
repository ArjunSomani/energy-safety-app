import RiskRule from '@/components/RiskRule';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="mb-6 text-4xl md:text-6xl">Common Scale</h1>
      <RiskRule />
      <p className="my-6 max-w-2xl text-lg">
        Electricity sources are placed on one measured scale, using deaths per unit of electricity generated.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Compare the sources', '/sources'],
          ['Build a grid', '/build'],
          ['Find your country', '/countries'],
        ].map(([title, href]) => (
          <a className="panel p-6 text-xl" href={href} key={href}>
            {title} →
          </a>
        ))}
      </div>
      <p className="mt-6"><a href="/how-we-count">Start here if this is new to you</a></p>
    </main>
  );
}
