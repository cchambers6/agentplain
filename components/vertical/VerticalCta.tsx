import Link from "next/link";
import type { VerticalContent } from "@/lib/verticals/types";
import {
  isSelfServeTier,
  trialPeriodDaysForVertical,
  type TierName,
} from "@/lib/pricing/tiers";

// Closing CTA on every vertical page. Brand-token styled, mission-aligned.
// Per `project_stripe_both_surfaces.md` pilot pricing is killed — no "pilot"
// framing anywhere. The offer is a free trial (card at signup), month-to-month
// on the self-serve tiers; Max verticals (law / RIA) are quote-based, so the
// copy + CTA route to /custom?type=max instead of claiming a free trial.
export default function VerticalCta({
  content,
}: {
  content: VerticalContent;
}) {
  // Self-serve tiers (Regular / Partner) run a Stripe free trial (7 days
  // default, 14 for CPA + Law); Max is quote-based with no self-checkout, so
  // it must not advertise a free trial. Drives both the body copy and the
  // primary CTA below.
  const selfServe = isSelfServeTier(content.tier as TierName);
  const trialDays = trialPeriodDaysForVertical(content.slug);
  // On-ramp surfaces (e.g. `/general`) read awkwardly with the ratified-
  // vertical heading shape ("Run your local businesses practice on the
  // fleet.") and the sign-up flow can't accept their slug as the prefill
  // (no Prisma `Vertical` enum entry). The on-ramp variant rephrases the
  // headline and drops the `?vertical=` query param.
  const isOnRamp = content.status === "on-ramp";
  const heading = isOnRamp
    ? "Run your business on the fleet."
    : `Run your ${content.name.toLowerCase()} practice on the fleet.`;
  const signUpHref = isOnRamp
    ? "/app/sign-up"
    : `/app/sign-up?vertical=${content.slug}`;

  return (
    <section className="bg-ink text-paper">
      <div className="container-wide py-20 md:py-24">
        <p className="eyebrow mb-6 text-paper/60">
          {selfServe ? "Start free" : "Let's scope it"}
        </p>
        <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
          {heading}
        </h2>
        <p className="mt-6 max-w-2xl text-paper/75">
          {selfServe ? (
            <>
              {trialDays}-day free trial, card at signup. Month-to-month from
              day one — no annual contract, no auto-renew. The fleet drafts;
              you decide what ships. Cancel anytime from your billing settings.
              Need more depth than the tiers cover plug-and-play? We scope per
              customer — build with us.
            </>
          ) : (
            <>
              Quoted to your engagement — month-to-month or annual, no surprise
              charges. The fleet drafts; you decide what ships. Talk to us and
              we&apos;ll scope it with you.
            </>
          )}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={selfServe ? signUpHref : "/custom?type=max"}
            className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
          >
            {selfServe ? "Start free trial" : "Talk to us about Max"}
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/custom"
            className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
          >
            Build with us
          </Link>
        </div>
      </div>
    </section>
  );
}
