import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import RoiCalculator from "@/components/RoiCalculator";
import JsonLd from "@/components/seo/JsonLd";
import { FaqList, pricingFaqItems } from "@/components/FAQ";
import { faqPageJsonLd } from "@/lib/seo/structured-data";
import { alternatesFor } from "@/lib/seo/metadata";
import HeroBackdrop from "@/components/marketing/HeroBackdrop";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Three per-seat service-partnership tiers, month-to-month. Regular $199→$99, Partner $299→$199, Max quoted. First month free. Custom engagements on /custom.",
  alternates: alternatesFor("/pricing"),
};

// Pricing page. Anchored to the service-partnership three-tier model
// (ratified 2026-05-15 — supersedes the 2026-05-12 single-tier customer
// surface). The Plus / Max tier enum on disk maps to Partner / Max
// surfacing; the Plus per-seat numbers in `project_stripe_both_surfaces.md`
// HISTORICAL block back the Partner ladder.
//
// Story-arc per `feedback_everything_tells_a_story.md`:
//   1. What does this cost?      → three-tier grid + ROI calc
//   2. Which tier is for me?     → "When to choose what" guidance
//   3. What ships with every tier? → guarantees list
//   4. What if I need more?      → /custom link (engagement, not a tier)
//   5. Why should I trust it?    → cited memory rules

type Band = { band: string; price: string };

const regularBands: Band[] = [
  { band: "Solo (1 seat)", price: "$199" },
  { band: "2–9 seats", price: "$179" },
  { band: "10–24 seats", price: "$149" },
  { band: "25–49 seats", price: "$119" },
  { band: "50–99 seats", price: "$99" },
];

const partnerBands: Band[] = [
  { band: "Solo (1 seat)", price: "$299" },
  { band: "2–9 seats", price: "$269" },
  { band: "10–24 seats", price: "$239" },
  { band: "25–49 seats", price: "$219" },
  { band: "50–99 seats", price: "$199" },
];

const sharedGuarantees = [
  "A service partner who installs the fleet and runs reviews",
  "First month free, every seat band",
  "Month-to-month — cancel any time",
  "Human review on every customer-facing output",
  "Liability for licensed activities stays with you",
  "Per-vertical compliance corpus, counsel-reviewed",
  "No data resold; no client list used to train models",
  "You own the work product",
];

const whenToChoose = [
  {
    tier: "Regular",
    headline: "Standard service partnership.",
    body: "Most local-business shops fit here. A service partner installs the fleet, runs a monthly review call, handles tuning between calls. Your day-to-day stays inside the workspace.",
    examples: [
      "Solo or small-team realtor / mortgage broker / CPA",
      "Steady weekly ops, predictable case mix",
      "First-time AI ops adoption",
    ],
  },
  {
    tier: "Partner",
    headline: "Named service partner.",
    body: "Higher stakes or higher week-over-week change. A dedicated partner runs weekly reviews, owns customization, and handles change management as your ops shift.",
    examples: [
      "Litigation, wealth management, broker-of-record-heavy comms",
      "Multi-team firm with growth or restructure in flight",
      "You'd rather get a call than open a support ticket",
    ],
  },
  {
    tier: "Max",
    headline: "Ad-hoc service partnership.",
    body: "Your ops don't fit the productized shape. Different cadence, different deliverables, quoted to the engagement. Sales-led — talk to us about what you need.",
    examples: [
      "Non-standard compliance posture",
      "Cross-vertical ops in a single firm",
      "Service overlap with your in-house ops team",
    ],
  },
];

// Build-it-yourself-on-Claude vs. plug-and-play-with-agentplain. Four
// dimensions that actually cost the owner. Per
// project_sbm_wrapper_positioning_2026_06_06: complementary framing only —
// Claude is the engine; the service is the difference. No "instead of" / "vs."
// disparagement of the model itself.
const SBM_COMPARISON: { dimension: string; diy: string; us: string }[] = [
  {
    dimension: "Cost",
    diy: "The subscription is cheap — but the real cost is the months of configuration time, plus per-skill engineering you do (or hire) to make it do your job.",
    us: "One bundled flat fee, per seat, month-to-month. The skills, agents, and integrations come pre-built — no engineering line item.",
  },
  {
    dimension: "Time to value",
    diy: "Weeks to months: learn prompting, decide which agents to build, write the skills, wire each integration, then tune until it's reliable.",
    us: "Days. We install the per-vertical fleet, connect your tools, and you're approving real drafts in the first week. First month free.",
  },
  {
    dimension: "Ongoing maintenance",
    diy: "You own it forever — curating memory, pruning stale context, updating prompts and skills as your ops and the model change.",
    us: "Your service partner owns it — memory management, tuning, and customization handled in recurring reviews. You never touch a config file.",
  },
  {
    dimension: "Compliance depth",
    diy: "You research the regulations and write the guardrails yourself, with no safety net if you miss one.",
    us: "A per-vertical, counsel-reviewed compliance corpus pre-checks every customer-facing draft. The real-estate fair-housing scanner fires today.",
  },
];

export default function PricingPage() {
  const faqItems = pricingFaqItems();
  return (
    <>
      {/* FAQPage structured data — the pricing-topic subset of FAQ_ITEMS,
          which is ALSO rendered visibly below (Google requires FAQ JSON-LD to
          mirror on-page content). */}
      <JsonLd
        id="ld-pricing-faqpage"
        data={faqPageJsonLd(faqItems)}
      />
      <section className="relative overflow-hidden border-b border-rule bg-paper">
        <HeroBackdrop scene="pricing" />
        <div className="relative container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Pricing</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Three ways to partner.
            <br />
            <span className="text-clay">
              Affordable access to the team that runs it.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Every tier is a service partnership: we install the fleet, run
            reviews, and customize alongside you. Per seat, month-to-month.
            First month free across every band.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/app/sign-up" className="btn-primary">
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20pricing%20conversation"
              className="btn-secondary"
            >
              Talk to a service partner
              <span aria-hidden>→</span>
            </a>
            <Link href="#roi" className="text-ink underline">
              Run the ROI numbers →
            </Link>
          </div>
        </div>
      </section>

      <Section
        eyebrow="The three tiers"
        title="Same fleet, different service shape."
        intro="Pick the cadence and depth of partnership your shop needs. Switch up or down as your ops evolve."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
          <TierColumn
            name="Regular"
            tagline="Standard service partnership."
            description="A service partner installs, runs a monthly review, tunes between calls. Day-to-day in the workspace you log into."
            bands={regularBands}
            ctaLabel="Start free trial"
            ctaHref="/app/sign-up"
            ctaStyle="primary"
            footnote="First month free. Month-to-month. Per seat."
          />
          <TierColumn
            name="Partner"
            tagline="Named service partner."
            description="A dedicated partner runs weekly reviews, owns customization, handles change management as your ops shift."
            bands={partnerBands}
            ctaLabel="Talk to a service partner"
            ctaHref="mailto:hello@agentplain.com?subject=agentplain%20Partner%20tier%20interest"
            ctaStyle="secondary"
            footnote="First month free. Month-to-month. Per seat."
            featured
          />
          <TierColumn
            name="Max"
            tagline="Ad-hoc service partnership."
            description="Non-standard scope. Different cadence, different deliverables, quoted to the engagement."
            quotedNote="Quoted per engagement"
            ctaLabel="Talk to us"
            ctaHref="mailto:hello@agentplain.com?subject=agentplain%20Max%20tier%20inquiry"
            ctaStyle="secondary"
            footnote="Sales-led — no self-checkout."
          />
        </div>
      </Section>

      <Section
        id="roi"
        tone="deep"
        eyebrow="ROI"
        title="The math, not the vibes."
        intro="Enter your own numbers. The calculator is pure client-side; you can audit the formula in view-source. Conservative inputs are 8–15 hr/wk on systematic ops at a $75–$150/hr productive-hour opportunity cost. Calculator anchors to Regular; Partner uplift pays for the named-partner overlay."
      >
        <RoiCalculator />
      </Section>

      <Section
        eyebrow="When to choose what"
        title="Match the cadence to your week."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          {whenToChoose.map((row) => (
            <div key={row.tier} className="bg-paper p-7 md:p-8">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                {row.tier}
              </p>
              <h3 className="mt-3 font-display text-2xl leading-snug text-ink">
                {row.headline}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {row.body}
              </p>
              <p className="mt-5 eyebrow">Typical fit</p>
              <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-ink-soft">
                {row.examples.map((e) => (
                  <li key={e}>— {e}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        tone="deep"
        eyebrow="Built on Claude, configured by us"
        title="Build it yourself on Claude — or plug in agentplain."
        intro="Claude for Small Business is the engine. You can wire it up yourself, or have us run it for you. Here's the honest comparison across the four things that actually cost you."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          {/* Column heads */}
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              Build it yourself on Claude SBM
            </p>
            <p className="mt-2 font-display text-base leading-snug text-ink-soft">
              You configure and maintain it.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Plug-and-play with agentplain
            </p>
            <p className="mt-2 font-display text-base leading-snug text-ink">
              We configure and run it.
            </p>
          </div>

          {SBM_COMPARISON.map((row) => (
            <SbmCompareRow
              key={row.dimension}
              dimension={row.dimension}
              diy={row.diy}
              us={row.us}
            />
          ))}
        </div>
        <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-mute">
          Not a knock on Claude — it&apos;s a genuinely capable model. The gap is
          everything between &ldquo;powerful tool&rdquo; and &ldquo;running your
          business.&rdquo; That gap is the service.
        </p>
      </Section>

      <Section
        eyebrow="What ships with every tier"
        title="The same value loop, the same guardrails."
      >
        <ul className="grid gap-x-12 gap-y-3 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
          {sharedGuarantees.map((item) => (
            <li key={item}>— {item}</li>
          ))}
        </ul>
      </Section>

      <Section
        tone="deep"
        eyebrow="Outside the tiers?"
        title="When the productized tiers don't cover it, we scope custom."
        intro="Bespoke compliance corpus, white-label, custom integration to a tool that isn't on the roadmap, 100+ seats, custom reporting. /custom is engagement work — written spec, 4–6 week build, fixed price, then handoff. Different from Max (a service-partnership tier with non-standard scope): /custom is project work against a spec."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-[2fr_1fr]">
          <div className="bg-paper p-8 md:p-10">
            <p className="eyebrow mb-3">Pricing framework</p>
            <p className="max-w-prose text-[15px] leading-relaxed text-ink-soft">
              Starts at $5K. Typical engagement $5K–$15K plus $200–$500/mo
              maintenance. Scoping call → written spec → 4–6 week build →
              handoff → ongoing maintenance. No surprise charges.
            </p>
          </div>
          <div className="bg-paper p-8 md:p-10">
            <p className="eyebrow mb-3">Get scoped</p>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Tell us what you need; we&apos;ll come back with a written spec
              and a price. You can be on Regular or Partner AND have a
              /custom engagement at the same time.
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

      <Section
        id="faq"
        eyebrow="Pricing questions"
        title="The honest version on cost."
        intro="The five questions buyers actually ask about price, tiers, and ROI. The full FAQ lives on the homepage."
      >
        <FaqList items={faqItems} />
      </Section>

      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-32">
          <p className="eyebrow mb-6 text-paper/60">Start where it&apos;s free</p>
          <p className="max-w-3xl font-display text-3xl leading-[1.15] md:text-5xl md:leading-[1.08]">
            First month free. Month-to-month. By the time you&apos;d pay for
            month two, your service team has either earned its seat or it
            hasn&apos;t.
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
              className="inline-flex items-center justify-center gap-2 border border-paper/20 bg-transparent px-6 py-3 text-sm font-medium text-paper/80 transition hover:border-paper hover:text-paper"
            >
              Build with us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

// One row of the build-it-yourself-vs-plug-and-play comparison. Renders the
// DIY (left) then agentplain (right) cell so the hairline grid keeps the two
// columns aligned across breakpoints — same pattern as the homepage
// ContrastRow.
function SbmCompareRow({
  dimension,
  diy,
  us,
}: {
  dimension: string;
  diy: string;
  us: string;
}) {
  return (
    <>
      <div className="bg-paper p-7 md:p-8">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {dimension}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{diy}</p>
      </div>
      <div className="bg-paper p-7 md:p-8">
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {dimension}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{us}</p>
      </div>
    </>
  );
}

// Pricing-page tier column. Inlined here for the same reason the homepage
// inlines TierCard — the existing `components/PricingTier.tsx` models a
// single-price tier, and the service-partnership tiers need per-seat
// ladders inside each column.
function TierColumn({
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
  bands?: Band[];
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
              className="flex items-baseline justify-between bg-paper px-3 py-2.5"
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
