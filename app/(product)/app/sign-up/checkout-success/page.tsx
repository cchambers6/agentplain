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
// the magic-link CTA, and hands off to the sign-in surface. Avoiding any
// session-bound mutation here means the page is safely renderable
// whether the customer has clicked the magic link yet or not.

import Link from "next/link";
import { ApEyebrow, ApHeritageButton, PlainoScene } from "@/components/ui/ap";
import { PLAINO_PARTNER } from "@/lib/onboarding/service-partner";
import { env } from "@/lib/env";

interface PageProps {
  searchParams: Promise<{ session_id?: string; workspace?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  await searchParams; // resolve to avoid the unused-promise lint
  const trialDays = env.stripeTrialPeriodDays();
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
          <ApHeritageButton variant="primary" withArrow href="/app/sign-in">
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
