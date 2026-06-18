import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  VERTICAL_SLUGS,
  ON_RAMP_SLUGS,
  getVerticalContent,
} from "@/lib/verticals";

import VerticalHero from "@/components/vertical/VerticalHero";
import VerticalDirectAnswer from "@/components/vertical/VerticalDirectAnswer";
import ValueLoopExample from "@/components/vertical/ValueLoopExample";
import JtbdTables from "@/components/vertical/JtbdTables";
import RoiAnchor from "@/components/vertical/RoiAnchor";
import ViolationAvoidance from "@/components/vertical/ViolationAvoidance";
import ClaimsTriadGrid from "@/components/vertical/ClaimsTriadGrid";
import PricingTierBanner from "@/components/vertical/PricingTierBanner";
import IntegrationsList from "@/components/vertical/IntegrationsList";
import { VerticalDataNote } from "@/components/vertical/VerticalDataNote";
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
      {/* AEO direct-answer block, high on the page — the quotable "what is
          agentplain for {vertical}?" paragraph an answer engine can lift. */}
      {content.directAnswer ? (
        <VerticalDirectAnswer name={content.name} answer={content.directAnswer} />
      ) : null}
      {content.valueLoopExample ? (
        <ValueLoopExample
          example={content.valueLoopExample}
          verticalName={content.name}
        />
      ) : null}
      <JtbdTables tables={content.jtbdTables} />
      <RoiAnchor roi={content.roi} />
      <ViolationAvoidance paragraph={content.roi.violationAvoidance} />
      <ClaimsTriadGrid claims={content.claims} />
      <PricingTierBanner tier={content.tier} />
      <IntegrationsList integrations={content.integrations} />
      {content.dataNote ? (
        <VerticalDataNote name={content.name} note={content.dataNote} />
      ) : null}
      {content.verticalFaq && content.verticalFaq.length > 0 ? (
        <VerticalFaq name={content.name} items={content.verticalFaq} />
      ) : null}
      <VerticalCta content={content} />
    </>
  );
}
