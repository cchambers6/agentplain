import type { Metadata } from "next";
import Link from "next/link";
import { tokens } from "@/lib/brand/tokens";

export const metadata: Metadata = {
  title: "About",
  description:
    "agentplain is a service partnership for local businesses. We install a fleet of capable AI partners, run weekly reviews, and customize as your ops shift — so you stay focused on the people you serve.",
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
              The market is full of software that adds another dashboard, or
              another DIY AI tool the owner is supposed to configure on top
              of everything else they already do. agentplain is built on the
              opposite belief: what local businesses need is fewer tabs to
              keep open, fewer manual handoffs to remember, fewer hours spent
              on operations that someone, somewhere, has already done a
              thousand times — and a partner who runs it, not a platform that
              hands them another job.
            </p>
            <p>
              So we built a service-partnership team for local businesses,
              not a self-serve platform. The fleet of capable AI partners is
              one half of the product. The service team that installs it,
              runs the reviews, and customizes the agents as your ops shift
              is the other half. Together they replace the recurring drudge
              work for any of ten verticals: real estate, mortgage,
              insurance, property management, title &amp; escrow, recruiting,
              home services, CPA / tax, law, and RIA / wealth. The fleet
              hands off to a human at the steps where a human still has to
              decide; we hand off to you at the steps where licensed
              judgment lives.
            </p>
            <p className="text-ink">
              The fleet handles the systematic work. The service team runs
              the operation. The practitioner does the relationship work.
              That&apos;s the inversion — and we run it for you, not the
              other way around.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-paper-deep">
        <div className="container-wide grid gap-12 py-20 md:grid-cols-[1fr_2fr] md:py-28">
          <div>
            <p className="eyebrow mb-4">We run it on ourselves first</p>
          </div>
          <div className="max-w-prose space-y-5 text-[15px] leading-relaxed text-ink-soft">
            <p>
              flatsbo is our own brokerage. We run the agentplain service
              partnership on flatsbo before we sell it to anyone else — the
              same install, the same fleet, the same ongoing config. The
              brokerage in production today is ~35 cron-fired agents
              covering lead intake, listing coordination, contracts, CRM
              hygiene, recruiting, and production reporting. That&apos;s
              the service partnership running on a real local business.
            </p>
            <p>
              We sell what we already operate. Every skill in the fleet
              earned its way into the product by working on flatsbo first.
              Every handoff we promise customers — where the fleet stops
              and the human decides — is a handoff we&apos;ve already
              mapped against a real brokerage&apos;s compliance posture and
              its owner&apos;s tolerance for AI work. When you hire
              agentplain, you&apos;re hiring the team that has been running
              this pattern on itself long enough to know where the human
              still has to decide.
            </p>
            <p>
              agentplain itself is built BY the same fleet model we sell.
              The service team — the same shape we sell to customers —
              proposes capabilities, decomposes them into work, runs the
              tests, decides what&apos;s ready to ship, and surfaces the
              calls that need a human. We dogfood the partnership at every
              layer of the company.
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
              <span className="text-ink">
                Not a tool for you to figure out.
              </span>{" "}
              agentplain is a service partnership — we install, we run, we
              customize. Signing up gets you a partner who handles the AI
              ops, not a platform you operate. If you want to wire your own
              agents together from scratch, that&apos;s a different product.
            </p>
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
            <p>
              <span className="text-ink">
                Not a self-serve AI platform.
              </span>{" "}
              We don&apos;t hand you a fleet and a configuration UI and walk
              away. Every tier comes with a service team: we install, we
              run the reviews, we customize, we handle the change management
              as your ops shift. You stay in control of the work; we run the
              operation.
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
            First month free. Month-to-month. Cancel anytime. By month two,
            the fleet has either earned its seat or it hasn&apos;t.
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
