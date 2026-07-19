import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  VERTICAL_SLUGS,
  ON_RAMP_SLUGS,
  getVerticalContent,
} from "@/lib/verticals";

import Section from "@/components/Section";
import VerticalHero from "@/components/vertical/VerticalHero";
import VerticalDirectAnswer from "@/components/vertical/VerticalDirectAnswer";
import KillerWorkflowShowcase from "@/components/vertical/KillerWorkflowShowcase";
import ValueLoopExample from "@/components/vertical/ValueLoopExample";
import VerticalHowItWorks from "@/components/vertical/VerticalHowItWorks";
import JtbdTables from "@/components/vertical/JtbdTables";
import RoiAnchor from "@/components/vertical/RoiAnchor";
import ViolationAvoidance from "@/components/vertical/ViolationAvoidance";
import ClaimsTriadGrid from "@/components/vertical/ClaimsTriadGrid";
import PricingTierBanner from "@/components/vertical/PricingTierBanner";
import IntegrationsList from "@/components/vertical/IntegrationsList";
import VerticalFaq from "@/components/vertical/VerticalFaq";
import VerticalCta from "@/components/vertical/VerticalCta";
import JsonLd from "@/components/seo/JsonLd";
import {
  verticalBreadcrumbJsonLd,
  verticalServiceJsonLd,
  verticalProductJsonLd,
  verticalFaqQuestion,
  faqPageJsonLd,
} from "@/lib/seo/structured-data";
import { alternatesFor } from "@/lib/seo/metadata";

// Static generation for all 10 verticals plus on-ramp surfaces (e.g.
// `/general`) — no runtime DB lookups, no ISR cache churn. Adding an
// eleventh ratified vertical requires a new content file and a REGISTRY
// entry; adding an on-ramp surface requires a content file and an
// ON_RAMP_REGISTRY entry. The route picks both up automatically.
export function generateStaticParams() {
  return [...VERTICAL_SLUGS, ...ON_RAMP_SLUGS].map((vertical) => ({
    vertical,
  }));
}

export function generateMetadata({
  params,
}: {
  params: { vertical: string };
}): Metadata {
  const content = getVerticalContent(params.vertical);
  if (!content) return { title: "Not found" };
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: alternatesFor(`/${content.slug}`),
  };
}

export default function VerticalPage({
  params,
}: {
  params: { vertical: string };
}) {
  const content = getVerticalContent(params.vertical);
  if (!content) notFound();

  // AEO FAQ payload — the direct-answer block (Q = "What is agentplain for
  // {name}?", A = directAnswer) followed by the per-vertical FAQ items. Every
  // item here is ALSO rendered visibly on the page (VerticalDirectAnswer +
  // VerticalFaq), satisfying Google's "structured data mirrors visible
  // content" rule. Emitted only when there's at least one item.
  const faqForSchema = [
    ...(content.directAnswer
      ? [{ q: verticalFaqQuestion(content.name), a: content.directAnswer }]
      : []),
    ...(content.verticalFaq ?? []),
  ];

  return (
    <>
      {/* Structured data — BreadcrumbList for SERP breadcrumb display, plus a
          per-vertical Service payload sourced from the vertical's own content
          file (hero value-prop → schema description). No invented claims. */}
      <JsonLd
        id={`ld-vertical-breadcrumb-${content.slug}`}
        data={verticalBreadcrumbJsonLd(content)}
      />
      <JsonLd
        id={`ld-vertical-service-${content.slug}`}
        data={verticalServiceJsonLd(content)}
      />
      {/* Product payload — softened ROI band (15–50× cap; 107× never emitted)
          + a real per-seat Offer from the locked pricing ladder. */}
      <JsonLd
        id={`ld-vertical-product-${content.slug}`}
        data={verticalProductJsonLd(content)}
      />
      {/* FAQPage payload — direct-answer + per-vertical FAQ, mirroring the
          VerticalDirectAnswer + VerticalFaq sections rendered below. */}
      {faqForSchema.length > 0 ? (
        <JsonLd
          id={`ld-vertical-faq-${content.slug}`}
          data={faqPageJsonLd(faqForSchema)}
        />
      ) : null}
      <VerticalHero content={content} />
      {/* Editorial dateline stamp under the hero — content-agnostic, so it reads
          the same for all ten verticals plus the on-ramp surfaces. Heritage
          "dateline kicker" treatment; no vertical name hardcoded. */}
      <div className="border-b border-rule bg-paper">
        <div className="container-wide py-5">
          <p className="dateline">One managed fleet · 2026</p>
        </div>
      </div>
      {/* AEO direct-answer block, high on the page — the quotable "what is
          agentplain for {vertical}?" paragraph an answer engine can lift. */}
      {content.directAnswer ? (
        <VerticalDirectAnswer name={content.name} answer={content.directAnswer} />
      ) : null}
      {/* The named killer workflow, played live by the product's own demo
          runtime (sample data, deterministic). Renders only on the four live
          verticals with an authored story; returns null elsewhere. */}
      <KillerWorkflowShowcase slug={content.slug} />
      {content.valueLoopExample ? (
        <ValueLoopExample
          example={content.valueLoopExample}
          verticalName={content.name}
        />
      ) : null}
      <VerticalHowItWorks slug={content.slug} verticalName={content.name} />
      <JtbdTables tables={content.jtbdTables} />
      <RoiAnchor roi={content.roi} />
      <ViolationAvoidance paragraph={content.roi.violationAvoidance} />
      <ClaimsTriadGrid claims={content.claims} />
      {/* Grounded thesis pause — the one forest band on the template. Content-
          agnostic mission line (renders identically for all ten verticals), with
          a single wheat-foil accent on the closing phrase. Sits before pricing,
          with room from the dark closing CTA so two dark bands never stack. */}
      <Section tone="forest" eyebrow="Why we do this">
        <p className="max-w-3xl font-display text-2xl leading-snug text-paper md:text-3xl">
          We lift up local businesses by doing the work that takes their time and
          money away from <span className="foil">the people they serve</span>.
        </p>
      </Section>
      <PricingTierBanner tier={content.tier} verticalSlug={content.slug} />
      <IntegrationsList integrations={content.integrations} />
      {content.verticalFaq && content.verticalFaq.length > 0 ? (
        <VerticalFaq name={content.name} items={content.verticalFaq} />
      ) : null}
      <VerticalCta content={content} />
    </>
  );
}
