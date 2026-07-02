import type { Metadata } from "next";
import Link from "next/link";

import { getAllComparisons } from "@/lib/marketing/comparisons";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { alternatesFor } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Compare agentplain",
  description:
    "How agentplain compares to the alternatives: building it yourself, a generic AI chatbot, hiring an assistant, or hiring an agency. Honest trade-offs — agentplain is a managed, run-for-you service partnership.",
  alternates: alternatesFor("/compare"),
};

// Compare hub. Links to each "agentplain vs {alternative}" page. The intro
// paragraph is itself answer-engine-extractable for "what are the
// alternatives to agentplain" queries.
export default function CompareHubPage() {
  const comparisons = getAllComparisons();
  return (
    <>
      <JsonLd
        id="ld-compare-hub-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Compare", path: "/compare" },
        ])}
      />

      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-16 pt-20 md:pb-20 md:pt-24">
          <p className="eyebrow mb-4">Compare</p>
          <h1 className="max-w-[48rem] font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.75rem] md:leading-[1.04]">
            How agentplain compares.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
            Most local businesses weigh agentplain against one of four
            alternatives: building their own AI agents, using a generic AI
            chatbot, hiring an assistant, or hiring an agency. Each has its
            place. The honest difference is that agentplain is a managed
            service partnership — a vertical-aware fleet that a service team
            installs, runs, and customizes for you, for a flat fee — not a
            tool you operate or a project you scope.
          </p>
        </div>
      </section>

      <section className="bg-paper">
        <div className="container-wide py-16 md:py-24">
          <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-4">
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              The alternatives, side by side
            </p>
            <p className="dateline">Updated 2026</p>
          </div>
          <div className="border-t border-rule">
            {comparisons.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="group grid items-baseline gap-3 border-b border-rule py-8 transition hover:bg-paper-deep md:grid-cols-[18rem_1fr_auto] md:gap-8 md:py-9"
              >
                <p className="font-display text-2xl leading-snug text-ink">
                  agentplain vs.{" "}
                  <span className="text-clay">{c.alternative}</span>
                </p>
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  {c.cardSummary}
                </p>
                <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-eyebrow text-mute group-hover:text-clay md:justify-end">
                  Read the comparison
                  <span aria-hidden>→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
