import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import ArchitectureDiagram from "@/components/marketing/ArchitectureDiagram";
import { tokens } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title: "How we build — agentplain architecture and posture",
  description:
    "How agentplain reads your tools, drafts inside its own workspace, and surfaces every customer-facing output for your review. Read-only OAuth in, drafts out — outbound execution stays in your systems.",
};

// /how-we-build — the trust-and-architecture surface for technical and
// compliance-minded buyers. Answers Q6 ("why should I believe you?") of the
// homepage story arc per `feedback_everything_tells_a_story.md`. Created
// per the visual-components task spec — distinct from /custom (which is
// commercial / scoping) and from /about (which is mission / vision).
//
// Story arc for this page:
//   1. What's the architecture?           → diagram
//   2. What does the fleet NOT do?        → boundary callouts
//   3. What standards is this built on?   → portability / no-lock-in
//   4. How do I keep auditing this?       → CTAs into /custom + dashboard

const boundaries = [
  {
    label: "Never sends",
    body:
      "The fleet drafts. The fleet doesn't email, SMS, call, or post on your behalf. Every customer-facing output queues for your review and ships from your existing system.",
    cite: "project_no_outbound_architecture.md",
  },
  {
    label: "Never moves money",
    body:
      "No payments, no transfers, no invoicing. Money flow stays inside your accounting and billing tools, where the audit trail already lives.",
    cite: "project_no_outbound_architecture.md",
  },
  {
    label: "Never makes commitments",
    body:
      "No contracts signed, no terms agreed. The fleet drafts and proposes; commitments need a human signature on your side.",
    cite: "project_no_outbound_architecture.md",
  },
  {
    label: "Never resells your data",
    body:
      "Your data trains your fleet, not a generic model. We don't resell client lists. The customer owns the work product.",
    cite: "project_agentplain_mission_and_positioning.md",
  },
];

const standards = [
  {
    label: "Open standard underneath",
    body:
      "Tool access goes through Model Context Protocol — an open standard, not a proprietary connector layer. New tools onboard against the same interface old ones use.",
    cite: "project_living_portable_architecture.md",
  },
  {
    label: "Adapter pattern, two-implementation rule",
    body:
      "Every vendor SDK call lives behind an adapter. No vendor's SDK reaches the fleet directly. Swapping a CRM, an LLM, or an email provider is a config change, not a refactor.",
    cite: "feedback_no_silent_vendor_lock.md",
  },
  {
    label: "Cold-start safe agents",
    body:
      "Provider session memory is performance, never correctness. Every agent reads durable state on every fire — restartable, replayable, auditable.",
    cite: "feedback_cold_start_safe_agents.md",
  },
  {
    label: "Counsel-reviewed compliance corpus",
    body:
      "Per-vertical compliance corpuses (TCPA, RESPA, fair-housing for realty; analog corpuses for the other nine) are reviewed by outside counsel. Bespoke corpus work is reviewed the same way.",
    cite: "project_counsel_engaged.md",
  },
];

export default function HowWeBuildPage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">How we build</p>
          <p className="font-display text-base leading-snug text-clay md:text-lg">
            {tokens.tagline}
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4.5rem] md:leading-[1.04]">
            Read-only in.{" "}
            <span className="text-clay">Drafts out.</span> You send.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
            The architecture is intentionally narrow. The fleet reads your
            tools via read-only OAuth, drafts inside its own workspace, and
            surfaces every customer-facing output for your review. Outbound
            execution stays in your systems — your CRM, your inbox, your
            phone. That keeps liability where the license lives and keeps
            audit trails in tools your compliance team already trusts.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="#architecture" className="btn-primary">
              See the architecture
              <span aria-hidden>→</span>
            </Link>
            <Link href="/custom" className="btn-secondary">
              Scope a custom build
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Architecture diagram */}
      <Section
        id="architecture"
        eyebrow="The architecture"
        title="Four layers. One direction of trust."
        intro="Your tools stay where they are. Read-only OAuth feeds the fleet. The fleet drafts into its own workspace. You review, edit, approve — and your existing systems do the sending."
      >
        <ArchitectureDiagram />
      </Section>

      {/* Boundaries — what the fleet does NOT do */}
      <Section
        tone="deep"
        eyebrow="The boundaries"
        title="Four things the fleet never does."
        intro="The narrower the surface, the easier the audit. Per-vertical compliance posture starts here — anything that would push liability onto agentplain instead of the licensed practitioner gets cut from the spec, not scoped into it."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          {boundaries.map((b) => (
            <div key={b.label} className="bg-paper p-7 md:p-8">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                {b.label}
              </p>
              <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
                {b.body}
              </p>
              <p className="mt-5 border-t border-rule pt-4 font-mono text-[11px] leading-relaxed text-mute">
                Source: <code className="text-[11px]">{b.cite}</code>
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Standards — what's load-bearing underneath */}
      <Section
        eyebrow="What's load-bearing"
        title="The four commitments behind the diagram."
        intro="Architecture is a stack of choices. Each of these is a published memory rule the build pod enforces in code review — not a marketing claim."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-2">
          {standards.map((s) => (
            <div key={s.label} className="bg-paper p-7 md:p-8">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                {s.label}
              </p>
              <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
              <p className="mt-5 border-t border-rule pt-4 font-mono text-[11px] leading-relaxed text-mute">
                Source: <code className="text-[11px]">{s.cite}</code>
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Closing CTA */}
      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-28">
          <p className="eyebrow mb-6 text-paper/60">{tokens.tagline}</p>
          <p className="max-w-3xl font-display text-3xl leading-[1.15] md:text-5xl md:leading-[1.08]">
            Trust comes from the boundaries — not the demo theater.
          </p>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-paper/75">
            If your compliance team wants a deeper read on the architecture,
            scope a Custom engagement and we&rsquo;ll walk it line by line.
            Otherwise the diagram above is the whole story.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/custom"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Scope a custom build
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
