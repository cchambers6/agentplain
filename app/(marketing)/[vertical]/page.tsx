import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  VERTICAL_SLUGS,
  ON_RAMP_SLUGS,
  getVerticalContent,
} from "@/lib/verticals";

import VerticalHero from "@/components/vertical/VerticalHero";
import ValueLoopExample from "@/components/vertical/ValueLoopExample";
import JtbdTables from "@/components/vertical/JtbdTables";
import RoiAnchor from "@/components/vertical/RoiAnchor";
import ViolationAvoidance from "@/components/vertical/ViolationAvoidance";
import ClaimsTriadGrid from "@/components/vertical/ClaimsTriadGrid";
import PricingTierBanner from "@/components/vertical/PricingTierBanner";
import IntegrationsList from "@/components/vertical/IntegrationsList";
import VerticalCta from "@/components/vertical/VerticalCta";
import JsonLd from "@/components/seo/JsonLd";
import {
  verticalBreadcrumbJsonLd,
  verticalServiceJsonLd,
} from "@/lib/seo/structured-data";

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
  };
}

export default function VerticalPage({
  params,
}: {
  params: { vertical: string };
}) {
  const content = getVerticalContent(params.vertical);
  if (!content) notFound();

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
      <VerticalHero content={content} />
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
      <VerticalCta content={content} />
    </>
  );
}
