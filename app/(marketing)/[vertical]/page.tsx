import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  VERTICAL_SLUGS,
  getVerticalContent,
} from "@/lib/verticals";

import VerticalHero from "@/components/vertical/VerticalHero";
import JtbdTables from "@/components/vertical/JtbdTables";
import RoiAnchor from "@/components/vertical/RoiAnchor";
import ClaimsTriadGrid from "@/components/vertical/ClaimsTriadGrid";
import PricingTierBanner from "@/components/vertical/PricingTierBanner";
import IntegrationsList from "@/components/vertical/IntegrationsList";
import VerticalCta from "@/components/vertical/VerticalCta";

// Static generation for all 10 verticals — no runtime DB lookups, no ISR
// cache churn. Adding an eleventh requires a new content file and a registry
// entry; the route picks it up automatically.
export function generateStaticParams() {
  return VERTICAL_SLUGS.map((vertical) => ({ vertical }));
}

export function generateMetadata({
  params,
}: {
  params: { vertical: string };
}): Metadata {
  const content = getVerticalContent(params.vertical);
  if (!content) return { title: "Not found — agentplain" };
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
      <VerticalHero content={content} />
      <JtbdTables tables={content.jtbdTables} />
      <RoiAnchor roi={content.roi} />
      <ClaimsTriadGrid claims={content.claims} />
      <PricingTierBanner tier={content.tier} />
      <IntegrationsList integrations={content.integrations} />
      <VerticalCta content={content} />
    </>
  );
}
