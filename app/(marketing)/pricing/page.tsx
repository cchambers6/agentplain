import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import RoiCalculator from "@/components/RoiCalculator";
import JsonLd from "@/components/seo/JsonLd";
import { FaqList, pricingFaqItems } from "@/components/FAQ";
import { faqPageJsonLd } from "@/lib/seo/structured-data";
import { alternatesFor } from "@/lib/seo/metadata";

import {
  ANNUAL_PRICE_USD_CENTS,
  MONEY_BACK_GUARANTEE_DAYS,
  MONTHLY_PRICE_USD_CENTS,
  PARTNER_SUPPORT,
  TRIAL_PERIOD_DAYS,
  TRIAL_PERIOD_DAYS_EXTENDED,
} from "@/lib/billing/facts";
import HeroBackdrop from "@/components/marketing/HeroBackdrop";
import {
  ApClosingBand,
  ApClosingBandAction,
} from "@/components/ui/ap";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `One flat price: $${MONTHLY_PRICE_USD_CENTS / 100}/month, any team size, every vertical. Month-to-month, ${TRIAL_PERIOD_DAYS}-day free trial, card at signup, ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee. Custom engagements on /custom.`,
  alternates: alternatesFor("/pricing"),
};

// Pricing page. ONE FLAT PRICE — `MONTHLY_PRICE_USD_CENTS` in
// `lib/billing/facts.ts`. This page's information architecture WAS three
// columns x five volume bands; that whole shape is retired. Under flat
// pricing the two self-serve columns rendered the identical number, so the
// comparison grid was showing a choice that no longer existed.
//
// What survives, and why:
//   * The quoted-engagement path. Law and RIA are quote-gated
//     (`isSelfServeTier("max") === false`). That is a different SALES MOTION,
//     not a different price, and this page must not imply otherwise.
//   * /custom. Bespoke capability builds ($5K-$15K + maintenance) are a
//     DIFFERENT PRODUCT and are unaffected by the flat-price change.
//   * The Partner support difference (priority email/chat + a quarterly async
//     check-in, and explicitly NO reserved hours). Real difference in SERVICE,
//     not in price — so it reads as an included feature, not a second column.
//
// Story-arc per `feedback_everything_tells_a_story.md`:
//   1. What does this cost?        → the one price + ROI calc
//   2. Does it change as I grow?   → no; stated plainly
//   3. What ships with it?         → guarantees list
//   4. What if I need more?        → /custom link (engagement, not a tier)
//   5. Why should I trust it?      → cited memory rules

// The one price, read from the billing SSOT. Formatted once, used everywhere
// on this page, so /pricing can never drift from what Stripe actually charges.
const MONTHLY = `$${MONTHLY_PRICE_USD_CENTS / 100}`;
const ANNUAL = `$${(ANNUAL_PRICE_USD_CENTS / 100).toLocaleString("en-US")}`;

const sharedGuarantees = [
  "A service partner who installs the fleet and runs reviews",
  `${TRIAL_PERIOD_DAYS}-day free trial across every seat band (${TRIAL_PERIOD_DAYS_EXTENDED} days for CPA + Law)`,
  "Month-to-month — cancel any time",
  "Human review on every customer-facing output",
  "Liability for licensed activities stays with you",
  "Per-vertical compliance corpus — real-estate scanner fires live; others gated until counsel review",
  "No data resold; no client list used to train models",
  "You own the work product",
];

// The three objections buyers actually raise at the pricing decision, each
// answered from a source of truth: trial/money-back numbers from
// `lib/billing/facts.ts`, the flat-fee/no-overage promise from the customer
// billing surface (BudgetSummary + /usage — the fleet's activity is visible,
// never surprise-billed), support channels from PARTNER_SUPPORT. Rendered as
// its own section so a skimmer hits them without opening the FAQ.
const objections: { q: string; a: string }[] = [
  {
    q: "What if it doesn't work for us?",
    a: `You find out on our dime, not yours. The ${TRIAL_PERIOD_DAYS}-day free trial (${TRIAL_PERIOD_DAYS_EXTENDED} days for CPA + Law) runs on your real inbox and tools, not a demo — by the end you've approved real drafts or you haven't. After the trial, the ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee covers your first charge. And it's month-to-month: cancel from billing settings, no long-term contract to escape.`,
  },
  {
    q: "What if my volume is unpredictable?",
    a: "Your price doesn't move with it. The fee is one flat monthly amount — no metered usage line, no overage charges. A heavy month is our cost to manage, not yours. The usage page in your workspace shows the fleet's last-30-day activity, so what it's doing is never a mystery; if usage outgrows your plan, your service partner raises it as a conversation, never as a surprise on the invoice.",
  },
  {
    q: "What if I need help?",
    a: `A human answers, and the channel is stated up front. Every customer gets email and chat support at ${PARTNER_SUPPORT.supportEmail}, plus the monthly review where tuning questions get worked. Firms with higher stakes get priority support — a faster line — and the quarterly async check-in. Scoped engagements set their support shape in the written engagement, including named service hours.`,
  },
];

// What the partnership looks like in practice. NOT a plan chooser: there is
// ONE price and one Stripe Price, so there is nothing here to pick between on
// the way to checkout. This block used to be a three-column
// "which tier is for me" comparison, which under flat pricing described a
// choice the customer cannot actually make. It now describes how the SERVICE
// shapes itself around a firm — and names the one genuine fork, which is
// whether you buy online or get scoped.
const whenToChoose = [
  {
    tier: "Most firms",
    headline: "Install, review, tune.",
    body: "A service partner installs the fleet, runs the monthly review, and handles tuning between reviews over email and chat. Your day-to-day stays inside the workspace you log into. This is the standard shape and it is what most local-business shops get.",
    examples: [
      "Solo or small-team realtor / mortgage broker / CPA",
      "Steady weekly ops, predictable case mix",
      "First-time AI ops adoption",
    ],
  },
  {
    tier: "Higher stakes",
    headline: "Priority support + a quarterly check-in.",
    body: "When the cost of a bad draft is high, or your operation changes week over week, the partnership adds priority support — a faster line when something needs attention — and a quarterly async check-in with your service team to step back and tune. Included, not an upcharge.",
    examples: [
      "Litigation, wealth management, broker-of-record-heavy comms",
      "Multi-team firm with growth or restructure in flight",
      "You'd rather have a priority line than standard turnaround",
    ],
  },
  {
    tier: "Scoped engagement",
    headline: "When the standard shape isn't the right shape.",
    body: "Some operations don't fit the productized shape — different cadence, different deliverables, a written engagement. Law and RIA go this way by default. Sales-led: talk to us about what you need and scope drives the quote, not headcount.",
    examples: [
      "Non-standard compliance posture",
      "Cross-vertical ops in a single firm",
      "Service overlap with your in-house ops team",
    ],
  },
];

// Build-it-yourself vs. plug-and-play-with-agentplain. Four dimensions that
// actually cost the owner. Vendor-generic per the 2026-06-11 customer-surface
// rule: the underlying AI model is never named on a customer surface. The
// honest contrast is configure-and-maintain-it-yourself vs. have-it-run-for-you
// — never disparagement of any one tool.
const SBM_COMPARISON: { dimension: string; diy: string; us: string }[] = [
  {
    dimension: "Cost",
    diy: "The subscription is cheap — but the real cost is the months of configuration time, plus per-skill engineering you do (or hire) to make it do your job.",
    us: "One bundled flat fee, month-to-month, whatever your headcount. The skills, agents, and integrations come pre-built — no engineering line item.",
  },
  {
    dimension: "Time to value",
    diy: "Weeks to months: learn prompting, decide which agents to build, write the skills, wire each integration, then tune until it's reliable.",
    us: `Days. We install the per-vertical fleet, connect your tools, and you're approving real drafts in the first week. ${TRIAL_PERIOD_DAYS}-day free trial, card at signup.`,
  },
  {
    dimension: "Ongoing maintenance",
    diy: "You own it forever — curating memory, pruning stale context, updating prompts and skills as your ops and the model change.",
    us: "Your service partner owns it — memory management, tuning, and customization handled in recurring reviews. You never touch a config file.",
  },
  {
    dimension: "Compliance depth",
    diy: "You research the regulations and write the guardrails yourself, with no safety net if you miss one.",
    us: "A per-vertical compliance corpus pre-checks customer-facing drafts. The real-estate fair-housing scanner fires live today; the other verticals' corpora are drafted and gated until counsel review.",
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
          <span className="dateline mb-6 inline-block">Plans · 2026</span>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            {MONTHLY} a month.
            <br />
            <span className="text-clay">That&rsquo;s the whole price list.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            One price, the same for every firm and every vertical — it does
            not change with the number of people you put on it. We install the
            fleet, run reviews, and customize alongside you. Month-to-month.{" "}
            {TRIAL_PERIOD_DAYS}-day free trial, card at signup.{" "}
            <Link
              href="/guarantee"
              className="text-ink underline underline-offset-4 hover:text-clay-deep"
            >
              {MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee
            </Link>
            .
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
        eyebrow="The price"
        title="One price. However big you get."
        intro="There is no seat rate, no volume ladder, and no plan to compare against another plan. A solo operator and a forty-person firm pay the same."
      >
        <span className="dateline mb-8 inline-block">The whole price list</span>
        <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-2">
          <TierColumn
            name="The subscription"
            tagline="One price. Any size firm."
            description="A service partner installs the fleet, runs a monthly review, and tunes between reviews. Day-to-day it drafts in the workspace you log into. Priority support and a quarterly async check-in with your service team are included — and so is every person you add."
            price={MONTHLY}
            priceNote={`a month · ${ANNUAL} a year · any team size`}
            ctaLabel="Start free trial"
            ctaHref="/app/sign-up"
            ctaStyle="primary"
            footnote={`${TRIAL_PERIOD_DAYS}-day free trial. Month-to-month. One flat price.`}
            featured
          />
          <TierColumn
            name="Scoped engagement"
            tagline="When the standard shape isn't the right shape."
            description="Some firms — law and RIA especially — are scoped rather than bought off the page: different cadence, different deliverables, a written engagement. Scope drives the quote, not headcount."
            quotedNote="Quoted to scope"
            ctaLabel="Talk to us"
            ctaHref="mailto:hello@agentplain.com?subject=agentplain%20engagement%20inquiry"
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
        intro="Enter your own numbers. The calculator is pure client-side; you can audit the formula in view-source. Conservative inputs are 8–15 hr/wk on systematic ops at a $75–$150/hr productive-hour opportunity cost. The calculator compares your recovered hours against the one flat monthly price — because the price does not scale with headcount, every person you add improves the ratio."
      >
        <RoiCalculator />
      </Section>

      <Section
        eyebrow="What the partnership looks like"
        title="Same price. The service shapes itself to your week."
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
        eyebrow="Run it yourself — or plug in agentplain"
        title="Build it yourself — or plug in agentplain."
        intro="A capable AI tool is the engine. You can wire it up yourself, or have us run it for you. Here's the honest comparison across the four things that actually cost you."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          {/* Column heads */}
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              Build it yourself
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
          Not a knock on the tools — they&apos;re genuinely capable. The gap is
          everything between &ldquo;powerful tool&rdquo; and &ldquo;running your
          business.&rdquo; That gap is the service.
        </p>
        <Link
          href="/compare"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4 hover:text-clay"
        >
          See the full comparison
          <span aria-hidden>→</span>
        </Link>
      </Section>

      <Section
        tone="forest"
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
        eyebrow="The three objections"
        title="Asked before every yes. Answered here."
        intro="If you're weighing this against doing nothing, these are the three questions that decide it. Straight answers, each backed by the policy pages they cite."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          {objections.map((row) => (
            <div key={row.q} className="bg-paper p-7 md:p-8">
              <h3 className="font-display text-2xl leading-snug text-ink">
                {row.q}
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                {row.a}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          The money-back terms live on{" "}
          <Link href="/guarantee" className="text-ink underline underline-offset-4">
            /guarantee
          </Link>
          ; data handling on{" "}
          <Link href="/privacy" className="text-ink underline underline-offset-4">
            /privacy
          </Link>
          .
        </p>
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

      {/* The shared grounded close (ApClosingBand, 2026-07-08) — this page
          used bg-ink while home closed on forest-deep; resolved one way. The
          money-back promise links to /guarantee. */}
      <ApClosingBand
        eyebrow="Start where it's free"
        title={
          <>
            {TRIAL_PERIOD_DAYS}-day free trial, card at signup. By day{" "}
            {TRIAL_PERIOD_DAYS} your service team has either shown up or it
            hasn&apos;t.{" "}
            <Link
              href="/guarantee"
              className="underline underline-offset-4 hover:text-wheat"
            >
              {MONEY_BACK_GUARANTEE_DAYS}-day money-back
            </Link>{" "}
            if it hasn&apos;t.
          </>
        }
        actions={
          <>
            <ApClosingBandAction href="/app/sign-up" variant="primary">
              Start free trial
            </ApClosingBandAction>
            <ApClosingBandAction href="mailto:hello@agentplain.com?subject=agentplain%20service%20partner%20conversation">
              Talk to a service partner
            </ApClosingBandAction>
            <ApClosingBandAction href="/custom" variant="quiet" withArrow={false}>
              Build with us
            </ApClosingBandAction>
          </>
        }
      />
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

// Pricing-page column. Inlined here for the same reason the homepage inlines
// TierCard. It used to render a per-seat volume ladder inside each column via
// `bands`, every row suffixed "/seat/mo"; under flat pricing that ladder is a
// single row and the two self-serve columns showed the same number. One price.
function TierColumn({
  name,
  tagline,
  description,
  price,
  priceNote,
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
  /** The one flat price, pre-formatted (e.g. "$99"). */
  price?: string;
  /** Cadence line under the price. */
  priceNote?: string;
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
        {/* Foil retired here: at 11px on cream its light gradient stops read
            at 1.3–2.1:1 (kaizen 2026-07-02 friction 6). The featured tier is
            already carried by the clay ring + "Priority support" chip. */}
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
          {name}
        </p>
        {featured ? (
          <p className="font-mono text-[10px] tracking-eyebrow uppercase text-clay">
            Priority support
          </p>
        ) : null}
      </div>
      <h3 className="mt-3 font-display text-2xl leading-snug text-ink md:text-3xl">
        {tagline}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        {description}
      </p>

      {price ? (
        <div className="mt-6 border border-rule bg-paper px-5 py-6">
          <p className="font-display text-5xl leading-none text-ink">{price}</p>
          {priceNote ? (
            <p className="mt-3 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
              {priceNote}
            </p>
          ) : null}
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
