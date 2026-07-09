import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/Section";
import HeroBackdrop from "@/components/marketing/HeroBackdrop";
import { Step } from "@/components/marketing/HomeCards";
import {
  ApClosingBand,
  ApClosingBandAction,
  ApPullQuote,
} from "@/components/ui/ap";
import { BOOKING_CTA_LABEL, bookingCta } from "@/lib/marketing/booking";
import { alternatesFor } from "@/lib/seo/metadata";

// Dedicated "How it works" page.
//
// Until now "How it works" was an anchor (`/#how`) on the marketing home. The
// SEO pack brief (see `app/sitemap.ts`) always listed `/how-it-works` at
// priority 0.8 as a standalone route; this is that page. The Header nav now
// points here instead of the home anchor.
//
// Every claim traces to the outbound claims whitelist
// (`docs/marketing/CREATIVE_PACK_GROUND_TRUTH.md`) and the homepage `#how`
// section it expands on:
//   - the five-step loop is verbatim from `home-content` / the home `#how`
//   - live integrations = Gmail/Outlook, Google Calendar, QuickBooks
//     (+ realty day-one: DocuSign, Google Drive). Nothing else is claimed live.
//   - the fleet DRAFTS; the human approves and sends from their own system.
//   - per `project_no_outbound_architecture.md`, no auto-send, ever.
//   - the underlying AI model is NOT named on a customer surface
//     (2026-06-11 vendor-invisible rule).

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Read. Categorize. Coordinate. Schedule. Draft. The fleet runs the same loop on everything that lands — and hands you a draft to approve. You sign; nothing leaves without you.",
  alternates: alternatesFor("/how-it-works"),
};

// The five-step loop — the crew runs this on every inbound thing. Kept in
// lockstep with the home `#how` copy.
const LOOP: Array<{ number: string; title: string; body: string }> = [
  {
    number: "01",
    title: "Read.",
    body: "Pull the message, parse the thread, find the newest reply. The crew never starts from a blank prompt — it starts from what just landed.",
  },
  {
    number: "02",
    title: "Categorize.",
    body: "Decide what kind of thing it is — a real lead, a scheduling ask, a vendor pitch, noise, an admin note, something you'd want a draft of. The read is workspace-tuned, not a generic guess.",
  },
  {
    number: "03",
    title: "Coordinate.",
    body: "Walk back the thread, summarize what's already been said, pick up the referenced documents. The draft is grounded in your actual files, not a model's training prior.",
  },
  {
    number: "04",
    title: "Schedule.",
    body: "When something needs a time, propose slots inside your stated hours — never outside them, never without checking what's already on your calendar.",
  },
  {
    number: "05",
    title: "Draft.",
    body: "Write the reply in your voice, grounded in your files and the edits you've made before. Hand it to the approval queue. Nothing leaves without your name on it.",
  },
];

// Concrete per-vertical scenes — each is a live or named workflow on the
// claims whitelist, written in the draft-then-approve frame. No customer
// counts, no invented metrics; the compliance/penalty angle is the moat an
// auto-send tool structurally can't match.
const SCENES: Array<{ vertical: string; href: string; scene: string }> = [
  {
    vertical: "Real estate",
    href: "/real-estate",
    scene:
      "A counter-offer email lands at 9:14pm. By 6:30am the lead is scored, the thread is summarized, and a first-touch reply is drafted in your queue. You read it, tweak a line, and send it from your own inbox. Before it ever reaches you, a Fair Housing scan checks the draft against HUD's enumerated phrases — a discriminatory line is a $26,262 first-offense penalty you never get near.",
  },
  {
    vertical: "CPA / tax",
    href: "/cpa",
    scene:
      "Month-end close: the fleet chases the three missing receipts, pulls AR aging straight from QuickBooks, and drafts the client status update. A credentialed person approves before a single number leaves the building. The Circular 230 / §6694 exposure on an understated position stays where it belongs — behind a human sign-off.",
  },
  {
    vertical: "Law",
    href: "/law",
    scene:
      "A new matter comes in. A deterministic adverse-party check runs against your client list, and an internal conflict notice is drafted for the attorney to confirm — the legal conclusion stays a merge field a person fills. Every client-facing draft waits for an attorney's approval, the way Model Rule 1.6 requires.",
  },
  {
    vertical: "Home services",
    href: "/home-services",
    scene:
      "An after-hours quote request arrives. The fleet drafts a same-day reply in your standard scope language and lands it in your queue. You approve it on your phone; it goes out from your own email. The job doesn't go cold overnight, and nothing was promised that you didn't sign.",
  },
];

// The intro-call CTA resolves through lib/marketing/booking: the real
// scheduling link when NEXT_PUBLIC_BOOKING_URL is set, /contact otherwise.
// External scheduling opens in a new tab; the internal fallback navigates
// in place. Either way the button always lands somewhere real.
function BookIntroCallCta() {
  const cta = bookingCta();
  const className =
    "inline-flex min-h-[44px] items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper";
  if (cta.external) {
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {BOOKING_CTA_LABEL}
        <span aria-hidden>→</span>
      </a>
    );
  }
  return (
    <Link href={cta.href} className={className}>
      {BOOKING_CTA_LABEL}
      <span aria-hidden>→</span>
    </Link>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-rule bg-paper">
        <HeroBackdrop scene="home-crew" />
        <div className="relative container-wide py-20 md:py-28">
          {/* Dateline kicker — the "a person published this on a date" tell.
              This page had zero editorial markers against home's 16 (dept
              design plan 2026-07-03 §days 6–9); the rhythm lands here. */}
          <span className="dateline mb-6 inline-block">
            How it works · 2026
          </span>
          <h1 className="max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4rem] md:leading-[1.04]">
            Read. Categorize. Coordinate. Schedule.{" "}
            <span className="text-clay">Draft.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            The fleet runs the same loop on everything that lands — an email, a
            calendar push, a webhook from a tool you&apos;ve connected. It
            works in the background, on a cadence, all day. You touch it when
            you choose to. It drafts; you sign; nothing leaves without you.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            {/* The estate's one primary-CTA treatment (clay), not the ad-hoc
                ink button this page used to carry. */}
            <Link href="/app/sign-up" className="btn-primary">
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link href="/pricing" className="btn-secondary">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* The five-step loop */}
      <Section
        tone="deep"
        eyebrow="The loop, every fire"
        title="Five steps the crew runs on its own"
        intro="The chain runs every five minutes against your backlog and reacts to push events as your tools connect. There is no idle hour where the crew has stopped working — and no step where it acts without you."
      >
        {/* The five steps as numbered plates — the `§ 01` document grammar
            that won the trust verticals (kaizen 2026-07-02 win 5). */}
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map((s) => (
            <Step
              key={s.number}
              number={`§ ${s.number}`}
              title={s.title}
              body={s.body}
            />
          ))}
        </div>
      </Section>

      {/* What's true today — the honesty spine */}
      <Section
        eyebrow="What's true today"
        title="The fleet drafts. You approve and send."
        intro="This is the differentiator, not a disclaimer. The whole loop ends in your approval queue — every item is pending until you decide."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Connected today
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Gmail and Outlook for email, Google Calendar for scheduling, and
              QuickBooks for AR aging and open invoices. Real estate adds
              DocuSign and Google Drive on day one. The fleet drafts into the
              tools you already pay for — no migration, no new dashboard to
              learn.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              A cadence, not a magic trick
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Drafts land in your queue on a schedule — typically before you
              open the laptop. Nothing happens in real time behind your back.
              You&apos;ll see every draft, every compliance flag, every
              handoff, auditable inside the workspace.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              We run it for you
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              agentplain is a service partnership, not a tool you wire up
              yourself. We install the fleet, connect your tools, tune it to
              how your shop works, and run a review on a cadence. You stay in
              control of the work.
            </p>
          </div>
        </div>

        {/* Contained figure — the #312 real-estate 3-step illustration set as
            an editorial plate (hairline frame, paper-deep mat, mono caption).
            Real estate leads because it is the beachhead. Same treatment as
            the home hero figure; never a background, never cropped. */}
        <figure className="m-0 mt-12">
          <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
            {["step-1", "step-2", "step-3"].map((step) => (
              /* eslint-disable-next-line @next/next/no-img-element -- local
                 brand SVG; next/image avoided product-wide (see Plaino.tsx) */
              <img
                key={step}
                src={`/brand/illustrations/real-estate/${step}.svg`}
                alt=""
                aria-hidden
                className="block h-auto w-full bg-paper-deep object-contain p-6"
                width={320}
                height={200}
              />
            ))}
          </div>
          <figcaption className="mt-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            The loop on a real-estate thread — read, draft, land in your queue
          </figcaption>
        </figure>
      </Section>

      {/* Concrete per-vertical scenes */}
      <Section
        tone="deep"
        eyebrow="What it looks like in your week"
        title="One loop, tuned to your trade"
        intro="The same five steps, grounded in the rules and tools your work actually runs on. Each draft waits for you — and a compliance scan reviews it before you ever see it."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          {SCENES.map((s) => (
            <div key={s.vertical} className="bg-paper p-7 md:p-8">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl leading-tight text-ink md:text-2xl">
                  {s.vertical}
                </h3>
                <Link
                  href={s.href}
                  className="font-mono text-[11px] tracking-eyebrow uppercase text-clay underline-offset-4 hover:underline"
                >
                  See vertical →
                </Link>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                {s.scene}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-mute">
          Real estate&apos;s fair-housing scan fires on every customer-facing
          draft today. The compliance corpora for the other verticals are
          drafted with the regulatory citations in place and load as counsel
          red-lines them — we don&apos;t assert coverage the runner can&apos;t
          yet pattern-match.
        </p>
      </Section>

      {/* The sparse close — one pull-quote on open paper carrying the
          no-outbound promise, nothing else in the block. Editorial rhythm:
          a dense fact run above, a full-bleed pause here. */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-16 md:py-20">
          <ApPullQuote>Nothing leaves without your name on it.</ApPullQuote>
        </div>
      </section>

      {/* Closing CTA — the shared grounded close (ApClosingBand). Conviction
          peaks on this page, so the booking CTA rides beside the trial CTA. */}
      <ApClosingBand
        title="See the loop run on your own inbox."
        body={
          <>
            7-day free trial, card at signup. Month-to-month. Cancel anytime.
            By the time the trial ends, the fleet has either earned its seat or
            it hasn&apos;t — and there&apos;s a{" "}
            <Link
              href="/guarantee"
              className="text-paper underline underline-offset-4 hover:text-wheat"
            >
              14-day money-back guarantee
            </Link>{" "}
            if it hasn&apos;t.
          </>
        }
        actions={
          <>
            <ApClosingBandAction href="/app/sign-up" variant="primary">
              Start free trial
            </ApClosingBandAction>
            <BookIntroCallCta />
            <ApClosingBandAction href="/verticals" variant="quiet" withArrow={false}>
              See all ten verticals
            </ApClosingBandAction>
          </>
        }
      />
    </>
  );
}
