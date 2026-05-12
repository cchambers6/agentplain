import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — agentplain",
  description:
    "An AI ops fleet for professional services firms. Ten verticals. Built BY a fleet of agents, not a human engineering team.",
};

// About page. Mission line carries the lede; the body answers Q1, Q4, Q6,
// Q8 from `project_agentplain_mission_and_positioning.md`. Banned framings
// avoided: no realty-only, no agent counts, no "AI assistant" / "automate
// everything."

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">About</p>
          <h1 className="max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4rem] md:leading-[1.04]">
            People get to do more relationship building and more of the work
            they enjoy, while{" "}
            <span className="text-clay">
              outsourcing the work that takes their time and money
            </span>{" "}
            that they can't and don't want to do.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
            That's the mission. Everything else is implementation detail.
          </p>
        </div>
      </section>

      <section className="border-b border-rule bg-paper">
        <div className="container-wide grid gap-12 py-20 md:grid-cols-[1fr_2fr] md:py-28">
          <div>
            <p className="eyebrow mb-4">The thesis</p>
          </div>
          <div className="max-w-prose space-y-6 text-lg leading-relaxed text-ink-soft">
            <p>
              Professional services firms — brokerages, agencies, practices,
              shops — spend most of their week on administrative work. Email
              triage, copying data between tools, drafting boilerplate,
              scheduling, status updates. The actual judgment work — client
              relationships, deal architecture, advisory — gets the leftover
              time.
            </p>
            <p>
              The market is full of software that adds another dashboard.
              agentplain is built on the opposite belief: what professional
              services firms need is fewer tabs to keep open, fewer manual
              handoffs to remember, fewer hours spent on operations that
              someone, somewhere, has already done a thousand times.
            </p>
            <p>
              The product is a fleet of pre-trained agents, scoped narrowly to
              the recurring jobs of running a professional services firm. Ten
              verticals on the roadmap: real estate, mortgage, insurance,
              property management, title &amp; escrow, recruiting, home
              services, CPA / tax, law, and RIA / wealth. The fleet hands off
              to a human at the steps where a human still has to decide.
            </p>
            <p className="text-ink">
              The fleet handles the systematic work. The practitioner does the
              relationship work. That's the inversion.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-paper-deep">
        <div className="container-wide grid gap-12 py-20 md:grid-cols-[1fr_2fr] md:py-28">
          <div>
            <p className="eyebrow mb-4">Built BY agents</p>
          </div>
          <div className="max-w-prose space-y-5 text-[15px] leading-relaxed text-ink-soft">
            <p>
              agentplain has no traditional engineering team. The same fleet
              model we sell builds the product. Agents propose capabilities,
              decompose them into work, execute the changes, run the tests,
              and surface decisions for human review.
            </p>
            <p>
              The brokerage running in production today — ~35 cron-fired
              agents covering lead intake, listing coordination, contracts,
              CRM hygiene, recruiting — is the v0 of this model. We've been
              running the pattern on ourselves long enough to know it works,
              and long enough to know where the human still has to decide.
              agentplain productizes that.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-paper">
        <div className="container-wide grid gap-12 py-20 md:grid-cols-[1fr_2fr] md:py-28">
          <div>
            <p className="eyebrow mb-4">What we are not</p>
          </div>
          <div className="max-w-prose space-y-5 text-[15px] leading-relaxed text-ink-soft">
            <p>
              <span className="text-ink">Not a brokerage, lender, carrier, or licensed party.</span>{" "}
              Liability for licensed activities stays with you and your firm.
              We don't act as a regulated party in any of the ten verticals we
              support.
            </p>
            <p>
              <span className="text-ink">Not a CRM, AMS, LOS, or PMS.</span>{" "}
              The fleet drafts into the tools you already pay for. We don't
              ask you to migrate.
            </p>
            <p>
              <span className="text-ink">Not a chatbot.</span> The fleet runs
              in the background and surfaces drafts for your review. It's not
              on your homepage waiting to be prompted.
            </p>
            <p>
              <span className="text-ink">Not an "AI assistant."</span> An ops
              fleet is the unit. It's vertical-aware, compliance-aware, and
              built to handle the recurring jobs of your firm — not to answer
              one-off questions.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            See if agentplain fits your firm.
          </h2>
          <p className="mt-6 max-w-2xl text-paper/75">
            First month free across every tier. Month-to-month. Cancel
            anytime. By month two, the fleet has either earned its seat or it
            hasn't.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/verticals"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              See all ten verticals
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
