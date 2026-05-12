import type { Metadata } from "next";
import Link from "next/link";
import { tokens } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title: "About — agentplain",
  description:
    "agentplain lifts up local businesses by doing the work that takes their time and money away from the people they serve. A fleet of capable AI partners — vertical-aware, compliance-first, built BY agents.",
};

// About page. Mission line carries the lede; tagline closes the page; vision
// anchors the "Where we're going" section.
//
// Per `project_agentplain_mission_and_positioning.md` (LOCKED 2026-05-11):
//   - Use the locked mission verbatim
//   - Close with the tagline ("Intelligence rooted in reality.")
//   - Use "local businesses" / "local business owners" — never "SMB,"
//     "knowledge workers," or "white-collar workers"
//   - Banned: "AI assistant" framing (even as a scare-quote callout in
//     "what we are not" — the rule's banned-variants list includes it)

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-3">About</p>
          <p className="font-display text-base leading-snug text-clay md:text-lg">
            {tokens.tagline}
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4rem] md:leading-[1.04]">
            We lift up{" "}
            <span className="text-clay">local businesses</span> by doing the
            work that takes their time and money away from the people they
            serve.
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
              Local business owners — realtors, mortgage brokers, insurance
              brokers, property managers, title and escrow professionals,
              recruiters, contractors, CPAs, lawyers, RIAs — spend most of
              their week on administrative work. Email triage, copying data
              between tools, drafting boilerplate, scheduling, status updates.
              The judgment work that built the business in the first place —
              client relationships, deal architecture, advisory — gets the
              leftover time.
            </p>
            <p>
              The market is full of software that adds another dashboard.
              agentplain is built on the opposite belief: what local
              businesses need is fewer tabs to keep open, fewer manual
              handoffs to remember, fewer hours spent on operations that
              someone, somewhere, has already done a thousand times.
            </p>
            <p>
              The product is a fleet of capable AI partners, scoped narrowly
              to the recurring jobs of running a local business in any of ten
              verticals: real estate, mortgage, insurance, property
              management, title &amp; escrow, recruiting, home services,
              CPA / tax, law, and RIA / wealth. The fleet hands off to a
              human at the steps where a human still has to decide.
            </p>
            <p className="text-ink">
              The fleet handles the systematic work. The practitioner does
              the relationship work. That's the inversion.
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
              CRM hygiene, recruiting — is the working precursor of this
              model. We've been running the pattern on ourselves long enough
              to know it works, and long enough to know where the human still
              has to decide. agentplain productizes that.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-paper">
        <div className="container-wide grid gap-12 py-20 md:grid-cols-[1fr_2fr] md:py-28">
          <div>
            <p className="eyebrow mb-4">Where we&apos;re going</p>
          </div>
          <div className="max-w-prose space-y-5 text-[15px] leading-relaxed text-ink-soft">
            <p className="font-display text-2xl leading-snug text-ink md:text-3xl">
              Local businesses can thrive through access to{" "}
              <span className="text-clay">
                affordable, best-in-class tools and services.
              </span>
            </p>
            <p>
              That's the vision. The leveling effect — solo practitioners
              competing with mid-size firms on operational depth; mid-size
              firms competing with enterprise on agility — comes from
              affordable access to the same capability stack the big shops
              have always paid for.
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
              <span className="text-ink">Not magic.</span> Intelligence
              rooted in reality means real product, real operators, real
              outcomes. We don&apos;t sell pixie dust. Every claim on this
              site cites a memory rule we can show you, or a real customer
              outcome.
            </p>
            <p>
              <span className="text-ink">
                Not a brokerage, lender, carrier, or licensed party.
              </span>{" "}
              Liability for licensed activities stays with you and your firm.
              We don&apos;t act as a regulated party in any of the ten
              verticals we support.
            </p>
            <p>
              <span className="text-ink">Not a CRM, AMS, LOS, or PMS.</span>{" "}
              The fleet drafts into the tools you already pay for. We
              don&apos;t ask you to migrate.
            </p>
            <p>
              <span className="text-ink">Not a chatbot.</span> The fleet runs
              in the background and surfaces drafts for your review. It&apos;s
              not on your homepage waiting to be prompted. Capable AI
              partners, scoped to the recurring jobs of your business.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-paper/60">
            The thesis, in one line
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            {tokens.tagline}
          </h2>
          <p className="mt-6 max-w-2xl text-paper/75">
            First month free across every tier. Month-to-month. Cancel
            anytime. By month two, the fleet has either earned its seat or it
            hasn&apos;t.
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
