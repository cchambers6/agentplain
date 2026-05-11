import Link from "next/link";
import type { VerticalContent } from "@/lib/verticals/types";

export default function VerticalCta({
  content,
}: {
  content: VerticalContent;
}) {
  return (
    <section className="bg-ink text-paper">
      <div className="container-wide py-20 md:py-24">
        <p className="eyebrow mb-6 text-paper/60">Start the pilot</p>
        <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
          Run a {content.name.toLowerCase()} operation through the fleet.
        </h2>
        <p className="mt-6 max-w-xl text-paper/75">
          30-day paid pilot. Written outcome report at day 30. No annual
          contract, no auto-renew. Continuation is priced per workspace at the
          end of the pilot — your decision.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={`/signup?vertical=${content.slug}`}
            className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
          >
            Start free trial
            <span aria-hidden>→</span>
          </Link>
          <a
            href={`mailto:hello@agentplain.com?subject=${encodeURIComponent(
              `agentplain pilot — ${content.name}`,
            )}`}
            className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
          >
            Talk to the operator
          </a>
        </div>
      </div>
    </section>
  );
}
