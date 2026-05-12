import Link from "next/link";
import type { VerticalContent } from "@/lib/verticals/types";

// Closing CTA on every vertical page. Brand-token styled, mission-aligned.
// Per `project_stripe_both_surfaces.md` pilot pricing is killed — no
// "pilot" framing anywhere; the offer is first month free, month-to-month.
export default function VerticalCta({
  content,
}: {
  content: VerticalContent;
}) {
  return (
    <section className="bg-ink text-paper">
      <div className="container-wide py-20 md:py-24">
        <p className="eyebrow mb-6 text-paper/60">Start free</p>
        <h2 className="max-w-3xl font-display text-4xl leading-tight md:text-5xl">
          Run your {content.name.toLowerCase()} practice on the fleet.
        </h2>
        <p className="mt-6 max-w-2xl text-paper/75">
          First month free. Month-to-month from day one — no annual contract,
          no auto-renew. The fleet drafts; you decide what ships. Cancel
          anytime from your billing settings. Need more depth than Regular
          covers plug-and-play? We scope per customer — build with us.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href={`/app/sign-up?vertical=${content.slug}`}
            className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
          >
            Start free trial
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/custom"
            className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
          >
            Build with us
          </Link>
        </div>
      </div>
    </section>
  );
}
