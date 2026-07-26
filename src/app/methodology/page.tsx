export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-4xl">Methodology</h1>
      <h2>What this site computes</h2>
      <p>For annual demand D and source share M, generation is D × M. Deaths are generation × deaths/TWh. CO₂, land, and cost use the same weighted-sum structure.</p>
      <h2>Cost and firming</h2>
      <p>Lazard 2026 is the only cost methodology used. Oil, hydro, and biomass therefore show no comparable data instead of patched values from another source.</p>
      <p>The builder cost panel can include Lazard's illustrative firming-cost adder for wind and solar. The toggle uses grid-operator ELCC and Net CONE frameworks and does not claim to be a full reliability model.</p>
      <h2>Land</h2>
      <p>m²/MWh/yr and km²/TWh/yr are numerically identical, so one stored coefficient serves source tables and builder totals. Wind is shown as a dual figure because total wind-farm area includes turbine spacing, while direct land occupation is much smaller.</p>
      <h2>Uncertainty</h2>
      <p>Low values sum with low values, and high values sum with high values. This treats uncertainties as perfectly correlated and widens the band.</p>
      <h2>Known limitations</h2>
      <ul className="list-disc pl-6">
        <li>Data vintage differs by source and country.</li>
        <li>Fossil rates derive from a European 2007 baseline generalized beyond its setting.</li>
        <li>AR5 Annex III emissions still require direct hand-verification against the primary table.</li>
        <li>Nuclear figures depend on the contested linear no-threshold model.</li>
        <li>The firming-cost toggle is not a planning model, total system-cost model, or operational reliability model.</li>
        <li>Supply-chain labor conditions, waste-disposal long tails, wartime scenarios, terrorism, and siting-specific land use are outside the calculation.</li>
        <li>Country-level estimates apply global-average rates and will misstate some countries.</li>
      </ul>
      <h2>Country adjustments</h2>
      <p>
        Country estimates differ from the global source table in two deliberate ways. Hydro uses the rate excluding the
        1975 Banqiao Dam failure, and fossil death rates are re-anchored to a coarse three-way pollution-controls tier
        (stringent / moderate / limited) using the geometric mean of the global range as the interior split. This is a
        site-derived adjustment, not a published per-country figure.
      </p>
      <h2>Changelog</h2>
      <p className="mono">2026-07-26 — Renamed to Level; split hydro ex-Banqiao, added pollution-controls tiers, human-scale anchor, log/linear scale toggle, and dominance warnings.</p>
      <p className="mono">2026-07-24 — Added firming-cost toggle, no-comparable-cost handling, and wind dual land-use treatment.</p>
    </main>
  );
}
