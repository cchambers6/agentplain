import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";

export const metadata: Metadata = {
  title: "Verticals — agentplain",
  description:
    "Realty is Pin 1 — the first vertical we are running end-to-end. The platform is vertical-agnostic by design; we will name additional verticals once they have a real customer in pilot.",
};

export default function VerticalsPage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">Verticals</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            One vertical at a time.
            <br />
            <span className="text-signal">Realty first.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            The platform is vertical-agnostic by design — the rails for
            review, audit, isolation, and integration are the same regardless
            of industry. The agents are not. Each vertical has its own
            catalog, its own integration set, and its own compliance posture.
            We ship one vertical end-to-end before opening the next.
          </p>
        </div>
      </section>

      {/* PIN 1: REALTY */}
      <Section
        eyebrow="Pin 1 · in pilot"
        title="Realty — brokerage operations."
        intro="The first vertical we are running end-to-end. Brokerage operations is dense with recurring admin — listing intake, buyer routing, showings, compliance, CRM hygiene, production reporting, recruiting. The catalog covers those jobs today, with custom builds where an office has its own variants."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          <CatalogJob
            name="Listing intake"
            body="From intake form to MLS-ready package. Drafts copy, flags missing disclosures, prepares the listing for human signoff."
          />
          <CatalogJob
            name="Buyer inquiry routing"
            body="Reads inbound from email, web forms, and CRM webhooks. Classifies intent, attaches context, routes without dropping leads on weekends."
          />
          <CatalogJob
            name="Showing scheduling"
            body="Coordinates showings across buyer, buyer's agent, listing agent. Confirms, reschedules, logs back to the CRM."
          />
          <CatalogJob
            name="Compliance review"
            body="Reviews customer-facing drafts and listings for fair-housing language, disclosure gaps, broker-of-record requirements."
          />
          <CatalogJob
            name="CRM hygiene"
            body="Dedupes contacts, normalizes phones and addresses, fills missing fields from public records, flags stale records."
          />
          <CatalogJob
            name="Production reporting"
            body="Agent-by-agent and office-level reports. Variance commentary written by the agent, reviewed by the owner."
          />
          <CatalogJob
            name="Recruiting prep"
            body="Researches local agents who fit your brokerage profile, drafts outbound openers, tracks the pipeline."
          />
          <CatalogJob
            name="Buyer-side concierge"
            body="Watches inbound buyer-side channels, classifies intent, hands warm prospects to the right human."
          />
          <CatalogJob
            name="Custom on request"
            body="If an office has a job the catalog does not cover, that becomes a custom-built agent during the engagement."
            highlight
          />
        </div>

        <p className="mt-8 max-w-3xl text-[14px] leading-relaxed text-slate-soft">
          The realty catalog grows as we run new agents on real work. New
          catalog entries earn their slot — we ship them when we have a
          written record of what they get right and what they get wrong.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/brokerages" className="btn-primary">
            For brokerages
            <span aria-hidden>→</span>
          </Link>
          <Link href="/for-agents" className="btn-secondary">
            For individual agents
            <span aria-hidden>→</span>
          </Link>
        </div>
      </Section>

      {/* ROADMAP */}
      <Section
        tone="deep"
        eyebrow="Roadmap"
        title="Other verticals follow the same operating model."
        intro="The platform is built so a new vertical means a new catalog and a new integration set, not a new product. We will not name a specific second vertical here until we have a real customer in pilot. The candidates below are directional — operations work that fits the same shape as realty."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          <RoadmapVertical
            name="Adjacent professional services"
            body="Verticals where small-to-mid offices run on owner time and recurring admin — the same operating-model fit as realty. We will name the second vertical when it has a paying pilot, not before."
          />
          <RoadmapVertical
            name="Custom verticals"
            body="If your operation does not fit a named vertical and you have a real operations problem worth solving, talk to us. Custom engagements are how new verticals get started."
          />
        </div>
      </Section>

      {/* HOW WE PICK A VERTICAL */}
      <Section
        eyebrow="How we pick a vertical"
        title="The bar a vertical has to clear before we ship it."
      >
        <ol className="grid gap-6 md:grid-cols-2">
          <Bar
            n="01"
            title="Recurring admin density"
            body="Enough recurring operational work that an agent fleet has clear leverage. Not one-off bespoke work; the kind of work that repeats every week."
          />
          <Bar
            n="02"
            title="Tractable integration surface"
            body="The systems where the work lives can be integrated cleanly. Not a vertical that runs entirely in one closed proprietary tool with no API."
          />
          <Bar
            n="03"
            title="Compliance shape we can support"
            body="The licensed-activity model is one we can carry safely — liability stays with the practitioner, not with us."
          />
          <Bar
            n="04"
            title="A real first customer"
            body="A real operator who is willing to pilot. We do not announce verticals on theory."
          />
        </ol>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Run an operation that does not fit a named vertical?
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            That is how new verticals get started. If your office has the
            shape — recurring admin, tractable integrations, willing to
            pilot — we want to hear about it.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20custom%20vertical"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Talk about a custom vertical
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function CatalogJob({
  name,
  body,
  highlight = false,
}: {
  name: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-paper p-7">
      <h3
        className={`font-display text-xl leading-tight md:text-2xl ${
          highlight ? "text-signal" : "text-ink"
        }`}
      >
        {name}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function RoadmapVertical({ name, body }: { name: string; body: string }) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-slate-soft">
        Roadmap
      </p>
      <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
        {name}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function Bar({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="border border-rule bg-paper p-6">
      <p className="font-mono text-[11px] tracking-eyebrow text-signal">{n}</p>
      <h3 className="mt-3 font-display text-xl leading-tight text-ink">
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{body}</p>
    </li>
  );
}
