"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { tokens } from "@/lib/brand/tokens";

// Interactive ROI calculator. Anchored to the productized Regular tier per
// `project_stripe_both_surfaces.md` (simplified 2026-05-12 — Plus/Max are
// no longer surfaced; anything beyond Regular routes to /custom). Required
// on the marketing pricing surface per `project_pricing_value_anchor.md`
// §"Marketing site must include" item #2 and per
// `project_agentplain_mission_and_positioning.md` Q7.
//
// Inputs:
//   - seats (1 → 99; 100+ moves to /custom enterprise per stripe_both_surfaces)
//   - hours/week the practitioner spends on systematic ops work
//   - hourly rate (productive-hour opportunity cost, not W2 cost)
//
// Outputs:
//   - monthly subscription cost at the current seat band
//   - monthly value recovered (hours × rate × 4.3 weeks × seats)
//   - ROI multiple (value ÷ subscription)
//
// Per-seat ladder (Regular only):
//   $199 → $179 → $149 → $119 → $99
//
// Per `feedback_no_silent_vendor_lock.md` + `feedback_runner_portability.md`,
// this is a pure client component — no SDK calls, no analytics-side effects,
// no third-party dependencies. The math is documented inline so a customer
// can audit it from view-source.

interface TierBand {
  /** Inclusive seat-count lower bound for this band. */
  min: number;
  /** Per-seat price for this band, in USD. */
  price: number;
}

// Regular per-seat ladder from `project_stripe_both_surfaces.md` (locked
// 2026-05-09; simplified to single-tier surfacing 2026-05-12).
const LADDER: TierBand[] = [
  { min: 1, price: 199 },
  { min: 2, price: 179 },
  { min: 10, price: 149 },
  { min: 25, price: 119 },
  { min: 50, price: 99 },
];

function priceForSeats(seats: number): number {
  // Walk from highest min downward — first match is the active band.
  for (let i = LADDER.length - 1; i >= 0; i--) {
    if (seats >= LADDER[i].min) return LADDER[i].price;
  }
  return LADDER[0].price;
}

// Conservative default inputs aligned with `project_pricing_value_anchor.md`
// (8-15 hr/wk on systematic ops; $75-$150/hr productive-hour rate). We pick
// the lower-mid of each so the headline ROI reads conservatively, and the
// customer can dial it up if their own numbers are higher.
const DEFAULT_HOURS = 10;
const DEFAULT_RATE = 100;
const WEEKS_PER_MONTH = 4.3;

export default function RoiCalculator() {
  const [seats, setSeats] = useState<number>(1);
  const [hours, setHours] = useState<number>(DEFAULT_HOURS);
  const [rate, setRate] = useState<number>(DEFAULT_RATE);

  const result = useMemo(() => {
    const clampedSeats = Math.min(Math.max(seats, 1), 99);
    const perSeat = priceForSeats(clampedSeats);
    const subscription = perSeat * clampedSeats;
    const valuePerSeat = hours * rate * WEEKS_PER_MONTH;
    const value = valuePerSeat * clampedSeats;
    const roi = subscription > 0 ? value / subscription : 0;
    const overEnterprise = seats > 99;
    return {
      perSeat,
      subscription,
      valuePerSeat,
      value,
      roi,
      overEnterprise,
      clampedSeats,
    };
  }, [seats, hours, rate]);

  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-[1fr_1fr]">
      {/* Inputs */}
      <form
        className="bg-paper p-6 md:p-8"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="eyebrow mb-4">Your numbers</p>

        <Field
          label="Seats"
          unit="practitioners"
          id="roi-seats"
          value={seats}
          min={1}
          max={99}
          step={1}
          onChange={setSeats}
          helper="Solo practitioner = 1. Full firm headcount = N. 100+ → /custom."
        />

        <Field
          label="Hours/week per practitioner on systematic ops"
          unit="hours"
          id="roi-hours"
          value={hours}
          min={0}
          max={40}
          step={1}
          onChange={setHours}
          helper="Email triage, lead follow-up, scheduling, drafting boilerplate, status reports. Conservative: 8–15."
        />

        <Field
          label="Productive-hour rate"
          unit="$/hour"
          id="roi-rate"
          value={rate}
          min={25}
          max={500}
          step={5}
          onChange={setRate}
          helper="Opportunity cost when the practitioner does relationship/judgment work instead. Not W2 cost."
        />
      </form>

      {/* Results */}
      <div className="bg-paper p-6 md:p-8">
        <p className="eyebrow mb-4">Monthly outlook · {tokens.wordmark}</p>

        <Row
          label="Subscription cost"
          value={fmtDollars(result.subscription)}
          detail={`${result.clampedSeats} seat${result.clampedSeats > 1 ? "s" : ""} @ ${fmtDollars(result.perSeat)}/seat · first month free`}
        />
        <Row
          label="Value recovered"
          value={fmtDollars(result.value)}
          detail={`${hours} hr/wk × $${rate}/hr × ${WEEKS_PER_MONTH} wks × ${result.clampedSeats} seat${result.clampedSeats > 1 ? "s" : ""}`}
        />

        <div className="my-6 h-px w-full bg-rule" />

        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          ROI multiple
        </p>
        <p className="mt-3 font-display text-6xl leading-none text-ink md:text-7xl">
          {result.roi >= 1 ? `${formatRoi(result.roi)}x` : "—"}
        </p>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-soft">
          Value delivered per dollar of subscription, at the inputs above. ROI
          range typically 15x to 110x per
          {" "}
          <code className="font-mono text-[12px] text-mute">
            project_pricing_value_anchor.md
          </code>
          .
        </p>

        {result.overEnterprise ? (
          <div className="mt-5 border border-rule bg-paper-deep p-4">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              100+ seats
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink">
              Goes beyond what Regular handles plug-and-play. We scope these
              1:1 as a Custom engagement —{" "}
              <Link href="/custom" className="underline">
                build with us →
              </Link>
            </p>
          </div>
        ) : null}

        <p className="mt-6 font-mono text-[11px] leading-relaxed text-mute">
          Sources: per-seat ladder from
          {" "}
          <code className="text-[11px]">project_stripe_both_surfaces.md</code>.
          {" "}
          Value math from
          {" "}
          <code className="text-[11px]">project_pricing_value_anchor.md</code>.
          {" "}
          First month is $0 across every seat band.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  unit,
  id,
  value,
  min,
  max,
  step,
  onChange,
  helper,
}: {
  label: string;
  unit: string;
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  helper?: string;
}) {
  return (
    <div className="mb-6">
      <label
        htmlFor={id}
        className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute"
      >
        {label}
      </label>
      <div className="mt-2 flex items-baseline gap-3">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
          className="w-32 border border-rule bg-paper px-3 py-2 font-display text-2xl text-ink focus:border-ink focus:outline-none"
        />
        <span className="text-[13px] text-mute">{unit}</span>
      </div>
      {helper ? (
        <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-mute">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl leading-none text-ink">
        {value}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-mute">{detail}</p>
    </div>
  );
}

function fmtDollars(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatRoi(n: number): string {
  if (n < 10) return n.toFixed(1);
  return Math.round(n).toString();
}
