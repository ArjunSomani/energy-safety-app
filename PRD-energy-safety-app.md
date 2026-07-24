# Product Requirements Document

## Working title: **Per Terawatt-Hour**

A neutral, interactive reference for comparing the safety of electricity sources.

**Version** 1.0 · **Date** July 24, 2026 · **Owner** Arjun
**Reference implementation** [optimizemodel.vercel.app](https://optimizemodel.vercel.app/) — same ladder structure, different subject

---

## 1. Goal

Let anyone — with no background in energy, statistics, or epidemiology — get a truthful answer to "how dangerous is each way of making electricity?" in under sixty seconds, and then keep going as deep as they want, all the way to the primary literature.

### 1.1 Success criteria

| # | Criterion | How we'd know |
|---|---|---|
| S1 | A first-time visitor can rank the eight sources by risk without reading a paragraph | The home page hero conveys it visually alone |
| S2 | Every number on the site traces to a citation in ≤2 clicks | Every rendered figure carries a source ref |
| S3 | A skeptic of any persuasion finds no editorial thumb on the scale | No value-laden color coding, no conclusion copy |
| S4 | The two interactive tools share state | A country's real mix loads into the builder in one click |
| S5 | Works on a phone | All tools usable at 375px |

### 1.2 Non-goals

- **Not a climate site.** CO₂ appears as one output dimension among four, not as the point.
- **Not an advocacy site.** No calls to action, no policy recommendations, no "what you can do."
- **Not a forecasting model.** Unlike Optimize, nothing here projects forward. This is descriptive.
- **No accounts, no persistence, no backend.** Static site. Shareable state lives in the URL.

---

## 2. The neutrality doctrine

The user asked for a neutral comparison tool with no thesis. That's harder than it sounds, because the underlying data is not neutral-looking: the spread between coal and nuclear is roughly three orders of magnitude. Neutrality therefore has to be enforced at the level of *presentation discipline*, and these rules are binding on every page.

**N1 — No value-coded color.** Sources are never green/red, never "clean/dirty." Categorical colors are assigned from a single perceptually-ordered palette with no cultural valence. A user must not be able to infer a verdict from a hue.

**N2 — Scale is always disclosed and always toggleable.** Log scale hides the magnitude of the gap; linear scale makes the small values invisible. Ship both, default to linear, and label the toggle in plain words ("compare small values" / "show true proportions") rather than "log/linear."

**N3 — Counted and modeled deaths are visually distinct.** Accident fatalities are counted bodies. Air pollution fatalities are statistical attributions from epidemiological models. These are different epistemic objects. Solid fill = counted; hatched fill = modeled. This rule holds in every chart on the site, with a persistent legend.

**N4 — Uncertainty is a first-class citizen, not a footnote.** Every death rate renders as a range, not a point. Where a range is unknown, the UI says so rather than implying precision. Our World in Data explicitly warns that <cite index="3-1">the differences between nuclear, solar, and wind are small enough that their uncertainties likely overlap</cite> — the site must never let a user rank those three.

**N5 — Contested figures show their contest.** Where estimates diverge (Chernobyl's long-term toll, Banqiao's death count, coal's true global rate), show the divergence and name who says what. Never silently pick one.

**N6 — No editorial voice.** Copy describes and defines. It does not conclude, urge, reassure, or alarm. Captions state what a chart shows, never what it means.

**N7 — The methodology's own weaknesses are stated by us, first.** See §7.4. If a critic can find a flaw we haven't already disclosed, we've failed.

---

## 3. Information architecture

Five rungs, borrowed from Optimize's structure, ascending in required effort:

```
Rung 1  HOOK          /                 the headline visual, no jargon
Rung 2  ORIENT        /how-we-count     plain-language explainer
Rung 3  BROWSE        /sources          8 source profiles
Rung 4  PLAY          /build            grid builder
                      /countries        country explorer
Rung 5  VERIFY        /data             raw tables, CSV download
                      /methodology      sourcing, uncertainty, criticism
```

### 3.1 Route map

| Route | Type | Purpose |
|---|---|---|
| `/` | Static | Hero, the risk rule, entry points to both tools |
| `/how-we-count` | Static | What a "death per TWh" is; counted vs. modeled; lifecycle boundaries |
| `/sources` | Static | Index of eight sources on the shared rule |
| `/sources/[slug]` | SSG × 8 | One source in depth |
| `/build` | Static + URL state | Grid builder |
| `/countries` | Static | Searchable/sortable index of ~200 countries + world map |
| `/countries/[iso]` | SSG × ~200 | One country's mix, risk profile, and (for 10) disaster narrative |
| `/data` | Static | Every underlying table, rendered and downloadable |
| `/methodology` | Static | Full sourcing, assumptions, known limitations, changelog |
| `/about` | Static | What this is, who made it, how to report an error |

### 3.2 The eight sources

`coal` · `oil` · `gas` · `biomass` · `hydro` · `nuclear` · `wind` · `solar`

Lignite/brown coal is tracked separately in the data layer (it has a materially higher rate) but presented as a sub-variant on the coal profile page rather than a ninth top-level card.

---

## 4. Data architecture

**Recommendation: build-time fetch, cached in the repo — split into three tiers by update rhythm.**

The tiers matter because the data has three different natures. Treating them uniformly is the mistake.

### Tier A — Coefficients (hand-curated, versioned, never fetched)

`src/data/sources.json` — roughly 8 records × 12 fields. These come from academic papers, not APIs. There is no endpoint for "deaths per TWh." Hand-enter them, and give **every single field its own provenance object.**

```jsonc
{
  "slug": "coal",
  "label": "Coal",
  "deathRate": {
    "low": 24.6, "central": 24.6, "high": 224,
    "unit": "deaths/TWh",
    "note": "Central figure is the Markandya & Wilkinson (2007) European estimate carried by OWID. The high bound reflects OWID's own caution that updated air-pollution research implies a global average substantially higher.",
    "source": "owid-safest-sources",
    "modeledShare": 0.95
  },
  "lifecycleCO2": { "low": 740, "central": 820, "high": 910, "unit": "gCO2eq/kWh", "source": "ipcc-ar5-a3" },
  "landUse":      { "central": null, "unit": "m2/MWh/yr", "source": "vanzalk-behrens-2018", "status": "TO_SOURCE" },
  "lcoe":         { "low": null, "high": null, "unit": "USD/MWh", "source": "lazard-lcoe", "status": "TO_SOURCE" }
}
```

`status: "TO_SOURCE"` is a build-blocking sentinel — see §9.3.

### Tier B — Country electricity mix (build-time fetch, committed)

Source: **`owid/energy-data`**, which OWID publishes as CSV/XLSX/JSON with <cite index="11-1">one row per location and year, covering energy consumption, energy mix, and electricity mix, updated regularly, with a full codebook describing each indicator</cite>.

`scripts/fetch-owid.ts`:
1. Download `owid-energy-data.csv`
2. Keep only: iso_code, country, year, population, electricity_demand, electricity_generation, per-source generation (TWh) and share (%), electricity_demand_per_capita
3. For each country, select the most recent year with a complete electricity mix
4. Drop OWID aggregate rows (regions, income groups) into a separate `regions.json` — do not let "Africa" appear in a country list
5. Emit `src/data/countries.json` + `src/data/meta.json` (fetch date, OWID file hash, vintage year per country)
6. **Commit the output.**

Run via `npm run data:refresh`, manually. Not on every deploy.

### Tier C — Editorial overlays (hand-authored)

`src/data/profiles.json` — derived from `top10_countries_profile.xlsx`. Ten countries get a narrative disaster card. See §4.2 for the important caveat.

### 4.1 Why this over the alternatives

| Option | Verdict |
|---|---|
| Live API at runtime | **No.** Adds latency to every page load, introduces an availability dependency for a site whose whole value is being trustworthy, and OWID doesn't offer a query API anyway — you'd be fetching a multi-MB CSV in a Vercel function. |
| Fetch on every build | **No.** Non-deterministic builds. A silent upstream schema change breaks production on an unrelated deploy. |
| Fully hardcoded, no script | **No.** ~200 countries × 12 fields is too much to hand-maintain, and you lose refresh reproducibility. |
| **Three-tier, committed** | **Yes.** Zero runtime cost, works with static export, deterministic, and — the decisive point for a site claiming neutrality — **every number is diffable in git.** When a figure changes, `git blame` shows when, and the refresh script shows why. That's an auditability property no other option gives you. |

### 4.2 Handling the spreadsheet honestly

The uploaded file's "worst man-made disaster" column is **not an energy dataset.** Of the ten events, six are energy-related (Banqiao dam, Chernobyl, Balochistan mine, Jesse pipeline, San Juanico LPG, Brumadinho tailings) and four are not (Bhopal — chemical; Rana Plaza and the Kansas City Hyatt — structural; Tampomas II — maritime).

**Requirement:** each profile record carries `energyRelated: boolean`. On country pages, energy-related events render inline in the risk section. Non-energy events render in a visually separated block labeled *"Worst industrial disaster (not energy-related)"*. Presenting Rana Plaza next to electricity generation figures without that separation would be the single most misleading thing on the site.

The electrocution figures (deaths per 100k/yr) are also a **different metric from deaths per TWh** — they measure end-use electrical accidents, not generation. They live in their own labeled section, never on the same axis.

---

## 5. Calculation engine

`src/lib/engine.ts` — pure functions, no React, fully unit-tested. This is the heart of the app and must be independently verifiable.

### 5.1 Types

```ts
type Mix = Record<SourceSlug, number>;        // fractions, must sum to 1.0 ± 1e-6
type Band = { low: number; central: number; high: number };

type Result = {
  deaths:   { total: Band; counted: Band; modeled: Band; perSource: Record<SourceSlug, Band> };
  co2:      { totalMt: Band; gPerKwh: Band };
  land:     { km2: Band };
  cost:     { usdPerMwh: Band; annualUsdBn: Band };
  warnings: Warning[];
};
```

### 5.2 Core computation

For an annual demand `D` (TWh) and mix `M`:

```
generation_s   = D × M[s]
deaths_s       = generation_s × deathRate[s]          // per band
co2_s          = generation_s × 1e9 × lifecycleCO2[s] / 1e12   // → Mt
land_s         = generation_s × 1e3 × landUse[s] / 1e6         // → km²
cost_s         = generation_s × 1e6 × lcoe[s]                  // → USD
```

Bands propagate independently: `low` from all lows, `high` from all highs. **This is deliberately conservative** — it treats source uncertainties as perfectly correlated, which widens the band. Disclose this in `/methodology`; do not quietly use quadrature.

### 5.3 Warnings the engine must emit

These fire as UI callouts, not console logs. They are the mechanism by which the tool stays honest without editorializing.

| ID | Trigger | Message |
|---|---|---|
| `W_HYDRO_BANQIAO` | hydro share > 0 | Hydro's global death rate is <cite index="3-1">1.3 per TWh, almost entirely driven by the 1975 Banqiao Dam failure; excluding it, the rate is about 0.04 — comparable to nuclear, solar, and wind</cite>. Offers a toggle to recompute both ways. |
| `W_LOW_TIER_OVERLAP` | result differences rest on nuclear/wind/solar spread | These three cannot be reliably ranked against each other; their uncertainty ranges overlap. |
| `W_COAL_VINTAGE` | coal or oil share > 0 | Fossil death rates derive from a 2007 study using European pollution controls. OWID notes that <cite index="3-1">a global average for coal could plausibly run from 93 to 224 deaths per TWh</cite>. |
| `W_NUCLEAR_LNT` | nuclear share > 0 | Nuclear cancer deaths are <cite index="6-1">calculated theoretically using the linear no-threshold model, which assumes deaths scale directly with radiation dose and that no exposure level is safe</cite>. This is a contested assumption. |
| `W_NO_STORAGE` | variable renewables > 0.6 | This tool does not model reliability, storage, or transmission. A mix that looks fine here may not keep the lights on. |
| `W_MISSING_DATA` | any coefficient null | Named dimension unavailable for named source; that dimension is omitted rather than zeroed. |

**A null coefficient is never treated as zero.** Ever. It renders as "no data" and excludes the source from that dimension's total, with the exclusion stated.

---

## 6. Page specifications

### 6.1 `/` — Home

**Job:** rank the eight sources visually in under ten seconds.

**Hero (the signature element — see §8.3):** the *risk rule*. A single horizontal logarithmic axis running nearly full-bleed, from 0.01 to 1000 deaths/TWh. Each of the eight sources sits on it as a labeled range bar — a bar, not a dot, because the ranges are the honest object. Solid/hatched segments show counted vs. modeled. No color valence.

This is the whole hero. No stat cards, no gradient, no "big number with small label."

**Below the fold:**
- One sentence of orientation, no more than 25 words
- Three entry cards: *Compare the sources* → `/sources` · *Build a grid* → `/build` · *Find your country* → `/countries`
- A "start here if this is new to you" link to `/how-we-count`

**Explicitly banned from this page:** any sentence that draws a conclusion.

### 6.2 `/how-we-count` — The explainer

**Job:** make the rest of the site legible to a non-expert. Written at roughly an 8th-grade reading level. Modeled directly on Optimize's *How it works* page, which handles this well.

Sections:
1. **What a terawatt-hour is** — anchored to something concrete: roughly the annual electricity use of ~150,000 people in the EU, which is the framing OWID's own comparisons use.
2. **Why we divide by energy, not count totals** — the crux. Coal kills more people than solar partly because coal generates vastly more electricity. Per-TWh normalization is what makes the comparison mean anything.
3. **Two very different kinds of death** — the counted/modeled distinction, introduced with the hatch pattern so the visual language is learned here and recognized everywhere after.
4. **Accidents are the small part** — for fossil fuels, air pollution dominates; OWID notes <cite index="6-1">chronic effects account for between 88% and 99% of total deaths</cite>.
5. **What "lifecycle" includes** — mining, construction, operation, waste. Why solar isn't zero: <cite index="3-1">a small number of deaths occur in supply chains — helicopter collisions with turbines, fires during installation, drownings at offshore wind sites</cite>.
6. **Where these numbers are weakest** — vintage, geography, model dependence. Links to `/methodology`.
7. **Glossary** — TWh, capacity factor, lifecycle emissions, LNT, attributable death. Same pattern as Optimize's terms section.

### 6.3 `/sources` and `/sources/[slug]`

**Index:** the eight sources on the shared risk rule (same component as the hero, reused — consistency of scale across the site is a core affordance). Sort control: by death rate, CO₂, land, cost, or alphabetical. Alphabetical is available specifically so a user can escape any ranking.

**Detail page** — fixed section order for all eight, so they're comparable:
1. Name, one-line description, its position on the risk rule
2. Four-dimension summary (deaths / CO₂ / land / cost), each as a range with source ref
3. **How it kills** — the actual mechanisms, plainly. Mining accidents, particulates, dam failure, radiation, installation falls.
4. **What dominates the number** — is this driven by one catastrophe or by chronic diffuse harm? This is the most valuable section on the page and the one most sites omit.
5. **Notable events** — from Tier C where available
6. **What the estimate doesn't capture** — per-source limitations
7. **Sources** — full citations
8. "Put this in a grid →" `/build?mix=...` prefilled at 100% this source

### 6.4 `/build` — Grid builder

**Job:** let someone feel the tradeoffs by moving them.

**Inputs:**
- Eight sliders, one per source, in percent
- **Auto-normalization:** moving one slider proportionally rebalances the others so the mix always sums to 100%. Never let a user sit in an invalid state; never show a "doesn't add up" error.
- A lock toggle per source (pin it, redistribute among the unlocked)
- Annual demand input (TWh), defaulting to world total, with a country picker that also sets the mix
- Preset buttons: *World average*, *France*, *United States*, *China*, *Norway*, *100% coal*, *100% solar* — chosen to span the space, not to make a point

**Outputs — four panels, equal visual weight.** This equality is a neutrality requirement: deaths must not be styled as more important than cost.

| Panel | Content |
|---|---|
| Deaths | Annual total as a range; stacked bar by source; counted/modeled split; "≈ 1 death per X TWh" |
| CO₂ | Mt/yr and gCO₂eq/kWh, both as ranges |
| Land | km², with a comparison anchor (e.g. "≈ the area of ___") |
| Cost | USD/MWh average and annual total |

**Comparison mode:** hold a mix as "A," build "B," see deltas. Diffs render as signed ranges, and the UI states plainly when a delta is smaller than the uncertainty band — a genuinely important honesty feature that almost no comparison tool implements.

**State in URL:** `/build?mix=coal:30,gas:25,nuclear:20,wind:15,solar:10&demand=4200&yr=2024`. Fully shareable, no backend.

**Warning surface:** engine warnings from §5.3 appear in a persistent strip below the outputs, not as dismissible toasts. They are part of the result, not an interruption.

### 6.5 `/countries` and `/countries/[iso]`

**Index:**
- Choropleth world map. **Default coloring is electricity generation per capita, not risk** — coloring a map by death rate on first load would be an editorial choice about what matters. Dropdown lets the user re-color by any dimension.
- Sortable table beneath: country, generation, mix summary sparkline, estimated deaths from generation, CO₂ intensity
- Search-as-you-type
- Data vintage badge per row (countries have different latest-complete years)

**Detail page:**
1. Header: flag, name, latest year, population
2. **Electricity mix** — donut or stacked bar, per-source TWh and share
3. **Per-capita context** — kWh/person/yr against world and regional medians
4. **Estimated annual deaths from generation** — applying the coefficients to this country's actual mix. Prominently flagged as **applying global-average rates to a national mix**, which is a real methodological weakness: OWID notes death rates genuinely vary by country because <cite index="3-1">plants sited closer to urban centers expose more people to pollution</cite>. Say this on every country page.
5. **"Open this mix in the builder →"** — the connective tissue between the two tools
6. **Country profile (10 countries only)** — from the spreadsheet: electrocution rate, and the disaster narrative, correctly partitioned per §4.2
7. Data vintage and sources

### 6.6 `/data`

Every table on the site, rendered and downloadable as CSV/JSON: source coefficients with full provenance, country mix, the ten profiles, and a link to OWID's upstream files. Include the exact `owid-energy-data.csv` fetch date and file hash.

### 6.7 `/methodology`

The credibility page. Sections:
1. What this site computes, in formulas
2. Every coefficient, its value, its band, its citation, its vintage
3. **Known limitations** — written by us, as a list, unhedged (§7.4)
4. Uncertainty propagation approach and why it's conservative
5. Changelog of data updates
6. How to report an error, with a direct link

---

## 7. Content requirements

### 7.1 Voice

Plain, declarative, unhurried. Sentence case. Active voice. Define a term the first time it appears on each page — people arrive from search, not from the home page.

### 7.2 Prohibited constructions

- Conclusion language: "clearly," "the data shows we should," "surprisingly," "despite common perception"
- Reassurance or alarm: "safe," "dangerous," "shockingly," "only"
- Comparative framing that implies a verdict: "X times safer than"
- Any sentence a reader could quote as the site taking a side

Permitted: "X is Y deaths per TWh; Z is W deaths per TWh." Let the arithmetic be the reader's.

### 7.3 Required disclosures (must appear where relevant, verbatim in substance)

- Fossil rates derive from a 2007 study; more recent air-pollution research suggests higher impacts
- Nuclear figures use the linear no-threshold model, which is contested
- Hydro's global rate is dominated by a single 1975 event
- Nuclear, wind, and solar cannot be reliably ranked against one another
- Country-level estimates apply global-average rates and will misstate any specific country
- This site does not model grid reliability

### 7.4 The limitations section

Written before launch, not after criticism. At minimum: data vintage; European baseline generalized globally; LNT model dependence; correlated-uncertainty propagation; no reliability/storage modeling; no supply-chain labor conditions; no waste-disposal long tail; no wartime or terrorism scenarios; land-use figures that vary enormously by siting.

---

## 8. Visual design

### 8.1 Direction

**Actuarial ledger meets one-line diagram.** The subject's own artifacts are survey staffs, substation placards, dispatch tables, and actuarial mortality tables — measured, unglamorous instruments. The design should feel like a well-set reference document, not a dashboard and not a campaign.

Deliberately avoided: warm cream + serif + terracotta; near-black + acid accent; broadsheet pastiche. Also avoided, and more importantly: any traffic-light palette, which would violate N1.

### 8.2 Tokens

```
--ground     #EFF0EC   cool paper, slightly green-grey
--ground-alt #E4E6E0   panel fill
--ink        #16181A   text
--ink-soft   #5C6169   secondary text
--rule       #C2C6BC   hairlines, axes
--signal     #24457A   interactive affordances ONLY — never data
--hatch      45° 1px lines at --ink 22%, for modeled values
```

**Data color rule:** the eight sources get eight steps from a single perceptually-uniform sequential ramp (light→dark), assigned **alphabetically**, not by magnitude. Alphabetical assignment is the point — it guarantees no hue can be read as a verdict.

### 8.3 Signature element: the risk rule

One horizontal logarithmic axis, consistent across the entire site — same range, same tick positions, same pixel scale — on the home page, the sources index, every source page, and every country page. It functions as a measuring instrument the user learns once and then reads everywhere. Sources, countries, and custom mixes all plot against the identical rule, so cross-page comparison is immediate and requires no re-orientation.

This is the one bold move. Everything else stays quiet.

### 8.4 Typography — the ladder is encoded in the typefaces

| Role | Face | Used for |
|---|---|---|
| Display / nav | **Archivo Expanded** (600) | Headings, labels, chrome — signage register |
| Reading | **Literata** (400/500) | Explainer and deep-dive prose — rungs 2 and 5 |
| Data | **IBM Plex Mono** (400/500) | Every number, axis, table cell, code |

Numbers are *always* mono, everywhere, without exception. A figure in running prose is still mono. This makes data visually separable from argument at a glance — which is itself a neutrality mechanism, since it keeps quantities from blending into rhetoric.

### 8.5 Motion

Minimal and functional. Slider→chart updates are the only continuous animation and must be interruptible. Respect `prefers-reduced-motion`. No scroll-triggered reveals — they delay information, and this is a reference site.

---

## 9. Technical specification

### 9.1 Stack

- **Next.js 15**, App Router, TypeScript strict
- **Tailwind v4**, tokens as CSS variables
- **Visualization:** hand-rolled SVG for the risk rule (precise control is essential); Recharts or Visx for standard charts; `react-simple-maps` or a TopoJSON + D3-geo path for the choropleth
- **Static export** — no server runtime needed
- **Vercel** deploy, same as Optimize
- **Vitest** for the engine

### 9.2 Structure

```
src/
  app/            (routes per §3.1)
  components/
    RiskRule.tsx          ← signature; used on 4+ page types
    RangeBar.tsx          ← counted/modeled hatch logic
    MixSliders.tsx
    ResultPanel.tsx
    WarningStrip.tsx
    SourceRef.tsx         ← inline citation chip
    ScaleToggle.tsx
    CountryMap.tsx
  lib/
    engine.ts             ← pure, tested
    engine.test.ts
    format.ts             ← number formatting, single source of truth
    urlState.ts
  data/
    sources.json          Tier A
    countries.json        Tier B (generated, committed)
    profiles.json         Tier C
    citations.json        every source, keyed by id
    meta.json             vintages, fetch dates, hashes
scripts/
  fetch-owid.ts
  validate-data.ts
```

### 9.3 Build-blocking data validation

`scripts/validate-data.ts` runs in CI and fails the build on:
- Any `status: "TO_SOURCE"` remaining in `sources.json`
- Any coefficient without a resolvable `source` id in `citations.json`
- Any band where `low > central > high` is violated
- Any country whose mix shares sum outside 100% ± 0.5%
- Any `countries.json` older than 400 days (a staleness alarm)

This is what operationalizes success criterion S2. A number cannot reach production without a citation.

### 9.4 Performance & accessibility

- `countries.json` split per-country for detail routes; index loads a slim summary array
- Choropleth topology lazy-loaded
- WCAG 2.1 AA: keyboard-operable sliders with arrow-key steps, `aria-valuetext` reading the human-readable value, visible focus, and — critically — **every chart has an adjacent accessible table** (never a chart alone)
- Color-blind safe by construction: the palette is single-hue sequential, and counted/modeled is encoded by *pattern*, not color

---

## 10. Build phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Data** | Tier A hand-entry with citations; `fetch-owid.ts`; validator | Validator passes; every coefficient sourced |
| **1. Engine** | `engine.ts` + tests + all six warnings | Test coverage on bands, nulls, warning triggers |
| **2. Skeleton** | Routes, layout, tokens, typography, `RiskRule` | Risk rule renders identically on 3 pages |
| **3. Sources** | `/sources`, 8 detail pages, `/how-we-count` | All prose written and reviewed against §7.2 |
| **4. Builder** | `/build`, sliders, four panels, URL state, warnings | Shareable URL round-trips exactly |
| **5. Countries** | `/countries`, map, ~200 detail pages, spreadsheet overlay | Non-energy disasters correctly partitioned |
| **6. Verify** | `/data`, `/methodology`, `/about` | Limitations section written |
| **7. Polish** | A11y audit, mobile, perf, cross-tool linking | 375px usable; Lighthouse a11y 100 |

Phases 0 and 1 before any UI. The engine is the product; the pages are how people touch it.

---

## 11. Open questions

1. **Land use and LCOE need primary sources.** Van Zalk & Behrens (2018) is the standard land-use reference; Lazard's LCOE+ is the standard cost reference. Both need the current edition pulled and entered before Phase 0 can exit. Until then they're `TO_SOURCE`.
2. **Lifecycle CO₂** should come from IPCC AR5 Annex III medians — needs verification against the current AR6 figures where available.
3. **Does the builder need a reliability dimension?** Currently a warning (`W_NO_STORAGE`) rather than a modeled output. A fifth panel would be more honest but pulls the scope toward Optimize's territory. Recommend shipping as a warning in v1.
4. **Should `/countries` estimates use regional death-rate adjustments** rather than global averages? More accurate, but requires a defensible adjustment method and adds a large methodological surface. Recommend global averages + prominent disclosure in v1.
5. **Domain and name.** "Per Terawatt-Hour" is descriptive and neutral; alternatives worth testing include "Deaths per TWh" (clearer, more morbid) and "The Risk Rule" (references the signature element).
