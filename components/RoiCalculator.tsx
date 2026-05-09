"use client";

import { useMemo, useState } from "react";

const SEAT_BANDS: Array<{
  min: number;
  max: number;
  monthly: number;
  annual: number;
  label: string;
}> = [
  { min: 1, max: 1, monthly: 199, annual: 1990, label: "Solo" },
  { min: 2, max: 9, monthly: 169, annual: 1690, label: "2–9 seats" },
  { min: 10, max: 24, monthly: 139, annual: 1390, label: "10–24 seats" },
  { min: 25, max: 49, monthly: 109, annual: 1090, label: "25–49 seats" },
  { min: 50, max: 99, monthly: 79, annual: 790, label: "50–99 seats" },
];

function priceForSeats(seats: number): {
  perSeatMonthly: number;
  perSeatAnnual: number;
  band: string;
  enterprise: boolean;
} {
  if (seats >= 100) {
    return {
      perSeatMonthly: 0,
      perSeatAnnual: 0,
      band: "100+ — Enterprise",
      enterprise: true,
    };
  }
  const band = SEAT_BANDS.find((b) => seats >= b.min && seats <= b.max)!;
  return {
    perSeatMonthly: band.monthly,
    perSeatAnnual: band.annual,
    band: band.label,
    enterprise: false,
  };
}

const STACK_FLOOR_MONTHLY = 510;
const STACK_CEILING_MONTHLY = 1560;

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function RoiCalculator() {
  const [seats, setSeats] = useState(5);
  const [adminHours, setAdminHours] = useState(12);
  const [hourlyRate, setHourlyRate] = useState(75);
  const [transactionsPerQuarter, setTransactionsPerQuarter] = useState(6);
  const [avgCommission, setAvgCommission] = useState(10000);
  const [extraDealsPerQuarter, setExtraDealsPerQuarter] = useState(1);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const result = useMemo(() => {
    const pricing = priceForSeats(seats);
    if (pricing.enterprise) {
      return {
        enterprise: true,
        band: pricing.band,
      } as const;
    }

    const planMonthly = pricing.perSeatMonthly * seats;
    const planAnnual = pricing.perSeatAnnual * seats;
    const yourPlanMonthly =
      billing === "annual" ? Math.round(planAnnual / 12) : planMonthly;
    const yourPlanAnnual = billing === "annual" ? planAnnual : planMonthly * 12;

    const stackFloorMonthly = STACK_FLOOR_MONTHLY * seats;
    const stackCeilingMonthly = STACK_CEILING_MONTHLY * seats;
    const stackSavingsFloor = Math.max(0, stackFloorMonthly - yourPlanMonthly);
    const stackSavingsCeiling = Math.max(0, stackCeilingMonthly - yourPlanMonthly);

    const weeklyHoursSaved = adminHours * seats;
    const weeklyDollarsSaved = weeklyHoursSaved * hourlyRate;
    const annualHoursSaved = weeklyHoursSaved * 50; // 2 weeks off
    const annualTimeDollarsSaved = annualHoursSaved * hourlyRate;

    const extraDealsPerYear = extraDealsPerQuarter * 4 * seats;
    const extraDealRevenueAnnual = extraDealsPerYear * avgCommission;

    const totalAnnualValue =
      annualTimeDollarsSaved +
      stackSavingsFloor * 12 +
      extraDealRevenueAnnual;

    const roiMultiple =
      yourPlanAnnual > 0
        ? Math.max(0, totalAnnualValue / yourPlanAnnual)
        : 0;

    const dailyPlanCost = yourPlanAnnual / 365;
    const annualPerDealValue = avgCommission * extraDealsPerQuarter * 4;
    const daysToBreakeven =
      dailyPlanCost > 0 && annualPerDealValue > 0
        ? Math.max(1, Math.round(yourPlanAnnual / (annualPerDealValue / 365)))
        : null;

    return {
      enterprise: false,
      band: pricing.band,
      perSeatMonthly: pricing.perSeatMonthly,
      perSeatAnnual: pricing.perSeatAnnual,
      yourPlanMonthly,
      yourPlanAnnual,
      stackFloorMonthly,
      stackCeilingMonthly,
      stackSavingsFloor,
      stackSavingsCeiling,
      weeklyHoursSaved,
      weeklyDollarsSaved,
      annualHoursSaved,
      annualTimeDollarsSaved,
      extraDealsPerYear,
      extraDealRevenueAnnual,
      totalAnnualValue,
      roiMultiple,
      daysToBreakeven,
    } as const;
  }, [
    seats,
    adminHours,
    hourlyRate,
    avgCommission,
    extraDealsPerQuarter,
    billing,
  ]);

  return (
    <div className="border border-rule bg-paper">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
        {/* INPUTS */}
        <div className="border-b border-rule p-7 md:p-10 lg:border-b-0 lg:border-r">
          <p className="eyebrow mb-4">Inputs</p>
          <h3 className="font-display text-2xl leading-tight text-ink md:text-3xl">
            What does your office look like?
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-soft">
            Drag the sliders. Math updates live.
          </p>

          <div className="mt-8 space-y-7">
            <NumberInput
              label="Realtors on the team (seats)"
              value={seats}
              onChange={setSeats}
              min={1}
              max={150}
              step={1}
              suffix={seats === 1 ? "realtor" : "realtors"}
            />
            <NumberInput
              label="Hours / week each realtor spends on admin"
              value={adminHours}
              onChange={setAdminHours}
              min={0}
              max={40}
              step={1}
              suffix="hrs / week"
              hint="Email triage, listing prep, lead nurture, social, transaction chase."
            />
            <NumberInput
              label="Realtor's productive hourly rate"
              value={hourlyRate}
              onChange={setHourlyRate}
              min={25}
              max={300}
              step={5}
              prefix="$"
              suffix="/ hr"
              hint="What an hour of selling time is worth, not what payroll pays."
            />
            <NumberInput
              label="Average commission per closed deal"
              value={avgCommission}
              onChange={setAvgCommission}
              min={1000}
              max={50000}
              step={500}
              prefix="$"
              hint="Net to the realtor — 2.5% of $400K is roughly $10,000."
            />
            <NumberInput
              label="Extra deals / quarter / realtor we help close"
              value={extraDealsPerQuarter}
              onChange={setExtraDealsPerQuarter}
              min={0}
              max={6}
              step={1}
              suffix="deal / qtr"
              hint="From leads that would otherwise drop off — set 1 if unsure."
            />

            <div className="border-t border-rule pt-6">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                Billing
              </p>
              <div className="mt-3 inline-flex border border-rule">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`px-4 py-2 text-sm transition ${
                    billing === "monthly"
                      ? "bg-ink text-paper"
                      : "bg-paper text-ink hover:bg-paper-deep"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("annual")}
                  className={`border-l border-rule px-4 py-2 text-sm transition ${
                    billing === "annual"
                      ? "bg-ink text-paper"
                      : "bg-paper text-ink hover:bg-paper-deep"
                  }`}
                >
                  Annual <span className="opacity-70">(2 mo free)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* OUTPUTS */}
        <div className="bg-paper-deep p-7 md:p-10">
          <p className="eyebrow mb-4">What you get</p>

          {result.enterprise ? (
            <>
              <h3 className="font-display text-3xl leading-tight text-ink md:text-4xl">
                Enterprise band — talk to us.
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                100+ seats land in custom pricing with a dedicated success
                lead, custom integrations, and SLAs. Email
                hello@agentplain.com.
              </p>
              <a
                href="mailto:hello@agentplain.com?subject=agentplain%20enterprise"
                className="btn-primary mt-6"
              >
                Talk to us →
              </a>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-signal">
                {result.band} · {fmtMoney(result.perSeatMonthly)} /seat /mo
              </p>
              <h3 className="mt-2 font-display text-4xl leading-[1.05] text-ink md:text-5xl">
                {fmtMoney(result.yourPlanMonthly)}
                <span className="ml-2 font-sans text-base text-slate-soft">
                  / mo
                </span>
              </h3>
              <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                {fmtMoney(result.yourPlanAnnual)} / yr ·{" "}
                {billing === "annual"
                  ? "billed annually"
                  : "billed monthly"}
              </p>

              <div className="mt-8 grid gap-5 border-t border-rule pt-6 sm:grid-cols-2">
                <Metric
                  label="Tools we replace"
                  value={`${fmtMoney(result.stackFloorMonthly)}–${fmtMoney(
                    result.stackCeilingMonthly
                  )}`}
                  unit="/ mo of tooling"
                  body={`At ${fmtMoney(STACK_FLOOR_MONTHLY)}–${fmtMoney(
                    STACK_CEILING_MONTHLY
                  )} per realtor for the typical realtor stack.`}
                />
                <Metric
                  label="Time returned"
                  value={`${result.weeklyHoursSaved} hrs`}
                  unit="/ week back"
                  body={`Worth about ${fmtMoney(
                    result.weeklyDollarsSaved
                  )} / week or ${fmtMoney(
                    result.annualTimeDollarsSaved
                  )} / yr at ${fmtMoney(hourlyRate)}/hr.`}
                />
                <Metric
                  label="Extra deal revenue"
                  value={fmtMoney(result.extraDealRevenueAnnual)}
                  unit="/ yr"
                  body={`From ${result.extraDealsPerYear} extra closed deals at ${fmtMoney(
                    avgCommission
                  )} avg commission.`}
                />
                <Metric
                  label="Days to break even"
                  value={
                    result.daysToBreakeven === null
                      ? "—"
                      : `${result.daysToBreakeven}`
                  }
                  unit="days"
                  body="One extra closed deal pays for the year. This is the day-count after that deal closes."
                />
              </div>

              <div className="mt-8 border-t border-rule pt-6">
                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                  Annual ROI
                </p>
                <p className="mt-1 font-display text-5xl leading-none text-ink md:text-6xl">
                  {result.roiMultiple.toFixed(1)}×
                </p>
                <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-soft">
                  Total annual value (
                  {fmtMoney(result.totalAnnualValue)}) ÷ annual cost (
                  {fmtMoney(result.yourPlanAnnual)}). Counts time returned,
                  tools replaced (low end), and extra-deal revenue.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="mailto:hello@agentplain.com?subject=agentplain%20pricing%20math"
                  className="btn-primary"
                >
                  Run this with your numbers →
                </a>
                <a
                  href="#capabilities"
                  className="btn-secondary"
                >
                  See what's included
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-rule bg-paper p-6 md:p-8">
        <p className="text-[13px] leading-relaxed text-slate-soft">
          <span className="text-ink">Assumptions:</span> annual savings use
          50 working weeks. Tool-stack range is the typical realtor SaaS
          load (CRM, lead gen, listing copy/marketing, drip, social,
          transaction mgmt, showings) at $510–$1,560 per realtor per month.
          Extra-deal revenue assumes commission stated above and that one
          additional close per realtor per quarter is attributable to the
          fleet — a conservative number for offices with leaky lead
          response.
        </p>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
          {label}
        </label>
        <span className="font-mono text-base text-ink">
          {prefix}
          {value.toLocaleString("en-US")}
          {suffix ? <span className="ml-1 text-slate-soft">{suffix}</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-signal"
        aria-label={label}
      />
      {hint ? (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  body,
}: {
  label: string;
  value: string;
  unit: string;
  body: string;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl leading-tight text-ink md:text-3xl">
        {value}
        <span className="ml-2 font-sans text-xs text-slate-soft">{unit}</span>
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
