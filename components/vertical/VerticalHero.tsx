import Link from "next/link";
import type { VerticalContent } from "@/lib/verticals/types";
import {
  isSelfServeTier,
  type TierName,
} from "@/lib/pricing/tiers";
import { MONTHLY_PRICE_USD_CENTS } from "@/lib/billing/facts";
import { tokens } from "@/lib/brand/tokens";
import { verticalSceneName } from "@/components/ui/ap";
import HeroBackdrop from "@/components/marketing/HeroBackdrop";

// Vertical-page hero. Brand tokens only.
//
// Per `project_agentplain_mission_and_positioning.md` (LOCKED 2026-05-11):
//   - Tagline ("Intelligence rooted in reality.") appears immediately under
//     the wordmark / page label.
//   - The locked mission line renders with the vertical-specific
//     `missionSubject` noun ("We lift up {missionSubject} by doing the work
//     that takes their time and money away from the people they serve.").
//   - Vertical's original headline is preserved as the supporting line.
//   - CTA pair routes to /app/sign-up and the pricing anchor.

export default function VerticalHero({
  content,
}: {
  content: VerticalContent;
}) {
  // Default the audience noun if a content file hasn't been backfilled yet —
  // keeps the locked mission line stable across the 10 active verticals while
  // tolerating any future vertical that lands content-first.
  const audience = content.missionSubject ?? `${content.name.toLowerCase()} firms`;

  // On-ramp surfaces (e.g. `/general`) don't have a Prisma `Vertical` enum
  // entry, so the sign-up flow can't accept `?vertical=general`. We drop the
  // prefill on on-ramp pages — the visitor picks one of the ten ratified
  // verticals during sign-up. The CTA stays the same shape.
  const signUpHref =
    content.status === "on-ramp"
      ? "/app/sign-up"
      : `/app/sign-up?vertical=${content.slug}`;

  // SELF-SERVE GUARD (live defect fix).
  //
  // This hero rendered an unconditional "Start free trial" CTA to
  // /app/sign-up?vertical=<slug> with NO `isSelfServeTier` check. A visitor
  // on a quote-only vertical (law is max-tier) therefore landed on signup
  // with no `?tier=` param, `resolveDefaultTier` defaulted them to
  // `regular`, and they could complete a self-serve purchase on a vertical
  // that is supposed to route through operator triage.
  //
  // `components/vertical/VerticalCta.tsx` already does this check; the hero
  // was the hole. Quote-only verticals now route to /custom, matching the
  // CTA block further down the page.
  //
  // Kept independent of the flat-price change ON PURPOSE: flat pricing
  // removes the price half of the tier concept, but `isSelfServeTier` still
  // gates the SALES MOTION, so this fix survives the copy PR.
  const selfServe = isSelfServeTier(content.tier as TierName);
  const primaryCtaHref = selfServe ? signUpHref : `/custom?type=${content.tier}`;
  const primaryCtaLabel = selfServe ? "Start free trial" : "Request a quote";

  const sceneName = verticalSceneName(content.slug);

  // Hero price stat. Quote-only verticals show "Quoted"; everyone else shows
  // THE price, read from the billing SSOT.
  //
  // WAS: `tierLadderBands(tier)` rendered as `${ladder[0].price} → ${last}`.
  // The shim now returns a SINGLE row, so both ends of that arrow resolved to
  // the same cell and the hero read "$99 → $99" on every self-serve vertical
  // page. It threw nothing and no build error pointed at it — the arrow just
  // quietly stopped meaning anything.
  const priceStat =
    content.tier === "max" ? "Quoted" : `$${MONTHLY_PRICE_USD_CENTS / 100}/mo`;

  return (
    <section className="relative overflow-hidden border-b border-rule bg-paper">
      {/* Per-vertical heritage backdrop (md+), mirrors the homepage hero. */}
      <HeroBackdrop scene={sceneName} />
      <div className="relative container-wide py-20 md:py-28">
        <p className="eyebrow mb-3">{content.hero.eyebrow}</p>
        <p className="font-display text-base leading-snug text-clay md:text-lg">
          {tokens.tagline}
        </p>

        <h1 className="mt-8 max-w-4xl font-display text-4xl leading-[1.06] text-ink md:text-6xl md:leading-[1.04]">
          We lift up{" "}
          <span className="text-clay">{audience}</span> by doing the work
          that takes their time and money away from the people they serve.
        </h1>

        <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
          {content.hero.valueProp}
        </p>

        {/* Run-for-you subhead — vendor-generic per the 2026-06-11 customer-
            surface rule (the underlying AI model is never named on a customer
            surface). Rendered only when the content file supplies it (all ten
            ratified verticals do). */}
        {content.hero.sbmSubhead ? (
          <p className="mt-4 max-w-3xl font-display text-base leading-snug text-clay md:text-lg">
            {content.hero.sbmSubhead}
          </p>
        ) : null}

        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-mute">
          {content.hero.headline}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href={primaryCtaHref} className="btn-primary">
            {primaryCtaLabel}
            <span aria-hidden>→</span>
          </Link>
          <Link href="#pricing" className="btn-secondary">
            See pricing
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-14 grid max-w-3xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
          <Stat label="ROI multiplier" value={content.roi.multiplier} />
          <Stat label="Flat monthly" value={priceStat} />
          <Stat
            label="Integrations planned"
            value={String(content.integrations.planned.length)}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}
