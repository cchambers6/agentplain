import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import CustomInquiryForm from "@/components/CustomInquiryForm";
import ArchitectureDiagram from "@/components/marketing/ArchitectureDiagram";
import { tokens } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title: "Build with us — agentplain Custom engagements",
  description:
    "Need something the standard fleet doesn't do? Custom skill, custom integration, bespoke compliance corpus, white-label, dedicated success, 100+ seats — we scope per customer. Starts at $5K. Typical $5K–$15K + $200–$500/mo maintenance.",
};

// /custom — the catch-all surface for anything Regular doesn't cover.
// Anchored to the simplified pricing model per
// `project_stripe_both_surfaces.md` (locked 2026-05-12 — single productized
// tier + Custom engagements). Per `feedback_everything_tells_a_story.md`,
// every element earns its place along the visitor's story arc:
//
//   1. Can you build the thing I actually need?    → hero
//   2. What does "custom" actually look like?      → 6 example builds
//   3. How do we work together?                    → 4-step process
//   4. What does it cost?                          → pricing framework
//   5. Why should I trust the number?              → proof section
//   6. How do I start the conversation?            → contact form
//   7. What if I'm not ready to fill the form?     → closing CTA + mailto

// Q2 — 6 example builds. Each one anchored in real fleet capabilities we
// already run on flatsbo (per `feedback_agentplain_built_by_agents.md`) or
// in the per-vertical compliance corpuses (per `project_counsel_engaged.md`).
const exampleBuilds = [
  {
    label: "Custom skill",
    body:
      "A specific workflow your firm runs that the standard fleet doesn't have a skill for yet — vendor-specific dispute filing, a particular escrow-doc dance, a recurring buyer-side checklist. We model the skill, write the corpus, ship it scoped to your workspace.",
  },
  {
    label: "Custom integration",
    body:
      "A CRM, AMS, LOS, PMS, or accounting tool that isn't on the public roadmap yet. Read-only OAuth, your existing data stays put, the fleet drafts into your tool the way it already drafts into Gmail and Follow Up Boss.",
  },
  {
    label: "Bespoke compliance corpus",
    body:
      "Per-state regulations beyond the ten counsel-reviewed corpuses we ship. Specialized lender / carrier / regulator rules. We do the reading and the doc work; you do the licensed activity.",
  },
  {
    label: "White-label",
    body:
      "Your firm's wordmark on the surface, your compliance posture, your data isolation. Same fleet underneath. Useful when you're reselling to your own customers (e.g. a brokerage offering it to agents under your brand).",
  },
  {
    label: "Dedicated success",
    body:
      "A named operator from agentplain who knows your workflow, watches your fleet's outputs, and surfaces drift or opportunities weekly. Adds a managed-service overlay on top of the standard self-serve product.",
  },
  {
    label: "Custom reporting / data extraction",
    body:
      "Production reports, compliance reports, partner-share reports, anything your shop needs in a specific cadence and format. The fleet already drafts; we add the report shape your business runs on.",
  },
];

// Q3 — 4-step process. The process is the value loop. Per
// `feedback_integration_acceptance_is_functional.md`, "done" means the
// customer is in production, not "we signed the SOW."
const processSteps = [
  {
    number: "01",
    title: "Scoping call",
    body:
      "30–60 minutes. We learn your workflow, your tools, your compliance surface, the specific shape of the work you want lifted. No deck, no demo theater. Free.",
  },
  {
    number: "02",
    title: "Written spec",
    body:
      "We come back inside a week with a written spec: what we'd build, how it integrates with your existing tools, where the human stays in the loop, milestones, price. You review; you can walk away.",
  },
  {
    number: "03",
    title: "Build (typically 4–6 weeks)",
    body:
      "We ship into a staging workspace first. You see drafts before they reach customers. Weekly review; adjustments roll in continuously. The fleet doesn't reach your real customers until you sign off.",
  },
  {
    number: "04",
    title: "Handoff + ongoing maintenance",
    body:
      "Live in production. Monthly maintenance covers integration drift, model updates, corpus refreshes. Same human review on every output. Cancel any time.",
  },
];

// Q5 — proof. Per `project_agentplain_mission_and_positioning.md` Q6, every
// claim cites a memory rule or a real customer outcome.
const proof = [
  {
    label: "We build with the same fleet we sell",
    body:
      "The brokerage in production today is the working precursor of what we sell — ~35 cron-fired agents covering lead intake, listing coordination, contracts, CRM hygiene, recruiting, and production reporting. We've been running this pattern on ourselves long enough to know where the human still has to decide.",
    cite: "feedback_agentplain_built_by_agents.md",
  },
  {
    label: "ROI math, not vibes",
    body:
      "Custom work pays back the same way the standard product does: hours saved × productive-hour rate, plus mistakes avoided, plus deals closed faster. We anchor every spec against a 15x–110x ROI target before we send it.",
    cite: "project_pricing_value_anchor.md",
  },
  {
    label: "Counsel-reviewed compliance",
    body:
      "The compliance corpus that ships with every vertical is reviewed by outside counsel — and bespoke compliance work is reviewed the same way. When counsel returns we name them publicly. Until then the corpus is gated, not vapor.",
    cite: "project_counsel_engaged.md",
  },
  {
    label: "Open feedback loop",
    body:
      "Every agent action is visible inside the workspace — handoffs, drafts, compliance flags, all auditable. Nothing happens behind the curtain. Your firm, your fleet, your audit trail.",
    cite: "project_no_outbound_architecture.md",
  },
];

export default function CustomPage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Build with us</p>
          <p className="font-display text-base leading-snug text-clay md:text-lg">
            {tokens.tagline}
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4.5rem] md:leading-[1.04]">
            Need something the{" "}
            <span className="text-clay">standard fleet doesn&apos;t do?</span>{" "}
            We build.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Regular ($199 → $99 per seat) covers plug-and-play across all ten
            verticals. Custom is where we go deeper: bespoke compliance
            corpus, custom integration, white-label, dedicated success, 100+
            seats, anything that needs its own scope. One human reads your
            inquiry, comes back with a written spec, and only then talks
            price.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="#custom-contact" className="btn-primary">
              Tell us what you need
              <span aria-hidden>→</span>
            </Link>
            <Link href="#how-custom-works" className="btn-secondary">
              See how it works
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Q2 — what custom looks like */}
      <Section
        eyebrow="What custom looks like"
        title="Six shapes we&rsquo;ve seen so far."
        intro="Each one started as a customer saying &lsquo;the standard product is close, but it doesn&rsquo;t do X.&rsquo; That&rsquo;s the brief. We scope it, we build it, we maintain it."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {exampleBuilds.map((b, i) => (
            <div key={b.label} className="bg-paper p-7 md:p-8">
              <div className="flex items-baseline gap-3">
                <p className="font-mono text-[11px] tracking-eyebrow text-clay">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                  {b.label}
                </p>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Q3 — how it works */}
      <Section
        id="how-custom-works"
        tone="deep"
        eyebrow="How it works"
        title="Four steps. No deck, no demo theater."
        intro="The first call is free. The spec is written before the bill exists. We&rsquo;re in production in 4–6 weeks for a typical scope."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((s) => (
            <div key={s.number} className="bg-paper p-7 md:p-8">
              <p className="font-mono text-[11px] tracking-eyebrow text-clay">
                {s.number}
              </p>
              <h3 className="mt-4 font-display text-xl leading-tight text-ink md:text-2xl">
                {s.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Q4 — pricing framework */}
      <Section
        eyebrow="Pricing framework"
        title="Starts at $5K. Typical $5K–$15K + $200–$500/mo maintenance."
        intro="Scoped per customer. No surprise charges. The spec is what you pay for; if the build runs longer because we mis-scoped, that&rsquo;s on us, not you."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          <PricingFrameCell
            label="Scoping call"
            value="Free"
            detail="30–60 minutes. No commitment. You walk away with our read on whether Regular covers you, whether Custom is the right shape, or whether neither fits yet."
          />
          <PricingFrameCell
            label="Build (one-time)"
            value="$5K – $15K"
            detail="One-time engagement fee. Smaller scopes (single skill, single integration) anchor at $5K; larger scopes (white-label, compliance corpus, dedicated success) anchor toward $15K. Bigger lifts get a written quote."
          />
          <PricingFrameCell
            label="Maintenance"
            value="$200 – $500 / mo"
            detail="Integration drift, model updates, corpus refreshes, weekly review. Includes everything that ships with a Regular seat. Cancel any time."
          />
        </div>
        <p className="mt-6 max-w-3xl font-mono text-[12px] leading-relaxed text-mute">
          Source:{" "}
          <code className="text-[12px]">project_stripe_both_surfaces.md</code>{" "}
          (Custom engagement pricing framework; locked 2026-05-12).
        </p>
      </Section>

      {/* Architecture — answers Q6 ("why should I believe you?") for the
          technical buyer. Per `project_no_outbound_architecture.md` +
          `project_living_portable_architecture.md`, every layer is grounded
          in a memory rule with the citation in the legend. */}
      <Section
        eyebrow="How the work actually lands"
        title="Read-only in. Drafts out. You send."
        intro="The architecture is intentionally narrow: the fleet reads your tools via read-only OAuth, drafts inside its own workspace, and surfaces every customer-facing output for your review. Outbound execution stays in your systems."
      >
        <ArchitectureDiagram />
      </Section>

      {/* Q5 — proof */}
      <Section
        tone="deep"
        eyebrow="Rooted in reality"
        title="Why we can build what we say we&rsquo;ll build."
        intro="Four things we can point at today. Not magic, not pixie dust — real product, real operators, real outcomes."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-2">
          {proof.map((p) => (
            <div key={p.label} className="bg-paper p-7 md:p-8">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                {p.label}
              </p>
              <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
                {p.body}
              </p>
              <p className="mt-5 border-t border-rule pt-4 font-mono text-[11px] leading-relaxed text-mute">
                Source: <code className="text-[11px]">{p.cite}</code>
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Q6 — contact form */}
      <Section
        eyebrow="Get scoped"
        title="Tell us what you need."
        intro="Six fields. A human reads each one. We come back within two business days with a scoping-call invite and a first read on what we&rsquo;d build."
      >
        <CustomInquiryForm />
      </Section>

      {/* Q7 — closing */}
      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-28">
          <p className="eyebrow mb-6 text-paper/60">{tokens.tagline}</p>
          <p className="max-w-3xl font-display text-3xl leading-[1.15] md:text-5xl md:leading-[1.08]">
            Real product, real operators, real outcomes — at the scope your
            business actually needs.
          </p>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-paper/75">
            If the form isn&apos;t the right channel, email a human directly
            at{" "}
            <a
              href="mailto:hello@agentplain.com"
              className="text-paper underline"
            >
              hello@agentplain.com
            </a>
            . Same inbox. Same reply window.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="#custom-contact"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Tell us what you need
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              See standard pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function PricingFrameCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-paper p-7 md:p-8">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {label}
      </p>
      <p className="mt-4 font-display text-4xl leading-none text-ink md:text-5xl">
        {value}
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        {detail}
      </p>
    </div>
  );
}
