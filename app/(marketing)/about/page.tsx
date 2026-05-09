import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — agentplain",
  description:
    "agentplain is a platform for AI agent fleets that run operations work inside small-to-mid businesses. Two surfaces, multi-vertical, realty first. The company runs its own portfolio on the same platform.",
};

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">About</p>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Quiet software for businesses that run on owner time.
          </h1>
        </div>
      </section>

      <section className="border-b border-rule bg-paper">
        <div className="container-wide grid gap-12 py-20 md:grid-cols-[1fr_2fr] md:py-28">
          <div>
            <p className="eyebrow mb-4">The thesis</p>
          </div>
          <div className="max-w-prose space-y-6 text-lg leading-relaxed text-ink-soft">
            <p>
              Most small-to-mid businesses run on owner time. The owner
              answers the inbound, prepares the work, runs the recruiting,
              builds the reports, and chases the compliance details everyone
              hopes someone is checking.
            </p>
            <p>
              The market is full of software that adds another dashboard.
              agentplain is built around the opposite belief — what these
              businesses need is fewer tabs to keep open, fewer manual
              handoffs to remember, and fewer hours spent on operations that
              someone, somewhere, has already done a thousand times.
            </p>
            <p>
              The product is a platform for agent fleets — pre-trained
              catalog agents per vertical, custom agents on request,
              integrated with the systems your team already uses. They run
              quietly, in the background, and hand off to a human at the
              steps where a human still has to decide.
            </p>
            <p className="text-ink">
              Run a small business with the leverage of a much larger one.
              That is what we are building toward.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-paper-deep">
        <div className="container-wide grid gap-12 py-20 md:grid-cols-[1fr_2fr] md:py-28">
          <div>
            <p className="eyebrow mb-4">The operating model</p>
          </div>
          <div className="max-w-prose space-y-6 text-[15px] leading-relaxed text-ink-soft">
            <p>
              <span className="text-ink">A platform, not a single product.</span>{" "}
              The same platform runs every vertical. The agents change. The
              rails — review, audit, isolation, billing — do not.
            </p>
            <p>
              <span className="text-ink">Two surfaces.</span> A high-touch
              brokerage tier where we scope, build, and run the fleet for
              you, and a self-serve tier where individual practitioners pick
              from the catalog and run it themselves. Same agents
              underneath. Different sizing.
            </p>
            <p>
              <span className="text-ink">Multi-vertical from the start.</span>{" "}
              Realty is Pin 1 — the first vertical we are running
              end-to-end. Other verticals follow the same operating model.
              We will name new verticals when there is a real customer in
              pilot, not before.
            </p>
            <p>
              <span className="text-ink">We dogfood the platform.</span> Our
              own internal portfolio runs on the same agent fleet we sell.
              That is the proof bar — if the platform is not good enough for
              us, it is not good enough to ship.
            </p>
            <p>
              <span className="text-ink">Catalog grows by earning slots.</span>{" "}
              Catalog agents ship when we have run them on real work,
              written down what they get wrong, and decided we can stand
              behind them. Custom-built agents extend the platform on the
              brokerage tier and feed back into future catalog candidates.
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
              <span className="text-ink">Not a brokerage.</span> Liability
              for licensed activities stays with your broker of record. We
              do not represent buyers, sellers, or hold listings.
            </p>
            <p>
              <span className="text-ink">Not a CRM.</span> The agents write
              into the CRM you already pay for. We do not ask you to
              migrate.
            </p>
            <p>
              <span className="text-ink">Not a chatbot.</span> Each agent is
              scoped to one operational job and runs in the background, not
              on your homepage.
            </p>
            <p>
              <span className="text-ink">Not an outbound channel.</span>{" "}
              Agents draft into your existing inbox so the email goes out
              from your domain. We do not stand up a parallel outbound
              channel and we do not send on your behalf.
            </p>
            <p>
              <span className="text-ink">Not a 50-feature platform.</span>{" "}
              We ship one vertical end-to-end before opening the next, and
              the catalog grows when an agent has earned its slot, not
              before.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            See if the platform fits your operation.
          </h2>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/brokerages"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              For brokerages
            </Link>
            <Link
              href="/for-agents"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              For individual agents
            </Link>
            <a
              href="mailto:hello@agentplain.com"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              hello@agentplain.com
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
