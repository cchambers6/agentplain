import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";

export const metadata: Metadata = {
  title: "Capabilities — agentplain",
  description:
    "Concrete deliverables, not abstract claims. Inbound leads get a personalized response in under 60 seconds. Listings ship in 10 minutes. Every output passes a compliance gate. Here is the full inventory.",
};

const groups = [
  {
    eyebrow: "Lead intake & response",
    title: "Lead-gen handled.",
    body: "Most offices lose deals to slow first response. The fleet closes that gap.",
    items: [
      {
        name: "Sub-60-second inbound reply",
        body: "Every inbound lead — Zillow, Realtor.com, web form, referral email — gets a personalized first response in under 60 seconds. Customized to the inquiry, signed by the right realtor, sent from your domain.",
      },
      {
        name: "Lead classification & routing",
        body: "Inbound is classified by intent (buyer / seller / investor / vendor noise), tagged with property and price band, and routed to the right agent on your team. No more tabs of fresh leads no one followed up on.",
      },
      {
        name: "Long-tail nurture drafts",
        body: "Leads that are not ready today get scheduled, on-brand follow-ups drafted into your inbox at the right cadence. You approve. Your domain sends. They re-engage when their search picks up.",
      },
    ],
  },
  {
    eyebrow: "Email & inbox",
    title: "Inbox triage that actually works.",
    body: "Drafts in your existing inbox so the email goes out from your team, on your sender reputation. We do not stand up a parallel outbound channel.",
    items: [
      {
        name: "Sub-2-minute draft replies",
        body: "Every inbound email gets a draft reply in under two minutes, with the right context attached (deal stage, prior threads, calendar availability). Ready for one-click approval.",
      },
      {
        name: "Vendor / spam suppression",
        body: "The agent learns which senders are vendor pitches, which are referrals, and which are real customer threads. Vendor noise is filed; customer threads are surfaced.",
      },
      {
        name: "Calendar coordination",
        body: "Showings, listing appointments, closings — the agent reads the thread, finds the open windows, drafts the proposal. No back-and-forth tab juggling.",
      },
    ],
  },
  {
    eyebrow: "Listings",
    title: "Listings ship in 10 minutes.",
    body: "From signed agreement to MLS-ready package — copy, photos prepped, disclosures checked, marketing pack queued.",
    items: [
      {
        name: "AI-written, compliance-checked copy",
        body: "MLS description, listing remarks, agent-only notes — all drafted in your house style and run through a state-specific disclosure check before you see them. 10 minutes from intake form to approve-ready package.",
      },
      {
        name: "Property site per listing",
        body: "Single-property landing page generated for every listing. Branded to you, hosted under your domain, optimized for search. Ready to share by the time the photographer leaves.",
      },
      {
        name: "Listing marketing pack",
        body: "Brochures, social posts, email blast, flyer — all branded to your office, ready for review the same day the listing goes live. Delivered weekly for active listings.",
      },
    ],
  },
  {
    eyebrow: "Marketing & content",
    title: "Marketing on autopilot, on your brand.",
    body: "Drafted and queued, not autopublished. You stay the editor; the fleet does the work that gets dropped on busy weeks.",
    items: [
      {
        name: "Weekly social pack",
        body: "Per-realtor social posts every week — new listings, market commentary, just-closed callouts, neighborhood updates. Branded to you, queued in your existing scheduler. You approve.",
      },
      {
        name: "Buyer & seller guides",
        body: "Personalized buyer / seller guides per lead, populated with the right neighborhood data, tax basics, and typical timelines. Ready to attach to the first reply.",
      },
      {
        name: "Open-house follow-up",
        body: "Every open-house attendee gets a personalized thank-you with the right comps and a soft next-step within an hour of the open house ending.",
      },
    ],
  },
  {
    eyebrow: "Transactions",
    title: "Deals don't fall on deadlines.",
    body: "Once you're under contract, the fleet runs the timeline so you don't have to.",
    items: [
      {
        name: "Deadline tracking & nudges",
        body: "Inspection, financing, appraisal, contingency removal — every deadline is monitored. Parties get nudged before they slip. You see the dashboard; you don't have to chase.",
      },
      {
        name: "Document collection",
        body: "Disclosures, proof of funds, addenda — the fleet asks for what's missing, follows up on the asks, and files what comes back into your transaction system.",
      },
      {
        name: "Closing-day prep",
        body: "Pre-closing checklist run automatically. Title, lender, and counterparty status pulled. Anything still open is escalated to you 48 hours out.",
      },
    ],
  },
  {
    eyebrow: "Compliance & data",
    title: "Compliance gate on every customer-facing output.",
    body: "The boring layer that keeps you out of trouble. Built in, not bolted on.",
    items: [
      {
        name: "Pre-publication compliance review",
        body: "Every customer-facing output — listing copy, social, email blast — is reviewed for fair-housing language, missing disclosures, broker-of-record requirements before it ships.",
      },
      {
        name: "CRM hygiene",
        body: "Contacts deduped, phones and addresses normalized, missing fields filled from public records, stale records flagged. Quietly maintains the asset most offices neglect.",
      },
      {
        name: "Production reporting",
        body: "Agent-by-agent and office-level production reports, ready every Monday. Variance commentary written by the agent, reviewed by the broker. The reports owners actually want.",
      },
      {
        name: "Recruiting research",
        body: "Local agents who fit your brokerage profile sourced, scored, and queued with personalized outbound openers. The recruiting work owners say they'll do and rarely have time for.",
      },
    ],
  },
];

export default function CapabilitiesPage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Capabilities · Pin 1 vertical: realty</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Concrete deliverables.
            <br />
            <span className="text-signal">Not abstract claims.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            What the fleet actually does, every day, on every seat. Hard
            numbers where we have them. Honest scope where we don't. Every
            item below is in the catalog today and runs as part of every
            seat at every tier.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/pricing" className="btn-primary">
              See pricing
              <span aria-hidden>→</span>
            </Link>
            <Link href="/platform" className="btn-secondary">
              How the platform works
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* CAPABILITY GROUPS */}
      {groups.map((group, idx) => (
        <Section
          key={group.title}
          tone={idx % 2 === 0 ? "deep" : "paper"}
          eyebrow={group.eyebrow}
          title={group.title}
          intro={group.body}
        >
          <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <div key={item.name} className="bg-paper p-7">
                <h3 className="font-display text-xl leading-tight text-ink md:text-2xl">
                  {item.name}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ))}

      {/* CUSTOM BUILDS */}
      <Section
        eyebrow="Beyond the catalog"
        title="If your office has a workflow we don't cover, we build it."
        intro="Custom agents and custom integrations are scoped engagements. They become part of your workspace, inherit the same review and audit rails, and feed back into the catalog as candidates for the next vertical release."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          <div className="bg-paper p-8 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow text-signal">
              Add-on
            </p>
            <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
              Custom agent build
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Scoped during discovery, built by us, deployed into your
              workspace alongside catalog agents. Versioned, rollback-able,
              audit-logged. Priced per scope, not per month.
            </p>
          </div>
          <div className="bg-paper p-8 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow text-signal">
              Add-on
            </p>
            <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
              Custom integration adapter
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Built when your office runs on an in-house system or a CRM
              outside the standard adapter set. Adapter pattern — the agents
              don't know which CRM they're talking to. Priced per scope.
            </p>
          </div>
        </div>
      </Section>

      {/* HOW THE FLEET CHANGES BY VERTICAL */}
      <Section
        tone="deep"
        eyebrow="Other verticals"
        title="The platform is the same. The catalog changes."
        intro="Realty is Pin 1 — the catalog above is what is in pilot today. Other verticals get their own catalog tuned to their work; the rails (review, audit, isolation, billing) are identical."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <RoadmapItem name="Mortgage" />
          <RoadmapItem name="Insurance" />
          <RoadmapItem name="Property management" />
          <RoadmapItem name="Title & escrow" />
        </div>
        <p className="mt-6 max-w-3xl text-[14px] leading-relaxed text-slate-soft">
          On the roadmap. We will name a launch date for any of these once
          there is a real customer in pilot — not before.
        </p>

        <div className="mt-10">
          <Link
            href="/verticals"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See verticals roadmap →
          </Link>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Pick the capability that hurts the most. We'll start there.
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            Most offices come in with one specific job they want fixed —
            inbound response, listing turnaround, transaction chasing. We
            light up the relevant agents first and expand from there.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20capabilities"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Talk to us
            </a>
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

function RoadmapItem({ name }: { name: string }) {
  return (
    <div className="bg-paper p-6">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
        Roadmap
      </p>
      <p className="mt-3 font-display text-xl leading-tight text-ink md:text-2xl">
        {name}
      </p>
    </div>
  );
}
