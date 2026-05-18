"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ApHeritageButton, ApHeritageField } from "@/components/ui/ap";
import {
  PARTNER_RESERVED_HOURS_PER_MONTH,
  PER_SEAT_MONTHLY_USD_CENTS,
  TIER_TAGLINE,
  tierDisplayName,
  type TierName,
} from "@/lib/pricing/tiers";
import { signUpAction, type ActionResult } from "../actions";

const initial: ActionResult = { ok: false };

export interface VerticalOption {
  slug: string;
  name: string;
}

// Three customer-facing tiers per the 2026-05-15 amendment to
// `project_stripe_both_surfaces.md`:
//   * Regular — direct checkout (DB enum: regular)
//   * Partner — direct checkout (DB enum: plus)
//   * Max     — quote-based, no direct checkout (routes to /custom)

type Selection = TierName;

const PICKER_OPTIONS: ReadonlyArray<{
  tier: Selection;
  headline: string;
  priceLabel: string;
}> = [
  {
    tier: "regular",
    headline: tierDisplayName("regular"),
    priceLabel: `from $${PER_SEAT_MONTHLY_USD_CENTS.regular.SEATS_50_99 / 100}/seat`,
  },
  {
    tier: "plus",
    headline: tierDisplayName("plus"),
    priceLabel: `from $${PER_SEAT_MONTHLY_USD_CENTS.plus.SEATS_50_99 / 100}/seat`,
  },
  {
    tier: "max",
    headline: "talk to us about Max",
    priceLabel: "quote-based",
  },
];

export function SignUpForm({
  verticals,
  defaultVerticalSlug,
  defaultTier = "regular",
}: {
  verticals: VerticalOption[];
  defaultVerticalSlug?: string;
  defaultTier?: TierName;
}) {
  const [tier, setTier] = useState<Selection>(defaultTier);
  const [verticalSlug, setVerticalSlug] = useState<string>(
    defaultVerticalSlug ?? "real-estate",
  );
  const [state, formAction] = useFormState<ActionResult, FormData>(
    signUpAction,
    initial,
  );

  if (state.ok && state.notice) {
    return (
      <p className="border border-rule bg-paper-deep p-4 text-[15px] leading-relaxed text-ink">
        {state.notice}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <TierPicker selected={tier} onSelect={setTier} />

      {tier === "max" ? (
        <MaxCta />
      ) : (
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="tier" value={tier} />
          <input type="hidden" name="vertical" value={verticalSlug} />
          <TierSummary tier={tier} />

          <VerticalChipRow
            verticals={verticals}
            selected={verticalSlug}
            onSelect={setVerticalSlug}
          />

          <ApHeritageField
            label="brokerage / firm name"
            name="brokerageName"
            required
            placeholder="Acme Realty"
            autoComplete="organization"
          />
          <ApHeritageField
            label="your email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <ApHeritageField
            label="your name (optional)"
            name="ownerName"
            autoComplete="name"
          />
          {state.error ? (
            <p className="text-sm text-flag" role="alert">
              {state.error}
            </p>
          ) : null}
          <Submit tier={tier} />
        </form>
      )}
    </div>
  );
}

function TierPicker({
  selected,
  onSelect,
}: {
  selected: Selection;
  onSelect: (t: Selection) => void;
}) {
  return (
    <fieldset>
      <legend className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        service cadence
      </legend>
      <div
        role="radiogroup"
        aria-label="Tier"
        className="mt-2 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3"
      >
        {PICKER_OPTIONS.map((opt) => {
          const isActive = opt.tier === selected;
          return (
            <button
              key={opt.tier}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onSelect(opt.tier)}
              className={`bg-paper p-4 text-left transition focus:outline-none ${
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
                {tierDisplayName(opt.tier)}
              </p>
              <p className="mt-2 font-display text-lg leading-tight text-ink">
                {opt.headline}
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">{opt.priceLabel}</p>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function TierSummary({ tier }: { tier: Exclude<Selection, "max"> }) {
  return (
    <p className="border border-rule bg-paper-deep px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
      <span className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {tierDisplayName(tier)}
      </span>{" "}
      · {TIER_TAGLINE[tier]} First month is on us — no card required to
      start.
      {tier === "plus" ? (
        <>
          {" "}
          A named service partner reserves{" "}
          {PARTNER_RESERVED_HOURS_PER_MONTH} hours/month for your workspace.
        </>
      ) : null}
    </p>
  );
}

function MaxCta() {
  return (
    <div className="border border-ink bg-paper-deep p-5">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        Max — quote-based
      </p>
      <p className="mt-2 font-display text-xl leading-tight text-ink">
        {TIER_TAGLINE.max}
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
        Max engagements are scoped per customer — high-intensity
        operations, multi-state compliance, white-label deployment,
        dedicated team. We scope on a call, write the spec, and only
        then talk price. A real human reads every inquiry.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ApHeritageButton
          variant="primary"
          withArrow
          href="/custom?type=max#custom-contact"
        >
          tell us what you need
        </ApHeritageButton>
        <a
          href="mailto:hello@agentplain.com"
          className="text-[13px] text-ink underline"
        >
          or email a human directly
        </a>
      </div>
    </div>
  );
}

function VerticalChipRow({
  verticals,
  selected,
  onSelect,
}: {
  verticals: VerticalOption[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  // Per design language §3.3 (chip row), with a /general fallback so
  // shops outside the 10 launch verticals can self-select. Tens of
  // chips fit on one line at md and wrap on mobile.
  const options: VerticalOption[] = [
    ...verticals,
    { slug: "general", name: "Something else" },
  ];

  return (
    <fieldset>
      <legend className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        the work you do
      </legend>
      <div
        role="radiogroup"
        aria-label="Vertical"
        className="mt-2 flex flex-wrap gap-2"
      >
        {options.map((v) => {
          const active = v.slug === selected;
          return (
            <button
              key={v.slug}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(v.slug)}
              className={`rounded-none border px-3 py-2 font-mono text-[11px] tracking-eyebrow uppercase transition focus:outline-none ${
                active
                  ? "border-clay bg-clay text-paper"
                  : "border-rule bg-paper text-mute hover:border-ink hover:text-ink"
              }`}
            >
              {v.name}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-mute">
        Real-estate brokerages get the full agent fleet today. Others
        start with the compliance-and-drafting stack; your service
        partner extends it for your shop.
      </p>
    </fieldset>
  );
}

function Submit({ tier }: { tier: Exclude<Selection, "max"> }) {
  const { pending } = useFormStatus();
  return (
    <ApHeritageButton variant="primary" type="submit" disabled={pending}>
      {pending
        ? "rooting your workspace…"
        : `begin with us — ${tierDisplayName(tier)} workspace`}
    </ApHeritageButton>
  );
}
