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

      {/* Data-handling differentiator — cuts across all four alternatives.
          Grounded in `lib/marketing/data-commitments.ts`; vendor-neutral. */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-16 md:py-20">
          <p className="eyebrow mb-3">One difference cuts across all four</p>
          <h2 className="max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl">
            A partner who remembers — without copying your raw data.
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
            <div className="bg-paper p-7 md:p-8">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                Do it yourself
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                A generic chatbot starts cold every session — it doesn&apos;t
                remember how your business works, so it never gets better. And
                wiring your own stack copies your client data into every tool:
                five vendors&apos; servers, five privacy policies. You&apos;re
                the only one tracking where it all lives.
              </p>
            </div>
            <div className="flex items-start gap-3 bg-paper p-7 md:p-8">
              <span aria-hidden className="mt-1 font-mono text-sm text-moss">
                ✓
              </span>
              <p className="text-[15px] leading-relaxed text-ink">
                Plaino keeps a working memory of how your business runs, so he
                gets better the longer you work together — and it&apos;s yours to
                export or delete anytime. Your raw records stay in your tools; he
                reads them in-flight and never keeps a copy. One partner, two
                clear buckets, and we never train on it, pool it, or sell it.{" "}
                <Link href="/data" className="text-ink underline underline-offset-2">
                  See both buckets →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper-deep">
        <div className="container-wide py-16 md:py-24">
          <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
            {comparisons.map((c) => (
              <Link
                key={c.slug}
                href={`/compare/${c.slug}`}
                className="group bg-paper p-7 transition hover:bg-paper md:p-8"
              >
                <p className="font-display text-2xl leading-snug text-ink">
                  agentplain vs.{" "}
                  <span className="text-clay">{c.alternative}</span>
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {c.cardSummary}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-eyebrow text-mute group-hover:text-clay">
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
