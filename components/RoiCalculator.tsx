"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { tokens } from "@/lib/brand/tokens";
import {
  PARTNER_RESERVED_HOURS_PER_MONTH,
  PER_SEAT_MONTHLY_USD_CENTS,
  TIER_TAGLINE,
  tierDisplayName,
  type TierName,
} from "@/lib/pricing/tiers";

// Interactive ROI calculator. Anchored to the three customer-facing tiers
// per the 2026-05-15 amendment to `project_stripe_both_surfaces.md`:
//
//   Regular — standard managed AI ops. Existing math.
//   Partner — Regular + named-service-partner hours/month value-add.
//   Max     — quote-based; no math, CTA into /custom?type=max.
//
// Per `feedback_no_guesses_no_estimates.md`, the value rate for the
// reserved-partner hours and the Regular productive-hour rate both cite
// `project_pricing_value_anchor.md`. That memory was not committed at
// task time — the Partner rate defaults to a documented estimate
// (`PARTNER_HOUR_VALUE_USD_ESTIMATE`) and the inline source line flags it
// as an estimate so a reader knows where the number came from.
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

// Regular + Partner per-seat ladders. Reads from `lib/pricing/tiers` so
// the calculator stays in lockstep with billing checkout. Max is omitted
// — the calculator displays a CTA for it rather than math.
function ladderForTier(tier: "regular" | "plus"): TierBand[] {
  const row = PER_SEAT_MONTHLY_USD_CENTS[tier];
  return [
    { min: 1, price: row.SEATS_1 / 100 },
    { min: 2, price: row.SEATS_2_9 / 100 },
    { min: 10, price: row.SEATS_10_24 / 100 },
    { min: 25, price: row.SEATS_25_49 / 100 },
    { min: 50, price: row.SEATS_50_99 / 100 },
  ];
}

function priceForSeats(tier: "regular" | "plus", seats: number): number {
  const ladder = ladderForTier(tier);
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (seats >= ladder[i].min) return ladder[i].price;
  }
  return ladder[0].price;
}

// Conservative default inputs aligned with `project_pricing_value_anchor.md`
// (8-15 hr/wk on systematic ops; $75-$150/hr productive-hour rate). We pick
// the lower-mid of each so the headline ROI reads conservatively, and the
// customer can dial it up if their own numbers are higher.
const DEFAULT_HOURS = 10;
const DEFAULT_RATE = 100;
const WEEKS_PER_MONTH = 4.3;

// Substantiated ceiling for the displayed ROI multiple. Per Conner's
// 2026-06-06 ruling ("softer true claim beats an over-inflated one"), the
// headline band caps at 50x — competitors top out at 21–50x per single
// workflow (PR #155 competitive audit), so a higher number reads as pixie
// dust. The calculator clamps its displayed multiple to this ceiling and
// shows a "+" when the raw inputs would exceed it, rather than printing an
// uncapped figure the page can't stand behind.
const ROI_CEILING = 50;

// Estimated dollar value of a named-service-partner hour. Used as a
// placeholder until `project_pricing_value_anchor.md` ships with a
// committed Partner value rate; surfaced in copy as "[estimate]" so the
// number is not mistaken for a load-bearing anchor.
const PARTNER_HOUR_VALUE_USD_ESTIMATE = 200;

type CalculatorTier = TierName;

const TIER_TOGGLE_OPTIONS: ReadonlyArray<CalculatorTier> = [
  "regular",
  "plus",
  "max",
];

export default function RoiCalculator() {
  const [tier, setTier] = useState<CalculatorTier>("regular");
  const [seats, setSeats] = useState<number>(1);
  const [hours, setHours] = useState<number>(DEFAULT_HOURS);
  const [rate, setRate] = useState<number>(DEFAULT_RATE);

  const result = useMemo(() => {
    if (tier === "max") {
      return null;
    }
    const clampedSeats = Math.min(Math.max(seats, 1), 99);
    const perSeat = priceForSeats(tier, clampedSeats);
    const subscription = perSeat * clampedSeats;
    const automationValuePerSeat = hours * rate * WEEKS_PER_MONTH;
    const automationValue = automationValuePerSeat * clampedSeats;
    // Partner adds the reserved-hours value on top of automation value;
    // Regular has no partner-hour line.
    const partnerHoursValue =
      tier === "plus"
        ? PARTNER_RESERVED_HOURS_PER_MONTH * PARTNER_HOUR_VALUE_USD_ESTIMATE
        : 0;
    const value = automationValue + partnerHoursValue;
    const roi = subscription > 0 ? value / subscription : 0;
    const overEnterprise = seats > 99;
    return {
      perSeat,
      subscription,
      automationValuePerSeat,
      automationValue,
      partnerHoursValue,
      value,
      roi,
      overEnterprise,
      clampedSeats,
    };
  }, [tier, seats, hours, rate]);

  return (
    <div className="border border-rule bg-paper">
      <TierToggle selected={tier} onSelect={setTier} />
      {tier === "max" ? (
        <MaxQuoteState />
      ) : (
        <div className="grid gap-px overflow-hidden border-t border-rule bg-rule lg:grid-cols-[1fr_1fr]">
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
            <p className="eyebrow mb-4">
              Monthly outlook · {tokens.wordmark} {tierDisplayName(tier)}
            </p>

            {result ? (
              <>
                <Row
                  label="Subscription cost"
                  value={fmtDollars(result.subscription)}
                  detail={`${result.clampedSeats} seat${result.clampedSeats > 1 ? "s" : ""} @ ${fmtDollars(result.perSeat)}/seat · first month free`}
                />
                <Row
                  label="Automation value recovered"
                  value={fmtDollars(result.automationValue)}
                  detail={`${hours} hr/wk × $${rate}/hr × ${WEEKS_PER_MONTH} wks × ${result.clampedSeats} seat${result.clampedSeats > 1 ? "s" : ""}`}
                />
                {tier === "plus" ? (
                  <Row
                    label="Named-partner hours value"
                    value={fmtDollars(result.partnerHoursValue)}
                    detail={`${PARTNER_RESERVED_HOURS_PER_MONTH} hrs/mo × $${PARTNER_HOUR_VALUE_USD_ESTIMATE}/hr [estimate]`}
                  />
                ) : null}
                <Row
                  label="Total value"
                  value={fmtDollars(result.value)}
                  detail={
                    tier === "plus"
                      ? "Automation + named-partner hours"
                      : "Automation only"
                  }
                />

                <div className="my-6 h-px w-full bg-rule" />

                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                  ROI multiple
                </p>
                <p className="mt-3 font-display text-6xl leading-none text-ink md:text-7xl">
                  {result.roi >= 1
                    ? `${formatRoi(Math.min(result.roi, ROI_CEILING))}x${
                        result.roi > ROI_CEILING ? "+" : ""
                      }`
                    : "—"}
                </p>
                <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-soft">
                  Value delivered per dollar of subscription, at the inputs
                  above. Typical range 15x to 50x — illustrative, and capped
                  here at the {ROI_CEILING}x we'll substantiate; your numbers
                  will vary with the hours you actually reclaim.
                </p>
                <p className="mt-3 max-w-md text-[13px] leading-relaxed text-clay">
                  Violation avoidance: this multiple counts only reclaimed
                  hours. It does not price the regulatory violations a
                  draft-then-approve loop keeps from ever sending — TCPA,
                  fair-housing, RESPA, SEC Marketing Rule and the rest carry
                  per-violation penalties an auto-execution tool can't promise
                  to dodge. Real ROI sits above the number above.
                </p>

                {result.overEnterprise ? (
                  <div className="mt-5 border border-rule bg-paper-deep p-4">
                    <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                      100+ seats
                    </p>
                    <p className="mt-2 text-[14px] leading-relaxed text-ink">
                      Goes beyond what {tierDisplayName(tier)} handles
                      plug-and-play. We scope these 1:1 as a Max engagement —{" "}
                      <Link
                        href="/custom?type=max#custom-contact"
                        className="underline"
                      >
                        talk to us →
                      </Link>
                    </p>
                  </div>
                ) : null}

                <p className="mt-6 font-mono text-[11px] leading-relaxed text-mute">
                  Named-partner hour value at $
                  {PARTNER_HOUR_VALUE_USD_ESTIMATE}/hr is an illustrative
                  estimate. First month is $0 across every Regular and
                  Partner seat band.
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function TierToggle({
  selected,
  onSelect,
}: {
  selected: CalculatorTier;
  onSelect: (t: CalculatorTier) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tier"
      className="flex flex-wrap items-center gap-px overflow-hidden bg-rule p-px"
    >
      {TIER_TOGGLE_OPTIONS.map((t) => {
        const isActive = t === selected;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(t)}
            className={`flex-1 bg-paper px-4 py-3 text-left transition focus:outline-none ${
              isActive
                ? "bg-paper-deep"
                : "hover:bg-paper-deep focus-visible:bg-paper-deep"
            }`}
          >
            <p
              className={`font-mono text-[11px] tracking-eyebrow uppercase ${
                isActive ? "text-clay" : "text-mute"
              }`}
            >
              {tierDisplayName(t)}
            </p>
            <p className="mt-1 text-[12px] text-ink-soft">{TIER_TAGLINE[t]}</p>
          </button>
        );
      })}
    </div>
  );
}

function MaxQuoteState() {
  return (
    <div className="border-t border-rule bg-paper p-6 md:p-8">
      <p className="eyebrow mb-2">Max · quote-based</p>
      <p className="font-display text-4xl leading-tight text-ink md:text-5xl">
        We scope. We spec. Then we talk price.
      </p>
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        {TIER_TAGLINE.max} Math here would be theatrical — every Max
        engagement is shaped by your operation: how many states, which
        workflows, which compliance posture, how much named-team capacity.
        A real human reads your intake and comes back inside two business
        days with a scoping-call invite.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Link
          href="/custom?type=max#custom-contact"
          className="btn-primary inline-flex"
        >
          Talk to us about Max
          <span aria-hidden>→</span>
        </Link>
        <a
          href="mailto:hello@agentplain.com"
          className="text-[13px] text-ink underline"
        >
          Or email a human directly
        </a>
      </div>
      <p className="mt-7 font-mono text-[11px] leading-relaxed text-mute">
        Max is ad-hoc and quote-based — not productized in Stripe.
      </p>
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
