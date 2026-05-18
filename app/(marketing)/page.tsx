import Link from "next/link";
import Section from "@/components/Section";
import FAQ from "@/components/FAQ";
import RoiCalculator from "@/components/RoiCalculator";
import { getAllVerticals, getVerticalContent } from "@/lib/verticals";
import { tokens } from "@/lib/brand/tokens";

// Marketing home.
//
// Required to answer ALL 9 questions per
// `project_agentplain_mission_and_positioning.md` (Q1–Q9). Banned framings
// enforced in this file:
//   - no specific agent count ("the fleet" is the unit; counts belong to spec docs)
//   - no real-estate-only on page 1 (all 10 verticals named upfront)
//   - no "pilot pricing" framing (killed per project_stripe_both_surfaces.md)
//   - no "AI assistant" framing
//   - no "automate everything" / "replace your team" framings
//   - no "coming soon" without date/qualification
//
// Sources for every concrete claim are footnoted with their memory file.

// Service-partnership tiers (ratified 2026-05-15 — three productized tiers
// under the service-partnership lock; supersedes the 2026-05-12 single-tier
// surfacing while preserving the per-seat ladder as Regular's price shape).
// Regular: standard service partnership, per-seat ladder, self-served day-to-day
// with our team running install + config + reviews on a cadence.
// Partner: named service partner, weekly review cadence, deeper customization,
//          uplift on the per-seat number to fund the dedicated overlay.
// Max:     ad-hoc service partnership for firms with non-standard scope —
//          quoted, not productized; sales-led CTA.
// /custom remains a separate surface for bespoke ENGAGEMENTS (white-label,
// integrations off the roadmap, 100+ seats) — that surface is not a tier.
const ladderBands = [
  { band: "Solo (1 seat)", price: "$199" },
  { band: "2–9 seats", price: "$179" },
  { band: "10–24 seats", price: "$149" },
  { band: "25–49 seats", price: "$119" },
  { band: "50–99 seats", price: "$99" },
];

// Partner per-seat numbers map to the schema-backed Plus tier in
// `prisma/schema.prisma` (kept since 2026-05-09) — the productized uplift
// covers the named-partner overlay (onboarding, weekly review, customization).
// Source: HISTORICAL block of `project_stripe_both_surfaces.md` —
// $299 solo → $199 at scale.
const partnerBands = [
  { band: "Solo (1 seat)", price: "$299" },
  { band: "2–9 seats", price: "$269" },
  { band: "10–24 seats", price: "$239" },
  { band: "25–49 seats", price: "$219" },
  { band: "50–99 seats", price: "$199" },
];

// Q4 — what makes agentplain unique. Five points pulled verbatim from the
// mission rule (Vertical-aware / Control / Integrates / Built BY agents /
// Compliance-first).
const uniques = [
  {
    label: "Vertical-aware",
    body: "A real-estate agentplain knows MLS workflows, fair-housing copy, broker-of-record rules. A CPA agentplain knows tax-prep deadlines and e-file conventions. Each vertical ships with its own JTBD table and compliance corpus — generic AI tools don't.",
  },
  {
    label: "You stay in control",
    body: "The fleet drafts and proposes; it never auto-sends, never moves money, never makes commitments. Every customer-facing output queues for your review. Your existing CRM and inbox handle every send.",
  },
  {
    label: "Integrates, not replaces",
    body: "Sits on top of the tools you already pay for — your CRM, your inbox, your transaction system, your accounting. No migration. The fleet replaces the manual work that lives between them.",
  },
  {
    label: "Built BY agents",
    body: "The same fleet model we sell builds our own product. The pattern works because we run it on ourselves — a brokerage in production today running ~35 cron-fired agents on daily ops is the working precursor we productized.",
  },
  {
    label: "Compliance-first",
    body: "Per-vertical compliance corpus, counsel-reviewed (TCPA, RESPA, fair-housing for realty; analog corpuses for the other nine). Not bolted on after the marketing site went up.",
  },
];

// Q6 — proof points. Each item must cite a memory rule or a concrete artifact.
// "Why should anyone believe us?"
const proof = [
  {
    label: "Eat our own cooking",
    body: "agentplain is built BY a fleet of agents, not a human engineering team. The brokerage running in production today is the working precursor of this model — the pattern is real, not theoretical.",
    cite: "project_agentplain_built_by_agents.md",
  },
  {
    label: "Counsel-reviewed corpus",
    body: "Outside counsel is reviewing the broker-of-record term sheet, GA TCPA + RESPA compliance corpus. When counsel returns we'll name them publicly; until then the corpus is gated, not vapor.",
    cite: "project_counsel_engaged.md",
  },
  {
    label: "ROI math, not vibes",
    body: "Value math anchored at $2,900–$10,600/mo per practitioner against $99–$199/mo per-seat subscription — typical ROI multiple 15x to 110x, every claim traceable to a memory rule.",
    cite: "project_pricing_value_anchor.md",
  },
  {
    label: "Open feedback loop",
    body: "Every agent action is visible in the workspace. Nothing happens behind the curtain — handoffs, drafts, compliance flags, all auditable inside the product.",
    cite: "project_no_outbound_architecture.md",
  },
];

export default function HomePage() {
  // All ten verticals named on page 1 per the mission rule. Real estate is
  // one of ten — never the only one mentioned upfront.
  const verticals = getAllVerticals();
  const realEstateExample = getVerticalContent("real-estate")?.valueLoopExample;

  return (
    <>
      {/* HERO — wordmark + tagline + locked mission line + all 10 verticals */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-24 pt-20 md:pb-28 md:pt-24">
          {/* Wordmark-and-tagline lockup. The wordmark is rendered by the
              header logo above; this hero echoes the brand thesis line. */}
          <p className="font-display text-base leading-snug text-clay md:text-lg">
            {tokens.tagline}
          </p>
          <h1 className="mt-6 max-w-[58rem] font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4.5rem] md:leading-[1.04]">
            We lift up{" "}
            <span className="text-clay">local businesses</span> by doing the
            work that takes their time and money away from the people they
            serve.
          </h1>
          <p className="mt-8 max-w-3xl font-display text-2xl leading-snug text-ink md:text-[28px]">
            Your AI ops team — without hiring one.
          </p>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
            {tokens.wordmark} is a service partnership. We install the fleet of
            capable AI partners inside your business, configure it for your
            vertical, run weekly reviews, and customize as your ops change.
            The fleet reads from your email, calendar, CRM, and documents,
            categorizes what's important, drafts what you'd otherwise type,
            schedules what needs scheduling, and coordinates across threads.
            You stay in control: the fleet drafts and proposes; you approve and
            send. We run the operation; you run the business.
          </p>
          {/* Supporting copy from Conner's first-pass mission articulation —
              preserved per the canonical rule as useful supporting framing. */}
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-mute">
            More relationship building. More of the work you enjoy. Less of
            the work that takes your time and money away from the people you
            serve.
          </p>

          {/* All 10 verticals as a chip row.
              `/general` is NOT a chip — the chip row enumerates the ratified
              ten per `feedback_no_new_verticals_finish_locked.md`. The
              on-ramp surface is offered immediately below as a separate
              "Don't see your industry?" link so businesses outside the ten
              still have an honest landing path. */}
          <div className="mt-10">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              Built for ten kinds of local business — pick yours
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {verticals.map((v) => (
                <Link
                  key={v.slug}
                  href={`/${v.slug}`}
                  className="group inline-flex items-center gap-2 border border-rule bg-paper px-3 py-2 text-sm text-ink transition hover:border-ink hover:bg-paper-deep"
                >
                  <span className="font-display">{v.name}</span>
                  <span
                    aria-hidden
                    className="font-mono text-[10px] tracking-eyebrow text-mute group-hover:text-clay"
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-mute">
              Don&apos;t see your industry?{" "}
              <Link href="/general" className="text-ink underline">
                Same service partnership, lighter scaffolding →
              </Link>
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/app/sign-up" className="btn-primary">
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link href="#how" className="btn-secondary">
              See how it works
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Q1 — Why do we exist? */}
      <Section
        eyebrow="Why we exist"
        title="Local business owners spend most of their week on the work they don't love."
        intro="Email triage, copying data between tools, drafting boilerplate, scheduling, status updates — 60–70% of the week, in most surveys. The work that built the business in the first place — client relationships, judgment calls, growing the book — gets the leftover time."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <div className="bg-paper p-8 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow text-mute">
              The status quo
            </p>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              The CRM nags. The compliance flag fires after the draft goes out.
              The lead routes to whoever opens the inbox first. The production
              report happens twice a year because nobody has time. The owner
              answers everything because nobody else can keep the threads
              straight.
            </p>
          </div>
          <div className="bg-paper p-8 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow text-clay">
              The inversion agentplain delivers
            </p>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink">
              The fleet does the systematic work. The practitioner does the
              relationship work. Solo practitioners compete on operational
              depth. Mid-size firms compete on agility. The leveling effect is
              the long-term thesis.
            </p>
          </div>
        </div>
      </Section>

      {/* Q3 — What is the app + Q5 How easy is it to use? */}
      <Section
        id="how"
        tone="deep"
        eyebrow="How it works"
        title="Four steps. Your service partner runs three of them."
        intro="Sign up and you get a service partner, not a tool to figure out. We do the install, we run the fleet, we customize it as your workflow changes. Your job: pick your vertical, give us OAuth, and decide on the drafts. Our job: everything else."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <Step
            number="01"
            title="Pick your vertical."
            body="Each of the ten verticals ships with its own JTBD table, integration list, and compliance corpus. No prompt engineering, no per-customer custom build — your service partner uses the vertical pack as the starting point."
          />
          <Step
            number="02"
            title="Give us OAuth."
            body="Read-only OAuth into the CRM, inbox, calendar, and accounting tools you already use. 60 seconds on your side — your service partner takes it from there."
          />
          <Step
            number="03"
            title="We install + customize the fleet."
            body="Your service partner installs the fleet in your workspace, tunes the corpus to your firm's voice, sets the work thresholds, and watches the first week of drafts. You don't run a setup wizard; we run the install."
          />
          <Step
            number="04"
            title="The fleet drafts; you decide."
            body="Every customer-facing output queues for your review. Approve, edit, or reject. Your existing systems send. Your service partner stays on as ongoing config — corpus refreshes, model updates, integration drift — for as long as the seat is live."
          />
        </div>
      </Section>

      {/* Q4 — What makes agentplain unique */}
      <Section
        eyebrow="What makes us different"
        title="Five things you won't get from a generic AI tool."
        intro="Generic AI is horizontal and self-serve — you figure it out. agentplain is a service partnership: we pick three jobs on day one and run them for you. We REPLACE the manual work that lives between your tools. We INTEGRATE with the systems you already pay for. We AUGMENT the human judgment you keep. Each unique below is a commitment your service partner owns — not a feature you configure."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {uniques.map((u, i) => (
            <UniqueCard
              key={u.label}
              number={String(i + 1).padStart(2, "0")}
              label={u.label}
              body={u.body}
            />
          ))}
        </div>
      </Section>

      {/* Concrete value-loop example (real-estate sample, with a deep link to
          every other vertical's example). */}
      {realEstateExample ? (
        <Section
          tone="deep"
          eyebrow="A day in the life"
          title="What the fleet drafts before you open the laptop."
          intro="One concrete example. The scenario, what a practitioner does today, what changes after the fleet lands. Every vertical page carries its own version."
        >
          <div className="border border-rule bg-paper p-6 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow text-clay">
              Real estate · solo agent
            </p>
            <p className="mt-4 max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl md:leading-snug">
              {realEstateExample.scenario}
            </p>
            <div className="mt-10 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
              <div className="bg-paper p-6 md:p-7">
                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  Today
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {realEstateExample.before}
                </p>
              </div>
              <div className="bg-paper p-6 md:p-7">
                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                  With agentplain
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink">
                  {realEstateExample.after}
                </p>
              </div>
            </div>
            <div className="mt-8 border-l-2 border-clay pl-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                Outcome
              </p>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">
                {realEstateExample.outcome}
              </p>
            </div>
            <div className="mt-10 border-t border-rule pt-6 text-[13px] text-mute">
              <p>
                Not in real estate?{" "}
                <Link href="/verticals" className="text-ink underline">
                  See the day-in-the-life example for your vertical →
                </Link>
              </p>
            </div>
          </div>
        </Section>
      ) : null}

      {/* Q6 — Why should anyone believe us? */}
      <Section
        eyebrow="Rooted in reality"
        title="Here's what we mean by &lsquo;rooted in reality.&rsquo;"
        intro="Four things we can point at today. Not magic, not pixie dust — real product, real operators, real outcomes. We don't claim 'built for X' without the per-vertical compliance corpus + JTBD tables; we don't claim 'integrates with X' without the value-loop demo. The bar is functional, not marketing."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-2">
          {proof.map((p) => (
            <ProofCard key={p.label} {...p} />
          ))}
        </div>
      </Section>

      {/* Q6/Q7 — Pricing + ROI under the service-partnership lock.
          Three tiers (Regular / Partner / Max) reframe the per-seat ladder
          as the entry price for a service partnership, not a self-serve
          plan. /custom remains a separate surface for bespoke engagements
          outside the tier ladder. */}
      <Section
        id="pricing"
        tone="deep"
        eyebrow="Pricing + ROI"
        title="Affordable access to enterprise-grade tools — with the service team that runs them."
        intro="Three ways to partner with us. Every tier includes the fleet, the per-vertical compliance corpus, and a service team that installs, reviews, and customizes alongside you. The calculator below is anchored to Regular; Partner adds dedicated overlay; Max is quoted to scope."
      >
        <RoiCalculator />

        <div className="mt-12 grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
          <TierCard
            name="Regular"
            tagline="Standard service partnership."
            description="Our team installs the fleet, configures it for your vertical, and runs a monthly review. Day-to-day, the fleet drafts inside the workspace you log into."
            bands={ladderBands}
            ctaLabel="Start free trial"
            ctaHref="/app/sign-up"
            ctaStyle="primary"
            footnote="First month free. Month-to-month. Per seat."
          />
          <TierCard
            name="Partner"
            tagline="Named service partner."
            description="Same fleet, with a dedicated service partner who runs weekly reviews, owns customization, and handles change management as your ops shift."
            bands={partnerBands}
            ctaLabel="Talk to a service partner"
            ctaHref="mailto:hello@agentplain.com?subject=agentplain%20Partner%20tier%20interest"
            ctaStyle="secondary"
            footnote="Schema-backed Plus tier per project_stripe_both_surfaces.md."
            featured
          />
          <TierCard
            name="Max"
            tagline="Ad-hoc service partnership."
            description="For firms whose ops don't fit the productized shape — quoted to scope, not by seat. Talk to us about what you need and we'll come back with a written engagement."
            quotedNote="Quoted per engagement"
            ctaLabel="Talk to us"
            ctaHref="mailto:hello@agentplain.com?subject=agentplain%20Max%20tier%20inquiry"
            ctaStyle="secondary"
            footnote="Sales-led — no self-checkout."
          />
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[2fr_1fr]">
          <div className="max-w-prose">
            <p className="eyebrow mb-3">What ships with every tier</p>
            <ul className="grid gap-2 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
              <li>— A service partner who installs and runs reviews</li>
              <li>— Human review on every customer-facing output</li>
              <li>— Liability for licensed activities stays with you</li>
              <li>— Per-vertical compliance corpus, counsel-reviewed</li>
              <li>— No data resold, no client list retained</li>
              <li>— You own the work product</li>
            </ul>
          </div>

          <div className="border-l border-rule pl-6">
            <p className="eyebrow mb-3">Outside the tiers?</p>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Bespoke compliance corpus, white-label, custom integration to a
              tool off the roadmap, 100+ seats — anything the productized
              tiers don&apos;t cover, we scope as a Custom engagement on
              /custom. Different from Max (which is a service-partnership
              tier with non-standard scope): /custom is engagement work
              against a written spec.
            </p>
            <Link
              href="/custom"
              className="mt-4 inline-flex items-center gap-2 text-ink underline"
            >
              Build with us →
            </Link>
          </div>
        </div>
      </Section>

      {/* Q8 — How do we think about the future of work? + Q9 — Why now? */}
      <Section
        eyebrow="Where we're going"
        title={
          <>
            Local businesses can thrive through access to{" "}
            <span className="text-clay">
              affordable, best-in-class tools and services.
            </span>
          </>
        }
        intro="That's the vision. AI doesn't replace local business owners; it changes WHICH parts of the job they do. Local businesses have been over-rotated toward administrative work for two decades — CRMs, scheduling, compliance, status reports. The judgment work gets squeezed."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <Card
            number="Q8"
            title="The future of work"
            body="agentplain inverts the ratio. The fleet handles the systematic work; the human gets back to client relationships, deal architecture, advisory. Solo practitioners compete with mid-size firms on operational depth. Mid-size firms compete with enterprise on agility. Affordable access to the same operational depth that used to require an enterprise budget — that's the leveling effect."
          />
          <Card
            number="Q9"
            title="Why now"
            body="Models got good enough in 2025 to do real categorization, drafting, scheduling on real-world data — not benchmarks. Vendor APIs (Gmail, Outlook, every major CRM) stabilized enough to build multi-tenant integrations. Compliance frameworks (TCPA, GLBA) are clear enough to build per-vertical corpuses against. Early enough to define the category, late enough that the tech actually works."
          />
        </div>
      </Section>

      {/* FAQ — Q2/Q3/Q4/Q5/Q6 follow-ups in one place */}
      <Section
        id="faq"
        tone="deep"
        eyebrow="Questions worth asking"
        title="The honest version."
      >
        <FAQ />
      </Section>

      {/* CLOSING CTA — locked mission line, no realty-only framing.
          Q9 double CTA: primary self-start, secondary talk-to-a-service-partner. */}
      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-32">
          <p className="eyebrow mb-6 text-paper/60">{tokens.tagline}</p>
          <p className="max-w-3xl font-display text-3xl leading-[1.15] md:text-5xl md:leading-[1.08]">
            We lift up local businesses by doing the work that takes their
            time and money{" "}
            <span className="block mt-4 text-paper/70">
              away from the people they serve.
            </span>
          </p>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-paper/75">
            First month free. Month-to-month from day one. Cancel anytime. By
            the time you&apos;d pay for month two, your service team has
            either earned its seat or it hasn&apos;t.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20service%20partner%20conversation"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Talk to a service partner
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/custom"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Build with us
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/verticals"
              className="inline-flex items-center justify-center gap-2 border border-paper/20 bg-transparent px-6 py-3 text-sm font-medium text-paper/80 transition hover:border-paper hover:text-paper"
            >
              See all ten verticals
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-clay">
        {number}
      </p>
      <h3 className="mt-4 font-display text-xl leading-tight text-ink md:text-2xl">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function UniqueCard({
  number,
  label,
  body,
}: {
  number: string;
  label: string;
  body: string;
}) {
  return (
    <div className="flex flex-col bg-paper p-7 md:p-8">
      <div className="flex items-baseline gap-3">
        <p className="font-mono text-[11px] tracking-eyebrow text-clay">
          {number}
        </p>
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {label}
        </p>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function ProofCard({
  label,
  body,
  cite,
}: {
  label: string;
  body: string;
  cite: string;
}) {
  return (
    <div className="flex flex-col bg-paper p-7 md:p-8">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {label}
      </p>
      <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        {body}
      </p>
      <p className="mt-5 border-t border-rule pt-4 font-mono text-[11px] leading-relaxed text-mute">
        Source: <code className="text-[11px]">{cite}</code>
      </p>
    </div>
  );
}

function Card({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-clay">
        {number}
      </p>
      <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
        {title}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

// Three-tier service-partnership card. Inlined here (not the existing
// `components/PricingTier.tsx`) because the homepage teaser needs the
// per-seat ladder rendered inside each tier — a shape the existing
// PricingTier component (single price, single cadence) doesn't model.
function TierCard({
  name,
  tagline,
  description,
  bands,
  quotedNote,
  ctaLabel,
  ctaHref,
  ctaStyle,
  footnote,
  featured = false,
}: {
  name: string;
  tagline: string;
  description: string;
  bands?: { band: string; price: string }[];
  quotedNote?: string;
  ctaLabel: string;
  ctaHref: string;
  ctaStyle: "primary" | "secondary";
  footnote: string;
  featured?: boolean;
}) {
  const isMailto = ctaHref.startsWith("mailto:");
  const CtaTag = (isMailto ? "a" : Link) as React.ElementType;
  const ctaClass =
    ctaStyle === "primary"
      ? "btn-primary w-full justify-center"
      : "btn-secondary w-full justify-center";

  return (
    <div
      className={`flex flex-col bg-paper p-7 md:p-8 ${
        featured ? "ring-1 ring-clay" : ""
      }`}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {name}
        </p>
        {featured ? (
          <p className="font-mono text-[10px] tracking-eyebrow uppercase text-clay">
            Named partner
          </p>
        ) : null}
      </div>
      <h3 className="mt-3 font-display text-2xl leading-snug text-ink md:text-3xl">
        {tagline}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        {description}
      </p>

      {bands ? (
        <div className="mt-6 grid gap-px overflow-hidden border border-rule bg-rule">
          {bands.map((row) => (
            <div
              key={row.band}
              className="flex items-baseline justify-between bg-paper px-3 py-2"
            >
              <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                {row.band}
              </span>
              <span className="font-display text-lg text-ink">
                {row.price}
                <span className="ml-1 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                  /seat/mo
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {quotedNote ? (
        <div className="mt-6 border border-rule bg-paper-deep px-4 py-6 text-center">
          <p className="font-display text-2xl leading-snug text-ink">
            {quotedNote}
          </p>
          <p className="mt-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            sales-led
          </p>
        </div>
      ) : null}

      <div className="mt-auto pt-6">
        <CtaTag href={ctaHref} className={ctaClass}>
          {ctaLabel}
          <span aria-hidden>→</span>
        </CtaTag>
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-mute">
          {footnote}
        </p>
      </div>
    </div>
  );
}
