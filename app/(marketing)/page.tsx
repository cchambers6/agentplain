import Link from "next/link";
import Section from "@/components/Section";
import FAQ from "@/components/FAQ";

const capabilities = [
  {
    number: "01",
    title: "A catalog of pre-trained agents per vertical",
    body: "Each agent is scoped to one operational job — intake, routing, compliance, reporting, hygiene. They arrive trained on your vertical's workflows, language, and tooling. For realty that means brokerage operations; the catalog grows as we ship more verticals.",
  },
  {
    number: "02",
    title: "Custom agents on request",
    body: "If your operation has a job the catalog does not cover, we build the agent for it. Custom agents become part of your workspace, are versioned, and inherit the same review, audit, and rollback rails as catalog agents.",
  },
  {
    number: "03",
    title: "Integrated with your stack",
    body: "Agents read and write inside the systems your team already uses — your CRM, your shared inbox, your transaction system, your file storage, your internal services. Read-only by default, write access opt-in per integration.",
  },
  {
    number: "04",
    title: "Run inside your existing tools",
    body: "Drafts land in your inbox. Updates land in your CRM. Approvals route to your review queue. We do not send email on your behalf, do not stand up a parallel inbox, and do not ask your team to learn a new dashboard to do their day job.",
  },
];

const surfaces = [
  {
    name: "Brokerages and operators",
    href: "/brokerages",
    eyebrow: "High-touch platform",
    headline: "Custom-tuned agent fleet for your operation.",
    body: "We scope, build, and run a fleet that fits how your office actually works. Catalog agents plus custom builds, integrations to your stack, a 30-day paid pilot with a written outcome report and a continuation proposal.",
    price: "$1,500 – $4,500",
    priceNote: "30-day pilot · opt-in continuation",
    cta: "See pilot programs",
  },
  {
    name: "Individual agents",
    href: "/for-agents",
    eyebrow: "Self-serve app",
    headline: "Agents in your pocket. Built in.",
    body: "A scaled version of the same fleet, sized for an individual practitioner. Connect your inbox and CRM, pick the agents that match how you work, and let them handle the recurring admin between deals.",
    price: "$49 / mo",
    priceNote: "or $500 / yr · launching in Phase 3",
    cta: "Join the waitlist",
    upcoming: true,
  },
];

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-24 pt-20 md:pb-32 md:pt-28">
          <p className="eyebrow mb-6">An agent platform for operations work</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink sm:text-6xl md:text-[5.5rem] md:leading-[1.02]">
            Intelligence.
            <br />
            <span className="text-signal">Rooted in reality.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            agentplain builds and runs fleets of pre-trained AI agents that
            handle the recurring operations work inside small-to-mid businesses.
            Catalog agents plus custom builds, integrated with the systems your
            team already uses. Realty first. More verticals as the operating
            model proves out.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/platform" className="btn-primary">
              How the platform works
              <span aria-hidden>→</span>
            </Link>
            <Link href="/brokerages" className="btn-secondary">
              For brokerages
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-16 grid max-w-3xl gap-6 border-t border-rule pt-8 sm:grid-cols-3">
            <Stat label="Pin 1 vertical" value="Realty" />
            <Stat label="Surfaces" value="Two" />
            <Stat label="Stage" value="Pilot" />
          </div>
        </div>
      </section>

      {/* TWO SURFACES */}
      <Section
        eyebrow="Two ways to use it"
        title="A scaled self-serve app, and a high-touch brokerage platform."
        intro="The same agent fleet sits behind both surfaces. The difference is how much of your operation we tune it to and how much custom work we ship for you."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {surfaces.map((s) => (
            <article
              key={s.name}
              className="group flex h-full flex-col border border-rule bg-paper p-8 transition hover:border-ink/50"
            >
              <p className="eyebrow mb-3">{s.eyebrow}</p>
              <h3 className="font-display text-3xl leading-tight text-ink md:text-4xl">
                {s.headline}
              </h3>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
              <div className="mt-8 border-t border-rule pt-6">
                <p className="font-mono text-2xl text-ink">{s.price}</p>
                <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                  {s.priceNote}
                </p>
              </div>
              <div className="mt-6 pt-2">
                <Link
                  href={s.href}
                  className={s.upcoming ? "btn-secondary" : "btn-primary"}
                >
                  {s.cta}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* WHAT THE PLATFORM IS */}
      <Section
        tone="deep"
        eyebrow="What the platform is"
        title="A full operating system for agent fleets — not a chatbot."
        intro="agents do operational work end-to-end. They read state from your systems, draft outputs, route decisions to humans, and write the result back. The platform handles the rails — review, audit, rollback, billing — so the agents can focus on the work."
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

      {/* VERTICAL POSITIONING */}
      <Section
        eyebrow="Verticals"
        title="Realty is Pin 1. Other verticals follow the same model."
        intro="The platform is vertical-agnostic by design. Each vertical gets its own agent catalog, its own integration set, and its own compliance posture. We ship one vertical end-to-end before opening the next."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          <VerticalCard
            tag="Pin 1 · in pilot"
            name="Realty"
            body="Brokerage operations — listing intake, buyer routing, showings, compliance, CRM hygiene, production reporting, recruiting. The first vertical we are running end-to-end."
            available
          />
          <VerticalCard
            tag="Roadmap"
            name="Adjacent verticals"
            body="The same operating model extends to other small-to-mid B2B operations with recurring admin. We will name additional verticals once they have a real customer in pilot, not before."
          />
          <VerticalCard
            tag="Custom"
            name="Your operation"
            body="If your work does not fit a named vertical and you have a real operations problem worth solving, talk to us. Custom builds are how new verticals get started."
          />
        </div>
        <div className="mt-10 max-w-3xl">
          <Link
            href="/verticals"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See the verticals roadmap →
          </Link>
        </div>
      </Section>

      {/* OPERATING PROOF */}
      <Section
        tone="deep"
        eyebrow="The operating model"
        title="We run our own operations on the same fleet."
        intro="agentplain is the company. Our internal portfolio runs on the same agent platform we sell. That is the proof bar: if we can run our own businesses on this, brokerages can too."
      >
        <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
          <div className="border-t border-rule pt-6">
            <p className="eyebrow mb-3">Why this matters</p>
          </div>
          <div className="max-w-prose space-y-5 text-[15px] leading-relaxed text-ink-soft">
            <p>
              <span className="text-ink">Dogfooding is not optional.</span> Our
              own operations are the first customer of every catalog agent. If
              an agent is not good enough for us, it is not good enough to ship.
            </p>
            <p>
              <span className="text-ink">Shared services scale across verticals.</span>{" "}
              Compliance review, observability, billing, and access control are
              the same across every vertical. We invest in those rails once and
              every vertical benefits.
            </p>
            <p>
              <span className="text-ink">The catalog grows by earning slots.</span>{" "}
              An agent ships when we have run it on real work, written down what
              it gets wrong, and decided we can stand behind it. Not before.
            </p>
          </div>
        </div>

        <div className="mt-12 max-w-3xl border-t border-rule pt-6">
          <Link
            href="/about"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            About the company and operating model →
          </Link>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" eyebrow="Questions worth asking" title="The honest version.">
        <FAQ />
      </Section>

      {/* FOOTER CTA */}
      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-32">
          <p className="eyebrow mb-6 text-paper/60">The thesis, plainly</p>
          <p className="max-w-3xl font-display text-4xl leading-[1.1] md:text-6xl md:leading-[1.05]">
            Run a small business with the leverage of a much larger one.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/75">
            For a 25-agent brokerage that means running it with five people in
            the office. For an individual practitioner that means closing more
            deals without adding a back-office. The platform is the same. The
            sizing is up to you.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/brokerages"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              For brokerages
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/for-agents"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              For individual agents
              <span aria-hidden>→</span>
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

function VerticalCard({
  tag,
  name,
  body,
  available = false,
}: {
  tag: string;
  name: string;
  body: string;
  available?: boolean;
}) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p
        className={`font-mono text-[11px] tracking-eyebrow uppercase ${
          available ? "text-signal" : "text-slate-soft"
        }`}
      >
        {tag}
      </p>
      <h3 className="mt-4 font-display text-2xl leading-tight text-ink md:text-3xl">
        {name}
      </h3>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
