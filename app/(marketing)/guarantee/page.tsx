import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/Section";
import HeroBackdrop from "@/components/marketing/HeroBackdrop";
import { tokens } from "@/lib/brand/tokens";
import { alternatesFor } from "@/lib/seo/metadata";

// The guarantee page — the trial promise made visible.
//
// What's true (and the only thing this page claims):
//   - 7-day trial (ratified 2026-06-14; lib/env stripeTrialPeriodDays
//     default 7, CPA/Law 14 via trialPeriodDaysForVertical).
//   - The product tracks time saved per action (lib/guarantee) and, at the
//     evaluation day, offers a one-tap walk-away: full refund + data
//     deletion when the fleet hasn't cleared the bar.
//   - The fleet DRAFTS; the human approves and sends from their own system
//     (project_no_outbound_architecture). The guarantee never implies
//     auto-send.
//
// Deliberately QUALITATIVE about the bar. The exact hours-saved threshold
// (GUARANTEE_BAR_HOURS, proposed 5) is Conner's to ratify and is enforced
// in-product, not published — a precise public number invites gaming and
// pins us to a figure before sign-off. See
// docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md.

export const metadata: Metadata = {
  title: "The guarantee",
  description:
    "If agentplain hasn't clearly saved you time by the end of your trial, walk away — full refund, and we delete your data. We track the time saved so the promise is provable, not a slogan.",
  alternates: alternatesFor("/guarantee"),
};

const STEPS: Array<{ number: string; title: string; body: string }> = [
  {
    number: "01",
    title: "We count the time.",
    body: "Every action the fleet completes for you — a drafted reply, a scheduled meeting, a chased document — is logged with a conservative estimate of the minutes it saved you. You watch the total add up live inside your workspace.",
  },
  {
    number: "02",
    title: "We check at day seven.",
    body: "On day seven of your trial we add it up. If the fleet has clearly earned its keep, you carry on. If it hasn't, we tell you — we don't wait for you to notice.",
  },
  {
    number: "03",
    title: "You walk, or you stay.",
    body: "Didn't hit the bar? One tap: full refund, and we delete your data. No call, no retention script, no hoops. Or keep going — connect another tool and give the fleet more to do.",
  },
];

export default function GuaranteePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-rule bg-paper">
        <HeroBackdrop scene="home-crew" />
        <div className="relative container-wide py-20 md:py-28">
          <p className="eyebrow mb-3">The guarantee</p>
          <h1 className="max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4rem] md:leading-[1.04]">
            If it doesn&rsquo;t save you time,{" "}
            <span className="text-clay">you don&rsquo;t pay.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Most trials ask you to prove a tool didn&rsquo;t work before they
            let you leave. We flip it. We count the time the fleet saves you,
            in the open, and if it hasn&rsquo;t clearly earned its keep by the
            end of your trial, you walk away — full refund, and we delete your
            data.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink/90"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 border border-rule bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:border-ink"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* The three steps */}
      <Section
        tone="deep"
        eyebrow="How the guarantee works"
        title="Counted, not promised"
        intro="The guarantee isn't a slogan on a pricing page — it's a number we track and show you, and a one-tap exit if we don't earn it."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.number} className="bg-paper p-7 md:p-8">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                {s.number}
              </p>
              <h3 className="mt-3 font-display text-xl leading-tight text-ink md:text-2xl">
                {s.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Why we can offer it */}
      <Section
        eyebrow="Why we can stand behind it"
        title="We see the work, so we'll wager on it"
        intro="The fleet drafts, schedules, and chases in the background and hands every item to your approval queue. Because each completed action is logged, we can put a number on the time it gave you back — and bet on it."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Conservative on purpose
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              The minutes we credit are the low end of how long each task takes
              by hand — never inflated. The number has to survive you doing the
              math, so we round down, not up.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              You stay in control
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Nothing leaves without your name on it. The fleet drafts; you
              approve, edit, or reject; your own tools send. The guarantee is
              about saved time, not handing over the wheel.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              A clean exit
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Walk away and we refund you in full and delete your workspace
              data — knowledge, drafts, connected-tool access, all of it.
              Nothing of yours lingers on our systems.
            </p>
          </div>
        </div>
      </Section>

      {/* Closing CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-paper/60">
            {tokens.tagline}
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Try it for a week. Keep it only if it earns its seat.
          </h2>
          <p className="mt-6 max-w-2xl text-paper/75">
            Seven days. Month-to-month. If the fleet hasn&rsquo;t clearly saved
            you time, one tap walks you out — refunded, data deleted, no
            questions.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
