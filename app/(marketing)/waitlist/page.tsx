import type { Metadata } from "next";
import Link from "next/link";

import HeroBackdrop from "@/components/marketing/HeroBackdrop";
import WaitlistForm from "@/components/marketing/WaitlistForm";
import { alternatesFor } from "@/lib/seo/metadata";

// /waitlist — founding-list email capture.
//
// Honest by construction (see WaitlistForm + project_no_outbound_architecture):
// we capture the email into the existing LeadCapture pipeline and a real
// person follows up. No automated newsletter, no drip — so this page never
// promises a weekly send. It promises early access + occasional hand-sent
// notes, which is what we actually do.
//
// Zero customers today, so nothing here implies a count or a testimonial. The
// frame is "we're onboarding founding partners by hand," which is true.

export const metadata: Metadata = {
  title: "Join the founding list",
  description:
    "We're onboarding founding local-business partners by hand. Join the list and a real person reaches out when we open in your line of work — plus occasional plain notes on what the fleet drafts and what we're building.",
  alternates: alternatesFor("/waitlist"),
};

export default function WaitlistPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-rule bg-paper">
        <HeroBackdrop scene="inquiry-received" />
        <div className="relative container-wide grid gap-12 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-28">
          {/* Left — the pitch */}
          <div>
            <p className="eyebrow mb-3">Founding list</p>
            <h1 className="max-w-xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.5rem] md:leading-[1.05]">
              Be first when we open in your{" "}
              <span className="text-clay">line of work.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">
              We&apos;re onboarding founding partners by hand — local businesses
              that want the routine work drafted for them, not another tool to
              run. Leave your email and a real person reaches out when we open
              in your vertical.
            </p>

            <div className="mt-10 max-w-xl space-y-4 border-l-2 border-rule pl-5">
              <p className="font-mono text-[11px] uppercase tracking-eyebrow text-clay">
                What being on the list means
              </p>
              <p className="text-[15px] leading-relaxed text-ink-soft">
                A person follows up — not a sequence. When there&apos;s a real
                reason to write (we open your vertical, or a workflow you asked
                about ships), you hear from us.
              </p>
              <p className="text-[15px] leading-relaxed text-ink-soft">
                Occasional plain notes from the build: what&apos;s connected
                today — email, calendar, QuickBooks — what isn&apos;t yet, and
                what we&apos;re working on next. No daily blasts, no hype. If
                something isn&apos;t ready, we say so.
              </p>
              <p className="text-[15px] leading-relaxed text-ink-soft">
                Want to move now instead of waiting?{" "}
                <Link
                  href="/app/sign-up"
                  className="text-ink underline underline-offset-4 hover:text-clay"
                >
                  Start a free trial
                </Link>{" "}
                — first month free, month-to-month, cancel anytime.
              </p>
            </div>
          </div>

          {/* Right — the form */}
          <div className="md:pt-10">
            <WaitlistForm />
            <p className="mt-4 text-[12px] leading-relaxed text-mute">
              Prefer to talk to a person first?{" "}
              <Link
                href="/custom"
                className="text-ink underline underline-offset-4 hover:text-clay"
              >
                Tell us about your firm
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
