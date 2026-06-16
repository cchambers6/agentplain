import type { Metadata } from "next";
import Link from "next/link";

import { GLOSSARY_TERMS } from "@/lib/marketing/glossary";
import JsonLd from "@/components/seo/JsonLd";
import {
  breadcrumbJsonLd,
  definedTermSetJsonLd,
  faqPageJsonLd,
} from "@/lib/seo/structured-data";
import { alternatesFor } from "@/lib/seo/metadata";

export const metadata: Metadata = {
  title: "Glossary — service partnership, run-for-you, and more",
  description:
    "Plain-English definitions of the terms behind agentplain: service partner, AI service partnership, run-for-you vs. DIY, the fleet, draft-then-approve, and managed AI operations.",
  alternates: alternatesFor("/glossary"),
};

// Glossary. Each term renders as a visible definition AND emits a
// schema.org DefinedTerm. A FAQPage payload mirrors the same definitions
// (phrased "What is {term}?") so answer engines that prefer FAQ structure can
// also cite them — both payloads draw from the same GLOSSARY_TERMS source.
export default function GlossaryPage() {
  // FAQ mirror: every visible definition, phrased as a question. Keep the
  // question format identical to the visible <dt> so the structured data
  // mirrors what's on the page.
  const faqItems = GLOSSARY_TERMS.map((t) => ({
    q: `What is ${t.term.toLowerCase()}?`,
    a: t.definition,
  }));

  return (
    <>
      <JsonLd
        id="ld-glossary-breadcrumb"
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Glossary", path: "/glossary" },
        ])}
      />
      <JsonLd id="ld-glossary-termset" data={definedTermSetJsonLd(GLOSSARY_TERMS)} />
      <JsonLd id="ld-glossary-faq" data={faqPageJsonLd(faqItems)} />

      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-16 pt-20 md:pb-20 md:pt-24">
          <p className="eyebrow mb-4">Glossary</p>
          <h1 className="max-w-[48rem] font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[3.75rem] md:leading-[1.04]">
            The words we use, defined.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
            agentplain talks about a service partnership, a fleet, and
            run-for-you AI. Here's what each of those means — in plain English,
            with no hand-waving.
          </p>
        </div>
      </section>

      <section className="bg-paper">
        <div className="container-wide py-16 md:py-24">
          <dl className="grid gap-px overflow-hidden border border-rule bg-rule">
            {GLOSSARY_TERMS.map((t) => (
              <div key={t.slug} id={t.slug} className="scroll-mt-24 bg-paper p-7 md:p-8">
                <dt className="font-display text-2xl leading-snug text-ink">
                  {t.term}
                </dt>
                <dd className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
                  {t.definition}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 text-[15px] leading-relaxed text-mute">
            Want to see it in practice?{" "}
            <Link href="/compare" className="text-ink underline">
              Compare agentplain to the alternatives
            </Link>{" "}
            or{" "}
            <Link href="/verticals" className="text-ink underline">
              find your vertical
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
