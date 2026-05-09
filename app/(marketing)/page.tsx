import Link from "next/link";
import Section from "@/components/Section";
import StackComparison from "@/components/StackComparison";
import FAQ from "@/components/FAQ";

const capabilities = [
  {
    number: "01",
    title: "A catalog of pre-trained agents per vertical",
    body: "Each agent is scoped to one operational job — intake, response, listings, marketing, transactions, compliance. They arrive trained on your vertical's workflows and tooling. For realty, the catalog runs the work above today.",
  },
  {
    number: "02",
    title: "Custom agents on request",
    body: "If your office has a job the catalog does not cover, we build the agent for it. Custom agents become part of your workspace, are versioned, and inherit the same review, audit, and rollback rails as catalog agents. Scoped engagement, priced per build.",
  },
  {
    number: "03",
    title: "Integrated with your stack",
    body: "Agents read and write inside the systems your team already uses — your CRM, your shared inbox, your transaction system, your file storage, your internal services. Read-only by default, write access opt-in per integration. Adapter pattern, no vendor lock-in.",
  },
  {
    number: "04",
    title: "Run inside your existing tools",
    body: "Drafts land in your inbox. Updates land in your CRM. Approvals route to your review queue. We do not send email on your behalf, do not stand up a parallel inbox, and do not ask your team to learn a new dashboard to do their day job.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-20 pt-20 md:pb-28 md:pt-28">
          <p className="eyebrow mb-6">An agent platform for operations work</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink sm:text-6xl md:text-[5.5rem] md:leading-[1.02]">
            Your tool stack is $1,500 / mo.
            <br />
            <span className="text-signal">Replace it for $79–$199 a seat.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            agentplain runs the recurring operations work inside small-to-mid
            businesses — lead response, listings, marketing, transactions,
            compliance — using fleets of pre-trained AI agents that work
            inside the inbox and CRM your team already uses. Per-realtor
            pricing that gets better with team size. Realty first; other
            verticals on the roadmap.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/pricing#calculator" className="btn-primary">
              Run the math on your office
              <span aria-hidden>→</span>
            </Link>
            <Link href="/capabilities" className="btn-secondary">
              See what's included
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-16 grid max-w-3xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
            <Stat label="Solo" value="$199 / mo" />
            <Stat label="At 10 realtors" value="$139 / seat" />
            <Stat label="At 50 realtors" value="$79 / seat" />
          </div>
        </div>
      </section>

      {/* PER-DEAL ROI PROOF */}
      <section className="border-b border-rule bg-paper-deep">
        <div className="container-wide py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="eyebrow mb-4">The math, plainly</p>
            <p className="font-display text-3xl leading-snug text-ink md:text-5xl md:leading-[1.1]">
              Close <span className="text-signal">1 extra deal a quarter</span> from
              leads we keep warm. At a 2.5% commission on a $400K home,
              that's <span className="text-signal">$10,000</span>. Solo agentplain
              pays for itself in <span className="text-signal">~73 days</span>.
              Brokerages with 10+ realtors? Pays for itself before week 1.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/pricing#calculator" className="btn-primary">
                Open the calculator
                <span aria-hidden>→</span>
              </Link>
              <Link href="/pricing" className="btn-secondary">
                See the pricing tiers
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STACK COMPARISON */}
      <Section
        eyebrow="What we replace"
        title="The typical realtor's stack is $510–$1,560 per month."
        intro="Most offices we talk to are paying somewhere in this range, per realtor, across CRM, lead-gen, listing copy, drip, social, transaction management, and showings. agentplain replaces the work those tools do — your team keeps the CRM and inbox they already use; the agents handle the rest."
      >
        <StackComparison />
      </Section>

      {/* WHAT THE PLATFORM IS */}
      <Section
        tone="deep"
        eyebrow="What the platform is"
        title="A full operating system for agent fleets — not a chatbot."
        intro="Agents do operational work end-to-end. They read state from your systems, draft outputs, route decisions to humans, and write the result back. The platform handles the rails — review, audit, rollback, billing — so the agents can focus on the work."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          {capabilities.map((c) => (
            <div key={c.number} className="bg-paper p-8 md:p-10">
              <p className="font-mono text-[11px] tracking-eyebrow text-signal">
                {c.number}
              </p>
              <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
                {c.title}
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                {c.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-3xl">
          <Link
            href="/platform"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See how the platform works →
          </Link>
        </div>
      </Section>

      {/* TWO BUYER PATHS */}
      <Section
        eyebrow="Two paths in"
        title="Same product. Different sizing."
        intro="The fleet works the same on a single realtor's book and on a 50-agent brokerage. The price per seat scales down as the team grows. Pick the path that matches who you're buying for."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <PathCard
            tag="Solo"
            headline="One realtor, $199 / month."
            body="Replaces $510–$1,560 / month of tooling. One extra deal a quarter pays for the year. The same agents the brokerage tier uses, sized for one."
            href="/for-agents"
            cta="For solo realtors"
          />
          <PathCard
            tag="Brokerage"
            headline="From 2 to 100+ seats."
            body="$169 / seat at 5, $139 at 10, $109 at 25, $79 at 50. Math gets better with team size. One extra deal across the team usually pays for the entire year — most brokerages clear that in week one."
            href="/brokerages"
            cta="For brokerages"
            highlight
          />
        </div>
      </Section>

      {/* VERTICALS */}
      <Section
        tone="deep"
        eyebrow="Verticals"
        title="Realty is Pin 1. Other verticals follow the same model."
        intro="The platform is vertical-agnostic — the rails for review, audit, isolation, and integration are the same regardless of industry. The agents are not. Each vertical gets its own catalog tuned to its work. We ship one vertical end-to-end before opening the next, and we will name a launch date for any of these once there is a real customer in pilot."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3 lg:grid-cols-5">
          <VerticalPin name="Realty" status="Pin 1 · in pilot" available />
          <VerticalPin name="Mortgage" status="Roadmap" />
          <VerticalPin name="Insurance" status="Roadmap" />
          <VerticalPin name="Property mgmt" status="Roadmap" />
          <VerticalPin name="Title & escrow" status="Roadmap" />
        </div>

        <div className="mt-10 max-w-3xl border-t border-rule pt-6">
          <Link
            href="/verticals"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See the verticals roadmap →
          </Link>
        </div>
      </Section>

      {/* OPERATING MODEL */}
      <Section
        eyebrow="The operating model"
        title="We run our own operations on the same fleet."
      >
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div className="border-t border-rule pt-6">
            <p className="eyebrow mb-3">Why this matters</p>
          </div>
          <div className="max-w-prose space-y-5 text-[15px] leading-relaxed text-ink-soft">
            <p>
              <span className="text-ink">Dogfooding is not optional.</span>{" "}
              Our internal portfolio runs on the same agent platform we sell.
              If the platform is not good enough for us, it is not good
              enough to ship.
            </p>
            <p>
              <span className="text-ink">Shared rails across verticals.</span>{" "}
              Compliance review, observability, billing, and access control
              are the same regardless of industry. We invest in those rails
              once and every vertical benefits.
            </p>
            <p>
              <span className="text-ink">Catalog grows by earning slots.</span>{" "}
              An agent ships when we have run it on real work, written down
              what it gets wrong, and decided we can stand behind it. Custom
              builds extend the platform on the brokerage path and feed back
              as catalog candidates for the next vertical release.
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" tone="deep" eyebrow="Questions worth asking" title="The honest version.">
        <FAQ />
      </Section>

      {/* FOOTER CTA */}
      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-32">
          <p className="eyebrow mb-6 text-paper/60">The thesis, plainly</p>
          <p className="max-w-3xl font-display text-4xl leading-[1.1] md:text-6xl md:leading-[1.05]">
            Run a 25-agent brokerage with five.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/75">
            The fleet handles enough of the recurring admin that offices
            stop building headcount around operations and start building it
            around production. Solo realtors get the same leverage at a
            smaller scale.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/pricing#calculator"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Run the math
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/capabilities"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              See what's included
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}

function PathCard({
  tag,
  headline,
  body,
  href,
  cta,
  highlight = false,
}: {
  tag: string;
  headline: string;
  body: string;
  href: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`flex h-full flex-col border bg-paper p-8 transition ${
        highlight ? "border-ink shadow-[6px_6px_0_0_#5F8060]" : "border-rule"
      }`}
    >
      <p className="eyebrow mb-3">{tag}</p>
      <h3 className="font-display text-3xl leading-tight text-ink md:text-4xl">
        {headline}
      </h3>
      <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">{body}</p>
      <div className="mt-auto pt-8">
        <Link href={href} className={highlight ? "btn-primary" : "btn-secondary"}>
          {cta}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

function VerticalPin({
  name,
  status,
  available = false,
}: {
  name: string;
  status: string;
  available?: boolean;
}) {
  return (
    <div className="bg-paper p-6">
      <p
        className={`font-mono text-[11px] tracking-eyebrow uppercase ${
          available ? "text-signal" : "text-slate-soft"
        }`}
      >
        {status}
      </p>
      <p className="mt-3 font-display text-xl leading-tight text-ink md:text-2xl">
        {name}
      </p>
    </div>
  );
}
