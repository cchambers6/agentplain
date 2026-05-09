import type { Metadata } from "next";
import Link from "next/link";
import Section from "@/components/Section";
import StackComparison from "@/components/StackComparison";

export const metadata: Metadata = {
  title: "For brokerages — agentplain",
  description:
    "Per-realtor pricing that gets better with team size. $169/mo at 5 realtors, $139/mo at 10, $79/mo at 50. Replaces $510–$1,560/mo of typical realtor tooling per seat. Pays for itself before week 1 at 10+ realtors.",
};

const teamMath = [
  {
    seats: "5-realtor brokerage",
    band: "2–9 seats · $169 / seat / mo",
    monthly: "$845 / mo",
    annual: "$10,140 / yr (annual: $8,450)",
    stackReplaces: "$2,550 – $7,800 / mo of tooling",
    breakeven: "1 extra deal across the team. Roughly day 14.",
  },
  {
    seats: "10-realtor brokerage",
    band: "10–24 seats · $139 / seat / mo",
    monthly: "$1,390 / mo",
    annual: "$16,680 / yr (annual: $13,900)",
    stackReplaces: "$5,100 – $15,600 / mo of tooling",
    breakeven: "1 extra deal across the team. Pays for itself before week 1.",
    featured: true,
  },
  {
    seats: "25-realtor brokerage",
    band: "25–49 seats · $109 / seat / mo",
    monthly: "$2,725 / mo",
    annual: "$32,700 / yr (annual: $27,250)",
    stackReplaces: "$12,750 – $39,000 / mo of tooling",
    breakeven: "1 extra deal across the team pays the entire year in 4 days.",
  },
  {
    seats: "50-realtor brokerage",
    band: "50–99 seats · $79 / seat / mo",
    monthly: "$3,950 / mo",
    annual: "$47,400 / yr (annual: $39,500)",
    stackReplaces: "$25,500 – $78,000 / mo of tooling",
    breakeven: "1 extra deal pays the whole year in 3 days. Often pays for itself in the tooling-replaced line alone.",
  },
];

const startWith = [
  {
    name: "Inbound response",
    body: "Lead-gen leakage is usually the biggest dollar leak. We light up sub-60-second inbound reply, classification, and routing first.",
  },
  {
    name: "Listing turnaround",
    body: "If your office runs on listing volume, we light up listing copy, compliance check, property site, and the marketing pack.",
  },
  {
    name: "Transaction chase",
    body: "If deals fall on deadlines, we light up deadline tracking, document collection, and closing-day prep first.",
  },
];

export default function BrokeragesPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">For brokerages</p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Run a 25-agent brokerage with five.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Your office is paying somewhere between $510 and $1,560 per
            realtor per month for the tool stack — CRM, lead-gen, listing
            copy, drip, social, transaction management, showings — and
            burning 10+ hours per realtor per week running it. agentplain
            replaces the work those tools do for $79–$169 per seat,
            depending on team size. The math gets better with every
            realtor you add.
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
        </div>
      </section>

      {/* TEAM MATH */}
      <Section
        eyebrow="Team math, plainly"
        title="Pays for itself with one extra deal across the team."
        intro="The math at a few common team sizes. Annual saves two months in every band. The 'tools replaced' line is the typical realtor stack at $510–$1,560 per realtor per month — only the work, your office still keeps the CRM and inbox you already use."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {teamMath.map((t) => (
            <article
              key={t.seats}
              className={`flex flex-col border bg-paper p-7 ${
                t.featured
                  ? "border-ink shadow-[6px_6px_0_0_#5F8060]"
                  : "border-rule"
              }`}
            >
              <p className="eyebrow mb-3">{t.seats}</p>
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-signal">
                {t.band}
              </p>
              <p className="mt-3 font-display text-3xl text-ink md:text-4xl">
                {t.monthly}
              </p>
              <p className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                {t.annual}
              </p>

              <div className="mt-5 grid gap-4 border-t border-rule pt-4 text-[14px] leading-relaxed text-ink-soft">
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                    Tools replaced
                  </p>
                  <p className="mt-1">{t.stackReplaces}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-slate-soft">
                    Breakeven
                  </p>
                  <p className="mt-1">{t.breakeven}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 max-w-3xl border-t border-rule pt-6">
          <Link
            href="/pricing"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink hover:text-signal"
          >
            See the full seat-tier pricing →
          </Link>
        </div>
      </Section>

      {/* COMPARISON */}
      <Section
        tone="deep"
        eyebrow="What we replace"
        title="Your stack is $510–$1,560 per realtor per month."
        intro="Most brokerages we talk to run a stack roughly like this. agentplain replaces the work — your office keeps the CRM and inbox the team already uses. The layers above (schedulers, drip platforms, copy retainers, lead-gen add-ons) come off the bill."
      >
        <StackComparison />
      </Section>

      {/* WHAT WE LIGHT UP FIRST */}
      <Section
        eyebrow="Where to start"
        title="Pick the workflow that hurts the most. We'll start there."
        intro="Every seat gets every catalog agent. But on day one we light up the agents that target your worst leak first — and add the rest as your team gets used to working alongside them."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          {startWith.map((s) => (
            <div key={s.name} className="bg-paper p-7">
              <h3 className="font-display text-xl leading-tight text-ink md:text-2xl">
                {s.name}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* HOW THE FIRST MONTH GOES */}
      <Section
        tone="deep"
        eyebrow="How the first month goes"
        title="Quiet observation, then live."
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Stage
            n="01"
            title="Kickoff"
            body="60-minute scoping call. Pick the leak we're starting on. Read-only credentials shared with the systems the chosen agents need."
          />
          <Stage
            n="02"
            title="Shadow week"
            body="Week one, agents draft outputs but do not act. You and the team review the drafts and we tune for your house style."
          />
          <Stage
            n="03"
            title="Live"
            body="Approved agents go live. Compliance gate stays on every customer-facing output. Bi-weekly working session keeps the loop tight."
          />
          <Stage
            n="04"
            title="Add seats"
            body="Most brokerages start with their highest-producing realtors, prove it on real deals, and add the rest of the office. The seat-tier price-per-seat updates automatically when you cross a band."
          />
        </div>
      </Section>

      {/* WHAT WE ASK */}
      <Section
        eyebrow="What we ask of you"
        title="Honest about the lift on your side."
      >
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl text-ink">From the broker</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— A 60-minute scoping call to start</li>
              <li>— 30 minutes weekly during the first month</li>
              <li>— Approval gate on customer-facing drafts in week one</li>
              <li>— Honest feedback when an agent gets something wrong</li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl text-ink">From your stack</h3>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">
              <li>— Read access to the CRM your team operates in</li>
              <li>— Inboxes the fleet can draft into per realtor</li>
              <li>— An MLS or transaction-system export</li>
              <li>— A point of contact for IT questions</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            Run the math on your own office.
          </h2>
          <p className="mt-4 max-w-xl text-paper/75">
            The calculator on the pricing page takes your team size, admin
            hours, transactions, and average commission. Math updates live.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/pricing#calculator"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Open the calculator
            </Link>
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20brokerage%20call"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Book a 30-minute call
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function Stage({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border border-rule bg-paper p-6">
      <p className="font-mono text-[11px] tracking-eyebrow text-signal">{n}</p>
      <h3 className="mt-3 font-display text-xl leading-tight text-ink">
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
