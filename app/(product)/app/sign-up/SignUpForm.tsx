"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
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
//   * Regular — self-serve checkout (DB enum: regular)
//   * Partner — self-serve checkout (DB enum: plus)
//   * Max     — quote-based, no self-serve checkout (routes to /custom)
//
// Picker is a three-up segmented control. Selecting Regular or Partner keeps
// the workspace-creation form intact and forwards the chosen tier as a
// hidden field to `signUpAction`. Selecting Max replaces the form with a
// CTA card to /custom?type=max — sign-up never creates a Max workspace
// (operator provisions it manually after the engagement signs).

type Selection = TierName;

const PICKER_OPTIONS: ReadonlyArray<{
  tier: Selection;
  headline: string;
  priceLabel: string;
}> = [
  {
    tier: "regular",
    headline: tierDisplayName("regular"),
    priceLabel: `From $${PER_SEAT_MONTHLY_USD_CENTS.regular.SEATS_50_99 / 100}/seat`,
  },
  {
    tier: "plus",
    headline: tierDisplayName("plus"),
    priceLabel: `From $${PER_SEAT_MONTHLY_USD_CENTS.plus.SEATS_50_99 / 100}/seat`,
  },
  {
    tier: "max",
    headline: "Talk to us about Max",
    priceLabel: "Quote-based",
  },
];

export function SignUpForm({
  verticals,
  defaultVerticalSlug,
  defaultTier = "regular",
}: {
  /** Server-rendered to avoid pulling the marketing content bundle into the client. */
  verticals: VerticalOption[];
  /** Pre-selected vertical slug from /(marketing)/[vertical] → /app/sign-up?vertical=… */
  defaultVerticalSlug?: string;
  /** Pre-selected tier from /(marketing)/pricing → /app/sign-up?tier=… */
  defaultTier?: TierName;
}) {
  const [tier, setTier] = useState<Selection>(defaultTier);
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
    <div className="space-y-6">
      <TierPicker selected={tier} onSelect={setTier} />

      {tier === "max" ? (
        <MaxCta />
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tier" value={tier} />
          <TierSummary tier={tier} />
          <VerticalField
            verticals={verticals}
            defaultValue={defaultVerticalSlug ?? "real-estate"}
          />
          <Field
            label="Brokerage / firm name"
            name="brokerageName"
            required
            placeholder="Acme Realty"
            autoComplete="organization"
          />
          <Field
            label="Your email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <Field
            label="Your name (optional)"
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
        Pick a tier
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
      · {TIER_TAGLINE[tier]} First month free — no card required to start.
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
        Max engagements are scoped per customer — high-intensity operations,
        multi-state compliance, white-label deployment, dedicated team. We
        scope on a call, write the spec, and only then talk price. A real
        human reads every inquiry.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/custom?type=max#custom-contact"
          className="btn-primary inline-flex"
        >
          Tell us what you need
          <span aria-hidden>→</span>
        </Link>
        <a
          href="mailto:hello@agentplain.com"
          className="text-[13px] text-ink underline"
        >
          Or email a human directly
        </a>
      </div>
    </div>
  );
}

function VerticalField({
  verticals,
  defaultValue,
}: {
  verticals: VerticalOption[];
  defaultValue: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        Vertical
      </span>
      <select
        name="vertical"
        required
        defaultValue={defaultValue}
        className="mt-1 block w-full border border-rule bg-paper px-3 py-2 text-[15px] text-ink outline-none focus:border-ink"
      >
        {verticals.map((v) => (
          <option key={v.slug} value={v.slug}>
            {v.name}
            {v.slug === "real-estate" ? "" : " — early access"}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1 block w-full border border-rule bg-paper px-3 py-2 text-[15px] text-ink outline-none focus:border-ink"
      />
    </label>
  );
}

function Submit({ tier }: { tier: Exclude<Selection, "max"> }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary disabled:opacity-50"
    >
      {pending
        ? "Creating workspace…"
        : `Create ${tierDisplayName(tier)} workspace`}
    </button>
  );
}
