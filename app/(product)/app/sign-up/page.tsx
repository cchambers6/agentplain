import Link from "next/link";
import { ApEyebrow, PlainoScene } from "@/components/ui/ap";
import { getAllVerticals, getVerticalContent } from "@/lib/verticals";
import { TIER_ORDER, type TierName } from "@/lib/pricing/tiers";
import { PLAINO_PARTNER } from "@/lib/onboarding/service-partner";
import { env } from "@/lib/env";
import { trialHeadline } from "@/lib/billing/trial-copy";
import { SignUpForm } from "./SignUpForm";

interface SignUpPageProps {
  searchParams: Promise<{ vertical?: string; tier?: string }>;
}

// `?tier=` pre-selects the picker so deep links from /pricing and the
// billing-page upgrade CTA land on the right card. Unknown values fall
// back to Regular (the default productized tier per
// `project_stripe_both_surfaces.md`).
function resolveDefaultTier(raw: string | undefined): TierName {
  if (!raw) return "regular";
  const normalized = raw.toLowerCase();
  if (normalized === "partner") return "plus";
  if ((TIER_ORDER as readonly string[]).includes(normalized)) {
    return normalized as TierName;
  }
  return "regular";
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const raw = (params.vertical ?? "").toLowerCase();
  const defaultVerticalSlug = getVerticalContent(raw) ? raw : "real-estate";
  const defaultTier = resolveDefaultTier(params.tier);

  const verticals = getAllVerticals().map((v) => ({
    slug: v.slug,
    name: v.name,
  }));

  // Trial-honesty: the headline copy must match the ACTUAL configured flow,
  // not a stale promise. A card is only collected at signup when billing is
  // live AND the Checkout-at-signup variant is on; the #241 scaffold default
  // is trial-first / no-card. Trial length reads from env (default 14), so a
  // dashboard change never leaves the copy lying. See app/(product)/app/
  // actions.ts for the matching server branches.
  const trialDays = env.stripeTrialPeriodDays();
  const cardAtSignup =
    env.stripeBillingEnabled() && env.stripeCheckoutEnabled();

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <PlainoScene
            name="auth-signup"
            alt="Plaino stepping forward to greet you"
            className="h-auto w-28"
          />
        </div>
        <ApEyebrow className="mb-4">begin with us</ApEyebrow>
        <h1 className="font-display text-4xl leading-tight text-ink">
          Root your workspace on agentplain.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-soft">
          Tell us your shop and the work you do. {PLAINO_PARTNER.name}, your
          service partner, picks up your install within one business day.{" "}
          {trialHeadline(trialDays, cardAtSignup)}
        </p>
        <div className="mt-10">
          <SignUpForm
            verticals={verticals}
            defaultVerticalSlug={defaultVerticalSlug}
            defaultTier={defaultTier}
            trialDays={trialDays}
            cardAtSignup={cardAtSignup}
          />
        </div>
        <p className="mt-10 border-t border-rule pt-6 text-sm text-mute">
          We email you a link. No password to lose.{" "}
          <Link href="/app/sign-in" className="text-ink underline">
            already with us? sign in →
          </Link>
        </p>
        <p className="mt-4 text-[13px] leading-relaxed text-mute">
          Not sure this fits your shop?{" "}
          <a href="mailto:hello@agentplain.com" className="text-ink underline">
            ask a human at agentplain
          </a>{" "}
          — a real person reads every note.
        </p>
      </div>
    </div>
  );
}
