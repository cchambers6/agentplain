import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import CustomInquiryForm from "@/components/CustomInquiryForm";
import { tokens } from "@/lib/brand/tokens";
import {
  INQUIRY_TYPE_OPTIONS,
  type InquiryType,
} from "@/lib/custom-inquiry/types";

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
//   1.  Can you build the thing I actually need?   → hero
//   1.5 Is this for me?                            → "Who this is for"
//   2.  What does "custom" actually look like?     → 6 example builds
//   3.  How do we work together?                   → 4-step process
//   4.  What does it cost?                         → pricing framework
//   5.  Why should I trust the number?             → proof section
//   5.5 What future am I joining?                  → vision tie-in
//   6.  How do I start the conversation?           → Custom-vs-Max
//                                                    distinction + form
//   7.  What if I'm not ready to fill the form?    → closing CTA + mailto

// Q1.5 — who this is for. Sits between hero ("can you build it?") and
// "what custom looks like" so a visitor self-identifies BEFORE seeing the
// example builds. Frames Custom as a surface for operators who have
// outgrown Regular ($199 → $99 per-seat, plug-and-play) rather than a
// different product. Each bullet maps to one of the example builds below.
const whoThisIsFor = [
  {
    label: "50+ seats with vertical compliance gates",
    body:
      "State-specific, carrier-specific, lender-specific rules beyond the ten counsel-reviewed corpuses we ship. The standard corpus is the floor; you need an overlay calibrated to how your shop actually files.",
  },
  {
    label: "Multi-state operations",
    body:
      "The same workflow runs against different rule sets simultaneously — a closing in Georgia and one in Florida hit different disclosure deadlines, different earnest-money rules, different licensing constraints. Custom gives each state its own pass.",
  },
  {
    label: "White-label deployment",
    body:
      "Your firm's wordmark on the surface, your data isolation posture, your customer-facing brand — useful when you're reselling to your own customers (a brokerage offering it to agents under your brand, a CPA firm offering it to clients).",
  },
  {
    label: "Custom skills for proprietary workflows",
    body:
      "A vendor-specific dispute filing, an internal QA loop, a particular escrow-doc dance, a recurring buyer-side checklist — workflows the standard fleet doesn't ship a skill for yet because they're specific to how you run your shop.",
  },
  {
    label: "100+ seats / enterprise terms",
    body:
      "Your own contract, security review, procurement path, audit access. The Regular ladder caps at 99 seats; past that the engagement is scoped per customer, not per seat.",
  },
];

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
      "A CRM, AMS, LOS, PMS, or accounting tool that isn't on the public roadmap yet. Read-only OAuth, your existing tool stays the system of record, the fleet drafts into it the way it already drafts into Gmail and Follow Up Boss.",
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
    label: "Compliance corpus is real, not vapor",
    body:
      "Every vertical ships with a compliance corpus drafted around the regulations that govern that line of work. The real-estate fair-housing rule (HUD's enumerated trigger phrases) is a literal-match scanner that fires on every customer-facing draft today; the other verticals' rules are loaded as drafts and don't fire until counsel red-lines them. We say so on the page rather than claim coverage we don't have.",
    cite: "",
  },
  {
    label: "Open feedback loop",
    body:
      "Every agent action is visible inside the workspace — handoffs, drafts, compliance flags, all auditable. Nothing happens behind the curtain. Your firm, your fleet, your audit trail.",
    cite: "project_no_outbound_architecture.md",
  },
];

interface PageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

// `?type=max` etc. pre-selects the inquiry-type toggle. Used by the
// /pricing Max-card CTA and the billing-settings "Talk to us about Max"
// link (see docs/pricing-page-handoff-2026-05-15.md for the URL contract).
function resolveDefaultInquiryType(raw: unknown): InquiryType {
  const slug = Array.isArray(raw) ? raw[0] : raw;
  if (typeof slug !== "string") return "custom_skill_build";
  const normalized = slug.toLowerCase().replace(/-/g, "_");
  if (normalized === "max" || normalized === "max_service_engagement") {
    return "max_service_engagement";
  }
  if (normalized === "not_sure" || normalized === "both") {
    return "not_sure";
  }
  if (
    (INQUIRY_TYPE_OPTIONS as readonly string[]).includes(normalized)
  ) {
    return normalized as InquiryType;
  }
  return "custom_skill_build";
}

export default async function CustomPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const defaultInquiryType = resolveDefaultInquiryType(params.type);
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

      {/* Q1.5 — who this is for */}
      <Section
        tone="deep"
        eyebrow="Who this is for"
        title="When Regular runs out of room."
        intro={
          <>
            <p>
              Regular ($199 → $99 per seat, every vertical, 1–99 seats,
              plug-and-play) covers most local businesses. Custom is the
              surface for the operators Regular doesn&rsquo;t yet reach.
            </p>
            <p className="mt-4">
              If any of these describe you, the conversation starts here. If
              none of them do, Regular is the right fit and{" "}
              <Link href="/pricing" className="underline">
                /pricing
              </Link>{" "}
              is the page you want.
            </p>
          </>
        }
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2 lg:grid-cols-3">
          {whoThisIsFor.map((row, i) => (
            <div key={row.label} className="bg-paper p-7 md:p-8">
              <div className="flex items-baseline gap-3">
                <p className="font-mono text-[11px] tracking-eyebrow text-clay">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                  {row.label}
                </p>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                {row.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

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
            </div>
          ))}
        </div>
      </Section>

      {/* Q5.5 — vision tie-in. Vision line LOCKED VERBATIM per
          `project_agentplain_mission_and_positioning.md`. The page just
          showed proof; the visitor now sees the why behind the surface
          they're about to engage with. */}
      <Section
        eyebrow="Where this leads"
        title={
          <>
            Local businesses can thrive through access to{" "}
            <span className="text-clay">
              affordable, best-in-class tools and services.
            </span>
          </>
        }
        intro="Custom is how we extend the surface when &lsquo;affordable + best-in-class&rsquo; needs more depth than the productized fleet ships. The promise holds: the human stays in the loop, the audit trail stays open, the per-seat ROI math stays intact. The shape grows to fit your operation. That&rsquo;s the point."
      >
        <p className="max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl">
          Same fleet, same control surface, scoped to the work only you do.
        </p>
      </Section>

      {/* Q6 — contact form */}
      <Section
        eyebrow="Get scoped"
        title="Tell us what you need."
        intro="Six fields. A human reads each one. We come back within two business days with a scoping-call invite and a first read on what we&rsquo;d build."
      >
        {/* Custom vs Max distinction — preps the inquiry-type radio toggle
            below. Source: `project_stripe_both_surfaces.md` (Custom = build
            new capabilities Regular doesn't ship; Max = more service
            intensity at standard skills). The two can stack on one
            customer; the form's "Not sure / both" option routes that. */}
        <div className="mb-10 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Custom skill build
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Building <strong className="font-medium text-ink">new
              capabilities</strong> we don&rsquo;t have yet — a skill, an
              integration, a bespoke corpus, a white-label surface. Anything
              the productized fleet doesn&rsquo;t already ship.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Max-tier service engagement
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              <strong className="font-medium text-ink">More service
              intensity</strong> at standard skills — dedicated success,
              multi-state ops, white-label deployment, regulated-vertical
              compliance overlays. Quote-based, scoped per engagement.
            </p>
          </div>
        </div>
        <p className="mb-10 max-w-3xl text-[15px] leading-relaxed text-ink-soft">
          The two can stack:{" "}
          <strong className="font-medium text-ink">
            you can be on Max AND have a Custom engagement.
          </strong>{" "}
          The same form below routes both — pick the one that fits, or pick
          &ldquo;Not sure / both&rdquo; and a human reads what you wrote.
        </p>
        <CustomInquiryForm defaultInquiryType={defaultInquiryType} />
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
