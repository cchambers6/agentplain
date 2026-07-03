import type { Metadata } from "next";
import Link from "next/link";

import { tokens } from "@/lib/brand/tokens";
import { BOOKING_CTA_LABEL, bookingUrl } from "@/lib/marketing/booking";
import { alternatesFor } from "@/lib/seo/metadata";

// Contact page — the stable front door for "talk to a person".
//
// This route exists so the intro-call CTA (lib/marketing/booking.ts) always
// has somewhere real to land: when NEXT_PUBLIC_BOOKING_URL is set the page
// leads with the scheduling link; when it isn't, email carries the whole
// weight. Outreach emails and the marketing site can link /contact and it
// never dead-ends — the failure mode the {{CALENDLY_LINK}} placeholder era
// shipped by default.
//
// Truth rules: hello@agentplain.com is the one contact address used
// site-wide (Footer, closing CTAs, tier CTAs). No phone number is published
// because none exists yet; no response-time promise is made beyond what we
// actually do.

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Book an intro call or write to hello@agentplain.com. A real person reads every message — no drip, no spam.",
  alternates: alternatesFor("/contact"),
};

export default function ContactPage() {
  const booking = bookingUrl();

  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-3">Contact</p>
          <h1 className="max-w-3xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:leading-[1.04]">
            Talk to a person.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Fifteen minutes is usually enough to tell whether the fleet fits
            how your shop works. Bring your real week — the inbox, the
            follow-ups, the paperwork — and we&apos;ll walk through what it
            would take off your plate.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            {booking ? (
              <a
                href={booking}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink/90"
              >
                {BOOKING_CTA_LABEL}
                <span aria-hidden>→</span>
              </a>
            ) : (
              <a
                href="mailto:hello@agentplain.com?subject=Intro%20call"
                className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink/90"
              >
                {BOOKING_CTA_LABEL}
                <span aria-hidden>→</span>
              </a>
            )}
            <a
              href="mailto:hello@agentplain.com"
              className="inline-flex items-center justify-center gap-2 border border-rule bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:border-ink"
            >
              hello@agentplain.com
            </a>
          </div>
          {!booking && (
            <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-mute">
              Email lands with a real person, who replies to set the time.
            </p>
          )}
        </div>
      </section>

      <section className="border-b border-rule bg-paper">
        <div className="container-wide grid gap-px overflow-hidden border-x-0 py-14 md:grid-cols-3 md:py-16">
          <div className="p-2 md:p-4">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              What to expect
            </p>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              A working conversation, not a pitch. We ask what eats your
              week; you ask what the fleet actually does. If it isn&apos;t a
              fit, we&apos;ll say so.
            </p>
          </div>
          <div className="p-2 md:p-4">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Rather read first?
            </p>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              <Link
                href="/how-it-works"
                className="underline underline-offset-4 hover:text-ink"
              >
                How it works
              </Link>{" "}
              covers the loop the fleet runs and where you stay in control.{" "}
              <Link
                href="/pricing"
                className="underline underline-offset-4 hover:text-ink"
              >
                Pricing
              </Link>{" "}
              is published, in full.
            </p>
          </div>
          <div className="p-2 md:p-4">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Already trialing?
            </p>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              Your workspace has a direct line to your service partner —
              use the support tab there and it reaches us with your context
              attached.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="container-wide py-16 md:py-20">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-paper/60">
            {tokens.tagline}
          </p>
          <p className="mt-4 max-w-2xl text-paper/75">
            No drip sequence, no list. You write, a person answers.
          </p>
        </div>
      </section>
    </>
  );
}
