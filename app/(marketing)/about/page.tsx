import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — agentplain",
  description:
    "agentplain is building a pre-trained AI agent fleet for small-to-mid brokerages. Realty first, insurance next.",
};

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <p className="eyebrow mb-6">About</p>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] text-ink md:text-7xl md:leading-[1.02]">
            Quiet software for brokerages.
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
              Most small-to-mid brokerages run on owner time. The owner answers
              the inbound, prepares the listings, runs the recruiting, builds
              the production reports, and chases the compliance details
              everyone hopes someone is checking.
            </p>
            <p>
              The market is full of software that adds a dashboard. agentplain
              is built around the opposite belief — what brokerages need is
              fewer tabs to keep open, fewer manual handoffs to remember, and
              fewer hours spent on operations that someone, somewhere, has
              already done a thousand times.
            </p>
            <p>
              The product is a fleet of pre-trained agents, scoped narrowly to
              the recurring jobs of running a brokerage. They run quietly, in
              the systems you already use, and they hand off to a human at the
              steps where a human still has to decide.
            </p>
            <p className="text-ink">
              Run a 25-agent brokerage with five. That is what we are building
              toward.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-paper-deep">
        <div className="container-wide grid gap-12 py-20 md:grid-cols-[1fr_2fr] md:py-28">
          <div>
            <p className="eyebrow mb-4">What we are not</p>
          </div>
          <div className="max-w-prose space-y-5 text-[15px] leading-relaxed text-ink-soft">
            <p>
              <span className="text-ink">Not a brokerage.</span> Liability for
              licensed activities stays with your broker of record. We do not
              represent buyers, sellers, or hold listings.
            </p>
            <p>
              <span className="text-ink">Not a CRM.</span> The agents write into
              the CRM you already pay for. We do not ask you to migrate.
            </p>
            <p>
              <span className="text-ink">Not a chatbot.</span> Each agent is
              scoped to one operational job and runs in the background, not on
              your homepage.
            </p>
            <p>
              <span className="text-ink">Not a 50-feature platform.</span> Seven
              agents at v0. Each one earns its place. The list grows when the
              evidence does.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="container-wide py-20 md:py-24">
          <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
            See if a pilot makes sense for your office.
          </h2>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/pilot"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              See the pilot
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
