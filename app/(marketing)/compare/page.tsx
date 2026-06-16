import type { Metadata } from "next";
import Link from "next/link";

import Section from "@/components/Section";
import HeroBackdrop from "@/components/marketing/HeroBackdrop";
import { ContrastRow } from "@/components/marketing/HomeCards";
import { chatbotContrast } from "@/lib/marketing/home-content";
import { tokens } from "@/lib/brand/tokens";
import { alternatesFor } from "@/lib/seo/metadata";

// /compare — "do it yourself vs. run for you."
//
// The honest comparison the homepage gestures at, given its own page. Framed
// vendor-generically per the 2026-06-11 rule: the alternative is "a DIY AI
// tool you run yourself," never a named product. We are not positioned as a
// competitor/alternative to any model — we are the service that RUNS the AI
// for you (project_sbm_wrapper_positioning_2026_06_06).
//
// Two data sources, both already vetted on the homepage:
//   - chatbotContrast (lib/marketing/home-content) — the five "free vs us" rows
//   - RESPONSIBILITIES below — who does each job in the DIY path vs. run-for-you
// Every claim traces to CREATIVE_PACK_GROUND_TRUTH.md. No customer counts.

export const metadata: Metadata = {
  title: "DIY vs. run for you",
  description:
    "A general-purpose AI tool gives you a blank box and a bill. agentplain installs a fleet for your trade, connects your tools, and runs it — drafts land in your queue, you approve and send. Here's the honest comparison.",
  alternates: alternatesFor("/compare"),
};

// Who owns each job. LEFT = you, on the DIY path. RIGHT = the agentplain
// service partnership. Each row is a real responsibility, not a feature boast.
const RESPONSIBILITIES: Array<{ job: string; diy: string; us: string }> = [
  {
    job: "Setup & wiring",
    diy: "You connect the tools, write the system prompts, and figure out what good output looks like — on top of running your business.",
    us: "We install the fleet, connect your email, calendar, and QuickBooks, and tune it to your trade before you touch it.",
  },
  {
    job: "Every task",
    diy: "You open the tool and prompt it, each time, from a blank box. It starts cold and forgets when you close the tab.",
    us: "The fleet runs the same loop on its own — reads what landed, drafts the reply, and hands it to your queue on a cadence.",
  },
  {
    job: "Knowing your business",
    diy: "You paste in context every session — your tone, your files, your hours, your rules.",
    us: "Onboarding captures it once; every edit you make becomes a learned note that rides into the next draft.",
  },
  {
    job: "Compliance",
    diy: "On you to catch. A general tool has no idea a phrase is a Fair Housing violation or a position understates a tax liability.",
    us: "A sentinel reviews each draft against your vertical's rules and a PII scan, and flags it before you approve — in real estate today, the rest as counsel red-lines them.",
  },
  {
    job: "Sending",
    diy: "You copy, paste, and send — or you let an auto-send tool act on its own and hope it read the room.",
    us: "Nothing sends itself. Every draft waits in your approvals queue; you approve, edit, or reject, and it goes from your own system.",
  },
  {
    job: "Keeping it working",
    diy: "When a tool changes or your process shifts, you re-prompt and re-wire it yourself.",
    us: "We run a review on a cadence and handle the change management as your ops shift. It is a service, not a side project.",
  },
];

export default function ComparePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-rule bg-paper">
        <HeroBackdrop scene="pricing" />
        <div className="relative container-wide py-20 md:py-28">
          <p className="eyebrow mb-3">Compare</p>
          <h1 className="max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4rem] md:leading-[1.04]">
            Do it yourself, or have it{" "}
            <span className="text-clay">run for you.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            A general-purpose AI tool hands you a blank box and a monthly bill —
            the wiring, the prompting, the compliance, and the sending are all
            still your job. agentplain is the other half: we install a fleet for
            your trade, connect your tools, and run it. Drafts land in your
            queue; you approve and send.
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

      {/* The five-row contrast (vetted on the homepage) */}
      <Section
        tone="deep"
        eyebrow="The difference, in five lines"
        title="A tool you run vs. a partner who runs it"
      >
        <div className="overflow-hidden border border-rule">
          <div className="grid grid-cols-2 gap-px bg-rule">
            <div className="bg-paper-deep p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft">
                A DIY AI tool
              </p>
            </div>
            <div className="bg-paper-deep p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                agentplain, run for you
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-rule">
            {chatbotContrast.map((row) => (
              <ContrastRow key={row.free} free={row.free} us={row.us} />
            ))}
          </div>
        </div>
        <p className="mt-6 max-w-prose text-[13px] leading-relaxed text-mute">
          We are not a competitor to the AI you already know — we are the
          service that runs it for you. The best models are powerful; we make
          them usable for a local business that does not have time to become a
          prompt engineer.
        </p>
      </Section>

      {/* Who owns each job */}
      <Section
        eyebrow="Who does the work"
        title="On the DIY path, it's all on you"
        intro="The same jobs get done either way. The question is who they land on — you, between clients, or a service team that does this for a living."
      >
        <div className="overflow-hidden border border-rule">
          <div className="hidden grid-cols-[1fr_2fr_2fr] gap-px bg-rule md:grid">
            <div className="bg-paper-deep p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft">
                The job
              </p>
            </div>
            <div className="bg-paper-deep p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft">
                Do it yourself
              </p>
            </div>
            <div className="bg-paper-deep p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                Run for you
              </p>
            </div>
          </div>
          <div className="grid gap-px bg-rule md:grid-cols-[1fr_2fr_2fr]">
            {RESPONSIBILITIES.map((r) => (
              <div key={r.job} className="contents">
                <div className="bg-paper p-7 md:p-8">
                  <p className="font-display text-lg leading-tight text-ink md:text-xl">
                    {r.job}
                  </p>
                </div>
                <div className="bg-paper p-7 md:p-8">
                  <p className="text-[15px] leading-relaxed text-ink-soft">
                    {r.diy}
                  </p>
                </div>
                <div className="flex items-start gap-3 bg-paper p-7 md:p-8">
                  <span
                    aria-hidden
                    className="mt-1 font-mono text-sm text-moss"
                  >
                    ✓
                  </span>
                  <p className="text-[15px] leading-relaxed text-ink">
                    {r.us}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Honest boundary */}
      <Section
        tone="deep"
        eyebrow="What stays the same either way"
        title="You stay in control of the work"
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              We keep your tools
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              agentplain is not a CRM, an inbox, or an e-sign tool. The fleet
              drafts into the systems you already pay for. No migration.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Nothing leaves without you
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              The fleet never auto-sends, never moves money, never makes a
              commitment. Every customer-facing output queues for your review.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Licensed judgment is yours
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              We hand off to you at the steps where licensed judgment lives.
              The fleet does the systematic work; the decision stays a person.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-paper/60">
            {tokens.tagline}
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Stop running the tool. Let us run it.
          </h2>
          <p className="mt-6 max-w-2xl text-paper/75">
            First month free. Month-to-month. Cancel anytime. By month two, the
            fleet has either earned its seat or it hasn&apos;t.
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
