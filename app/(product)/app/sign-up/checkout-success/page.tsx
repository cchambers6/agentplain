// Wave-2 CC-at-trial Checkout success landing.
//
// Stripe redirects the browser here when the customer completes Checkout.
// At this moment the magic link is already in the customer's inbox (we
// issued it before redirecting to Checkout) and the
// `checkout.session.completed` + `customer.subscription.created` webhooks
// will land within seconds — they create the Subscription row out of
// band.
//
// This page does NOT do any DB work. It greets the customer, re-states
// the magic-link CTA, and hands off to the activation surface. Avoiding
// any session-bound mutation here means the page is safely renderable
// whether the customer has clicked the magic link yet or not.
//
// Both the trial length and the handoff target come from the Checkout
// `success_url` query string (`workspace`, `vertical`) rather than a DB
// read, which is what keeps the no-DB-work property true.

import Link from "next/link";
import { ApEyebrow, ApHeritageButton, PlainoScene } from "@/components/ui/ap";
import { PLAINO_PARTNER } from "@/lib/onboarding/service-partner";
import { trialPeriodDaysForVertical } from "@/lib/billing/facts";

interface PageProps {
  searchParams: Promise<{
    session_id?: string;
    workspace?: string;
    vertical?: string;
  }>;
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  // `workspace` and `vertical` are both put on the Checkout `success_url` by
  // `lib/billing/checkout.ts`. They were previously resolved and thrown away.
  const { workspace, vertical } = await searchParams;

  // Derive the trial from the SAME source the signup path used
  // (`trialPeriodDaysForVertical`, `lib/billing/facts.ts`) instead of the
  // global `env.stripeTrialPeriodDays()`. A CPA/Law customer has 14 days in
  // Stripe; this page used to tell them 7 on the screen they land on right
  // after entering a card.
  const trialDays = trialPeriodDaysForVertical(vertical ?? "");

  // The activation surface is the "first touch in 5 minutes" experience and
  // it had no inbound link anywhere in the repo. Send the new paying customer
  // there when we know their workspace; fall back to sign-in when we don't.
  const primaryHref = workspace
    ? `/app/workspace/${encodeURIComponent(workspace)}/welcome`
    : "/app/sign-in";
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <PlainoScene
            name="auth-checkout"
            alt="Plaino beside a raised flag — you're all set"
            className="h-auto w-32"
          />
        </div>
        <ApEyebrow className="mb-4">card on file</ApEyebrow>
        <h1 className="font-display text-3xl leading-tight text-ink">
          Your card is secured. Your trial is rooted.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Stripe holds your card; we never see the number. Your {trialDays}-day
          trial starts now — Stripe will charge your card automatically
          when it ends, unless you cancel from billing first.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          {PLAINO_PARTNER.name}, your service partner, picks up your
          install within one business day. The sign-in link we emailed
          is valid for 15 minutes — click it whenever you're ready.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ApHeritageButton variant="primary" withArrow href={primaryHref}>
            sign in to open your workspace
          </ApHeritageButton>
        </div>
        <p className="mt-10 border-t border-rule pt-6 text-sm text-mute">
          Question?{" "}
          <Link href="/custom" className="text-ink underline">
            tell us what you need →
          </Link>
        </p>
      </div>
    </div>
  );
}
