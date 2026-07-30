import Link from 'next/link';
import eiaMeta from '@/data/eia-meta.json';
import { DEFAULT_LEAD_TIME, DEFAULT_RETIREMENT_RAMP, DEFAULT_TECH_LIFE, type ModelTech } from '@/lib/model';
import { DEFAULT_AVAILABILITY, DEFAULT_MARGINAL_COST, DEFAULT_STORAGE } from '@/lib/model-dispatch';
import { DEFAULT_CAPITAL_PER_KW, DEFAULT_ELCC, DEFAULT_LEARNING } from '@/lib/model-feedbacks';
import { HORIZON_WIDENING_PER_YEAR, TECH_META } from '@/lib/model-run';

export const metadata = {
  title: 'Model assumptions — Level',
  description: 'Every assumption in the US transition model, its default, its source or lack of one, and its sensitivity.',
};

// A visible mark distinguishing cited inputs from bare site assumptions
// (neutrality #2: every uncited assumption is flagged as such).
function Tag({ kind }: { kind: 'cited' | 'site' }) {
  const cited = kind === 'cited';
  return (
    <span
      className="mono"
      style={{
        fontSize: '0.66rem',
        padding: '0.1rem 0.4rem',
        borderRadius: 'var(--radius-pill)',
        whiteSpace: 'nowrap',
        border: '1px solid var(--rule-strong)',
        color: cited ? 'var(--accent)' : 'var(--ink-muted)',
        background: cited ? 'var(--accent-soft)' : 'var(--surface-2)',
      }}
    >
      {cited ? 'cited' : 'site assumption'}
    </span>
  );
}

const techLabel = (t: ModelTech) => TECH_META[t].label;

export default function AssumptionsPage() {
  const cf = eiaMeta.generationTwhByTech;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <p className="kicker">The model · assumptions</p>
      <h1 className="text-4xl">Every assumption, disclosed</h1>
      <p className="lede" style={{ maxWidth: '44rem' }}>
        The model turns decisions into a fleet and reports what it would produce and cost. Nothing here is settled by a
        citation. This page lists every input: its default, whether it rests on a published source or is a bare{' '}
        <b>site assumption</b>, and how sensitive the outputs are to it.
      </p>
      <p className="text-sm text-[var(--ink-soft)]">
        Base data: EIA {eiaMeta.baseYear}. Fleet reconciles to {(eiaMeta.nationalCapabilityMw / 1000).toFixed(0)} GW
        national net-summer capability, {eiaMeta.reconciliationDiffPct}% off. <Link href="/model">← Back to the model</Link>
      </p>

      <h2>1 · Base fleet & data</h2>
      <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Base fleet and data assumptions, with sources.</caption>
        <thead>
          <tr>
            <th scope="col">Input</th>
            <th scope="col">Default</th>
            <th scope="col">Source</th>
            <th scope="col">Sensitivity</th>
          </tr>
        </thead>
        <tbody>
          <Row
            k="Operating fleet"
            v={`EIA-860M, ${eiaMeta.generatorPeriod}, net-summer capacity`}
            tag="cited"
            s="Sets the whole starting point. Reconciled to EIA's national total within 2%."
          />
          <Row
            k="Capacity factors"
            v="Empirical, base-year generation ÷ (net-summer capacity × 8,760 h)"
            tag="cited"
            s="Drives generation from capacity. Uses year-end capacity, so fast-growing solar reads low."
          />
          <Row
            k="Gas CC vs peaker CF"
            v={`peaker ${eiaMeta.gasBlendedCf ? '0.12 (assumed)' : '0.12'}, CC = residual`}
            tag="site"
            s="National data can't split gas generation; peaker CF is assumed, CC reconciles the total."
          />
          <Row k="Load & VRE hourly shapes" v="EIA-930, base-year US48, seasonal 24-hour profiles" tag="cited" s="Sets dispatch timing — when solar and demand actually land." />
          <Row k="Demand base" v={`${eiaMeta.nationalGenerationTwh} TWh (base-year generation)`} tag="cited" s="Grown by the demand-growth knob; the single biggest driver of unserved energy." />
        </tbody>
      </table>
          </div>

      <h2>2 · Retirement & construction</h2>
      <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Retirement and construction assumptions, with sources.</caption>
        <thead>
          <tr>
            <th scope="col">Technology</th>
            <th scope="col">Service life (yr)</th>
            <th scope="col">Lead time (yr)</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(DEFAULT_TECH_LIFE) as ModelTech[]).map((t) => (
            <tr key={t}>
              <td>{techLabel(t)}</td>
              <td className="mono">{DEFAULT_TECH_LIFE[t]}</td>
              <td className="mono">{DEFAULT_LEAD_TIME[t]}</td>
            </tr>
          ))}
        </tbody>
      </table>
          </div>
      <p className="text-sm text-[var(--ink-soft)]">
        <Tag kind="site" /> Service lives are typical, not measured per plant; lead times are roughly Lazard's published
        construction times. Plants already past their nominal life at the start are retired on a{' '}
        <b>{DEFAULT_RETIREMENT_RAMP}-year ramp</b> (oldest first) rather than all at once, since they are demonstrably
        still operating in the base year. <b>Sensitivity: high.</b> Shorter lives or the “end-of-life” policy retire the
        thermal fleet faster, opening a firm-capacity gap that build rates must fill.
      </p>

      <h2>3 · Hourly dispatch</h2>
      <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Hourly dispatch assumptions, with sources.</caption>
        <thead>
          <tr>
            <th scope="col">Assumption</th>
            <th scope="col">Default</th>
            <th scope="col">Source</th>
            <th scope="col">Sensitivity</th>
          </tr>
        </thead>
        <tbody>
          <Row
            k="Merit order (marginal $/MWh)"
            v={(Object.keys(DEFAULT_MARGINAL_COST) as ModelTech[]).map((t) => `${techLabel(t)} $${DEFAULT_MARGINAL_COST[t]}`).join(', ')}
            tag="site"
            s="Decides which flexible plant runs first. Affects the dispatch mix, not total unserved energy."
          />
          <Row
            k="Availability derate"
            v={(Object.keys(DEFAULT_AVAILABILITY) as ModelTech[]).map((t) => `${techLabel(t)} ${DEFAULT_AVAILABILITY[t]}`).join(', ')}
            tag="site"
            s="Max hourly output share for firm plant. Directly sets firm capacity and reserve margin."
          />
          <Row k="Storage duration" v={`${DEFAULT_STORAGE.durationHours} h per MW`} tag="site" s="How long batteries sustain output. Longer duration cuts evening shortfalls." />
          <Row k="Storage round-trip efficiency" v={`${DEFAULT_STORAGE.roundTripEfficiency}`} tag="site" s="Energy kept per charge/discharge cycle. Second-order for reliability." />
          <Row k="Baseload treatment" v="Nuclear, hydro, geothermal, biomass run flat at their CF" tag="site" s="Simplification: hydro's peaking flexibility is not credited (conservative for reliability)." />
        </tbody>
      </table>
          </div>

      <h2>4 · Feedbacks</h2>
      <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Feedback assumptions, with sources.</caption>
        <thead>
          <tr>
            <th scope="col">Assumption</th>
            <th scope="col">Default</th>
            <th scope="col">Source</th>
            <th scope="col">Sensitivity</th>
          </tr>
        </thead>
        <tbody>
          <Row
            k="Solar learning rate"
            v={`${Math.round((DEFAULT_LEARNING.solar?.learningRate ?? 0) * 100)}% per doubling`}
            tag="cited"
            s="Published solar experience curve. Sets how far solar capital falls with deployment."
          />
          <Row
            k="Battery learning rate"
            v={`${Math.round((DEFAULT_LEARNING.battery?.learningRate ?? 0) * 100)}% per doubling`}
            tag="cited"
            s="Published battery experience curve. Adjustable in the controls."
          />
          <Row
            k="Solar / battery base capital"
            v={`$${DEFAULT_LEARNING.solar?.baseCostPerKw}/kW, $${DEFAULT_LEARNING.battery?.baseCostPerKw}/kW`}
            tag="site"
            s="NREL ATB-class reference. Anchors the capital integral; moves cumulative-capital totals."
          />
          <Row
            k="ELCC of solar"
            v={`${DEFAULT_ELCC.solar?.peak} at low penetration → ${DEFAULT_ELCC.solar?.floor} at high`}
            tag="cited"
            s="Fitted to the published marginal ELCC spread across MISO, CAISO, SPP, PJM, ERCOT, NYISO."
          />
          <Row
            k="ELCC of wind / battery"
            v={`wind ${DEFAULT_ELCC.wind?.peak}→${DEFAULT_ELCC.wind?.floor}, battery ${DEFAULT_ELCC.battery?.peak}→${DEFAULT_ELCC.battery?.floor}`}
            tag="cited"
            s="Same framework; a 4-hour battery saturates the net-peak quickly, so its value falls fastest."
          />
          <Row
            k="Reference capital, other techs"
            v={`nuclear $${DEFAULT_CAPITAL_PER_KW.nuclear}/kW, gas CC $${DEFAULT_CAPITAL_PER_KW.gas_cc}/kW …`}
            tag="site"
            s="NREL ATB / Lazard-class. No learning applied; used only for the capital integral."
          />
        </tbody>
      </table>
          </div>

      <h2>5 · Uncertainty & impact coefficients</h2>
      <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Uncertainty and impact coefficients, with sources.</caption>
        <thead>
          <tr>
            <th scope="col">Assumption</th>
            <th scope="col">Default</th>
            <th scope="col">Source</th>
            <th scope="col">Sensitivity</th>
          </tr>
        </thead>
        <tbody>
          <Row
            k="Per-TWh coefficients (deaths, CO₂, land, cost)"
            v="Identical to the descriptive site"
            tag="cited"
            s="OWID, IPCC AR5 Annex III, van Zalk & Behrens 2018, Lazard LCOE+ v19.0. Never re-forked here."
          />
          <Row
            k="Horizon uncertainty widening"
            v={`+${Math.round(HORIZON_WIDENING_PER_YEAR * 100)} pts of half-band width per year`}
            tag="site"
            s="Structural uncertainty beyond the fixed coefficient band. Base year unwidened; ~+52% band at 2050."
          />
          <Row
            k="Fossil pollution-control anchor"
            v="Global central (adjustable: stringent / moderate / limited)"
            tag="cited"
            s="Re-anchors fossil death rates within their published range, as on the country pages."
          />
        </tbody>
      </table>
          </div>

      <h2>6 · Out of scope — stated, not modeled</h2>
      <p className="text-sm text-[var(--ink-soft)]">
        The model answers “what would this fleet produce and cost,” not “could this happen.” It does <b>not</b> model
        transmission and interconnection queues, electricity prices or market clearing, siting and permitting,
        manufacturing supply-chain limits, or policy feasibility. A scenario the model runs cleanly may be impossible for
        reasons entirely outside it.
      </p>

      <p className="text-sm text-[var(--ink-soft)]" style={{ marginTop: '1.5rem' }}>
        <Link href="/model">← Back to the model</Link> · <Link href="/methodology">Site methodology</Link> · <Link href="/sources">Sources</Link>
      </p>
    </main>
  );
}

function Row({ k, v, tag, s }: { k: string; v: string; tag: 'cited' | 'site'; s: string }) {
  return (
    <tr>
      <td style={{ fontWeight: 500 }}>{k}</td>
      <td className="mono" style={{ fontSize: '0.8rem' }}>
        {v}
      </td>
      <td>
        <Tag kind={tag} />
      </td>
      <td style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{s}</td>
    </tr>
  );
}
