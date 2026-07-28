'use client';

import DeathsSplitBar from '@/components/DeathsSplitBar';
import VslControl from '@/components/VslControl';
import WarningStrip from '@/components/WarningStrip';
import countries from '@/data/countries.json';
import { computeMix, normalizeMix, slugs } from '@/lib/engine';
import { bandText, fmt, landAnchor, peoplePerDeathForMix } from '@/lib/format';
import type { SourceSlug } from '@/lib/types';
import { VSL_CENTRAL, bigBandText, costOfDeathsBand, perMwhBandText } from '@/lib/value';
import { useEffect, useMemo, useState } from 'react';

const world = countries.find((country) => country.iso === 'WLD')!;

function parseMixParam(value: string | null) {
  if (!value) return null;
  const entries = value.split(',').map((part) => part.split(':'));
  const mix = Object.fromEntries(slugs.map((slug) => [slug, 0])) as Record<SourceSlug, number>;
  for (const [slug, percent] of entries) {
    if (slugs.includes(slug as SourceSlug)) mix[slug as SourceSlug] = Number(percent);
  }
  return mix;
}

function serializeMix(mix: Record<SourceSlug, number>) {
  return slugs.map((slug) => `${slug}:${Math.round(mix[slug] ?? 0)}`).join(',');
}

export default function Page() {
  const [demand, setDemand] = useState(world.demandTwh);
  const [percentMix, setPercentMix] = useState<Record<SourceSlug, number>>(world.mix as Record<SourceSlug, number>);
  const [includeFirming, setIncludeFirming] = useState(false);
  const [vsl, setVsl] = useState(VSL_CENTRAL);
  const mix = useMemo(() => normalizeMix(percentMix), [percentMix]);
  const result = computeMix(mix, demand, { includeFirmingCost: includeFirming });
  const peoplePerDeath = peoplePerDeathForMix(result.deaths.total, demand);

  // Blended death rate of the whole mix, directly comparable to the risk rule.
  const intensity = demand > 0 ? result.deaths.total.central / demand : 0;
  // The death toll priced at the chosen value of a statistical life — the cost
  // the electricity bill never includes.
  const mortalityCostAnnual = costOfDeathsBand(result.deaths.total, vsl);
  const totalMwh = demand * 1_000_000;
  const mortalityCostPerMwh = {
    low: totalMwh > 0 ? mortalityCostAnnual.low / totalMwh : 0,
    central: totalMwh > 0 ? mortalityCostAnnual.central / totalMwh : 0,
    high: totalMwh > 0 ? mortalityCostAnnual.high / totalMwh : 0,
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const country = countries.find((item) => item.iso === params.get('country'));
    const parsedMix = parseMixParam(params.get('mix'));
    if (country) {
      setDemand(country.demandTwh);
      setPercentMix(country.mix as Record<SourceSlug, number>);
    } else if (parsedMix) {
      setPercentMix(parsedMix);
    }
    const parsedDemand = Number(params.get('demand'));
    if (Number.isFinite(parsedDemand) && parsedDemand > 0) setDemand(parsedDemand);
    setIncludeFirming(params.get('firming') === '1');
    // Only override the default when the param is actually present — an absent
    // param is Number(null) === 0, which would otherwise zero out the VSL.
    const vslParam = params.get('vsl');
    if (vslParam !== null && vslParam !== '') {
      const parsedVsl = Number(vslParam);
      if (Number.isFinite(parsedVsl) && parsedVsl >= 0) setVsl(parsedVsl);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('mix', serializeMix(percentMix));
    params.set('demand', String(Math.round(demand)));
    if (includeFirming) params.set('firming', '1');
    if (vsl !== VSL_CENTRAL) params.set('vsl', String(Math.round(vsl)));
    window.history.replaceState(null, '', `/build?${params.toString()}`);
  }, [demand, includeFirming, percentMix, vsl]);

  function setOne(slug: SourceSlug, value: number) {
    const next = { ...percentMix, [slug]: value };
    const others = slugs.filter((item) => item !== slug);
    const remaining = Math.max(0, 100 - value);
    const otherTotal = others.reduce((sum, item) => sum + (percentMix[item] ?? 0), 0) || 1;
    for (const other of others) next[other] = ((percentMix[other] ?? 0) / otherTotal) * remaining;
    setPercentMix(next);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-4xl">Build a grid</h1>
      <div className="my-4 flex flex-wrap gap-3">
        <label>
          Annual demand (TWh)
          <input className="border p-2" type="number" value={demand} onChange={(event) => setDemand(Number(event.target.value))} />
        </label>
        {countries.map((country) => (
          <button className="panel px-3" key={country.iso} onClick={() => { setDemand(country.demandTwh); setPercentMix(country.mix as Record<SourceSlug, number>); }}>
            {country.country}
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel p-4">
          {slugs.map((slug) => (
            <label className="mb-3 block" key={slug}>
              <span className="label">{slug}</span> <span className="mono">{Math.round(percentMix[slug] ?? 0)}%</span>
              <input
                className="w-full"
                type="range"
                min="0"
                max="100"
                value={percentMix[slug] ?? 0}
                onChange={(event) => setOne(slug, Number(event.target.value))}
                aria-valuetext={`${Math.round(percentMix[slug] ?? 0)} percent ${slug}`}
              />
            </label>
          ))}
        </section>
        <section className="grid gap-3">
          <div className="panel p-4">
            <h2>Deaths</h2>
            <p className="mono">{bandText(result.deaths.total, 'per year')}</p>
            {peoplePerDeath ? <p className="text-sm">≈ one death for every <span className="mono">{peoplePerDeath}</span>&apos;s annual electricity, at this mix.</p> : null}
            {intensity > 0 ? <p className="text-sm" style={{ marginBottom: '0.6rem' }}>This mix blends to about <span className="mono">{fmt(intensity)}</span> deaths/TWh. For scale, an all-coal grid is ~24.6, all-gas ~2.8, all-wind ~0.02.</p> : null}
            <DeathsSplitBar counted={result.deaths.counted} modeled={result.deaths.modeled} />
          </div>
          <div className="panel p-4"><h2>CO₂</h2><p className="mono">{bandText(result.co2.totalMt, 'Mt/yr')}</p><p className="mono">{bandText(result.co2.gPerKwh, 'gCO₂eq/kWh')}</p></div>
          <div className="panel p-4"><h2>Land</h2><p className="mono">{bandText(result.land.km2, 'km²')}</p><p className="text-sm">{landAnchor(result.land.km2.high)}</p><p className="text-sm">Wind uses a dual land figure: direct occupation to total wind-farm area.</p></div>
          <div className="panel p-4">
            <h2>Cost</h2>
            <label className="block text-sm"><input type="checkbox" checked={includeFirming} onChange={(event) => setIncludeFirming(event.target.checked)} /> Include Lazard 2026 firming-cost adder for wind and solar</label>
            <p className="mono">{bandText(result.cost.usdPerMwh, 'USD/MWh')}</p>
            <p className="mono">{bandText(result.cost.annualUsdBn, 'USD bn/yr')}</p>
            <p className="text-sm">Oil, hydro, and biomass render as no comparable cost data and are omitted rather than mixed with another methodology.</p>
          </div>
          <div className="panel p-4">
            <h2>Mortality cost</h2>
            <p className="text-sm text-[var(--ink-soft)]" style={{ marginTop: 0 }}>
              This grid&apos;s death toll, priced at the value of a statistical life — a cost the bill above never
              includes. <a href="/value">What is this?</a>
            </p>
            <div className="my-3">
              <VslControl vsl={vsl} onChange={setVsl} compact />
            </div>
            <p className="mono">{perMwhBandText(mortalityCostPerMwh)}</p>
            <p className="mono">{bigBandText(mortalityCostAnnual, 'per year')}</p>
            <p className="text-sm">
              Set against the market price above: for a coal-heavy mix the uncounted mortality cost can exceed the bill;
              for wind, solar, and nuclear it is a rounding error next to it.
            </p>
          </div>
        </section>
      </div>
      <div className="mt-6"><WarningStrip warnings={result.warnings} /></div>
    </main>
  );
}
