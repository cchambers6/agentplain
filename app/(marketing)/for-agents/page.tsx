import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import StackComparison from "@/components/StackComparison";

export const metadata: Metadata = {
  title: "For solo realtors — agentplain",
  description:
    "$199 / month for solo. Replaces $510–$1,560 / month of typical realtor tooling. One extra closed deal per quarter — at a 2.5% commission on a $400K home that's $10,000 — pays for the year ten times over.",
};

const dayInTheLife = [
  {
    name: "Inbound from the night before",
    body: "Every overnight lead has a draft personalized reply waiting in your inbox. You skim, you approve, your domain sends. Sub-60-second response time without sub-60-second babysitting.",
  },
  {
    name: "New listing intake",
    body: "Walk in with a signed agreement. 10 minutes later you have MLS-ready copy, a single-property site, a social pack, and a flyer — all branded to you, all compliance-checked.",
  },
  {
    name: "Active deals",
    body: "Inspection deadlines, financing milestones, document collection — tracked, nudged, escalated only when something is at risk. You stop running the deadline spreadsheet.",
  },
  {
    name: "Long-tail nurture",
    body: "Last quarter's leads who said 'maybe in spring' get drafted, on-brand, time-relevant follow-ups at the right cadence. You approve a week's worth on Sunday night.",
  },
  {
    name: "Open-house follow-up",
    body: "Every Sunday open house turns into Monday-morning personalized thank-yous with the right comps and a soft next step — drafted before you finish coffee.",
  },
  {
    name: "End-of-month production",
    body: "Your month's production report, your CRM hygiene cleanup, and your tax-prep export are all ready Monday morning of the new month. You used to spend a full day on this.",
  },
];

export default function ForAgentsPage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">For solo realtors</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Close more deals.
            <br />
            <span className="text-signal">Without adding a back-office.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            $199 a month. Replaces $510–$1,560 a month of the typical
            realtor tool stack — CRM add-ons, lead-gen platforms, listing
            copy retainers, drip software, social schedulers, transaction
            management. The agents work inside the inbox and CRM you
            already use.
          </p>

          <div className="mt-10 grid max-w-2xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
            <PriceItem label="Monthly" price="$199" cadence="/ mo" />
            <PriceItem label="Annual" price="$1,990" cadence="/ yr" />
            <PriceItem label="Savings" price="2 mo" cadence="free annually" />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20solo"
              className="btn-primary"
            >
              Get started
              <span aria-hidden>→</span>
            </a>
            <Link href="/pricing#calculator" className="btn-secondary">
              Run the math
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* PER-DEAL PROOF */}
      <section className="border-b border-rule bg-paper-deep">
        <div className="container-wide py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="eyebrow mb-4">The math, plainly</p>
            <p className="font-display text-3xl leading-snug text-ink md:text-4xl">
              Close 1 extra deal a quarter from leads we keep warm. At a
              2.5% commission on a $400K home, that's <span className="text-signal">$10,000</span>.
              agentplain pays for the year in <span className="text-signal">~73 days</span>.
              Every closing after that is on top.
            </p>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
              And that's just the closed-deal line. You're also eliminating
              $300–$1,300 a month in tools the fleet replaces, and getting
              roughly 10–15 hours a week back from admin work that the
              agents handle in your existing tools.
            </p>
          </div>
        </div>
      </section>

      {/* STACK COMPARISON */}
      <Section
        eyebrow="Replaces these tools"
        title="Your stack is $510–$1,560 / month."
        intro="The typical solo realtor's tool load. agentplain replaces the work, your inbox and CRM stay where they are."
      >
        <StackComparison />
      </Section>

      {/* DAY IN THE LIFE */}
      <Section
        tone="deep"
        eyebrow="A week with the fleet"
        title="What's actually happening in the background."
        intro="The agents don't ask for attention unless something needs your decision. Most days, the only sign they're working is that drafts are already in your outbox and your deadlines are being tracked without you opening a spreadsheet."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {dayInTheLife.map((d) => (
            <div key={d.name} className="bg-paper p-7">
              <h3 className="font-display text-xl leading-tight text-ink md:text-2xl">
                {d.name}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {d.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-3xl border-t border-rule pt-6">
          <Link
            href="/capabilities"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See the full capability inventory →
          </Link>
        </div>
      </Section>

      {/* INCLUDED / NOT INCLUDED */}
      <Section
        eyebrow="What is included at $199"
        title="One flat price. No per-agent fees, no per-integration fees."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl text-ink">Included</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Every catalog agent for realty</li>
              <li>— Standard integrations (CRM, inbox, calendar, MLS export)</li>
              <li>— Compliance gate on customer-facing outputs</li>
              <li>— Workspace audit log and rollback</li>
              <li>— Email support</li>
              <li>— All catalog updates as new agents ship</li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl text-ink">Add-ons (optional)</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Custom agent build for a workflow the catalog doesn't cover</li>
              <li>— Custom integration adapter for a non-standard CRM or in-house system</li>
              <li>— Onboarding sprint with a senior implementer (most solos skip it)</li>
            </ul>
            <p className="mt-6 text-[14px] leading-relaxed text-slate-soft">
              Add-ons are scoped engagements priced per build, not gated
              tiers. Most solos never need one — the catalog covers
              recurring realty work end-to-end.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Get started solo.
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            Email goes to a real person. We will tell you up front whether
            the math works for how you run your book.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20solo"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Get started
            </a>
            <Link
              href="/brokerages"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              I run a brokerage instead
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function PriceItem({
  label,
  price,
  cadence,
}: {
  label: string;
  price: string;
  cadence: string;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-ink">
        {price}
        <span className="ml-2 font-sans text-sm text-slate-soft">{cadence}</span>
      </p>
    </div>
  );
}
