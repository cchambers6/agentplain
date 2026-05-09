import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";

export const metadata: Metadata = {
  title: "For individual agents — agentplain",
  description:
    "A self-serve agent platform for individual practitioners. The same fleet that powers the brokerage tier, sized for one person. $49 / month or $500 / year.",
};

const usecases = [
  {
    title: "Inbox triage",
    body: "An agent reads inbound mail, classifies what is a real lead vs. a vendor pitch, attaches the right context, and queues the right reply for you to send.",
  },
  {
    title: "Listing intake",
    body: "Walks new listings from intake form to MLS-ready package. Drafts copy for your review and flags missing disclosures before they slow the deal down.",
  },
  {
    title: "Showing scheduling",
    body: "Coordinates showings across the buyer, the buyer's agent, and the listing agent. Confirms, reschedules, logs activity back to your CRM so you stop chasing calendars.",
  },
  {
    title: "CRM hygiene",
    body: "Dedupes contacts, normalizes phones and addresses, fills missing fields from public records, and keeps stale records flagged. Quietly maintains the asset most practitioners neglect.",
  },
  {
    title: "Production reporting",
    body: "Generates the weekly and monthly reports you would otherwise build in a spreadsheet. Variance commentary written by the agent, reviewed by you.",
  },
  {
    title: "Recurring follow-up",
    body: "The recurring follow-up that gets dropped on busy weeks. Agents draft the touch, you approve, your existing inbox sends it on your sender reputation.",
  },
];

export default function ForAgentsPage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">For individual agents</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            The same fleet.
            <br />
            <span className="text-signal">Sized for one.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            A self-serve version of the agent platform, built for individual
            practitioners. Connect your inbox and CRM, pick the agents that
            match how you work, and let them handle the recurring admin
            between deals. Native and web.
          </p>

          <div className="mt-10 grid max-w-2xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
            <PriceItem label="Monthly" price="$49" cadence="/ mo" />
            <PriceItem label="Annual" price="$500" cadence="/ yr" />
            <PriceItem label="Stage" price="Phase 3" cadence="building now" />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20self-serve%20waitlist"
              className="btn-primary"
            >
              Join the waitlist
              <span aria-hidden>→</span>
            </a>
            <Link href="/platform" className="btn-secondary">
              How the platform works
              <span aria-hidden>→</span>
            </Link>
          </div>

          <p className="mt-10 max-w-2xl border-t border-rule pt-6 text-[15px] leading-relaxed text-slate-soft">
            The brokerage tier is in pilot today. The self-serve app is in
            active build and will open to the waitlist when the first cohort
            of catalog agents is stable enough for unattended use. We will
            not charge before then.
          </p>
        </div>
      </section>

      {/* USE CASES */}
      <Section
        tone="deep"
        eyebrow="What it does for you"
        title="The recurring admin between deals."
        intro="The self-serve tier ships with a curated set of catalog agents that handle the work most individual practitioners would otherwise do in browser tabs after dinner. Custom agents are part of the brokerage tier, not the self-serve tier."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {usecases.map((u) => (
            <div key={u.title} className="bg-paper p-7">
              <h3 className="font-display text-xl leading-tight text-ink md:text-2xl">
                {u.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {u.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* WHAT YOU GET */}
      <Section
        eyebrow="What is included"
        title="A flat monthly. No per-agent fees, no per-integration fees."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl text-ink">Included</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— All catalog agents available to the self-serve tier</li>
              <li>— Standard integrations (CRM, inbox, calendar)</li>
              <li>— Workspace audit log and rollback</li>
              <li>— Approval gate on customer-facing drafts (always on)</li>
              <li>— Email support</li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl text-ink">Not included</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Custom agent development (brokerage tier only)</li>
              <li>— Custom server / internal-API integrations</li>
              <li>— Implementation sessions or working calls</li>
              <li>— On-call support outside business hours</li>
            </ul>
            <p className="mt-6 text-[14px] leading-relaxed text-slate-soft">
              If you need any of those, the brokerage tier is the right
              place. The self-serve tier is sized to be honest about what it
              does.
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Get on the waitlist for the self-serve app.
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            We will email when the first cohort of catalog agents is ready
            for unattended use. No charge before then.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20self-serve%20waitlist"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Join the waitlist
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
